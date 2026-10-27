/**
 * Labelled compartment diagrams (cell → organelles, organ → tissues) — shared by
 * the validator and the client renderer, so what is checked is what is drawn.
 *
 * The model names the parts and what each sits inside; nothing here takes a
 * coordinate from it. Parts are packed inside their parent (largest first, each
 * at the free spot farthest from everything already placed, so the biggest
 * part sits centrally and the rest spread out). Labels go in a column on each
 * side, joined to their part by a leader line; they keep their parts' vertical
 * order (so leaders don't cross), are spaced apart, and move to the emptier
 * side when one side is crowded. Anything that can't be placed is reported.
 */

export type CompShape = 'round' | 'oval' | 'rect' | 'bean' | 'stack' | 'dot' | 'membrane';
export type CompPart = { id: string; label: string; in?: string; shape?: CompShape; size?: 'xs' | 'sm' | 'md' | 'lg'; count?: number };
export type Compartment = { id: string; label?: string; shape?: 'round' | 'oval' | 'rect'; size?: 'sm' | 'md' | 'lg'; parts: CompPart[] };

export type Placed = {
  id: string;
  shape: CompShape | 'root';
  /** centres of every copy (count) — the first is the one labelled */
  at: { x: number; y: number }[];
  rx: number;
  ry: number;
  /** membranes: the outline they follow (their parent's), inset by `inset`; `rect` when that outline is a rectangle */
  inset?: number;
  rect?: boolean;
  parent?: string;
};
export type Leader = { id: string; text: string; side: 'left' | 'right'; x: number; y: number; from: { x: number; y: number }; elbow: { x: number; y: number } };
export type CompLayout = { w: number; h: number; root: Placed & { outline: 'round' | 'oval' | 'rect' }; parts: Map<string, Placed>; leaders: Leader[]; issues: string[] };

const ROOT_SIZE = { sm: { rx: 150, ry: 115 }, md: { rx: 205, ry: 155 }, lg: { rx: 260, ry: 195 } } as const;
const PART_FRAC = { xs: 0.075, sm: 0.13, md: 0.22, lg: 0.33 } as const;
const MEMBRANE_GAP = 9;
const LABEL = { size: 14, row: 26, gap: 44, pad: 10 } as const;

/** Text width estimate (the server has no fonts; the client uses the same so both lay out alike). */
export const labelWidth = (s: string) => s.length * LABEL.size * 0.56;

/** Half-extents of a part from its shape and size, inside a parent of half-size `R`. */
function extents(shape: CompShape, size: CompPart['size'], R: number) {
  const f = PART_FRAC[size ?? 'sm'] * R;
  switch (shape) {
    case 'oval': case 'bean': return { rx: f * 1.3, ry: f * 0.75 };
    case 'rect': return { rx: f * 1.15, ry: f * 0.85 };
    case 'stack': return { rx: f * 1.25, ry: f * 0.8 };
    case 'dot': return { rx: Math.max(5, f * 0.35), ry: Math.max(5, f * 0.35) };
    default: return { rx: f, ry: f };
  }
}

/** Is a circle of radius r at (x, y) inside the region (ellipse or rectangle) with clearance? Returns the clearance (< 0: outside). */
function clearance(x: number, y: number, r: number, region: { cx: number; cy: number; rx: number; ry: number; rect: boolean }) {
  const dx = x - region.cx, dy = y - region.cy;
  if (region.rect) return Math.min(region.rx - Math.abs(dx), region.ry - Math.abs(dy)) - r;
  // distance to an ellipse boundary, approximated along the ray from the centre
  const ang = Math.atan2(dy / region.ry, dx / region.rx);
  const bx = region.rx * Math.cos(ang), by = region.ry * Math.sin(ang);
  return Math.hypot(bx, by) - Math.hypot(dx, dy) - r;
}

export function layoutCompartment(c: Compartment): CompLayout {
  const issues: string[] = [];
  const outline = c.shape ?? 'round';
  const base = ROOT_SIZE[c.size ?? 'lg'];
  const root = { id: c.id, shape: 'root' as const, outline, at: [{ x: 0, y: 0 }], rx: outline === 'oval' ? base.rx * 1.2 : base.rx, ry: outline === 'oval' ? base.ry * 0.8 : base.ry };
  const parts = new Map<string, Placed>();
  const kids = new Map<string, CompPart[]>();
  for (const p of c.parts) {
    const parent = p.in ?? c.id;
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }

  const place = (parentId: string, region: { cx: number; cy: number; rx: number; ry: number; rect: boolean }) => {
    const list = kids.get(parentId) ?? [];
    // membranes follow the parent's outline, outermost first; the room inside shrinks with each
    let inset = 0;
    for (const m of list.filter((p) => p.shape === 'membrane')) {
      parts.set(m.id, { id: m.id, shape: 'membrane', at: [{ x: region.cx, y: region.cy }], rx: region.rx - inset, ry: region.ry - inset, inset, parent: parentId, rect: region.rect });
      inset += MEMBRANE_GAP;
    }
    const inner = { ...region, rx: region.rx - inset - 6, ry: region.ry - inset - 6 };
    const R = Math.min(inner.rx, inner.ry);
    const bodies = list.filter((p) => p.shape !== 'membrane')
      .flatMap((p) => Array.from({ length: Math.max(1, Math.min(8, p.count ?? 1)) }, (_, k) => ({ p, k, ...extents(p.shape ?? 'round', p.size, R) })))
      .sort((a, b) => Math.max(b.rx, b.ry) - Math.max(a.rx, a.ry));
    const done: { x: number; y: number; r: number }[] = [];
    const N = 28;
    for (const b of bodies) {
      const r = Math.max(b.rx, b.ry) + 4;
      let best: { x: number; y: number; s: number } | null = null;
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
        const x = inner.cx - inner.rx + (2 * inner.rx * i) / N;
        const y = inner.cy - inner.ry + (2 * inner.ry * j) / N;
        const edge = clearance(x, y, r, inner);
        if (edge < 0) continue;
        const near = done.reduce((m, d) => Math.min(m, Math.hypot(x - d.x, y - d.y) - d.r - r), Infinity);
        if (near < 0) continue;
        // spread out, but keep off the wall: the wall counts a little less than a neighbour
        const s = Math.min(near, edge * 1.6) - Math.hypot(x - inner.cx, y - inner.cy) * 0.02;
        if (!best || s > best.s + 1e-9) best = { x, y, s };
      }
      if (!best) {
        issues.push(`no room for "${b.p.label}"${b.p.count && b.p.count > 1 ? ` (copy ${b.k + 1} of ${b.p.count})` : ''} inside ${parentId === c.id ? `"${c.label ?? c.id}"` : `"${c.parts.find((q) => q.id === parentId)?.label ?? parentId}"`} — use a smaller "size", fewer copies, or fewer parts there`);
        continue;
      }
      done.push({ x: best.x, y: best.y, r });
      const prev = parts.get(b.p.id);
      if (prev) prev.at.push({ x: best.x, y: best.y });
      else parts.set(b.p.id, { id: b.p.id, shape: b.p.shape ?? 'round', at: [{ x: best.x, y: best.y }], rx: b.rx, ry: b.ry, parent: parentId });
    }
    for (const p of list) {
      const placed = parts.get(p.id);
      if (placed && p.shape !== 'membrane' && kids.has(p.id)) place(p.id, { cx: placed.at[0].x, cy: placed.at[0].y, rx: placed.rx, ry: placed.ry, rect: placed.shape === 'rect' });
    }
  };
  place(c.id, { cx: 0, cy: 0, rx: root.rx, ry: root.ry, rect: outline === 'rect' });

  // ── leader labels ──
  type Item = { id: string; text: string; ax: number; ay: number; r: number; side: 'left' | 'right'; y: number };
  const items: Item[] = c.parts.flatMap((p) => {
    const pl = parts.get(p.id);
    if (!pl) return [];
    // a membrane is labelled where its outline is (top-right / top-left of its parent), others at their first copy
    const a = pl.shape !== 'membrane' ? pl.at[0]
      : pl.rect ? { x: pl.at[0].x + pl.rx * 0.6, y: pl.at[0].y - pl.ry }
        : { x: pl.at[0].x + pl.rx * 0.72, y: pl.at[0].y - pl.ry * 0.69 };
    return [{ id: p.id, text: p.label, ax: a.x, ay: a.y, r: pl.shape === 'membrane' ? 0 : Math.min(pl.rx, pl.ry), side: a.x < 0 ? 'left' as const : 'right' as const, y: a.y }];
  });
  // membranes alternate sides so a cell wall and a cell membrane don't both crowd the top-right
  items.filter((i) => parts.get(i.id)?.shape === 'membrane').forEach((i, k) => {
    if (k % 2 === 1) { i.ax = -i.ax + 2 * (parts.get(i.id)!.at[0].x); i.side = 'left'; }
  });
  // a part nested in another labelled part takes the other column, so the two leaders don't start side by side
  const sideOf = new Map(items.map((i) => [i.id, i]));
  const pinned = new Set<string>();
  for (const p of c.parts) {
    const it = sideOf.get(p.id), host = p.in ? sideOf.get(p.in) : undefined;
    if (!it || !host || parts.get(p.id)?.shape === 'membrane') continue;
    if (it.side === host.side) it.side = host.side === 'left' ? 'right' : 'left';
    pinned.add(p.id);
    pinned.add(host.id);
  }
  const maxRows = Math.floor((root.ry * 2 + 120) / LABEL.row);
  const balance = () => {
    for (let guard = 0; guard < 40; guard++) {
      const L = items.filter((i) => i.side === 'left'), R = items.filter((i) => i.side === 'right');
      const [big, small] = L.length > R.length ? [L, 'right' as const] : [R, 'left' as const];
      if (Math.abs(L.length - R.length) <= 1 && Math.max(L.length, R.length) <= maxRows) return;
      if (big.length <= maxRows && Math.abs(L.length - R.length) <= 2) return;
      // move the part nearest the middle to the emptier side
      const mover = [...big].filter((i) => !pinned.has(i.id)).sort((a, b) => Math.abs(a.ax) - Math.abs(b.ax))[0]
        ?? [...big].sort((a, b) => Math.abs(a.ax) - Math.abs(b.ax))[0];
      if (!mover) return;
      mover.side = small;
    }
  };
  balance();
  const leaders: Leader[] = [];
  const top = -root.ry - 60, bottom = root.ry + 60;
  for (const side of ['left', 'right'] as const) {
    const col = items.filter((i) => i.side === side).sort((a, b) => a.ay - b.ay);
    if (col.length > Math.floor((bottom - top) / LABEL.row) + 1) issues.push(`${col.length} labels on the ${side} don't fit beside the diagram — use fewer labelled parts (at most ${2 * (Math.floor((bottom - top) / LABEL.row) + 1)})`);
    // spread: keep order, at least one row apart, inside [top, bottom]
    col.forEach((it, k) => { it.y = Math.max(it.ay, k ? col[k - 1].y + LABEL.row : top); });
    for (let k = col.length - 1; k >= 0; k--) col[k].y = Math.min(col[k].y, k === col.length - 1 ? bottom : col[k + 1].y - LABEL.row);
    col.forEach((it, k) => { it.y = Math.max(it.y, k ? col[k - 1].y + LABEL.row : top); });
    const edgeX = side === 'left' ? -root.rx - LABEL.gap : root.rx + LABEL.gap;
    for (const it of col) {
      // the leader leaves the part on its label's side and bends once, just outside the diagram
      const dir = side === 'left' ? -1 : 1;
      const from = it.r ? { x: it.ax + dir * it.r * 0.7, y: it.ay } : { x: it.ax, y: it.ay };
      const elbow = { x: edgeX - dir * 14, y: it.y };
      leaders.push({ id: it.id, text: it.text, side, x: edgeX, y: it.y, from, elbow });
    }
  }
  // labels that still overlap after spreading (only when the column overflowed)
  for (const side of ['left', 'right'] as const) {
    const col = leaders.filter((l) => l.side === side).sort((a, b) => a.y - b.y);
    for (let k = 1; k < col.length; k++) if (col[k].y - col[k - 1].y < LABEL.row - 0.5) issues.push(`labels "${col[k - 1].text}" and "${col[k].text}" overlap`);
  }
  // leaders that cross (would point at the wrong part)
  const cross = (a: Leader, b: Leader) => segX(a.from, a.elbow, b.from, b.elbow);
  for (let i = 0; i < leaders.length; i++) for (let j = i + 1; j < leaders.length; j++) {
    if (leaders[i].side === leaders[j].side && cross(leaders[i], leaders[j])) {
      // swap their rows: same column, so the order of the targets wins
      const a = leaders[i], b = leaders[j];
      [a.y, b.y] = [b.y, a.y];
      a.elbow = { ...a.elbow, y: a.y };
      b.elbow = { ...b.elbow, y: b.y };
    }
  }
  const lw = (side: 'left' | 'right') => Math.max(0, ...leaders.filter((l) => l.side === side).map((l) => labelWidth(l.text) + LABEL.pad));
  const left = root.rx + LABEL.gap + lw('left'), right = root.rx + LABEL.gap + lw('right');
  const ys = leaders.map((l) => l.y);
  const halfH = Math.max(root.ry, ...ys.map((y) => Math.abs(y) + 14)) + 6;
  // shift everything so the box starts at 0,0
  const ox = left, oy = halfH;
  const shift = (p: { x: number; y: number }) => ({ x: p.x + ox, y: p.y + oy });
  for (const pl of parts.values()) pl.at = pl.at.map(shift);
  for (const l of leaders) { Object.assign(l, shift(l)); l.from = shift(l.from); l.elbow = shift(l.elbow); }
  return { w: left + right, h: halfH * 2, root: { ...root, at: [shift(root.at[0])] }, parts, leaders, issues };
}

function segX(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
