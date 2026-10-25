// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { instrumentJavaScript } from '../adapters/jsInstrument';
import { runInstrumented } from '../adapters/jsRecorder';
import { buildCallTree, variableHistory, nextHint, blockOf, memoryView, nextStepOnLine, stackIds } from '../analysis';
import { valueLabel } from '../traceModel';

async function js(source) {
  const r = await runInstrumented(instrumentJavaScript(source).code, { patchPromises: false });
  return { version: 1, language: 'javascript', mode: 'instrumented', source, steps: r.steps, stdout: r.stdout, error: r.error, truncated: r.truncated, maxSteps: 1000, notes: [] };
}

describe('call tree', () => {
  it('shows recursion as nested calls with what each returned', async () => {
    const t = await js('function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\nconst x = fib(3);\n');
    const { root } = buildCallTree(t);
    const show = (n) => `${n.name}(${n.args.map((a) => valueLabel(a.value, 'javascript')).join(',')})=${n.ret ? valueLabel(n.ret, 'javascript') : '-'}[${n.children.map(show).join(' ')}]`;
    expect(show(root)).toBe('global()=-[fib(3)=2[fib(2)=1[fib(1)=1[] fib(0)=0[]] fib(1)=1[]]]');
    const deepest = [...buildCallTree(t).nodes.values()].find((n) => n.depth === 3);
    expect(deepest.name).toBe('fib');
    expect(t.steps[deepest.callStep].frames.map((f) => f.id)).toEqual(stackIds(t.steps[deepest.callStep]));
  });

  it('shows an argument shared with the caller as its value, not as a back-reference', async () => {
    const t = await js('function first(xs) {\n  return xs[0];\n}\nconst nums = [7, 8];\nfirst(nums);\n');
    const call = [...buildCallTree(t).nodes.values()].find((n) => n.name === 'first');
    expect(valueLabel(call.args[0].value, 'javascript')).toBe('[7, 8]');
  });

  it('marks a call that ended in an error', async () => {
    const t = await js('function bad() {\n  null.x;\n}\ntry { bad(); } catch (e) {}\n');
    const bad = [...buildCallTree(t).nodes.values()].find((n) => n.name === 'bad');
    expect(bad.threw).toMatch(/TypeError/);
    expect(bad.ret).toBeUndefined();
  });
});

describe('variable history', () => {
  it('lists each value a variable held and the step it changed at', async () => {
    const t = await js('let total = 0;\nfor (let i = 1; i <= 3; i++) {\n  total += i;\n}\n');
    const global = t.steps[0].frames[0].id;
    const h = variableHistory(t, global, 'total');
    expect(h.map((e) => e.value.v)).toEqual([0, 1, 3, 6]);
    expect(h.every((e, k) => k === 0 || e.step > h[k - 1].step)).toBe(true);
  });
});

describe('what happens next', () => {
  it('reads an if from where the next step lands', async () => {
    const t = await js('let x = 5;\nif (x > 10) {\n  x = 0;\n}\nif (x > 1) {\n  x = 1;\n}\n');
    const at = (line) => t.steps.findIndex((s) => s.line === line);
    expect(nextHint(t, at(2))).toMatchObject({ branch: 'out', text: 'The condition is false, so it skips the block: line 5' });
    expect(nextHint(t, at(5))).toMatchObject({ branch: 'in', text: 'The condition is true, so it goes into the block: line 6' });
  });

  it('reads a loop: body again, then done', async () => {
    const t = await js('let s = 0;\nfor (let i = 0; i < 2; i++) {\n  s += i;\n}\nconsole.log(s);\n');
    const loopSteps = t.steps.map((s, i) => [s, i]).filter(([s]) => s.line === 2).map(([, i]) => i);
    expect(nextHint(t, loopSteps[0]).branch).toBe('in');
    expect(nextHint(t, loopSteps[loopSteps.length - 1])).toMatchObject({ branch: 'out', text: 'The loop is done: it carries on at line 5' });
  });

  it('says when the next step is a call, a return or the end', async () => {
    const t = await js('function sq(n) {\n  return n * n;\n}\nconst y = sq(4);\n');
    const before = t.steps.findIndex((s) => s.event === 'call') - 1;
    expect(nextHint(t, before).text).toBe('Next, it calls sq()');
    const ret = t.steps.findIndex((s) => s.event === 'return' && s.frames.length > 1);
    expect(nextHint(t, ret - 1).text).toBe('Next, sq() returns');
    expect(nextHint(t, t.steps.length - 2).text).toBe('Next, the program finishes');
    expect(nextHint(t, t.steps.length - 1)).toBeNull();
  });

  it('finds the block a statement controls in C-like code and Python', () => {
    const c = ['if (a) {', '  x();', '} else if (b) {', '  y();', '}', 'while (k)', '  k--;', 'if (z) { w(); }'];
    expect(blockOf(c, 1, 'c')).toEqual([2, 2]);
    expect(blockOf(c, 3, 'c')).toEqual([4, 4]);
    expect(blockOf(c, 6, 'c')).toEqual([7, 7]);
    expect(blockOf(c, 8, 'c')).toBeNull();
    const py = ['for i in range(3):', '    a = i', '', '    b = a', 'print(b)', 'if x: y()'];
    expect(blockOf(py, 1, 'python')).toEqual([2, 4]);
    expect(blockOf(py, 6, 'python')).toBeNull();
  });
});

describe('memory', () => {
  it('shows one object held by two variables', async () => {
    const t = await js('const a = [1, 2];\nconst b = a;\nb.push(3);\n');
    const m = memoryView(t.steps[t.steps.length - 1], 'javascript');
    expect(m.objects).toHaveLength(1);
    expect(m.objects[0].heldBy).toEqual(['a', 'b']);
    expect(m.frames[0].vars.map((v) => v.target)).toEqual([m.objects[0].id, m.objects[0].id]);
  });

  it('shows a C pointer it could not follow as its address', () => {
    const step = { line: 1, event: 'line', out: 0, frames: [{ id: 1, name: 'main', line: 1, locals: [{ name: 'p', value: { t: 'ptr', v: '0x10' } }, { name: 'n', value: { t: 'num', v: 3 } }] }] };
    const m = memoryView(step, 'c');
    expect(m.addresses).toEqual([{ name: 'p', address: '0x10' }]);
    expect(m.frames[0].vars.find((v) => v.name === 'n').label).toBe('3');
  });
});

describe('lines', () => {
  it('jumps to the next step that runs a line, wrapping round', async () => {
    const t = await js('let i = 0;\nwhile (i < 3) {\n  i++;\n}\n');
    const runs = t.steps.map((s, k) => (s.line === 3 ? k : -1)).filter((k) => k >= 0);
    expect(nextStepOnLine(t, 3, runs[0])).toBe(runs[1]);
    expect(nextStepOnLine(t, 3, runs[runs.length - 1])).toBe(runs[0]);
    expect(nextStepOnLine(t, 4, 0)).toBe(-1);
  });
});
