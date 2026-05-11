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

/**
 * Backend Proxy for Code Execution (using Judge0 CE)
 * Piston's public API became whitelisted in 2026, so we've migrated to Judge0.
 */
export const executeCodeProxy = async (req: Request, res: Response) => {
  const { language, code, files } = req.body;
  
  // Normalize language name
  const langId = JUDGE0_LANG_MAP[language?.toLowerCase()] || JUDGE0_LANG_MAP['javascript'];
  
  // Extract code from files if provided, or use standalone code field
  const sourceCode = code || (files && files[0] && files[0].content) || '';

  if (!sourceCode) {
    return res.status(400).json({ error: 'Source code is required' });
  }

  const host = process.env.JUDGE0_HOST || 'ce.judge0.com';
  const protocol = process.env.JUDGE0_PROTOCOL || 'https'; // INFRA-07: Support http for self-hosted
  const isRapidAPI = host.includes('rapidapi.com');
  
  console.log(`[Compiler Proxy] Executing ${language} (ID: ${langId}) via Judge0 (${protocol}://${host})...`);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (process.env.JUDGE0_API_KEY) {
      if (isRapidAPI) {
        headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
        headers['X-RapidAPI-Host'] = host;
      } else {
        headers['X-Auth-Token'] = process.env.JUDGE0_API_KEY;
      }
    } else if (process.env.NODE_ENV === 'production' && !process.env.JUDGE0_API_KEY) {
      console.error('[Compiler Proxy] ❌ CRITICAL: Running on public Judge0 instance in production without API key. Access denied.');
      return res.status(403).json({ 
        error: 'Code execution requires a configured Judge0 instance in production.',
        details: 'JUDGE0_API_KEY is missing in server environment.'
      });
    }

    const response = await withCircuitBreaker('judge0', () => 
      axios.post(`${protocol}://${host}/submissions?wait=true`, {
        language_id: langId,
        source_code: sourceCode,
        stdin: '', 
      }, {
        timeout: 25000, // Increased timeout for public instance
        headers
      })
    );

    const data = response.data;
    
    // Format Judge0 response to match Piston-like structure for frontend compatibility
    const formatted = {
      run: {
        stdout: data.stdout || '',
        stderr: (data.stderr || '') + (data.compile_output || ''),
        code: data.status?.id === 3 ? 0 : 1, // 3 is "Accepted" in Judge0
        signal: data.status?.description,
      },
      _raw: data
    };

    return res.json(formatted);
  } catch (err: any) {
    console.error('[Compiler Proxy] Judge0 failed:', err.message);
    captureException(err, { language, codeLength: sourceCode.length });
    
    let errorMessage = 'Code execution engine is currently unavailable.';
    let errorCode = 'SERVICE_UNAVAILABLE';

    if (err.message?.includes('CIRCUIT_OPEN')) {
      errorMessage = 'Code runner is under heavy load. Please try again in 30 seconds.';
      errorCode = 'CIRCUIT_OPEN';
    } else if (err.response?.status === 429) {
      errorMessage = 'Rate limit exceeded for code execution. Please try again later.';
      errorCode = 'RATE_LIMIT';
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      errorMessage = `Could not connect to code runner at ${process.env.JUDGE0_HOST || 'ce.judge0.com'}.`;
      errorCode = 'CONNECTION_FAILED';
    }

    res.status(err.response?.status || (err.message?.includes('CIRCUIT_OPEN') ? 503 : 502)).json({ 
      error: errorMessage,
      code: errorCode,
      details: err.message
    });
  }
};
