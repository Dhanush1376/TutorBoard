/**
 * canvas/types.ts — Unified Canvas System Types
 */

import { Selection } from 'd3';
import type gsap from 'gsap';
import type { LayoutEngine } from '../layout/LayoutEngine';
import type { CameraController } from '../CameraController';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasElementMetadata {
  id: string;
  type: string;
  [key: string]: any;
}

/**
 * AnimContext — passed to plugin create/update methods when the call is part
 * of a compiled master timeline. The plugin must add its entrance/motion
 * tweens to `tl` at position `at` and return the duration it occupies.
 * When absent, the plugin renders its final state instantly (no animation) —
 * used for cumulative rebuilds on seeks/jumps.
 */
export interface AnimContext {
  tl: gsap.core.Timeline;
  at: number;
}

export interface ICanvasEngine {
  readonly width: number;
  readonly height: number;
  readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  readonly mainLayer: Selection<SVGGElement, unknown, null, undefined>;
  readonly fxLayer: Selection<SVGGElement, unknown, null, undefined>;
  readonly layout: LayoutEngine;
  readonly camera: CameraController;

  registerPlugin(plugin: ICanvasPlugin): void;
  getElement(id: string): Selection<any, unknown, null, undefined>;
  removeElement(id: string): void;
  /** BBox of an element in logical canvas coordinates (transform-aware). */
  getBBoxOf(id: string): { x: number; y: number; w: number; h: number } | null;
  clear(): void;
  setLogicalSize(width: number, height: number): void;
}

export interface ICanvasPlugin {
  readonly name: string;
  install(engine: ICanvasEngine): void;
  uninstall?(): void;
}
