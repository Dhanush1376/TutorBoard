/**
 * CanvasEngine.ts — High-Performance Pedagogical Render Engine v7.0
 * 
 * Features:
 *   1. Plugin-based architecture
 *   2. Fixed logical coordinate system (800x600)
 *   3. Integrated D3 Zoom + GSAP Animations
 *   4. Premium Glassmorphism & Neon Design tokens
 */

import * as d3 from 'd3';
import gsap from 'gsap';
import { ICanvasEngine, ICanvasPlugin } from './types';

export class CanvasEngine implements ICanvasEngine {
  public readonly width = 800;
  public readonly height = 600;
  public readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  public readonly mainLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  
  private plugins: Map<string, ICanvasPlugin> = new Map();
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;

  constructor(container: HTMLElement) {
    // 1. Initialize SVG
    d3.select(container).selectAll('*').remove();
    
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('overflow', 'visible')
      .style('display', 'block');

    // 2. Setup SaaS-Quality Definitions (Gradients, Filters)
    this.initDefinitions();

    // 3. Setup Layers
    this.mainLayer = this.svg.append('g').attr('class', 'canvas-main-layer');

    // 4. Setup Zoom
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        this.mainLayer.attr('transform', event.transform);
      });

    this.svg.call(this.zoomBehavior as any);
  }

  public registerPlugin(plugin: ICanvasPlugin) {
    if (this.plugins.has(plugin.name)) return;
    plugin.install(this);
    this.plugins.set(plugin.name, plugin);
    console.log(`[CanvasEngine] Plugin registered: ${plugin.name}`);
  }

  public getElement(id: string): d3.Selection<any, unknown, null, undefined> {
    return this.mainLayer.select(`#${CSS.escape(id)}`);
  }

  public removeElement(id: string) {
    this.getElement(id).remove();
  }

  public clear() {
    this.mainLayer.selectAll('*').remove();
  }

  public resetView() {
    this.svg.transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .call(this.zoomBehavior.transform as any, d3.zoomIdentity);
  }

  private initDefinitions() {
    const defs = this.svg.append('defs');

    // Glassmorphism Gradient
    const glass = defs.append('linearGradient')
      .attr('id', 'glass-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    glass.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255, 255, 255, 0.1)');
    glass.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(255, 255, 255, 0.02)');

    // Neon Glow Filter
    const glow = defs.append('filter')
      .attr('id', 'neon-glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  }
}
