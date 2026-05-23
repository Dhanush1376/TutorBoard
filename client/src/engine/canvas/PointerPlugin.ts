/**
 * PointerPlugin.ts — Index and Pointer Visualization
 */

import * as d3 from 'd3';
import gsap from 'gsap';
import { ICanvasEngine, ICanvasPlugin } from './types';

export class PointerPlugin implements ICanvasPlugin {
  public readonly name = 'pointer';
  private engine!: ICanvasEngine;

  install(engine: ICanvasEngine) {
    this.engine = engine;
  }

  createPointer(id: string, atIndex: number, label: string, color: string = '#ef4444', targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.engine.mainLayer.select(`#${CSS.escape(targetArrayId)}`) 
      : this.engine.mainLayer.select('.canvas-array');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = meta.y + 54 + 40; // below cell + gap

    const group = this.engine.mainLayer.append('g')
      .attr('id', id)
      .attr('transform', `translate(${x}, ${y})`);

    // Arrow Path
    group.append('path')
      .attr('d', 'M -8 12 L 0 0 L 8 12 Z')
      .attr('fill', color)
      .style('filter', 'url(#neon-glow)');

    // Label
    group.append('text')
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', color)
      .text(label);

    gsap.from(group.node(), { opacity: 0, scale: 0, duration: 0.3, ease: 'back.out(2)' });
  }

  movePointer(id: string, atIndex: number, targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.engine.mainLayer.select(`#${CSS.escape(targetArrayId)}`) 
      : this.engine.mainLayer.select('.canvas-array');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._meta || { offsetX: 0, cellWidth: 54, cellGap: 10, y: 160 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = meta.y + 54 + 40;

    gsap.to(this.engine.getElement(id).node(), {
      attr: { transform: `translate(${x}, ${y})` },
      duration: 0.4,
      ease: 'power2.inOut'
    });
  }
}
