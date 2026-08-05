/**
 * AuxPlugin.ts — Auxiliary Visualization Plugin
 *
 * annotate / result / comparator / chart / timeline. Text is measured and
 * wrapped (never estimated), annotations are placed collision-free near their
 * targets, banners live in reserved layout zones so they can't collide with
 * content, and every animation is added to the master timeline.
 */

import * as d3 from 'd3';
import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { fadeIn, staggerIn, drawStroke } from '../anim/primitives';

const PALETTE = ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#8B5CF6', '#10B981'];

export class AuxPlugin implements ICanvasPlugin {
  public readonly name = 'aux';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  private get W() { return this.engine.width; }
  private get H() { return this.engine.height; }

  /** Center of an existing element in logical coordinates. */
  private centerOf(id: string): { x: number; y: number } {
    const bbox = this.engine.getBBoxOf(id);
    if (bbox) return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    return { x: this.W / 2, y: this.H * 0.3 };
  }

  // ── annotate ────────────────────────────────────────────────────────────
  annotate(targetId: string, text: string, ctx?: AnimContext): number {
    const layout = this.engine.layout;
    const target = this.centerOf(targetId);
    const id = `annotate_${targetId}`;
    this.engine.removeElement(id);

    const fontSize = 12;
    const { lines, width: textW } = layout.wrapText(String(text), 240, fontSize, 600, 3);
    const padX = 12;
    const lineH = fontSize * 1.35;
    const boxW = textW + padX * 2;
    const boxH = lines.length * lineH + 14;

    // Prefer a spot above the target; LayoutEngine dodges collisions.
    const placed = layout.place(id, {
      x: target.x - boxW / 2,
      y: target.y - boxH - 52,
      w: boxW,
      h: boxH,
    }, { padding: 8, prefer: 'up' });

    const bx = placed.x + boxW / 2;   // box center
    const by = placed.y + boxH / 2;

    const g = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'aux-annotate')
      .attr('transform', `translate(${bx}, ${by})`);

    g.append('rect')
      .attr('x', -boxW / 2)
      .attr('y', -boxH / 2)
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('rx', 8)
      .attr('fill', 'rgba(99,102,241,0.15)')
      .attr('stroke', '#6366F1')
      .attr('stroke-width', 1);

    const textEl = g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${fontSize}px`)
      .attr('font-weight', 600)
      .attr('fill', 'var(--text-primary, #fff)');
    lines.forEach((line, i) => {
      textEl.append('tspan')
        .attr('x', 0)
        .attr('y', -boxH / 2 + 10 + (i + 0.7) * lineH)
        .text(line);
    });

    // Dashed connector from the box edge toward the target.
    const towardY = target.y > by ? boxH / 2 : -boxH / 2;
    const connectorLen = Math.min(36, Math.max(12, Math.abs(target.y - by) - boxH / 2 - 14));
    g.append('line')
      .attr('x1', 0).attr('y1', towardY)
      .attr('x2', (target.x - bx) * 0.25).attr('y2', towardY + Math.sign(towardY) * connectorLen)
      .attr('stroke', '#6366F1')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    if (ctx) {
      return fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.4 });
    }
    return 0;
  }

  // ── result ──────────────────────────────────────────────────────────────
  showResult(text: string, ctx?: AnimContext): number {
    const layout = this.engine.layout;
    const id = 'aux-result-banner';
    this.engine.removeElement(id);

    const fontSize = 15;
    const { lines, width: textW } = layout.wrapText(String(text), this.W - 140, fontSize, 700, 2);
    const boxW = Math.min(this.W - 60, textW + 56);
    const lineH = fontSize * 1.3;
    const boxH = Math.max(44, lines.length * lineH + 18);
    const footer = layout.footerArea;
    const cy = footer.y + footer.h / 2;

    const g = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'aux-result')
      .attr('transform', `translate(${this.W / 2}, ${cy})`);

    g.append('rect')
      .attr('x', -boxW / 2)
      .attr('y', -boxH / 2)
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('rx', boxH / 2)
      .attr('fill', 'rgba(34,197,94,0.15)')
      .attr('stroke', '#22C55E')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 0 12px rgba(34,197,94,0.3))');

    const textEl = g.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${fontSize}px`)
      .attr('font-weight', 700)
      .attr('fill', '#bbf7d0');
    lines.forEach((line, i) => {
      textEl.append('tspan')
        .attr('x', 0)
        .attr('y', -((lines.length - 1) * lineH) / 2 + i * lineH)
        .attr('dy', '0.32em')
        .text(line);
    });

    if (ctx) {
      return fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.5, y: 16 });
    }
    return 0;
  }

  // ── compare ─────────────────────────────────────────────────────────────
  createComparator(left: any, right: any, op: string = '==', ctx?: AnimContext): number {
    const layout = this.engine.layout;
    const id = 'aux-comparator';
    this.engine.removeElement(id);

    const header = layout.headerArea;
    const g = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'aux-compare')
      .attr('transform', `translate(${this.W / 2}, ${header.y + header.h / 2})`);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.32em')
      .attr('font-size', '22px')
      .attr('font-weight', 700)
      .attr('fill', 'var(--text-primary, #fff)')
      .text(`${left} ${op} ${right}`);

    if (ctx) {
      return fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.4 });
    }
    return 0;
  }

  // ── chart ───────────────────────────────────────────────────────────────
  createChart(id: string, data: any, type: string = 'bar', ctx?: AnimContext): number {
    this.engine.removeElement(id);
    const rows = this.normalizeChartData(data);
    if (rows.length === 0) return 0;

    const layout = this.engine.layout;
    const safe = layout.safeArea;
    const chartW = Math.min(safe.w - 40, 620);
    const chartH = Math.min(safe.h - 60, 260);
    const rect = layout.allocateRow(id, chartW, chartH + 30, { gap: 40 });
    const baseY = chartH;

    const g = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'aux-chart')
      .attr('transform', `translate(${rect.x}, ${rect.y})`);

    const maxVal = Math.max(...rows.map(r => r.value), 1);
    const yScale = (v: number) => (v / maxVal) * (chartH - 30);

    g.append('line')
      .attr('x1', 0).attr('y1', baseY)
      .attr('x2', chartW).attr('y2', baseY)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1);

    let duration = 0;

    if (type === 'line') {
      const stepX = rows.length > 1 ? chartW / (rows.length - 1) : chartW;
      const line = d3.line<{ value: number }>()
        .x((_, i) => i * stepX)
        .y(d => baseY - yScale(d.value))
        .curve(d3.curveMonotoneX);
      const path = g.append('path')
        .datum(rows)
        .attr('fill', 'none')
        .attr('stroke', PALETTE[0])
        .attr('stroke-width', 2.5)
        .attr('d', line as any)
        .style('filter', 'drop-shadow(0 0 6px rgba(99,102,241,0.4))');

      const dots: Element[] = [];
      rows.forEach((r, i) => {
        const dot = g.append('circle')
          .attr('cx', i * stepX).attr('cy', baseY - yScale(r.value)).attr('r', 4)
          .attr('fill', PALETTE[0]);
        dots.push(dot.node() as Element);
        g.append('text')
          .attr('x', i * stepX).attr('y', baseY + 18)
          .attr('text-anchor', 'middle').attr('font-size', '11px')
          .attr('fill', 'var(--text-secondary, #a1a1aa)').text(r.label);
      });

      if (ctx) {
        const drawDur = drawStroke(ctx.tl, path.node() as Element, ctx.at, { duration: 0.8 });
        const dotDur = staggerIn(ctx.tl, dots, ctx.at + 0.2, { duration: 0.25, stagger: 0.6 / rows.length, y: 0 });
        duration = Math.max(drawDur, 0.2 + dotDur);
      }
    } else {
      const barW = chartW / rows.length;
      const bars: { el: Element; h: number }[] = [];
      rows.forEach((r, i) => {
        const h = yScale(r.value);
        const bx = i * barW + barW * 0.15;
        const bw = barW * 0.7;
        const color = PALETTE[i % PALETTE.length];
        const bar = g.append('rect')
          .attr('x', bx).attr('y', baseY - h).attr('width', bw).attr('height', h)
          .attr('rx', 6).attr('fill', `${color}cc`).attr('stroke', color);
        bars.push({ el: bar.node() as Element, h });
        g.append('text')
          .attr('x', bx + bw / 2).attr('y', baseY - h - 6)
          .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', 600)
          .attr('fill', 'var(--text-primary, #fff)').text(String(r.value));
        g.append('text')
          .attr('x', bx + bw / 2).attr('y', baseY + 18)
          .attr('text-anchor', 'middle').attr('font-size', '11px')
          .attr('fill', 'var(--text-secondary, #a1a1aa)').text(r.label);
      });

      if (ctx) {
        bars.forEach((bar, i) => {
          ctx.tl.fromTo(bar.el,
            { attr: { y: baseY, height: 0 } },
            { attr: { y: baseY - bar.h, height: bar.h }, duration: 0.55, ease: 'power2.out' },
            ctx.at + i * 0.05
          );
        });
        duration = 0.55 + rows.length * 0.05;
      }
    }

    return duration;
  }

  private normalizeChartData(data: any): { label: string; value: number }[] {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map((d, i) => {
        if (typeof d === 'number') return { label: String(i + 1), value: d };
        return {
          label: String(d.label ?? d.name ?? d.x ?? i + 1),
          value: Number(d.value ?? d.y ?? d.count ?? 0),
        };
      });
    }
    if (typeof data === 'object') {
      return Object.entries(data).map(([label, value]) => ({ label, value: Number(value) || 0 }));
    }
    return [];
  }

  // ── timeline ────────────────────────────────────────────────────────────
  createTimeline(id: string, events: any[], ctx?: AnimContext): number {
    this.engine.removeElement(id);
    const items = (events || []).map((e, i) => ({
      date: String(e.date ?? e.year ?? e.time ?? e.label ?? i + 1),
      label: String(e.label ?? e.title ?? e.text ?? e.event ?? ''),
    }));
    if (items.length === 0) return 0;

    const layout = this.engine.layout;
    const safe = layout.safeArea;
    const trackW = Math.min(safe.w - 30, 640);
    const bandH = 150;
    const rect = layout.allocateRow(id, trackW, bandH, { gap: 40 });
    const lineY = bandH / 2;
    const stepX = items.length > 1 ? trackW / (items.length - 1) : 0;

    // Label width budget per item — wrap to fit, avoiding neighbor collisions.
    const labelBudget = items.length > 1 ? Math.max(64, stepX * 0.92) : trackW;

    const g = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'aux-timeline')
      .attr('transform', `translate(${rect.x}, ${rect.y})`);

    const track = g.append('line')
      .attr('x1', 0).attr('y1', lineY)
      .attr('x2', trackW).attr('y2', lineY)
      .attr('stroke', '#6366F1')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 0 6px rgba(99,102,241,0.4))');

    const nodeEls: Element[] = [];
    items.forEach((it, i) => {
      const x = i * stepX;
      const above = i % 2 === 0;
      const color = PALETTE[i % PALETTE.length];

      const node = g.append('g').attr('transform', `translate(${x}, ${lineY})`);
      nodeEls.push(node.node() as Element);

      node.append('circle').attr('r', 7).attr('fill', color).attr('stroke', '#0b0b0f').attr('stroke-width', 2);

      node.append('text')
        .attr('text-anchor', 'middle').attr('y', above ? -46 : 30)
        .attr('font-size', '13px').attr('font-weight', 700)
        .attr('fill', 'var(--text-primary, #fff)').text(it.date);

      const { lines } = layout.wrapText(it.label, labelBudget, 10, 400, 2);
      const labelText = node.append('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary, #a1a1aa)');
      lines.forEach((line, li) => {
        labelText.append('tspan')
          .attr('x', 0)
          .attr('y', above ? -32 + li * 12 : 44 + li * 12)
          .text(line);
      });
    });

    if (ctx) {
      const trackDur = drawStroke(ctx.tl, track.node() as Element, ctx.at, { duration: 0.7 });
      const nodesDur = staggerIn(ctx.tl, nodeEls, ctx.at + 0.25, {
        duration: 0.4,
        stagger: Math.min(0.1, 1.0 / items.length),
        y: 0,
      });
      return Math.max(trackDur, 0.25 + nodesDur);
    }
    return 0;
  }
}
