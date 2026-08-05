/**
 * TreePlugin.ts — Hierarchical Data Visualization
 *
 * Tree size adapts to breadth/depth, placement is collision-free via the
 * LayoutEngine, and link drawing + node entrances live in the master timeline.
 */

import * as d3 from 'd3';
import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { staggerIn, drawStroke } from '../anim/primitives';

export class TreePlugin implements ICanvasPlugin {
  public readonly name = 'tree';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  createTree(id: string, data: any, options: any = {}, ctx?: AnimContext): number {
    if (!data) return 0;
    this.engine.removeElement(id);

    const layout = this.engine.layout;
    const root = d3.hierarchy(data);
    const leafCount = root.leaves().length;
    const depth = root.height + 1;

    // Adaptive dimensions: wide trees get more width, deep trees more height.
    const safe = layout.safeArea;
    const width = Math.min(safe.w, Math.max(280, leafCount * 90));
    const height = Math.min(safe.h, Math.max(180, depth * 92));

    const treemap = d3.tree().size([width, height - 60]);
    const nodes = treemap(root as any);

    const rect = layout.allocateRow(id, width, height, { gap: 36 });

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'canvas-tree')
      .attr('transform', `translate(${rect.x}, ${rect.y + 30})`);

    // Links (drawn beneath nodes)
    const links = group.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-primary, #3b82f6)')
      .attr('stroke-width', 2)
      .style('filter', 'url(#neon-glow)')
      .attr('d', (d: any) =>
        `M${d.x},${d.y}C${d.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${d.parent.y}`
      );

    // Nodes — radius adapts to label width so text stays inside.
    const nodeSel = group.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    const labelOf = (d: any) => String(d.data.name ?? d.data.value ?? '');

    nodeSel.append('circle')
      .attr('r', (d: any) => {
        const w = layout.measureText(labelOf(d), 12, 700).width;
        return Math.max(20, Math.min(30, w / 2 + 8));
      })
      .attr('fill', 'var(--bg-secondary, #18181b)')
      .attr('stroke', 'var(--border-strong, #3f3f46)')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))');

    nodeSel.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-primary, #ffffff)')
      .text((d: any) => {
        const label = labelOf(d);
        return label.length > 8 ? label.slice(0, 7) + '…' : label;
      });

    if (ctx) {
      const linkDur = drawStroke(ctx.tl, links.nodes() as Element[], ctx.at, { duration: 0.5 });
      const nodeDur = staggerIn(ctx.tl, nodeSel.nodes() as Element[], ctx.at + 0.15, {
        duration: 0.45,
        stagger: Math.min(0.09, 1.2 / nodes.descendants().length),
      });
      return Math.max(linkDur, 0.15 + nodeDur);
    }
    return 0;
  }
}
