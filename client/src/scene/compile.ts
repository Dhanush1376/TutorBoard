/**
 * Beats → one GSAP timeline. Every visual change is a tween on elements built
 * up front, so the timeline can be played, paused, stepped and seeked in
 * either direction and always shows the right state.
 *
 * Choreography lives here, not in the AI's output: arcs for swaps, drop-ins
 * for pushes, draw-ons for lines, glows for emphasis, callouts for notes.
 */
import gsap from 'gsap';
import { textWidth } from './geometry';
import { fitTransform } from './layout';
import { obstaclesFor, routeConnector } from './route';
import { arrowMarker, el, mathText, text } from './render/svg';
import type { Built, Paint } from './render/types';
import type { Sim } from './simulate';
import { DUR, EASE, INK, PACE, readingSeconds, STATES, TONES } from './tokens';
import type { Action, Box, Pt, Scene } from './types';
import { INDEXED, parseRef } from './types';

export type BeatTiming = { start: number; animEnd: number; end: number; title: string; narration: string };

export type CompileCtx = {
  scene: Scene;
  sim: Sim;
  builts: Map<string, Built>;
  spaceBuilts: Map<string, Built>;
  svg: SVGSVGElement;
  uid: string;
  overlay: SVGGElement;
  camera: SVGGElement;
  view: Box;
  world: Box;
};

type Cam = { x: number; y: number; scale: number };

export function compileScene(c: CompileCtx): { tl: gsap.core.Timeline; beats: BeatTiming[]; fit: Cam } {
  const tl = gsap.timeline({ paused: true });
  const fit = fitTransform(c.world, c.view, 1.6, 18, 1.18);
  gsap.set(c.camera, { x: fit.x, y: fit.y, scale: fit.scale, svgOrigin: '0 0' });

  const order = new Map<string, string[]>();
  for (const [id, keys] of c.sim.initial) order.set(id, [...keys]);
  const shown = new Set<string>();
  const painted = new Map<Paint, string>();
  const notes = new Map<string, SVGGElement>();
  const pointers = new Map<string, Record<string, SVGGElement>>();
  const beats: BeatTiming[] = [];

  // ── helpers ────────────────────────────────────────────────────────────
  const B = (id: string) => c.builts.get(id);
  const itemsOf = (b?: Built) => (b?.items ? [...b.items.values()] : []);

  // Rigid moves (move to/by/turn on shapes, pie slices laid in a row): the current
  // placement of each moved element as an SVG matrix, so moves compose and every tween
  // has explicit start and end states (seekable in both directions).
  type Mat = [number, number, number, number, number, number];
  const ID: Mat = [1, 0, 0, 1, 0, 0];
  const mul = (m: Mat, n: Mat): Mat => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const apply = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
  const invert = (m: Mat): Mat => {
    const det = m[0] * m[3] - m[1] * m[2] || 1;
    const a = m[3] / det, b = -m[1] / det, cc = -m[2] / det, dd = m[0] / det;
    return [a, b, cc, dd, -(a * m[4] + cc * m[5]), -(b * m[4] + dd * m[5])];
  };
  /** Turn by `deg` on screen (clockwise positive, as SVG rotate) about `o`. */
  const spin = (deg: number, o: Pt): Mat => {
    const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    return [cs, sn, -sn, cs, o.x - cs * o.x + sn * o.y, o.y - sn * o.x - cs * o.y];
  };
  const matrix = (m: Mat) => `matrix(${m.map((v) => +v.toFixed(4)).join(' ')})`;
  const placed = new Map<string, Mat>();
  const pieLayout = new Map<string, 'circle' | 'strip'>();
  const moverAt = new Map<string, Pt>();
  /** Tween an element through placements p(s), s: 0 → 1. */
  const glide = (node: Element, p: (s: number) => Mat, at: number, dur: number) => {
    const o = { s: 0 };
    tl.fromTo(o, { s: 0 }, { s: 1, duration: dur, ease: EASE.move, immediateRender: false, onUpdate: () => node.setAttribute('transform', matrix(p(o.s))) }, at);
  };
  type SpaceMap = { toPx: (p: [number, number]) => Pt };
  const mapOf = (built: Built) => (built.extra?.map ?? c.spaceBuilts.get((built.entity as { space?: string }).space ?? '')?.extra?.map) as SpaceMap | undefined;
  /** A shape's first point — what "to" places — in pixels before any move. */
  const anchorOf = (built: Built, map: SpaceMap): Pt => {
    const e = built.entity as { at?: unknown; from?: unknown; points?: unknown[]; vertex?: unknown };
    const first = e.at ?? e.from ?? e.vertex ?? e.points?.[0];
    const q = (first && typeof first === 'object' && 'at' in (first as object) ? (first as { at: unknown }).at : first) as unknown;
    return Array.isArray(q) && q.length === 2 ? map.toPx(q as [number, number]) : { x: built.box.x + built.box.w / 2, y: built.box.y + built.box.h / 2 };
  };
  const boundsOf = (pts: Pt[]): Box => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  const paint = (p: Paint, state: string, at: number, dur: number) => {
    const s = STATES[state] ?? STATES.default;
    const isDefault = state === 'default';
    if (p.fill) tl.to(p.fill, { attr: { fill: isDefault ? p.base.fill ?? s.fill : s.fill }, duration: dur, ease: EASE.enter }, at);
    if (p.stroke) {
      const stroke = isDefault ? p.base.stroke ?? s.stroke : s.stroke;
      tl.to(p.stroke, { attr: { stroke }, duration: dur, ease: EASE.enter }, at);
      // an arrow's head changes colour with its shaft
      if (p.stroke.getAttribute('marker-end')) tl.set(p.stroke, { attr: { 'marker-end': `url(#${arrowMarker(c.svg, c.uid, stroke)})` } }, at + dur / 2);
    }
    if (p.text) tl.to(p.text, { attr: { fill: isDefault ? p.base.text ?? INK : s.text }, duration: dur, ease: EASE.enter }, at);
    if (p.glow) {
      tl.set(p.glow, { opacity: 0 }, at);
    }
    if (isDefault) painted.delete(p); else painted.set(p, state);
  };

  /** Paints behind a reference at a given moment. */
  const paintsOf = (ref: string, b: number, k: number): Paint[] => {
    const { base, index, part } = parseRef(ref);
    const built = B(base);
    if (!built) return [];
    if (index !== undefined) {
      const key = c.sim.keyAt(b, k, ref);
      const it = key ? built.items?.get(key) : undefined;
      return it ? [it.paint] : [];
    }
    if (part !== undefined) return built.part?.(part)?.paints ?? [];
    if (built.paint) return [built.paint];
    return (order.get(base) ?? []).map((key) => built.items!.get(key)!.paint);
  };

  /** World box of a reference at a given moment (for callouts, connectors, focus). */
  const boxOf = (ref: string, b: number, k: number): Box | null => {
    const { base, index, part } = parseRef(ref);
    const built = B(base);
    if (!built) return null;
    if (index !== undefined && built.items && built.slotAt) {
      const key = c.sim.keyAt(b, k, ref);
      const slot = key ? (order.get(base) ?? []).indexOf(key) : -1;
      if (slot < 0) return built.box;
      const p = built.slotAt(slot);
      const it = built.items.get(key!)!;
      const r = (it.g.firstElementChild as SVGRectElement | null);
      const w = Number(r?.getAttribute('width') ?? 0) - 8 || 72;
      const h = Number(r?.getAttribute('height') ?? 0) - 8 || 72;
      return { x: built.box.x + p.x, y: built.box.y + p.y, w, h };
    }
    if (part !== undefined) return built.part?.(part)?.box ?? built.box;
    return built.box;
  };

  const placeItem = (built: Built, key: string, slot: number, at: number, dur: number, arc = 0) => {
    const it = built.items!.get(key)!;
    const to = built.slotAt!(slot);
    tl.to(it.g, { x: to.x, duration: dur, ease: EASE.move }, at);
    if (arc) {
      tl.to(it.g, { y: to.y - arc, duration: dur / 2, ease: 'sine.out' }, at);
      tl.to(it.g, { y: to.y, duration: dur / 2, ease: 'sine.in' }, at + dur / 2);
    } else tl.to(it.g, { y: to.y, duration: dur, ease: EASE.move }, at);
  };

  const syncDecor = (built: Built, len: number, at: number) => {
    built.slotDecor?.forEach((d, i) => tl.to(d, { opacity: i < len ? (d.tagName === 'text' ? 1 : 0.9) : 0, duration: 0.3 }, at));
  };

  const ensurePointers = (built: Built) => {
    if (pointers.has(built.entity.id)) return pointers.get(built.entity.id)!;
    const ps: Record<string, SVGGElement> = {};
    if (built.entity.type === 'stack') {
      const g = el('g', { opacity: 0 }, built.fx);
      el('line', { x1: -64, y1: 0, x2: -12, y2: 0, stroke: TONES.warning, 'stroke-width': 2.4 }, g);
      el('path', { d: 'M-12,-6 L-2,0 L-12,6 z', fill: TONES.warning }, g);
      text(g, 'top', { x: -72, y: 0, size: 14, weight: 650, mono: true, fill: '#FBBF24', anchor: 'end' });
      ps.top = g;
    }
    if (built.entity.type === 'queue') {
      for (const [name, color] of [['front', TONES.success], ['rear', '#818CF8']] as const) {
        const g = el('g', { opacity: 0 }, built.fx);
        el('line', { x1: 0, y1: 44, x2: 0, y2: 6, stroke: color, 'stroke-width': 2.4 }, g);
        el('path', { d: 'M-6,10 L0,0 L6,10 z', fill: color }, g);
        text(g, name, { x: 0, y: 60, size: 14, weight: 650, mono: true, fill: color });
        ps[name] = g;
      }
    }
    pointers.set(built.entity.id, ps);
    return ps;
  };

  const syncPointers = (built: Built, at: number, dur: number) => {
    const ps = ensurePointers(built);
    const keys = order.get(built.entity.id) ?? [];
    if (ps.top) {
      if (!keys.length) tl.to(ps.top, { opacity: 0, duration: 0.25 }, at);
      else {
        const p = built.slotAt!(keys.length - 1);
        tl.to(ps.top, { opacity: 1, x: p.x - 14, y: p.y + 28, duration: dur, ease: EASE.move }, at);
      }
    }
    if (ps.front && ps.rear) {
      const y = (built.extra?.pointers as { y: number }).y;
      if (!keys.length) tl.to([ps.front, ps.rear], { opacity: 0, duration: 0.25 }, at);
      else {
        const f = built.slotAt!(0);
        const r = built.slotAt!(keys.length - 1);
        tl.to(ps.front, { opacity: 1, x: f.x + 50 - (keys.length > 1 ? 0 : 14), y, duration: dur, ease: EASE.move }, at);
        tl.to(ps.rear, { opacity: keys.length > 1 ? 1 : 0, x: r.x + 50 + (keys.length > 1 ? 0 : 14), y, duration: dur, ease: EASE.move }, at);
      }
    }
  };

  const showSpace = (spaceId: string, at: number): number => {
    if (shown.has(`space:${spaceId}`)) return 0;
    shown.add(`space:${spaceId}`);
    const sb = c.spaceBuilts.get(spaceId);
    if (!sb) return 0;
    tl.to(sb.fx, { opacity: 1, duration: 0.45, ease: EASE.enter }, at);
    if (sb.draws?.length) tl.fromTo(sb.draws, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: EASE.draw, immediateRender: false }, at);
    return 0.45;
  };

  const create = (id: string, effect: string | undefined, at: number, pace: number): number => {
    const built = B(id);
    if (!built) return 0;
    if (built.entity.type === 'group') {
      let d = 0;
      (built.entity as { children: string[] }).children.forEach((ch, i) => { d = Math.max(d, create(ch, effect, at + i * DUR.stagger, pace) + i * DUR.stagger); });
      return d;
    }
    if (shown.has(id)) return 0;
    shown.add(id);
    let t = at;
    const space = 'space' in built.entity ? (built.entity as { space?: string }).space : undefined;
    if (space) t += showSpace(space, t);
    const type = built.entity.type;
    const fx = effect ?? (['line', 'arrow', 'path', 'plot', 'polygon', 'angle'].includes(type) ? 'draw' : type === 'math' ? 'type' : INDEXED.has(type) || type === 'molecule' || type === 'point' || type === 'body' ? 'pop' : 'fade');
    const d = (fx === 'draw' ? DUR.draw : fx === 'type' ? DUR.type : DUR.create) * pace;
    const itemGs = new Set(itemsOf(built).map((i) => i.g));
    switch (fx) {
      case 'draw': {
        tl.set(built.fx, { opacity: 1 }, t);
        const draws = built.draws ?? [];
        if (draws.length) tl.fromTo(draws, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: EASE.draw, stagger: draws.length > 1 ? Math.min(0.12, (d * 0.5) / draws.length) : 0, immediateRender: false }, t);
        const rest = [...built.fx.children].filter((ch) => !draws.includes(ch as SVGGeometryElement) && !itemGs.has(ch as SVGGElement));
        const restOpacity = rest.map((r) => Number(r.getAttribute('opacity') ?? 1));
        if (rest.length) tl.fromTo(rest, { opacity: 0 }, { opacity: (i: number) => restOpacity[i], duration: 0.4, immediateRender: false, stagger: 0.03 }, t + d * 0.55);
        break;
      }
      case 'pop':
        tl.fromTo(built.fx, { opacity: 0, scale: 0.86, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: d, ease: EASE.pop, immediateRender: false }, t);
        break;
      case 'grow':
        tl.fromTo(built.fx, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: d, ease: EASE.enter, immediateRender: false }, t);
        break;
      case 'drop':
        tl.fromTo(built.fx, { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: d, ease: EASE.pop, immediateRender: false }, t);
        break;
      case 'type':
        tl.fromTo(built.fx, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: d, ease: EASE.enter, immediateRender: false }, t);
        break;
      default:
        tl.fromTo(built.fx, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: d, ease: EASE.enter, immediateRender: false }, t);
    }
    // initial items of a data structure arrive one by one
    if (built.items && built.slotAt) {
      const keys = order.get(id) ?? [];
      keys.forEach((key, i) => {
        const it = built.items!.get(key)!;
        const p = built.slotAt!(i);
        tl.fromTo(it.g, { opacity: 0, x: p.x, y: p.y - 18 }, { opacity: 1, x: p.x, y: p.y, duration: 0.45 * pace, ease: EASE.pop, immediateRender: false }, t + 0.1 + i * DUR.stagger);
      });
      syncDecor(built, keys.length, t + 0.1);
      if (type === 'stack' || type === 'queue') syncPointers(built, t + 0.2, 0.01);
      return t - at + Math.max(d, 0.1 + keys.length * DUR.stagger + 0.45 * pace);
    }
    return t - at + d;
  };

  const remove = (id: string, effect: string | undefined, at: number, pace: number): number => {
    const built = B(id);
    if (!built || !shown.has(id)) return 0;
    shown.delete(id);
    const d = DUR.remove * pace;
    const to: gsap.TweenVars = { opacity: 0, duration: d, ease: EASE.exit };
    if (effect === 'shrink') Object.assign(to, { scale: 0.85, transformOrigin: '50% 50%' });
    if (effect === 'lift') to.y = -24;
    if (effect === 'slide-left') to.x = -40;
    tl.to(built.fx, to, at);
    return d;
  };

  /** Boxes callouts must not cover: every entity, plus callouts already placed. */
  const occupied: Box[] = [...c.builts.values()].filter((x) => x.box.w > 0).map((x) => x.box);
  /** arrowheads: labels and callouts keep off them, but connectors may route past them */
  const tips: Box[] = [];
  /** points along every connector drawn so far: later routes and labels keep off them */
  const wires: Pt[] = [];
  const onWire = (r: Box, own: Pt[]) => wires.some((q) => !own.includes(q) && q.x > r.x && q.x < r.x + r.w && q.y > r.y && q.y < r.y + r.h);
  const hits = (r: Box, pad = 6) => [...occupied, ...tips].some((o) => r.x < o.x + o.w + pad && o.x < r.x + r.w + pad && r.y < o.y + o.h + pad && o.y < r.y + r.h + pad);

  const callout = (ref: string, note: string, side: string | undefined, b: number, k: number, at: number, pace: number): number => {
    const box = boxOf(ref, b, k);
    if (!box) return 0;
    // a callout on one element of a structure sits outside the whole structure, lined up with the element
    const { base, index, part } = parseRef(ref);
    const owner = (index !== undefined || part !== undefined) ? B(base)?.box ?? box : box;
    const w = textWidth(note, 15, 700) + 34;
    const h = 40;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const place = (s: string, gap: number): Box => {
      if (s === 'above') return { x: cx - w / 2, y: owner.y - gap - h, w, h };
      if (s === 'left') return { x: owner.x - gap - w, y: cy - h / 2, w, h };
      if (s === 'right') return { x: owner.x + owner.w + gap, y: cy - h / 2, w, h };
      return { x: cx - w / 2, y: owner.y + owner.h + gap, w, h };
    };
    // the requested side first, then the others; step further out before giving up
    const sides = [side ?? 'below', 'below', 'above', 'right', 'left'].filter((v, i, arr) => arr.indexOf(v) === i);
    let s = sides[0];
    let r = place(s, 28);
    search: for (const gap of [28, 70, 120]) for (const cand of sides) {
      const q = place(cand, gap);
      if (!hits(q)) { s = cand; r = q; break search; }
    }
    occupied.push(r);
    const g = el('g', { opacity: 0 }, c.overlay);
    const ax = s === 'left' ? box.x - 4 : s === 'right' ? box.x + box.w + 4 : cx;
    const ay = s === 'above' ? box.y - 4 : s === 'below' ? box.y + box.h + 4 : cy;
    const bx = s === 'left' ? r.x + w : s === 'right' ? r.x : r.x + w / 2;
    const by = s === 'above' ? r.y + h : s === 'below' ? r.y : r.y + h / 2;
    el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#3b82f6', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, g);
    el('rect', { x: r.x, y: r.y, width: w, height: h, rx: 10, fill: '#161922', stroke: '#3b82f6', 'stroke-width': 2 }, g);
    // an equation-like note ("v_y = 0", "x^2 ≥ 0") reads as maths; "max_heap" stays as written
    const asMath = /\\[a-zA-Z]/.test(note) || (/[_^]/.test(note) && /[=<>≤≥≠≈±]/.test(note));
    (asMath ? mathText : text)(g, note, { x: r.x + w / 2, y: r.y + h / 2 + 1, size: 15, weight: 700, fill: '#F4F4F4' });
    notes.get(ref)?.remove();
    notes.set(ref, g);
    const d = DUR.annotate * pace;
    tl.fromTo(g, { opacity: 0, y: s === 'above' ? 8 : -8 }, { opacity: 1, y: 0, duration: d, ease: EASE.enter, immediateRender: false }, at);
    return d;
  };

  const focus = (refs: string[], zoom: string, b: number, k: number, at: number, pace: number): number => {
    let box: Box = c.world;
    if (refs.length) {
      const bs = refs.map((r) => boxOf(r, b, k)).filter((x): x is Box => !!x);
      if (bs.length) {
        const x0 = Math.min(...bs.map((q) => q.x)), y0 = Math.min(...bs.map((q) => q.y));
        const x1 = Math.max(...bs.map((q) => q.x + q.w)), y1 = Math.max(...bs.map((q) => q.y + q.h));
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    }
    const frac = zoom === 'close' ? 0.5 : zoom === 'wide' ? 1 : 0.72;
    const frame = { x: c.view.x + c.view.w * (1 - frac) / 2, y: c.view.y + c.view.h * (1 - frac) / 2, w: c.view.w * frac, h: c.view.h * frac };
    let target = refs.length && zoom !== 'wide' ? fitTransform(box, frame, 2.2, 10) : fit;
    if (target !== fit) {
      // never cut a neighbour in half (a title clipped to "it A 60%" reads as broken):
      // anything else on the board that would be partly in view comes fully into view
      const focused = new Set(refs.map((r) => parseRef(r).base));
      const others = [...c.builts.values()].filter((o) => shown.has(o.entity.id) && !focused.has(o.entity.id) && !('space' in o.entity && o.entity.space));
      for (let pass = 0; pass < 4; pass++) {
        const seen = { x: (c.view.x - target.x) / target.scale, y: (c.view.y - target.y) / target.scale, w: c.view.w / target.scale, h: c.view.h / target.scale };
        const cut = others.map((o) => o.box).filter((q) => q.x < seen.x + seen.w && q.x + q.w > seen.x && q.y < seen.y + seen.h && q.y + q.h > seen.y
          && (q.x < seen.x || q.y < seen.y || q.x + q.w > seen.x + seen.w || q.y + q.h > seen.y + seen.h));
        if (!cut.length) break;
        const all = [box, ...cut];
        const x0 = Math.min(...all.map((q) => q.x)), y0 = Math.min(...all.map((q) => q.y));
        box = { x: x0, y: y0, w: Math.max(...all.map((q) => q.x + q.w)) - x0, h: Math.max(...all.map((q) => q.y + q.h)) - y0 };
        target = fitTransform(box, frame, 2.2, 10);
        if (target.scale <= fit.scale) { target = fit; break; }
      }
    }
    const d = DUR.focus * pace;
    tl.to(c.camera, { x: target.x, y: target.y, scale: target.scale, duration: d, ease: EASE.move }, at);
    return d;
  };

  type NodeExtra = { nodeGroups: Map<string, SVGGElement>; edgesFor: Map<string, SVGElement[]>; labels: Map<string, SVGTextElement>; nodePos: Map<string, Pt>; values: Map<string, string> };
  /** Tree/graph internals (per-node groups, labels, current values), if `id` is one. */
  const nodeExtra = (id: string): NodeExtra | null => {
    const ex = B(id)?.extra as Partial<NodeExtra> | undefined;
    return ex?.nodeGroups && ex.labels && ex.nodePos && ex.values && ex.edgesFor ? (ex as NodeExtra) : null;
  };
  /** One node of a tree/graph appears (with the edges that lead to it) or leaves. */
  const showNode = (id: string, node: string, on: boolean, at: number, pace: number): number => {
    const ex = nodeExtra(id);
    const g = ex?.nodeGroups.get(node);
    if (!ex || !g) return 0;
    let t = at;
    if (on && !shown.has(id)) t += create(id, undefined, at, pace);
    const d = (on ? DUR.push : DUR.remove) * pace;
    const edges = ex.edgesFor.get(node) ?? [];
    if (on) {
      if (edges.length) tl.fromTo(edges, { opacity: 0 }, { opacity: 1, duration: d * 0.6, ease: EASE.enter, immediateRender: false }, t);
      tl.fromTo(g, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: d, ease: EASE.pop, immediateRender: false }, t + d * 0.3);
    } else {
      tl.to([g, ...edges], { opacity: 0, duration: d, ease: EASE.exit }, t);
    }
    return t - at + d * (on ? 1.3 : 1);
  };

  const networkPulses = (built: Built, layer: number, at: number, pace: number): number => {
    const edges = (built.extra?.edgesBetween as SVGLineElement[][] | undefined)?.[layer - 1];
    if (!edges) return 0;
    const d = 0.55 * pace;
    edges.forEach((line, i) => {
      if (i % 2) return;
      const x1 = +line.getAttribute('x1')!, y1 = +line.getAttribute('y1')!, x2 = +line.getAttribute('x2')!, y2 = +line.getAttribute('y2')!;
      const dot = el('circle', { cx: 0, cy: 0, r: 3.4, fill: '#BFDBFE', opacity: 0 }, built.fx);
      tl.fromTo(dot, { x: x1, y: y1, opacity: 0 }, { x: x2, y: y2, opacity: 1, duration: d, ease: 'none', immediateRender: false }, at);
      tl.to(dot, { opacity: 0, duration: 0.15 }, at + d);
    });
    return d;
  };

  // ── beats ──────────────────────────────────────────────────────────────
  let t = 0.2;
  c.scene.beats.forEach((beat, b) => {
    const pace = PACE[beat.pace] ?? 1;
    const start = t;
    tl.addLabel(`beat-${b}`, start);
    let cursor = start;
    let last = start;
    beat.actions.forEach((a: Action, k) => {
      const at = a.with === 'previous' ? last : cursor;
      const d = run(a, b, k, at, pace);
      last = at;
      cursor = Math.max(cursor, at + d);
    });
    const animEnd = Math.max(cursor, start + 0.3);
    const hold = Math.min(3, Math.max(0.6, readingSeconds(beat.narration) - (animEnd - start)));
    const end = animEnd + hold;
    // keep the timeline's length honest even if the last action was instant
    tl.set({}, {}, end);
    beats.push({ start, animEnd, end, title: beat.title, narration: beat.narration });
    t = end;
  });

  function run(a: Action, b: number, k: number, at: number, pace: number): number {
    const targets = (x: unknown) => (x === undefined ? [] : Array.isArray(x) ? (x as string[]) : [x as string]);
    switch (a.do) {
      case 'create': {
        let d = 0;
        targets(a.target).forEach((id, i) => {
          const r = parseRef(id);
          const t0 = at + i * DUR.stagger * 2;
          const dd = r.part !== undefined && nodeExtra(r.base) ? showNode(r.base, r.part, true, t0, pace) : create(r.base, a.effect, t0, pace);
          d = Math.max(d, dd + i * DUR.stagger * 2);
        });
        return d;
      }
      case 'remove': {
        let d = 0;
        targets(a.target).forEach((id) => {
          const r = parseRef(id);
          const node = r.part !== undefined && nodeExtra(r.base);
          d = Math.max(d, node ? showNode(r.base, r.part!, false, at, pace) : remove(r.base, a.effect, at, pace));
          // its callouts go with it (a "−∇f" note left pointing at a removed arrow)
          for (const [ref, g] of notes) if (node ? ref === id : parseRef(ref).base === r.base) tl.to(g, { opacity: 0, duration: 0.3 }, at);
        });
        return d;
      }
      case 'exchange': {
        const ra = parseRef(a.a), rb = parseRef(a.b);
        if (ra.index !== undefined) {
          // cells of an array/stack/queue: the simulation recorded it as a swap
          const rec = c.sim.op(b, k);
          const built = B(ra.base);
          if (!rec || rec.kind !== 'swap' || !built?.slotAt) return 0;
          const d = DUR.swap * pace;
          const before = order.get(ra.base)!;
          const ia = rec.order.indexOf(rec.a), ib = rec.order.indexOf(rec.b);
          const right = ia > before.indexOf(rec.a);
          placeItem(built, rec.a, ia, at, d, right ? 54 : -54);
          placeItem(built, rec.b, ib, at, d, right ? -54 : 54);
          order.set(ra.base, [...rec.order]);
          return d;
        }
        const ex = nodeExtra(ra.base);
        const built = B(ra.base);
        if (!ex || !built || ra.part === undefined || rb.part === undefined) return 0;
        const la = ex.labels.get(ra.part), lb = ex.labels.get(rb.part);
        const pa = ex.nodePos.get(ra.part), pb = ex.nodePos.get(rb.part);
        if (!la || !lb || !pa || !pb) return 0;
        const va = ex.values.get(ra.part)!, vb = ex.values.get(rb.part)!;
        const d = DUR.swap * pace;
        // the values travel along an arc between the two nodes, then the labels trade text
        const travel = (from: Pt, to: Pt, value: string, bend: number) => {
          const ghost = text(built.fx, value, { x: from.x, y: from.y + 1, size: 18, mono: true, weight: 600, fill: STATES.swapping.text, opacity: 0 });
          const mid = { x: (from.x + to.x) / 2 - (to.y - from.y) * 0.25 * bend, y: (from.y + to.y) / 2 + (to.x - from.x) * 0.25 * bend };
          tl.set(ghost, { opacity: 1 }, at);
          tl.to(ghost, { attr: { x: mid.x, y: mid.y }, duration: d / 2, ease: 'sine.out' }, at);
          tl.to(ghost, { attr: { x: to.x, y: to.y + 1 }, duration: d / 2, ease: 'sine.in' }, at + d / 2);
          tl.set(ghost, { opacity: 0 }, at + d);
        };
        tl.set([la, lb], { opacity: 0 }, at);
        travel(pa, pb, va, 1);
        travel(pb, pa, vb, 1);
        tl.set(la, { text: vb, opacity: 1 }, at + d);
        tl.set(lb, { text: va, opacity: 1 }, at + d);
        // exchange values without glow
        ex.values.set(ra.part, vb);
        ex.values.set(rb.part, va);
        return d;
      }
      case 'swap': {
        const rec = c.sim.op(b, k);
        const built = B(a.target);
        if (!rec || rec.kind !== 'swap' || !built?.slotAt) return 0;
        const d = DUR.swap * pace;
        const ia = rec.order.indexOf(rec.a), ib = rec.order.indexOf(rec.b);
        const before = order.get(a.target)!;
        const movingRight = ia > before.indexOf(rec.a);
        const arc = built.entity.type === 'array' || built.entity.type === 'linkedlist' ? 54 : 0;
        placeItem(built, rec.a, ia, at, d, movingRight ? arc : -arc);
        placeItem(built, rec.b, ib, at, d, movingRight ? -arc : arc);
        order.set(a.target, [...rec.order]);
        return d;
      }
      case 'push':
      case 'enqueue':
      case 'insert': {
        const rec = c.sim.op(b, k);
        const built = B(a.target);
        if (!rec || rec.kind !== 'enter' || !built?.slotAt) return 0;
        const d = DUR.push * pace;
        const slot = rec.order.indexOf(rec.key);
        const it = built.items!.get(rec.key)!;
        const from = built.entryFrom?.(slot) ?? built.slotAt(slot);
        const to = built.slotAt(slot);
        const prev = order.get(a.target)!;
        rec.order.forEach((key, i) => { if (key !== rec.key && prev.indexOf(key) !== i) placeItem(built, key, i, at, d * 0.8); });
        tl.fromTo(it.g, { opacity: 0, x: from.x, y: from.y }, { opacity: 1, x: to.x, y: to.y, duration: d, ease: built.entity.type === 'queue' ? EASE.move : EASE.pop, immediateRender: false }, at);
        if (it.paint.glow) tl.set(it.paint.glow, { opacity: 0 });
        order.set(a.target, [...rec.order]);
        syncDecor(built, rec.order.length, at);
        syncPointers(built, at + d * 0.6, d * 0.5);
        return d;
      }
      case 'pop':
      case 'dequeue':
      case 'delete': {
        const rec = c.sim.op(b, k);
        const built = B(a.target);
        if (!rec || rec.kind !== 'exit' || !built?.slotAt) return 0;
        const d = DUR.pop * pace;
        const prev = order.get(a.target)!;
        const slot = prev.indexOf(rec.key);
        const it = built.items!.get(rec.key)!;
        const to = built.exitTo?.(slot, rec.from) ?? built.slotAt(slot);
        tl.to(it.g, { x: to.x, y: to.y, opacity: 0, duration: d, ease: EASE.exit }, at);
        rec.order.forEach((key, i) => { if (prev.indexOf(key) !== i) placeItem(built, key, i, at + d * 0.35, d * 0.9); });
        order.set(a.target, [...rec.order]);
        syncDecor(built, rec.order.length, at + d * 0.4);
        syncPointers(built, at + d * 0.5, d * 0.6);
        return d * 1.3;
      }
      case 'morph': {
        const rec = c.sim.op(b, k);
        const built = B(a.target);
        if (!rec || rec.kind !== 'morph' || !built?.slotAt) return 0;
        const d = DUR.morph * pace;
        const prev = order.get(a.target)!;
        rec.order.forEach((key, i) => {
          const was = prev.indexOf(key);
          if (rec.entering.includes(key)) {
            const it = built.items!.get(key)!;
            const from = built.entryFrom?.(i) ?? built.slotAt!(i);
            const to = built.slotAt!(i);
            tl.fromTo(it.g, { opacity: 0, x: from.x, y: from.y }, { opacity: 1, x: to.x, y: to.y, duration: d * 0.7, ease: EASE.pop, immediateRender: false }, at + d * 0.3);
          } else if (was !== i) placeItem(built, key, i, at, d, i > was ? 60 : -60);
        });
        for (const key of rec.exiting) {
          const it = built.items!.get(key)!;
          const slot = prev.indexOf(key);
          const to = built.exitTo?.(slot, 'middle') ?? built.slotAt(slot);
          tl.to(it.g, { x: to.x, y: to.y, opacity: 0, duration: d * 0.6, ease: EASE.exit }, at);
        }
        order.set(a.target, [...rec.order]);
        syncDecor(built, rec.order.length, at);
        return d;
      }
      case 'set': {
        const { base, index } = parseRef(a.target);
        const built = B(base);
        if (!built) return 0;
        const d = DUR.set * pace;
        const nodePart = parseRef(a.target).part;
        const nx = nodeExtra(base);
        if (nodePart !== undefined && nx && a.value !== undefined) {
          const label = nx.labels.get(nodePart);
          if (!label) return 0;
          tl.to(label, { text: String(a.value), duration: d, ease: 'none' }, at);
          nx.values.set(nodePart, String(a.value));
          return d * 2;
        }
        if (index !== undefined && a.value !== undefined) {
          const key = c.sim.keyAt(b, k, a.target);
          const it = key ? built.items?.get(key) : undefined;
          if (!it) return 0;
          tl.to(it.label, { text: String(a.value), duration: d, ease: 'none' }, at);
          return d * 2;
        }
        if (a.latex !== undefined && built.latex) {
          const next = built.latex.get(a.latex);
          const visible = [...built.latex.values()];
          if (next) {
            tl.to(visible.filter((fo) => fo !== next), { opacity: 0, duration: d }, at);
            tl.to(next, { opacity: 1, duration: d }, at + d * 0.5);
          }
          return d * 1.5;
        }
        if (a.text !== undefined && built.textEl) {
          const target = built.textEl.querySelector('tspan') ?? built.textEl;
          const td = Math.min(0.5, 0.15 + a.text.length * 0.01) * pace;
          tl.to(target, { text: { value: a.text }, duration: td, ease: 'none' }, at);
          return Math.max(d, td);
        }
        return 0;
      }
      case 'highlight': {
        const d = DUR.highlight * pace;
        let extra = 0;
        targets(a.target).forEach((ref) => {
          const { base, part } = parseRef(ref);
          const built = B(base);
          if (built?.entity.type === 'network' && part && /^L\d+$/.test(part) && +part.slice(1) > 0) extra = Math.max(extra, networkPulses(built, +part.slice(1), at, pace));
          for (const p of paintsOf(ref, b, k)) {
            if (a.hold) paint(p, a.state, at + extra, d);
            else {
              const prev = painted.get(p) ?? 'default';
              paint(p, a.state, at + extra, d);
              paint(p, prev, at + extra + DUR.flash * pace, d);
            }
          }
        });
        return extra + (a.hold ? d : DUR.flash * pace + d);
      }
      case 'clear': {
        const d = DUR.highlight * pace;
        const list = a.target === undefined ? [...painted.keys()] : targets(a.target).flatMap((ref) => paintsOf(ref, b, k));
        for (const p of list) paint(p, 'default', at, d);
        return d;
      }
      case 'annotate':
        return callout(a.target, a.text, a.side, b, k, at, pace);
      case 'unannotate': {
        const g = notes.get(a.target);
        if (!g) return 0;
        tl.to(g, { opacity: 0, duration: 0.3 }, at);
        return 0.3;
      }
      case 'connect': {
        const fa = boxOf(a.from, b, k), fb = boxOf(a.to, b, k);
        if (!fa || !fb) return 0;
        const route = routeConnector(fa, fb, obstaclesFor(fa, fb, occupied), wires);
        const pts = Array.from({ length: 41 }, (_, i) => route.at(i / 40));
        wires.push(...pts);
        const color = '#818CF8';
        const markerId = `${c.uid}-conn`;
        if (!c.svg.querySelector(`#${markerId}`)) {
          const mk = el('marker', { id: markerId, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, c.svg.querySelector('defs')!);
          el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, mk);
        }
        const g = el('g', { opacity: 0 }, c.overlay);
        const line = el('path', { d: route.d, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-dasharray': a.style === 'dashed' ? '7 6' : undefined, 'marker-end': a.style === 'line' ? undefined : `url(#${markerId})` }, g);
        if (a.label) {
          const lw = textWidth(a.label, 13, 600) + 16;
          const onLine = [0.5, 0.35, 0.65, 0.22, 0.78].map(route.at);
          // beside the midpoint, for links too short to carry a label without hiding them
          const m = route.at(0.5), m2 = route.at(0.52);
          const tl = Math.hypot(m2.x - m.x, m2.y - m.y) || 1;
          const nx = -(m2.y - m.y) / tl, ny = (m2.x - m.x) / tl;
          const off = Math.abs(nx) * (lw / 2 + 10) + Math.abs(ny) * 21;
          const beside = [1, 1.8, 2.6].flatMap((far) => [1, -1].map((sgn) => ({ x: m.x + nx * off * far * sgn, y: m.y + ny * off * far * sgn })));
          const length = pts.slice(1).reduce((acc, q, i) => acc + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
          const spots = length < lw + 36 ? [...beside, ...onLine] : [...onLine, ...beside];
          const pill = (q: Pt): Box => ({ x: q.x - lw / 2, y: q.y - 11, w: lw, h: 22 });
          const free = spots.find((q) => !hits(pill(q), 2) && !onWire(pill(q), pts)) ?? spots.find((q) => !hits(pill(q), 2)) ?? spots[0];
          const lx = free.x, ly = free.y;
          occupied.push({ x: lx - lw / 2, y: ly - 11, w: lw, h: 22 });
          el('rect', { x: lx - lw / 2, y: ly - 11, width: lw, height: 22, rx: 11, fill: '#0B0B12', stroke: 'rgba(129,140,248,0.45)' }, g);
          text(g, a.label, { x: lx, y: ly + 1, size: 13, weight: 600, fill: '#C7D2FE' });
        }
        // keep later labels and callouts off the arrowhead
        tips.push({ x: route.end.x - 9, y: route.end.y - 9, w: 18, h: 18 });
        const d = DUR.connect * pace;
        tl.set(g, { opacity: 1 }, at);
        tl.fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: EASE.draw, immediateRender: false }, at);
        return d;
      }
      case 'trace': {
        const body = B(a.target);
        const path = B(a.along);
        const pts = (path?.extra?.points as Pt[] | undefined) ?? [];
        const mover = body?.extra?.mover as SVGGElement | undefined;
        if (!body || !mover || pts.length < 2) return 0;
        if (!shown.has(a.target)) create(a.target, 'pop', at, pace);
        const step = Math.max(1, Math.floor(pts.length / 60));
        const route = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => ({ x: p.x, y: p.y }));
        const d = (DUR.trace[a.duration] ?? DUR.trace.normal) * pace;
        tl.fromTo(mover, { x: route[0].x, y: route[0].y }, { motionPath: { path: route, curviness: 0.6 }, duration: d, ease: 'none', immediateRender: false }, at);
        moverAt.set(a.target, route[route.length - 1]);
        return d;
      }
      case 'move': {
        const built = B(a.target);
        const map = built && mapOf(built);
        if (!built || !map) return 0;
        const d = DUR.move * pace;
        const origin = map.toPx([0, 0]);
        const shift = (v: [number, number], from: Pt): Pt => { const q = map.toPx(v); return { x: from.x + q.x - origin.x, y: from.y + q.y - origin.y }; };
        const mover = built.extra?.mover as SVGGElement | undefined;
        if (mover && !a.turn) {
          // a body slides (trace and move share its position)
          const from = moverAt.get(a.target) ?? anchorOf(built, map);
          const p = a.to ? map.toPx(a.to) : a.by ? shift(a.by, from) : from;
          tl.fromTo(mover, { x: from.x, y: from.y }, { x: p.x, y: p.y, duration: d, ease: EASE.move, immediateRender: false }, at);
          moverAt.set(a.target, p);
          built.box = { ...built.box, x: built.box.x + p.x - from.x, y: built.box.y + p.y - from.y };
          return d;
        }
        // any other shape moves rigidly: turn about the pivot, then its first point slides to "to" (or by "by")
        const m0 = placed.get(a.target) ?? ID;
        const anchor = apply(m0, anchorOf(built, map));
        const pivot = a.about ? map.toPx(a.about) : anchor;
        const turn = -(a.turn ?? 0); // counter-clockwise in the space is anticlockwise on screen
        const turned = apply(spin(turn, pivot), anchor);
        const goal = a.to ? map.toPx(a.to) : a.by ? shift(a.by, anchor) : anchor;
        const dx = goal.x - turned.x, dy = goal.y - turned.y;
        const at_s = (s: number): Mat => mul([1, 0, 0, 1, dx * s, dy * s], mul(spin(turn * s, pivot), m0));
        const m1 = at_s(1);
        placed.set(a.target, m1);
        glide(built.root, at_s, at, d);
        // later callouts and connectors find it where it now is
        const bx = built.box, inv = (p: Pt) => apply(m1, apply(invert(m0), p));
        built.box = boundsOf([{ x: bx.x, y: bx.y }, { x: bx.x + bx.w, y: bx.y }, { x: bx.x, y: bx.y + bx.h }, { x: bx.x + bx.w, y: bx.y + bx.h }].map(inv));
        return d;
      }
      case 'rearrange': {
        const built = B(a.target);
        const pie = built?.extra?.pie as { slices: SVGGElement[]; rim: SVGElement; center: Pt; strip: { dx: number; dy: number; rot: number }[] } | undefined;
        const into = a.into ?? 'strip';
        if (!pie || (pieLayout.get(a.target) ?? 'circle') === into) return 0;
        pieLayout.set(a.target, into);
        const toStrip = into === 'strip';
        const d = DUR.move * 1.3 * pace;
        const stagger = Math.min(0.09, 0.7 / pie.slices.length) * pace;
        pie.slices.forEach((g, i) => {
          const { dx, dy, rot } = pie.strip[i];
          // s = how far along the way to the row: turn about the centre, then the tip slides into place
          const along = (s: number): Mat => mul([1, 0, 0, 1, dx * s, dy * s], spin(rot * s, pie.center));
          glide(g, (s) => along(toStrip ? s : 1 - s), at + i * stagger, d);
        });
        tl.to(pie.rim, { opacity: toStrip ? 0 : 1, duration: d * 0.4, ease: EASE.enter }, toStrip ? at : at + d * 0.6);
        return d + stagger * (pie.slices.length - 1);
      }
      case 'tween': {
        const built = B(a.target);
        if (!built) return 0;
        const d = DUR.tween * pace;
        if (a.prop === 'opacity') tl.to(built.fx, { opacity: a.to, duration: d }, at);
        else if (a.prop === 'scale') tl.to(built.fx, { scale: a.to, transformOrigin: '50% 50%', duration: d, ease: EASE.move }, at);
        else if (built.entity.type === 'vector' && (a.prop === 'angleDeg' || a.prop === 'magnitude')) {
          const ex = built.extra as { line: SVGLineElement; label?: SVGTextElement; labelOffset: { dx: number; dy: number }; map: { toPx: (p: [number, number]) => Pt }; fromU: [number, number]; toU: [number, number] };
          const dx = ex.toU[0] - ex.fromU[0], dy = ex.toU[1] - ex.fromU[1];
          let mag = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
          if (a.prop === 'magnitude') mag = a.to; else ang = (a.to * Math.PI) / 180;
          const toU: [number, number] = [ex.fromU[0] + mag * Math.cos(ang), ex.fromU[1] + mag * Math.sin(ang)];
          const p = ex.map.toPx(toU);
          tl.to(ex.line, { attr: { x2: p.x, y2: p.y }, duration: d, ease: EASE.move }, at);
          if (ex.label) tl.to(ex.label, { attr: { x: p.x + ex.labelOffset.dx, y: p.y + ex.labelOffset.dy }, duration: d, ease: EASE.move }, at);
          ex.toU = toU;
        } else if (built.extra?.mover && (a.prop === 'x' || a.prop === 'y')) {
          const map = built.extra.map as { toPx: (p: [number, number]) => Pt; space: { x: number[]; y: number[] } };
          const mover = built.extra.mover as SVGGElement;
          const p = a.prop === 'x' ? map.toPx([a.to, map.space.y[0]]) : map.toPx([map.space.x[0], a.to]);
          tl.to(mover, a.prop === 'x' ? { x: p.x, duration: d, ease: EASE.move } : { y: p.y, duration: d, ease: EASE.move }, at);
        }
        return d;
      }
      case 'focus':
        return focus(targets(a.target), a.zoom, b, k, at, pace);
      case 'wait':
        return DUR.wait * a.beats * pace;
      default:
        return 0;
    }
  }

  return { tl, beats, fit };
}
