/**
 * Builders for board entities (laid out by relations): text, math, shapes,
 * data structures, tables, trees, graphs, molecules, networks, pixel grids.
 * Styling follows the launch film; everything starts hidden.
 */
import katex from 'katex';
import { estimateLatexSize, LIST, NET, QUEUE, STACK, TEXT_ROLE } from '../measure';
import { CELL, CPK, FONT_MONO, INK, INK_DIM, SIZE_PX, STATES, TONES, toneColor, badgeStyle, ARRAY_PALETTE } from '../tokens';
import type { EntityOf, Pt } from '../types';
import { arrowMarker, el, text, translate } from './svg';
import type { BuildCtx, Built, ItemHandle, Paint, PartRef } from './types';

const DEFAULT_STROKE = STATES.default.stroke;

function shell(ctx: BuildCtx, id: string) {
  const box = ctx.boxes.get(id)!;
  const root = el('g', { 'data-id': id }, ctx.layer);
  translate(root, box.x, box.y);
  const fx = el('g', { class: 'fx', opacity: 0 }, root);
  return { box, root, fx };
}

function entityLabel(fx: SVGGElement, label: string | undefined, w: number) {
  if (!label) return;
  const t = text(fx, label.toUpperCase(), { x: w / 2, y: 12, size: 13, weight: 650, fill: INK_DIM });
  t.setAttribute('letter-spacing', '2.4');
}

/** A rounded cell in the app's clean card style: solid opaque fill, crisp border, zero glow. */
function cell(parent: SVGGElement, uid: string, w: number, h: number, value: string, opts: { r?: number; font?: number; mono?: boolean; tone?: string; fill?: string; stroke?: string } = {}): { g: SVGGElement; paint: Paint; label: SVGTextElement } {
  const g = el('g', {}, parent);
  const r = opts.r ?? CELL.radius;
  const fillCol = opts.fill ?? STATES.default.fill;
  const strokeCol = opts.stroke ?? (opts.tone ? toneColor(opts.tone) : DEFAULT_STROKE);
  // Solid opaque card background
  const bg = el('rect', { width: w, height: h, rx: r, fill: fillCol, stroke: strokeCol, 'stroke-width': 1.6 }, g);
  const overlay = el('rect', { width: w, height: h, rx: r, fill: fillCol, stroke: strokeCol, 'stroke-width': 1.6 }, g);
  const label = text(g, value, { x: w / 2, y: h / 2 + 1, size: opts.font ?? CELL.font, weight: 500, mono: opts.mono ?? true });
  return { g, label, paint: { fill: overlay, stroke: bg, text: label, base: { fill: fillCol, stroke: strokeCol, text: INK, glow: 'none' } } };
}

const itemsFor = (ctx: BuildCtx, id: string) => ctx.sim.items.get(id) ?? [];

export function buildBoard(ctx: BuildCtx, e: EntityOf<any>): Built | null {
  const m = ctx.sizes.get(e.id);
  if (!m) return null;
  const { box, root, fx } = shell(ctx, e.id);
  const top = m.bodyY;
  entityLabel(fx, e.label, e.type === 'stack' ? m.w * 2 - STACK.w : m.w);
  const base: Built = { entity: e, root, fx, box };

  switch (e.type) {
    case 'text': {
      const role = TEXT_ROLE[e.role] ?? TEXT_ROLE.body;
      const badge = badgeStyle({ role: e.role, tone: e.tone, text: e.text });
      const boxH = Math.max(34, m.h - top);
      const r = boxH / 2; // Exact full pill capsule border radius

      // Solid opaque pill card background
      const frame = el('rect', {
        x: 0,
        y: top,
        width: m.w,
        height: boxH,
        rx: r,
        ry: r,
        fill: badge.fill,
        stroke: badge.stroke,
        'stroke-width': 1.5,
      }, fx);

      // Centered readable text inside pill
      const t = el('text', {
        x: m.w / 2,
        y: top + boxH / 2 + 1,
        'font-family': role.mono ? FONT_MONO : 'Geist, Inter, system-ui, sans-serif',
        'font-size': role.size,
        'font-weight': role.weight,
        fill: badge.text,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      }, fx);

      // texts the lesson changes later stay on one line so text tweens can swap them cleanly
      const dynamic = ctx.scene.beats.some((bt) => bt.actions.some((ac) => ac.do === 'set' && ac.target === e.id));
      (dynamic ? [e.text] : m.lines ?? [e.text]).forEach((line, i) => {
        const span = el('tspan', { x: m.w / 2, dy: i === 0 ? 0 : role.size * 1.32 }, t);
        span.textContent = line;
      });
      return { ...base, textEl: t, paint: { stroke: frame, text: t, base: { stroke: badge.stroke, fill: badge.fill, text: badge.text } } };
    }
    case 'math': {
      const latex = new Map<string, SVGForeignObjectElement>();
      const variants = [e.latex];
      for (const b of ctx.scene.beats) for (const a of b.actions) if (a.do === 'set' && a.target === e.id && a.latex) variants.push(a.latex);
      const boxH = Math.max(56, m.h - top);
      const r = boxH / 2; // Pill capsule layout
      [...new Set(variants)].forEach((tex, i) => {
        const fo = el('foreignObject', { x: 0, y: top, width: m.w, height: boxH, opacity: i === 0 ? 1 : 0 }, fx);
        const div = document.createElement('div');
        div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0 32px;box-sizing:border-box;white-space:nowrap;color:#FFFFFF;font-size:28px;`;
        div.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode: false, output: 'html' });
        fo.appendChild(div);
        latex.set(tex, fo);
      });
      const frame = el('rect', { 
        x: 0, 
        y: top, 
        width: m.w, 
        height: boxH, 
        rx: r, 
        ry: r, 
        fill: '#0F1012', 
        stroke: '#22252A',
        'stroke-width': 1.5
      }, fx);
      fx.insertBefore(frame, fx.firstChild);
      return { ...base, latex, paint: { stroke: frame, base: { stroke: '#22252A', fill: '#0F1012' } } };
    }
    case 'rect':
    case 'circle': {
      const s = SIZE_PX[e.size] ?? 110;
      const color = toneColor(e.tone, '#3B82F6');
      const w = e.type === 'circle' ? m.w : m.w;
      const h = m.h - top;
      const shape = e.type === 'circle'
        ? el('circle', { cx: w / 2, cy: top + h / 2, r: h / 2, fill: color, 'fill-opacity': 0.12, stroke: color, 'stroke-width': 2.4 }, fx)
        : el('rect', { x: 0, y: top, width: w, height: h, rx: Math.min(18, s / 5), fill: color, 'fill-opacity': 0.12, stroke: color, 'stroke-width': 2.4 }, fx);
      const t = e.text ? text(fx, e.text, { x: w / 2, y: top + h / 2, size: 20, weight: 600 }) : undefined;
      return { ...base, textEl: t, draws: [shape as SVGGeometryElement], paint: { stroke: shape, text: t, base: { stroke: color, text: INK, glow: 'none' } } };
    }
    case 'pie': {
      const color = toneColor(e.tone, '#38BDF8');
      const r = (m.h - top) / 2 - 3;
      const c = { x: m.w / 2, y: top + (m.h - top) / 2 };
      const n = e.slices as number;
      const isShaded = (i: number) => (Array.isArray(e.shaded) ? (e.shaded as number[]).includes(i) : i < (e.shaded as number));
      const at = (deg: number, rr = r): Pt => ({ x: c.x + rr * Math.cos((deg * Math.PI) / 180), y: c.y + rr * Math.sin((deg * Math.PI) / 180) });
      const parts = new Map<string, PartRef>();
      const draws: SVGGeometryElement[] = [];
      const slices: SVGGElement[] = [];
      for (let i = 0; i < n; i++) {
        const a0 = -90 + (360 * i) / n, a1 = a0 + 360 / n;
        const p0 = at(a0), p1 = at(a1);
        const d = n === 1 ? '' : `M${c.x},${c.y} L${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Z`;
        const g = el('g', {}, fx);
        slices.push(g);
        const glow = el('path', { d, fill: 'rgba(0,0,0,0)', filter: `url(#${ctx.uid}-glow)`, opacity: 0 }, g);
        // an empty slice keeps a faint backdrop and a clear overlay, so highlighting tints it
        // (it must never look "taken" like a shaded one)
        if (!isShaded(i)) el('path', { d, fill: 'rgba(255,255,255,0.04)' }, g);
        const baseFill = isShaded(i) ? color : STATES.default.fill;
        const slice = el('path', { d, fill: baseFill, 'fill-opacity': isShaded(i) ? 0.85 : 1, stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
        draws.push(slice as SVGGeometryElement);
        const mid = at((a0 + a1) / 2, r * 0.62);
        const label = e.sliceLabels?.[i] ? text(g, e.sliceLabels[i], { x: mid.x, y: mid.y, size: 15, weight: 650, fill: isShaded(i) ? '#0B0B12' : INK }) : undefined;
        parts.set(`s${i}`, {
          paints: [{ fill: slice, glow, text: label, base: { fill: baseFill, glow: 'rgba(0,0,0,0)', text: label?.getAttribute('fill') ?? INK } }],
          at: { x: box.x + mid.x, y: box.y + mid.y },
          box: { x: box.x + mid.x - r * 0.3, y: box.y + mid.y - r * 0.3, w: r * 0.6, h: r * 0.6 },
        });
      }
      const rim = el('circle', { cx: c.x, cy: c.y, r, fill: 'none', stroke: color, 'stroke-width': 2.4 }, fx);
      // "rearrange into strip": slices side by side, alternating, so they interlock into a
      // near-parallelogram — the first half's arcs along the top, the other half's along the
      // bottom (base ≈ half the circumference = πr, height = r). Each slice turns about the
      // centre until it points straight up/down, then its tip goes to its place in the row.
      const chord = 2 * r * Math.sin(Math.PI / n);
      const half = Math.floor(n / 2);
      const x0 = c.x - ((n - 1) * chord) / 4;
      const yTop = c.y - r / 2;
      const strip = slices.map((_, i) => {
        const upper = i < half;
        const pos = upper ? 2 * i + 1 : 2 * (i - half);
        const axis = -90 + (360 * (i + 0.5)) / n;
        const rot = ((((upper ? -90 : 90) - axis) % 360) + 540) % 360 - 180;
        return { dx: x0 + (pos * chord) / 2 - c.x, dy: (upper ? yTop + r : yTop) - c.y, rot };
      });
      return {
        ...base, draws: [...draws, rim as SVGGeometryElement], part: (name) => parts.get(name) ?? null, paint: { stroke: rim, base: { stroke: color } },
        extra: { pie: { slices, rim, center: c, strip } },
      };
    }
    case 'array': {
      const items = new Map<string, ItemHandle>();
      const slotAt = (i: number): Pt => ({ x: i * (CELL.size + CELL.gap), y: top });
      const n = Math.max(1, ctx.sim.maxLen.get(e.id) ?? 1);
      const decor: SVGElement[] = [];
      if (e.indices) for (let i = 0; i < n; i++) decor.push(text(fx, String(i), { x: slotAt(i).x + CELL.size / 2, y: top + CELL.size + 18, size: 15, weight: 400, fill: '#8F8F8F', opacity: 0 }));
      const allItems = itemsFor(ctx, e.id);
      allItems.forEach((it, idx) => {
        const pal = ARRAY_PALETTE[idx % ARRAY_PALETTE.length];
        const c = cell(fx, ctx.uid, CELL.size, CELL.size, String(it.value), { fill: pal.fill, stroke: pal.stroke });
        c.g.setAttribute('opacity', '0');
        items.set(it.key, { key: it.key, ...c });
      });
      return {
        ...base, items, slotAt, slotDecor: decor,
        entryFrom: (i) => ({ x: slotAt(i).x, y: top - CELL.size * 1.2 }),
        exitTo: (i) => ({ x: slotAt(i).x, y: top - CELL.size * 1.3 }),
      };
    }
    case 'stack': {
      const n = Math.max(2, ctx.sim.maxLen.get(e.id) ?? 0);
      const itemW = STACK.w - 28;
      const bottom = top + STACK.pad + n * (STACK.itemH + STACK.gap);
      const gx = STACK.gutter;
      const slotAt = (i: number): Pt => ({ x: gx + 14, y: bottom - (i + 1) * (STACK.itemH + STACK.gap) + STACK.gap / 2 });
      const walls = el('path', { d: `M${gx},${top} L${gx},${bottom + 6} L${gx + STACK.w},${bottom + 6} L${gx + STACK.w},${top}`, fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, fx);
      const items = new Map<string, ItemHandle>();
      itemsFor(ctx, e.id).forEach((it, k) => {
        const c = cell(fx, ctx.uid, itemW, STACK.itemH, String(it.value), { r: 14, tone: ['primary', 'success', 'warning', 'accent', 'info'][k % 5] });
        c.g.setAttribute('opacity', '0');
        items.set(it.key, { key: it.key, ...c });
      });
      return {
        ...base, items, slotAt, draws: [walls],
        entryFrom: () => ({ x: gx + 14, y: top - STACK.itemH * 2.2 }),
        exitTo: () => ({ x: gx + 14, y: top - STACK.itemH * 2.4 }),
        extra: { topPointer: true },
      };
    }
    case 'queue': {
      const n = Math.max(3, ctx.sim.maxLen.get(e.id) ?? 0);
      const x0 = QUEUE.pad + 35;
      const slotAt = (i: number): Pt => ({ x: x0 + i * (QUEUE.itemW + QUEUE.gap), y: top + QUEUE.pad });
      const right = x0 + n * (QUEUE.itemW + QUEUE.gap) + 20;
      const tube = [
        el('line', { x1: x0 - 22, y1: top, x2: right, y2: top, stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 2.2 }, fx),
        el('line', { x1: x0 - 22, y1: top + QUEUE.itemH + QUEUE.pad * 2, x2: right, y2: top + QUEUE.itemH + QUEUE.pad * 2, stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 2.2 }, fx),
      ];
      text(fx, 'out', { x: x0 - 30, y: top + QUEUE.pad + QUEUE.itemH / 2, size: 13, mono: true, fill: INK_DIM, anchor: 'end' });
      text(fx, 'in', { x: right + 8, y: top + QUEUE.pad + QUEUE.itemH / 2, size: 13, mono: true, fill: INK_DIM, anchor: 'start' });
      const items = new Map<string, ItemHandle>();
      itemsFor(ctx, e.id).forEach((it, k) => {
        const c = cell(fx, ctx.uid, QUEUE.itemW, QUEUE.itemH, String(it.value), { r: 14, tone: ['primary', 'success', 'warning', 'accent', 'info'][k % 5] });
        c.g.setAttribute('opacity', '0');
        items.set(it.key, { key: it.key, ...c });
      });
      return {
        ...base, items, slotAt, draws: tube,
        entryFrom: () => ({ x: right + 40, y: top + QUEUE.pad }),
        exitTo: () => ({ x: x0 - QUEUE.itemW - 60, y: top + QUEUE.pad }),
        extra: { pointers: { y: top + QUEUE.itemH + QUEUE.pad * 2 + 12 } },
      };
    }
    case 'linkedlist': {
      const n = Math.max(1, ctx.sim.maxLen.get(e.id) ?? 1);
      const slotAt = (i: number): Pt => ({ x: i * (LIST.nodeW + LIST.link), y: top });
      const decor: SVGElement[] = [];
      // links are pointers: arrows to the next node (both ways in a doubly linked list)
      const marker = `url(#${arrowMarker(ctx.svg, ctx.uid, INK_DIM)})`;
      for (let i = 0; i < n - 1; i++) {
        const a = slotAt(i);
        decor.push(el('line', {
          x1: a.x + LIST.nodeW + 4, y1: top + LIST.nodeH / 2, x2: a.x + LIST.nodeW + LIST.link - 6, y2: top + LIST.nodeH / 2,
          stroke: INK_DIM, 'stroke-width': 2, opacity: 0, 'marker-end': marker, 'marker-start': e.doubly ? marker : undefined,
        }, fx));
      }
      const items = new Map<string, ItemHandle>();
      for (const it of itemsFor(ctx, e.id)) {
        const c = cell(fx, ctx.uid, LIST.nodeW, LIST.nodeH, String(it.value), { r: 12, font: 22 });
        c.g.setAttribute('opacity', '0');
        items.set(it.key, { key: it.key, ...c });
      }
      return { ...base, items, slotAt, slotDecor: decor, entryFrom: (i) => ({ x: slotAt(i).x, y: top - 90 }), exitTo: (i) => ({ x: slotAt(i).x, y: top + 110 }) };
    }
    case 'table': {
      const colW = m.colW ?? [];
      const rows = [...(e.columns ? [e.columns] : []), ...e.rows.map((r) => r.map(String))];
      let y = top;
      rows.forEach((r, ri) => {
        let x = 0;
        const head = !!e.columns && ri === 0;
        r.forEach((v, ci) => {
          el('rect', { x, y, width: colW[ci], height: 46, fill: head ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', stroke: 'rgba(255,255,255,0.10)' }, fx);
          text(fx, v, { x: x + colW[ci] / 2, y: y + 23, size: head ? 14 : 17, weight: head ? 650 : 500, fill: head ? INK_DIM : INK, mono: !head });
          x += colW[ci];
        });
        y += 46;
      });
      return base;
    }
    case 'tree':
    case 'graph': {
      const geo = m.nodes!;
      const ox = -geo.box.x;
      const oy = top - geo.box.y;
      const P = (id: string) => ({ x: geo.pos.get(id)!.x + ox, y: geo.pos.get(id)!.y + oy });
      const edges = e.type === 'tree'
        ? (e.nodes as { id: string; parent?: string }[]).filter((n) => n.parent).map((n) => ({ from: n.parent!, to: n.id, weight: undefined as unknown }))
        : e.edges;
      const marker = e.type === 'graph' && e.directed ? `url(#${ctx.uid}-arrow-dir)` : undefined;
      if (marker && !ctx.svg.querySelector(`#${ctx.uid}-arrow-dir`)) {
        const mk = el('marker', { id: `${ctx.uid}-arrow-dir`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, ctx.svg.querySelector('defs')!);
        el('path', { d: 'M0,0 L10,5 L0,10 z', fill: INK_DIM }, mk);
      }
      // nodes created later on their own ("bst.n7") start hidden, with the edges that lead to them
      const deferred = new Set<string>();
      for (const bt of ctx.scene.beats) for (const ac of bt.actions) {
        if (ac.do !== 'create') continue;
        for (const t of Array.isArray(ac.target) ? ac.target : [ac.target]) {
          const mm = /^([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z0-9_-]+)$/.exec(t);
          if (mm && mm[1] === e.id) deferred.add(mm[2]);
        }
      }
      const draws: SVGGeometryElement[] = [];
      const edgeLayer = el('g', {}, fx);
      const edgesFor = new Map<string, SVGElement[]>();
      for (const ed of edges as { from: string; to: string; weight?: unknown }[]) {
        const a = P(ed.from);
        const b = P(ed.to);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const late = deferred.has(ed.to) ? ed.to : deferred.has(ed.from) ? ed.from : null;
        const g = el('g', { opacity: late ? 0 : undefined }, edgeLayer);
        const line = el('line', { x1: a.x + Math.cos(ang) * geo.r, y1: a.y + Math.sin(ang) * geo.r, x2: b.x - Math.cos(ang) * (geo.r + 4), y2: b.y - Math.sin(ang) * (geo.r + 4), stroke: 'rgba(242,240,234,0.4)', 'stroke-width': 2, 'marker-end': marker }, g);
        if (ed.weight !== undefined) text(g, String(ed.weight), { x: (a.x + b.x) / 2 + Math.sin(ang) * 14, y: (a.y + b.y) / 2 - Math.cos(ang) * 14, size: 14, mono: true, fill: TONES.warning });
        if (late) edgesFor.set(late, [...(edgesFor.get(late) ?? []), g]);
        else draws.push(line);
      }
      const parts = new Map<string, PartRef>();
      const nodeGroups = new Map<string, SVGGElement>();
      const labels = new Map<string, SVGTextElement>();
      const nodePos = new Map<string, Pt>();
      for (const n of e.nodes as { id: string; value?: string | number }[]) {
        const p = P(n.id);
        const g = el('g', { opacity: deferred.has(n.id) ? 0 : undefined }, fx);
        const c = el('circle', { cx: p.x, cy: p.y, r: geo.r, fill: '#16171b', stroke: DEFAULT_STROKE, 'stroke-width': 2 }, g);
        const ov = el('circle', { cx: p.x, cy: p.y, r: geo.r, fill: STATES.default.fill }, g);
        const t = text(g, String(n.value ?? n.id), { x: p.x, y: p.y + 1, size: 18, mono: true, weight: 500 });
        nodeGroups.set(n.id, g);
        labels.set(n.id, t);
        nodePos.set(n.id, p);
        parts.set(n.id, {
          paints: [{ fill: ov, stroke: c, text: t, base: { fill: STATES.default.fill, stroke: DEFAULT_STROKE, text: INK, glow: 'none' } }],
          at: { x: box.x + p.x, y: box.y + p.y },
          box: { x: box.x + p.x - geo.r, y: box.y + p.y - geo.r, w: geo.r * 2, h: geo.r * 2 },
        });
      }
      return {
        ...base, draws, part: (name) => parts.get(name) ?? null,
        extra: { nodeGroups, edgesFor, labels, nodePos, values: new Map((e.nodes as { id: string; value?: string | number }[]).map((n) => [n.id, String(n.value ?? n.id)])) },
      };
    }
    case 'molecule': {
      const geo = m.mol!;
      const ox = -geo.box.x;
      const oy = top - geo.box.y;
      const P = (i: number) => ({ x: geo.pos[i].x + ox, y: geo.pos[i].y + oy });
      const draws: SVGGeometryElement[] = [];
      for (const [a, b, order] of e.bonds as [number, number, number][]) {
        if (!geo.pos[a] || !geo.pos[b]) continue;
        const pa = P(a), pb = P(b);
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const offs = order === 1 ? [0] : order === 2 ? [-5, 5] : [-8, 0, 8];
        for (const o of offs) draws.push(el('line', { x1: pa.x + nx * o, y1: pa.y + ny * o, x2: pb.x + nx * o, y2: pb.y + ny * o, stroke: 'rgba(242,240,234,0.55)', 'stroke-width': 6, 'stroke-linecap': 'round' }, fx));
      }
      for (const lp of geo.lonePairs) for (const d of lp.dirs) {
        const r = (d * Math.PI) / 180;
        const c = { x: P(lp.atom).x + Math.cos(r) * 74, y: P(lp.atom).y + Math.sin(r) * 74 };
        el('ellipse', { cx: c.x, cy: c.y, rx: 34, ry: 21, transform: `rotate(${d} ${c.x} ${c.y})`, fill: 'rgba(99,102,241,0.18)', stroke: 'rgba(129,140,248,0.7)', 'stroke-width': 1.4 }, fx);
        for (const s of [-1, 1]) el('circle', { cx: c.x + Math.cos(r + Math.PI / 2) * 9 * s, cy: c.y + Math.sin(r + Math.PI / 2) * 9 * s, r: 4, fill: '#A5B4FC' }, fx);
      }
      const parts = new Map<string, PartRef>();
      (e.atoms as { id?: string; el: string }[]).forEach((atom, i) => {
        const p = P(i);
        const r = geo.radius[i];
        const color = CPK[atom.el] ?? '#3B82F6';
        const c = el('circle', { cx: p.x, cy: p.y, r, fill: color, stroke: 'rgba(255,255,255,0)', 'stroke-width': 3 }, fx);
        el('circle', { cx: p.x, cy: p.y, r, fill: `url(#${ctx.uid}-atom)` }, fx);
        const t = text(fx, atom.el, { x: p.x, y: p.y + 1, size: atom.el === 'H' ? 17 : 22, weight: 700, fill: atom.el === 'H' ? '#111' : '#fff' });
        if (atom.id) parts.set(atom.id, {
          paints: [{ stroke: c, text: t, base: { stroke: 'rgba(255,255,255,0)', glow: 'none', text: atom.el === 'H' ? '#111' : '#fff' } }],
          at: { x: box.x + p.x, y: box.y + p.y },
          box: { x: box.x + p.x - r, y: box.y + p.y - r, w: 2 * r, h: 2 * r },
        });
      });
      return { ...base, draws, part: (name) => parts.get(name) ?? null };
    }
    case 'network': {
      const L = e.layers as number[];
      const maxN = Math.max(...L);
      const left = e.inputLabels?.length ? 96 : 0;
      const P = (l: number, i: number) => ({ x: left + NET.r + l * NET.layerGap, y: top + 10 + NET.r + ((maxN - 1) / 2 + (i - (L[l] - 1) / 2)) * NET.nodeGap });
      const edgesBetween: SVGLineElement[][] = [];
      for (let l = 0; l < L.length - 1; l++) {
        const row: SVGLineElement[] = [];
        for (let i = 0; i < L[l]; i++) for (let j = 0; j < L[l + 1]; j++) {
          const a = P(l, i), b = P(l + 1, j);
          row.push(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#60A5FA', 'stroke-opacity': 0.26, 'stroke-width': 1.2 }, fx));
        }
        edgesBetween.push(row);
      }
      const nodes: { paint: Paint; at: Pt }[][] = L.map((n, l) => Array.from({ length: n }, (_, i) => {
        const p = P(l, i);
        const c = el('circle', { cx: p.x, cy: p.y, r: NET.r, fill: '#111318', stroke: '#60A5FA', 'stroke-width': 2.5 }, fx);
        return { paint: { fill: c, base: { fill: '#111318', glow: 'none' } }, at: { x: box.x + p.x, y: box.y + p.y } };
      }));
      (e.inputLabels ?? []).forEach((t: string, i: number) => { if (i < L[0]) text(fx, t, { x: left - 10, y: P(0, i).y, size: 13, mono: true, fill: INK_DIM, anchor: 'end' }); });
      (e.outputLabels ?? []).forEach((t: string, i: number) => { if (i < L[L.length - 1]) text(fx, t, { x: P(L.length - 1, i).x + NET.r + 12, y: P(L.length - 1, i).y, size: 15, weight: 600, anchor: 'start' }); });
      const part = (name: string): PartRef | null => {
        const mm = /^L(\d+)(?:n(\d+))?$/.exec(name);
        if (!mm || !nodes[+mm[1]]) return null;
        const layer = nodes[+mm[1]];
        const sel = mm[2] !== undefined ? [layer[+mm[2]]].filter(Boolean) : layer;
        if (!sel.length) return null;
        const xs = sel.map((s) => s.at.x), ys = sel.map((s) => s.at.y);
        return {
          paints: sel.map((s) => s.paint),
          at: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
          box: { x: Math.min(...xs) - NET.r, y: Math.min(...ys) - NET.r, w: Math.max(...xs) - Math.min(...xs) + 2 * NET.r, h: Math.max(...ys) - Math.min(...ys) + 2 * NET.r },
        };
      };
      return { ...base, part, draws: edgesBetween.flat(), extra: { edgesBetween, nodeAt: (l: number, i: number) => P(l, i) } };
    }
    case 'pixels': {
      const c = m.cell ?? 16;
      (e.grid as number[][]).forEach((row, y) => row.forEach((v, x) => {
        el('rect', { x: x * c, y: top + y * c, width: c - 1, height: c - 1, rx: 1.5, fill: `rgba(242,240,234,${v})` }, fx);
      }));
      const frame = el('rect', { x: -6, y: top - 6, width: m.w + 11, height: m.h - top + 11, rx: 8, fill: 'none', stroke: 'rgba(255,255,255,0.28)' }, fx);
      return { ...base, paint: { stroke: frame, base: { stroke: 'rgba(255,255,255,0.28)' } } };
    }
    default:
      return null;
  }
}

/** Size a latex string really renders at (browser), used by measure. */
export function domLatexSize(latex: string): { w: number; h: number } {
  if (typeof document === 'undefined') return estimateLatexSize(latex);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:30px;white-space:nowrap;visibility:hidden';
  probe.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: false, output: 'html' });
  document.body.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  return r.width > 0 ? { w: r.width, h: r.height } : estimateLatexSize(latex);
}
