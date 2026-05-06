/**
 * shared engine types for TutorBoard
 */

import { D3Renderer } from '../renderers/D3Renderer';

export interface Command {
  cmd:
    | 'array' | 'pointer' | 'move_pointer'
    | 'swap' | 'highlight' | 'color_to'
    | 'compare' | 'annotate' | 'remove_annotation' | 'remove'
    | 'equation' | 'graph' | 'code' | 'physics_body' | 'force'
    | 'narrate' | 'camera' | 'wait'
    | 'timeline' | 'chart' | 'tree'
    | 'draw_boundary' | 'fade_in' | 'fade_out' | 'shake' | 'pulse'
    | 'result';
  id?: string;
  id1?: string;
  id2?: string;
  duration?: number;
  delay?: number;
  ms?: number;
  text?: string;
  color?: string;
  atIndex?: number;
  label?: string;
  values?: (string | number)[];
  left?: string | number;
  right?: string | number;
  op?: string;
  formula?: string;
  latex?: string;
  code?: string;
  content?: string;
  target?: string;
  mass?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  zoom?: number;
  body?: string;
  targetArrayId?: string;
  endIndex?: number;
  events?: { date: string; label: string; description?: string }[];
  data?: { label: string; value: number }[];
  type?: string;
  [key: string]: any;
}

export interface RendererSystem {
  d3: D3Renderer;
  physics?: any;
  equation?: any;
  graph?: any;
  code?: any;
}
