/**
 * CanvasEngine.ts — High-Performance Pedagogical Render Engine v8.0
 *
 * Features:
 *   1. Plugin-based architecture with a shared AnimContext (master timeline)
 *   2. Responsive logical coordinate system (default 800x600, aspect-adaptive)
 *   3. LayoutEngine for collision-free automatic placement
 *   4. CameraController for smooth, timeline-integrated camera moves
 *   5. Integrated D3 Zoom for user pan/zoom (shared state with the camera)
 */

import * as d3 from 'd3';
import { ICanvasEngine, ICanvasPlugin } from './types';
import { LayoutEngine } from '../layout/LayoutEngine';
import { CameraController } from '../CameraController';

export class CanvasEngine implements ICanvasEngine {
  public readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  public readonly mainLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  public readonly fxLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  public readonly layout: LayoutEngine;
  public readonly camera: CameraController;

  private logicalWidth = 800;
  private logicalHeight = 600;
  private plugins: Map<string, ICanvasPlugin> = new Map();
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;

  get width() { return this.logicalWidth; }
  get height() { return this.logicalHeight; }

  constructor(container: HTMLElement) {
    d3.select(container).selectAll('*').remove();

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.logicalWidth} ${this.logicalHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('overflow', 'visible')
      .style('display', 'block');

    this.initDefinitions();

    // Layers: content below, ephemeral FX (circumscribe, flash) above.
    this.mainLayer = this.svg.append('g').attr('class', 'canvas-main-layer');
    this.fxLayer = this.svg.append('g').attr('class', 'canvas-fx-layer');

    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        this.mainLayer.attr('transform', event.transform);
        this.fxLayer.attr('transform', event.transform);
      });

    this.svg.call(this.zoomBehavior as any);

    this.layout = new LayoutEngine(this.logicalWidth, this.logicalHeight);
    this.camera = new CameraController(
      this.svg,
      this.zoomBehavior,
      () => ({ width: this.logicalWidth, height: this.logicalHeight })
    );
  }

  /**
   * Adapt the logical viewport to the container's aspect ratio so lessons
   * fill wide/tall screens without squeezing. Width stays 800; height flexes.
   */
  setLogicalSize(containerWidth: number, containerHeight: number): void {
    if (!containerWidth || !containerHeight) return;
    const aspect = containerHeight / containerWidth;
    const height = Math.round(Math.min(1000, Math.max(450, 800 * aspect)));
    if (height === this.logicalHeight) return;
    this.logicalHeight = height;
    this.svg.attr('viewBox', `0 0 ${this.logicalWidth} ${this.logicalHeight}`);
    this.layout.setViewport(this.logicalWidth, this.logicalHeight);
  }

  public getZoomBehavior() {
    return this.zoomBehavior;
  }

  public registerPlugin(plugin: ICanvasPlugin) {
    if (this.plugins.has(plugin.name)) return;
    plugin.install(this);
    this.plugins.set(plugin.name, plugin);
  }

  public getElement(id: string): d3.Selection<any, unknown, null, undefined> {
    return this.mainLayer.select(`#${CSS.escape(id)}`);
  }

  public removeElement(id: string) {
    this.getElement(id).remove();
    this.layout.release(id);
  }

  public getBBoxOf(id: string): { x: number; y: number; w: number; h: number } | null {
    const node = this.getElement(id).node() as SVGGraphicsElement | null;
    if (!node || typeof node.getBBox !== 'function') return null;
    try {
      const b = node.getBBox();
      const m = /translate\(([-\d.]+)[,\s]+([-\d.]+)/.exec(node.getAttribute('transform') || '');
      const tx = m ? parseFloat(m[1]) : 0;
      const ty = m ? parseFloat(m[2]) : 0;
      return { x: tx + b.x, y: ty + b.y, w: b.width, h: b.height };
    } catch {
      return null;
    }
  }

  public clear() {
    this.mainLayer.selectAll('*').remove();
    this.fxLayer.selectAll('*').remove();
    this.layout.reset();
    for (const plugin of this.plugins.values()) {
      (plugin as any).reset?.();
    }
  }

  public resetView() {
    this.camera.reset();
  }

  public destroy() {
    this.clear();
    this.camera.destroy();
    for (const plugin of this.plugins.values()) {
      plugin.uninstall?.();
    }
    this.plugins.clear();
    this.svg.remove();
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

    // Arrowhead marker for edges
    defs.append('marker')
      .attr('id', 'edge-arrowhead')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9).attr('refY', 5)
      .attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', 'context-stroke');
  }
}
