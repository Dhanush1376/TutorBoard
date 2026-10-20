/**
 * TutorBoard execution trace — the one format every language adapter produces
 * and the player consumes. The same shape is produced by the server for C, C++
 * and Java (server/visualizer/parseTrace.ts), so keep the two in step.
 *
 * Trace {
 *   version: 1,
 *   language: 'python' | 'javascript' | 'java' | 'cpp' | 'c',
 *   mode: 'traced'        — the language's own debugger hook watched the program (Python sys.settrace)
 *       | 'instrumented'  — the source was rewritten to report each step, then really run
 *       | 'simulated',    — never produced by the runners; reserved for hand-made examples
 *   source: string,
 *   steps: Step[],
 *   stdout: string,       — everything the program printed
 *   error: null | { kind: 'compile' | 'runtime' | 'timeout' | 'limit' | 'setup', message, line? },
 *   truncated: boolean,   — the step limit was reached before the program finished
 *   maxSteps: number,
 *   notes: string[],      — honest caveats about what the trace can and can't show
 * }
 *
 * Step {
 *   line: number,                    — 1-based line in `source` that is about to run
 *   event: 'line' | 'call' | 'return' | 'exception',
 *   frames: Frame[],                 — outermost first; the last one is running
 *   out: number,                     — how many characters of stdout were printed by now
 *   ret?: Value,                     — on 'return': the value handed back
 *   exc?: string,                    — on 'exception': what went wrong
 * }
 *
 * Frame { id: number, name: string, line: number, locals: Array<{ name, value: Value }> }
 *
 * Value
 *   { t: 'num', v: number | string }   (string for values JSON can't hold: big ints, NaN, Infinity)
 *   { t: 'str', v: string, more?: n }  (more = characters cut off)
 *   { t: 'bool', v: boolean }
 *   { t: 'none', v: 'None' | 'null' | 'undefined' | 'nullptr' }
 *   { t: 'list', kind, items: Value[], len, id? }       list, tuple, array, vector, set, ArrayList…
 *   { t: 'map',  kind, entries: [Value, Value][], len, id? }
 *   { t: 'obj',  cls, fields: Array<{ name, value }>, id? }
 *   { t: 'ref',  id }                   (an object already shown elsewhere in this step)
 *   { t: 'ptr',  v: '0x…', to?: Value } (C/C++ pointers; `to` when the pointee is a known struct)
 *   { t: 'fn',   v: string }
 *   { t: 'other', v: string }
 */

export const TRACE_VERSION = 1;
export const TRACE_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c'];

export const MODE_LABEL = {
  traced: 'Real run · traced line by line',
  instrumented: 'Real run · step markers added to your code',
  simulated: 'Simulation · not a real run',
};

/* ── Validation ─────────────────────────────────────────────────────────── */

/** Throws with a plain reason when `t` is not a usable trace. */
export function assertTrace(t) {
  const fail = (why) => {
    throw new Error(`Bad trace: ${why}`);
  };
  if (!t || typeof t !== 'object') fail('not an object');
  if (t.version !== TRACE_VERSION) fail(`version ${t.version}`);
  if (!TRACE_LANGUAGES.includes(t.language)) fail(`language ${t.language}`);
  if (!['traced', 'instrumented', 'simulated'].includes(t.mode)) fail(`mode ${t.mode}`);
  if (typeof t.source !== 'string') fail('no source');
  if (!Array.isArray(t.steps)) fail('no steps');
  const lines = t.source.split('\n').length;
  t.steps.forEach((s, i) => {
    if (!Number.isInteger(s.line) || s.line < 1 || s.line > lines) fail(`step ${i} line ${s.line}`);
    if (!['line', 'call', 'return', 'exception'].includes(s.event)) fail(`step ${i} event ${s.event}`);
    if (!Array.isArray(s.frames) || !s.frames.length) fail(`step ${i} has no frames`);
    if (!Number.isInteger(s.out) || s.out < 0 || s.out > (t.stdout || '').length) fail(`step ${i} out ${s.out}`);
  });
  return t;
}

/* ── Values ─────────────────────────────────────────────────────────────── */

const STR_SHOW = 60;

/** One-line text for a value, the way the learner would write it. */
export function valueLabel(v, lang, depth = 0) {
  if (!v) return '?';
  switch (v.t) {
    case 'num':
      return String(v.v);
    case 'bool':
      return lang === 'python' ? (v.v ? 'True' : 'False') : String(v.v);
    case 'none':
      return v.v;
    case 'str': {
      const s = v.v.length > STR_SHOW ? `${v.v.slice(0, STR_SHOW)}…` : v.v;
      return v.kind === 'char' ? `'${s}'` : JSON.stringify(s) + (v.more ? '…' : '');
    }
    case 'list': {
      if (depth > 1) return `${v.kind}(${v.len})`;
      const [open, close] = v.kind === 'tuple' ? ['(', ')'] : /set/i.test(v.kind) ? ['{', '}'] : ['[', ']'];
      const shown = v.items.slice(0, 8).map((x) => valueLabel(x, lang, depth + 1));
      return `${open}${shown.join(', ')}${v.len > shown.length ? ', …' : ''}${close}`;
    }
    case 'map': {
      if (depth > 1) return `${v.kind}(${v.len})`;
      const shown = v.entries.slice(0, 5).map(([k, x]) => `${valueLabel(k, lang, depth + 1)}: ${valueLabel(x, lang, depth + 1)}`);
      return `{${shown.join(', ')}${v.len > shown.length ? ', …' : ''}}`;
    }
    case 'obj':
      return depth > 1 ? v.cls : `${v.cls}(${v.fields.slice(0, 3).map((f) => `${f.name}=${valueLabel(f.value, lang, depth + 1)}`).join(', ')}${v.fields.length > 3 ? ', …' : ''})`;
    case 'ref':
      return '↺ same object';
    case 'ptr':
      return v.to ? `→ ${valueLabel(v.to, lang, depth + 1)}` : v.v;
    case 'fn':
      return v.v;
    default:
      return String(v.v ?? '?');
  }
}

/** Whether two values look the same to a learner (used to mark what changed). */
export function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(stripIds(a)) === JSON.stringify(stripIds(b));
}

function stripIds(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(stripIds);
  const o = {};
  for (const k of Object.keys(v)) if (k !== 'id') o[k] = stripIds(v[k]);
  return o;
}

/** id → value for every list/map/obj in a step, so `ref`s can be followed. */
export function indexStep(step) {
  const byId = new Map();
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (v.id != null && v.t !== 'ref' && !byId.has(v.id)) byId.set(v.id, v);
    if (v.t === 'list') v.items.forEach(walk);
    else if (v.t === 'map') v.entries.forEach(([k, x]) => (walk(k), walk(x)));
    else if (v.t === 'obj') v.fields.forEach((f) => walk(f.value));
    else if (v.t === 'ptr' && v.to) walk(v.to);
  };
  step?.frames.forEach((f) => f.locals.forEach((l) => walk(l.value)));
  if (step?.ret) walk(step.ret);
  return byId;
}

export const resolve = (v, byId) => (v?.t === 'ref' ? byId.get(v.id) || v : v?.t === 'ptr' && v.to ? resolve(v.to, byId) : v);

/* ── What happened in a step, in plain words ────────────────────────────── */

/**
 * Compare a step with the one before it and say what changed. Built only from
 * the trace itself, so it never claims more than the run showed.
 */
export function describeStep(trace, index) {
  const step = trace.steps[index];
  if (!step) return { title: '', details: [] };
  const prev = index > 0 ? trace.steps[index - 1] : null;
  const lang = trace.language;
  const top = step.frames[step.frames.length - 1];
  const fnName = (f) => (f.name === '<module>' || f.name === 'global' ? 'the program' : `${f.name}()`);
  const details = [];
  // Functions and classes are definitions, not data; leave them out of the story.
  const isData = (v) => v && v.t !== 'fn' && !(v.t === 'other' && /^(class|module) /.test(v.v));

  let title;
  if (step.event === 'call') title = `Calls ${fnName(top)}`;
  else if (step.event === 'return' && step.frames.length === 1) title = 'Program finished';
  else if (step.event === 'return') title = `${fnName(top)} returns${step.ret ? ` ${valueLabel(step.ret, lang)}` : ''}`;
  else if (step.event === 'exception') title = `Error: ${step.exc || 'something went wrong'}`;
  else title = `Runs line ${step.line}`;

  if (prev) {
    const prevTop = prev.frames[prev.frames.length - 1];
    if (step.frames.length < prev.frames.length && step.event !== 'return') {
      details.push(`Back in ${fnName(top)}`);
    }
    // Changes are read in the same frame (by id), so a new call doesn't look like "everything changed".
    const before = prev.frames.find((f) => f.id === top.id);
    if (before) {
      const nowIds = indexStep(step);
      const prevIds = indexStep(prev);
      const old = new Map(before.locals.map((l) => [l.name, resolve(l.value, prevIds)]));
      for (const { name, value: raw } of top.locals) {
        const value = resolve(raw, nowIds);
        if (!isData(value)) continue;
        if (!old.has(name)) details.push(`New: ${name} = ${valueLabel(value, lang)}`);
        else if (!sameValue(old.get(name), value)) details.push(`${name}: ${valueLabel(old.get(name), lang)} → ${valueLabel(value, lang)}`);
      }
    } else if (prevTop && step.event === 'call' && top.locals.some((l) => isData(l.value))) {
      details.push(`With ${top.locals.filter((l) => isData(l.value)).map((l) => `${l.name} = ${valueLabel(l.value, lang)}`).join(', ')}`);
    }
    const printed = trace.stdout.slice(prev.out, step.out);
    if (printed.trim()) details.push(`Printed: ${printed.trim().split('\n').slice(-2).join(' / ')}`);
  } else if (top.locals.some((l) => isData(l.value))) {
    details.push(`Starting with ${top.locals.filter((l) => isData(l.value)).map((l) => `${l.name} = ${valueLabel(l.value, lang)}`).join(', ')}`);
  }
  return { title, details: details.slice(0, 6) };
}

/** Names whose value differs from the previous step in the same frame. */
export function changedNames(trace, index) {
  const step = trace.steps[index];
  const prev = trace.steps[index - 1];
  const out = new Set();
  if (!step || !prev) return out;
  const nowIds = indexStep(step);
  const prevIds = indexStep(prev);
  for (const f of step.frames) {
    const before = prev.frames.find((p) => p.id === f.id);
    if (!before) continue;
    const old = new Map(before.locals.map((l) => [l.name, resolve(l.value, prevIds)]));
    for (const l of f.locals) if (!old.has(l.name) || !sameValue(old.get(l.name), resolve(l.value, nowIds))) out.add(`${f.id}:${l.name}`);
  }
  return out;
}

/** Steps worth a mark on the timeline: calls, returns, errors and output. */
export function timelineMarks(trace) {
  return trace.steps.map((s, i) => {
    if (s.event === 'exception') return 'error';
    if (s.event === 'call') return 'call';
    if (s.event === 'return') return 'return';
    if (i > 0 && s.out > trace.steps[i - 1].out) return 'out';
    return null;
  });
}

/* ── Identity, for saving without duplicates ────────────────────────────── */

/** Stable hash of language + source (FNV-1a, 52-bit safe), used to find a saved trace again. */
export function sourceHash(language, source, stdin = '') {
  const text = `${language}\u0000${source.replace(/\r\n/g, '\n')}\u0000${stdin}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
