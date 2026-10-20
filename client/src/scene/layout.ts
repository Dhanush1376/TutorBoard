/**
 * Layout solver: relations → positions. The AI says "row", "below", "place
 * top-right"; this turns that into world-space boxes that never overlap.
 *
 * Nodes are composed into blocks (rows, columns, grids, satellites); the
 * top-level blocks are arranged around a centre stack by region. The world
 * is unbounded — the camera fits it into whatever space the host gives.
 */
import type { Measured } from './measure';
import { GAP_PX } from './tokens';
import type { Box, Relation } from './types';

type Member = { id: string; dx: number; dy: number };
type Block = { w: number; h: number; members: Member[]; region?: string; order: number };

export type Layout = { boxes: Map<string, Box>; world: Box };

const REGION_GAP = GAP_PX.lg;

export function solveLayout(sizes: Map<string, Measured>, relations: Relation[], order: string[]): Layout {
  const blockOf = new Map<string, Block>();
  const blocks = new Set<Block>();
  order.forEach((id, i) => {
    const m = sizes.get(id);
    if (!m) return;
    const b: Block = { w: m.w, h: m.h, members: [{ id, dx: 0, dy: 0 }], order: i };
    blockOf.set(id, b);
    blocks.add(b);
  });

  const absorb = (into: Block, from: Block, dx: number, dy: number) => {
    for (const m of from.members) {
      into.members.push({ id: m.id, dx: m.dx + dx, dy: m.dy + dy });
      blockOf.set(m.id, into);
    }
    into.region = into.region ?? from.region;
    into.order = Math.min(into.order, from.order);
    blocks.delete(from);
  };
  /** Shift members so the block's top-left is (0,0) and recompute its size. */
  const normalize = (b: Block) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of b.members) {
      const s = sizes.get(m.id)!;
      x0 = Math.min(x0, m.dx); y0 = Math.min(y0, m.dy);
      x1 = Math.max(x1, m.dx + s.w); y1 = Math.max(y1, m.dy + s.h);
    }
    for (const m of b.members) { m.dx -= x0; m.dy -= y0; }
    b.w = x1 - x0;
    b.h = y1 - y0;
  };
  const memberBox = (b: Block, id: string): Box => {
    const m = b.members.find((x) => x.id === id)!;
    const s = sizes.get(id)!;
    return { x: m.dx, y: m.dy, w: s.w, h: s.h };
  };
  const overlaps = (a: Box, b: Box, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

  for (const r of relations) {
    if (r.rel === 'row' || r.rel === 'column' || r.rel === 'grid') {
      const parts = [...new Set(r.ids.map((id) => blockOf.get(id)).filter((b): b is Block => !!b))];
      if (parts.length < 2) continue;
      const gap = GAP_PX[r.gap] ?? GAP_PX.lg;
      const merged: Block = { w: 0, h: 0, members: [], order: Infinity };
      blocks.add(merged);
      if (r.rel === 'row') {
        const h = Math.max(...parts.map((p) => p.h));
        let x = 0;
        for (const p of parts) { absorb(merged, p, x, (h - p.h) / 2); x += p.w + gap; }
      } else if (r.rel === 'column') {
        const w = Math.max(...parts.map((p) => p.w));
        let y = 0;
        for (const p of parts) { absorb(merged, p, (w - p.w) / 2, y); y += p.h + gap; }
      } else {
        const cw = Math.max(...parts.map((p) => p.w));
        const ch = Math.max(...parts.map((p) => p.h));
        parts.forEach((p, i) => absorb(merged, p, (i % r.cols) * (cw + gap) + (cw - p.w) / 2, Math.floor(i / r.cols) * (ch + gap) + (ch - p.h) / 2));
      }
      normalize(merged);
    } else if (r.rel === 'place') {
      const b = blockOf.get(r.id);
      if (b && !b.region) b.region = r.region;
    } else {
      const sat = blockOf.get(r.id);
      const host = blockOf.get(r.of);
      if (!sat || !host || sat === host) continue;
      const anchor = memberBox(host, r.of);
      const gap = r.rel === 'inside' ? 0 : GAP_PX[r.gap] ?? GAP_PX.md;
      let dx = 0;
      let dy = 0;
      if (r.rel === 'inside') { dx = anchor.x + (anchor.w - sat.w) / 2; dy = anchor.y + (anchor.h - sat.h) / 2; }
      if (r.rel === 'above') { dx = anchor.x + (anchor.w - sat.w) / 2; dy = anchor.y - gap - sat.h; }
      if (r.rel === 'below') { dx = anchor.x + (anchor.w - sat.w) / 2; dy = anchor.y + anchor.h + gap; }
      if (r.rel === 'left-of') { dx = anchor.x - gap - sat.w; dy = anchor.y + (anchor.h - sat.h) / 2; }
      if (r.rel === 'right-of') { dx = anchor.x + anchor.w + gap; dy = anchor.y + (anchor.h - sat.h) / 2; }
      // push outward until the satellite clears every other member of the host
      if (r.rel !== 'inside') {
        const step = { above: [0, -1], below: [0, 1], 'left-of': [-1, 0], 'right-of': [1, 0] }[r.rel] as [number, number];
        for (let guard = 0; guard < 50; guard++) {
          const box = { x: dx, y: dy, w: sat.w, h: sat.h };
          const hit = host.members.find((m) => m.id !== r.of && overlaps(box, memberBox(host, m.id), 8));
          if (!hit) break;
          const hb = memberBox(host, hit.id);
          if (step[1] < 0) dy = hb.y - gap - sat.h;
          if (step[1] > 0) dy = hb.y + hb.h + gap;
          if (step[0] < 0) dx = hb.x - gap - sat.w;
          if (step[0] > 0) dx = hb.x + hb.w + gap;
        }
      }
      const region = host.region ?? sat.region;
      absorb(host, sat, dx, dy);
      host.region = region;
      normalize(host);
    }
  }

  // ── arrange top-level blocks by region around the centre stack ──
  const top = [...blocks].sort((a, b) => a.order - b.order);
  const at = new Map<Block, { x: number; y: number }>();
  // without an explicit centre, the biggest block anchors everything else
  if (top.length && !top.some((b) => !b.region || b.region === 'center')) {
    const biggest = top.reduce((m, b) => (b.w * b.h > m.w * m.h ? b : m), top[0]);
    biggest.region = 'center';
  }
  const centre = top.filter((b) => !b.region || b.region === 'center');
  let y = 0;
  const cw = Math.max(0, ...centre.map((b) => b.w));
  for (const b of centre) { at.set(b, { x: (cw - b.w) / 2 - cw / 2, y }); y += b.h + REGION_GAP; }
  const ch = Math.max(0, y - REGION_GAP);
  for (const b of centre) at.get(b)!.y -= ch / 2;
  const C = { x: -cw / 2, y: -ch / 2, w: cw, h: ch };

  let topY = C.y;
  let botY = C.y + C.h;
  for (const b of top.filter((x) => x.region === 'top')) { topY -= REGION_GAP + b.h; at.set(b, { x: -b.w / 2, y: topY }); }
  for (const b of top.filter((x) => x.region === 'bottom')) { at.set(b, { x: -b.w / 2, y: botY + REGION_GAP }); botY += REGION_GAP + b.h; }
  let leftX = C.x;
  let rightX = C.x + C.w;
  for (const b of top.filter((x) => x.region === 'left')) { leftX -= REGION_GAP + b.w; at.set(b, { x: leftX, y: -b.h / 2 }); }
  for (const b of top.filter((x) => x.region === 'right')) { at.set(b, { x: rightX + REGION_GAP, y: -b.h / 2 }); rightX += REGION_GAP + b.w; }
  // corners: beside a tall or square centre (top/bottom aligned), above/below a wide one
  const wide = C.w > C.h * 1.6;
  let cornerTL = C.y, cornerTR = C.y, cornerBL = C.y + C.h, cornerBR = C.y + C.h;
  for (const b of top.filter((x) => x.region === 'top-left' || x.region === 'top-right')) {
    const left = b.region === 'top-left';
    if (wide) { topY -= REGION_GAP + b.h; at.set(b, { x: left ? C.x : C.x + C.w - b.w, y: topY }); continue; }
    const x = left ? Math.min(C.x, leftX) - REGION_GAP - b.w : Math.max(C.x + C.w, rightX) + REGION_GAP;
    const y = left ? cornerTL : cornerTR;
    at.set(b, { x, y });
    if (left) cornerTL += b.h + GAP_PX.md; else cornerTR += b.h + GAP_PX.md;
  }
  for (const b of top.filter((x) => x.region === 'bottom-left' || x.region === 'bottom-right')) {
    const left = b.region === 'bottom-left';
    if (wide) { at.set(b, { x: left ? C.x : C.x + C.w - b.w, y: botY + REGION_GAP }); botY += REGION_GAP + b.h; continue; }
    const x = left ? Math.min(C.x, leftX) - REGION_GAP - b.w : Math.max(C.x + C.w, rightX) + REGION_GAP;
    const y = (left ? cornerBL : cornerBR) - b.h;
    at.set(b, { x, y });
    if (left) cornerBL -= b.h + GAP_PX.md; else cornerBR -= b.h + GAP_PX.md;
  }

  const boxes = new Map<string, Box>();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [b, p] of at) {
    for (const m of b.members) {
      const s = sizes.get(m.id)!;
      const box = { x: p.x + m.dx, y: p.y + m.dy, w: s.w, h: s.h };
      boxes.set(m.id, box);
      x0 = Math.min(x0, box.x); y0 = Math.min(y0, box.y);
      x1 = Math.max(x1, box.x + box.w); y1 = Math.max(y1, box.y + box.h);
    }
  }
  const world = boxes.size ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
  return { boxes, world };
}

/** Uniform fit of a world box into a viewport, never upscaling past `maxScale`. */
export function fitTransform(world: Box, view: Box, maxScale = 1.3, pad = 24) {
  const w = Math.max(1, world.w + pad * 2);
  const h = Math.max(1, world.h + pad * 2);
  const scale = Math.min(maxScale, view.w / w, view.h / h);
  return {
    scale,
    x: view.x + view.w / 2 - (world.x + world.w / 2) * scale,
    y: view.y + view.h / 2 - (world.y + world.h / 2) * scale,
  };
}

/** Pairs of laid-out boxes that overlap (used by tests and the Scene Lab audit). */
export function overlapping(boxes: Map<string, Box>, pad = 0): [string, string][] {
  const ids = [...boxes.keys()];
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = boxes.get(ids[i])!;
    const b = boxes.get(ids[j])!;
    if (a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad) out.push([ids[i], ids[j]]);
  }
  return out;
}
