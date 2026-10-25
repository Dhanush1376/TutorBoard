/**
 * Geometry the engine computes so the AI never has to: text metrics,
 * coordinate spaces and axis ticks, molecule shapes (VSEPR), tree and graph
 * arrangements.
 */
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

export function spaceSize(space: Space): { w: number; h: number } {
  if (!space.equalAspect) return { ...SPACE_BASE };
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

export function makeSpace(space: Space, box: Box): SpaceMap {
  const pad = space.axes ? { l: 46, r: 18, t: 18, b: 36 } : { l: 14, r: 14, t: 14, b: 14 };
  const inner = { x: box.x + pad.l, y: box.y + pad.t, w: box.w - pad.l - pad.r, h: box.h - pad.t - pad.b };
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

export function moleculeLayout(m: EntityOf<'molecule'>): MoleculeGeo {
  const n = m.atoms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of m.bonds) {
    if (a < n && b < n && a !== b) { adj[a].push(b); adj[b].push(a); }
  }
  const lpCount = new Map<number, number>((m.lonePairs ?? []).map((l) => [l.atom, l.count]));
  const centre = adj.reduce((best, nb, i) => (nb.length > adj[best].length || (nb.length === adj[best].length && m.atoms[best].el === 'H' && m.atoms[i].el !== 'H') ? i : best), 0);
  const pos: (Pt | null)[] = Array(n).fill(null);
  const bondLen = (a: number, b: number) => (m.atoms[a].el === 'H' || m.atoms[b].el === 'H' ? 150 : 165);
  pos[centre] = { x: 0, y: 0 };
  const dirs = centreDirections(adj[centre].length, lpCount.get(centre) ?? 0);
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
