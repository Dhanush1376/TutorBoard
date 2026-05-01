/**
 * VisualScriptInterpreter v3.0 — Self-Contained GSAP Timeline Engine
 *
 * Reads a VisualScript `Command[]` array, builds a GSAP timeline,
 * and routes each command to the correct renderer method.
 *
 * The arc swap is the "wow" moment: GSAP MotionPath curves elements
 * through a parabolic arc — Manim-quality motion in the browser.
 */

import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { D3Renderer } from '../renderers/D3Renderer';

// Ensure plugin is registered for arc-trajectory swaps
gsap.registerPlugin(MotionPathPlugin);

// ─── Command Types ───────────────────────────────────────────────────────────

export interface Command {
  cmd:
    | 'array' | 'pointer' | 'move_pointer'
    | 'swap' | 'highlight' | 'color_to'
    | 'compare' | 'annotate' | 'remove_annotation' | 'remove'
    | 'equation' | 'physics_body' | 'force'
    | 'narrate' | 'camera' | 'wait'
    | 'timeline' | 'chart' | 'tree'
    | 'draw_boundary' | 'fade_in' | 'fade_out';
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
  target?: string;
  mass?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  zoom?: number;
  body?: string;
  targetArrayId?: string;
  events?: { date: string; label: string; description?: string }[];
  data?: { label: string; value: number }[];
  type?: string;
  [key: string]: any;
}

export interface RendererSystem {
  d3: D3Renderer;
  physics?: any;
  equation?: any;
}

// ─── Interpreter ─────────────────────────────────────────────────────────────

export class VisualScriptInterpreter {
  private masterTimeline: gsap.core.Timeline | null = null;
  private renderers: RendererSystem | null = null;
  private onNarrate: (text: string) => void;

  constructor(onNarrate: (text: string) => void) {
    this.onNarrate = onNarrate;
  }

  // ─── Renderer Registration ──────────────────────────────────────────────

  public setRenderers(renderers: RendererSystem) {
    this.renderers = renderers;
  }

  public registerSpecializedRenderer(type: 'physics' | 'equation', instance: any) {
    if (!this.renderers) return;
    (this.renderers as any)[type] = instance;
  }

  // ─── Public Playback API ────────────────────────────────────────────────

  /** Play a full lesson step (clears previous state first). */
  public playStep(script: Command[]) {
    if (!this.renderers?.d3) {
      console.warn('[VisualScriptInterpreter] D3 renderer not initialized.');
      return;
    }
    this.clear();
    this._buildTimeline(script);
  }

  /** Play delta annotations WITHOUT clearing the existing scene.
   *  @param onComplete - Called when the delta animation sequence finishes.
   *                      Use this to clear deltaState and resume the main lesson.
   */
  public playDelta(script: Command[], onComplete?: () => void) {
    if (!this.renderers?.d3) {
      console.warn('[VisualScriptInterpreter] D3 renderer not initialized.');
      return;
    }
    // Kill previous delta timeline but keep the D3 scene intact
    this.masterTimeline?.kill();
    this._buildTimeline(script, onComplete);
  }

  public pause()  { this.masterTimeline?.pause(); }
  public resume() { this.masterTimeline?.resume(); }
  
  public setPlaybackSpeed(speed: number) {
    if (this.masterTimeline) {
      this.masterTimeline.timeScale(speed);
    }
  }

  public kill() {
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
  }

  public clear() {
    this.kill();
    this.renderers?.d3?.clear();
    this.renderers?.physics?.clear?.();
  }

  // ─── Core: Timeline Builder ─────────────────────────────────────────────

  private _buildTimeline(script: Command[], onComplete?: () => void) {
    this.masterTimeline = gsap.timeline({
      paused: false,
      defaults: { ease: 'power2.inOut' },
      onComplete: onComplete ?? undefined,
    });
    const { d3, physics, equation } = this.renderers!;

    // `cursor` is the running time position in seconds on the master timeline
    let cursor = 0;

    for (const cmd of script) {
      // Honour an explicit delay before this command fires
      const position = cursor + ((cmd.delay || 0) / 1000);

      switch (cmd.cmd) {

        // ── Structural (Immediate DOM/SVG creation) ──────────────────────

        case 'array':
          this.masterTimeline.call(() => d3.createArray(cmd.id!, cmd.values!), [], position);
          cursor = position + ((cmd.duration || 300) / 1000);
          break;

        case 'pointer':
          this.masterTimeline.call(
            () => d3.createPointer(cmd.id!, cmd.atIndex!, cmd.label || '', cmd.color, cmd.targetArrayId),
            [], position
          );
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'move_pointer':
          this.masterTimeline.call(
            () => d3.updatePointer(cmd.id!, cmd.atIndex!, cmd.targetArrayId),
            [], position
          );
          cursor = position + ((cmd.duration || 250) / 1000);
          break;

        case 'draw_boundary':
          this.masterTimeline.call(
            () => d3.drawBoundary(cmd.atIndex!, cmd.label!, cmd.targetArrayId),
            [], position
          );
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'annotate':
          this.masterTimeline.call(() => d3.annotate(cmd.id || cmd.target!, cmd.text!), [], position);
          cursor = position + ((cmd.duration || 300) / 1000);
          break;

        case 'remove_annotation':
          this.masterTimeline.call(() => d3.removeElement(`annotation-${cmd.id}`), [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'remove':
          this.masterTimeline.call(() => d3.removeElement(cmd.id || cmd.target!), [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'compare':
          this.masterTimeline.call(
            () => d3.createComparator(cmd.left!, cmd.right!, cmd.op!),
            [], position
          );
          cursor = position + ((cmd.duration || 400) / 1000);
          break;

        case 'timeline':
          this.masterTimeline.call(() => d3.createTimeline(cmd.id!, cmd.events!), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'chart':
          this.masterTimeline.call(() => d3.createChart(cmd.id!, cmd.data!, cmd.type as any), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'tree':
          this.masterTimeline.call(() => d3.createTree(cmd.id!, cmd.data!), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        // ── Animated Commands ────────────────────────────────────────────

        case 'highlight':
          this.masterTimeline.call(
            () => d3.highlightCell(cmd.id!, cmd.color || '#fef08a', cmd.duration || 500),
            [], position
          );
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'color_to': {
          // Smooth fill transition on an SVG element via GSAP
          const dur = (cmd.duration || 400) / 1000;
          this.masterTimeline.call(() => {
            const el = document.getElementById(cmd.id!);
            if (el) gsap.to(el.querySelector('rect') || el, { fill: cmd.color, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'fade_in': {
          const dur = (cmd.duration || 400) / 1000;
          this.masterTimeline.call(() => {
            const el = document.getElementById(cmd.id!);
            if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'fade_out': {
          const dur = (cmd.duration || 400) / 1000;
          this.masterTimeline.call(() => {
            const el = document.getElementById(cmd.id!);
            if (el) gsap.to(el, { opacity: 0, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'swap':
          this._executeArcSwap(cmd, position);
          cursor = position + ((cmd.duration || 1000) / 1000);
          break;

        // ── Physics ──────────────────────────────────────────────────────

        case 'physics_body':
          this.masterTimeline.call(() => {
            if (physics?.addBody) physics.addBody(cmd);
          }, [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'force':
          this.masterTimeline.call(() => {
            if (physics?.applyForce) physics.applyForce(cmd.body || cmd.id, cmd.fx, cmd.fy);
          }, [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        // ── Math / Equations ─────────────────────────────────────────────

        case 'equation':
          this.masterTimeline.call(() => {
            if (equation?.setFormula) equation.setFormula(cmd.formula || cmd.text);
          }, [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        // ── Narrative & Flow ─────────────────────────────────────────────

        case 'narrate':
          this.masterTimeline.call(
            () => { if (cmd.text) this.onNarrate(cmd.text); },
            [], position
          );
          // Narration is instant — does not advance cursor on its own
          cursor = position;
          break;

        case 'camera':
          this.masterTimeline.to('.infinite-canvas-content', {
            scale:    cmd.zoom || 1,
            x:        (cmd.x || 0) * 100,
            y:        (cmd.y || 0) * 100,
            duration: (cmd.duration || 1000) / 1000,
          }, position);
          cursor = position + ((cmd.duration || 1000) / 1000);
          break;

        case 'wait':
          cursor = position + ((cmd.ms || cmd.duration || 500) / 1000);
          break;

        default:
          console.warn('[VisualScriptInterpreter] Unknown command:', (cmd as any).cmd);
          break;
      }
    }

    return this.masterTimeline;
  }

  // ─── Arc Swap — The "Wow" Moment ─────────────────────────────────────────
  //
  // Elements travel on a parabolic arc rather than a straight line.
  // el1 arcs UP and right;  el2 arcs DOWN and left (mirror).
  // GSAP MotionPathPlugin handles the curved trajectory.
  // Both animations start at the exact same timeline position → simultaneous swap.
  //
  private _executeArcSwap(cmd: Command, position: number) {
    const swapDur = (cmd.duration || 800) / 1000;

    this.masterTimeline!.call(() => {
      const el1 = document.getElementById(cmd.id1!);
      const el2 = document.getElementById(cmd.id2!);
      if (!el1 || !el2) return;

      const svg = (el1 as any).ownerSVGElement as SVGSVGElement;
      if (!svg) return;

      // ─── Coordinate Conversion (Zoom/Pan Safe) ─────────────────────
      // We convert viewport-relative bounding boxes into the SVG's root coordinate system.
      // This ensures swaps work correctly regardless of InfiniteCanvas scale/pan.
      const getSvgPos = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const pt = svg.createSVGPoint();
        // Use the center of the element
        pt.x = rect.left + rect.width / 2;
        pt.y = rect.top + rect.height / 2;
        return pt.matrixTransform(svg.getScreenCTM()!.inverse());
      };

      const p1 = getSvgPos(el1);
      const p2 = getSvgPos(el2);

      // Delta in SVG root units
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      // ─── Animation Strategy ─────────────────────────────────────────
      const arcHeight = -Math.min(100, Math.abs(dx) * 0.4);

      const tl = gsap.timeline();

      // Element 1: Arcs UP and right with Z-axis lift
      tl.to(el1, {
        motionPath: {
          path: [
            { x: 0,      y: 0 },
            { x: dx / 2, y: arcHeight },
            { x: dx,     y: dy }
          ],
          type: 'cubic'
        },
        scale: 1.15,
        filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.3))',
        zIndex: 100,
        duration: swapDur,
        ease: 'power2.inOut'
      }, 0);

      // Element 2: Arcs DOWN and left (mirror) with slight recess
      tl.to(el2, {
        motionPath: {
          path: [
            { x: 0,       y: 0 },
            { x: -dx / 2, y: -arcHeight },
            { x: -dx,     y: -dy }
          ],
          type: 'cubic'
        },
        scale: 0.95,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
        zIndex: 10,
        duration: swapDur,
        ease: 'power2.inOut'
      }, 0);

      // ─── Sync Back to D3 ────────────────────────────────────────────
      tl.call(() => {
        // Reset GSAP transforms and filters so they don't persist
        gsap.set([el1, el2], { x: 0, y: 0, scale: 1, filter: 'none', zIndex: 'auto', clearProps: 'transform,filter,scale,zIndex' });
        this.renderers?.d3?.swapCells?.(cmd.id1!, cmd.id2!);
      });

    }, [], position);
  }
}
