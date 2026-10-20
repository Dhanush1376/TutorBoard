/**
 * Connector routing: paths between two boxes that go around everything else.
 *
 *   straight line → gentle curve → right-angled path through the free channels
 *   (A* on a coarse grid, turns penalised, kept away from edges) → least-bad curve.
 *
 * Pure geometry — no DOM — so it is unit-tested on its own.
 */
import type { Box, Pt } from './types';

export type Route = { d: string; at: (u: number) => Pt; end: Pt; kind: 'straight' | 'curve' | 'orthogonal' };

const CLEAR = 6; // how far a path keeps from a box it isn't connected to

const inside = (p: Pt, r: Box, pad: number) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const f = (n: number) => n.toFixed(1);

/** where the ray from a box's centre towards `toward` leaves the box (plus a gap) */
const exit = (box: Box, toward: Pt, gap = 8): Pt => {
  const c = center(box);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  const s = Math.min(Math.abs((box.w / 2 + gap) / (dx || 1e-9)), Math.abs((box.h / 2 + gap) / (dy || 1e-9)));
  return { x: c.x + dx * s, y: c.y + dy * s };
};

/** Obstacles for a connector: everything but its two ends and anything that contains them. */
export function obstaclesFor(from: Box, to: Box, boxes: Box[]): Box[] {
  const ca = center(from), cb = center(to);
  return boxes.filter((o) => o !== from && o !== to && !inside(ca, o, 0) && !inside(cb, o, 0));
}

const quad = (p1: Pt, c: Pt, p2: Pt) => (u: number): Pt => ({
  x: (1 - u) * (1 - u) * p1.x + 2 * (1 - u) * u * c.x + u * u * p2.x,
  y: (1 - u) * (1 - u) * p1.y + 2 * (1 - u) * u * c.y + u * u * p2.y,
});

const collisions = (at: (u: number) => Pt, obstacles: Box[], n = 40) => {
  let hits = 0;
  for (let i = 0; i <= n; i++) {
    const p = at(i / n);
    if (obstacles.some((o) => inside(p, o, CLEAR))) hits++;
  }
  return hits;
};

/** A quadratic from box to box, bent sideways by `bend` px (0 = straight). */
function curve(from: Box, to: Box, bend: number) {
  const ca = center(from), cb = center(to);
  const nx = -(cb.y - ca.y), ny = cb.x - ca.x;
  const len = Math.hypot(nx, ny) || 1;
  const ctrl = { x: (ca.x + cb.x) / 2 + (nx / len) * bend, y: (ca.y + cb.y) / 2 + (ny / len) * bend };
  const p1 = exit(from, ctrl), p2 = exit(to, ctrl);
  return { p1, ctrl, p2, at: quad(p1, ctrl, p2) };
}

/** Point at fraction u of a polyline's length. */
export function along(points: Pt[], u: number): Pt {
  const seg = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let rest = Math.max(0, Math.min(1, u)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, rest / seg[i]) : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
    }
    rest -= seg[i];
  }
  return points[0];
}

/** SVG path through the corner points with rounded corners. */
export function roundedPath(points: Pt[], radius = 14): string {
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)},${f(p.y)}`).join(' ');
  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], c = points[i], b = points[i + 1];
    const la = Math.hypot(c.x - a.x, c.y - a.y), lb = Math.hypot(b.x - c.x, b.y - c.y);
    const r = Math.min(radius, la / 2, lb / 2);
    const p = { x: c.x + ((a.x - c.x) / (la || 1)) * r, y: c.y + ((a.y - c.y) / (la || 1)) * r };
    const q = { x: c.x + ((b.x - c.x) / (lb || 1)) * r, y: c.y + ((b.y - c.y) / (lb || 1)) * r };
    d += ` L${f(p.x)},${f(p.y)} Q${f(c.x)},${f(c.y)} ${f(q.x)},${f(q.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${f(last.x)},${f(last.y)}`;
}

/** Tiny binary heap keyed by priority. */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const { k, v } = this;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

/**
 * Right-angled route through the free space between obstacles, or null when
 * there is none. A* over (cell, heading): each step costs 1, a turn 6, cells
 * hugging an obstacle a little extra (lines run down the middle of channels)
 * and cells on an earlier connector's path more (lines don't share a corridor).
 * `clearance` keeps paths out of the narrow gaps between stacked boxes.
 */
export function orthogonal(from: Box, to: Box, obstacles: Box[], avoid: Pt[] = [], clearance = 18, cell = 12): Pt[] | null {
  const all = [from, to, ...obstacles];
  const x0 = Math.min(...all.map((b) => b.x)) - 4 * cell, y0 = Math.min(...all.map((b) => b.y)) - 4 * cell;
  const x1 = Math.max(...all.map((b) => b.x + b.w)) + 4 * cell, y1 = Math.max(...all.map((b) => b.y + b.h)) + 4 * cell;
  const W = Math.ceil((x1 - x0) / cell), H = Math.ceil((y1 - y0) / cell);
  if (W * H > 60000) return null;
  const px = (i: number) => x0 + (i + 0.5) * cell, py = (j: number) => y0 + (j + 0.5) * cell;
  const blocked = new Uint8Array(W * H), extra = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = { x: px(i), y: py(j) };
    const at = j * W + i;
    if (inside(p, from, 0) || inside(p, to, 0)) continue;
    if (obstacles.some((o) => inside(p, o, clearance))) blocked[at] = 1;
    else if (obstacles.some((o) => inside(p, o, clearance + 2 * cell)) || inside(p, from, 2 * cell) || inside(p, to, 2 * cell)) extra[at] = 0.6;
  }
  const ca = center(from), cb = center(to);
  const ci = (x: number) => Math.max(0, Math.min(W - 1, Math.floor((x - x0) / cell)));
  const cj = (y: number) => Math.max(0, Math.min(H - 1, Math.floor((y - y0) / cell)));
  for (const q of avoid) {
    const i = ci(q.x), j = cj(q.y);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < W && nj < H) extra[nj * W + ni] = Math.max(extra[nj * W + ni], 4);
    }
  }
  const start = cj(ca.y) * W + ci(ca.x), goal = cj(cb.y) * W + ci(cb.x);
  const gi = goal % W, gj = Math.floor(goal / W);
  const N = W * H * 4;
  const g = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const open = new Heap();
  const h = (c: number) => Math.abs((c % W) - gi) + Math.abs(Math.floor(c / W) - gj);
  for (let d = 0; d < 4; d++) { g[start * 4 + d] = 0; open.push(h(start), start * 4 + d); }
  let found = -1;
  while (open.size) {
    const s = open.pop();
    const c = s >> 2, d = s & 3;
    if (c === goal) { found = s; break; }
    const i = c % W, j = Math.floor(c / W);
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue; // no U-turns
      const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nc = nj * W + ni;
      if (blocked[nc]) continue;
      const ns = nc * 4 + nd;
      const cost = g[s] + 1 + extra[nc] + (nd === d ? 0 : 6);
      if (cost < g[ns]) { g[ns] = cost; prev[ns] = s; open.push(cost + h(nc), ns); }
    }
  }
  if (found < 0) return null;
  // cells → corner points
  const cells: Pt[] = [];
  for (let s = found; s >= 0; s = prev[s]) cells.push({ x: px((s >> 2) % W), y: py(Math.floor((s >> 2) / W)) });
  cells.reverse();
  const corners = cells.filter((p, k) => {
    if (k === 0 || k === cells.length - 1) return true;
    const a = cells[k - 1], b = cells[k + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
  return clipEnds(corners, from, to);
}

/** Trim a centre-to-centre polyline so it starts and ends just outside its boxes. */
function clipEnds(pts: Pt[], from: Box, to: Box, gap = 8): Pt[] | null {
  const leave = (p: Pt[], box: Box) => {
    const k = p.findIndex((q) => !inside(q, box, gap));
    if (k <= 0) return null;
    const a = p[k - 1], b = p[k];
    // the crossing on an axis-aligned segment
    const x = a.x === b.x ? a.x : (b.x > a.x ? box.x + box.w + gap : box.x - gap);
    const y = a.y === b.y ? a.y : (b.y > a.y ? box.y + box.h + gap : box.y - gap);
    return [{ x, y }, ...p.slice(k)];
  };
  const head = leave(pts, from);
  if (!head) return null;
  const tail = leave([...head].reverse(), to);
  if (!tail) return null;
  const out = tail.reverse();
  return out.length >= 2 ? out : null;
}

/** The best path from one box to another around the obstacles (and off earlier connectors' paths). */
export function routeConnector(from: Box, to: Box, obstacles: Box[], avoid: Pt[] = []): Route {
  const make = (c: ReturnType<typeof curve>, bend: number): Route => ({
    d: bend ? `M${f(c.p1.x)},${f(c.p1.y)} Q${f(c.ctrl.x)},${f(c.ctrl.y)} ${f(c.p2.x)},${f(c.p2.y)}` : `M${f(c.p1.x)},${f(c.p1.y)} L${f(c.p2.x)},${f(c.p2.y)}`,
    at: c.at,
    end: c.p2,
    kind: bend ? 'curve' : 'straight',
  });
  // 1–2: straight, or a gentle curve, when either is clear
  for (const bend of [0, 45, -45, 90, -90]) {
    const c = curve(from, to, bend);
    if (!collisions(c.at, obstacles)) return make(c, bend);
  }
  // 3: right angles through the channels between things
  const pts = orthogonal(from, to, obstacles, avoid) ?? orthogonal(from, to, obstacles, avoid, CLEAR + 4);
  if (pts) return { d: roundedPath(pts), at: (u) => along(pts, u), end: pts[pts.length - 1], kind: 'orthogonal' };
  // 4: nothing is clear — the curve that crosses the least
  let best = { c: curve(from, to, 0), bend: 0, hits: Infinity };
  for (const bend of [0, 80, -80, 160, -160, 240, -240]) {
    const c = curve(from, to, bend);
    const hits = collisions(c.at, obstacles);
    if (hits < best.hits) best = { c, bend, hits };
  }
  return make(best.c, best.bend);
}
