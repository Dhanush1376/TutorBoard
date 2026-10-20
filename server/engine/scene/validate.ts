/**
 * Scene Language v1 — semantic validation.
 *
 * Zod checks the shape; this checks the meaning: ids are unique, every
 * reference resolves, actions suit their targets, and data-structure
 * operations stay in bounds (the scene is simulated beat by beat).
 * Messages are written for the model that has to repair the scene.
 */
import type { ZodIssue } from 'zod';
import { coerceScene } from './coerce.js';
import { resolveGeometry } from './resolveGeometry.js';
import {
  ActionT, EntityT, INDEXED_TYPES, Scene, SceneT, SPATIAL_TYPES,
} from './schema.js';

export type Issue = { path: string; message: string };
export type ValidationResult =
  | { ok: true; scene: SceneT; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

export type ValidateOptions = {
  /**
   * Repair predictable slips deterministically (default true): alias names,
   * unknown highlight states, list targets on single-target actions, spaces
   * used as targets (coerce.ts), and entities used before they are created.
   */
  autofix?: boolean;
};

const pathOf = (p: (string | number)[]) =>
  p.reduce<string>((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : String(k)), '');

const fromZod = (i: ZodIssue): Issue => ({ path: pathOf(i.path as (string | number)[]) || '(root)', message: i.message });

const isIndexed = (t: string) => (INDEXED_TYPES as readonly string[]).includes(t);
const isSpatial = (t: string) => (SPATIAL_TYPES as readonly string[]).includes(t);
const TEXT_SETTABLE = new Set(['text', 'rect', 'circle']);
const TWEENABLE: Record<string, string[]> = {
  vector: ['angleDeg', 'magnitude'],
  body: ['x', 'y'],
  point: ['x', 'y'],
};
const UNIVERSAL_TWEENS = ['opacity', 'scale'];

type Parsed = { base: string; index?: number; part?: string };
const parseRef = (ref: string): Parsed => {
  const m = /^([A-Za-z][A-Za-z0-9_-]*)(?:\[(\d+)\]|\.([A-Za-z0-9_-]+))?$/.exec(ref);
  if (!m) return { base: ref };
  return { base: m[1], index: m[2] !== undefined ? Number(m[2]) : undefined, part: m[3] };
};

/** Named parts an entity exposes to `id.part` references. */
const partsOf = (e: EntityT): Set<string> | ((p: string) => boolean) => {
  switch (e.type) {
    case 'polygon': return new Set(e.vertexLabels ?? []);
    case 'pie': return new Set(Array.from({ length: e.slices }, (_, i) => `s${i}`));
    case 'tree': return new Set(e.nodes.map((n) => n.id));
    case 'graph': return new Set(e.nodes.map((n) => n.id));
    case 'molecule': return new Set(e.atoms.map((a) => a.id).filter((x): x is string => !!x));
    case 'network':
      return (p: string) => {
        const m = /^L(\d+)(?:n(\d+))?$/.exec(p);
        if (!m) return false;
        const l = Number(m[1]);
        if (l >= e.layers.length) return false;
        return m[2] === undefined || Number(m[2]) < e.layers[l];
      };
    default: return new Set();
  }
};

export function validateScene(input: unknown, opts: ValidateOptions = {}): ValidationResult {
  const autofix = opts.autofix ?? true;
  const coerced = autofix ? coerceScene(input) : { value: input, fixes: [] as Issue[] };
  // geometry written by intent (angleDeg/length, along/perp, polar points) → coordinates
  const geometry = resolveGeometry(coerced.value);
  const parsed = Scene.safeParse(geometry.value);
  if (!parsed.success) return { ok: false, errors: [...geometry.issues, ...parsed.error.issues.map(fromZod)], warnings: coerced.fixes };
  if (geometry.issues.length) return { ok: false, errors: geometry.issues, warnings: coerced.fixes };
  const scene = parsed.data;
  const errors: Issue[] = [];
  const warnings: Issue[] = [...coerced.fixes];
  const err = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });

  // ── ids ──
  const entities = new Map<string, EntityT>();
  const spaces = new Set<string>();
  scene.spaces.forEach((s, i) => {
    if (spaces.has(s.id)) err(`spaces[${i}].id`, `duplicate id "${s.id}"`);
    spaces.add(s.id);
    if (s.x[0] >= s.x[1]) err(`spaces[${i}].x`, 'x range must be [min, max] with min < max');
    if (s.y[0] >= s.y[1]) err(`spaces[${i}].y`, 'y range must be [min, max] with min < max');
  });
  scene.entities.forEach((e, i) => {
    if (entities.has(e.id) || spaces.has(e.id)) err(`entities[${i}].id`, `duplicate id "${e.id}" — every entity and space needs its own id`);
    entities.set(e.id, e);
  });

  const refExists = (ref: string, path: string, length?: (id: string) => number | undefined): EntityT | undefined => {
    const { base, index, part } = parseRef(ref);
    const e = entities.get(base);
    if (!e) {
      err(path, `"${base}" is not an entity in this scene${spaces.has(base) ? ' (it is a space — target an entity instead)' : ''}`);
      return undefined;
    }
    if (index !== undefined) {
      if (!isIndexed(e.type)) err(path, `"${base}" is a ${e.type}; only ${INDEXED_TYPES.join('/')} elements can be addressed with [index]`);
      else {
        const n = length?.(base);
        if (n !== undefined && index >= n) err(path, `"${ref}" is out of range — "${base}" has ${n} element${n === 1 ? '' : 's'} at this point`);
      }
    }
    if (part !== undefined) {
      const parts = partsOf(e);
      const ok = typeof parts === 'function' ? parts(part) : parts.has(part);
      if (!ok) {
        const known = typeof parts === 'function' ? 'layer refs like "L0" or "L1n2"' : [...parts].map((p) => `"${p}"`).join(', ') || 'none';
        err(path, `"${base}" has no part "${part}" (available: ${known})`);
      }
    }
    return e;
  };
  const endpoint = (v: unknown, path: string) => {
    if (typeof v === 'string') refExists(v, path);
  };

  // ── entities ──
  scene.entities.forEach((e, i) => {
    const p = `entities[${i}]`;
    if ('space' in e && e.space !== undefined && !spaces.has(e.space)) err(`${p}.space`, `space "${e.space}" is not defined in "spaces"`);
    if (isSpatial(e.type) && !('space' in e && e.space)) err(`${p}.space`, `${e.type} uses domain units and needs "space"`);
    switch (e.type) {
      case 'line':
      case 'arrow':
      case 'angle': {
        const ends = e.type === 'angle' ? { vertex: e.vertex, from: e.from, to: e.to } : { from: e.from, to: e.to };
        for (const [k, v] of Object.entries(ends)) {
          endpoint(v, `${p}.${k}`);
          if (Array.isArray(v) && !e.space) err(`${p}.${k}`, `coordinates need "space" (or reference entities/parts instead, like "tri.A")`);
        }
        break;
      }
      case 'pie': {
        const shaded = Array.isArray(e.shaded) ? e.shaded : [];
        if (typeof e.shaded === 'number' && e.shaded > e.slices) err(`${p}.shaded`, `at most ${e.slices} slices can be shaded`);
        shaded.forEach((i, k) => { if (i >= e.slices) err(`${p}.shaded[${k}]`, `slice ${i} doesn't exist (slices are 0–${e.slices - 1})`); });
        if (e.sliceLabels && e.sliceLabels.length !== e.slices) err(`${p}.sliceLabels`, `give one label per slice (${e.slices})`);
        break;
      }
      case 'polygon': {
        const labels = e.vertexLabels ?? [];
        if (labels.length && labels.length !== e.points.length) err(`${p}.vertexLabels`, `give one label per point (${e.points.length})`);
        if (new Set(labels).size !== labels.length) err(`${p}.vertexLabels`, 'vertex labels must be unique');
        break;
      }
      case 'tree': {
        const ids = new Set<string>();
        e.nodes.forEach((n, k) => {
          if (ids.has(n.id)) err(`${p}.nodes[${k}].id`, `duplicate node id "${n.id}"`);
          ids.add(n.id);
        });
        const roots = e.nodes.filter((n) => !n.parent);
        if (roots.length !== 1) err(`${p}.nodes`, `a tree needs exactly one root (a node without "parent"); found ${roots.length}`);
        e.nodes.forEach((n, k) => {
          if (n.parent && !ids.has(n.parent)) err(`${p}.nodes[${k}].parent`, `parent "${n.parent}" is not a node of this tree`);
        });
        // cycle check
        const parent = new Map(e.nodes.map((n) => [n.id, n.parent]));
        for (const n of e.nodes) {
          let cur: string | undefined = n.id;
          for (let hops = 0; cur; hops++) {
            if (hops > e.nodes.length) { err(`${p}.nodes`, `parent links form a cycle at "${n.id}"`); break; }
            cur = parent.get(cur);
          }
        }
        break;
      }
      case 'graph': {
        const ids = new Set(e.nodes.map((n) => n.id));
        if (ids.size !== e.nodes.length) err(`${p}.nodes`, 'graph node ids must be unique');
        e.edges.forEach((ed, k) => {
          if (!ids.has(ed.from)) err(`${p}.edges[${k}].from`, `"${ed.from}" is not a node of this graph`);
          if (!ids.has(ed.to)) err(`${p}.edges[${k}].to`, `"${ed.to}" is not a node of this graph`);
        });
        break;
      }
      case 'table':
        if (e.columns) e.rows.forEach((r, k) => {
          if (r.length !== e.columns!.length) err(`${p}.rows[${k}]`, `row has ${r.length} cells but there are ${e.columns!.length} columns`);
        });
        break;
      case 'molecule':
        e.bonds.forEach(([a, b], k) => {
          if (a >= e.atoms.length || b >= e.atoms.length) err(`${p}.bonds[${k}]`, `atom index out of range (molecule has ${e.atoms.length} atoms, indices start at 0)`);
          if (a === b) err(`${p}.bonds[${k}]`, 'an atom cannot bond to itself');
        });
        (e.lonePairs ?? []).forEach((lp, k) => {
          if (lp.atom >= e.atoms.length) err(`${p}.lonePairs[${k}].atom`, `atom index out of range (${e.atoms.length} atoms)`);
        });
        break;
      case 'network':
        if (e.inputLabels && e.inputLabels.length > e.layers[0]) warn(`${p}.inputLabels`, `more input labels than input nodes (${e.layers[0]})`);
        if (e.outputLabels && e.outputLabels.length !== e.layers[e.layers.length - 1]) warn(`${p}.outputLabels`, `give one label per output node (${e.layers[e.layers.length - 1]})`);
        break;
      case 'vector':
        if (!e.to && (e.angleDeg === undefined || e.magnitude === undefined)) err(p, 'a vector needs "to", or both "angleDeg" and "magnitude"');
        break;
      case 'pixels':
        if (new Set(e.grid.map((r) => r.length)).size > 1) warn(`${p}.grid`, 'rows have different lengths');
        break;
      case 'plot':
        if (!/^[\sA-Za-z0-9_.,+\-*/^()πθ]+$/.test(e.expr)) err(`${p}.expr`, 'use a plain expression of x with + - * / ^ ( ) and functions like sin, cos, sqrt, exp, log');
        if (e.domain && e.domain[0] >= e.domain[1]) err(`${p}.domain`, 'domain must be [min, max] with min < max');
        break;
      case 'group':
        e.children.forEach((c, k) => {
          if (c === e.id) err(`${p}.children[${k}]`, 'a group cannot contain itself');
          else if (!entities.has(c)) err(`${p}.children[${k}]`, `"${c}" is not an entity in this scene`);
        });
        break;
      default:
        break;
    }
  });

  // ── layout ──
  const placed = new Map<string, number>();
  scene.layout.forEach((r, i) => {
    const p = `layout[${i}]`;
    const ids = 'ids' in r ? r.ids : [r.id];
    ids.forEach((id, k) => {
      const path = 'ids' in r ? `${p}.ids[${k}]` : `${p}.id`;
      if (!entities.has(id) && !spaces.has(id)) err(path, `"${id}" is not an entity or space in this scene`);
      const e = entities.get(id);
      if (e && 'space' in e && e.space) warn(path, `"${id}" lives in space "${e.space}"; place the space instead`);
      placed.set(id, (placed.get(id) ?? 0) + 1);
    });
    if ('of' in r && !entities.has(r.of) && !spaces.has(r.of)) err(`${p}.of`, `"${r.of}" is not an entity or space in this scene`);
  });
  for (const [id, n] of placed) if (n > 1) warn('layout', `"${id}" is positioned by ${n} relations; the first one wins`);

  // ── beats: simulate ──
  const length = new Map<string, number>();
  for (const e of scene.entities) if (isIndexed(e.type)) length.set(e.id, (e as { values: unknown[] }).values.length);
  const created = new Set<string>();
  const removed = new Set<string>();
  const lengthOf = (id: string) => length.get(id);

  const fixedBeats = scene.beats.map((beat, b) => {
    const out: ActionT[] = [];
    let visible = false;
    beat.actions.forEach((a, k) => {
      const p = `beats[${b}].actions[${k}]`;
      const targets = (t: unknown) => (t === undefined ? [] : Array.isArray(t) ? t as string[] : [t as string]);
      const ensureCreated = (ref: string, path: string) => {
        const { base } = parseRef(ref);
        if (!entities.has(base) || created.has(base)) return;
        if (removed.has(base)) { err(path, `"${base}" was removed earlier — create it again first`); return; }
        if (autofix) {
          out.push({ do: 'create', target: base, with: out.length ? 'previous' : undefined } as ActionT);
          created.add(base);
          warn(path, `"${base}" was used before being created — added a create`);
        } else err(path, `"${base}" is used before it is created — add {"do":"create","target":"${base}"} earlier`);
      };
      switch (a.do) {
        case 'create':
          for (const t of targets(a.target)) {
            const { base, index, part } = parseRef(t);
            const owner = entities.get(base);
            if (part !== undefined && owner && (owner.type === 'tree' || owner.type === 'graph')) {
              // a single node appears (e.g. inserting into a BST); its owner must be on the board
              refExists(t, `${p}.target`);
              ensureCreated(base, `${p}.target`);
              continue;
            }
            if (index !== undefined || part !== undefined) { err(`${p}.target`, `create whole entities ("${base}") or nodes of a tree/graph ("tree.n3"), not "${t}"`); continue; }
            if (!entities.has(base)) { err(`${p}.target`, `"${base}" is not an entity in this scene`); continue; }
            if (created.has(base)) warn(`${p}.target`, `"${base}" is already on the board`);
            created.add(base);
            removed.delete(base);
          }
          visible = true;
          break;
        case 'remove':
          for (const t of targets(a.target)) {
            const { base, part } = parseRef(t);
            const owner = entities.get(base);
            if (part !== undefined && owner && (owner.type === 'tree' || owner.type === 'graph')) { refExists(t, `${p}.target`); continue; }
            if (!entities.has(base)) { err(`${p}.target`, `"${base}" is not an entity in this scene`); continue; }
            if (!created.has(base)) warn(`${p}.target`, `"${base}" is removed before it was shown`);
            created.delete(base);
            removed.add(base);
          }
          visible = true;
          break;
        case 'exchange': {
          ensureCreated(a.a, `${p}.a`);
          ensureCreated(a.b, `${p}.b`);
          const ea = refExists(a.a, `${p}.a`, lengthOf);
          const eb = refExists(a.b, `${p}.b`, lengthOf);
          const ra = parseRef(a.a), rb = parseRef(a.b);
          const element = (r: Parsed, e?: EntityT) => !!e && ((r.part !== undefined && (e.type === 'tree' || e.type === 'graph')) || (r.index !== undefined && isIndexed(e.type)));
          if (ea && !element(ra, ea)) err(`${p}.a`, `exchange swaps the values of two tree/graph nodes ("heap.n2") or two cells ("arr[1]"); "${a.a}" is neither`);
          if (eb && !element(rb, eb)) err(`${p}.b`, `exchange swaps the values of two tree/graph nodes ("heap.n2") or two cells ("arr[1]"); "${a.b}" is neither`);
          if (ra.base !== rb.base) err(p, `"${a.a}" and "${a.b}" must belong to the same entity`);
          if (a.a === a.b) warn(p, 'exchanging an element with itself does nothing');
          visible = true;
          break;
        }
        case 'swap': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (e && !isIndexed(e.type)) err(`${p}.target`, `swap needs an ${INDEXED_TYPES.join('/')}; "${a.target}" is a ${e.type}`);
          const n = lengthOf(a.target);
          if (n !== undefined) for (const key of ['i', 'j'] as const) if (a[key] >= n) err(`${p}.${key}`, `index ${a[key]} is out of range — "${a.target}" has ${n} elements here`);
          if (a.i === a.j) warn(p, 'swapping an element with itself does nothing');
          visible = true;
          break;
        }
        case 'push':
        case 'enqueue':
        case 'pop':
        case 'dequeue':
        case 'insert':
        case 'delete': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (!e) break;
          const allowed: Record<string, string[]> = {
            push: ['stack', 'queue', 'array', 'linkedlist'], enqueue: ['queue'], pop: ['stack'], dequeue: ['queue'],
            insert: ['array', 'linkedlist'], delete: ['array', 'linkedlist'],
          };
          if (!allowed[a.do].includes(e.type)) {
            err(`${p}.do`, `"${a.do}" works on ${allowed[a.do].join('/')}; "${a.target}" is a ${e.type}${e.type === 'queue' && a.do === 'pop' ? ' (use "dequeue")' : e.type === 'stack' && a.do === 'dequeue' ? ' (use "pop")' : ''}`);
            break;
          }
          const n = lengthOf(a.target) ?? 0;
          if (a.do === 'push' || a.do === 'enqueue') length.set(a.target, n + 1);
          else if (a.do === 'insert') {
            if (a.at > n) err(`${p}.at`, `insert position ${a.at} is past the end ("${a.target}" has ${n} elements)`);
            length.set(a.target, n + 1);
          } else {
            if (n === 0) err(p, `"${a.target}" is empty here — nothing to ${a.do}`);
            else if (a.do === 'delete' && a.at >= n) err(`${p}.at`, `index ${a.at} is out of range ("${a.target}" has ${n} elements)`);
            length.set(a.target, Math.max(0, n - 1));
          }
          visible = true;
          break;
        }
        case 'set': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`, lengthOf);
          if (a.value === undefined && a.text === undefined && a.latex === undefined) err(p, 'set needs "value", "text" or "latex"');
          if (e && a.text !== undefined && !TEXT_SETTABLE.has(e.type)) warn(`${p}.text`, `"text" applies to text/rect/circle; "${e.id}" is a ${e.type}`);
          if (e && a.latex !== undefined && e.type !== 'math') warn(`${p}.latex`, `"latex" applies to math entities; "${e.id}" is a ${e.type}`);
          visible = true;
          break;
        }
        case 'morph': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (e && !isIndexed(e.type)) err(`${p}.target`, `morph animates ${INDEXED_TYPES.join('/')} values; "${a.target}" is a ${e.type}`);
          else length.set(a.target, a.values.length);
          visible = true;
          break;
        }
        case 'move': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (e && !('space' in e && e.space)) err(`${p}.target`, `move takes space units; "${a.target}" is not in a space (use layout relations for board items)`);
          if (!a.to && !a.by && a.turn === undefined) err(p, 'move needs "to" (new position), "by" (shift) or "turn" (degrees)');
          visible = true;
          break;
        }
        case 'rearrange': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (e && e.type !== 'pie') err(`${p}.target`, `rearrange lays out a pie's slices; "${a.target}" is a ${e.type}`);
          visible = true;
          break;
        }
        case 'trace': {
          ensureCreated(a.target, `${p}.target`);
          ensureCreated(a.along, `${p}.along`);
          const body = refExists(a.target, `${p}.target`);
          const path = refExists(a.along, `${p}.along`);
          if (body && body.type !== 'body' && body.type !== 'point') err(`${p}.target`, `trace moves a body or point; "${a.target}" is a ${body.type}`);
          if (path && path.type !== 'plot' && path.type !== 'path') err(`${p}.along`, `trace follows a plot or path; "${a.along}" is a ${path.type}`);
          if (body && path && 'space' in body && 'space' in path && body.space !== path.space) warn(p, `"${a.target}" and "${a.along}" are in different spaces`);
          visible = true;
          break;
        }
        case 'tween': {
          ensureCreated(a.target, `${p}.target`);
          const e = refExists(a.target, `${p}.target`);
          if (e && !UNIVERSAL_TWEENS.includes(a.prop) && !(TWEENABLE[e.type] ?? []).includes(a.prop)) {
            warn(`${p}.prop`, `"${a.prop}" can't be tweened on a ${e.type}; try ${[...UNIVERSAL_TWEENS, ...(TWEENABLE[e.type] ?? [])].join(', ')}`);
          }
          visible = true;
          break;
        }
        case 'highlight':
        case 'clear':
        case 'annotate':
        case 'unannotate':
        case 'focus':
          for (const t of targets(a.target)) {
            ensureCreated(t, `${p}.target`);
            refExists(t, `${p}.target`, lengthOf);
          }
          if (a.do !== 'focus') visible = true;
          break;
        case 'connect':
          ensureCreated(a.from, `${p}.from`);
          ensureCreated(a.to, `${p}.to`);
          refExists(a.from, `${p}.from`, lengthOf);
          refExists(a.to, `${p}.to`, lengthOf);
          visible = true;
          break;
        case 'wait':
          break;
      }
      out.push(a);
    });
    if (!visible) warn(`beats[${b}]`, 'this beat changes nothing on the board — add an action the learner can see');
    if (beat.check) {
      const c = beat.check;
      if (b === scene.beats.length - 1) err(`beats[${b}].check`, 'a check asks the learner to predict the NEXT beat — move it to an earlier beat');
      if (c.answer >= c.choices.length) err(`beats[${b}].check.answer`, `answer is an index into choices (0–${c.choices.length - 1})`);
      if (new Set(c.choices.map((x) => x.trim().toLowerCase())).size !== c.choices.length) err(`beats[${b}].check.choices`, 'choices must all be different');
    }
    return { ...beat, actions: out };
  });

  for (const [id, e] of entities) {
    const shown = scene.beats.some((bt) => bt.actions.some((a) => a.do === 'create' && (Array.isArray(a.target) ? a.target.includes(id) : a.target === id)));
    const inGroup = scene.entities.some((g) => g.type === 'group' && g.children.includes(id));
    if (!shown && !created.has(id) && !removed.has(id) && !inGroup) warn(`entities`, `"${e.id}" is never shown`);
  }

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, scene: { ...scene, beats: fixedBeats }, warnings };
}

/** Issues as a compact list the model can act on in a repair round. */
export function formatIssuesForRepair(issues: Issue[], max = 20): string {
  const lines = issues.slice(0, max).map((i) => `- ${i.path}: ${i.message}`);
  if (issues.length > max) lines.push(`- …and ${issues.length - max} more`);
  return lines.join('\n');
}
