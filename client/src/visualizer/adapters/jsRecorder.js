/**
 * The `__tb` object instrumented JavaScript reports to (see jsInstrument.js).
 * It keeps the call stack, turns live values into trace Values, and stops the
 * program once the step budget is spent.
 */

const MAX_ITEMS = 50;
const MAX_STR = 200;
const MAX_DEPTH = 6;
const MAX_OUT = 100000;

export class StepLimit extends Error {
  constructor() {
    super('Step limit reached');
    this.name = 'StepLimit';
  }
}

export function createRecorder({ maxSteps = 1000 } = {}) {
  const steps = [];
  let out = '';
  let nextFrame = 1;
  let stopped = false;
  let lastExc = undefined;
  const ids = new WeakMap();
  let nextId = 1;
  const global = { id: nextFrame++, name: 'global', line: 1, snap: () => [] };
  const stack = [global];

  const idOf = (o) => {
    if (!ids.has(o)) ids.set(o, nextId++);
    return ids.get(o);
  };

  function encode(v, seen, depth = 0) {
    switch (typeof v) {
      case 'number':
        return { t: 'num', v: Number.isFinite(v) ? v : String(v) };
      case 'bigint':
        return { t: 'num', v: `${v}n` };
      case 'string':
        return v.length > MAX_STR ? { t: 'str', v: v.slice(0, MAX_STR), more: v.length - MAX_STR } : { t: 'str', v };
      case 'boolean':
        return { t: 'bool', v };
      case 'undefined':
        return { t: 'none', v: 'undefined' };
      case 'symbol':
        return { t: 'other', v: v.toString() };
      case 'function':
        return { t: 'fn', v: `${v.name || 'anonymous'}(${v.length ? '…' : ''})` };
      default:
        break;
    }
    if (v === null) return { t: 'none', v: 'null' };
    const id = idOf(v);
    if (seen.has(id)) return { t: 'ref', id };
    if (depth >= MAX_DEPTH) return { t: 'other', v: '…' };
    seen.add(id);

    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      const len = v.length;
      const items = [];
      for (let i = 0; i < Math.min(len, MAX_ITEMS); i++) items.push(i in v ? encode(v[i], seen, depth + 1) : { t: 'other', v: 'empty' });
      return { t: 'list', kind: Array.isArray(v) ? 'array' : v.constructor.name, id, len, items };
    }
    if (v instanceof Set) {
      const all = [...v];
      return { t: 'list', kind: 'Set', id, len: all.length, items: all.slice(0, MAX_ITEMS).map((x) => encode(x, seen, depth + 1)) };
    }
    if (v instanceof Map) {
      const all = [...v];
      return { t: 'map', kind: 'Map', id, len: all.length, entries: all.slice(0, MAX_ITEMS).map(([k, x]) => [encode(k, seen, depth + 1), encode(x, seen, depth + 1)]) };
    }
    if (v instanceof Date) return { t: 'other', v: Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString() };
    if (v instanceof Error) return { t: 'other', v: `${v.name}: ${v.message}` };
    if (v instanceof Promise) return { t: 'other', v: 'Promise' };
    if (v instanceof RegExp) return { t: 'other', v: String(v) };

    // Plain objects and class instances: own data properties only, so no getter ever runs.
    const proto = Object.getPrototypeOf(v);
    const cls = proto === null || proto === Object.prototype ? 'Object' : proto.constructor?.name || 'Object';
    const fields = [];
    const descriptors = Object.getOwnPropertyDescriptors(v);
    for (const key of Object.keys(descriptors).slice(0, MAX_ITEMS)) {
      const d = descriptors[key];
      if (!d.enumerable) continue;
      fields.push({ name: key, value: 'value' in d ? encode(d.value, seen, depth + 1) : { t: 'other', v: 'getter' } });
    }
    return { t: 'obj', cls, id, fields };
  }

  function record(event, line, extra) {
    if (stopped) throw new StepLimit();
    if (steps.length >= maxSteps) {
      stopped = true;
      throw new StepLimit();
    }
    const seen = new Set();
    const frames = stack.map((f) => {
      let pairs = [];
      try {
        pairs = f.snap().filter(Boolean);
      } catch {
        /* a variable we can't read yet */
      }
      return { id: f.id, name: f.name, line: f.line, locals: pairs.map(([name, value]) => ({ name, value: encode(value, seen) })) };
    });
    const step = { line, event, frames, out: out.length };
    if (extra?.ret !== undefined || extra?.hasRet) step.ret = encode(extra.ret, seen);
    if (extra?.exc) step.exc = extra.exc;
    steps.push(step);
  }

  const top = () => stack[stack.length - 1];

  const api = {
    s(line, snap) {
      const f = top();
      f.line = line;
      f.snap = snap;
      record('line', line);
    },
    enter(name, line, snap) {
      const f = { id: nextFrame++, name, line, snap };
      stack.push(f);
      record('call', line);
      return f;
    },
    r(line, snap, value) {
      const f = top();
      f.line = line;
      f.snap = snap;
      record('return', line, { ret: value, hasRet: true });
      f.returned = true;
      return value;
    },
    end(line, snap) {
      const f = top();
      if (f.returned) return;
      f.line = line;
      f.snap = snap;
      record('return', line, { ret: undefined, hasRet: true });
    },
    exc(e) {
      if (e instanceof StepLimit || stopped || e === lastExc) return;
      lastExc = e;
      try {
        record('exception', top().line, { exc: e && e.name ? `${e.name}: ${e.message}` : `Uncaught ${String(e)}` });
      } catch {
        /* out of steps */
      }
    },
    exit(f) {
      const i = stack.lastIndexOf(f);
      if (i > 0) stack.splice(i, 1);
    },
    print(text) {
      if (out.length < MAX_OUT) out += text;
    },
    finish() {
      if (stopped || steps.length >= maxSteps) return;
      stack.length = 1;
      record('return', top().line);
    },
    get truncated() {
      return stopped;
    },
    result() {
      return { steps, stdout: out };
    },
  };
  return api;
}

/** console.log's way of printing one value. */
export function formatForConsole(a) {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'string') return a;
  if (typeof a === 'function') return `[Function: ${a.name || 'anonymous'}]`;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (a instanceof Map) return `Map(${a.size}) ${JSON.stringify(Object.fromEntries(a))}`;
  if (a instanceof Set) return `Set(${a.size}) ${JSON.stringify([...a])}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}
