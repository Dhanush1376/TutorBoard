/**
 * Scene parameters — one value the learner can change, everything that depends on it follows.
 *
 * A scene declares `params` (a value with min, max and an SI unit; a slider in
 * the lesson) and `derived` quantities computed from them (range, period…).
 * Entities use them in three ways:
 *   - any numeric field written as an expression string starting with "=":
 *     `"at": ["=R/2", "=H"]`, `"magnitude": "=v0/4"`, `"domain": [0, "=R"]`
 *   - plot/curve expressions name them: `"expr": "x*tan(theta0) - g*x^2/(2*v0^2*cos(theta0)^2)"`
 *   - text, LaTeX and labels show them: `"range {{R}} m"`, `{{T:2}}` (2 decimals)
 * `prepareParams` records every such use as a *binding* (entity id + field +
 * source) and `applyBindings` writes numbers in, so a resolved scene is plain
 * Scene Language v1 and any renderer can draw it; the client re-applies the
 * bindings when a slider moves. Angles: a parameter in degrees is shown in
 * degrees and enters expressions in radians (sin, cos…), except in fields that
 * are themselves in degrees (`angleDeg`, `degrees`, `turn`).
 */
import { compileExpr, parseExpr } from './expr.js';
import { dimOf, formatDim, parseUnit, sameDim, type Dim, type Unit } from './units.js';

export type ParamDef = { id: string; label?: string; value: number; min: number; max: number; step?: number; unit?: string };
export type DerivedDef = { id: string; expr: string; unit?: string; label?: string; digits?: number };
export type BindingDef = { id: string; field: string; kind: 'num' | 'expr' | 'text'; src: string };
type Issue = { path: string; message: string };
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const PARAM_LIMITS = { params: 6, derived: 12, bindings: 80 } as const;
const PARAM_ID = /^[A-Za-z][A-Za-z0-9]{0,15}$/;
const RESERVED = new Set(['x', 't', 'e', 'pi', 'theta', 'deg', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln', 'sqrt', 'abs', 'floor', 'ceil', 'sign']);
/** Fields whose numbers are degrees, so degree parameters enter them as degrees. */
const DEGREE_FIELD = /(^|\.)(angleDeg|degrees|turn)$/;
/** Fields that hold expressions of x / t and may name parameters. */
const EXPR_FIELDS = new Set(['expr', 'x', 'y', 'r']);
/** Fields whose text may show parameter values with {{id}}. */
const TEXT_FIELDS = new Set(['text', 'latex', 'label']);
const TEMPLATE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*(?::\s*(\d))?\s*\}\}/g;

export type ParamValues = Record<string, number>;
export type Evaluated = {
  /** what the learner sees: each parameter and derived quantity in its own unit (degrees stay degrees) */
  display: Map<string, number>;
  /** what expressions use: angles in radians */
  env: Record<string, number>;
  /** expressions for degree fields: degree parameters stay in degrees */
  degEnv: Record<string, number>;
  errors: Issue[];
};

const unitOf = (u?: string): Unit | null => { try { return parseUnit(u ?? ''); } catch { return null; } };
const isDeg = (u?: string) => unitOf(u)?.angle === 'deg';

/** Values at the defaults, overridden by `values` (clamped to each range). */
export function evaluateParams(params: ParamDef[], derived: DerivedDef[], values: ParamValues = {}): Evaluated {
  const display = new Map<string, number>();
  const env: Record<string, number> = {};
  const degEnv: Record<string, number> = {};
  const errors: Issue[] = [];
  params.forEach((p) => {
    const v = Math.min(p.max, Math.max(p.min, Number.isFinite(values[p.id]) ? values[p.id] : p.value));
    display.set(p.id, v);
    env[p.id] = isDeg(p.unit) ? (v * Math.PI) / 180 : v;
    degEnv[p.id] = v;
  });
  derived.forEach((d, i) => {
    let r = NaN;
    try { r = compileExpr(d.expr, 'x', env)(NaN); } catch (e) { errors.push({ path: `derived[${i}].expr`, message: `can't evaluate "${d.expr}": ${(e as Error).message}` }); return; }
    if (!Number.isFinite(r)) { errors.push({ path: `derived[${i}].expr`, message: `"${d.id}" = ${d.expr} is not a finite number with these values (${[...display].map(([k, v]) => `${k} = ${fmt(v)}`).join(', ')})` }); return; }
    env[d.id] = r;
    const shown = isDeg(d.unit) ? (r * 180) / Math.PI : r;
    display.set(d.id, shown);
    degEnv[d.id] = shown;
  });
  return { display, env, degEnv, errors };
}

/** 3 significant figures, or `digits` decimals. */
export function fmt(v: number, digits?: number): string {
  if (digits !== undefined) return v.toFixed(digits);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(2);
  return String(Number(v.toPrecision(3)));
}

const getPath = (o: Loose, path: string) => path.split('.').reduce<unknown>((x, k) => (x as Loose)?.[k], o);
const setPath = (o: Loose, path: string, v: unknown) => {
  const ks = path.split('.');
  const last = ks.pop()!;
  const parent = ks.reduce<Loose>((x, k) => x?.[k], o);
  if (parent) parent[last] = v;
};

const identsIn = (src: string, names: string[]) => {
  try { return parseExpr(src, 'x', names).filter((t) => t.t === 'id').map((t) => (t as { v: string }).v); } catch { return []; }
};

/** Every use of a parameter in the scene's entities, found from what the model wrote. */
export function extractBindings(scene: Loose, names: string[]): BindingDef[] {
  const out: BindingDef[] = [];
  const walk = (entityId: string, v: unknown, path: string) => {
    if (typeof v === 'string') {
      const key = path.split('.').pop()!;
      if (v.startsWith('=')) out.push({ id: entityId, field: path, kind: 'num', src: v });
      else if (EXPR_FIELDS.has(key) && identsIn(v, names).length) out.push({ id: entityId, field: path, kind: 'expr', src: v });
      else if (TEXT_FIELDS.has(key) && new RegExp(TEMPLATE.source).test(v)) out.push({ id: entityId, field: path, kind: 'text', src: v });
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(entityId, x, path ? `${path}.${i}` : String(i)));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'id' && k !== 'type' && k !== 'space') walk(entityId, x, path ? `${path}.${k}` : k);
  };
  for (const e of Array.isArray(scene.entities) ? scene.entities : []) if (e && typeof e.id === 'string') walk(e.id, e, '');
  return out;
}

/** Substitute values for parameter names in an expression, whole names only ("g" in "g*x", not in "sign"). */
function substitute(src: string, env: Record<string, number>): string {
  const names = Object.keys(env).sort((a, b) => b.length - a.length);
  if (!names.length) return src;
  const re = new RegExp(`(?<![A-Za-z0-9_])(${names.join('|')})(?![A-Za-z0-9_])`, 'g');
  return src.replace(re, (n) => `(${Number(env[n].toPrecision(12))})`);
}

/** A copy of `scene` with every binding's value written in. Bindings that fail are left as written and reported. */
export function applyBindings(scene: Loose, bindings: BindingDef[], ev: Evaluated, derived: DerivedDef[] = []): { scene: Loose; errors: Issue[] } {
  const out = JSON.parse(JSON.stringify(scene)) as Loose;
  const errors: Issue[] = [];
  const index = new Map<string, number>((out.entities ?? []).map((e: Loose, i: number) => [e?.id, i]));
  const digitsOf = new Map(derived.map((d) => [d.id, d.digits]));
  for (const b of bindings) {
    const i = index.get(b.id);
    if (i === undefined) continue; // the entity was removed (a doubt branch can drop entities)
    const e = out.entities[i];
    const path = `entities[${i}].${b.field}`;
    if (b.kind === 'num') {
      const deg = DEGREE_FIELD.test(b.field);
      let v = NaN;
      try { v = compileExpr(b.src.slice(1), 'x', deg ? ev.degEnv : ev.env)(NaN); } catch (err) { errors.push({ path, message: `can't evaluate "${b.src}": ${(err as Error).message}` }); continue; }
      if (!Number.isFinite(v)) { errors.push({ path, message: `"${b.src}" is not a finite number with the current values` }); continue; }
      setPath(e, b.field, Number(v.toPrecision(10)));
    } else if (b.kind === 'expr') {
      setPath(e, b.field, substitute(b.src, ev.env));
    } else {
      setPath(e, b.field, b.src.replace(TEMPLATE, (m, id: string, d?: string) => {
        const v = ev.display.get(id);
        if (v === undefined) { errors.push({ path, message: `{{${id}}} is not a parameter or derived quantity` }); return m; }
        return fmt(v, d !== undefined ? Number(d) : digitsOf.get(id));
      }));
    }
    if (getPath(e, b.field) === undefined) errors.push({ path, message: `field "${b.field}" not found` });
  }
  // a vector or line written as angle + length has its tip computed once (resolveGeometry); recompute it from the new values
  const touched = new Set(bindings.filter((b) => b.kind === 'num' && /^(angleDeg|magnitude|length|from\.[01])$/.test(b.field)).map((b) => b.id));
  for (const id of touched) {
    const e = out.entities[index.get(id)!];
    const len = e?.type === 'vector' ? e.magnitude : e?.length;
    if (!e || typeof e.angleDeg !== 'number' || typeof len !== 'number' || !Array.isArray(e.from) || typeof e.from[0] !== 'number') continue;
    const a = (e.angleDeg * Math.PI) / 180;
    e.to = [Number((e.from[0] + len * Math.cos(a)).toPrecision(10)), Number((e.from[1] + len * Math.sin(a)).toPrecision(10))];
  }
  return { scene: out, errors };
}

export type Prepared = {
  params: ParamDef[];
  derived: DerivedDef[];
  bindings: BindingDef[];
  /** structural, unit and dimension problems — the scene can't be used until they are fixed */
  errors: Issue[];
};

/**
 * Read a scene's parameters: shape, ids, ranges, SI units, derived quantities,
 * every binding, and dimensional consistency (derived units, axis units,
 * sums of unlike quantities). Returns null when the scene has none.
 */
export function prepareParams(scene: Loose): Prepared | null {
  const rawParams = Array.isArray(scene?.params) ? scene.params : [];
  const rawDerived = Array.isArray(scene?.derived) ? scene.derived : [];
  const given: BindingDef[] = Array.isArray(scene?.bindings) ? scene.bindings : [];
  const hasEq = JSON.stringify(scene?.entities ?? []).includes('"=');
  if (!rawParams.length && !rawDerived.length && !given.length && !hasEq) return null;
  const errors: Issue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });

  if (rawParams.length > PARAM_LIMITS.params) err('params', `at most ${PARAM_LIMITS.params} parameters`);
  if (rawDerived.length > PARAM_LIMITS.derived) err('derived', `at most ${PARAM_LIMITS.derived} derived quantities`);
  const ids = new Set<string>();
  const checkId = (id: unknown, path: string) => {
    if (typeof id !== 'string' || !PARAM_ID.test(id)) { err(path, 'a parameter id is letters then letters/digits, e.g. "v0", "theta0", "k"'); return false; }
    if (RESERVED.has(id)) { err(path, `"${id}" is reserved in expressions — name it e.g. "${id}0"`); return false; }
    if (ids.has(id)) { err(path, `duplicate id "${id}"`); return false; }
    ids.add(id);
    return true;
  };
  const dims: Record<string, Dim> = {};
  const unitCheck = (u: unknown, path: string): Unit | null => {
    if (u !== undefined && typeof u !== 'string') { err(path, 'unit is a string like "m/s"'); return null; }
    let unit: Unit;
    try { unit = parseUnit(u ?? ''); } catch (e) { err(path, (e as Error).message); return null; }
    if (!unit.angle && Math.abs(unit.scale - 1) > 1e-12) { err(path, `use SI units in parameters ("${u}" is ${unit.scale}× the SI unit) — show other units in the text instead`); return null; }
    return unit;
  };

  const params: ParamDef[] = [];
  rawParams.slice(0, PARAM_LIMITS.params).forEach((p: Loose, i: number) => {
    const path = `params[${i}]`;
    if (!p || typeof p !== 'object') { err(path, 'a parameter is { "id", "value", "min", "max", "unit" }'); return; }
    if (!checkId(p.id, `${path}.id`)) return;
    const nums = ['value', 'min', 'max'].map((k) => p[k]);
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) { err(path, '"value", "min" and "max" must be numbers'); return; }
    const [value, min, max] = nums as number[];
    if (min > max) err(`${path}.min`, 'min must not exceed max');
    else if (value < min || value > max) err(`${path}.value`, `the value ${value} is outside [${min}, ${max}]`);
    if (p.step !== undefined && !(typeof p.step === 'number' && p.step > 0)) err(`${path}.step`, 'step must be a positive number');
    if (p.label !== undefined && (typeof p.label !== 'string' || p.label.length > 40)) err(`${path}.label`, 'label is a short string');
    const unit = unitCheck(p.unit, `${path}.unit`);
    if (unit) dims[p.id] = unit.dim;
    params.push({ id: p.id, value, min, max, ...(p.step ? { step: p.step } : {}), unit: p.unit ?? '', ...(p.label ? { label: p.label } : {}) });
  });

  const derived: DerivedDef[] = [];
  rawDerived.slice(0, PARAM_LIMITS.derived).forEach((d: Loose, i: number) => {
    const path = `derived[${i}]`;
    if (!d || typeof d !== 'object' || typeof d.expr !== 'string' || d.expr.length > 160) { err(path, 'a derived quantity is { "id", "expr", "unit" }'); return; }
    if (!checkId(d.id, `${path}.id`)) return;
    const known = Object.keys(dims);
    const used = identsIn(d.expr, [...params.map((p) => p.id), ...derived.map((x) => x.id)]);
    try { parseExpr(d.expr, 'x', [...params.map((p) => p.id), ...derived.map((x) => x.id)]); } catch (e) { err(`${path}.expr`, `can't read "${d.expr}": ${(e as Error).message}${/\b[a-zA-Z]\w*\b/.test(d.expr) ? ' — use only parameters declared above it' : ''}`); return; }
    if (/(?<![A-Za-z0-9_])x(?![A-Za-z0-9_])/.test(d.expr)) { err(`${path}.expr`, 'a derived quantity is a number, not a function of x'); return; }
    const unit = unitCheck(d.unit, `${path}.unit`);
    const got = dimOf(d.expr, Object.fromEntries(known.map((k) => [k, dims[k]])));
    got.problems.forEach((m) => err(`${path}.expr`, `in "${d.id}" = ${d.expr}: ${m}`));
    if (unit && got.dim && !got.problems.length && !sameDim(unit.dim, got.dim)) {
      err(`${path}.unit`, `"${d.id}" = ${d.expr} works out in ${formatDim(got.dim)}${used.length ? ` (from ${used.map((u) => `${u}: ${formatDim(dims[u])}`).join(', ')})` : ''}, but its unit "${d.unit ?? ''}" is ${formatDim(unit.dim)}`);
    }
    if (unit) dims[d.id] = d.unit ? unit.dim : (got.dim ?? unit.dim);
    derived.push({ id: d.id, expr: d.expr, unit: d.unit ?? '', ...(d.label ? { label: d.label } : {}), ...(Number.isInteger(d.digits) ? { digits: d.digits } : {}) });
  });

  const names = [...params.map((p) => p.id), ...derived.map((d) => d.id)];
  const found = extractBindings(scene, names);
  const seen = new Set(found.map((b) => `${b.id}|${b.field}`));
  const bindings = [...found, ...given.filter((b) => b && !seen.has(`${b.id}|${b.field}`))].slice(0, PARAM_LIMITS.bindings);
  if (found.length + given.length > PARAM_LIMITS.bindings) err('entities', `at most ${PARAM_LIMITS.bindings} parameter uses`);

  // dimensions of what entities compute, against their space's axis units
  const spaceUnits = new Map<string, { x: Dim | null; y: Dim | null }>();
  for (const s of Array.isArray(scene.spaces) ? scene.spaces : []) {
    const read = (u: unknown) => { if (typeof u !== 'string') return null; try { return parseUnit(u).dim; } catch { return null; } };
    if (s && typeof s.id === 'string') spaceUnits.set(s.id, { x: read(s.xUnit), y: read(s.yUnit) });
  }
  const entityIndex = new Map<string, number>((scene.entities ?? []).map((e: Loose, i: number) => [e?.id, i]));
  for (const b of bindings) {
    const i = entityIndex.get(b.id);
    if (i === undefined) continue;
    const e = scene.entities[i];
    const path = `entities[${i}].${b.field}`;
    const axes = spaceUnits.get(e?.space) ?? { x: null, y: null };
    if (b.kind === 'text') {
      for (const m of b.src.matchAll(new RegExp(TEMPLATE.source, 'g'))) if (!names.includes(m[1])) err(path, `{{${m[1]}}} is not a parameter or derived quantity (${names.join(', ') || 'none declared'})`);
      continue;
    }
    if (b.kind === 'expr') {
      const variable = e?.type === 'curve' ? 't' : 'x';
      try { parseExpr(b.src, variable, names); } catch (er) { err(path, `can't read "${b.src}": ${(er as Error).message}`); continue; }
      const r = dimOf(b.src, dims, variable === 'x' ? axes.x : null, variable);
      r.problems.forEach((m) => err(path, `in ${b.src}: ${m}`));
      if (e?.type === 'plot' && axes.y && r.dim && !r.problems.length && !sameDim(r.dim, axes.y)) {
        err(path, `${b.src} works out in ${formatDim(r.dim)} but the y axis of "${e.space}" is in ${formatDim(axes.y)} — check the formula, or write constants like g as parameters with units`);
      }
      continue;
    }
    // "=expr" in a numeric field
    if (/^(at|from|to|vertex)\.[A-Za-z]/.test(b.field)) {
      err(path, `parameters can't go inside a geometry-by-intent object ("${b.field}") — write the coordinates themselves as expressions, e.g. "at": ["=R/2", "=H"]`);
      continue;
    }
    const src = b.src.slice(1);
    try { parseExpr(src, 'x', names); } catch (er) { err(path, `can't read "${b.src}": ${(er as Error).message}`); continue; }
    if (/(?<![A-Za-z0-9_])x(?![A-Za-z0-9_])/.test(src)) { err(path, `"${b.src}" can only use parameters and numbers, not x`); continue; }
    const r = dimOf(src, dims);
    r.problems.forEach((m) => err(path, `in ${b.src}: ${m}`));
    const last = b.field.split('.');
    const axis = DEGREE_FIELD.test(b.field) || last[0] === 'magnitude' ? null
      : /^(at|from|to|domain)$/.test(last[0]) && last[1] === '0' ? 'x'
      : /^(at|from|to)$/.test(last[0]) && last[1] === '1' ? 'y'
      : last[0] === 'domain' ? 'x' : last[0] === 'x' ? 'x' : last[0] === 'y' ? 'y' : null;
    const want = axis ? axes[axis] : DEGREE_FIELD.test(b.field) ? [0, 0, 0, 0, 0, 0] as Dim : null;
    if (want && r.dim && !r.problems.length && !sameDim(r.dim, want)) {
      err(path, `${b.src} works out in ${formatDim(r.dim)} but ${axis ? `the ${axis} axis of "${e.space}" is in ${formatDim(want)}` : 'an angle is dimensionless'}`);
    }
  }
  return { params, derived, bindings, errors };
}

/** Each parameter's extremes (one at a time, others at their defaults), for checking that the scene holds across the sliders. */
export function sweepValues(params: ParamDef[]): { values: ParamValues; label: string }[] {
  const out: { values: ParamValues; label: string }[] = [];
  for (const p of params) {
    if (p.min === p.max) continue;
    for (const [v, which] of [[p.min, 'minimum'], [p.max, 'maximum']] as const) {
      if (v === p.value) continue;
      out.push({ values: { [p.id]: v }, label: `${p.label ?? p.id} = ${fmt(v)}${p.unit ? ` ${p.unit}` : ''} (its ${which})` });
    }
  }
  const sliders = params.filter((p) => p.min !== p.max);
  if (sliders.length > 1) {
    out.push({ values: Object.fromEntries(sliders.map((p) => [p.id, p.min])), label: 'every slider at its minimum' });
    out.push({ values: Object.fromEntries(sliders.map((p) => [p.id, p.max])), label: 'every slider at its maximum' });
  }
  return out;
}

/** Resolve a scene for drawing: parameters at `values` (defaults otherwise). Scenes without parameters come back unchanged. */
export function resolveParams(scene: Loose, values: ParamValues = {}): Loose {
  const prep = prepareParams(scene);
  if (!prep) return scene;
  const ev = evaluateParams(prep.params, prep.derived, values);
  const applied = applyBindings(scene, prep.bindings, ev, prep.derived).scene;
  return { ...applied, params: prep.params, derived: prep.derived, bindings: prep.bindings };
}

