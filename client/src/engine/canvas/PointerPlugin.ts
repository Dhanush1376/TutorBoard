/**
 * PointerPlugin.ts — Index and Pointer Visualization
 *
 * Pointers are assigned vertical "lanes" beneath their array so several
 * pointers (low/mid/high) at the same index stack instead of overlapping.
 * All motion goes through the master timeline via AnimContext.
 */

import { ICanvasEngine, ICanvasPlugin, AnimContext } from './types';
import { growFromCenter, moveTo } from '../anim/primitives';

const LANE_HEIGHT = 40;
const FIRST_LANE_OFFSET = 22;

interface PointerInfo {
  arrayKey: string;
  lane: number;
}

export class PointerPlugin implements ICanvasPlugin {
  public readonly name = 'pointer';
  private engine!: ICanvasEngine;
  private pointers: Map<string, PointerInfo> = new Map();

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  reset() {
    this.pointers.clear();
  }

  private resolveArray(targetArrayId?: string) {
    return targetArrayId
      ? this.engine.mainLayer.select(`#${CSS.escape(targetArrayId)}`)
      : this.engine.mainLayer.select('.canvas-array');
  }

  private assignLane(id: string, arrayKey: string): number {
    const existing = this.pointers.get(id);
    if (existing && existing.arrayKey === arrayKey) return existing.lane;
    const used = new Set(
      [...this.pointers.values()].filter(p => p.arrayKey === arrayKey).map(p => p.lane)
    );
    let lane = 0;
    while (used.has(lane)) lane++;
    this.pointers.set(id, { arrayKey, lane });
    return lane;
  }

  private position(meta: any, atIndex: number, lane: number) {
    const x = meta.offsetX + atIndex * (meta.cellWidth + meta.cellGap) + meta.cellWidth / 2;
    const y = meta.y + (meta.cellHeight || 54) + FIRST_LANE_OFFSET + lane * LANE_HEIGHT;
    return { x, y };
  }

  createPointer(
    id: string,
    atIndex: number,
    label: string,
    color: string = '#ef4444',
    targetArrayId?: string,
    ctx?: AnimContext
  ): number {
    const arrayGroup = this.resolveArray(targetArrayId);
    if (arrayGroup.empty()) return 0;
    this.engine.getElement(id).remove(); // idempotent re-create

    const arrayKey = arrayGroup.attr('id') || 'array';
    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160, cellHeight: 54 };
    const lane = this.assignLane(id, arrayKey);
    const { x, y } = this.position(meta, atIndex, lane);

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'canvas-pointer')
      .attr('transform', `translate(${x}, ${y})`);

    group.append('path')
      .attr('d', 'M -8 12 L 0 0 L 8 12 Z')
      .attr('fill', color)
      .style('filter', 'url(#neon-glow)');

    group.append('text')
      .attr('y', 27)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .attr('font-weight', 'bold')
      .attr('fill', color)
      .text(label);

    if (ctx) {
      return growFromCenter(ctx.tl, group.node() as Element, ctx.at, { duration: 0.35 });
    }
    return 0;
  }

  movePointer(id: string, atIndex: number, targetArrayId?: string, ctx?: AnimContext): number {
    const arrayGroup = this.resolveArray(targetArrayId);
    if (arrayGroup.empty()) return 0;

    const el = this.engine.getElement(id).node() as Element | null;
    if (!el) return 0;

    const arrayKey = arrayGroup.attr('id') || 'array';
    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160, cellHeight: 54 };
    const lane = this.assignLane(id, arrayKey);
    const { x, y } = this.position(meta, atIndex, lane);

    if (ctx) {
      return moveTo(ctx.tl, el, ctx.at, { x, y }, { duration: 0.4 });
    }
    el.setAttribute('transform', `translate(${x}, ${y})`);
    return 0;
  }
}
