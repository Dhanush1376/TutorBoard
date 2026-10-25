/**
 * ContentPlugin.ts — General teaching content for non-DSA lessons
 *
 * The lesson engine (server agentLoop) asks the model for scene nodes of type
 * text, equation, rect, circle, orb, triangle and atom. The canvas engine only
 * drew arrays / graph nodes, so maths, science and ML lessons rendered an
 * empty board. This plugin draws those node types: text is measured and
 * wrapped, equations are typeset with KaTeX, shapes take their size/colour
 * from the node's props. Placement is collision-free (LayoutEngine) and every
 * animation is added to the caller's master timeline.
 */

import katex from 'katex';
import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { fadeIn, growFromCenter, drawStroke, staggerIn } from '../anim/primitives';
import { compileExpr } from './mathExpr';

const INK = '#F5F5F0';
const INK_DIM = '#B9BDB7';
const ACCENT = '#F4C95D';

const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Relative luminance of a #rgb/#rrggbb colour, or null if not hex. */
function luminance(c?: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Models often pick dark ink for a light page; keep text legible on the board. */
const inkOf = (c?: string) => {
  const l = luminance(c);
  return l === null || l < 0.45 ? INK : c!;
};
/** Shapes keep their hue unless it would vanish on the dark board. */
const hueOf = (c?: string) => {
  const l = luminance(c);
  if (l === null) return c && /^(rgb|hsl|var\()/i.test(c) ? c : ACCENT;
  return l < 0.12 ? ACCENT : c!;
};

export class ContentPlugin implements ICanvasPlugin {
  public readonly name = 'content';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  createContent(id: string, cmd: any, ctx?: AnimContext): number {
    this.engine.removeElement(id);
    const kind = String(cmd.kind || cmd.type || '').toLowerCase();
    const p = { ...(cmd.props || {}) };
    // Fractional positions (0–1); absolute pixels from an 800×600 design are scaled.
    let fx = num(cmd.x ?? cmd.position?.x, 0.5);
    let fy = num(cmd.y ?? cmd.position?.y, 0.5);
    if (fx > 1) fx /= 800;
    if (fy > 1) fy /= 600;
    const cx = clamp(fx, 0, 1) * this.engine.width;
    const cy = clamp(fy, 0, 1) * this.engine.height;
    const label = p.label ?? p.text ?? cmd.label ?? cmd.text;

    switch (kind) {
      case 'text':
        return this.text(id, cx, cy, String(p.text ?? cmd.text ?? label ?? ''), p, ctx);
      case 'equation':
      case 'formula':
      case 'math':
        return this.equation(id, cx, cy, String(p.latex ?? p.formula ?? p.equation ?? cmd.latex ?? cmd.formula ?? label ?? ''), ctx);
      case 'rect':
      case 'box':
        return this.rect(id, cx, cy, p, label, ctx);
      case 'triangle':
      case 'polygon':
      case 'shape':
        return Array.isArray(p.points) && p.points.length >= 3
          ? this.polygon(id, cx, cy, p, ctx)
          : this.triangle(id, cx, cy, p, ctx);
      case 'line':
      case 'arrow':
      case 'vector':
        return this.line(id, cx, cy, p, kind !== 'line' || !!p.arrow, ctx);
      case 'molecule':
        return this.molecule(id, cx, cy, p, label, ctx);
      case 'network':
      case 'neural_network':
        return this.network(id, cx, cy, p, ctx);
      case 'atom':
        return this.atom(id, cx, cy, p, label, ctx);
      case 'plot':
      case 'graph':
      case 'curve':
        return this.plot(id, cx, cy, p, ctx);
      case 'circle':
        return this.circle(id, cx, cy, p, label, false, ctx);
      default: // orb and other round bodies
        return this.circle(id, cx, cy, p, label, true, ctx);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private group(id: string, x: number, y: number) {
    return this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'content-element')
      .attr('transform', `translate(${x}, ${y})`);
  }

  private place(id: string, cx: number, cy: number, w: number, h: number, padding = 10) {
    const r = this.engine.layout.place(id, { x: cx - w / 2, y: cy - h / 2, w, h }, { padding });
    return { x: r.x + w / 2, y: r.y + h / 2 };
  }

  private labelUnder(g: any, text: string, y: number, size = 12) {
    g.append('text')
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('font-size', `${size}px`)
      .attr('font-weight', 600)
      .attr('fill', INK_DIM)
      .text(text);
  }

  // ── node types ─────────────────────────────────────────────────────────

  private text(id: string, cx: number, cy: number, text: string, p: any, ctx?: AnimContext): number {
    if (!text.trim()) return 0;
    const size = clamp(num(p.fontSize, 15), 11, 26);
    const weight = size >= 20 || p.fontWeight === 'bold' ? 650 : 450;
    const maxW = clamp(num(p.width, size >= 20 ? 520 : 300), 160, 560);
    const { lines, width } = this.engine.layout.wrapText(text, maxW, size, weight, 4);
    const lineH = size * 1.35;
    const at = this.place(id, cx, cy, width, lines.length * lineH);
    const g = this.group(id, at.x, at.y);
    const t = g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${size}px`)
      .attr('font-weight', weight)
      .attr('fill', inkOf(p.color))
      .attr('opacity', size >= 20 ? 1 : 0.88);
    lines.forEach((line, i) => {
      t.append('tspan').attr('x', 0).attr('y', (i - (lines.length - 1) / 2) * lineH + size * 0.35).text(line);
    });
    return ctx ? fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.45 }) : 0;
  }

  private equation(id: string, cx: number, cy: number, latex: string, ctx?: AnimContext): number {
    if (!latex.trim()) return 0;
    let html: string;
    try {
      html = katex.renderToString(latex, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      html = latex;
    }
    // Measure the typeset formula off-screen, shrinking long ones to fit.
    let size = 26;
    let w = 0;
    let h = 0;
    if (typeof document !== 'undefined') {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;';
      probe.innerHTML = html;
      document.body.appendChild(probe);
      for (; size >= 14; size -= 2) {
        probe.style.fontSize = `${size}px`;
        w = probe.offsetWidth;
        h = probe.offsetHeight;
        if (w <= 520) break;
      }
      probe.remove();
    } else {
      w = latex.length * size * 0.55;
      h = size * 1.4;
    }
    const padX = 36;
    const padY = 14;
    const boxW = w + padX * 2;
    const boxH = Math.max(56, h + padY * 2);
    const r = boxH / 2; // Full pill capsule
    const at = this.place(id, cx, cy, boxW, boxH, 12);
    const g = this.group(id, at.x, at.y);
    g.append('rect')
      .attr('x', -boxW / 2).attr('y', -boxH / 2)
      .attr('width', boxW).attr('height', boxH)
      .attr('rx', r).attr('ry', r)
      .attr('fill', '#0F1012')
      .attr('stroke', '#22252A')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))');
    const fo = g.append('foreignObject')
      .attr('x', -boxW / 2).attr('y', -boxH / 2)
      .attr('width', boxW).attr('height', boxH);
    fo.append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('padding', '0 28px')
      .style('box-sizing', 'border-box')
      .style('font-size', `${size}px`)
      .style('color', '#FFFFFF')
      .style('white-space', 'nowrap')
      .html(html);
    return ctx ? fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.5, y: 10 }) : 0;
  }

  private rect(id: string, cx: number, cy: number, p: any, label: any, ctx?: AnimContext): number {
    const w = clamp(num(p.width, 140), 4, 620);
    const h = clamp(num(p.height, 70), 4, 420);
    const color = hueOf(p.color ?? p.fill);
    const solid = h <= 14 || w <= 14; // bars / vectors read as solid strokes
    const at = this.place(id, cx, cy, w, h);
    const g = this.group(id, at.x, at.y);
    g.append('rect')
      .attr('x', -w / 2).attr('y', -h / 2)
      .attr('width', w).attr('height', h)
      .attr('rx', Math.min(12, h / 2, w / 2))
      .attr('fill', color)
      .attr('fill-opacity', solid ? 0.95 : 0.12)
      .attr('stroke', color)
      .attr('stroke-width', solid ? 0 : 2);
    if (label && !solid) {
      const size = 13;
      const { lines } = this.engine.layout.wrapText(String(label), Math.max(60, w - 20), size, 600, 3);
      const t = g.append('text').attr('text-anchor', 'middle').attr('font-size', `${size}px`).attr('font-weight', 600).attr('fill', INK);
      lines.forEach((line, i) => t.append('tspan').attr('x', 0).attr('y', (i - (lines.length - 1) / 2) * size * 1.3 + size * 0.35).text(line));
    }
    return ctx ? growFromCenter(ctx.tl, g.node() as Element, ctx.at, { duration: 0.5 }) : 0;
  }

  private circle(id: string, cx: number, cy: number, p: any, label: any, filled: boolean, ctx?: AnimContext): number {
    const r = filled ? clamp(num(p.radius ?? p.r, 18), 6, 70) : clamp(num(p.radius ?? p.r, 48), 8, 210);
    const color = hueOf(p.color ?? p.fill);
    const showLabel = label != null && String(label).trim() !== '';
    const at = this.place(id, cx, cy, r * 2, r * 2 + (showLabel && filled ? 22 : 0));
    const g = this.group(id, at.x, at.y);
    const c = g.append('circle')
      .attr('r', r)
      .attr('fill', color)
      .attr('fill-opacity', filled ? 0.95 : 0.06)
      .attr('stroke', color)
      .attr('stroke-width', filled ? 0 : 2.5);
    if (filled) c.style('filter', `drop-shadow(0 0 ${Math.round(r * 0.8)}px ${color})`);
    if (showLabel) {
      if (filled) this.labelUnder(g, String(label), r + 18);
      else g.append('text').attr('text-anchor', 'middle').attr('y', 5).attr('font-size', '14px').attr('font-weight', 600).attr('fill', INK).text(String(label));
    }
    if (!ctx) return 0;
    return filled
      ? growFromCenter(ctx.tl, g.node() as Element, ctx.at, { duration: 0.5 })
      : drawStroke(ctx.tl, c.node() as Element, ctx.at, { duration: 0.8 });
  }

  private triangle(id: string, cx: number, cy: number, p: any, ctx?: AnimContext): number {
    const base = clamp(num(p.base, 180), 40, 420);
    const height = clamp(num(p.height, 140), 30, 360);
    const color = hueOf(p.color);
    const at = this.place(id, cx, cy, base, height);
    const g = this.group(id, at.x, at.y);
    const pts: [number, number][] = [[-base / 2, height / 2], [base / 2, height / 2], [-base / 2, -height / 2]];
    const path = g.append('path')
      .attr('d', `M${pts.map((q) => q.join(',')).join('L')}Z`)
      .attr('fill', color).attr('fill-opacity', 0.08)
      .attr('stroke', color).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round');
    const labels: string[] = Array.isArray(p.labels) ? p.labels.map(String) : [];
    const spots: [number, number][] = [[0, height / 2 + 18], [-base / 2 - 16, 4], [10, -6]];
    labels.slice(0, 3).forEach((l, i) => {
      g.append('text').attr('x', spots[i][0]).attr('y', spots[i][1]).attr('text-anchor', 'middle')
        .attr('font-size', '13px').attr('font-weight', 600).attr('fill', INK_DIM).text(l);
    });
    return ctx ? drawStroke(ctx.tl, path.node() as Element, ctx.at, { duration: 0.8 }) : 0;
  }

  private atom(id: string, cx: number, cy: number, p: any, label: any, ctx?: AnimContext): number {
    const r = clamp(num(p.radius, 70), 30, 140);
    const color = hueOf(p.color ?? '#22D3EE');
    const at = this.place(id, cx, cy, r * 2.2, r * 2.2);
    const g = this.group(id, at.x, at.y);
    const electrons = clamp(num(p.electrons, 3), 1, 6);
    for (let k = 0; k < 3; k++) {
      g.append('ellipse').attr('rx', r).attr('ry', r * 0.36)
        .attr('transform', `rotate(${k * 60})`)
        .attr('fill', 'none').attr('stroke', color).attr('stroke-opacity', 0.45).attr('stroke-width', 1.5);
    }
    for (let e = 0; e < electrons; e++) {
      const a = (e / electrons) * Math.PI * 2;
      const rot = ((e % 3) * 60 * Math.PI) / 180;
      const ex = r * Math.cos(a);
      const ey = r * 0.36 * Math.sin(a);
      g.append('circle').attr('r', 5).attr('fill', color)
        .attr('cx', ex * Math.cos(rot) - ey * Math.sin(rot))
        .attr('cy', ex * Math.sin(rot) + ey * Math.cos(rot));
    }
    g.append('circle').attr('r', r * 0.18).attr('fill', '#F59E0B').style('filter', 'drop-shadow(0 0 10px #F59E0B)');
    if (label) this.labelUnder(g, String(label), r + 20);
    return ctx ? growFromCenter(ctx.tl, g.node() as Element, ctx.at, { duration: 0.6 }) : 0;
  }

  /**
   * Function / data plot: props { expr, xMin, xMax, yMin, yMax, points: [[x,y]],
   * marks: [{ x, y, label }], xLabel, yLabel, color, width, height }.
   */
  private plot(id: string, cx: number, cy: number, p: any, ctx?: AnimContext): number {
    const W = clamp(num(p.width, 380), 200, 560);
    const H = clamp(num(p.height, 250), 140, 400);
    const color = hueOf(p.color ?? '#60A5FA');
    let f: ((x: number) => number) | null = null;
    try { if (p.expr || p.function || p.equation) f = compileExpr(String(p.expr ?? p.function ?? p.equation)); } catch { f = null; }
    const pts: [number, number][] = (Array.isArray(p.points) ? p.points : [])
      .map((q: any) => (Array.isArray(q) ? [Number(q[0]), Number(q[1])] : [Number(q?.x), Number(q?.y)]))
      .filter((q: number[]) => q.every(Number.isFinite)) as [number, number][];
    const marks: { x: number; y: number; label?: string }[] = (Array.isArray(p.marks) ? p.marks : [])
      .map((m: any) => ({ x: Number(m.x ?? m[0]), y: Number(m.y ?? m[1]), label: m.label ?? m[2] }))
      .filter((m: any) => Number.isFinite(m.x) && Number.isFinite(m.y));

    // x range: explicit, else from data, else a sensible default
    const xsData = [...pts.map((q) => q[0]), ...marks.map((m) => m.x)];
    let x0 = num(p.xMin, xsData.length ? Math.min(...xsData) : -5);
    let x1 = num(p.xMax, xsData.length ? Math.max(...xsData) : 5);
    if (x1 - x0 < 1e-6) { x0 -= 1; x1 += 1; }
    const samples: [number, number][] = [];
    if (f) for (let i = 0; i <= 140; i++) { const x = x0 + ((x1 - x0) * i) / 140; const y = f(x); if (Number.isFinite(y)) samples.push([x, y]); }
    const ys = [...samples.map((q) => q[1]), ...pts.map((q) => q[1]), ...marks.map((m) => m.y)];
    let y0 = num(p.yMin, ys.length ? Math.min(...ys) : -5);
    let y1 = num(p.yMax, ys.length ? Math.max(...ys) : 5);
    if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
    const padY = (y1 - y0) * 0.08;
    y0 -= padY; y1 += padY;
    const sx = (x: number) => -W / 2 + ((x - x0) / (x1 - x0)) * W;
    const sy = (y: number) => H / 2 - ((y - y0) / (y1 - y0)) * H;

    const at = this.place(id, cx, cy, W + 40, H + 40, 12);
    const g = this.group(id, at.x, at.y);
    const axes = g.append('g').attr('class', 'plot-axes');
    // axes through 0 when visible, else along the frame
    const ax = y0 <= 0 && y1 >= 0 ? sy(0) : H / 2;
    const ay = x0 <= 0 && x1 >= 0 ? sx(0) : -W / 2;
    axes.append('line').attr('x1', -W / 2).attr('x2', W / 2).attr('y1', ax).attr('y2', ax)
      .attr('stroke', 'rgba(255,255,255,0.28)').attr('stroke-width', 1.2);
    axes.append('line').attr('x1', ay).attr('x2', ay).attr('y1', -H / 2).attr('y2', H / 2)
      .attr('stroke', 'rgba(255,255,255,0.28)').attr('stroke-width', 1.2);
    // integer ticks when the range is small enough to read
    if (x1 - x0 <= 24) {
      for (let k = Math.ceil(x0); k <= Math.floor(x1); k++) {
        if (k === 0) continue;
        axes.append('line').attr('x1', sx(k)).attr('x2', sx(k)).attr('y1', ax - 3).attr('y2', ax + 3).attr('stroke', 'rgba(255,255,255,0.28)');
        axes.append('text').attr('x', sx(k)).attr('y', ax + 15).attr('text-anchor', 'middle')
          .attr('font-size', '10px').attr('fill', 'rgba(255,255,255,0.45)').text(String(k));
      }
    }
    if (p.xLabel) axes.append('text').attr('x', W / 2).attr('y', ax - 8).attr('text-anchor', 'end').attr('font-size', '11px').attr('fill', INK_DIM).text(String(p.xLabel));
    if (p.yLabel) axes.append('text').attr('x', ay + 6).attr('y', -H / 2 + 10).attr('font-size', '11px').attr('fill', INK_DIM).text(String(p.yLabel));

    let curve: any = null;
    if (samples.length > 1) {
      const d = samples.map((q, i) => `${i ? 'L' : 'M'}${sx(q[0]).toFixed(1)},${sy(q[1]).toFixed(1)}`).join('');
      curve = g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', color)
        .attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
        .style('filter', `drop-shadow(0 0 6px ${color})`);
    }
    const dots = pts.map((q) => g.append('circle').attr('cx', sx(q[0])).attr('cy', sy(q[1])).attr('r', 4.5)
      .attr('fill', color).attr('fill-opacity', 0.9).node() as Element);
    const markEls = marks.map((m) => {
      const mg = g.append('g').attr('transform', `translate(${sx(m.x)}, ${sy(m.y)})`);
      mg.append('circle').attr('r', 7).attr('fill', '#F59E0B').style('filter', 'drop-shadow(0 0 8px #F59E0B)');
      if (m.label) mg.append('text').attr('y', -14).attr('text-anchor', 'middle').attr('font-size', '12px')
        .attr('font-weight', 650).attr('fill', INK).text(String(m.label));
      return mg.node() as Element;
    });

    if (!ctx) return 0;
    let t = fadeIn(ctx.tl, axes.node() as Element, ctx.at, { duration: 0.4 });
    if (curve) t += drawStroke(ctx.tl, curve.node() as Element, ctx.at + t * 0.6, { duration: 1.1 }) * 0.9;
    if (dots.length) t += staggerIn(ctx.tl, dots, ctx.at + t, { duration: 0.3, stagger: 0.04, y: 0 }) * 0.8;
    if (markEls.length) t += staggerIn(ctx.tl, markEls, ctx.at + t, { duration: 0.4, stagger: 0.15, y: 0 });
    // props.tracer: a body travels along the curve (projectile, particle, descent)
    if (p.tracer && samples.length > 1) {
      const body = g.append('circle').attr('r', 9).attr('fill', '#F2F0EA')
        .style('filter', 'drop-shadow(0 0 10px #F2F0EA)').attr('opacity', 0).node() as Element;
      const trail = g.append('path').attr('fill', 'none').attr('stroke', '#F2F0EA').attr('stroke-opacity', 0.5)
        .attr('stroke-width', 2).attr('stroke-dasharray', '2 6').node() as Element;
      const pos = { k: 0 };
      const dur = clamp(num(p.tracerDuration, 1.8), 0.6, 4);
      const place = () => {
        const i = Math.min(samples.length - 1, Math.round(pos.k * (samples.length - 1)));
        body.setAttribute('cx', String(sx(samples[i][0])));
        body.setAttribute('cy', String(sy(samples[i][1])));
        trail.setAttribute('d', samples.slice(0, i + 1).map((q, n) => `${n ? 'L' : 'M'}${sx(q[0]).toFixed(1)},${sy(q[1]).toFixed(1)}`).join(''));
      };
      ctx.tl.set(body, { opacity: 1 }, ctx.at + t);
      ctx.tl.fromTo(pos, { k: 0 }, { k: 1, duration: dur, ease: 'none', onUpdate: place, onStart: place }, ctx.at + t);
      t += dur;
    }
    return t;
  }


  // ── geometry ───────────────────────────────────────────────────────────

  /**
   * Polygon from vertices: props { points: [[x,y]...] (unit coords 0–1 inside
   * a `size`-px box, or px offsets), labels: ['A','B','C'], sides: ['a','b','c'],
   * angles: [{ at: 0, label: '60°' }] or ['60°','60°','60°'], fill }.
   * Drawn edge by edge, then angle arcs, then labels — a construction.
   */
  private polygon(id: string, cx: number, cy: number, p: any, ctx?: AnimContext): number {
    const size = clamp(num(p.size, 260), 80, 460);
    const raw: [number, number][] = p.points.map((q: any) => (Array.isArray(q) ? [Number(q[0]), Number(q[1])] : [Number(q.x), Number(q.y)]));
    const unit = raw.every(([x, y]) => Math.abs(x) <= 1.5 && Math.abs(y) <= 1.5);
    let pts = raw.map(([x, y]) => (unit ? [x * size, y * size] : [x, y]) as [number, number]);
    const mx = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2;
    const my = (Math.min(...pts.map((q) => q[1])) + Math.max(...pts.map((q) => q[1]))) / 2;
    pts = pts.map(([x, y]) => [x - mx, y - my] as [number, number]);
    const w = Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]));
    const h = Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
    return this.drawPolygon(id, cx, cy, pts, w, h, p, ctx);
  }

  private drawPolygon(id: string, cx: number, cy: number, pts: [number, number][], w: number, h: number, p: any, ctx?: AnimContext): number {
    const color = hueOf(p.color ?? '#60A5FA');
    const at = this.place(id, cx, cy, w + 60, h + 60, 12);
    const g = this.group(id, at.x, at.y);
    const n = pts.length;
    let fillEl: Element | null = null;
    if (p.fill !== false) {
      fillEl = g.append('path')
        .attr('d', `M${pts.map((q) => q.join(',')).join('L')}Z`)
        .attr('fill', hueOf(typeof p.fill === 'string' ? p.fill : color)).attr('fill-opacity', 0.1).node() as Element;
    }
    const edges = pts.map((a, i) => {
      const b = pts[(i + 1) % n];
      return g.append('line').attr('x1', a[0]).attr('y1', a[1]).attr('x2', b[0]).attr('y2', b[1])
        .attr('stroke', color).attr('stroke-width', 3).attr('stroke-linecap', 'round').node() as Element;
    });
    // angle arcs at requested vertices
    const angleSpecs: { at: number; label?: string }[] = (Array.isArray(p.angles) ? p.angles : [])
      .map((a: any, i: number) => (typeof a === 'object' && a ? { at: num(Number(a.at ?? a.vertex), i), label: a.label } : { at: i, label: String(a) }));
    const arcs = angleSpecs.filter((a) => a.at >= 0 && a.at < n).map((a) => {
      const v = pts[a.at];
      const u1 = pts[(a.at + n - 1) % n];
      const u2 = pts[(a.at + 1) % n];
      const a1 = Math.atan2(u1[1] - v[1], u1[0] - v[0]);
      const a2 = Math.atan2(u2[1] - v[1], u2[0] - v[0]);
      let d = a2 - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      const r = 26;
      const sx = v[0] + r * Math.cos(a1);
      const sy = v[1] + r * Math.sin(a1);
      const ex = v[0] + r * Math.cos(a1 + d);
      const ey = v[1] + r * Math.sin(a1 + d);
      const arc = g.append('path')
        .attr('d', `M${sx},${sy}A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${ex},${ey}`)
        .attr('fill', 'none').attr('stroke', '#F59E0B').attr('stroke-width', 2.2).node() as Element;
      const mid = a1 + d / 2;
      const lbl = a.label
        ? g.append('text').attr('x', v[0] + (r + 18) * Math.cos(mid)).attr('y', v[1] + (r + 18) * Math.sin(mid) + 4)
          .attr('text-anchor', 'middle').attr('font-size', '13px').attr('font-weight', 650).attr('fill', '#FBBF24').text(a.label).node() as Element
        : null;
      return { arc, lbl };
    });
    // vertex + side labels, pushed outward from the centroid
    const cxm = pts.reduce((sum, q) => sum + q[0], 0) / n;
    const cym = pts.reduce((sum, q) => sum + q[1], 0) / n;
    const labels: Element[] = [];
    (Array.isArray(p.labels) ? p.labels : []).slice(0, n).forEach((l: any, i: number) => {
      const v = pts[i];
      const dx = v[0] - cxm;
      const dy = v[1] - cym;
      const len = Math.hypot(dx, dy) || 1;
      labels.push(g.append('text').attr('x', v[0] + (dx / len) * 20).attr('y', v[1] + (dy / len) * 20 + 5)
        .attr('text-anchor', 'middle').attr('font-size', '15px').attr('font-weight', 700).attr('fill', INK).text(String(l)).node() as Element);
    });
    (Array.isArray(p.sides) ? p.sides : []).slice(0, n).forEach((l: any, i: number) => {
      if (l == null || l === '') return;
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const mxs = (a[0] + b[0]) / 2;
      const mys = (a[1] + b[1]) / 2;
      const dx = mxs - cxm;
      const dy = mys - cym;
      const len = Math.hypot(dx, dy) || 1;
      labels.push(g.append('text').attr('x', mxs + (dx / len) * 18).attr('y', mys + (dy / len) * 18 + 5)
        .attr('text-anchor', 'middle').attr('font-size', '13px').attr('font-weight', 600).attr('fill', INK_DIM).text(String(l)).node() as Element);
    });
    if (!ctx) return 0;
    const per = 0.35;
    edges.forEach((e, i) => { drawStroke(ctx.tl, e, ctx.at + i * per, { duration: per + 0.05 }); });
    let t = edges.length * per;
    if (fillEl) fadeIn(ctx.tl, fillEl, ctx.at + t * 0.7, { duration: 0.4, y: 0 });
    arcs.forEach((a, i) => {
      drawStroke(ctx.tl, a.arc, ctx.at + t + i * 0.18, { duration: 0.35 });
      if (a.lbl) fadeIn(ctx.tl, a.lbl, ctx.at + t + i * 0.18 + 0.15, { duration: 0.3, y: 4 });
    });
    t += arcs.length * 0.18 + (arcs.length ? 0.3 : 0);
    if (labels.length) staggerIn(ctx.tl, labels, ctx.at + Math.max(0.2, t - 0.3), { duration: 0.3, stagger: 0.06, y: 0 });
    return t + 0.3;
  }

  /** Line / vector: props { x2, y2 } (unit or px offsets from its position) or { length, angle }, arrow. */
  private line(id: string, cx: number, cy: number, p: any, arrow: boolean, ctx?: AnimContext): number {
    let dx: number;
    let dy: number;
    if (p.x2 != null && p.y2 != null) {
      const ux = Number(p.x2) - num(Number(p.x1), 0);
      const uy = Number(p.y2) - num(Number(p.y1), 0);
      const unit = Math.abs(ux) <= 1.5 && Math.abs(uy) <= 1.5;
      dx = unit ? ux * this.engine.width : ux;
      dy = unit ? uy * this.engine.height : uy;
    } else {
      const len = clamp(num(Number(p.length), 160), 20, 520);
      const ang = (num(Number(p.angle), 0) * Math.PI) / 180;
      dx = len * Math.cos(ang);
      dy = -len * Math.sin(ang);
    }
    const color = hueOf(p.color ?? '#F2F0EA');
    const at = this.place(id, cx + dx / 2, cy + dy / 2, Math.abs(dx) + 20, Math.abs(dy) + 20, 4);
    const g = this.group(id, at.x, at.y);
    const ln = g.append('line').attr('x1', -dx / 2).attr('y1', -dy / 2).attr('x2', dx / 2).attr('y2', dy / 2)
      .attr('stroke', color).attr('stroke-width', 3).attr('stroke-linecap', 'round');
    let head: Element | null = null;
    if (arrow) {
      const a = Math.atan2(dy, dx);
      const hx = dx / 2;
      const hy = dy / 2;
      const s = 12;
      head = g.append('path')
        .attr('d', `M${hx},${hy}L${hx - s * Math.cos(a - 0.4)},${hy - s * Math.sin(a - 0.4)}L${hx - s * Math.cos(a + 0.4)},${hy - s * Math.sin(a + 0.4)}Z`)
        .attr('fill', color).node() as Element;
    }
    if (p.label) {
      g.append('text').attr('x', 0).attr('y', -10).attr('text-anchor', 'middle').attr('font-size', '13px').attr('font-weight', 600).attr('fill', INK).text(String(p.label));
    }
    if (!ctx) return 0;
    const d = drawStroke(ctx.tl, ln.node() as Element, ctx.at, { duration: 0.5 });
    if (head) fadeIn(ctx.tl, head, ctx.at + d * 0.8, { duration: 0.2, y: 0 });
    return d + 0.2;
  }

  // ── chemistry ──────────────────────────────────────────────────────────

  /**
   * Molecule: props { atoms: [{ el: 'O', x?, y? }], bonds: [[i, j, order?]] }.
   * Without coordinates the first atom sits in the centre and the rest ring
   * around it. Atoms use CPK-like colours; double bonds draw as pairs.
   */
  private molecule(id: string, cx: number, cy: number, p: any, label: any, ctx?: AnimContext): number {
    const atoms: { el: string; x?: number; y?: number }[] = (Array.isArray(p.atoms) ? p.atoms : [])
      .map((a: any) => (typeof a === 'string' ? { el: a } : { el: String(a.el ?? a.element ?? a.symbol ?? a.label ?? '?'), x: a.x, y: a.y }));
    if (!atoms.length) return 0;
    const bond = 92;
    const hasXY = atoms.every((a) => Number.isFinite(Number(a.x)) && Number.isFinite(Number(a.y)));
    let pos: [number, number][];
    if (hasXY) {
      const raw = atoms.map((a) => [Number(a.x), Number(a.y)] as [number, number]);
      const unit = raw.every(([x, y]) => Math.abs(x) <= 3 && Math.abs(y) <= 3);
      pos = raw.map(([x, y]) => (unit ? [x * bond, y * bond] : [x, y]) as [number, number]);
    } else {
      const ring = atoms.length - 1;
      pos = atoms.map((_, i) => {
        if (i === 0) return [0, 0] as [number, number];
        const a = -Math.PI / 2 + ((i - 1) / Math.max(1, ring)) * Math.PI * 2 + (ring === 2 ? Math.PI / 6 : 0);
        return [bond * Math.cos(a), bond * Math.sin(a)] as [number, number];
      });
    }
    const mx = (Math.min(...pos.map((q) => q[0])) + Math.max(...pos.map((q) => q[0]))) / 2;
    const my = (Math.min(...pos.map((q) => q[1])) + Math.max(...pos.map((q) => q[1]))) / 2;
    pos = pos.map(([x, y]) => [x - mx, y - my] as [number, number]);
    const w = Math.max(...pos.map((q) => q[0])) - Math.min(...pos.map((q) => q[0])) + 90;
    const h = Math.max(...pos.map((q) => q[1])) - Math.min(...pos.map((q) => q[1])) + 90;
    const at = this.place(id, cx, cy, w, h + (label ? 30 : 0), 12);
    const g = this.group(id, at.x, at.y);
    const bonds: [number, number, number][] = (Array.isArray(p.bonds) && p.bonds.length
      ? p.bonds.map((b: any) => (Array.isArray(b) ? [Number(b[0]), Number(b[1]), Number(b[2] ?? 1)] : [Number(b.from ?? b.a), Number(b.to ?? b.b), Number(b.order ?? 1)]))
      : atoms.slice(1).map((_, i) => [0, i + 1, 1])) as [number, number, number][];
    const bondEls: Element[] = [];
    bonds.forEach(([i, j, order]) => {
      const a = pos[i];
      const b = pos[j];
      if (!a || !b) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const offsets = order >= 3 ? [-6, 0, 6] : order === 2 ? [-4, 4] : [0];
      offsets.forEach((o) => {
        bondEls.push(g.append('line').attr('x1', a[0] + nx * o).attr('y1', a[1] + ny * o).attr('x2', b[0] + nx * o).attr('y2', b[1] + ny * o)
          .attr('stroke', 'rgba(242,240,234,0.55)').attr('stroke-width', 3).attr('stroke-linecap', 'round').node() as Element);
      });
    });
    const CPK: Record<string, string> = { H: '#E5E7EB', C: '#6B7280', N: '#3B82F6', O: '#EF4444', F: '#22C55E', Cl: '#22C55E', S: '#EAB308', P: '#F97316', Na: '#0EA5E9', K: '#0EA5E9' };
    const atomEls = atoms.map((a, i) => {
      const r = a.el === 'H' ? 17 : 24;
      const fill = CPK[a.el] ?? '#3B82F6';
      const ag = g.append('g').attr('transform', `translate(${pos[i][0]}, ${pos[i][1]})`);
      ag.append('circle').attr('r', r).attr('fill', fill);
      ag.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', a.el === 'H' ? '13px' : '16px')
        .attr('font-weight', 700).attr('fill', a.el === 'H' ? '#111' : '#fff').text(a.el);
      return ag.node() as Element;
    });
    if (label) this.labelUnder(g, String(label), h / 2 + 4, 14);
    if (!ctx) return 0;
    const t = staggerIn(ctx.tl, atomEls, ctx.at, { duration: 0.4, stagger: 0.12, y: 0 });
    bondEls.forEach((b, i) => drawStroke(ctx.tl, b, ctx.at + 0.25 + i * 0.08, { duration: 0.35 }));
    return Math.max(t, 0.25 + bondEls.length * 0.08 + 0.35);
  }

  // ── machine learning ───────────────────────────────────────────────────

  /**
   * Neural network: props { layers: [3, 4, 2], inputs: ['x1',..], outputs: ['cat','dog'],
   * prediction: 0, layerLabels: ['Input','Hidden','Output'] }. Layers appear left
   * to right, connections draw, a signal sweeps through, the prediction lights.
   */
  private network(id: string, cx: number, cy: number, p: any, ctx?: AnimContext): number {
    const layers: number[] = (Array.isArray(p.layers) ? p.layers : [3, 4, 2]).map((n: any) => clamp(Math.round(num(Number(n), 3)), 1, 7)).slice(0, 6);
    const W = clamp(num(Number(p.width), 120 * (layers.length - 1) + 80), 200, 560);
    const H = clamp(num(Number(p.height), 300), 160, 380);
    const color = hueOf(p.color ?? '#60A5FA');
    const at = this.place(id, cx, cy, W + 120, H + 50, 12);
    const g = this.group(id, at.x, at.y);
    const colX = (l: number) => -W / 2 + (layers.length === 1 ? W / 2 : (l / (layers.length - 1)) * W);
    const rowY = (l: number, i: number) => (layers[l] === 1 ? 0 : -H / 2 + (i / (layers[l] - 1)) * H);
    const edgeGroups: Element[][] = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const es: Element[] = [];
      for (let i = 0; i < layers[l]; i++) for (let j = 0; j < layers[l + 1]; j++) {
        es.push(g.append('line').attr('x1', colX(l)).attr('y1', rowY(l, i)).attr('x2', colX(l + 1)).attr('y2', rowY(l + 1, j))
          .attr('stroke', color).attr('stroke-opacity', 0.28).attr('stroke-width', 1.2).node() as Element);
      }
      edgeGroups.push(es);
    }
    const nodeGroups: Element[][] = layers.map((n, l) => Array.from({ length: n }, (_, i) =>
      g.append('circle').attr('cx', colX(l)).attr('cy', rowY(l, i)).attr('r', 13)
        .attr('fill', '#111318').attr('stroke', color).attr('stroke-width', 2.5).node() as Element));
    const inputs: string[] = Array.isArray(p.inputs) ? p.inputs.map(String) : [];
    const outputs: string[] = Array.isArray(p.outputs) ? p.outputs.map(String) : [];
    const textEls: Element[] = [];
    inputs.slice(0, layers[0]).forEach((t, i) => textEls.push(g.append('text').attr('x', colX(0) - 22).attr('y', rowY(0, i) + 4)
      .attr('text-anchor', 'end').attr('font-size', '12px').attr('fill', INK_DIM).text(t).node() as Element));
    const last = layers.length - 1;
    const pred = Number.isFinite(Number(p.prediction)) ? Number(p.prediction) : -1;
    const outEls = outputs.slice(0, layers[last]).map((t, i) => g.append('text').attr('x', colX(last) + 22).attr('y', rowY(last, i) + 5)
      .attr('font-size', '14px').attr('font-weight', i === pred ? 700 : 500).attr('fill', i === pred ? '#FBBF24' : INK_DIM).text(t).node() as Element);
    (Array.isArray(p.layerLabels) ? p.layerLabels : []).slice(0, layers.length).forEach((t: any, l: number) => textEls.push(
      g.append('text').attr('x', colX(l)).attr('y', H / 2 + 34).attr('text-anchor', 'middle').attr('font-size', '11px')
        .attr('letter-spacing', '0.12em').attr('fill', INK_DIM).text(String(t).toUpperCase()).node() as Element));
    if (!ctx) return 0;
    let t = 0;
    nodeGroups.forEach((ns, l) => {
      staggerIn(ctx.tl, ns, ctx.at + t, { duration: 0.3, stagger: 0.04, y: 0 });
      t += 0.22;
      if (edgeGroups[l]) {
        edgeGroups[l].forEach((e) => drawStroke(ctx.tl, e, ctx.at + t, { duration: 0.35 }));
        t += 0.22;
      }
    });
    if (textEls.length) staggerIn(ctx.tl, textEls, ctx.at + 0.2, { duration: 0.3, stagger: 0.03, y: 0 });
    // the signal: each layer lights in turn, then the prediction
    t += 0.15;
    nodeGroups.forEach((ns, l) => {
      const at2 = ctx.at + t + l * 0.18;
      ctx.tl.to(ns, { attr: { fill: color }, duration: 0.15, ease: 'power1.out' }, at2);
      ctx.tl.to(ns, { attr: { fill: '#111318' }, duration: 0.35, ease: 'power1.in' }, at2 + 0.18);
      if (edgeGroups[l]) ctx.tl.to(edgeGroups[l], { attr: { 'stroke-opacity': 0.7 }, duration: 0.15, yoyo: true, repeat: 1 }, at2 + 0.05);
    });
    t += layers.length * 0.18 + 0.2;
    if (pred >= 0 && nodeGroups[last][pred]) {
      ctx.tl.to(nodeGroups[last][pred], { attr: { fill: '#F59E0B', stroke: '#F59E0B' }, duration: 0.3 }, ctx.at + t);
    }
    if (outEls.length) staggerIn(ctx.tl, outEls, ctx.at + t, { duration: 0.35, stagger: 0.08, y: 0 });
    return t + 0.45;
  }

}
