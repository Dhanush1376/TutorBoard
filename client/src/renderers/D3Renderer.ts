/**
 * D3Renderer.ts — Unified Canvas Engine Bridge v7.0
 * 
 * This class maintains backwards compatibility with the legacy D3Renderer 
 * interface while internally using the new modular CanvasEngine architecture.
 */

import { CanvasEngine, ArrayPlugin, PointerPlugin, TreePlugin } from '../engine/canvas';
import { ICanvasEngine } from '../engine/canvas/types';

export class D3Renderer {
  private engine: CanvasEngine;
  private arrayPlugin: ArrayPlugin;
  private pointerPlugin: PointerPlugin;
  private treePlugin: TreePlugin;
  
  public onInteraction: ((id: string, type: string) => void) | null = null;

  constructor(container: HTMLElement, width?: number, height?: number) {
    console.log('[D3Renderer] 🏗️ Initializing Unified CanvasEngine bridge');
    
    this.engine = new CanvasEngine(container);
    
    // Install Core Plugins
    this.arrayPlugin = new ArrayPlugin();
    this.pointerPlugin = new PointerPlugin();
    this.treePlugin = new TreePlugin();
    
    this.engine.registerPlugin(this.arrayPlugin);
    this.engine.registerPlugin(this.pointerPlugin);
    this.engine.registerPlugin(this.treePlugin);
  }

  // ─── Legacy Bridge Methods ────────────────────────────────────────────────

  public resetView() {
    this.engine.resetView();
  }

  public handleZoomCommand(type: 'in' | 'out' | 'reset') {
    if (type === 'reset') return this.resetView();
    // In the new engine, we can trigger zoom via the behavior directly if needed
    // but for now, we maintain the interface.
  }

  public clear() {
    this.engine.clear();
  }

  public destroy() {
    this.engine.clear();
  }

  // ─── Primitive Forwarding ─────────────────────────────────────────────────

  public createArray(id: string, values: (number | string)[], options?: any) {
    this.arrayPlugin.createArray(id, values, options);
  }

  public createPointer(id: string, atIndex: number, label: string, color?: string, targetArrayId?: string) {
    this.pointerPlugin.createPointer(id, atIndex, label, color, targetArrayId);
  }

  public updatePointer(id: string, atIndex: number, targetArrayId?: string) {
    this.pointerPlugin.movePointer(id, atIndex, targetArrayId);
  }

  // ─── Legacy Stubs (To be ported to plugins) ───────────────────────────────

  public createTree(id: string, data: any) {
    this.treePlugin.createTree(id, data);
  }

  public createChart(id: string, data: any, type: string) {
    console.warn('[D3Renderer] createChart: Stub called for', id);
  }

  public createTimeline(id: string, events: any[]) {
    console.warn('[D3Renderer] createTimeline: Stub called for', id);
  }

  public createComparator(left: any, right: any, op: string) {
    console.warn('[D3Renderer] createComparator: Stub called');
  }

  public annotate(target: string, text: string) {
    console.warn('[D3Renderer] annotate: Stub called');
  }

  public showResult(text: string) {
    console.warn('[D3Renderer] showResult: Stub called');
  }

  public getElement(id: string) {
    return this.engine.getElement(id).node();
  }
}
