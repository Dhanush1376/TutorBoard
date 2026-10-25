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

  private resolveColor(color?: string, label?: string): { bg: string; border: string; text: string } {
    const l = (label || '').toLowerCase();
    const c = (color || '').toLowerCase();
    if (l === 'mid' || c.includes('f4c95d') || c.includes('orange') || c.includes('amber')) {
      return { bg: '#262014', border: '#F4C95D', text: '#FDF2D0' }; // Warm amber for mid
    }
    if (l === 'low' || l === 'lo' || l === 'l' || c.includes('teal') || c.includes('blue') || c.includes('cyan')) {
      return { bg: '#15242E', border: '#38BDF8', text: '#E0F2FE' }; // Sky cyan for low
    }
    if (l === 'high' || l === 'hi' || l === 'h' || c.includes('red') || c.includes('coral')) {
      return { bg: '#291B14', border: '#FF925C', text: '#FFE7DC' }; // Coral for high
    }
    if (c.includes('green') || c.includes('35c98a')) {
      return { bg: '#13261C', border: '#35C98A', text: '#D1FAE5' };
    }
    return { bg: '#202521', border: '#383E38', text: '#F5F5F0' };
  }

  createPointer(
    id: string,
    atIndex: number,
    label: string,
    color: string = '#F4C95D',
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
    const palette = this.resolveColor(color, label);

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('class', 'canvas-pointer')
      .attr('transform', `translate(${x}, ${y})`);

    // Physical vertical stem connector linking array cell bottom to pointer badge
    const stemLength = FIRST_LANE_OFFSET + lane * LANE_HEIGHT - 6;
    group.append('line')
      .attr('x1', 0)
      .attr('y1', -stemLength)
      .attr('x2', 0)
      .attr('y2', -4)
      .attr('stroke', palette.border)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', lane > 0 ? '3,2' : 'none');

    // Pointer indicator tip (chevron pointing up toward the array cell)
    group.append('path')
      .attr('d', 'M -6 4 L 0 -4 L 6 4 Z')
      .attr('fill', palette.border);

    // Pill badge for the pointer label
    const textWidth = Math.max(34, label.length * 9 + 14);
    group.append('rect')
      .attr('x', -textWidth / 2)
      .attr('y', 4)
      .attr('width', textWidth)
      .attr('height', 20)
      .attr('rx', 6)
      .attr('fill', palette.bg)
      .attr('stroke', palette.border)
      .attr('stroke-width', 1.4);

    group.append('text')
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 700)
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', palette.text)
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
