// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { instrumentJavaScript, InstrumentError } from '../adapters/jsInstrument';
import { runInstrumented } from '../adapters/jsRecorder';
import { assertTrace, TRACE_VERSION } from '../traceModel';

/**
 * Run a program the way the sandbox worker does (jsTraceWorker.js → runInstrumented),
 * minus the Promise.prototype.then swap, which isn't safe inside a test runner.
 */
async function trace(source, maxSteps = 1000) {
  const { code } = instrumentJavaScript(source);
  const r = await runInstrumented(code, { maxSteps, patchPromises: false });
  const error = r.error?.kind === 'runtime' ? r.error.message : null;
  return Object.assign(
    assertTrace({ version: TRACE_VERSION, language: 'javascript', mode: 'instrumented', source, steps: r.steps, stdout: r.stdout, error: error && { kind: 'runtime', message: error }, truncated: r.truncated, maxSteps, notes: r.notes }),
    { raw: r },
  );
}
const top = (s) => s.frames[s.frames.length - 1];
const val = (s, name) => top(s).locals.find((l) => l.name === name)?.value;

describe('JavaScript tracer', () => {
  it('keeps the program\'s own line numbers (inserts no line breaks)', () => {
    const src = 'let a = 1;\nfor (let i = 0; i < 2; i++) {\n  a += i;\n}\nif (a) a++; else a--;\n';
    expect(instrumentJavaScript(src).code.split('\n').length).toBe(src.split('\n').length);
  });

  it('records loops, calls, returns and printed output', async () => {
    const t = await trace('function sq(x) {\n  return x * x;\n}\nlet total = 0;\nfor (let i = 1; i <= 2; i++) {\n  total += sq(i);\n}\nconsole.log(total);\n');
    expect(t.stdout).toBe('5\n');
    const rets = t.steps.filter((s) => s.event === 'return' && top(s).name === 'sq').map((s) => s.ret.v);
    expect(rets).toEqual([1, 4]);
    // The header step runs before every test of the loop, with i as it is then.
    expect(t.steps.filter((s) => s.line === 5).map((s) => val(s, 'i')?.v)).toEqual([1, 2, 3]);
    const last = t.steps[t.steps.length - 1];
    expect(last.event).toBe('return');
    expect(last.out).toBe(2);
    expect(val(last, 'total').v).toBe(5);
  });

  it('shows every frame live: a caller sees what the callee changed', async () => {
    const t = await trace('function push(arr) {\n  arr.push(9);\n  return arr.length;\n}\nconst xs = [1];\nconst n = push(xs);\n');
    const inside = t.steps.find((s) => s.event === 'return' && top(s).name === 'push');
    const caller = inside.frames[0];
    expect(caller.locals.find((l) => l.name === 'xs').value.items.map((x) => x.v)).toEqual([1, 9]);
  });

  it('reads let/const before they exist without crashing (temporal dead zone)', async () => {
    const t = await trace('const before = 1;\nconst later = before + 1;\nconsole.log(later);\n');
    expect(t.error).toBeNull();
    expect(val(t.steps[0], 'later')).toBeUndefined();
    expect(t.stdout).toBe('2\n');
  });

  it('handles classes, this, arrow bodies, switch, labels, do-while and try/finally', async () => {
    const src = [
      'class Counter {',
      '  constructor() { this.n = 0; }',
      '  inc(by = 1) { this.n += by; return this; }',
      '}',
      'const c = new Counter().inc(2);',
      'const twice = (x) => ({ v: x * 2 });',
      'let k = 0;',
      'outer: for (let i = 0; i < 3; i++) {',
      '  for (let j = 0; j < 3; j++) { if (j === 1) continue outer; k++; }',
      '}',
      'do { k++; } while (k < 5);',
      'switch (k) { case 5: k = 50; break; default: k = -1; }',
      'let f = 0;',
      'try { throw new Error("boom"); } catch (e) { f = 1; } finally { f += 10; }',
      'console.log(c.n, twice(3).v, k, f);',
    ].join('\n');
    const t = await trace(src);
    expect(t.error).toBeNull();
    expect(t.stdout).toBe('2 6 50 11\n');
    const incCall = t.steps.find((s) => s.event === 'call' && top(s).name === 'inc');
    expect(val(incCall, 'this')).toMatchObject({ t: 'obj', cls: 'Counter' });
    expect(t.steps.some((s) => s.event === 'call' && top(s).name === 'twice')).toBe(true);
  });

  it('does not run getters while reading objects', async () => {
    const t = await trace('let hits = 0;\nconst o = { get g() { hits++; return 1; }, plain: 2 };\nconsole.log(hits);\n');
    expect(t.stdout).toBe('0\n');
    const o = val(t.steps[t.steps.length - 1], 'o');
    expect(o.fields).toEqual([{ name: 'g', value: { t: 'other', v: 'getter' } }, { name: 'plain', value: { t: 'num', v: 2 } }]);
  });

  it('shows shared and circular objects once, then by reference', async () => {
    const t = await trace('const a = { v: 1 };\na.self = a;\nconst b = a;\nconsole.log(1);\n');
    const s = t.steps[t.steps.length - 1];
    const a = val(s, 'a');
    expect(a.fields.find((f) => f.name === 'self').value).toEqual({ t: 'ref', id: a.id });
    expect(val(s, 'b')).toEqual({ t: 'ref', id: a.id });
  });

  it('reports a thrown error at the line that threw, once', async () => {
    const t = await trace('function f(o) {\n  return o.x.y;\n}\nf({});\n');
    expect(t.error.message).toMatch(/TypeError/);
    const exc = t.steps.filter((s) => s.event === 'exception');
    expect(exc).toHaveLength(1);
    expect(exc[0].line).toBe(2);
  });

  it('stops an endless loop at the step limit, even inside try/catch', async () => {
    const t = await trace('let i = 0;\nwhile (true) {\n  try { i++; } catch (e) {}\n}\n', 50);
    expect(t.truncated).toBe(true);
    expect(t.steps).toHaveLength(50);
  });

  it('supports top-level await and async functions', async () => {
    const t = await trace('async function one() {\n  return 1;\n}\nconst v = await one();\nconsole.log(v);\n');
    expect(t.stdout).toBe('1\n');
  });

  it('turns a syntax error into a line number', () => {
    expect(() => instrumentJavaScript('let x = ;\n')).toThrow(InstrumentError);
    try {
      instrumentJavaScript('let ok = 1;\nlet x = ;\n');
    } catch (e) {
      expect(e.line).toBe(2);
    }
  });
});

describe('JavaScript event loop (observed, not simulated)', () => {
  it('runs the script, then microtasks, then timers by due time — without waiting in real time', async () => {
    const src = [
      'console.log("script start");',
      'setTimeout(function late() { console.log("timer 1000"); }, 1000);',
      'setTimeout(function soon() { console.log("timer 0"); }, 0);',
      'queueMicrotask(function micro() { console.log("microtask"); });',
      'console.log("script end");',
    ].join('\n');
    const started = Date.now();
    const t = await trace(src);
    expect(Date.now() - started).toBeLessThan(900);
    expect(t.stdout).toBe('script start\nscript end\nmicrotask\ntimer 0\ntimer 1000\n');
    expect(t.error).toBeNull();
    // while the script runs, both timers wait, soonest first, and the microtask is queued
    const atEnd = t.steps.find((s) => s.line === 5);
    expect(atEnd.loop.phase).toBe('script');
    expect(atEnd.loop.timers.map((x) => x.label)).toEqual(['setTimeout → soon', 'setTimeout → late']);
    expect(atEnd.loop.micro).toEqual(['queueMicrotask → micro']);
    // the 1000 ms callback runs as a task at simulated time 1000
    const lateStep = t.steps.find((s) => s.frames.some((f) => f.name === 'late'));
    expect(lateStep.loop).toMatchObject({ phase: 'macro', task: 'setTimeout → late', now: 1000 });
  });

  it('takes an awaiting function off the call stack and puts it back when it resumes', async () => {
    const src = [
      'async function load() {',
      '  const v = await new Promise((r) => setTimeout(() => r(42), 500));',
      '  return v + 1;',
      '}',
      'load().then((x) => console.log(x));',
      'console.log("not blocked");',
    ].join('\n');
    const t = await trace(src);
    expect(t.stdout).toBe('not blocked\n43\n');
    const pause = t.steps.find((s) => s.event === 'await');
    expect(pause.frames.map((f) => f.name)).toEqual(['global', 'load']);
    const after = t.steps.find((s) => s.line === 6);
    expect(after.frames.map((f) => f.name)).toEqual(['global']); // load() is paused, not on the stack
    expect(after.loop.awaiting).toEqual([{ name: 'load', line: 2 }]);
    const resume = t.steps.find((s) => s.event === 'resume');
    expect(resume.frames.map((f) => f.name)).toEqual(['global', 'load']);
    expect(resume.loop.awaiting).toEqual([]);
  });

  it('a rejected await puts the function back on the stack to fail at its line', async () => {
    const t = await trace('async function f() {\n  await Promise.reject(new Error("nope"));\n}\nf().catch((e) => console.log(e.message));\n');
    expect(t.stdout).toBe('nope\n');
    const exc = t.steps.find((s) => s.event === 'exception');
    expect(exc.frames.map((f) => f.name)).toEqual(['global', 'f']);
  });

  it('an error thrown in a timer callback is the program\'s error', async () => {
    const t = await trace('setTimeout(function boom() {\n  null.x;\n}, 10);\n');
    expect(t.error.message).toMatch(/TypeError/);
    expect(t.steps.find((s) => s.event === 'exception').line).toBe(2);
  });

  it('stops a setInterval that never clears', async () => {
    const t = await trace('let n = 0;\nsetInterval(() => { n++; }, 100);\n', 5000);
    expect(t.raw.notes.join(' ')).toMatch(/Timers were stopped after 200 runs/);
  });

  it('records no event-loop data for programs that never schedule anything', async () => {
    const t = await trace('let a = 1;\nconsole.log(a);\n');
    expect(t.steps.every((s) => !s.loop)).toBe(true);
  });
});
