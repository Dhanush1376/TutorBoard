/**
 * D3Renderer.ts — Unified Canvas Engine Bridge v8.0
 *
 * Maintains the legacy D3Renderer interface while forwarding to the modular
 * CanvasEngine. Every create/update method accepts an optional AnimContext
 * (master timeline + position) and returns the real duration in seconds so
 * the executor can schedule commands without overlap.
 */

import { CanvasEngine, ArrayPlugin, PointerPlugin, TreePlugin, NodePlugin, AuxPlugin } from '../engine/canvas';
import { AnimContext } from '../engine/canvas/types';

export class D3Renderer {
  public engine: CanvasEngine;
  private arrayPlugin: ArrayPlugin;
  private pointerPlugin: PointerPlugin;
  private treePlugin: TreePlugin;
  private nodePlugin: NodePlugin;
  private auxPlugin: AuxPlugin;

  public onInteraction: ((id: string, type: string) => void) | null = null;

  constructor(container: HTMLElement, _width?: number, _height?: number) {
    this.engine = new CanvasEngine(container);

    this.arrayPlugin = new ArrayPlugin();
    this.pointerPlugin = new PointerPlugin();
    this.treePlugin = new TreePlugin();
    this.nodePlugin = new NodePlugin();
    this.auxPlugin = new AuxPlugin();

    this.engine.registerPlugin(this.arrayPlugin);
    this.engine.registerPlugin(this.pointerPlugin);
    this.engine.registerPlugin(this.treePlugin);
    this.engine.registerPlugin(this.nodePlugin);
    this.engine.registerPlugin(this.auxPlugin);
  }

  // ─── View controls ────────────────────────────────────────────────────────

  public resetView() {
    this.engine.resetView();
  }

  public handleZoomCommand(type: 'in' | 'out' | 'reset') {
    if (type === 'reset') return this.resetView();
  }

  public clear() {
    this.engine.clear();
  }

  public destroy() {
    this.engine.destroy();
  }

  /** Adapt the logical coordinate system to the container's aspect ratio. */
  public resize(containerWidth: number, containerHeight: number) {
    this.engine.setLogicalSize(containerWidth, containerHeight);
  }

  // ─── Primitives (ctx-aware: return duration in seconds) ───────────────────

  public createNode(id: string, cmd: any, ctx?: AnimContext): number {
    return this.nodePlugin.createNode(id, cmd, ctx);
  }

  public createEdge(id: string, cmd: any, ctx?: AnimContext): number {
    return this.nodePlugin.createEdge(id, cmd, ctx);
  }

  public createArray(id: string, values: (number | string)[], options?: any, ctx?: AnimContext): number {
    return this.arrayPlugin.createArray(id, values, options, ctx);
  }

  public createPointer(id: string, atIndex: number, label: string, color?: string, targetArrayId?: string, ctx?: AnimContext): number {
    return this.pointerPlugin.createPointer(id, atIndex, label, color, targetArrayId, ctx);
  }

  public updatePointer(id: string, atIndex: number, targetArrayId?: string, ctx?: AnimContext): number {
    return this.pointerPlugin.movePointer(id, atIndex, targetArrayId, ctx);
  }

  public drawBoundary(atIndex: number, label: string, targetArrayId?: string, endIndex?: number, ctx?: AnimContext): number {
    return this.arrayPlugin.drawBoundary(atIndex, label, targetArrayId, endIndex, ctx);
  }

  public highlightCell(id: string, color: string, duration: number, ctx?: AnimContext): number {
    return this.arrayPlugin.highlightCell(id, color, duration, ctx);
  }

  public swapCells(id1: string, id2: string) {
    this.arrayPlugin.swapCells(id1, id2);
  }

  public createTree(id: string, data: any, options?: any, ctx?: AnimContext): number {
    return this.treePlugin.createTree(id, data, options, ctx);
  }

  public createChart(id: string, data: any, type: string, ctx?: AnimContext): number {
    return this.auxPlugin.createChart(id, data, type, ctx);
  }

  public createTimeline(id: string, events: any[], ctx?: AnimContext): number {
    return this.auxPlugin.createTimeline(id, events, ctx);
  }

  public createComparator(left: any, right: any, op: string, ctx?: AnimContext): number {
    return this.auxPlugin.createComparator(left, right, op, ctx);
  }

  public annotate(target: string, text: string, ctx?: AnimContext): number {
    return this.auxPlugin.annotate(target, text, ctx);
  }

  public showResult(text: string, ctx?: AnimContext): number {
    return this.auxPlugin.showResult(text, ctx);
  }

  public getElement(id: string) {
    return this.engine.getElement(id).node();
  }

  public removeElement(id: string) {
    this.engine.removeElement(id);
  }
}
