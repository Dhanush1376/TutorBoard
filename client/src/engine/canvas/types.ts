/**
 * canvas/types.ts — Unified Canvas System Types
 */

import { Selection } from 'd3';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasElementMetadata {
  id: string;
  type: string;
  [key: string]: any;
}

export interface ICanvasEngine {
  readonly width: number;
  readonly height: number;
  readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  readonly mainLayer: Selection<SVGGElement, unknown, null, undefined>;
  
  registerPlugin(plugin: ICanvasPlugin): void;
  getElement(id: string): Selection<any, unknown, null, undefined>;
  removeElement(id: string): void;
  clear(): void;
}

export interface ICanvasPlugin {
  readonly name: string;
  install(engine: ICanvasEngine): void;
  uninstall?(): void;
}
