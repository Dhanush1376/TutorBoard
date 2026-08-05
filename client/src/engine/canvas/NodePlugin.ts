/**
 * NodePlugin.ts — Generic Node and Edge Visualization
 *
 * Nodes are sized from MEASURED text (wrapped, never overflowing), placed
 * collision-free by the LayoutEngine, and registered so edges can resolve
 * endpoints synchronously (no setTimeout races). All animation lives in the
 * caller's master timeline.
 */

import * as d3 from 'd3';
import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { growFromCenter, growLine, fadeIn } from '../anim/primitives';

interface NodeGeom {
  x: number;        // center x
  y: number;        // center y
  halfW: number;
  halfH: number;
  shape: string;
}

const TITLE_SIZE = 14;
const SUBTITLE_SIZE = 10;
const MAX_TEXT_WIDTH = 148;

export class NodePlugin implements ICanvasPlugin {
  public readonly name = 'node';
  private engine!: ICanvasEngine;
  private geometry: Map<string, NodeGeom> = new Map();

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  reset() {
    this.geometry.clear();
  }

  createNode(id: string, cmd: any, ctx?: AnimContext): number {
    const { title, label, subtitle, x = 0.5, y = 0.5, color, shape, glow, icon } = cmd;
    this.engine.removeElement(id);

    const layout = this.engine.layout;
    const nodeColor = color || 'var(--accent-primary, #3b82f6)';
    const nodeText = String(title || label || id);

    // Measure and wrap the title so text NEVER overflows its shape.
    const { lines, width: textW } = layout.wrapText(nodeText, MAX_TEXT_WIDTH, TITLE_SIZE, 700, 3);
    const subW = subtitle ? layout.measureText(String(subtitle), SUBTITLE_SIZE).width : 0;
    const contentW = Math.max(textW, subW);
    const lineH = TITLE_SIZE * 1.25;
    const contentH = lines.length * lineH + (subtitle ? SUBTITLE_SIZE * 1.5 : 0) + (icon ? 18 : 0);

    const isRect = shape === 'rect' || shape === 'block' || shape === 'step' || shape === 'pill' || shape === 'hexagon';
    let halfW: number;
    let halfH: number;
    if (isRect) {
      halfW = Math.max(60, contentW / 2 + 16);
      halfH = Math.max(30, contentH / 2 + 14);
    } else {
      const r = Math.max(34, Math.min(52, Math.max(contentW, contentH) / 2 + 12));
      halfW = r;
      halfH = r;
    }

    // Desired position from fractional coordinates → collision-free placement.
    const desired = {
      x: x * this.engine.width - halfW,
      y: y * this.engine.height - halfH,
      w: halfW * 2,
      h: halfH * 2,
    };
    const placed = layout.place(id, desired, { padding: 14 });
    const cx = placed.x + halfW;
    const cy = placed.y + halfH;

    this.geometry.set(id, { x: cx, y: cy, halfW, halfH, shape: shape || 'circle' });

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'node-element')
      .attr('transform', `translate(${cx}, ${cy})`);

    const shadow = glow
      ? `drop-shadow(0 0 10px ${nodeColor})`
      : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))';

    if (shape === 'triangle') {
      group.append('path')
        .attr('d', d3.symbol().type(d3.symbolTriangle).size(halfW * halfW * 2.6)())
        .attr('fill', 'var(--bg-secondary, #18181b)')
        .attr('stroke', nodeColor).attr('stroke-width', 3)
        .style('filter', shadow);
    } else if (shape === 'diamond') {
      group.append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(halfW * halfW * 2.6)())
        .attr('fill', 'var(--bg-secondary, #18181b)')
        .attr('stroke', nodeColor).attr('stroke-width', 3)
        .style('filter', shadow);
    } else if (isRect) {
      group.append('rect')
        .attr('x', -halfW).attr('y', -halfH)
        .attr('width', halfW * 2).attr('height', halfH * 2)
        .attr('rx', shape === 'pill' ? halfH : 10)
        .attr('fill', 'var(--bg-secondary, #18181b)')
        .attr('stroke', nodeColor).attr('stroke-width', 3)
        .style('filter', shadow);
    } else {
      group.append('circle')
        .attr('r', halfW)
        .attr('fill', 'var(--bg-secondary, #18181b)')
        .attr('stroke', nodeColor).attr('stroke-width', 3)
        .style('filter', shadow);
    }

    // Content stack: icon, wrapped title lines, subtitle — vertically centered.
    const stackH = contentH;
    let cursorY = -stackH / 2;

    if (icon) {
      group.append('text')
        .attr('y', cursorY + 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .text(icon);
      cursorY += 18;
    }

    const titleText = group.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${TITLE_SIZE}px`)
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-primary, #ffffff)');

    for (const line of lines) {
      cursorY += lineH;
      titleText.append('tspan')
        .attr('x', 0)
        .attr('y', cursorY - lineH * 0.3)
        .text(line);
    }

    if (subtitle) {
      group.append('text')
        .attr('y', cursorY + SUBTITLE_SIZE * 1.4 - lineH * 0.3)
        .attr('text-anchor', 'middle')
        .attr('font-size', `${SUBTITLE_SIZE}px`)
        .attr('fill', 'var(--text-secondary, #a1a1aa)')
        .text(String(subtitle));
    }

    if (ctx) {
      return growFromCenter(ctx.tl, group.node() as Element, ctx.at, { duration: 0.5 });
    }
    return 0;
  }

  /** Resolve a node's geometry (falls back to reading the DOM transform). */
  private geomOf(nodeId: string): NodeGeom | null {
    const cached = this.geometry.get(nodeId);
    if (cached) return cached;
    const sel = this.engine.mainLayer.select(`#${CSS.escape(nodeId)}`);
    if (sel.empty()) return null;
    const m = /translate\(([-\d.]+)[,\s]+([-\d.]+)/.exec(sel.attr('transform') || '');
    if (!m) return null;
    return { x: +m[1], y: +m[2], halfW: 36, halfH: 36, shape: 'circle' };
  }

  createEdge(id: string, cmd: any, ctx?: AnimContext): number {
    const { from, to, label, type, animated } = cmd;
    this.engine.removeElement(id);

    // Nodes exist synchronously at compile time — no setTimeout race.
    const g1 = this.geomOf(from);
    const g2 = this.geomOf(to);
    if (!g1 || !g2) {
      if (import.meta.env?.DEV) {
        console.warn(`[NodePlugin] Could not find nodes for edge ${id} (${from} -> ${to})`);
      }
      return 0;
    }

    // Trim endpoints to node boundaries so lines don't pierce shapes.
    const dx = g2.x - g1.x;
    const dy = g2.y - g1.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / dist;
    const uy = dy / dist;
    const trim = (g: NodeGeom) =>
      Math.min(Math.abs(g.halfW / (ux || 1e-6)), Math.abs(g.halfH / (uy || 1e-6)), Math.hypot(g.halfW, g.halfH));
    const t1 = Math.min(trim(g1) + 4, dist / 2 - 2);
    const t2 = Math.min(trim(g2) + 6, dist / 2 - 2);
    const p1 = { x: g1.x + ux * t1, y: g1.y + uy * t1 };
    const p2 = { x: g2.x - ux * t2, y: g2.y - uy * t2 };

    // Insert under nodes so lines render beneath shapes.
    const group = this.engine.mainLayer.insert('g', '.node-element')
      .attr('id', id)
      .attr('class', 'edge-element');

    const strokeColor = type === 'glow' ? 'var(--accent-primary, #3b82f6)' : 'var(--border-strong, #3f3f46)';

    const path = group.append('line')
      .attr('x1', p1.x).attr('y1', p1.y)
      .attr('x2', p2.x).attr('y2', p2.y)
      .attr('stroke', strokeColor)
      .attr('stroke-width', 2);

    if (type === 'dashed') path.attr('stroke-dasharray', '5,5');
    if (type === 'arrow' || cmd.arrow) path.attr('marker-end', 'url(#edge-arrowhead)');
    if (type === 'glow' || animated) path.style('filter', `drop-shadow(0 0 5px ${strokeColor})`);

    let labelDuration = 0;
    if (label) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const labelText = String(label);
      const textW = this.engine.layout.measureText(labelText, 10, 500).width;
      const boxW = Math.max(36, textW + 14);

      const textGroup = group.append('g')
        .attr('class', 'edge-label')
        .attr('transform', `translate(${midX}, ${midY})`);

      textGroup.append('rect')
        .attr('x', -boxW / 2).attr('y', -10)
        .attr('width', boxW).attr('height', 20)
        .attr('rx', 4)
        .attr('fill', 'var(--bg-primary, #09090b)')
        .attr('opacity', 0.85);

      textGroup.append('text')
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary, #a1a1aa)')
        .text(labelText);

      if (ctx) {
        labelDuration = fadeIn(ctx.tl, textGroup.node() as Element, ctx.at + 0.3, { duration: 0.3, y: 0 });
      }
    }

    if (ctx) {
      const lineDur = growLine(ctx.tl, path.node() as Element, ctx.at, p1, p2, { duration: 0.45 });
      return Math.max(lineDur, 0.3 + labelDuration);
    }
    return 0;
  }
}
