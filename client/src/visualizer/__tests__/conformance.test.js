// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { instrumentJavaScript } from '../adapters/jsInstrument';
import { runInstrumented } from '../adapters/jsRecorder';
import { assertTrace } from '../traceModel';
import { PROGRAMS, checkSortRun, checkErrorRun } from './conformance';

/* Python and JavaScript, the browser-run languages, against the shared checks.
   C, C++ and Java face the same checks in server/tests/visualizer.live.test.ts. */

async function javascript(source) {
  const r = await runInstrumented(instrumentJavaScript(source).code, { patchPromises: false });
  return assertTrace({ version: 1, language: 'javascript', mode: 'instrumented', source, steps: r.steps, stdout: r.stdout, error: r.error, truncated: r.truncated, maxSteps: 1000, notes: r.notes });
}

// The Python tracer is plain Python; desktop CPython runs it the same way Pyodide does.
const pythonCmd = ['python3', 'python'].find((cmd) => spawnSync(cmd, ['--version']).status === 0);
function python(source) {
  const tracer = readFileSync(path.resolve(__dirname, '../adapters/pythonTracer.py'), 'utf8');
  const script = path.join(mkdtempSync(path.join(tmpdir(), 'tbpy-')), 'run.py');
  writeFileSync(script, `${tracer}\nimport sys, json\nargs = json.loads(sys.stdin.read())\nsys.__stdout__.write(__tb_trace(args['source'], args['maxSteps'], args['stdin']))\n`);
  const raw = JSON.parse(execFileSync(pythonCmd, ['-I', script], { input: JSON.stringify({ source, maxSteps: 1000, stdin: '' }), encoding: 'utf8' }));
  return assertTrace({ version: 1, language: 'python', mode: 'traced', source, maxSteps: 1000, notes: [], ...raw });
}

describe('JavaScript: the eight checks', () => {
  it('a bubble sort run shows variables, both ways of the if, the loop, the call and its return, the array changing, and the end', async () => {
    expect(checkSortRun(await javascript(PROGRAMS.javascript.sort), 'javascript')).toEqual([]);
  });
  it('a failing program stops at the line that failed', async () => {
    expect(checkErrorRun(await javascript(PROGRAMS.javascript.error.source), 'javascript')).toEqual([]);
  });
});

describe.skipIf(!pythonCmd)('Python: the eight checks', () => {
  it('a bubble sort run shows variables, both ways of the if, the loop, the call and its return, the array changing, and the end', () => {
    expect(checkSortRun(python(PROGRAMS.python.sort), 'python')).toEqual([]);
  });
  it('a failing program stops at the line that failed', () => {
    expect(checkErrorRun(python(PROGRAMS.python.error.source), 'python')).toEqual([]);
  });
});
