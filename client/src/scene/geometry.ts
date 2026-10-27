/**
 * Geometry the engine computes so the AI never has to: text metrics,
 * coordinate spaces and axis ticks, molecule shapes (VSEPR), tree and graph
 * arrangements.
 */
import { findRings } from '../../../server/engine/scene/chem';
import type { Box, EntityOf, Pt, Space } from './types';

// ── Text ────────────────────────────────────────────────────────────────────
let ctx2d: CanvasRenderingContext2D | null | undefined;
/** Width of a string in px. Uses canvas metrics in the browser, an estimate elsewhere (tests). */
export function textWidth(text: string, size: number, weight = 500, family = 'Geist, Inter, system-ui, sans-serif'): number {
  if (ctx2d === undefined) {
    try {
      const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
      ctx2d = typeof document !== 'undefined' && !jsdom ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx2d = null;
    }
  }
  if (ctx2d) {
    ctx2d.font = `${weight} ${size}px ${family}`;
    const w = ctx2d.measureText(text).width;
    if (w > 0) return w;
  }
  return text.length * size * 0.56;
}

// ── Spaces ──────────────────────────────────────────────────────────────────
export const SPACE_BASE = { w: 820, h: 480 };

const isLog = (space: Space, axis: 'x' | 'y') => (axis === 'x' ? space.xScale : space.yScale) === 'log';

export function spaceSize(space: Space): { w: number; h: number } {
  if (!space.equalAspect || isLog(space, 'x') || isLog(space, 'y')) return { ...SPACE_BASE };
  const ratio = (space.x[1] - space.x[0]) / (space.y[1] - space.y[0]);
  return ratio >= SPACE_BASE.w / SPACE_BASE.h
    ? { w: SPACE_BASE.w, h: Math.max(160, SPACE_BASE.w / ratio) }
    : { w: Math.max(200, SPACE_BASE.h * ratio), h: SPACE_BASE.h };
}

export type SpaceMap = {
  space: Space;
  box: Box;
  /** plotting area inside the box (room for axis labels when axes are on) */
  inner: Box;
  toPx: (p: [number, number]) => Pt;
  /** px per unit along x and y */
  sx: number;
  sy: number;
  ticks: { x: number[]; y: number[] };
  /** which axes are logarithmic (tick labels are powers of ten) */
  log: { x: boolean; y: boolean };
};

export function niceStep(range: number, target = 6): number {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}
const ticksFor = (a: number, b: number) => {
  const step = niceStep(b - a);
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
};
/** Decades (1, 10, 100…) across a log range; with fewer than three decades, 2× and 5× too. */
export const logTicks = (a: number, b: number) => {
  const k0 = Math.ceil(Math.log10(a) - 1e-9), k1 = Math.floor(Math.log10(b) + 1e-9);
  const out: number[] = [];
  const few = k1 - k0 < 3;
  for (let k = Math.floor(Math.log10(a)); k <= k1; k++) {
    for (const m of few ? [1, 2, 5] : [1]) {
      const v = Number((m * 10 ** k).toPrecision(6));
      if (v >= a * (1 - 1e-9) && v <= b * (1 + 1e-9)) out.push(v);
    }
  }
  // a very long range: keep about eight labels
  const every = Math.ceil(out.length / 8);
  return out.filter((_, i) => i % every === 0);
};

export function makeSpace(space: Space, box: Box): SpaceMap {
  const pad = space.axes ? { l: 46, r: 18, t: 18, b: 36 } : { l: 14, r: 14, t: 14, b: 14 };
  const inner = { x: box.x + pad.l, y: box.y + pad.t, w: box.w - pad.l - pad.r, h: box.h - pad.t - pad.b };
  const log = { x: isLog(space, 'x'), y: isLog(space, 'y') };
  if (log.x || log.y) {
    // log axes: positions are fractions of log10 across the frame; ≤ 0 has no position
    const frac = (v: number, [a, b]: number[], l: boolean) => (l ? (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) : (v - a) / (b - a));
    return {
      space,
      box,
      inner,
      sx: inner.w / (space.x[1] - space.x[0]),
      sy: inner.h / (space.y[1] - space.y[0]),
      toPx: ([x, y]) => {
        const u = frac(x, space.x, log.x), w = frac(y, space.y, log.y);
        return { x: inner.x + (Number.isFinite(u) ? u : -10) * inner.w, y: inner.y + inner.h - (Number.isFinite(w) ? w : -10) * inner.h };
      },
      ticks: { x: log.x ? logTicks(space.x[0], space.x[1]) : ticksFor(space.x[0], space.x[1]), y: log.y ? logTicks(space.y[0], space.y[1]) : ticksFor(space.y[0], space.y[1]) },
      log,
    };
  }
  let sx = inner.w / (space.x[1] - space.x[0]);
  let sy = inner.h / (space.y[1] - space.y[0]);
  if (space.equalAspect) {
    const s = Math.min(sx, sy);
    inner.x += (inner.w - s * (space.x[1] - space.x[0])) / 2;
    inner.y += (inner.h - s * (space.y[1] - space.y[0])) / 2;
    inner.w = s * (space.x[1] - space.x[0]);
    inner.h = s * (space.y[1] - space.y[0]);
    sx = sy = s;
  }
  return {
    space,
    box,
    inner,
    sx,
    sy,
    toPx: ([x, y]) => ({ x: inner.x + (x - space.x[0]) * sx, y: inner.y + inner.h - (y - space.y[0]) * sy }),
    ticks: { x: ticksFor(space.x[0], space.x[1]), y: ticksFor(space.y[0], space.y[1]) },
    log,
  };
}

// ── Molecules (2D VSEPR-style placement) ────────────────────────────────────
export type MoleculeGeo = { pos: Pt[]; radius: number[]; lonePairs: { atom: number; dirs: number[] }[]; box: Box };

export const atomRadius = (el: string) => (el === 'H' ? 26 : 40);

/** Bond directions (degrees, screen space: 0 = right, 90 = down) for a centre with k bonds and L lone pairs. */
export function centreDirections(k: number, L: number): number[] {
  if (k === 1) return [0];
  if (k === 2) {
    if (L === 0) return [180, 0];
    const half = L === 1 ? 60 : 52.25; // 120° (e.g. SO₂-like) or 104.5° (water)
    return [90 + half, 90 - half];
  }
  if (k === 3) return L === 0 ? [270, 30, 150] : [144, 90, 36]; // trigonal planar / pyramidal (107°)
  if (k === 4) return [270, 0, 90, 180];
  return Array.from({ length: k }, (_, i) => -90 + (360 / k) * i);
}

const rad = (d: number) => (d * Math.PI) / 180;
const dirTo = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Acyclic molecules: VSEPR directions around the most-bonded atom, then branches fanned away from their parent. */
function vseprPositions(m: EntityOf<'molecule'>, adj: number[][], lpCount: Map<number, number>, bondLen: (a: number, b: number) => number): (Pt | null)[] {
  const n = m.atoms.length;
  const centre = adj.reduce((best, nb, i) => (nb.length > adj[best].length || (nb.length === adj[best].length && m.atoms[best].el === 'H' && m.atoms[i].el !== 'H') ? i : best), 0);
  const pos: (Pt | null)[] = Array(n).fill(null);
  pos[centre] = { x: 0, y: 0 };
  let dirs = centreDirections(adj[centre].length, lpCount.get(centre) ?? 0);
  // a stereocentre drawn with wedges/dashes: two plain bonds in a V in the page, wedge and dash out of it below
  const styleTo = (nb: number) => (m.bonds as [number, number, number, string?][]).find(([x, y]) => (x === centre && y === nb) || (x === nb && y === centre))?.[3];
  if (adj[centre].length === 4 && adj[centre].some((nb) => styleTo(nb))) {
    const free = [210, 330, 90, 270];
    const stereo = { wedge: [150, 30], dash: [30, 150] } as Record<string, number[]>;
    const used = new Set<number>();
    dirs = adj[centre].map((nb) => {
      const st = styleTo(nb);
      const want = st ? stereo[st].find((d) => !used.has(d)) : undefined;
      const d = want ?? free.find((x) => !used.has(x))!;
      used.add(d);
      return d;
    });
  }
  adj[centre].forEach((nb, i) => {
    const d = rad(dirs[i] ?? 0);
    const L = bondLen(centre, nb);
    pos[nb] = { x: Math.cos(d) * L, y: Math.sin(d) * L };
  });
  // the rest: breadth-first, fanning children away from their parent
  const queue = [...adj[centre]];
  const parent = new Map<number, number>(adj[centre].map((nb) => [nb, centre]));
  let flip = 1;
  while (queue.length) {
    const p = queue.shift()!;
    const kids = adj[p].filter((x) => pos[x] === null);
    const away = dirTo(pos[parent.get(p)!]!, pos[p]!);
    kids.forEach((kid, i) => {
      const spread = kids.length === 1 ? 30 * flip : -60 + (120 / (kids.length - 1)) * i;
      const d = rad(away + spread);
      const L = bondLen(p, kid);
      pos[kid] = { x: pos[p]!.x + Math.cos(d) * L, y: pos[p]!.y + Math.sin(d) * L };
      parent.set(kid, p);
      queue.push(kid);
    });
    flip = -flip;
  }
  return pos;
}

/**
 * Molecules with rings: every ring is a regular polygon (benzene a true hexagon),
 * fused rings share an edge and open away from each other, and substituents
 * point straight out of the ring. Chains between rings zig-zag.
 */
function ringPositions(n: number, adj: number[][], rings: number[][], bondLen: (a: number, b: number) => number): (Pt | null)[] {
  const L = 165;
  const pos: (Pt | null)[] = Array(n).fill(null);
  const centreOf = new Map<number, Pt>(); // ring atom → centre of (one of) its rings
  const ringsOf = (a: number) => rings.filter((r) => r.includes(a));
  const placedRing = new Set<number[]>();

  const placeRing = (r: number[]) => {
    if (placedRing.has(r)) return;
    const k = r.length;
    const R = L / (2 * Math.sin(Math.PI / k));
    const step = (2 * Math.PI) / k;
    const fixed = r.map((a, i) => (pos[a] ? i : -1)).filter((i) => i >= 0);
    let C: Pt;
    let start: number;
    let theta0: number;
    let dir = 1;
    if (fixed.length === 0) {
      C = { x: 0, y: 0 };
      start = 0;
      theta0 = -Math.PI / 2 - step / 2; // a flat top edge: the textbook hexagon
    } else if (fixed.length === 1) {
      const a = r[fixed[0]];
      const p = pos[a]!;
      const nbs = adj[a].filter((x) => pos[x] && !r.includes(x));
      const away = nbs.length
        ? Math.atan2(nbs.reduce((s, x) => s + p.y - pos[x]!.y, 0), nbs.reduce((s, x) => s + p.x - pos[x]!.x, 0))
        : 0;
      C = { x: p.x + Math.cos(away) * R, y: p.y + Math.sin(away) * R };
      start = fixed[0];
      theta0 = away + Math.PI;
    } else {
      // fused: find two ring-adjacent placed atoms and build the polygon on the far side of their edge
      let s0 = -1, s1 = -1;
      for (const i of fixed) {
        const j = (i + 1) % k;
        if (pos[r[j]]) { s0 = i; s1 = j; break; }
      }
      if (s0 < 0) { // placed atoms not adjacent in this ring (bridged): let the chain pass place the rest
        placedRing.add(r);
        return;
      }
      const u = pos[r[s0]]!, v = pos[r[s1]]!;
      const M = { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 };
      const apothem = L / (2 * Math.tan(Math.PI / k));
      let nx = -(v.y - u.y), ny = v.x - u.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const old = centreOf.get(r[s0]) ?? centreOf.get(r[s1]);
      if (old && (old.x - M.x) * nx + (old.y - M.y) * ny > 0) { nx = -nx; ny = -ny; }
      C = { x: M.x + nx * apothem, y: M.y + ny * apothem };
      start = s0;
      theta0 = Math.atan2(u.y - C.y, u.x - C.x);
      const thetaV = Math.atan2(v.y - C.y, v.x - C.x);
      const delta = Math.atan2(Math.sin(thetaV - theta0), Math.cos(thetaV - theta0));
      dir = delta >= 0 ? 1 : -1;
    }
    for (let j = 0; j < k; j++) {
      const a = r[(start + j) % k];
      if (!pos[a]) pos[a] = { x: C.x + Math.cos(theta0 + dir * j * step) * R, y: C.y + Math.sin(theta0 + dir * j * step) * R };
      if (!centreOf.has(a)) centreOf.set(a, C);
    }
    placedRing.add(r);
    // rings fused to this one, right away, so the ring system is one flat drawing
    for (const a of r) for (const other of ringsOf(a)) if (!placedRing.has(other) && other.filter((x) => pos[x]).length >= 2) placeRing(other);
  };

  // breadth-first from the first ring system; a ring met on the way is drawn whole, anchored at that atom
  const queued = new Set<number>();
  const queue: number[] = [];
  const enqueuePlaced = () => pos.forEach((p, i) => { if (p && !queued.has(i)) { queued.add(i); queue.push(i); } });
  const parent = new Map<number, number>();
  let flip = 1;
  placeRing(rings[0]);
  enqueuePlaced();
  while (queue.length) {
    const p = queue.shift()!;
    const kids = adj[p].filter((x) => !pos[x]);
    if (!kids.length) continue;
    const c = centreOf.get(p);
    const par = parent.get(p);
    // out of the ring, or onward from the parent along a chain
    const base = c
      ? Math.atan2(pos[p]!.y - c.y, pos[p]!.x - c.x)
      : par !== undefined ? Math.atan2(pos[p]!.y - pos[par]!.y, pos[p]!.x - pos[par]!.x) : 0;
    const fan = c ? (2 * Math.PI) / 5 : (2 * Math.PI) / 3; // two H on a ring CH₂ sit ±36° from straight out
    kids.forEach((kid, i) => {
      const spread = kids.length === 1 ? (c ? 0 : (Math.PI / 6) * flip) : -fan / 2 + (fan / (kids.length - 1)) * i;
      const d = base + spread;
      const len = bondLen(p, kid);
      pos[kid] = { x: pos[p]!.x + Math.cos(d) * len, y: pos[p]!.y + Math.sin(d) * len };
      parent.set(kid, p);
      for (const r of ringsOf(kid)) placeRing(r);
    });
    flip = -flip;
    enqueuePlaced();
  }
  // atoms not connected to any ring (a counter-ion, a second fragment)
  const reached = pos.filter(Boolean) as Pt[];
  const bottom = reached.length ? Math.max(...reached.map((p) => p.y)) + 200 : 0;
  pos.forEach((p, i) => { if (!p) pos[i] = { x: i * 110, y: bottom }; });
  return pos;
}

export function moleculeLayout(m: EntityOf<'molecule'>): MoleculeGeo {
  const n = m.atoms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of m.bonds) {
    if (a < n && b < n && a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); }
  }
  const lpCount = new Map<number, number>((m.lonePairs ?? []).map((l) => [l.atom, l.count]));
  const bondLen = (a: number, b: number) => (m.atoms[a].el === 'H' || m.atoms[b].el === 'H' ? 150 : 165);
  const rings = findRings(n, m.bonds as [number, number, number][]);
  const pos = rings.length ? ringPositions(n, adj, rings, bondLen) : vseprPositions(m, adj, lpCount, bondLen);
  // unbonded atoms in a row underneath
  pos.forEach((p, i) => { if (!p) pos[i] = { x: i * 110, y: 220 }; });

  const lonePairs = [...lpCount.entries()].filter(([a]) => a < n).map(([atom, count]) => {
    const bonds = adj[atom].map((nb) => rad(dirTo(pos[atom]!, pos[nb]!)));
    const mean = bonds.length ? Math.atan2(bonds.reduce((s, a) => s + Math.sin(a), 0), bonds.reduce((s, a) => s + Math.cos(a), 0)) : -Math.PI / 2;
    const opposite = (mean * 180) / Math.PI + 180;
    const spread = count === 1 ? [0] : count === 2 ? [-56, 56] : Array.from({ length: count }, (_, i) => -70 + (140 / (count - 1)) * i);
    return { atom, dirs: spread.map((s) => opposite + s) };
  });

  const radius = m.atoms.map((a) => atomRadius(a.el));
  const pts = pos as Pt[];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach((p, i) => {
    x0 = Math.min(x0, p.x - radius[i]); y0 = Math.min(y0, p.y - radius[i]);
    x1 = Math.max(x1, p.x + radius[i]); y1 = Math.max(y1, p.y + radius[i]);
  });
  for (const lp of lonePairs) for (const d of lp.dirs) {
    const c = { x: pts[lp.atom].x + Math.cos(rad(d)) * 78, y: pts[lp.atom].y + Math.sin(rad(d)) * 78 };
    x0 = Math.min(x0, c.x - 30); y0 = Math.min(y0, c.y - 30); x1 = Math.max(x1, c.x + 30); y1 = Math.max(y1, c.y + 30);
  }
  return { pos: pts, radius, lonePairs, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

// ── Trees and graphs ────────────────────────────────────────────────────────
export type NodeGeo = { pos: Map<string, Pt>; box: Box; r: number };

export function treeLayout(t: EntityOf<'tree'>): NodeGeo {
  const kids = new Map<string, string[]>();
  let root = t.nodes[0].id;
  for (const n of t.nodes) {
    if (!n.parent) root = n.id;
    else kids.set(n.parent, [...(kids.get(n.parent) ?? []), n.id]);
  }
  const pos = new Map<string, Pt>();
  let slot = 0;
  const DX = 84, DY = 96;
  const walk = (id: string, depth: number, guard: number): number => {
    const ch = guard > t.nodes.length ? [] : kids.get(id) ?? [];
    let x: number;
    if (!ch.length) x = slot++ * DX;
    else {
      const xs = ch.map((c) => walk(c, depth + 1, guard + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pos.set(id, { x, y: depth * DY });
    return x;
  };
  walk(root, 0, 0);
  return withBox(pos, 28);
}

export function graphLayout(g: EntityOf<'graph'>): NodeGeo {
  const pos = new Map<string, Pt>();
  const n = g.nodes.length;
  let mode = g.arrangement;
  if (mode === 'auto') mode = g.directed && n > 3 ? 'layered' : 'circle';
  if (mode === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    g.nodes.forEach((node, i) => pos.set(node.id, { x: (i % cols) * 140, y: Math.floor(i / cols) * 120 }));
  } else if (mode === 'layered') {
    const depth = new Map<string, number>([[g.nodes[0].id, 0]]);
    const q = [g.nodes[0].id];
    while (q.length) {
      const cur = q.shift()!;
      for (const e of g.edges) {
        const nxt = e.from === cur ? e.to : !g.directed && e.to === cur ? e.from : null;
        if (nxt && !depth.has(nxt)) { depth.set(nxt, depth.get(cur)! + 1); q.push(nxt); }
      }
    }
    const rows = new Map<number, string[]>();
    for (const node of g.nodes) {
      const d = depth.get(node.id) ?? Math.max(0, ...depth.values()) + 1;
      rows.set(d, [...(rows.get(d) ?? []), node.id]);
    }
    for (const [d, ids] of rows) ids.forEach((id, i) => pos.set(id, { x: d * 150, y: (i - (ids.length - 1) / 2) * 100 }));
  } else {
    const R = Math.max(120, n * 26);
    g.nodes.forEach((node, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pos.set(node.id, { x: Math.cos(a) * R, y: Math.sin(a) * R });
    });
  }
  return withBox(pos, 28);
}

function withBox(pos: Map<string, Pt>, r: number): NodeGeo {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pos.values()) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { pos, r, box: { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r } };
}
