import { runOnJudge0, Judge0Result } from '../controllers/compiler.controller.js';
import { instrumentCFamily } from './instrumentCFamily.js';
import { instrumentJava } from './instrumentJava.js';
import { parseTraceOutput, TraceStep } from './parseTrace.js';

/**
 * Step-through traces for C, C++ and Java. The program is instrumented here
 * (text only — it never runs in this process) and then really compiled and run
 * in the Judge0 sandbox; every step in the trace was printed by that run.
 */

export type CompiledLanguage = 'c' | 'cpp' | 'java';
export const COMPILED_LANGUAGES: CompiledLanguage[] = ['c', 'cpp', 'java'];
export const TRACE_LIMITS = { maxSteps: 500, maxBytes: 700_000, maxSource: 20_000, maxStdin: 10_000 };

export interface Trace {
  version: 1;
  language: CompiledLanguage;
  mode: 'instrumented';
  source: string;
  steps: TraceStep[];
  stdout: string;
  error: null | { kind: 'compile' | 'runtime' | 'timeout' | 'limit' | 'setup'; message: string; line?: number | null };
  truncated: boolean;
  maxSteps: number;
  notes: string[];
}

const NOTES: Record<CompiledLanguage, string[]> = {
  c: [
    'A variable appears once it has been given a value.',
    'Pointers are followed only when that memory can be read; otherwise the address is shown.',
  ],
  cpp: ['A variable appears once it has been given a value.', 'Lambda bodies run as one step.'],
  java: ['A variable appears once Java counts it as assigned.', 'Static fields are not shown.'],
};

const CRASH: Record<number, string> = {
  7: 'Crashed: the program used memory it doesn\'t own (segmentation fault).',
  8: 'Stopped: the program wrote too much output.',
  9: 'Crashed: an arithmetic error, such as dividing by zero.',
  10: 'Stopped: the program aborted (abort() or a failed assert).',
};

// The same crashes, when the sandbox reports them only as a non-zero exit with the
// shell's signal message in stderr ("run.sh: line 1: 3 Floating point exception …").
const CRASH_TEXT: [RegExp, string][] = [
  [/Floating point exception|SIGFPE/, CRASH[9]],
  [/Segmentation fault|SIGSEGV/, CRASH[7]],
  [/File size limit exceeded|SIGXFSZ/, CRASH[8]],
  [/\bAborted\b|SIGABRT/, CRASH[10]],
];

const fileName = (lang: CompiledLanguage) => (lang === 'java' ? 'Main.java' : lang === 'c' ? 'main.c' : 'main.cpp');

// The first line number a compiler or stack trace gives for the learner's file.
function lineFrom(text: string, lang: CompiledLanguage, lineCount: number): number | null {
  const re = lang === 'java' ? /Main\.java:(\d+)/g : new RegExp(`${fileName(lang).replace('.', '\\.')}:(\\d+)`, 'g');
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= lineCount) return n;
  }
  return null;
}

// Compiler output with the sandbox's paths trimmed, so it reads as the learner's file.
function cleanCompilerText(text: string) {
  return text.replace(/\/box\//g, '').replace(/\r/g, '').trim().slice(0, 4000);
}

function runtimeError(r: Judge0Result, lang: CompiledLanguage, lineCount: number, lastLine: number | null): Trace['error'] {
  const stderr = cleanCompilerText(r.stderr);
  if (r.statusId === 5) return { kind: 'timeout', message: 'Stopped: the program ran past the time limit. Is there an endless loop?', line: lastLine };
  if (lang === 'java') {
    const first = stderr.split('\n').find((l) => /Exception|Error/.test(l)) || stderr.split('\n')[0] || r.status;
    return { kind: 'runtime', message: first.replace(/^Exception in thread "main" /, ''), line: lineFrom(stderr, lang, lineCount) ?? lastLine };
  }
  const thrown = stderr.match(/terminate called after throwing an instance of '([^']+)'\s*(?:what\(\):\s*(.*))?/);
  if (thrown) return { kind: 'runtime', message: `Uncaught exception ${thrown[1]}${thrown[2] ? `: ${thrown[2].trim()}` : ''}`, line: lastLine };
  if (CRASH[r.statusId]) return { kind: 'runtime', message: CRASH[r.statusId], line: lastLine };
  const crash = CRASH_TEXT.find(([re]) => re.test(stderr));
  if (crash) return { kind: 'runtime', message: crash[1], line: lastLine };
  if (r.statusId === 11) return { kind: 'runtime', message: `The program ended with exit code ${r.exitCode ?? 1}.${stderr ? ` ${stderr.split('\n')[0]}` : ''}`, line: lastLine };
  return { kind: 'runtime', message: stderr.split('\n')[0] || r.status || 'The program stopped with an error.', line: lastLine };
}

export class TraceInputError extends Error {}

export async function traceCompiled(language: CompiledLanguage, source: string, stdin = ''): Promise<Trace> {
  if (!COMPILED_LANGUAGES.includes(language)) throw new TraceInputError(`Unsupported language: ${language}`);
  if (typeof source !== 'string' || !source.trim()) throw new TraceInputError('Source code is required.');
  if (source.length > TRACE_LIMITS.maxSource) throw new TraceInputError(`Programs up to ${TRACE_LIMITS.maxSource} characters can be stepped through.`);
  if (stdin.length > TRACE_LIMITS.maxStdin) throw new TraceInputError('The input is too long.');
  source = source.replace(/\r\n/g, '\n');
  const lineCount = source.split('\n').length;
  const base = (): Trace => ({
    version: 1, language, mode: 'instrumented', source, steps: [], stdout: '', error: null, truncated: false,
    maxSteps: TRACE_LIMITS.maxSteps, notes: [...NOTES[language]],
  });

  let instrumented: { code: string; notes: string[] };
  try {
    instrumented = language === 'java'
      ? await instrumentJava(source, TRACE_LIMITS)
      : await instrumentCFamily(source, language, TRACE_LIMITS);
  } catch (err: any) {
    console.error('[Visualizer] instrumenting failed:', err?.message);
    instrumented = { code: '', notes: [] };
  }

  const result = instrumented.code ? await runOnJudge0(language, instrumented.code, stdin) : null;

  // It didn't compile. Find out whether that's the learner's code or the step markers.
  if (!result || result.statusId === 6) {
    const plain = await runOnJudge0(language, source, stdin);
    const trace = base();
    if (plain.statusId === 6) {
      const message = cleanCompilerText(plain.compileOutput) || 'The program did not compile.';
      trace.error = { kind: 'compile', message, line: lineFrom(message, language, lineCount) };
      return trace;
    }
    if (result) console.warn('[Visualizer] instrumented build failed:', cleanCompilerText(result.compileOutput).slice(0, 600));
    trace.stdout = plain.stdout;
    trace.error = {
      kind: 'setup',
      message: 'This program ran, but it uses something the step-through can\'t follow yet, so only its output is shown.',
    };
    return trace;
  }

  const parsed = parseTraceOutput(result.stdout, lineCount);
  const trace = base();
  trace.steps = parsed.steps;
  trace.stdout = parsed.stdout;
  trace.truncated = parsed.truncated;
  trace.notes.push(...instrumented.notes);
  if (parsed.thinSteps) trace.notes.push('Some steps held too much data to show their values.');
  const lastLine = parsed.steps.length ? parsed.steps[parsed.steps.length - 1].line : null;

  if (parsed.truncated) {
    trace.error = {
      kind: 'limit',
      message: parsed.limitReason === 'size' ? 'Stopped: the steps got too large to record.' : `Stopped after ${TRACE_LIMITS.maxSteps} steps.`,
    };
  } else if (result.statusId !== 3) {
    trace.error = runtimeError(result, language, lineCount, lastLine);
  }
  return trace;
}
