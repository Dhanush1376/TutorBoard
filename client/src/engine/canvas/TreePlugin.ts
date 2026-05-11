/**
 * TreePlugin.ts — Hierarchical Data Visualization
 */

import * as d3 from 'd3';
import gsap from 'gsap';
import { ICanvasEngine, ICanvasPlugin } from './types';

export class TreePlugin implements ICanvasPlugin {
  public readonly name = 'tree';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  createTree(id: string, data: any, options: any = {}) {
    const width = options.width || 600;
    const height = options.height || 400;
    const margin = { top: 40, right: 90, bottom: 40, left: 90 };

    const treemap = d3.tree().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    const nodes = treemap(d3.hierarchy(data));

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('transform', `translate(${(this.engine.width - width)/2 + margin.left}, ${margin.top + 100})`);

    // Links
    const links = group.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-primary, #3b82f6)')
      .attr('stroke-width', 2)
      .style('filter', 'url(#neon-glow)')
      .attr('d', (d: any) => `M${d.x},${d.y}C${d.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${d.parent.y}`);

    // Nodes
    const node = group.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    node.append('circle')
      .attr('r', 20)
      .attr('fill', 'var(--bg-secondary, #18181b)')
      .attr('stroke', 'var(--border-strong, #3f3f46)')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))');

    node.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-primary, #ffffff)')
      .text((d: any) => d.data.name || d.data.value);

    // Animations
    gsap.from(node.nodes(), {
      opacity: 0,
      scale: 0,
      stagger: 0.1,
      duration: 0.5,
      ease: 'back.out(1.7)'
    });
  }
}
