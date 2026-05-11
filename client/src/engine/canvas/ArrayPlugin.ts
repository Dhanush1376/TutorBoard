/**
 * ArrayPlugin.ts — Data Structure Visualization Plugin
 */

import * as d3 from 'd3';
import gsap from 'gsap';
import { ICanvasEngine, ICanvasPlugin } from './types';

export class ArrayPlugin implements ICanvasPlugin {
  public readonly name = 'array';
  private engine!: ICanvasEngine;
  private nextY = 160;

  private readonly CELL_WIDTH = 54;
  private readonly CELL_HEIGHT = 54;
  private readonly CELL_GAP = 10;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  createArray(id: string, values: (number | string)[], options: any = {}) {
    const totalWidth = values.length * this.CELL_WIDTH + (values.length - 1) * this.CELL_GAP;
    const offsetX = (this.engine.width / 2) - (totalWidth / 2);
    const currentY = options.y || this.nextY;

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'canvas-array')
      .attr('transform', `translate(${offsetX}, ${currentY})`);

    // Metadata for pointers
    (group.node() as any)._meta = { offsetX, y: currentY, cellWidth: this.CELL_WIDTH, cellGap: this.CELL_GAP };

    const cells = group.selectAll('g.cell')
      .data(values)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('id', (d, i) => `${id}[${i}]`)
      .attr('transform', (d, i) => `translate(${i * (this.CELL_WIDTH + this.CELL_GAP)}, 0)`);

    // Background Rect
    cells.append('rect')
      .attr('width', this.CELL_WIDTH)
      .attr('height', this.CELL_HEIGHT)
      .attr('rx', 12)
      .attr('fill', 'rgba(255, 255, 255, 0.03)')
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('class', 'shadow-premium');

    // Gloss Overlay
    cells.append('rect')
      .attr('width', this.CELL_WIDTH)
      .attr('height', this.CELL_HEIGHT)
      .attr('rx', 12)
      .attr('fill', 'url(#glass-gradient)')
      .style('pointer-events', 'none');

    // Text Value
    cells.append('text')
      .attr('x', this.CELL_WIDTH / 2)
      .attr('y', this.CELL_HEIGHT / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', 'var(--text-primary)')
      .text(d => d);

    // Staggered Entrance
    gsap.from(cells.nodes(), {
      opacity: 0,
      scale: 0.5,
      y: 20,
      stagger: 0.05,
      duration: 0.4,
      ease: 'back.out(1.7)'
    });

    this.nextY += this.CELL_HEIGHT + 60;
  }
}
