// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertTrace, describeStep, changedNames, valueLabel, sourceHash, timelineMarks } from '../traceModel';
import { findShapes } from '../shapes';

const num = (v) => ({ t: 'num', v });
const list = (id, ...xs) => ({ t: 'list', kind: 'list', id, len: xs.length, items: xs.map(num) });
const step = (line, locals, extra = {}) => ({ line, event: 'line', frames: [{ id: 1, name: 'global', line, locals }], out: 0, ...extra });
const trace = (steps, extra = {}) => ({ version: 1, language: 'python', mode: 'traced', source: 'a\nb\nc\nd\n', steps, stdout: '', error: null, truncated: false, maxSteps: 1000, notes: [], ...extra });

describe('trace format', () => {
  it('accepts a good trace and refuses broken ones', () => {
    expect(() => assertTrace(trace([step(1, [])]))).not.toThrow();
    expect(() => assertTrace(trace([step(9, [])]))).toThrow(/line 9/);
    expect(() => assertTrace(trace([{ ...step(1, []), frames: [] }]))).toThrow(/no frames/);
    expect(() => assertTrace(trace([step(1, [])], { mode: 'guessed' }))).toThrow(/mode/);
    expect(() => assertTrace(trace([{ ...step(1, []), out: 5 }]))).toThrow(/out/);
  });

  it('labels values the way each language writes them', () => {
    expect(valueLabel({ t: 'bool', v: true }, 'python')).toBe('True');
    expect(valueLabel({ t: 'bool', v: true }, 'java')).toBe('true');
    expect(valueLabel({ t: 'list', kind: 'tuple', items: [num(1), num(2)], len: 2 }, 'python')).toBe('(1, 2)');
    expect(valueLabel({ t: 'str', kind: 'char', v: 'a' }, 'c')).toBe("'a'");
    expect(valueLabel({ t: 'map', kind: 'dict', entries: [[{ t: 'str', v: 'k' }, num(1)]], len: 1 })).toBe('{"k": 1}');
  });

  it('says what changed, following shared objects', () => {
    const t = trace([
      step(1, [{ name: 'a', value: list(7, 3, 1) }, { name: 'i', value: num(0) }]),
      step(2, [{ name: 'a', value: list(7, 1, 3) }, { name: 'i', value: num(1) }, { name: 'n', value: num(2) }]),
    ]);
    const { title, details } = describeStep(t, 1);
    expect(title).toBe('Runs line 2');
    expect(details).toEqual(['a: [3, 1] → [1, 3]', 'i: 0 → 1', 'New: n = 2']);
    expect([...changedNames(t, 1)].sort()).toEqual(['1:a', '1:i', '1:n']);
  });

  it('marks calls, errors and output on the timeline', () => {
    const t = trace([step(1, []), { ...step(2, []), event: 'call' }, { ...step(3, []), out: 2 }, { ...step(4, []), event: 'exception', out: 2 }], { stdout: 'hi' });
    expect(timelineMarks(t)).toEqual([null, 'call', 'out', 'error']);
  });

  it('hashes the same program the same way, and different input differently', () => {
    expect(sourceHash('python', 'x=1\r\n')).toBe(sourceHash('python', 'x=1\n'));
    expect(sourceHash('python', 'x=1')).not.toBe(sourceHash('javascript', 'x=1'));
    expect(sourceHash('python', 'x=1', '5')).not.toBe(sourceHash('python', 'x=1', '6'));
    expect(sourceHash('c', 'int main(){}')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('data pictures', () => {
  it('draws an array with the index variables that point into it', () => {
    const s = step(1, [{ name: 'a', value: list(1, 5, 2, 4) }, { name: 'i', value: num(1) }, { name: 'n', value: num(3) }]);
    const [shape] = findShapes(s, null, 'python');
    expect(shape.kind).toBe('array');
    expect(shape.pointers.map((p) => p.name)).toEqual(['i']);
  });

  it('draws a linked list once, with other variables as marks on it', () => {
    const node = (id, v, next) => ({ t: 'obj', cls: 'Node', id, fields: [{ name: 'val', value: num(v) }, { name: 'next', value: next }] });
    const n3 = node(3, 3, { t: 'none', v: 'None' });
    const head = node(1, 1, node(2, 2, n3));
    const s = step(1, [{ name: 'head', value: head }, { name: 'cur', value: { t: 'ref', id: 3 } }]);
    const shapes = findShapes(s, null, 'python');
    expect(shapes).toHaveLength(1);
    expect(shapes[0].chain.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(shapes[0].marks.get(2)).toEqual(['cur']);
  });

  it('draws a grid for a list of lists', () => {
    const grid = { t: 'list', kind: 'list', id: 9, len: 2, items: [list(10, 1, 2), list(11, 3, 4)] };
    const [shape] = findShapes(step(1, [{ name: 'dp', value: grid }, { name: 'i', value: num(1) }, { name: 'j', value: num(0) }]), null, 'python');
    expect(shape.kind).toBe('grid');
    expect(shape.row.name).toBe('i');
    expect(shape.col.name).toBe('j');
  });
});

/* The Python tracer is plain Python; desktop CPython runs it the same way Pyodide does. */
const python = ['python3', 'python'].find((cmd) => spawnSync(cmd, ['--version']).status === 0);

describe.skipIf(!python)('Python tracer (CPython)', () => {
  const tracer = readFileSync(path.resolve(__dirname, '../adapters/pythonTracer.py'), 'utf8');
  const run = (source, maxSteps = 1000, stdin = '') => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tbpy-'));
    const script = path.join(dir, 'run.py');
    writeFileSync(script, `${tracer}\nimport sys, json\nargs = json.loads(sys.stdin.read())\nsys.__stdout__.write(__tb_trace(args['source'], args['maxSteps'], args['stdin']))\n`);
    const out = execFileSync(python, ['-I', script], { input: JSON.stringify({ source, maxSteps, stdin }), encoding: 'utf8' });
    const raw = JSON.parse(out);
    return assertTrace({ version: 1, language: 'python', mode: 'traced', source, maxSteps, notes: [], ...raw });
  };

  it('traces recursion with return values', () => {
    const t = run('def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(4))\n');
    expect(t.stdout).toBe('24\n');
    expect(t.steps.filter((s) => s.event === 'return' && s.frames.at(-1).name === 'fact').map((s) => s.ret.v)).toEqual([1, 2, 6, 24]);
    expect(Math.max(...t.steps.map((s) => s.frames.length))).toBe(5);
  });

  it('reads input lines, reports errors with their line, and stops endless loops', () => {
    expect(run('n = int(input())\nprint(n + 1)\n', 100, '41\n').stdout).toBe('42\n');
    expect(run('xs = []\nprint(xs[3])\n').error).toMatchObject({ kind: 'runtime', line: 2 });
    expect(run('def f(:\n').error.kind).toBe('compile');
    const loop = run('i = 0\nwhile True:\n    i += 1\n', 40);
    expect(loop.truncated).toBe(true);
    expect(loop.steps).toHaveLength(40);
  });

  it('an exception passing through a function is not a "return"', () => {
    const t = run('def bad():\n    raise ValueError("no")\n\ntry:\n    bad()\nexcept ValueError:\n    pass\n');
    expect(t.steps.some((s) => s.event === 'return' && s.frames.at(-1).name === 'bad')).toBe(false);
    expect(t.steps.filter((s) => s.event === 'exception')).toHaveLength(1);
  });
});
