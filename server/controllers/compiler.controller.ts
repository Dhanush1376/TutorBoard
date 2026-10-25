import { Request, Response } from 'express';
import axios from 'axios';
import { withCircuitBreaker } from '../engine/core/circuitBreaker.js';
import { captureException } from '../utils/core/monitoring.js';

/**
 * Judge0 Language ID Mapping
 */
const JUDGE0_LANG_MAP: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  python3: 71,
  java: 62,
  cpp: 54,
  'c++': 54,
  c: 50,
  ruby: 72,
  go: 60,
  rust: 73,
};

export interface Judge0Result {
  stdout: string;
  stderr: string;
  compileOutput: string;
  statusId: number;
  status: string;
  exitCode: number | null;
}

/**
 * What one run may use in the sandbox, sent with every submission rather than
 * left to the instance's defaults (all within Judge0 CE's allowed maximums).
 */
export const RUN_LIMITS = {
  cpu_time_limit: 5, // seconds of CPU
  cpu_extra_time: 0.5,
  wall_time_limit: 10, // seconds on the clock (a program waiting on nothing still stops)
  memory_limit: 128_000, // KB; the JVM gets more below
  stack_limit: 64_000, // KB
  max_processes_and_or_threads: 60,
  max_file_size: 1_024, // KB a program may write
  enable_network: false,
} as const;
const JAVA_MEMORY_KB = 256_000;

export class Judge0Unavailable extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Run one program on Judge0 (an isolated sandbox: the code never runs in this
 * process). Shared by the plain runner and the step-through visualizer.
 */
export async function runOnJudge0(language: string, sourceCode: string, stdin = ''): Promise<Judge0Result> {
  const langId = JUDGE0_LANG_MAP[String(language || '').toLowerCase()];
  if (!langId) throw new Judge0Unavailable(`Unsupported language: ${language}`, 400, 'UNSUPPORTED');

  const host = process.env.JUDGE0_HOST || 'ce.judge0.com';
  const protocol = process.env.JUDGE0_PROTOCOL || 'https'; // INFRA-07: Support http for self-hosted
  const isRapidAPI = host.includes('rapidapi.com');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (process.env.JUDGE0_API_KEY) {
    if (isRapidAPI) {
      headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
      headers['X-RapidAPI-Host'] = host;
    } else {
      headers['X-Auth-Token'] = process.env.JUDGE0_API_KEY;
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[Compiler Proxy] ❌ CRITICAL: Running on public Judge0 instance in production without API key. Access denied.');
    throw new Judge0Unavailable('Code execution requires a configured Judge0 instance in production.', 403, 'NOT_CONFIGURED');
  }

  try {
    const response = await withCircuitBreaker('judge0', () =>
      // base64 both ways: without it Judge0 rejects any output it can't read as
      // UTF-8, which includes most compiler error messages.
      axios.post(`${protocol}://${host}/submissions?base64_encoded=true&wait=true`, {
        language_id: langId,
        source_code: Buffer.from(sourceCode, 'utf8').toString('base64'),
        stdin: Buffer.from(stdin || '', 'utf8').toString('base64'),
        ...RUN_LIMITS,
        ...(langId === JUDGE0_LANG_MAP.java ? { memory_limit: JAVA_MEMORY_KB } : {}),
      }, {
        timeout: 25000, // Increased timeout for public instance
        headers
      })
    );
    const data = response.data;
    // Compilers quote names with curly quotes in a non-UTF-8 code page; show them as plain quotes.
    const decode = (v?: string | null) => (v ? Buffer.from(v, 'base64').toString('utf8').replace(/�/g, "'") : '');
    return {
      stdout: decode(data.stdout),
      stderr: decode(data.stderr) + (data.status?.id >= 7 ? decode(data.message) : ''),
      compileOutput: decode(data.compile_output),
      statusId: data.status?.id ?? 0,
      status: data.status?.description || '',
      exitCode: data.exit_code ?? null,
    };
  } catch (err: any) {
    console.error('[Compiler Proxy] Judge0 failed:', err.message);
    captureException(err, { language, codeLength: sourceCode.length });
    if (err.message?.includes('CIRCUIT_OPEN')) {
      throw new Judge0Unavailable('Code runner is under heavy load. Please try again in 30 seconds.', 503, 'CIRCUIT_OPEN');
    }
    if (err.response?.status === 429) {
      throw new Judge0Unavailable('Rate limit exceeded for code execution. Please try again later.', 429, 'RATE_LIMIT');
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Judge0Unavailable(`Could not connect to code runner at ${host}.`, 502, 'CONNECTION_FAILED');
    }
    throw new Judge0Unavailable('Code execution engine is currently unavailable.', err.response?.status || 502, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Backend Proxy for Code Execution (using Judge0 CE)
 * Piston's public API became whitelisted in 2026, so we've migrated to Judge0.
 */
export const executeCodeProxy = async (req: Request, res: Response) => {
  const { language, code, files } = req.body;

  // Normalize language name; refuse anything we don't support instead of guessing.
  if (!JUDGE0_LANG_MAP[String(language || '').toLowerCase()]) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  // Extract code from files if provided, or use standalone code field
  const sourceCode = code || (files && files[0] && files[0].content) || '';

  if (!sourceCode) {
    return res.status(400).json({ error: 'Source code is required' });
  }

  console.log(`[Compiler Proxy] Executing ${language} via Judge0...`);

  try {
    const r = await runOnJudge0(language, sourceCode);
    // Piston-like structure for frontend compatibility
    return res.json({
      run: {
        stdout: r.stdout,
        stderr: r.compileOutput + r.stderr,
        code: r.statusId === 3 ? 0 : 1, // 3 is "Accepted" in Judge0
        signal: r.status,
      },
    });
  } catch (err: any) {
    return res.status(err.status || 502).json({ error: err.message, code: err.code || 'SERVICE_UNAVAILABLE' });
  }
};
