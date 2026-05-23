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

  highlightCell(id: string, color: string = '#fef08a', duration: number = 500) {
    const cell = this.engine.getElement(id);
    if (cell.empty()) return;
    gsap.to(cell.select('rect').node(), {
      fill: color, 
      duration: duration / 1000, 
      yoyo: true, 
      repeat: 1
    });
  }

  swapCells(id1: string, id2: string) {
    const g1 = this.engine.getElement(id1).node() as Element;
    const g2 = this.engine.getElement(id2).node() as Element;
    if (!g1 || !g2) return;
    const t1 = g1.getAttribute('transform') || '';
    const t2 = g2.getAttribute('transform') || '';
    g1.setAttribute('transform', t2);
    g2.setAttribute('transform', t1);
  }

  drawBoundary(atIndex: number, label: string, targetArrayId?: string, endIndex?: number) {
    const arrayGroup = targetArrayId
      ? this.engine.mainLayer.select(`#${CSS.escape(targetArrayId)}`)
      : this.engine.mainLayer.select('.canvas-array');
    if (arrayGroup.empty()) return;
    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160 };
    const x1 = meta.offsetX + atIndex * (meta.cellWidth + meta.cellGap) - 5;
    const x2 = endIndex !== undefined
      ? meta.offsetX + (endIndex + 1) * (meta.cellWidth + meta.cellGap) - 5
      : x1 + meta.cellWidth + 10;
    const y  = meta.y - 10;
    const h  = (meta.cellHeight || 54) + 20;
    this.engine.mainLayer.append('rect')
      .attr('x', x1).attr('y', y).attr('width', x2 - x1).attr('height', h)
      .attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3').attr('rx', 6);
    if (label) {
      this.engine.mainLayer.append('text')
        .attr('x', (x1 + x2) / 2).attr('y', y - 8)
        .attr('text-anchor', 'middle').attr('font-size', '12px')
        .attr('fill', '#f59e0b').text(label);
    }
  }

  clear() {
    this.nextY = 160;
  }
}
