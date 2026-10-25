/**
 * The `__tb` object instrumented JavaScript reports to (see jsInstrument.js).
 * It keeps the call stack, turns live values into trace Values, and stops the
 * program once the step budget is spent. `runInstrumented` runs a whole
 * instrumented program on an observed event loop (see the bottom of the file).
 *
 * Self-contained on purpose — no imports: the sandbox worker is built from this
 * file's text (visualizer/sandbox), and the tests import it directly.
 */

const MAX_ITEMS = 50;
const MAX_STR = 200;
const MAX_DEPTH = 6;
const MAX_OUT = 100000;
const MAX_QUEUE_SHOWN = 12;

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
  const suspended = []; // async functions paused at an await (off the call stack until they resume)
  let loopInfo = null;  // () => what the event loop holds right now (attached by runInstrumented)

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
    if (loopInfo) {
      const loop = loopInfo();
      if (loop) step.loop = loop;
    }
    steps.push(step);
  }

  const top = () => stack[stack.length - 1];
  // A paused async function that is running again (or failing) goes back on top of the stack.
  const unsuspend = (f) => {
    const i = suspended.indexOf(f);
    if (i < 0) return false;
    suspended.splice(i, 1);
    if (f !== global && !stack.includes(f)) stack.push(f);
    return true;
  };

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
    exc(e, f) {
      if (f) unsuspend(f); // an awaited promise rejected: the function is running again, to fail
      if (e instanceof StepLimit || stopped || e === lastExc) return;
      lastExc = e;
      try {
        record('exception', top().line, { exc: e && e.name ? `${e.name}: ${e.message}` : `Uncaught ${String(e)}` });
      } catch {
        /* out of steps */
      }
    },
    exit(f) {
      const s = suspended.indexOf(f);
      if (s >= 0) suspended.splice(s, 1);
      const i = stack.lastIndexOf(f);
      if (i > 0) stack.splice(i, 1);
    },
    // `await x` becomes `__tb.back(__f, await __tb.away(__f, line, x))`.
    away(f, line, value) {
      const fr = f || global;
      fr.line = line;
      record('await', line);
      if (fr !== global) {
        const i = stack.lastIndexOf(fr);
        if (i > 0) stack.splice(i, 1);
      }
      if (!suspended.includes(fr)) suspended.push(fr);
      return value;
    },
    back(f, value) {
      const fr = f || global;
      if (unsuspend(fr)) record('resume', fr.line);
      return value;
    },
    attachLoop(fn) {
      loopInfo = fn;
    },
    suspendedNames() {
      return suspended.map((f) => ({ name: f === global ? 'main program' : f.name, line: f.line }));
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

/** Code that schedules work, so its steps should carry the event loop's state. */
export const LOOP_WORDS = /\b(setTimeout|setInterval|queueMicrotask|Promise|async|await|then)\b/;

/**
 * Run an instrumented program (jsInstrument.js) on an event loop TutorBoard can
 * see, and return its trace: { steps, stdout, truncated, error, usesLoop, notes }.
 * Never throws for problems in the program.
 *
 *   timers (setTimeout / setInterval) — queued in a list this function owns and run
 *     in the order the real event loop runs them (by due time, then by when they
 *     were set), on a virtual clock: a 1-second timer doesn't make you wait a second
 *   queueMicrotask                    — noted when queued and when it runs
 *   promise callbacks (.then/.catch/.finally) — noted when registered and when they run;
 *     JavaScript doesn't reveal the moment a callback moves into the microtask queue,
 *     so until it runs it is listed as "waiting", never guessed as "queued"
 *   await                             — the function leaves the call stack until it resumes
 *
 * `patchPromises` swaps Promise.prototype.then for the run (only safe where nothing
 * else is running — the sandbox worker; the tests turn it off).
 */
export async function runInstrumented(code, { maxSteps = 1000, patchPromises = true, maxTimerRuns = 200 } = {}) {
  const tb = createRecorder({ maxSteps });
  const print = (...args) => tb.print(`${args.map(formatForConsole).join(' ')}\n`);
  const console = { log: print, info: print, warn: print, error: print, debug: print, table: print };
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeQueueMicrotask = globalThis.queueMicrotask.bind(globalThis);
  const nativeThen = Promise.prototype.then;
  // One turn of the real event loop: every queued microtask has run by the time it ends.
  // A MessageChannel message is a task without setTimeout's 4 ms clamp.
  const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  const macrotaskBoundary = channel
    ? () => new Promise((resolve) => {
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(0);
    })
    : () => new Promise((resolve) => nativeSetTimeout(resolve, 0));

  const watch = LOOP_WORDS.test(code);
  const notes = [];
  let now = 0; // virtual milliseconds
  let seq = 0;
  let nextId = 1;
  let timerRuns = 0;
  const timers = []; // { id, fn, args, due, every, seq, label }
  const micro = []; // queueMicrotask callbacks queued, not yet run
  const waiting = []; // promise callbacks registered, not yet run
  let phase = { kind: 'script', label: 'main program' };
  let uncaught = null;
  const fail = (e) => {
    if (!uncaught && !(e instanceof StepLimit)) uncaught = e;
  };

  const labelOf = (fn, kind) => `${kind} → ${fn && fn.name ? fn.name : 'callback'}`;
  const inPhase = (p, fn, self, args) => {
    const prev = phase;
    phase = p;
    try {
      return fn.apply(self, args);
    } finally {
      phase = prev;
    }
  };
  const byDue = (a, b) => a.due - b.due || a.seq - b.seq;

  const setTimeoutT = (fn, ms = 0, ...args) => {
    if (typeof fn !== 'function') return 0;
    const id = nextId++;
    timers.push({ id, fn, args, due: now + Math.max(0, Number(ms) || 0), every: 0, seq: seq++, label: labelOf(fn, 'setTimeout') });
    return id;
  };
  const setIntervalT = (fn, ms = 0, ...args) => {
    const id = setTimeoutT(fn, ms, ...args);
    const t = timers.find((x) => x.id === id);
    if (t) {
      t.every = Math.max(1, Number(ms) || 0);
      t.label = labelOf(fn, 'setInterval');
    }
    return id;
  };
  const clearTimer = (id) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };
  const queueMicrotaskT = (fn) => {
    if (typeof fn !== 'function') return;
    const entry = { id: nextId++, label: labelOf(fn, 'queueMicrotask') };
    micro.push(entry);
    nativeQueueMicrotask(() => {
      const i = micro.indexOf(entry);
      if (i >= 0) micro.splice(i, 1);
      try {
        inPhase({ kind: 'micro', label: entry.label }, fn, undefined, []);
      } catch (e) {
        fail(e);
      }
    });
  };
  const reaction = (fn, kind) => {
    if (typeof fn !== 'function') return fn;
    const entry = { id: nextId++, label: labelOf(fn, kind) };
    waiting.push(entry);
    return function promiseReaction(...args) {
      const i = waiting.indexOf(entry);
      if (i >= 0) waiting.splice(i, 1);
      return inPhase({ kind: 'micro', label: entry.label }, fn, this, args);
    };
  };

  if (watch) {
    tb.attachLoop(() => ({
      phase: phase.kind,
      task: phase.label,
      now,
      timers: timers.slice().sort(byDue).slice(0, MAX_QUEUE_SHOWN).map((t) => ({ id: t.id, label: t.label, due: t.due })),
      micro: micro.slice(0, MAX_QUEUE_SHOWN).map((m) => m.label),
      waiting: waiting.slice(0, MAX_QUEUE_SHOWN).map((w) => w.label),
      awaiting: tb.suspendedNames().slice(0, MAX_QUEUE_SHOWN),
    }));
  }

  let settled = false;
  if (patchPromises) {
    Promise.prototype.then = function then(onFulfilled, onRejected) {
      return nativeThen.call(this, reaction(onFulfilled, 'then'), reaction(onRejected, 'catch'));
    };
  }
  // A rejected promise nobody handled is an uncaught error, as in the browser console.
  const onUnhandled = (e) => {
    e.preventDefault?.();
    fail(e.reason);
  };
  const listens = typeof globalThis.addEventListener === 'function' && typeof globalThis.document === 'undefined';
  if (listens) globalThis.addEventListener('unhandledrejection', onUnhandled);
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const program = new AsyncFunction('__tb', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask', code);
    const done = program(tb, console, setTimeoutT, setIntervalT, clearTimer, clearTimer, queueMicrotaskT);
    phase = { kind: 'idle', label: '' }; // the synchronous part of the program is over
    nativeThen.call(done, () => { settled = true; }, (e) => { settled = true; fail(e); });
    // The event loop: let every queued microtask run, then the next timer; until nothing is left.
    for (;;) {
      await macrotaskBoundary();
      if (uncaught || tb.truncated) break;
      timers.sort(byDue);
      const t = timers.shift();
      if (!t) break;
      if (++timerRuns > maxTimerRuns) {
        notes.push(`Timers were stopped after ${maxTimerRuns} runs.`);
        break;
      }
      now = Math.max(now, t.due);
      if (t.every) timers.push({ ...t, due: now + t.every, seq: seq++ });
      try {
        inPhase({ kind: 'macro', label: t.label }, t.fn, undefined, t.args);
      } catch (e) {
        fail(e);
      }
    }
    if (!settled && !uncaught && !tb.truncated) notes.push('When everything else had run, the program was still waiting on a promise that never settled.');
  } catch (e) {
    fail(e);
  } finally {
    if (patchPromises) Promise.prototype.then = nativeThen;
    if (listens) globalThis.removeEventListener('unhandledrejection', onUnhandled);
    channel?.port1.close();
  }

  let error = null;
  if (uncaught) {
    const steps = tb.result().steps;
    const last = steps[steps.length - 1];
    error = {
      kind: 'runtime',
      message: uncaught && uncaught.name ? `${uncaught.name}: ${uncaught.message}` : `Uncaught ${String(uncaught)}`,
      line: last ? last.line : 1,
    };
  } else {
    try {
      phase = { kind: 'idle', label: '' };
      tb.finish();
    } catch {
      /* step limit */
    }
  }
  if (watch) notes.unshift('Timers run in the order the event loop runs them, on a simulated clock — a delay doesn\'t make you wait.');
  const { steps, stdout } = tb.result();
  return {
    steps,
    stdout,
    truncated: tb.truncated,
    usesLoop: watch,
    notes,
    error: error || (tb.truncated ? { kind: 'limit', message: `Stopped after ${maxSteps} steps.` } : null),
  };
}
