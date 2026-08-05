/**
 * anim/primitives.ts — Manim-inspired animation primitives.
 *
 * Contract: every primitive ADDS tweens to the caller's GSAP timeline at the
 * given position and returns the duration (seconds) it occupies. Nothing here
 * ever starts an independent tween — the master timeline owns all motion, so
 * pause / resume / seek / timeScale work across the entire scene.
 *
 * All primitives use fromTo so scrubbing backward re-applies initial states
 * deterministically.
 */

import gsap from 'gsap';

type TL = gsap.core.Timeline;
type Target = Element | Element[] | null;

const clean = (t: Target): Element[] => {
  if (!t) return [];
  return Array.isArray(t) ? t.filter(Boolean) : [t];
};

// ── Entrances ───────────────────────────────────────────────────────────────

/** FadeIn — gentle opacity + rise. */
export function fadeIn(tl: TL, target: Target, at: number, opts: { duration?: number; y?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.4;
  tl.fromTo(els, { autoAlpha: 0, y: opts.y ?? 8 }, { autoAlpha: 1, y: 0, duration: d, ease: 'power2.out' }, at);
  return d;
}

/** FadeOut. */
export function fadeOut(tl: TL, target: Target, at: number, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.35;
  tl.to(els, { autoAlpha: 0, duration: d, ease: 'power2.in' }, at);
  return d;
}

/** GrowFromCenter — Manim's GrowFromCenter (scale 0 → 1 with overshoot). */
export function growFromCenter(tl: TL, target: Target, at: number, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.5;
  tl.fromTo(
    els,
    { autoAlpha: 0, scale: 0, transformOrigin: 'center center' },
    { autoAlpha: 1, scale: 1, duration: d, ease: 'back.out(1.7)' },
    at
  );
  return d;
}

/** PopIn — softer entrance for cells/blocks. */
export function popIn(tl: TL, target: Target, at: number, opts: { duration?: number; from?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.4;
  tl.fromTo(
    els,
    { autoAlpha: 0, scale: opts.from ?? 0.6, y: 14, transformOrigin: 'center center' },
    { autoAlpha: 1, scale: 1, y: 0, duration: d, ease: 'back.out(1.6)' },
    at
  );
  return d;
}

/** Staggered entrance for collections (array cells, tree nodes, chart bars). */
export function staggerIn(
  tl: TL,
  targets: Element[],
  at: number,
  opts: { duration?: number; stagger?: number; y?: number } = {}
): number {
  const els = clean(targets);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.4;
  const stagger = opts.stagger ?? 0.05;
  tl.fromTo(
    els,
    { autoAlpha: 0, scale: 0.5, y: opts.y ?? 18, transformOrigin: 'center center' },
    { autoAlpha: 1, scale: 1, y: 0, duration: d, stagger, ease: 'back.out(1.7)' },
    at
  );
  return d + stagger * Math.max(0, els.length - 1);
}

/** Write — line-by-line text reveal (works on <tspan> lines or char groups). */
export function writeLines(tl: TL, lines: Element[], at: number, opts: { perLine?: number } = {}): number {
  const els = clean(lines);
  if (!els.length) return 0;
  const per = opts.perLine ?? 0.28;
  tl.fromTo(
    els,
    { autoAlpha: 0, x: -6 },
    { autoAlpha: 1, x: 0, duration: per, stagger: per * 0.8, ease: 'power2.out' },
    at
  );
  return per + per * 0.8 * Math.max(0, els.length - 1);
}

// ── Strokes / paths ─────────────────────────────────────────────────────────

/** Create (Manim) — draw a path/line/shape by animating stroke-dashoffset. */
export function drawStroke(tl: TL, target: Target, at: number, opts: { duration?: number } = {}): number {
  const els = clean(target) as (SVGGeometryElement | SVGLineElement)[];
  if (!els.length) return 0;
  const d = opts.duration ?? 0.6;
  for (const el of els) {
    let len = 100;
    try {
      len = typeof (el as SVGGeometryElement).getTotalLength === 'function'
        ? (el as SVGGeometryElement).getTotalLength()
        : 100;
    } catch { /* detached or non-geometry element */ }
    if (!isFinite(len) || len <= 0) len = 100;
    tl.fromTo(
      el,
      { strokeDasharray: len, strokeDashoffset: len, autoAlpha: 1 },
      { strokeDashoffset: 0, duration: d, ease: 'power2.inOut' },
      at
    );
  }
  return d;
}

/** GrowArrow / edge growth — animate a line from its start point to its end. */
export function growLine(
  tl: TL,
  line: Element | null,
  at: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { duration?: number } = {}
): number {
  if (!line) return 0;
  const d = opts.duration ?? 0.45;
  tl.fromTo(
    line,
    { attr: { x1: from.x, y1: from.y, x2: from.x, y2: from.y }, autoAlpha: 1 },
    { attr: { x2: to.x, y2: to.y }, duration: d, ease: 'power2.out' },
    at
  );
  return d;
}

// ── Emphasis ────────────────────────────────────────────────────────────────

/** Indicate (Manim) — brief scale + settle to draw the eye. */
export function indicate(tl: TL, target: Target, at: number, opts: { duration?: number; scale?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.6;
  tl.to(els, {
    scale: opts.scale ?? 1.12,
    transformOrigin: 'center center',
    duration: d / 2,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
  }, at);
  return d;
}

/** Pulse — double heartbeat. */
export function pulse(tl: TL, target: Target, at: number, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.6;
  tl.to(els, {
    scale: 1.15,
    transformOrigin: 'center center',
    duration: d / 4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }, at);
  return d;
}

/** Shake — error / rejection gesture. */
export function shake(tl: TL, target: Target, at: number, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.4;
  tl.to(els, { x: '+=9', duration: d / 8, ease: 'sine.inOut', yoyo: true, repeat: 7 }, at)
    .set(els, { x: 0 }, at + d);
  return d;
}

/** Highlight fill — colour flash that returns to the original fill. */
export function flashFill(tl: TL, target: Target, at: number, color: string, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.6;
  tl.to(els, { fill: color, duration: d / 2, ease: 'power2.inOut', yoyo: true, repeat: 1 }, at);
  return d;
}

/** Set fill permanently (color_to). */
export function colorTo(tl: TL, target: Target, at: number, color: string, opts: { duration?: number } = {}): number {
  const els = clean(target);
  if (!els.length) return 0;
  const d = opts.duration ?? 0.4;
  tl.to(els, { fill: color, duration: d, ease: 'power2.inOut' }, at);
  return d;
}

/**
 * Circumscribe (Manim) — draw a temporary rounded rectangle around a bbox,
 * hold, then fade it away. `layer` receives the ephemeral element.
 */
export function circumscribe(
  tl: TL,
  layer: SVGGElement,
  bbox: { x: number; y: number; w: number; h: number },
  at: number,
  opts: { color?: string; padding?: number; hold?: number } = {}
): number {
  const pad = opts.padding ?? 8;
  const ns = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('x', String(bbox.x - pad));
  rect.setAttribute('y', String(bbox.y - pad));
  rect.setAttribute('width', String(bbox.w + pad * 2));
  rect.setAttribute('height', String(bbox.h + pad * 2));
  rect.setAttribute('rx', '10');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', opts.color || '#f59e0b');
  rect.setAttribute('stroke-width', '2.5');
  rect.setAttribute('class', 'fx-ephemeral');
  rect.style.visibility = 'hidden';
  layer.appendChild(rect);

  const draw = drawStroke(tl, rect, at, { duration: 0.5 });
  const hold = opts.hold ?? 0.7;
  fadeOut(tl, rect, at + draw + hold, { duration: 0.3 });
  return draw + hold + 0.3;
}

/** Flash (Manim) — quick radial attention burst at a point. */
export function flashAt(
  tl: TL,
  layer: SVGGElement,
  point: { x: number; y: number },
  at: number,
  opts: { color?: string; radius?: number } = {}
): number {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'fx-ephemeral');
  g.setAttribute('transform', `translate(${point.x}, ${point.y})`);
  g.style.visibility = 'hidden';
  const r = opts.radius ?? 26;
  const color = opts.color || '#fbbf24';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(Math.cos(angle) * r * 0.4));
    line.setAttribute('y1', String(Math.sin(angle) * r * 0.4));
    line.setAttribute('x2', String(Math.cos(angle) * r));
    line.setAttribute('y2', String(Math.sin(angle) * r));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
  }
  layer.appendChild(g);

  tl.fromTo(g, { autoAlpha: 0, scale: 0.4, transformOrigin: 'center center' },
    { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, at);
  tl.to(g, { autoAlpha: 0, scale: 1.25, duration: 0.3, ease: 'power2.in' }, at + 0.2);
  return 0.5;
}

// ── Movement ────────────────────────────────────────────────────────────────

/** Smooth translate of a positioned group to an absolute logical position. */
export function moveTo(
  tl: TL,
  target: Element | null,
  at: number,
  pos: { x: number; y: number },
  opts: { duration?: number } = {}
): number {
  if (!target) return 0;
  const d = opts.duration ?? 0.45;
  tl.to(target, {
    attr: { transform: `translate(${pos.x}, ${pos.y})` },
    duration: d,
    ease: 'power2.inOut',
  }, at);
  return d;
}

/**
 * Arc swap of two elements (sorting visualizations). Positions are resolved
 * lazily at play time via function-based values, so the swap works no matter
 * what moved earlier in the timeline. The DOM transform swap is committed at
 * the end.
 */
export function arcSwap(
  tl: TL,
  getEl1: () => Element | null,
  getEl2: () => Element | null,
  at: number,
  commit: () => void,
  opts: { duration?: number } = {}
): number {
  const d = opts.duration ?? 0.6;

  const center = (el: Element | null) => {
    if (!el) return { x: 0, y: 0 };
    try {
      const b = (el as SVGGraphicsElement).getBBox();
      const m = /translate\(([-\d.]+)[,\s]+([-\d.]+)/.exec(el.getAttribute('transform') || '');
      return { x: (m ? +m[1] : 0) + b.x + b.width / 2, y: (m ? +m[2] : 0) + b.y + b.height / 2 };
    } catch {
      return { x: 0, y: 0 };
    }
  };

  // Measured lazily at play time (a call at the same position fires before
  // the tweens' first render), so the swap is correct even after earlier
  // timeline actions moved things. Function-based values keep the motion
  // fully inside the master timeline — pausable, scrubbable, speed-scalable.
  let dx = 0;
  let dy = 0;
  tl.call(() => {
    const p1 = center(getEl1());
    const p2 = center(getEl2());
    dx = p2.x - p1.x;
    dy = p2.y - p1.y;
  }, [], at);

  const el1 = getEl1();
  const el2 = getEl2();
  if (!el1 || !el2) return 0;

  tl.to(el1, { x: () => dx, y: () => dy, scale: 1.08, duration: d, ease: 'power2.inOut', transformOrigin: 'center center' }, at);
  tl.to(el2, { x: () => -dx, y: () => -dy, scale: 0.94, duration: d, ease: 'power2.inOut', transformOrigin: 'center center' }, at);
  tl.call(() => {
    const a = getEl1();
    const b = getEl2();
    if (a) gsap.set(a, { x: 0, y: 0, scale: 1 });
    if (b) gsap.set(b, { x: 0, y: 0, scale: 1 });
    commit();
  }, [], at + d);
  return d;
}
