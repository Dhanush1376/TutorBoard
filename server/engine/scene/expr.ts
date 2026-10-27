/**
 * Safe plot expressions — shared by the server validator and the client renderer.
 *
 * `compileExpr` turns a function of x into a callable without eval/new
 * Function (model output is untrusted text). Supports numbers, x, + - * / ^,
 * parentheses, unary minus, implicit multiplication (4x, 2(x+1), (x-1)(x-3)),
 * constants pi/π/e, a degree suffix (45deg, 45°) and
 * sin cos tan asin acos atan sinh cosh tanh exp log ln sqrt abs floor ceil sign.
 *
 * `samplePlot` evaluates a function over a domain for drawing: it refines where
 * the curve is steep and breaks the curve at poles and jumps instead of joining
 * them with a straight line (tan x, 1/x, floor x).
 */

type Tok = { t: 'num'; v: number } | { t: 'x' } | { t: 'id'; v: string } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: '(' } | { t: ')' } | { t: 'deg' };
/** Postfix form of an expression: what the evaluator and the dimension checker walk. */
export type RpnTok = Exclude<Tok, { t: '(' } | { t: ')' } | { t: 'deg' }>;

const FNS: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, log: Math.log10, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
};
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4, 'neg': 3 };

/** The free variable: x for y = f(x), t for parametric curves (θ / theta are accepted as t, for polar r(θ)). */
export type Variable = 'x' | 't';
const VAR_WORDS: Record<Variable, string[]> = { x: ['x'], t: ['theta', 't'] };

function tokenize(src: string, v: Variable, idents: string[] = []): Tok[] {
  const byLength = [...idents].sort((a, b) => b.length - a.length);
  const s = src.replace(/θ/g, v === 't' ? 't' : 'θ').replace(/\s+/g, '').replace(/[·×]/g, '*').replace(/−/g, '-').replace(/\*\*/g, '^').replace(/²/g, '^2').replace(/³/g, '^3');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(`bad number ${s.slice(i, j)}`);
      out.push({ t: 'num', v });
      i = j;
    } else if (c === 'π') { out.push({ t: 'num', v: Math.PI }); i++; }
    else if (c === '°') { out.push({ t: 'deg' }); i++; }
    else if (/[a-z]/i.test(c) && byLength.some((id) => s.startsWith(id, i) && !/[A-Za-z0-9_]/.test(s[i + id.length] ?? ''))) {
      // a named parameter ("v0", "theta0", "g")
      const id = byLength.find((w) => s.startsWith(w, i) && !/[A-Za-z0-9_]/.test(s[i + w.length] ?? ''))!;
      out.push({ t: 'id', v: id });
      i += id.length;
    } else if (/[a-z]/i.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-z]/i.test(s[j])) j++;
      let word = s.slice(i, j).toLowerCase();
      const emit = (w: string) => {
        if (FNS[w]) out.push({ t: 'fn', v: w });
        else if (w === 'pi') out.push({ t: 'num', v: Math.PI });
        else if (w === 'e') out.push({ t: 'num', v: Math.E });
        else if (VAR_WORDS[v].includes(w)) out.push({ t: 'x' });
        else if (w === 'deg') out.push({ t: 'deg' });
        else return false;
        return true;
      };
      if (!emit(word)) {
        // "xx", "xpi", "2tpi": split into known pieces greedily
        const pieces: string[] = [];
        const known = ['asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'floor', 'ceil', 'sign', 'sqrt', 'sin', 'cos', 'tan', 'exp', 'log', 'abs', 'deg', 'pi', 'ln', ...VAR_WORDS[v], 'e'];
        while (word) {
          const hit = known.find((w) => word.startsWith(w));
          if (!hit) throw new Error(`unknown symbol ${s.slice(i, j)}`);
          pieces.push(hit);
          word = word.slice(hit.length);
        }
        pieces.forEach(emit);
      }
      i = j;
    } else if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else if (c === '(') { out.push({ t: '(' }); i++; }
    else if (c === ')') { out.push({ t: ')' }); i++; }
    else throw new Error(`unexpected "${c}"`);
  }
  // degrees: "45deg" → (45 * π/180), binding tighter than anything else
  const withDeg: Tok[] = [];
  for (const tok of out) {
    if (tok.t !== 'deg') { withDeg.push(tok); continue; }
    const prev = withDeg[withDeg.length - 1];
    if (!prev || (prev.t !== 'num' && prev.t !== 'x' && prev.t !== 'id' && prev.t !== ')')) throw new Error('"deg" must follow a number, e.g. 45deg');
    if (prev.t === 'num') withDeg[withDeg.length - 1] = { t: 'num', v: (prev.v * Math.PI) / 180 };
    else withDeg.push({ t: 'op', v: '*' }, { t: 'num', v: Math.PI / 180 });
  }
  // implicit multiplication: 4x, 2(, )(, )x, x(, x2
  const res: Tok[] = [];
  for (const tok of withDeg) {
    const prev = res[res.length - 1];
    const prevEndsValue = prev && (prev.t === 'num' || prev.t === 'x' || prev.t === 'id' || prev.t === ')');
    const startsValue = tok.t === 'num' || tok.t === 'x' || tok.t === 'id' || tok.t === '(' || tok.t === 'fn';
    if (prevEndsValue && startsValue) res.push({ t: 'op', v: '*' });
    res.push(tok);
  }
  return res;
}

/** Parse to postfix; `idents` are extra names (scene parameters) allowed in the expression. Throws on malformed input. */
export function parseExpr(src: string, v: Variable = 'x', idents: string[] = []): RpnTok[] {
  const body = String(src).split('=').pop() || ''; // accept "y = ..." / "f(x) = ..."
  const toks = tokenize(body, v, idents);
  if (!toks.length) throw new Error('empty expression');
  const rpn: Tok[] = [];
  const stack: Tok[] = [];
  let prevValue = false;
  let depth = 0;
  for (const tok of toks) {
    if (tok.t === 'num' || tok.t === 'x' || tok.t === 'id') { rpn.push(tok); prevValue = true; }
    else if (tok.t === 'fn') { stack.push(tok); prevValue = false; }
    else if (tok.t === '(') { stack.push(tok); depth++; prevValue = false; }
    else if (tok.t === ')') {
      if (--depth < 0) throw new Error('unbalanced ")"');
      while (stack.length && stack[stack.length - 1].t !== '(') rpn.push(stack.pop()!);
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === 'fn') rpn.push(stack.pop()!);
      prevValue = true;
    } else if (tok.t === 'op') {
      const op = tok.v === '-' && !prevValue ? 'neg' : tok.v;
      if (op === '+' && !prevValue) continue; // unary plus
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t !== 'op') break;
        const pTop = PREC[top.v];
        const pCur = PREC[op];
        if (pTop > pCur || (pTop === pCur && op !== '^' && op !== 'neg')) rpn.push(stack.pop()!);
        else break;
      }
      stack.push({ t: 'op', v: op });
      prevValue = false;
    }
  }
  if (depth !== 0) throw new Error('unbalanced "("');
  while (stack.length) rpn.push(stack.pop()!);

  // dry run: the expression must reduce to exactly one value
  let height = 0;
  for (const tok of rpn) {
    if (tok.t === 'num' || tok.t === 'x' || tok.t === 'id') height++;
    else if (tok.t === 'op' && tok.v !== 'neg') height--;
    if (height < 1) throw new Error('an operator is missing an operand');
  }
  if (height !== 1) throw new Error('malformed expression');
  return rpn as RpnTok[];
}

/** Compile to a function of x (or t); `env` gives values to named parameters. Throws on malformed input. */
export function compileExpr(src: string, v: Variable = 'x', env: Record<string, number> = {}): (x: number) => number {
  const rpn = parseExpr(src, v, Object.keys(env));
  return (x: number) => {
    const st: number[] = [];
    for (const tok of rpn) {
      if (tok.t === 'num') st.push(tok.v);
      else if (tok.t === 'x') st.push(x);
      else if (tok.t === 'id') st.push(env[tok.v]);
      else if (tok.t === 'fn') st.push(FNS[tok.v](st.pop()!));
      else if (tok.t === 'op') {
        if (tok.v === 'neg') { st.push(-st.pop()!); continue; }
        const b = st.pop()!;
        const a = st.pop()!;
        st.push(tok.v === '+' ? a + b : tok.v === '-' ? a - b : tok.v === '*' ? a * b : tok.v === '/' ? a / b : Math.pow(a, b));
      }
    }
    return st.length === 1 ? st[0] : NaN;
  };
}

/** Why `compileExpr` rejects an expression, or null if it compiles. */
export function exprError(src: string, v: Variable = 'x'): string | null {
  try { compileExpr(src, v); return null; } catch (e) { return (e as Error).message; }
}

export type PlotSample = {
  /** continuous pieces of the curve, in domain units, clipped to the visible y range */
  segments: [number, number][][];
  /** x positions where the curve was broken at a pole or jump */
  breaks: number[];
  /** share of the domain where the function is defined and inside the visible y range (0–1) */
  visible: number;
};

/**
 * Sample f over [x0, x1] for drawing inside the y range [y0, y1].
 * Steep stretches are bisected (up to `maxDepth`); a jump that does not shrink
 * under bisection is a discontinuity and breaks the curve. Where the curve
 * leaves the visible range it is cut at the edge, so it reaches the frame.
 */
export type SampleOpts = { samples?: number; maxDepth?: number; xLog?: boolean; yLog?: boolean };

const log10 = (v: number) => (v > 0 ? Math.log10(v) : NaN);

export function samplePlot(
  f: (x: number) => number,
  domain: [number, number],
  yRange: [number, number],
  opts: SampleOpts = {},
): PlotSample {
  if (!opts.xLog && !opts.yLog) return sampleLinear(f, domain, yRange, opts);
  // on a log axis, sample and judge steepness in log units, then map back
  const X = (u: number) => (opts.xLog ? 10 ** u : u);
  const g = (u: number) => { const y = f(X(u)); return opts.yLog ? log10(y) : y; };
  const fwdX = (x: number) => (opts.xLog ? log10(x) : x);
  const fwdY = (y: number) => (opts.yLog ? log10(y) : y);
  const s = sampleLinear(g, [fwdX(domain[0]), fwdX(domain[1])], [fwdY(yRange[0]), fwdY(yRange[1])], opts);
  return {
    segments: s.segments.map((seg) => seg.map(([u, w]) => [X(u), opts.yLog ? 10 ** w : w] as [number, number])),
    breaks: s.breaks.map(X),
    visible: s.visible,
  };
}

function sampleLinear(
  f: (x: number) => number,
  [x0, x1]: [number, number],
  [y0, y1]: [number, number],
  opts: SampleOpts = {},
): PlotSample {
  const N = opts.samples ?? 240;
  const maxDepth = opts.maxDepth ?? 10;
  const span = y1 - y0;
  const lo = y0 - span * 0.02;
  const hi = y1 + span * 0.02;
  const steep = span * 0.04; // refine when one step moves more than 4% of the frame
  const ev = (x: number) => { const y = f(x); return Number.isFinite(y) ? y : NaN; };

  // 1 — adaptive point list, with NaN markers where the curve must break
  const pts: [number, number][] = [];
  const breaks: number[] = [];
  const BREAK: [number, number] = [NaN, NaN];
  const refine = (xa: number, ya: number, xb: number, yb: number, depth: number) => {
    const bothFinite = Number.isFinite(ya) && Number.isFinite(yb);
    const jump = bothFinite ? Math.abs(yb - ya) : 0;
    const offSameSide = bothFinite && ((ya > hi && yb > hi) || (ya < lo && yb < lo));
    const needs = bothFinite ? jump > steep && !offSameSide : Number.isFinite(ya) !== Number.isFinite(yb);
    if (!needs) { pts.push([xb, yb]); return; }
    if (depth >= maxDepth) {
      // still a big step after many halvings: a pole or a jump, not a steep curve
      if (bothFinite) { pts.push(BREAK); breaks.push((xa + xb) / 2); }
      pts.push([xb, yb]);
      return;
    }
    const xm = (xa + xb) / 2;
    const ym = ev(xm);
    refine(xa, ya, xm, ym, depth + 1);
    refine(xm, ym, xb, yb, depth + 1);
  };
  let xa = x0;
  let ya = ev(xa);
  pts.push([xa, ya]);
  for (let i = 1; i <= N; i++) {
    const xb = x0 + ((x1 - x0) * i) / N;
    const yb = ev(xb);
    refine(xa, ya, xb, yb, 0);
    xa = xb; ya = yb;
  }

  // 2 — split into visible segments, cutting at the frame edge
  const segments: [number, number][][] = [];
  let cur: [number, number][] = [];
  const close = () => { if (cur.length > 1) segments.push(cur); cur = []; };
  const inside = (y: number) => y >= lo && y <= hi;
  let visibleX = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, y] = pts[k];
    const prev = k ? pts[k - 1] : null;
    if (!Number.isFinite(y)) { close(); continue; }
    if (prev && Number.isFinite(prev[1]) && inside(prev[1]) && inside(y)) visibleX += x - prev[0];
    if (inside(y)) {
      if (!cur.length && prev && Number.isFinite(prev[1]) && !inside(prev[1])) {
        const edge = prev[1] > hi ? hi : lo;
        const t = (edge - prev[1]) / (y - prev[1]);
        cur.push([prev[0] + t * (x - prev[0]), edge]);
      }
      cur.push([x, y]);
    } else if (cur.length && prev && Number.isFinite(prev[1]) && inside(prev[1])) {
      const edge = y > hi ? hi : lo;
      const t = (edge - prev[1]) / (y - prev[1]);
      cur.push([prev[0] + t * (x - prev[0]), edge]);
      close();
    } else close();
  }
  close();
  return { segments, breaks, visible: x1 > x0 ? Math.min(1, visibleX / (x1 - x0)) : 0 };
}

/** Map a domain value to 0–1 across the frame, honouring a log scale. */
export const frameFraction = (v: number, [a, b]: [number, number], log = false) =>
  log ? (log10(v) - log10(a)) / (log10(b) - log10(a)) : (v - a) / (b - a);

/** Clip a polyline (frame units 0–1, NaN = break) to the unit square with a small margin; returns visible pieces. */
function clipToFrame(pts: [number, number][], m = 0.02): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  const close = () => { if (cur.length > 1) out.push(cur); cur = []; };
  const lo = -m, hi = 1 + m;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    if (![ax, ay, bx, by].every(Number.isFinite)) { close(); continue; }
    // Liang–Barsky
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const edges: [number, number][] = [[-dx, ax - lo], [dx, hi - ax], [-dy, ay - lo], [dy, hi - ay]];
    let inside = true;
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) { inside = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { inside = false; break; } if (r > t0) t0 = r; }
      else { if (r < t0) { inside = false; break; } if (r < t1) t1 = r; }
    }
    if (!inside) { close(); continue; }
    const s: [number, number] = [ax + t0 * dx, ay + t0 * dy];
    const e: [number, number] = [ax + t1 * dx, ay + t1 * dy];
    if (t0 > 0 || !cur.length) { close(); cur.push(s); }
    cur.push(e);
    if (t1 < 1) close();
  }
  close();
  return out;
}

/**
 * Sample a parametric curve (x(t), y(t)) — polar r(θ) is the same with
 * x = r cos θ, y = r sin θ — for a frame with the given ranges. Steps that
 * move far across the frame are bisected; ones that stay big are breaks.
 * Returns visible pieces in domain units and the share of t on screen.
 */
export function sampleCurve(
  fx: (t: number) => number,
  fy: (t: number) => number,
  [t0, t1]: [number, number],
  xRange: [number, number],
  yRange: [number, number],
  opts: SampleOpts = {},
): { segments: [number, number][][]; visible: number } {
  const N = opts.samples ?? 360;
  const maxDepth = opts.maxDepth ?? 8;
  const toFrame = (t: number): [number, number] => {
    const x = fx(t), y = fy(t);
    const u = frameFraction(x, xRange, opts.xLog), w = frameFraction(y, yRange, opts.yLog);
    return Number.isFinite(u) && Number.isFinite(w) ? [u, w] : [NaN, NaN];
  };
  const pts: [number, number][] = [];
  const far = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.03;
  const refine = (ta: number, a: [number, number], tb: number, b: [number, number], depth: number) => {
    const ok = Number.isFinite(a[0]) && Number.isFinite(b[0]);
    if (ok && !far(a, b)) { pts.push(b); return; }
    if (depth >= maxDepth) { if (ok) pts.push([NaN, NaN]); pts.push(b); return; }
    const tm = (ta + tb) / 2;
    const m = toFrame(tm);
    refine(ta, a, tm, m, depth + 1);
    refine(tm, m, tb, b, depth + 1);
  };
  let ta = t0;
  let a = toFrame(ta);
  pts.push(a);
  for (let i = 1; i <= N; i++) {
    const tb = t0 + ((t1 - t0) * i) / N;
    const b = toFrame(tb);
    refine(ta, a, tb, b, 0);
    ta = tb; a = b;
  }
  const inFrame = pts.filter(([u, w]) => Number.isFinite(u) && u >= -0.02 && u <= 1.02 && w >= -0.02 && w <= 1.02).length;
  const back = (u: number, r: [number, number], log?: boolean) =>
    log ? 10 ** (log10(r[0]) + u * (log10(r[1]) - log10(r[0]))) : r[0] + u * (r[1] - r[0]);
  return {
    segments: clipToFrame(pts).map((seg) => seg.map(([u, w]) => [back(u, xRange, opts.xLog), back(w, yRange, opts.yLog)] as [number, number])),
    visible: pts.length ? inFrame / pts.length : 0,
  };
}

/** Shortest distance from a point to drawn pieces, as a share of the frame (0–1 units on each axis). */
export function frameDistance(
  p: [number, number],
  segments: [number, number][][],
  xRange: [number, number],
  yRange: [number, number],
  opts: { xLog?: boolean; yLog?: boolean } = {},
): number {
  const f = (q: [number, number]): [number, number] => [frameFraction(q[0], xRange, opts.xLog), frameFraction(q[1], yRange, opts.yLog)];
  const [px, py] = f(p);
  let best = Infinity;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      const [ax, ay] = f(seg[i]);
      if (i === 0) { best = Math.min(best, Math.hypot(px - ax, py - ay)); continue; }
      const [bx, by] = f(seg[i - 1]);
      const dx = bx - ax, dy = by - ay;
      const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
      best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
  }
  return best;
}

/** A number written as a constant expression ("2pi", "pi/2", 6.28). Throws if it isn't one. */
export function constantOf(v: number | string): number {
  if (typeof v === 'number') return v;
  const n = compileExpr(v)(NaN);
  if (!Number.isFinite(n)) throw new Error(`"${v}" is not a constant (write a number or e.g. "2pi")`);
  return n;
}

/** x(t), y(t) and the t range of a parametric or polar curve; throws with a reason if it can't be evaluated. */
export function curveFns(c: { x?: string; y?: string; r?: string; t: [number | string, number | string] }) {
  const t: [number, number] = [constantOf(c.t[0]), constantOf(c.t[1])];
  if (!(t[0] < t[1])) throw new Error('t range must be [start, end] with start < end');
  if (t[1] - t[0] > 1000) throw new Error('t range is too long (at most 1000)');
  if (c.r !== undefined) {
    const r = compileExpr(c.r, 't');
    return { fx: (u: number) => r(u) * Math.cos(u), fy: (u: number) => r(u) * Math.sin(u), t };
  }
  if (c.x === undefined || c.y === undefined) throw new Error('needs "x" and "y", or "r"');
  return { fx: compileExpr(c.x, 't'), fy: compileExpr(c.y, 't'), t };
}
