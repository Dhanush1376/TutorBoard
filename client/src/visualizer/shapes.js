import { indexStep, resolve, valueLabel } from './traceModel';

/**
 * Which pieces of a step's data can be drawn, and how: arrays (with the index
 * variables pointing into them), grids, linked lists, binary trees and maps.
 * Read only from the step itself; nothing is inferred. ui/DataView.jsx draws them.
 */

const POINTER_NAMES = /^(i|j|k|l|r|m|n?idx|index|lo|hi|low|high|mid|left|right|start|end|begin|p|q|pivot|pi|min_?idx|minIdx|max_?idx|maxIdx|cur|curr|current|slow|fast|top|front|rear|head|tail|pos|ptr|a|b|x|y|row|col|c)$/i;
export const NEXT = ['next', 'nxt', 'link'];
export const LEFT = ['left', 'l', 'lchild'];
export const RIGHT = ['right', 'r', 'rchild'];
const LABEL_FIELDS = ['val', 'value', 'data', 'key', 'item', 'v', 'name', 'info'];

const isScalar = (v) => v && ['num', 'str', 'bool', 'none'].includes(v.t);
export const asNumber = (v) => (v?.t === 'num' && typeof v.v === 'number' ? v.v : null);
export const field = (obj, names) => obj?.fields?.find((f) => names.includes(f.name));

export function nodeLabel(obj, lang) {
  const f = field(obj, LABEL_FIELDS) || obj.fields.find((x) => isScalar(x.value));
  return f ? valueLabel(f.value, lang) : obj.cls;
}

/* What can be drawn in this step: arrays, grids, linked lists, trees, maps. */
export function findShapes(step, prevStep) {
  if (!step) return [];
  const byId = indexStep(step);
  const frames = step.frames.slice().reverse(); // running function first
  const top = frames[0];
  const shapes = [];
  const used = new Set();
  const inChain = new Set(); // nodes already drawn in a list; a variable pointing at one is shown as a mark
  const prevTop = prevStep?.frames.find((f) => f.id === top.id);

  const intLocals = top.locals.filter((l) => Number.isInteger(asNumber(l.value)) && POINTER_NAMES.test(l.name));

  for (const frame of frames) {
    for (const { name, value } of frame.locals) {
      const v = resolve(value, byId);
      if (!v || used.has(v.id ?? `${frame.id}:${name}`)) continue;
      const key = `${frame.id}:${name}`;
      const owner = frame === top ? null : frame.name;
      const prevValue = frame === top ? prevTop?.locals.find((l) => l.name === name)?.value : null;
      const prev = prevValue ? resolve(prevValue, indexStep(prevStep)) : null;

      if (v.t === 'list' && v.items.length && v.items.every((x) => isScalar(resolve(x, byId)))) {
        used.add(v.id ?? key);
        const pointers = frame === top ? intLocals.filter((l) => asNumber(l.value) >= 0 && asNumber(l.value) < v.len && l.name !== name) : [];
        shapes.push({ kind: 'array', key, name, owner, value: v, prev: prev?.t === 'list' ? prev : null, pointers });
      } else if (v.t === 'list' && v.items.length && v.items.length <= 16 && v.items.every((x) => resolve(x, byId)?.t === 'list')) {
        const rows = v.items.map((x) => resolve(x, byId));
        if (rows.every((r) => r.items.length <= 16 && r.items.every(isScalar))) {
          used.add(v.id ?? key);
          const row = intLocals.find((l) => /^(i|r|row|y)$/i.test(l.name));
          const col = intLocals.find((l) => /^(j|c|col|x)$/i.test(l.name));
          shapes.push({ kind: 'grid', key, name, owner, rows, prevRows: prev?.t === 'list' ? prev.items.map((x) => resolve(x, indexStep(prevStep))) : null, row, col });
        }
      } else if (v.t === 'map' && v.entries.length && v.entries.length <= 24) {
        used.add(v.id ?? key);
        shapes.push({ kind: 'map', key, name, owner, value: v });
      } else if (v.t === 'obj' || (value?.t === 'ptr' && v?.t === 'obj')) {
        const node = v;
        if (field(node, LEFT) || field(node, RIGHT)) {
          used.add(node.id ?? key);
          shapes.push({ kind: 'tree', key, name, owner, root: node, byId });
        } else if (field(node, NEXT)) {
          if (inChain.has(node.id)) continue;
          const chain = [];
          const seen = new Set();
          let cur = node;
          let cycle = false;
          while (cur && cur.t === 'obj' && chain.length < 14) {
            if (seen.has(cur.id)) {
              cycle = true;
              break;
            }
            seen.add(cur.id);
            chain.push(cur);
            cur = resolve(field(cur, NEXT)?.value, byId);
          }
          used.add(node.id ?? key);
          chain.forEach((c) => inChain.add(c.id));
          // Which other variables point at a node in this list (e.g. `cur`, `prev`).
          const marks = new Map();
          for (const l of top.locals) {
            const target = resolve(l.value, byId);
            if (target?.t === 'obj' && l.name !== name) {
              const at = chain.findIndex((c) => c.id === target.id);
              if (at >= 0) marks.set(at, [...(marks.get(at) || []), l.name]);
            }
          }
          shapes.push({ kind: 'chain', key, name, owner, chain, cycle, more: !!cur && !cycle && cur.t === 'obj', marks });
        }
      }
    }
  }
  return shapes.slice(0, 4);
}
