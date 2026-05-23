import gsap from 'gsap';
import { Command, RendererSystem } from './types';



/**
 * GSAPExecutor v4.0 — The Unified Animation Engine.
 * 
 * Orchestrates the master timeline, subject renderers (D3, Physics, Math),
 * and camera movements.
 */
export class GSAPExecutor {
  private masterTimeline: gsap.core.Timeline | null = null;
  private container: HTMLElement | null = null;

  constructor(container?: HTMLElement) {
    this.container = container || null;
  }

  public play(script: Command[], renderers: RendererSystem, onComplete?: () => void) {
    this.kill();

    this.masterTimeline = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: onComplete ?? undefined,
    });

    const tl = this.masterTimeline!;
    const { d3, physics, equation, graph, code } = renderers;
    let cursor = 0;

    for (const cmd of script) {
      const position = cursor + ((cmd.delay || 0) / 1000);

      switch (cmd.cmd) {
        // ── D3 Structural ────────────────────────────────────────────────
        case 'array':
          tl.call(() => d3.createArray(cmd.id!, cmd.values!), [], position);
          cursor = position + ((cmd.duration || 300) / 1000);
          break;

        case 'pointer':
          tl.call(
            () => d3.createPointer(cmd.id!, cmd.atIndex!, cmd.label || '', cmd.color, cmd.targetArrayId),
            [], position
          );
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'move_pointer':
          tl.call(
            () => d3.updatePointer(cmd.id!, cmd.atIndex!, cmd.targetArrayId),
            [], position
          );
          cursor = position + ((cmd.duration || 250) / 1000);
          break;

        case 'draw_boundary':
          tl.call(
            () => d3.drawBoundary(cmd.atIndex!, cmd.label!, cmd.targetArrayId, cmd.endIndex),
            [], position
          );
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'tree':
          tl.call(() => d3.createTree(cmd.id!, cmd.data!), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'chart':
          tl.call(() => d3.createChart(cmd.id!, cmd.data!, cmd.type as any), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'timeline':
          tl.call(() => d3.createTimeline(cmd.id!, cmd.events!), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'compare':
          tl.call(() => d3.createComparator(cmd.left!, cmd.right!, cmd.op!), [], position);
          cursor = position + ((cmd.duration || 400) / 1000);
          break;

        // ── D3 Annotations & Results ─────────────────────────────────────
        case 'annotate':
          tl.call(() => d3.annotate(cmd.id || cmd.target!, cmd.text!), [], position);
          cursor = position + ((cmd.duration || 300) / 1000);
          break;

        case 'result':
          tl.call(() => d3.showResult(cmd.text!), [], position);
          cursor = position + ((cmd.duration || 400) / 1000);
          break;

        case 'remove':
          tl.call(() => d3.removeElement(cmd.id || cmd.target!), [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        // ── Physics ──────────────────────────────────────────────────────
        case 'physics_body':
          tl.call(() => physics?.addBody?.(cmd), [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        case 'force':
          tl.call(() => physics?.applyForce?.(cmd.body || cmd.id, cmd.fx, cmd.fy), [], position);
          cursor = position + ((cmd.duration || 200) / 1000);
          break;

        // ── Math & Simulation ───────────────────────────────────────────
        case 'equation':
          tl.call(() => equation?.setFormula?.(cmd.formula || cmd.text || ''), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'graph':
          tl.call(() => graph?.setExpression?.(cmd.latex || cmd.formula || '', cmd.color), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'code':
          tl.call(() => code?.setCode?.(cmd.code || cmd.content || ''), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        // ── Animations ───────────────────────────────────────────────────
        case 'highlight':
          tl.call(() => d3.highlightCell(cmd.id!, cmd.color || '#fef08a', cmd.duration || 500), [], position);
          cursor = position + ((cmd.duration || 500) / 1000);
          break;

        case 'swap':
          this._executeArcSwap(cmd, position, d3);
          cursor = position + ((cmd.duration || 600) / 1000);
          break;

        case 'color_to': {
          const dur = (cmd.duration || 400) / 1000;
          tl.call(() => {
            const el = this._getElement(cmd.id!);
            if (el) gsap.to(el.querySelector('rect') || el, { fill: cmd.color, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'shake': {
          const dur = (cmd.duration || 400) / 1000;
          tl.call(() => {
            const el = this._getElement(cmd.id!);
            if (el) {
              gsap.to(el, { x: '+=10', duration: dur / 4, repeat: 3, yoyo: true, ease: 'sine.inOut' });
            }
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'pulse': {
          const dur = (cmd.duration || 600) / 1000;
          tl.call(() => {
            const el = this._getElement(cmd.id!);
            if (el) {
              gsap.to(el, { scale: 1.2, duration: dur / 2, repeat: 1, yoyo: true, ease: 'power2.inOut' });
            }
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'fade_in': {
          const dur = (cmd.duration || 400) / 1000;
          tl.call(() => {
            const el = this._getElement(cmd.id!);
            if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        case 'fade_out': {
          const dur = (cmd.duration || 400) / 1000;
          tl.call(() => {
            const el = this._getElement(cmd.id!);
            if (el) gsap.to(el, { opacity: 0, duration: dur });
          }, [], position);
          cursor = position + dur;
          break;
        }

        // ── Global ───────────────────────────────────────────────────────
        case 'camera': {
          const cameraTarget = this.container?.querySelector('.infinite-canvas-content') || '.infinite-canvas-content';
          tl.to(cameraTarget, {
            scale:    cmd.zoom || 1,
            x:        (cmd.x || 0) * 100,
            y:        (cmd.y || 0) * 100,
            duration: (cmd.duration || 1000) / 1000,
          }, position);
          cursor = position + ((cmd.duration || 1000) / 1000);
          break;
        }

        case 'wait':
          cursor = position + ((cmd.ms || cmd.duration || 500) / 1000);
          break;

        case 'narrate':
          // Narration is instant but we keep cursor
          cursor = position;
          break;

        default:
          console.warn(`[GSAPExecutor] Unknown command: ${cmd.cmd}`);
      }
    }
  }

  private _executeArcSwap(cmd: Command, position: number, d3: any) {
    const dur = (cmd.duration || 600) / 1000;
    const id1 = cmd.id1!;
    const id2 = cmd.id2!;

    this.masterTimeline!.call(() => {
      const el1 = this._getElement(id1);
      const el2 = this._getElement(id2);
      if (!el1 || !el2) return;

      const svg = (el1 as any).ownerSVGElement as SVGSVGElement;
      if (!svg) return;

      const getSvgPos = (el: any) => {
        if (typeof el.getBBox === 'function') {
          const bbox = el.getBBox();
          return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        }
        const rect = el.getBoundingClientRect();
        const pt = svg.createSVGPoint();
        pt.x = rect.left + rect.width / 2;
        pt.y = rect.top + rect.height / 2;
        return pt.matrixTransform(svg.getScreenCTM()!.inverse());
      };

      const p1 = getSvgPos(el1);
      const p2 = getSvgPos(el2);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      const arcHeight = -Math.min(100, Math.abs(dx) * 0.4);

      // Animation 1: Swap
      gsap.to(el1, {
        duration: dur,
        x: dx,
        y: dy,
        scale: 1.1,
        zIndex: 100,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.set(el1, { x: 0, y: 0, scale: 1, zIndex: 'auto' });
          d3.swapCells(id1, id2);
        }
      });

      // Animation 2: Mirror
      gsap.to(el2, {
        duration: dur,
        x: -dx,
        y: -dy,
        scale: 0.9,
        zIndex: 10,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.set(el2, { x: 0, y: 0, scale: 1, zIndex: 'auto' });
        }
      });
    }, [], position);
  }

  public pause()  { this.masterTimeline?.pause(); }
  public resume() { this.masterTimeline?.resume(); }
  public kill()   { this.masterTimeline?.kill(); this.masterTimeline = null; }
  public setSpeed(speed: number) { this.masterTimeline?.timeScale(speed); }

  // ── Timeline Scrubbing & Progress ───────────────────────────────────────

  /**
   * Seek to a specific time in the master timeline (in seconds).
   * Useful for scrubber UI controls.
   */
  public seekTo(time: number): void {
    if (!this.masterTimeline) return;
    this.masterTimeline.seek(time, false);
  }

  /**
   * Get the current playback progress as a ratio [0, 1].
   */
  public getProgress(): number {
    if (!this.masterTimeline) return 0;
    return this.masterTimeline.progress();
  }

  /**
   * Get the total duration of the master timeline in seconds.
   */
  public getDuration(): number {
    if (!this.masterTimeline) return 0;
    return this.masterTimeline.duration();
  }

  /**
   * Get the current playback time in seconds.
   */
  public getCurrentTime(): number {
    if (!this.masterTimeline) return 0;
    return this.masterTimeline.time();
  }

  /**
   * Check if the timeline is currently playing.
   */
  public isActive(): boolean {
    return this.masterTimeline?.isActive() || false;
  }

  // ── GPU Hints ───────────────────────────────────────────────────────────

  /**
   * Apply will-change hints to elements that will be animated.
   * This tells the browser to promote them to their own compositing layer.
   */
  private _applyGPUHints(el: HTMLElement | null): void {
    if (!el) return;
    el.style.willChange = 'transform, opacity';
  }

  /**
   * Remove will-change hints after animation completes to free GPU memory.
   */
  private _removeGPUHints(el: HTMLElement | null): void {
    if (!el) return;
    el.style.willChange = 'auto';
  }

  private _getElement(id: string): HTMLElement | null {
    if (!id) return null;
    return (this.container?.querySelector(`#${CSS.escape(id)}`) as HTMLElement) || (document.getElementById(id) as HTMLElement);
  }
}
