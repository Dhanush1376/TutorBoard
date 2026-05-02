import { D3Renderer } from '../renderers/D3Renderer';
import { GSAPExecutor } from './GSAPExecutor';

// ─── Command Types ───────────────────────────────────────────────────────────

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

/**
 * VisualScriptInterpreter v4.0 — Thin Controller.
 * 
 * Routes higher-level session state and narration to the GSAPExecutor
 * and specialized subject renderers.
 */
export class VisualScriptInterpreter {
  private executor: GSAPExecutor;
  private renderers: RendererSystem | null = null;
  private onNarrate: (text: string) => void;

  constructor(onNarrate: (text: string) => void, container?: HTMLElement) {
    this.onNarrate = onNarrate;
    this.executor = new GSAPExecutor(container);
  }

  // ─── Renderer Registration ──────────────────────────────────────────────

  public setRenderers(renderers: RendererSystem) {
    this.renderers = renderers;
  }

  public registerSpecializedRenderer(type: 'physics' | 'equation' | 'graph' | 'code', instance: any) {
    if (!this.renderers) {
      // Initialize with d3 as base if not yet set
      this.renderers = { d3: (null as any) };
    }
    (this.renderers as any)[type] = instance;
  }

  // ─── Public Playback API ────────────────────────────────────────────────

  /** Play a full lesson step (clears previous state first). */
  public playStep(script: Command[], onComplete?: () => void) {
    if (!this.renderers) return;
    this.clear();

    const narrationCmd = script.find(c => c.cmd === 'narrate');
    if (narrationCmd?.text) {
      this.onNarrate(narrationCmd.text);
    }

    this.executor.play(script, this.renderers, onComplete);
  }

  /** Play delta annotations WITHOUT clearing the existing scene. */
  public playDelta(script: Command[], onComplete?: () => void) {
    if (!this.renderers) return;
    this.executor.play(script, this.renderers, onComplete);
  }

  public pause()  { this.executor.pause(); }
  public resume() { this.executor.resume(); }
  
  public setPlaybackSpeed(speed: number) {
    this.executor.setSpeed(speed);
  }

  public kill() {
    this.executor.kill();
  }

  public clear() {
    this.kill();
    this.renderers?.d3?.clear();
    this.renderers?.physics?.clear?.();
  }
}
