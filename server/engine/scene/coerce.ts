/**
 * Deterministic fixes for predictable model slips, applied before schema
 * validation. Every fix is reported, so nothing changes silently; anything
 * that needs judgement is left for the validator to send back to the model.
 *
 * In the first live run, every repair round (each a full regeneration —
 * ~2× latency) was caused by slips like these.
 */
import { latexToPlain } from './plainMath.js';
import type { Issue } from './validate.js';

type Loose = Record<string, any>;

const STATES = new Set(['active', 'comparing', 'swapping', 'sorted', 'found', 'visited', 'eliminated', 'pivot', 'error', 'insight']);
const STATE_SYNONYMS: Record<string, string> = {
  highlight: 'active', highlighted: 'active', current: 'active', focus: 'active', selected: 'active', info: 'active', primary: 'active', default: 'active',
  compare: 'comparing', checking: 'comparing', warning: 'comparing', candidate: 'comparing',
  swap: 'swapping', moving: 'swapping',
  done: 'sorted', complete: 'sorted', completed: 'sorted', success: 'sorted', correct: 'sorted', final: 'sorted', ok: 'sorted',
  match: 'found', matched: 'found', result: 'found', answer: 'found', target: 'found',
  seen: 'visited', explored: 'visited', processed: 'visited',
  removed: 'eliminated', discarded: 'eliminated', excluded: 'eliminated', inactive: 'eliminated', dim: 'eliminated', muted: 'eliminated',
  danger: 'error', wrong: 'error', invalid: 'error', fail: 'error', failed: 'error', violation: 'error',
  key: 'insight', important: 'insight', new: 'insight', emphasis: 'insight', accent: 'insight',
};
const TONES = new Set(['default', 'primary', 'accent', 'success', 'warning', 'danger', 'info', 'muted']);
const ROLES = new Set(['title', 'body', 'caption', 'label', 'code']);
const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);

const SPATIAL = new Set(['point', 'polygon', 'path', 'plot', 'curve', 'area', 'refline', 'vector', 'body', 'scatter']);

const ENTITY_ALIASES: Record<string, string> = {
  equation: 'math', formula: 'math', latex: 'math', expression: 'math',
  label: 'text', caption: 'text', heading: 'text', title: 'text', note: 'text', paragraph: 'text',
  box: 'rect', rectangle: 'rect', square: 'rect', block: 'rect', card: 'rect',
  dot: 'point', marker: 'point',
  ball: 'body', particle: 'body', object: 'body', mass: 'body',
  function: 'plot', graph_of: 'plot',
  parametric: 'curve', polar: 'curve',
  shading: 'area', region: 'area', shaded_area: 'area', integral: 'area',
  asymptote: 'refline', reference_line: 'refline', refLine: 'refline', hline: 'refline', vline: 'refline', threshold: 'refline',
  list: 'array', matrix: 'table',
  triangle: 'polygon', quadrilateral: 'polygon', shape: 'polygon',
  segment: 'line', ray: 'arrow', force: 'vector',
  pie_chart: 'pie', piechart: 'pie', pizza: 'pie', fraction: 'pie', fraction_circle: 'pie', sector: 'pie',
  neural_network: 'network', nn: 'network',
  curved_arrow: 'curly', curly_arrow: 'curly', electron_arrow: 'curly', arrow_push: 'curly', mechanism_arrow: 'curly',
  cell_diagram: 'compartment', labelled_diagram: 'compartment', labeled_diagram: 'compartment', compartments: 'compartment', anatomy: 'compartment', organ: 'compartment',
  chemical_reaction: 'reaction', equation_reaction: 'reaction', chemical_equation: 'reaction',
};
const ROLE_FROM_ALIAS: Record<string, string> = { heading: 'title', title: 'title', caption: 'caption', label: 'label', note: 'body', paragraph: 'body' };

const ACTION_ALIASES: Record<string, string> = {
  show: 'create', appear: 'create', add: 'create', draw: 'create', reveal: 'create', fade_in: 'create', fadeIn: 'create',
  hide: 'remove', disappear: 'remove', fade_out: 'remove', fadeOut: 'remove', delete_entity: 'remove',
  emphasize: 'highlight', mark: 'highlight', flash: 'highlight', pulse: 'highlight', glow: 'highlight', color: 'highlight',
  label: 'annotate', note: 'annotate', callout: 'annotate', explain: 'annotate', comment: 'annotate',
  unlabel: 'unannotate', remove_annotation: 'unannotate',
  camera: 'focus', zoom: 'focus', pan: 'focus',
  pause: 'wait', delay: 'wait',
  append: 'push', link: 'connect', add_edge: 'connect',
  update: 'set', change: 'set', animate: 'tween', swap_values: 'exchange',
  translate: 'move', shift: 'move', slide: 'move', rotate: 'move', turn: 'move',
  unroll: 'rearrange', unwrap: 'rearrange', unfold: 'rearrange', arrange: 'rearrange', rearrange_slices: 'rearrange',
};
/** Where a pie's slices go, in the words models use. */
const INTO_ALIASES: Record<string, 'strip' | 'circle'> = {
  strip: 'strip', row: 'strip', line: 'strip', rectangle: 'strip', parallelogram: 'strip', 'side-by-side': 'strip', alternate: 'strip', alternating: 'strip',
  circle: 'circle', pie: 'circle', whole: 'circle', back: 'circle', original: 'circle',
};
/** Actions that take exactly one target; a list becomes one action per target. */
const SINGLE_TARGET = new Set(['move', 'swap', 'push', 'enqueue', 'pop', 'dequeue', 'insert', 'delete', 'set', 'morph', 'annotate', 'unannotate', 'trace', 'tween', 'rearrange']);

const SIDES = new Set(['above', 'below', 'left', 'right']);
const SIDE_ALIASES: Record<string, string> = {
  top: 'above', up: 'above', over: 'above', north: 'above',
  bottom: 'below', down: 'below', under: 'below', beneath: 'below', south: 'below',
  east: 'right', west: 'left',
};

const RELATION_ALIASES: Record<string, string> = {
  under: 'below', beneath: 'below', over: 'above', 'next-to': 'right-of', beside: 'right-of', 'left': 'left-of', 'right': 'right-of',
  horizontal: 'row', hstack: 'row', vertical: 'column', vstack: 'column',
};

/**
 * LaTeX commands that collide with JSON escapes arrive as control characters
 * when the model writes "\frac" instead of "\\frac": \f form feed, \t tab,
 * \b backspace, \r carriage return, \n newline. Put the backslash back.
 * Over-escaping ("\\\\mathbf" in JSON) leaves "\\mathbf", a LaTeX line break
 * before the command: collapse a doubled backslash in front of a letter.
 */
export function restoreLatex(s: string): string {
  return s.replace(/\f/g, '\\f').replace(/\t/g, '\\t').replace(/\x08/g, '\\b').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    // "\\," "\\;" "\\!" — a line break before a spacing command is never meant (x\,dx).
    // Only a lone pair: "\\\frac" is a real line break followed by \frac (docs/eval/runs/full-48-part3/phy-4)
    .replace(/(?<!\\)\\\\(?=[a-zA-Z,;:!])/g, '\\');
}

/** Model output → object, tolerating LaTeX backslashes that are invalid JSON escapes. */
export function parseModelJSON(raw: string, parse: (t: string) => unknown): unknown {
  const first = parse(raw);
  if (first) return first;
  // "\alpha", "\sqrt", "\cdot" … are not JSON escapes: double the backslash and retry
  return parse(raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
}

export function coerceScene(input: unknown): { value: unknown; fixes: Issue[] } {
  const fixes: Issue[] = [];
  const fix = (path: string, message: string) => fixes.push({ path, message: `auto-fixed: ${message}` });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { value: input, fixes };
  const s: Loose = structuredClone(input);

  if (s.version !== '1') { if (s.version !== undefined) fix('version', `"${s.version}" → "1"`); s.version = '1'; }
  if (!Array.isArray(s.spaces)) s.spaces = [];
  if (!Array.isArray(s.layout)) s.layout = [];
  if (!Array.isArray(s.entities)) s.entities = [];
  if (!Array.isArray(s.beats)) s.beats = [];

  // models sometimes double-encode: "entities": ["{\"id\": …}"] — decode those
  const decode = (list: unknown[], path: string) => list.map((x, i) => {
    if (typeof x !== 'string' || !/^\s*\{/.test(x)) return x;
    try {
      const v = JSON.parse(x);
      if (v && typeof v === 'object' && !Array.isArray(v)) { fix(`${path}[${i}]`, 'decoded an object written as a JSON string'); return v; }
    } catch { /* leave it for the validator */ }
    return x;
  });
  s.spaces = decode(s.spaces, 'spaces');
  s.entities = decode(s.entities, 'entities');
  s.layout = decode(s.layout, 'layout');
  s.beats = decode(s.beats, 'beats');
  s.beats.forEach((b: Loose, bi: number) => { if (b && Array.isArray(b.actions)) b.actions = decode(b.actions, `beats[${bi}].actions`); });

  s.spaces.forEach((sp: Loose, i: number) => {
    // directions are the lesson when a space holds vectors or angles: draw it at true shape
    // (a 45° launch on x 0–45 m, y 0–14 m otherwise looks like 60°)
    if (sp && typeof sp === 'object' && sp.equalAspect === undefined
      && s.entities.some((e: Loose) => e?.space === sp.id && (e.type === 'vector' || e.type === 'angle'))) {
      sp.equalAspect = true;
    }
    if (sp && typeof sp === 'object' && sp.kind !== 'cartesian') {
      fix(`spaces[${i}].kind`, `${sp.kind === undefined ? 'missing' : `"${sp.kind}"`} → "cartesian"`);
      sp.kind = 'cartesian';
    }
    for (const k of ['xLabel', 'yLabel']) {
      if (typeof sp?.[k] === 'string' && restoreLatex(sp[k]) !== sp[k]) { sp[k] = restoreLatex(sp[k]); fix(`spaces[${i}].${k}`, 'restored LaTeX backslashes'); }
    }
  });
  const spaceIds = new Set<string>(s.spaces.map((sp: Loose) => sp?.id).filter(Boolean));

  // math written in plain-text places (titles, narration, board text) → readable Unicode
  const plain = (obj: Loose, key: string, path: string) => {
    if (typeof obj?.[key] !== 'string') return;
    const v = latexToPlain(obj[key]);
    if (v !== obj[key]) { fix(path, `LaTeX → "${v}"`); obj[key] = v; }
  };
  plain(s, 'title', 'title');
  plain(s, 'summary', 'summary');

  // ── entities ──
  s.entities.forEach((e: Loose, i: number) => {
    if (!e || typeof e !== 'object') return;
    const p = `entities[${i}]`;
    // "curve" with a y = f(x) expression is a plot; "plot" with x(t)/y(t) or r(θ) is a curve
    if (e.type === 'curve' && typeof e.expr === 'string' && e.x === undefined && e.r === undefined) { fix(`${p}.type`, '"curve" with "expr" → "plot"'); e.type = 'plot'; }
    if (e.type === 'plot' && typeof e.expr !== 'string' && (typeof e.r === 'string' || (typeof e.x === 'string' && typeof e.y === 'string'))) { fix(`${p}.type`, 'parametric/polar "plot" → "curve"'); e.type = 'curve'; }
    if (e.type === 'curve' && e.t === undefined) {
      const range = e.theta ?? e.range ?? e.domain;
      if (Array.isArray(range) && range.length === 2) { e.t = range; delete e.domain; fix(`${p}.t`, 'parameter range taken from its domain'); }
    }
    const alias = ENTITY_ALIASES[e.type];
    if (alias) {
      fix(`${p}.type`, `"${e.type}" → "${alias}"`);
      if (alias === 'text' && !e.role && ROLE_FROM_ALIAS[e.type]) e.role = ROLE_FROM_ALIAS[e.type];
      e.type = alias;
    }
    if (e.type === 'compartment') {
      // parts under other names, and their fields under the usual synonyms
      if (!Array.isArray(e.parts)) {
        const list = e.organelles ?? e.structures ?? e.children ?? e.regions;
        if (Array.isArray(list)) { e.parts = list; fix(`${p}.parts`, 'taken from its structures'); }
        delete e.organelles; delete e.structures; delete e.children; delete e.regions;
      }
      if (Array.isArray(e.parts)) e.parts.forEach((q: Loose) => {
        if (!q || typeof q !== 'object') return;
        if (q.label === undefined) q.label = q.name ?? q.text ?? q.id;
        if (q.in === undefined) q.in = q.parent ?? q.inside;
        delete q.name; delete q.parent; delete q.inside;
        if (q.in === e.id || q.in === null) delete q.in;
        if (typeof q.shape === 'string' && /membrane|wall|envelope/i.test(q.shape) && q.shape !== 'membrane') q.shape = 'membrane';
      });
    }
    if (e.type === 'pie') {
      if (e.slices === undefined) e.slices = e.parts ?? e.segments ?? e.divisions ?? e.denominator;
      if (e.shaded === undefined) e.shaded = e.filled ?? e.highlighted ?? e.numerator;
      delete e.parts; delete e.segments; delete e.divisions; delete e.denominator; delete e.filled; delete e.highlighted; delete e.numerator;
    }
    if (e.type === 'math' && typeof e.latex !== 'string') {
      const src = e.text ?? e.value ?? e.expr ?? e.label;
      if (typeof src === 'string') { e.latex = src; fix(`${p}.latex`, 'taken from its text'); }
    }
    if (e.type === 'math' && typeof e.latex === 'string') {
      const restored = restoreLatex(e.latex);
      if (restored !== e.latex) { e.latex = restored; fix(`${p}.latex`, 'restored LaTeX backslashes eaten by JSON escapes'); }
    }
    if (e.type === 'text' && typeof e.text !== 'string' && typeof e.label === 'string') { e.text = e.label; delete e.label; fix(`${p}.text`, 'taken from its label'); }
    if (['text', 'rect'].includes(e.type) && e.role !== 'code') plain(e, 'text', `${p}.text`);
    if (typeof e.label === 'string') {
      // figure labels are drawn as math ("F_N", "\theta"): repair the same escape damage
      const restored = restoreLatex(e.label);
      if (restored !== e.label) { e.label = restored; fix(`${p}.label`, 'restored LaTeX backslashes'); }
    }
    if (SPATIAL.has(e.type) && e.space === undefined && spaceIds.size === 1) {
      e.space = [...spaceIds][0];
      fix(`${p}.space`, `placed in the only space, "${e.space}"`);
    }
    if (e.tone !== undefined && !TONES.has(e.tone)) { fix(`${p}.tone`, `dropped unknown tone "${e.tone}"`); delete e.tone; }
    if (e.role !== undefined && !ROLES.has(e.role)) { fix(`${p}.role`, `"${e.role}" → "body"`); e.role = 'body'; }
    if (e.size !== undefined && !SIZES.has(e.size)) { fix(`${p}.size`, `"${e.size}" → "md"`); e.size = 'md'; }
    if (e.type === 'polygon' && Array.isArray(e.vertexLabels)) {
      // labels name the vertices as parts ("tri.A"), so they must be unique
      const used = new Set<string>(e.vertexLabels.filter((l: unknown) => typeof l === 'string' && l));
      const seen = new Set<string>();
      let next = 0;
      const fresh = () => {
        while (used.has(String.fromCharCode(65 + next))) next++;
        const l = String.fromCharCode(65 + next++);
        used.add(l);
        return l;
      };
      const labels = e.vertexLabels.map((l: unknown) => {
        const v = l === undefined || l === null ? '' : String(l);
        const out = v && !seen.has(v) ? v : fresh();
        seen.add(out);
        return out;
      });
      if (labels.some((l: string, j: number) => l !== e.vertexLabels[j])) {
        fix(`${p}.vertexLabels`, `made unique: ${JSON.stringify(labels)}`);
        e.vertexLabels = labels;
      }
    }
    if (Array.isArray(e.values)) {
      e.values = e.values.map((v: unknown) => (v && typeof v === 'object' ? (v as Loose).value ?? (v as Loose).label ?? JSON.stringify(v) : v));
    }
  });

  // ── layout ──
  s.layout = s.layout.flatMap((r: Loose, i: number) => {
    if (!r || typeof r !== 'object') return [];
    const p = `layout[${i}]`;
    // a bare region name is a placement; "left"/"right" with "of" is a relation
    if (['center', 'top', 'bottom', 'left', 'right'].includes(r.rel) && !r.of) {
      fix(`${p}.rel`, `"${r.rel}" → place ${r.rel}`);
      return [{ rel: 'place', id: r.id, region: r.rel }];
    }
    const alias = RELATION_ALIASES[r.rel];
    if (alias) { fix(`${p}.rel`, `"${r.rel}" → "${alias}"`); r.rel = alias; }
    return [r];
  });
  // a reaction whose molecules nobody placed reads left to right: reactants, arrow, products
  const mentioned = new Set<string>(s.layout.flatMap((r: Loose) => [r.id, r.of, ...(Array.isArray(r.ids) ? r.ids : [])]));
  s.entities.forEach((e: Loose, i: number) => {
    if (e?.type !== 'reaction' || !Array.isArray(e.reactants) || !Array.isArray(e.products)) return;
    const pid = (r: unknown) => (typeof r === 'string' ? r : (r as Loose)?.id);
    const ids = [...e.reactants.map(pid), e.id, ...e.products.map(pid)].filter((x) => typeof x === 'string');
    if (ids.length < 2 || ids.length > 8 || ids.some((x) => mentioned.has(x))) return;
    s.layout.push({ rel: 'row', ids, gap: 'xl' });
    fix(`entities[${i}]`, `laid out in a row: ${ids.join(', ')}`);
  });

  // ── beats & actions ──
  s.beats = s.beats.flatMap((b: Loose, bi: number) => {
    if (!b || typeof b !== 'object') return [];
    if (typeof b.title !== 'string' || !b.title) { b.title = `Step ${bi + 1}`; fix(`beats[${bi}].title`, 'added'); }
    if (typeof b.narration !== 'string' || !b.narration) { b.narration = b.title; fix(`beats[${bi}].narration`, 'copied from the title'); }
    plain(b, 'title', `beats[${bi}].title`);
    plain(b, 'narration', `beats[${bi}].narration`);
    if (b.check === undefined && b.quiz && typeof b.quiz === 'object') { b.check = b.quiz; delete b.quiz; fix(`beats[${bi}].check`, 'taken from "quiz"'); }
    if (b.check && typeof b.check === 'object') {
      const c = b.check;
      const p = `beats[${bi}].check`;
      if (c.question === undefined && typeof c.prompt === 'string') { c.question = c.prompt; delete c.prompt; }
      if (c.choices === undefined && Array.isArray(c.options)) { c.choices = c.options; delete c.options; }
      if (Array.isArray(c.choices)) c.choices = c.choices.map((x: unknown) => (x && typeof x === 'object' ? (x as Loose).text ?? (x as Loose).label ?? JSON.stringify(x) : String(x)));
      if (c.answer === undefined) c.answer = c.answerIndex ?? c.correct ?? c.correctIndex;
      delete c.answerIndex; delete c.correct; delete c.correctIndex;
      if (typeof c.answer === 'string' && Array.isArray(c.choices)) {
        const i = c.choices.findIndex((x: string) => x.trim().toLowerCase() === c.answer.trim().toLowerCase());
        const n = Number(c.answer);
        if (i >= 0) { fix(`${p}.answer`, `"${c.answer}" → choice ${i}`); c.answer = i; }
        else if (Number.isInteger(n)) c.answer = n;
      }
      plain(c, 'question', `${p}.question`);
      plain(c, 'explain', `${p}.explain`);
    }
    const out: Loose[] = [];
    (Array.isArray(b.actions) ? b.actions : []).forEach((a: Loose, k: number) => {
      if (!a || typeof a !== 'object') return;
      const p = `beats[${bi}].actions[${k}]`;
      if (a.do === undefined && typeof a.action === 'string') { a.do = a.action; delete a.action; }
      const alias = ACTION_ALIASES[a.do];
      if (alias) {
        if ((a.do === 'flash' || a.do === 'pulse') && a.hold === undefined) a.hold = false;
        fix(`${p}.do`, `"${a.do}" → "${alias}"`);
        a.do = alias;
      }
      if (a.target === undefined) {
        const alt = a.targets ?? a.id ?? a.ids ?? a.entity;
        if (alt !== undefined) { a.target = alt; delete a.targets; delete a.ids; delete a.entity; delete a.id; fix(`${p}.target`, 'taken from targets/id'); }
      }
      if (a.do === 'set' && typeof a.latex === 'string') {
        const restored = restoreLatex(a.latex);
        if (restored !== a.latex) { a.latex = restored; fix(`${p}.latex`, 'restored LaTeX backslashes eaten by JSON escapes'); }
      }
      if (a.do === 'annotate' || a.do === 'set') plain(a, 'text', `${p}.text`);
      if (a.do === 'connect') plain(a, 'label', `${p}.label`);
      if (a.do === 'move') {
        // rotate/turn written as their own action, or with "angle"/"degrees"/"rotate" for the turn
        const turn = a.turn ?? a.rotate ?? a.rotation ?? a.angle ?? a.degrees ?? a.angleDeg;
        if (a.turn === undefined && typeof turn === 'number') { a.turn = turn; fix(`${p}.turn`, 'taken from rotate/angle/degrees'); }
        delete a.rotate; delete a.rotation; delete a.angle; delete a.degrees; delete a.angleDeg;
        if (a.by === undefined && Array.isArray(a.offset ?? a.delta)) { a.by = a.offset ?? a.delta; fix(`${p}.by`, 'taken from offset/delta'); }
        delete a.offset; delete a.delta;
        if (a.about === undefined && Array.isArray(a.around ?? a.pivot ?? a.center)) { a.about = a.around ?? a.pivot ?? a.center; fix(`${p}.about`, 'taken from around/pivot/center'); }
        delete a.around; delete a.pivot; delete a.center;
      }
      if (a.do === 'rearrange') {
        const raw = a.into ?? a.to ?? a.as ?? a.layout ?? a.shape;
        delete a.to; delete a.as; delete a.layout; delete a.shape;
        const into = typeof raw === 'string' ? INTO_ALIASES[raw.toLowerCase()] : undefined;
        if (raw !== undefined && into !== raw) fix(`${p}.into`, into ? `"${raw}" → "${into}"` : `unknown "${raw}" → "strip"`);
        a.into = into ?? 'strip';
      }
      if (a.do === 'annotate' && a.side !== undefined && !SIDES.has(a.side)) {
        const mapped = SIDE_ALIASES[String(a.side).toLowerCase()];
        fix(`${p}.side`, mapped ? `"${a.side}" → "${mapped}"` : `dropped unknown side "${a.side}"`);
        if (mapped) a.side = mapped; else delete a.side;
      }
      if (a.do === 'set' && a.value === undefined && a.text === undefined && a.latex === undefined) {
        const alt = a.label ?? a.content ?? a.newValue ?? a.new_value ?? a.val ?? a.to;
        if (Array.isArray(a.to) && a.to.length === 2 && a.to.every((n: unknown) => typeof n === 'number')) {
          fix(`${p}.do`, '"set" with a position → "move"');
          a.do = 'move';
        } else if (typeof alt === 'number' || (typeof alt === 'string' && /[.[]/.test(String(a.target)))) {
          fix(`${p}.value`, 'taken from its label/to');
          a.value = alt;
        } else if (typeof alt === 'string') {
          fix(`${p}.text`, 'taken from its label/to');
          a.text = alt;
        } else if (a.state !== undefined) {
          fix(`${p}.do`, '"set" with only a state → "highlight"');
          a.do = 'highlight';
        } else {
          fix(p, 'dropped a "set" with nothing to set');
          return;
        }
      }
      if (a.do === 'highlight') {
        if (typeof a.hold === 'string') a.hold = a.hold === 'true';
        if (!STATES.has(a.state)) {
          const mapped = STATE_SYNONYMS[String(a.state ?? '').toLowerCase()] ?? 'active';
          fix(`${p}.state`, `"${a.state}" → "${mapped}"`);
          a.state = mapped;
        }
      }
      // spaces appear with their first entity — they are not action targets
      const dropSpaces = (t: unknown) => {
        if (typeof t === 'string' && spaceIds.has(t)) return undefined;
        if (Array.isArray(t)) {
          const kept = t.filter((x) => !(typeof x === 'string' && spaceIds.has(x)));
          if (kept.length === t.length) return t;
          return kept.length ? kept : undefined;
        }
        return t;
      };
      if (a.target !== undefined && ['create', 'remove', 'highlight', 'clear', 'focus'].includes(a.do)) {
        const kept = dropSpaces(a.target);
        if (kept !== a.target) {
          fix(`${p}.target`, 'removed a space id (spaces appear with their entities)');
          if (kept === undefined && a.do !== 'focus' && a.do !== 'clear') return; // nothing left to do
          if (kept === undefined) delete a.target; else a.target = kept;
        }
      }
      if (SINGLE_TARGET.has(a.do) && Array.isArray(a.target)) {
        fix(`${p}.target`, `split a list of ${a.target.length} targets into separate "${a.do}" actions`);
        a.target.forEach((t: unknown, j: number) => out.push({ ...a, target: t, ...(j > 0 ? { with: 'previous' } : {}) }));
        return;
      }
      out.push(a);
    });
    if (!out.length) { fix(`beats[${bi}]`, 'removed a beat with no actions'); return []; }
    b.actions = out;
    return [b];
  });

  declareHeapNodes(s, fix);
  return { value: s, fixes };
}

const refsOf = (a: Loose): string[] =>
  [a.target, a.a, a.b].flatMap((t) => (Array.isArray(t) ? t : [t])).filter((t): t is string => typeof t === 'string');

/**
 * A tree whose ids follow array-heap indexing (n1, n2 under n0; n3, n4 under n1 …)
 * has a known parent for any further index. When the beats create such a node
 * without declaring it (the classic "insert into a heap" slip), declare it with
 * that parent and the value pushed in the same beat. Otherwise the validator
 * sends it back to the model.
 */
function declareHeapNodes(s: Loose, fix: (path: string, message: string) => void) {
  s.entities.forEach((e: Loose, i: number) => {
    if (e?.type !== 'tree' || !Array.isArray(e.nodes) || !e.nodes.length) return;
    const m0 = /^(.*?)(\d+)$/.exec(String(e.nodes[0]?.id));
    if (!m0) return;
    const prefix = m0[1];
    const indexOf = (id: unknown) => {
      const m = /^(.*?)(\d+)$/.exec(String(id));
      return m && m[1] === prefix ? Number(m[2]) : -1;
    };
    const heapShaped = e.nodes.every((n: Loose) => {
      const k = indexOf(n?.id);
      if (k < 0) return false;
      return k === 0 ? !n.parent : n.parent === `${prefix}${Math.floor((k - 1) / 2)}`;
    });
    if (!heapShaped) return;
    const ids = new Set<string>(e.nodes.map((n: Loose) => n.id));
    s.beats.forEach((b: Loose) => {
      const actions: Loose[] = b.actions ?? [];
      for (const a of actions) {
        if (a.do !== 'create') continue;
        for (const ref of refsOf(a)) {
          if (!ref.startsWith(`${e.id}.`)) continue;
          const id = ref.slice(e.id.length + 1);
          const k = indexOf(id);
          const parent = `${prefix}${Math.floor((k - 1) / 2)}`;
          if (ids.has(id) || k <= 0 || !ids.has(parent)) continue;
          const pushed = actions.find((x) => ['push', 'insert', 'enqueue'].includes(x.do) && x.value !== undefined);
          const setOn = s.beats.flatMap((bb: Loose) => bb.actions ?? []).find((x: Loose) => x.do === 'set' && x.target === ref && (x.value ?? x.text) !== undefined);
          const value = pushed?.value ?? setOn?.value ?? setOn?.text;
          if (value === undefined) continue;
          e.nodes.push({ id, value, parent });
          ids.add(id);
          fix(`entities[${i}].nodes`, `declared "${id}" (value ${JSON.stringify(value)}, child of "${parent}") that the beats create`);
        }
      }
    });
  });
}
