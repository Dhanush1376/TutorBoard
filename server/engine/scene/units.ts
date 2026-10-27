/**
 * Units and dimensional analysis for scene parameters — shared by the validator and the client.
 *
 * A unit string ("m/s^2", "kg·m/s", "N", "deg") parses to a dimension over the
 * SI base units plus a scale to SI. Expressions are checked by walking their
 * RPN with the dimension of every parameter: adding metres to seconds, taking
 * sin of a length, or declaring a derived quantity in the wrong unit is an
 * error the model can repair. Angles (deg, rad) are dimensionless; a
 * parameter in degrees is converted to radians wherever an expression uses it.
 */
import { parseExpr, type RpnTok } from './expr.js';

/** Exponents of m, kg, s, A, K, mol. */
export type Dim = [number, number, number, number, number, number];
export type Unit = { dim: Dim; scale: number; angle?: 'deg' | 'rad' };

const BASE = ['m', 'kg', 's', 'A', 'K', 'mol'] as const;
const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0): Dim => [m, kg, s, A, K, mol];
const NONE = D();

/** Named units: dimension and scale to SI. */
const UNITS: Record<string, Unit> = {
  m: { dim: D(1), scale: 1 }, km: { dim: D(1), scale: 1e3 }, cm: { dim: D(1), scale: 1e-2 }, mm: { dim: D(1), scale: 1e-3 }, nm: { dim: D(1), scale: 1e-9 },
  kg: { dim: D(0, 1), scale: 1 }, g: { dim: D(0, 1), scale: 1e-3 },
  s: { dim: D(0, 0, 1), scale: 1 }, ms: { dim: D(0, 0, 1), scale: 1e-3 }, min: { dim: D(0, 0, 1), scale: 60 }, h: { dim: D(0, 0, 1), scale: 3600 },
  A: { dim: D(0, 0, 0, 1), scale: 1 }, K: { dim: D(0, 0, 0, 0, 1), scale: 1 }, mol: { dim: D(0, 0, 0, 0, 0, 1), scale: 1 },
  N: { dim: D(1, 1, -2), scale: 1 }, J: { dim: D(2, 1, -2), scale: 1 }, W: { dim: D(2, 1, -3), scale: 1 },
  Pa: { dim: D(-1, 1, -2), scale: 1 }, Hz: { dim: D(0, 0, -1), scale: 1 }, C: { dim: D(0, 0, 1, 1), scale: 1 },
  V: { dim: D(2, 1, -3, -1), scale: 1 }, ohm: { dim: D(2, 1, -3, -2), scale: 1 }, 'Ω': { dim: D(2, 1, -3, -2), scale: 1 },
  F: { dim: D(-2, -1, 4, 2), scale: 1 }, T: { dim: D(0, 1, -2, -1), scale: 1 }, H: { dim: D(2, 1, -2, -2), scale: 1 },
  L: { dim: D(3), scale: 1e-3 },
  rad: { dim: NONE, scale: 1, angle: 'rad' }, deg: { dim: NONE, scale: 1, angle: 'deg' }, '°': { dim: NONE, scale: 1, angle: 'deg' },
  '%': { dim: NONE, scale: 0.01 },
};
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

/** Parse "m/s^2", "kg·m²/s", "N m", "1/s", "" (dimensionless). Throws on an unknown unit. */
export function parseUnit(src: string): Unit {
  const s = src.trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^${[...m].map((c) => SUP[c]).join('')}`).replace(/\s*[·*×]\s*|\s+/g, '*');
  if (!s || s === '1') return { dim: [...NONE] as Dim, scale: 1 };
  const out: Unit = { dim: [...NONE] as Dim, scale: 1 };
  let sign = 1;
  for (const part of s.split(/(\/)/)) {
    if (part === '/') { sign = -1; continue; }
    for (const f of part.split('*').filter(Boolean)) {
      const m = /^([A-Za-zΩ°%]+|1)(?:\^?(-?\d+))?$/.exec(f);
      if (!m) throw new Error(`can't read unit "${f}"`);
      if (m[1] === '1') continue;
      const u = UNITS[m[1]];
      if (!u) throw new Error(`unknown unit "${m[1]}" (use SI: m, kg, s, N, J, W, Pa, Hz, V, A, ohm, C, F, K, mol, deg, rad)`);
      const p = (m[2] ? Number(m[2]) : 1) * sign;
      u.dim.forEach((d, i) => { out.dim[i] += d * p; });
      out.scale *= u.scale ** p;
      if (u.angle) out.angle = u.angle;
    }
  }
  return out;
}

export const sameDim = (a: Dim, b: Dim) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
export const isNone = (a: Dim) => sameDim(a, NONE);

/** "m·s⁻²"-style text for a dimension (for messages). */
export function formatDim(d: Dim): string {
  if (isNone(d)) return 'dimensionless';
  const up = BASE.map((b, i) => [b, d[i]] as const).filter(([, p]) => p > 0).map(([b, p]) => (p === 1 ? b : `${b}^${fmtP(p)}`));
  const down = BASE.map((b, i) => [b, d[i]] as const).filter(([, p]) => p < 0).map(([b, p]) => (p === -1 ? b : `${b}^${fmtP(-p)}`));
  return `${up.join('·') || '1'}${down.length ? `/${down.length > 1 ? `(${down.join('·')})` : down[0]}` : ''}`;
}
const fmtP = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(2));

type Item = { dim: Dim | null; val: number | null };
const DIMLESS_FNS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'ln', 'log']);

/**
 * Dimension of an expression, given each identifier's dimension (`x` → `xDim`,
 * null = unknown, which makes the result unknown rather than wrong). Numbers
 * are dimensionless. Returns the dimension (or null) and the problems found.
 */
export function dimOf(src: string, idents: Record<string, Dim>, xDim: Dim | null = null, variable: 'x' | 't' = 'x'): { dim: Dim | null; problems: string[] } {
  let rpn: RpnTok[];
  try { rpn = parseExpr(src, variable, Object.keys(idents)); } catch (e) { return { dim: null, problems: [(e as Error).message] }; }
  const problems: string[] = [];
  const st: Item[] = [];
  const name = (it: Item) => (it.dim ? formatDim(it.dim) : 'unknown');
  for (const tok of rpn) {
    if (tok.t === 'num') st.push({ dim: [...NONE] as Dim, val: tok.v });
    else if (tok.t === 'x') st.push({ dim: xDim, val: null });
    else if (tok.t === 'id') st.push({ dim: idents[tok.v] ?? null, val: null });
    else if (tok.t === 'fn') {
      const a = st.pop()!;
      if (DIMLESS_FNS.has(tok.v)) {
        if (a.dim && !isNone(a.dim)) problems.push(`${tok.v}() needs a dimensionless argument (an angle or a ratio), got ${name(a)}`);
        st.push({ dim: [...NONE] as Dim, val: null });
      } else if (tok.v === 'sqrt') st.push({ dim: a.dim ? (a.dim.map((d) => d / 2) as Dim) : null, val: null });
      else st.push({ dim: a.dim, val: null }); // abs floor ceil sign keep the dimension
    } else if (tok.t === 'op') {
      if (tok.v === 'neg') { const a = st.pop()!; st.push({ dim: a.dim, val: a.val === null ? null : -a.val }); continue; }
      const b = st.pop()!, a = st.pop()!;
      const val = a.val !== null && b.val !== null
        ? (tok.v === '+' ? a.val + b.val : tok.v === '-' ? a.val - b.val : tok.v === '*' ? a.val * b.val : tok.v === '/' ? a.val / b.val : a.val ** b.val)
        : null;
      if (tok.v === '+' || tok.v === '-') {
        if (a.dim && b.dim && !sameDim(a.dim, b.dim)) problems.push(`can't ${tok.v === '+' ? 'add' : 'subtract'} ${name(b)} ${tok.v === '+' ? 'to' : 'from'} ${name(a)}`);
        st.push({ dim: a.dim && b.dim ? a.dim : null, val });
      } else if (tok.v === '*' || tok.v === '/') {
        const k = tok.v === '*' ? 1 : -1;
        st.push({ dim: a.dim && b.dim ? (a.dim.map((d, i) => d + k * b.dim![i]) as Dim) : null, val });
      } else { // ^
        if (b.dim && !isNone(b.dim)) problems.push(`an exponent must be dimensionless, got ${name(b)}`);
        if (a.dim && isNone(a.dim)) st.push({ dim: a.dim, val });
        else if (a.dim && b.val !== null) st.push({ dim: a.dim.map((d) => d * b.val!) as Dim, val });
        else {
          if (a.dim) problems.push(`${name(a)} raised to a power that isn't a fixed number`);
          st.push({ dim: null, val });
        }
      }
    }
  }
  return { dim: st.length === 1 ? st[0].dim : null, problems };
}
