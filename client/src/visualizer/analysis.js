import { indexStep, resolve, sameValue, valueLabel } from './traceModel';

/**
 * Views over a whole trace, computed from the recorded steps only (no guessing):
 *   buildCallTree     — every call the program made, who called it, what it returned
 *   variableHistory   — each value one variable held, and the step it changed at
 *   nextHint          — what the next step does ("the condition was false, so it skips the block")
 *   memoryView        — which variables hold which objects, and what points at what
 *   stepsOnLine       — the steps that ran a source line (clicking a line jumps there)
 * Shared by every language: they read the trace format in traceModel.js.
 */

const MAX_CALLS = 400;

const isData = (v) => v && v.t !== 'fn' && !(v.t === 'other' && /^(class|module) /.test(v.v));

/* ── Calls ──────────────────────────────────────────────────────────────── */

/**
 * The tree of calls. A frame keeps its id for as long as it lives (and across an
 * `await` in JavaScript), so a call is a frame id: it starts at the first step its
 * frame is on the stack, its parent is the frame just below it, and it ends at the
 * last step it is seen. Returns { root, nodes: Map<id, node>, truncated }.
 *   node { id, name, parentId, depth, args: [{name, value}], callStep, endStep, ret?, threw?, children: node[] }
 */
export function buildCallTree(trace) {
  const nodes = new Map();
  let root = null;
  let truncated = false;
  trace.steps.forEach((step, i) => {
    step.frames.forEach((f, k) => {
      let node = nodes.get(f.id);
      if (!node) {
        if (nodes.size >= MAX_CALLS) {
          truncated = true;
          return;
        }
        const parent = k > 0 ? nodes.get(step.frames[k - 1].id) : null;
        const byId = indexStep(step); // an object shared with the caller is written out once per step
        node = {
          id: f.id,
          name: f.name,
          parentId: parent ? parent.id : null,
          depth: parent ? parent.depth + 1 : 0,
          // what the call started with: its parameters (and anything already set) at its first step
          args: f.locals.filter((l) => isData(l.value)).map((l) => ({ name: l.name, value: resolve(l.value, byId) })),
          callStep: i,
          endStep: i,
          children: [],
        };
        nodes.set(f.id, node);
        if (parent) parent.children.push(node);
        else if (!root) root = node;
      }
      node.endStep = i;
    });
    const top = step.frames[step.frames.length - 1];
    const node = nodes.get(top.id);
    if (!node) return;
    if (step.event === 'return' && step.ret !== undefined) node.ret = step.ret;
    if (step.event === 'exception') node.threw = step.exc || 'error';
    if (step.event === 'return') node.threw = undefined;
  });
  return { root, nodes, truncated };
}

/** Ids of the calls on the stack at a step, outermost first; the last one is running. */
export const stackIds = (step) => (step ? step.frames.map((f) => f.id) : []);

/* ── One variable over time ─────────────────────────────────────────────── */

/**
 * Every value `name` held in the frame `frameId`, one entry per change:
 * [{ step, value }] (the first entry is when it appeared).
 */
export function variableHistory(trace, frameId, name) {
  const out = [];
  let last;
  trace.steps.forEach((step, i) => {
    const f = step.frames.find((x) => x.id === frameId);
    const l = f?.locals.find((x) => x.name === name);
    if (!l) return;
    const v = resolve(l.value, indexStep(step));
    if (!out.length || !sameValue(last, v)) out.push({ step: i, value: v });
    last = v;
  });
  return out;
}

/* ── What happens next ──────────────────────────────────────────────────── */

const CONDITION = /^\s*(?:\}\s*)?(if|elif|else\s+if|while|for)\b/;
const indentOf = (line) => line.match(/^\s*/)[0].replace(/\t/g, '    ').length;

/**
 * The lines a block statement controls, by its layout: braces in C-like code,
 * indentation in Python. Returns [first, last] (1-based) or null when the body
 * shares the statement's line.
 */
export function blockOf(lines, lineNo, language) {
  const i = lineNo - 1;
  const text = lines[i] || '';
  if (language === 'python') {
    if (!/:\s*(#.*)?$/.test(text)) return null; // `if x: y` on one line
    const base = indentOf(text);
    let last = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (indentOf(lines[j]) <= base) break;
      last = j;
    }
    return last > i ? [i + 2, last + 1] : null;
  }
  // C, C++, Java, JavaScript: the block opened on this line (or the next) by `{`
  const opensHere = text.lastIndexOf('{') > text.search(CONDITION);
  const start = opensHere ? i : /^\s*\{/.test(lines[i + 1] || '') ? i + 1 : -1;
  if (start < 0) {
    // a single statement on the next line: `if (x)\n  y();`
    return /\)\s*$/.test(text) && lines[i + 1]?.trim() ? [i + 2, i + 2] : null;
  }
  let depth = 0;
  for (let j = start; j < lines.length; j++) {
    // strings and comments can't open or close a block; nor can the `}` of `} else if (…) {`
    let text = lines[j].replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/g, '');
    if (j === i) text = text.replace(/^\s*\}/, '');
    for (let k = 0; k < text.length; k++) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}' && --depth === 0) {
        if (j === start) return null; // `if (x) { y(); }` on one line
        // the block ends on the line before its `}` — unless code shares the closing line
        return [start + 2, text.slice(0, k).trim() ? j + 1 : j];
      }
    }
  }
  return null;
}

/**
 * What the next step does, in words, from the two steps themselves — and, for an
 * `if` / loop line, which way it went (read from where the next step lands relative
 * to the block the statement controls). Returns { text, branch?: 'in' | 'out' } or null.
 */
export function nextHint(trace, index) {
  const step = trace.steps[index];
  const next = trace.steps[index + 1];
  if (!step || !next) return null;
  const nextTop = next.frames[next.frames.length - 1];
  const fn = (f) => (f.name === 'global' || f.name === '<module>' ? 'the program' : `${f.name}()`);
  if (next.event === 'call') return { text: `Next, it calls ${fn(nextTop)}` };
  if (next.event === 'exception') return { text: 'Next, an error is raised' };
  if (next.event === 'await') return { text: `Next, ${fn(nextTop)} pauses at an await` };
  if (next.event === 'return' && next.frames.length === 1 && index + 1 === trace.steps.length - 1) return { text: 'Next, the program finishes' };
  if (next.event === 'return') return { text: `Next, ${fn(nextTop)} returns` };

  const top = step.frames[step.frames.length - 1];
  const sameFrame = nextTop.id === top.id;
  const lines = trace.source.split('\n');
  const m = (lines[step.line - 1] || '').match(CONDITION);
  if (sameFrame && m && step.event !== 'return') {
    const block = blockOf(lines, step.line, trace.language);
    if (block) {
      const inside = next.line >= block[0] && next.line <= block[1];
      const loop = m[1] === 'while' || m[1] === 'for';
      if (inside) return { text: loop ? `The loop runs its body: next is line ${next.line}` : `The condition is true, so it goes into the block: line ${next.line}`, branch: 'in' };
      if (next.line > block[1] || next.line < step.line) {
        return { text: loop ? `The loop is done: it carries on at line ${next.line}` : `The condition is false, so it skips the block: line ${next.line}`, branch: 'out' };
      }
    }
  }
  return { text: `Next, line ${next.line} runs` };
}

/* ── Memory: variables and the objects they hold ────────────────────────── */

/**
 * The step's variables and the objects they point at, so shared objects and
 * pointers are visible. Returns
 *   { frames: [{ id, name, vars: [{ name, label, target? }] }],
 *     objects: [{ id, kind, label, heldBy: string[] }], addresses: [{ name, address }] }
 * `target` is an object id; C/C++ pointers to memory the trace couldn't read show
 * only their address.
 */
export function memoryView(step, language) {
  if (!step) return { frames: [], objects: [], addresses: [] };
  const byId = indexStep(step);
  const objects = new Map();
  const heldBy = new Map();
  const addresses = [];
  const note = (id, who) => heldBy.set(id, [...(heldBy.get(id) || []), who]);
  const visit = (v, depth = 0) => {
    const r = resolve(v, byId);
    if (!r || r.id == null || !['list', 'map', 'obj'].includes(r.t) || objects.has(r.id)) return;
    objects.set(r.id, r);
    if (depth > 3) return;
    if (r.t === 'obj') {
      for (const f of r.fields) {
        const target = targetOf(f.value);
        if (target != null) note(target, `${r.cls}.${f.name}`);
        visit(f.value, depth + 1);
      }
    } else if (r.t === 'list') r.items.forEach((x) => {
      if (targetOf(x) != null) note(targetOf(x), `${r.kind}[…]`);
      visit(x, depth + 1);
    });
  };
  const targetOf = (v) => {
    if (!v) return null;
    if (v.t === 'ref') return v.id;
    if (v.t === 'ptr') return v.to?.id ?? (v.to?.t === 'ref' ? v.to.id : null);
    return ['list', 'map', 'obj'].includes(v.t) && v.id != null ? v.id : null;
  };
  const frames = step.frames.slice().reverse().map((f) => ({
    id: f.id,
    name: f.name,
    vars: f.locals.filter((l) => isData(l.value)).map((l) => {
      const target = targetOf(l.value);
      if (target != null) {
        note(target, `${l.name}${step.frames.length > 1 ? ` (${f.name})` : ''}`);
        visit(l.value);
      } else if (l.value?.t === 'ptr') addresses.push({ name: l.name, address: l.value.v });
      return { name: l.name, label: target != null ? null : valueLabel(l.value, language), target, pointer: l.value?.t === 'ptr' };
    }),
  }));
  return {
    frames,
    objects: [...objects.values()].map((o) => ({
      id: o.id,
      kind: o.t === 'obj' ? o.cls : o.kind,
      label: valueLabel(o, language),
      heldBy: heldBy.get(o.id) || [],
    })),
    addresses,
  };
}

/**
 * A small number for every object in the trace (#1, #2 …), in order of first
 * appearance, so labels read well and an object keeps its number from step to
 * step. (Recorded ids can be large: Python's id(), C addresses.)
 */
export function objectNumbers(trace) {
  const numbers = new Map();
  for (const step of trace.steps) for (const id of indexStep(step).keys()) if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
  return numbers;
}

/* ── Lines ──────────────────────────────────────────────────────────────── */

/** Indexes of the steps that ran `line`. */
export function stepsOnLine(trace, line) {
  const out = [];
  trace.steps.forEach((s, i) => s.line === line && out.push(i));
  return out;
}

/** The next step after `from` that runs `line` (wrapping round), or -1. */
export function nextStepOnLine(trace, line, from) {
  const all = stepsOnLine(trace, line);
  if (!all.length) return -1;
  return all.find((i) => i > from) ?? all[0];
}
