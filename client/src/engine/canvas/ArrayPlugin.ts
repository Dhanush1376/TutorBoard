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

export interface ArraySnapshot {
  values: (number | string)[];
  x: number;     // left of cell 0 (logical)
  y: number;     // top of the row (logical)
  cellW: number;
  gap: number;
}
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
      .attr('rx', Math.min(10, cellW / 4))
      .attr('fill', '#171A18')
      .attr('stroke', '#383E38')
      .attr('stroke-width', 1.6)
      .attr('class', 'array-cell-bg');

    cells.append('text')
      .attr('x', cellW / 2)
      .attr('y', CELL_H / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${fontSize}px`)
      .attr('font-weight', 600)
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', '#F5F5F0')
      .text(d => d as any);

    // Index labels under the cells (tabular numerals, clear muted token)
    if (options.showIndices !== false && cellW >= 28) {
      cells.append('text')
        .attr('x', cellW / 2)
        .attr('y', CELL_H + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', 500)
        .attr('font-family', 'var(--font-mono)')
        .attr('fill', '#929991')
        .text((_d, i) => i);
    }

    if (ctx && options.morphFrom) {
      return this.morph(group, cells.nodes() as Element[], values, rect, cellW, options.morphFrom, ctx);
    }
    if (ctx) {
      return staggerIn(ctx.tl, cells.nodes() as Element[], ctx.at, {
        duration: 0.4,
        stagger: Math.min(0.05, 0.5 / n), // long arrays don't take forever
      });
    }
    return 0;
  }

  /** Values and cell geometry of a drawn array (logical coordinates). */
  snapshot(id: string): ArraySnapshot | null {
    const group = this.engine.mainLayer.select(`#${CSS.escape(id)}`);
    if (group.empty()) return null;
    const meta = (group.node() as any)._meta;
    if (!meta) return null;
    const values = group.selectAll('g.cell').data() as (number | string)[];
    return { values, x: meta.offsetX, y: meta.y, cellW: meta.cellWidth, gap: meta.cellGap };
  }

  /**
   * Turn the previous step's array into this one. Values present in both
   * travel to their new index (crossing pairs arc over/under each other —
   * a swap), new values drop in (push / enqueue), and values that vanished
   * leave as ghosts (pop from the top / dequeue from the front).
   */
  private morph(
    group: any, cellNodes: Element[], values: (number | string)[],
    rect: { x: number; y: number }, cellW: number, from: ArraySnapshot, ctx: AnimContext,
  ): number {
    const { tl, at } = ctx;
    const D = 0.75;
    const step = cellW + CELL_GAP;
    const used = new Set<number>();
    let moved = false;
    cellNodes.forEach((el, i) => {
      const v = String(values[i]);
      const j = from.values.findIndex((w, k) => !used.has(k) && String(w) === v);
      const base = i * step;
      if (j < 0) {
        // new value: drops into place after the others start moving
        tl.fromTo(el, { autoAlpha: 0, x: base, y: -CELL_H * 1.1 }, { autoAlpha: 1, x: base, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, at + 0.2);
        return;
      }
      used.add(j);
      const dx = from.x + j * (from.cellW + from.gap) - (rect.x + base);
      const dy = from.y - rect.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return; // stays put
      moved = true;
      const arc = (dx < 0 ? -1 : 1) * CELL_H * 0.85; // moving right goes over, left goes under
      tl.set(el, { x: base + dx, y: dy }, at);
      tl.to(el, { x: base, duration: D, ease: 'power2.inOut' }, at);
      tl.to(el, { y: dy / 2 + arc, duration: D / 2, ease: 'sine.out' }, at);
      tl.to(el, { y: 0, duration: D / 2, ease: 'sine.in' }, at + D / 2);
      const r = el.querySelector('rect');
      if (r) flashFill(tl, r, at, '#F59E0B', { duration: D });
    });

    // vanished values exit from where they were
    from.values.forEach((w, k) => {
      if (used.has(k)) return;
      const gx = from.x + k * (from.cellW + from.gap) - rect.x;
      const gy = from.y - rect.y;
      const ghost = group.append('g').attr('class', 'cell-ghost').attr('transform', `translate(${gx}, ${gy})`);
      ghost.append('rect').attr('width', from.cellW).attr('height', CELL_H).attr('rx', Math.min(12, from.cellW / 4))
        .attr('fill', 'rgba(255, 255, 255, 0.03)').attr('stroke', 'rgba(255, 255, 255, 0.12)');
      ghost.append('text').attr('x', from.cellW / 2).attr('y', CELL_H / 2).attr('dy', '0.35em').attr('text-anchor', 'middle')
        .attr('font-size', '16px').attr('font-family', 'var(--font-mono)').attr('fill', 'var(--text-primary)').text(String(w));
      const node = ghost.node() as Element;
      const front = k === 0;
      tl.fromTo(node, { autoAlpha: 1, x: gx, y: gy }, {
        autoAlpha: 0,
        x: front ? gx - step * 1.2 : gx,
        y: front ? gy : gy - CELL_H * 1.3,
        duration: 0.55,
        ease: 'power2.in',
      }, at);
    });
    return moved ? D : 0.7;
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
      .attr('fill', '#262014')
      .attr('fill-opacity', 0.25)
      .attr('stroke', '#F4C95D')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '5,4')
      .attr('rx', 8);

    if (label) {
      g.append('text')
        .attr('x', (x1 + x2) / 2).attr('y', y - 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 600)
        .attr('font-family', 'var(--font-sans)')
        .attr('fill', '#F4C95D')
        .text(label);
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
