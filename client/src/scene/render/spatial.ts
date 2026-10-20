/**
 * Builders for things that live in a coordinate space (domain units):
 * axes, points, polygons, lines, paths, angles, function plots, vectors,
 * bodies, scatter plots. Also lines/angles attached to other entities' parts.
 */
import gsap from 'gsap';
import { compileExpr } from '../../engine/canvas/mathExpr';
import { textWidth, type SpaceMap } from '../geometry';
import { AXIS, INK, INK_DIM, TONES, toneColor } from '../tokens';
import type { Box, EntityOf, Pt, Space } from '../types';
import { arrowMarker, el, mathText, text } from './svg';
import type { BuildCtx, Built, PartRef } from './types';

const fmt = (v: number) => (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : String(Number(v.toFixed(1))));
const BODY_R: Record<string, number> = { xs: 8, sm: 11, md: 16, lg: 22, xl: 30 };

// ── label placement in spaces ────────────────────────────────────────────────

const overlapsBox = (a: Box, b: Box, pad = 3) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const crosses = (b: Box, [a, c]: [Pt, Pt]) => {
  for (let i = 0; i <= 16; i++) {
    const x = a.x + ((c.x - a.x) * i) / 16, y = a.y + ((c.y - a.y) * i) / 16;
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
};
/** a label's printed text, roughly (LaTeX markup stripped) — for measuring */
const plain = (s: string) => s.replace(/\\[a-zA-Z]+|[{}_^$\\]/g, '');

/** Every vector of a space, in pixels: labels keep off all of them, not just those built so far. */
const vectorSegments = (ctx: BuildCtx, spaceId: string, map: SpaceMap): [Pt, Pt][] =>
  ctx.scene.entities.flatMap((x) => {
    if (x.type !== 'vector' || x.space !== spaceId) return [];
    const mag = x.magnitude ?? 0, r = ((x.angleDeg ?? 0) * Math.PI) / 180;
    const toU: [number, number] = x.to ?? [x.from[0] + mag * Math.cos(r), x.from[1] + mag * Math.sin(r)];
    return [[map.toPx(x.from), map.toPx(toU)] as [Pt, Pt]];
  });

/** Beyond an arrow's tip, on the side it points, clear of other labels and arrows. */
function vectorLabelSpot(ctx: BuildCtx, segs: [Pt, Pt][], from: Pt, to: Pt, label: string, size: number) {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  const nx = -uy, ny = ux;
  const w = textWidth(plain(label), size, 650) + 4, h = size + 6;
  const anchor: 'start' | 'end' | 'middle' = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
  const boxAt = (x: number, y: number): Box => ({ x: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, y: y - h / 2, w, h });
  const placed = (ctx.labels ??= []);
  let first: { x: number; y: number; box: Box } | undefined;
  for (const dist of [14, 28, 44]) {
    for (const shift of [0, 18, -18, 36, -36]) {
      const x = to.x + ux * dist + nx * shift, y = to.y + uy * dist + ny * shift;
      const box = boxAt(x, y);
      first ??= { x, y, box };
      if (!placed.some((b) => overlapsBox(b, box)) && !segs.some((s) => crosses(box, s))) return { x, y, box, anchor };
    }
  }
  return { ...first!, anchor };
}

function shell(ctx: BuildCtx, id: string) {
  const root = el('g', { 'data-id': id }, ctx.layer);
  const fx = el('g', { class: 'fx', opacity: 0 }, root);
  return { root, fx };
}

const bounds = (pts: Pt[], pad = 0): Box => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
};

/** Axes, ticks and grid for a cartesian space. */
export function buildSpace(ctx: BuildCtx, space: Space, map: SpaceMap): Built {
  const { root, fx } = shell(ctx, space.id);
  const { inner } = map;
  const draws: SVGGeometryElement[] = [];
  if (space.grid) {
    for (const t of map.ticks.x) { const p = map.toPx([t, space.y[0]]); el('line', { x1: p.x, y1: inner.y, x2: p.x, y2: inner.y + inner.h, stroke: 'rgba(255,255,255,0.06)' }, fx); }
    for (const t of map.ticks.y) { const p = map.toPx([space.x[0], t]); el('line', { x1: inner.x, y1: p.y, x2: inner.x + inner.w, y2: p.y, stroke: 'rgba(255,255,255,0.06)' }, fx); }
  }
  if (space.axes) {
    const y0 = space.y[0] <= 0 && space.y[1] >= 0 ? 0 : space.y[0];
    const x0 = space.x[0] <= 0 && space.x[1] >= 0 ? 0 : space.x[0];
    const ax = map.toPx([space.x[0], y0]);
    const ay = map.toPx([x0, space.y[0]]);
    draws.push(el('line', { x1: inner.x - 8, y1: ax.y, x2: inner.x + inner.w + 8, y2: ax.y, stroke: AXIS, 'stroke-width': 1.4 }, fx));
    draws.push(el('line', { x1: ay.x, y1: inner.y + inner.h + 8, x2: ay.x, y2: inner.y - 8, stroke: AXIS, 'stroke-width': 1.4 }, fx));
    for (const t of map.ticks.x) {
      const p = map.toPx([t, y0]);
      el('line', { x1: p.x, y1: p.y - 3, x2: p.x, y2: p.y + 3, stroke: AXIS }, fx);
      text(fx, fmt(t), { x: p.x, y: p.y + 16, size: 11, weight: 400, fill: 'rgba(255,255,255,0.45)' });
      const w = textWidth(fmt(t), 11, 400);
      (ctx.labels ??= []).push({ x: p.x - w / 2, y: p.y + 10, w, h: 12 });
    }
    for (const t of map.ticks.y) {
      if (t === y0) continue;
      const p = map.toPx([x0, t]);
      el('line', { x1: p.x - 3, y1: p.y, x2: p.x + 3, y2: p.y, stroke: AXIS }, fx);
      text(fx, fmt(t), { x: p.x - 8, y: p.y, size: 11, weight: 400, fill: 'rgba(255,255,255,0.45)', anchor: 'end' });
      const w = textWidth(fmt(t), 11, 400);
      (ctx.labels ??= []).push({ x: p.x - 8 - w, y: p.y - 6, w, h: 12 });
    }
    if (space.xLabel) mathText(fx, space.xLabel, { x: inner.x + inner.w, y: ax.y - 14, size: 12, fill: INK_DIM, anchor: 'end' });
    if (space.yLabel) mathText(fx, space.yLabel, { x: ay.x + 10, y: inner.y + 4, size: 12, fill: INK_DIM, anchor: 'start' });
  }
  return { entity: space as never, root, fx, box: map.box, draws, extra: { map } };
}

/** Sector path from angle a0 to a1 (radians), the short way round. */
export function wedgePath(o: Pt, a0: number, a1: number, r: number) {
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const p0 = { x: o.x + r * Math.cos(a0), y: o.y + r * Math.sin(a0) };
  const p1 = { x: o.x + r * Math.cos(a0 + d), y: o.y + r * Math.sin(a0 + d) };
  return { d: `M${o.x},${o.y} L${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} Z`, mid: a0 + d / 2, deg: Math.abs((d * 180) / Math.PI) };
}

/** Catmull-Rom → cubic Bézier through the points. */
function smoothPath(pts: Pt[]) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function buildSpatial(ctx: BuildCtx, e: EntityOf<any>): Built | null {
  const spaceId = 'space' in e ? (e as { space?: string }).space : undefined;
  const map = spaceId ? ctx.spaces.get(spaceId) : undefined;
  const P = (v: unknown): Pt | null => (Array.isArray(v) ? (map ? map.toPx(v as [number, number]) : null) : typeof v === 'string' ? ctx.anchor(v) : null);
  const color = toneColor(e.tone, e.type === 'point' ? TONES.warning : e.type === 'plot' ? TONES.info : e.type === 'polygon' ? TONES.primary : INK);
  const { root, fx } = shell(ctx, e.id);
  const glowFilter = `url(#${ctx.uid}-glow)`;

  switch (e.type) {
    case 'point': {
      const p = map!.toPx(e.at);
      const glow = el('circle', { cx: p.x, cy: p.y, r: 11, fill: color, filter: glowFilter, opacity: 0.7 }, fx);
      const dot = el('circle', { cx: p.x, cy: p.y, r: 7, fill: color }, fx);
      if (e.label) {
        mathText(fx, e.label, { x: p.x + 12, y: p.y - 16, size: 14, weight: 650, anchor: 'start' });
        (ctx.labels ??= []).push({ x: p.x + 12, y: p.y - 26, w: textWidth(plain(e.label), 14, 650), h: 20 });
      }
      return { entity: e, root, fx, box: { x: p.x - 12, y: p.y - 12, w: 24, h: 24 }, paint: { fill: dot, glow, base: { fill: color, glow: color } } };
    }
    case 'polygon': {
      const pts = (e.points as [number, number][]).map((q) => map!.toPx(q));
      const d = `${pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} Z`;
      const fill = el('path', { d, fill: color, 'fill-opacity': e.fill ? 0.09 : 0, stroke: 'none' }, fx);
      const glow = el('path', { d, fill: 'none', stroke: color, 'stroke-width': 6, filter: glowFilter, opacity: 0 }, fx);
      const stroke = el('path', { d, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linejoin': 'round' }, fx);
      const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
      const parts = new Map<string, PartRef>();
      pts.forEach((p, i) => {
        const dot = el('circle', { cx: p.x, cy: p.y, r: 5.5, fill: INK }, fx);
        const name = (e.vertexLabels as string[] | undefined)?.[i];
        if (!name) return;
        const away = Math.atan2(p.y - c.y, p.x - c.x);
        const t = text(fx, name, { x: p.x + Math.cos(away) * 24, y: p.y + Math.sin(away) * 24, size: 18, weight: 700 });
        parts.set(name, { paints: [{ fill: dot, text: t, base: { fill: INK, text: INK } }], at: p, box: { x: p.x - 8, y: p.y - 8, w: 16, h: 16 } });
      });
      return { entity: e, root, fx, box: bounds(pts, 24), draws: [stroke], paint: { glow, stroke, base: { stroke: color, glow: color } }, part: (n) => parts.get(n) ?? null, extra: { fill } };
    }
    case 'line':
    case 'arrow': {
      const a = P(e.from), b = P(e.to);
      if (!a || !b) return null;
      const marker = e.type === 'arrow' ? `url(#${arrowMarker(ctx.svg, ctx.uid, color)})` : undefined;
      const line = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-opacity': e.dashed ? 0.6 : 0.9, 'stroke-width': e.dashed ? 2 : 2.6, 'stroke-dasharray': e.dashed ? '8 7' : undefined, 'marker-end': marker, 'stroke-linecap': 'round' }, fx);
      if (e.label) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const far = { x: b.x + Math.cos(ang) * 6, y: b.y + Math.sin(ang) * 6 };
        mathText(fx, e.label, { x: far.x - Math.sin(ang) * 16, y: far.y - 14, size: 14, weight: 600, fill: INK_DIM, anchor: 'end' });
      }
      return { entity: e, root, fx, box: bounds([a, b], 8), draws: [line], paint: { stroke: line, base: { stroke: color } } };
    }
    case 'path': {
      const pts = (e.points as [number, number][]).map((q) => map!.toPx(q));
      const path = el('path', { d: e.smooth ? smoothPath(pts) : pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }, fx);
      return { entity: e, root, fx, box: bounds(pts, 6), draws: [path], paint: { stroke: path, base: { stroke: color } }, extra: { points: pts } };
    }
    case 'angle': {
      const v = P(e.vertex), a = P(e.from), b = P(e.to);
      if (!v || !a || !b) return null;
      const angColor = toneColor(e.tone, TONES.warning);
      const w = wedgePath(v, Math.atan2(a.y - v.y, a.x - v.x), Math.atan2(b.y - v.y, b.x - v.x), 48);
      const glow = el('path', { d: w.d, fill: angColor, filter: glowFilter, opacity: 0 }, fx);
      const wedge = el('path', { d: w.d, fill: angColor, 'fill-opacity': 0.2, stroke: angColor, 'stroke-width': 2.2 }, fx);
      const value = `${fmt(w.deg)}°`;
      const label = e.label ? (/[\d°]/.test(e.label) ? e.label : e.showValue ? `${e.label} = ${value}` : e.label) : value;
      const lp = { x: v.x + Math.cos(w.mid) * 78, y: v.y + Math.sin(w.mid) * 78 };
      const t = mathText(fx, label, { x: lp.x, y: lp.y, size: 15, weight: 650, fill: angColor === TONES.warning ? '#FBBF24' : angColor });
      const lw = textWidth(plain(label), 15, 650);
      (ctx.labels ??= []).push({ x: lp.x - lw / 2, y: lp.y - 11, w: lw, h: 22 });
      return { entity: e, root, fx, box: bounds([v, lp], 30), paint: { stroke: wedge, glow, text: t, base: { stroke: angColor, glow: angColor, text: t.getAttribute('fill')! } }, extra: { degrees: w.deg } };
    }
    case 'plot': {
      const f = compileExpr(e.expr);
      const [x0, x1] = (e.domain as [number, number] | undefined) ?? map!.space.x;
      const N = 200;
      const pts: Pt[] = [];
      const segs: Pt[][] = [[]];
      for (let i = 0; i <= N; i++) {
        const x = x0 + ((x1 - x0) * i) / N;
        const y = f(x);
        const inRange = Number.isFinite(y) && y >= map!.space.y[0] - (map!.space.y[1] - map!.space.y[0]) * 0.05 && y <= map!.space.y[1] * 1.05 + 1e-9;
        if (!inRange) { if (segs[segs.length - 1].length) segs.push([]); continue; }
        const p = map!.toPx([x, y]);
        segs[segs.length - 1].push(p);
        pts.push(p);
      }
      const d = segs.filter((s) => s.length > 1).map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')).join(' ');
      const path = el('path', { d: d || 'M0,0', fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, fx);
      return { entity: e, root, fx, box: pts.length ? bounds(pts, 6) : map!.inner, draws: [path], paint: { stroke: path, base: { stroke: color } }, extra: { points: pts } };
    }
    case 'vector': {
      const from = map!.toPx(e.from);
      const mag = e.magnitude ?? 0;
      const rad = ((e.angleDeg ?? 0) * Math.PI) / 180;
      const toU: [number, number] = e.to ?? [e.from[0] + mag * Math.cos(rad), e.from[1] + mag * Math.sin(rad)];
      const to = map!.toPx(toU);
      const vColor = toneColor(e.tone, INK);
      const line = el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: vColor, 'stroke-width': 3, 'marker-end': `url(#${arrowMarker(ctx.svg, ctx.uid, vColor)})`, 'stroke-linecap': 'round' }, fx);
      let label: SVGTextElement | undefined;
      let labelOffset = { dx: 12, dy: -10 };
      if (e.label) {
        const spot = vectorLabelSpot(ctx, vectorSegments(ctx, e.space, map!), from, to, e.label, 15);
        ctx.labels!.push(spot.box);
        label = mathText(fx, e.label, { x: spot.x, y: spot.y, size: 15, weight: 650, fill: vColor, anchor: spot.anchor });
        labelOffset = { dx: spot.x - to.x, dy: spot.y - to.y };
      }
      return { entity: e, root, fx, box: bounds([from, to], 10), draws: [line], paint: { stroke: line, base: { stroke: vColor } }, extra: { line, label, labelOffset, map, fromU: e.from, toU } };
    }
    case 'body': {
      const p = map!.toPx(e.at);
      const r = BODY_R[e.size] ?? 11;
      const g = el('g', {}, fx);
      gsap.set(g, { x: p.x, y: p.y });
      const glow = el('circle', { r: r + 6, fill: INK, filter: glowFilter, opacity: 0.6 }, g);
      el('circle', { r, fill: INK }, g);
      if (e.label) {
        mathText(g, e.label, { x: r + 8, y: -r - 8, size: 14, weight: 650, anchor: 'start' });
        (ctx.labels ??= []).push({ x: p.x + r + 8, y: p.y - r - 18, w: textWidth(plain(e.label), 14, 650), h: 20 });
      }
      return { entity: e, root, fx, box: { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }, paint: { glow, base: { glow: INK } }, extra: { mover: g, map } };
    }
    case 'scatter': {
      const palette = [TONES.primary, TONES.warning, TONES.success, TONES.accent, TONES.info];
      const classes = [...new Set((e.points as { cls?: string }[]).map((p) => p.cls ?? ''))];
      const pts = (e.points as { at: [number, number]; cls?: string }[]).map((q) => {
        const p = map!.toPx(q.at);
        el('circle', { cx: p.x, cy: p.y, r: 6, fill: palette[classes.indexOf(q.cls ?? '') % palette.length], 'fill-opacity': 0.9 }, fx);
        return p;
      });
      return { entity: e, root, fx, box: bounds(pts, 8) };
    }
    default:
      root.remove();
      return null;
  }
}
