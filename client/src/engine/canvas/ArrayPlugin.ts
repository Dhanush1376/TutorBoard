/**
 * ArrayPlugin.ts — Data Structure Visualization Plugin
 *
 * Collision-free rows via LayoutEngine, adaptive cell sizing so long arrays
 * never overflow the viewport, and all animation added to the caller's master
 * timeline through AnimContext (nothing animates outside the timeline).
 */

import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { staggerIn, flashFill, fadeIn } from '../anim/primitives';

const CELL_H = 54;
const CELL_GAP = 10;
const POINTER_ZONE = 64; // reserved space under each array for pointers

export class ArrayPlugin implements ICanvasPlugin {
  public readonly name = 'array';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  reset() { /* layout claims are released by engine.clear() */ }

  createArray(id: string, values: (number | string)[], options: any = {}, ctx?: AnimContext): number {
    if (!values || values.length === 0) return 0;
    this.engine.removeElement(id);

    const layout = this.engine.layout;
    const safeW = layout.safeArea.w;

    // Adaptive cell width: long arrays shrink to fit instead of overflowing.
    const n = values.length;
    let cellW = 54;
    const naturalW = n * cellW + (n - 1) * CELL_GAP;
    if (naturalW > safeW) {
      cellW = Math.max(26, Math.floor((safeW - (n - 1) * CELL_GAP) / n));
    }
    const totalW = n * cellW + (n - 1) * CELL_GAP;
    const fontSize = cellW >= 44 ? 16 : cellW >= 34 ? 13 : 11;

    const rect = layout.allocateRow(id, totalW, CELL_H + POINTER_ZONE, { gap: 40 });

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'canvas-array')
      .attr('transform', `translate(${rect.x}, ${rect.y})`);

    // Metadata for pointers/boundaries
    (group.node() as any)._meta = {
      offsetX: rect.x, y: rect.y, cellWidth: cellW, cellGap: CELL_GAP, cellHeight: CELL_H,
    };

    const cells = group.selectAll('g.cell')
      .data(values)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('id', (_d, i) => `${id}[${i}]`)
      .attr('transform', (_d, i) => `translate(${i * (cellW + CELL_GAP)}, 0)`);

    cells.append('rect')
      .attr('width', cellW)
      .attr('height', CELL_H)
      .attr('rx', Math.min(12, cellW / 4))
      .attr('fill', 'rgba(255, 255, 255, 0.03)')
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('class', 'shadow-premium');

    cells.append('rect')
      .attr('width', cellW)
      .attr('height', CELL_H)
      .attr('rx', Math.min(12, cellW / 4))
      .attr('fill', 'url(#glass-gradient)')
      .style('pointer-events', 'none');

    cells.append('text')
      .attr('x', cellW / 2)
      .attr('y', CELL_H / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${fontSize}px`)
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', 'var(--text-primary)')
      .text(d => d as any);

    // Index labels under the cells (small, unobtrusive)
    if (options.showIndices !== false && cellW >= 30) {
      cells.append('text')
        .attr('x', cellW / 2)
        .attr('y', CELL_H + 13)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', 'var(--text-tertiary, #71717a)')
        .text((_d, i) => i);
    }

    if (ctx) {
      return staggerIn(ctx.tl, cells.nodes() as Element[], ctx.at, {
        duration: 0.4,
        stagger: Math.min(0.05, 0.5 / n), // long arrays don't take forever
      });
    }
    return 0;
  }

  highlightCell(id: string, color: string = '#fef08a', duration: number = 500, ctx?: AnimContext): number {
    const cell = this.engine.getElement(id);
    if (cell.empty()) return 0;
    const rectNode = cell.select('rect').node() as Element | null;
    if (!rectNode) return 0;
    if (ctx) {
      return flashFill(ctx.tl, rectNode, ctx.at, color, { duration: duration / 1000 });
    }
    return 0; // instant mode: highlight is transient, nothing to restore
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

  drawBoundary(atIndex: number, label: string, targetArrayId?: string, endIndex?: number, ctx?: AnimContext): number {
    const arrayGroup = targetArrayId
      ? this.engine.mainLayer.select(`#${CSS.escape(targetArrayId)}`)
      : this.engine.mainLayer.select('.canvas-array');
    if (arrayGroup.empty()) return 0;

    const arrayId = arrayGroup.attr('id') || 'array';
    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160, cellHeight: 54 };

    // One boundary per array — a new range replaces the old one.
    const boundaryId = `boundary:${arrayId}`;
    this.engine.removeElement(boundaryId);

    const x1 = meta.offsetX + atIndex * (meta.cellWidth + meta.cellGap) - 5;
    const x2 = endIndex !== undefined
      ? meta.offsetX + endIndex * (meta.cellWidth + meta.cellGap) + meta.cellWidth + 5
      : x1 + meta.cellWidth + 10;
    const y = meta.y - 10;
    const h = (meta.cellHeight || 54) + 20;

    const g = this.engine.mainLayer.append('g').attr('id', boundaryId);

    const rect = g.append('rect')
      .attr('x', x1).attr('y', y).attr('width', Math.max(4, x2 - x1)).attr('height', h)
      .attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3').attr('rx', 6);

    if (label) {
      g.append('text')
        .attr('x', (x1 + x2) / 2).attr('y', y - 8)
        .attr('text-anchor', 'middle').attr('font-size', '12px')
        .attr('fill', '#f59e0b').text(label);
    }

    if (ctx) {
      // fadeIn (not drawStroke) — the boundary's dashed stroke pattern must
      // survive, and dashoffset animation would overwrite it.
      return fadeIn(ctx.tl, g.node() as Element, ctx.at, { duration: 0.4, y: 4 });
    }
    return 0;
  }

  clear() { /* engine.clear() handles DOM + layout */ }
}
