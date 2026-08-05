/**
 * GSAPExecutor v5.0 — Compile-Ahead Master Timeline Engine.
 *
 * Every command in a script is compiled into ONE GSAP timeline:
 *   - DOM elements are created at compile time (hidden), entrance tweens are
 *     timeline children — so pause / resume / seek / timeScale affect ALL
 *     motion (no orphan tweens, no race conditions).
 *   - The cursor advances by each command's REAL duration (returned by the
 *     plugin), not a hardcoded guess — commands never overlap unless they
 *     explicitly opt in via `parallel: true`.
 *   - A small breathing gap between commands keeps pacing deliberate.
 *   - The camera automatically frames new content at the start of each batch.
 */

import gsap from 'gsap';
import { Command, RendererSystem } from './types';
import { AnimContext } from './canvas/types';
import {
  fadeIn, fadeOut, pulse, shake, colorTo, indicate,
  circumscribe, flashAt, arcSwap,
} from './anim/primitives';

const COMMAND_GAP = 0.06; // seconds of breathing room between commands

export class GSAPExecutor {
  private masterTimeline: gsap.core.Timeline | null = null;
  private container: HTMLElement | null = null;
  private speed = 1;
  private userPaused = false;

  constructor(container?: HTMLElement) {
    this.container = container || null;
  }

  /**
   * Compile and play a command script. Returns the total duration in seconds.
   * `onComplete` fires exactly once when the whole timeline finishes.
   */
  public play(script: Command[], renderers: RendererSystem, onComplete?: () => void): number {
    this.kill();

    if (!script || script.length === 0) {
      onComplete?.();
      return 0;
    }

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onComplete: () => onComplete?.(),
    });
    this.masterTimeline = tl;

    const d3r: any = renderers.d3;
    const engine: any = d3r?.engine;
    let cursor = 0;
    const createdIds: string[] = [];

    const ctxAt = (at: number): AnimContext => ({ tl, at });

    for (const cmd of script) {
      const at = cursor + ((cmd.delay || 0) / 1000);
      let dur = 0;

      switch (cmd.cmd) {
        // ── Structural (D3 canvas) ──────────────────────────────────────
        case 'array':
          dur = d3r?.createArray?.(cmd.id!, cmd.values || [], cmd, ctxAt(at)) ?? 0;
          if (cmd.id) createdIds.push(cmd.id);
          break;

        case 'pointer':
          dur = d3r?.createPointer?.(cmd.id!, cmd.atIndex ?? 0, cmd.label || '', cmd.color, cmd.targetArrayId, ctxAt(at)) ?? 0;
          break;

        case 'move_pointer':
          dur = d3r?.updatePointer?.(cmd.id!, cmd.atIndex ?? 0, cmd.targetArrayId, ctxAt(at)) ?? 0;
          break;

        case 'draw_boundary':
          dur = d3r?.drawBoundary?.(cmd.atIndex ?? 0, cmd.label || '', cmd.targetArrayId, cmd.endIndex, ctxAt(at)) ?? 0;
          break;

        case 'tree':
          dur = d3r?.createTree?.(cmd.id!, cmd.data, cmd, ctxAt(at)) ?? 0;
          if (cmd.id) createdIds.push(cmd.id);
          break;

        case 'chart':
          dur = d3r?.createChart?.(cmd.id!, cmd.data, (cmd.type as string) || 'bar', ctxAt(at)) ?? 0;
          if (cmd.id) createdIds.push(cmd.id);
          break;

        case 'timeline':
          dur = d3r?.createTimeline?.(cmd.id!, cmd.events || [], ctxAt(at)) ?? 0;
          if (cmd.id) createdIds.push(cmd.id);
          break;

        case 'node':
        case 'orb':
        case 'badge':
        case 'block':
        case 'data_block':
        case 'callout':
        case 'group':
        case 'step':
          dur = d3r?.createNode?.(cmd.id!, cmd, ctxAt(at)) ?? 0;
          if (cmd.id) createdIds.push(cmd.id);
          break;

        case 'edge':
          dur = d3r?.createEdge?.(cmd.id!, cmd, ctxAt(at)) ?? 0;
          break;

        // ── Annotations & results ───────────────────────────────────────
        case 'compare':
          dur = d3r?.createComparator?.(cmd.left, cmd.right, cmd.op || '==', ctxAt(at)) ?? 0;
          break;

        case 'annotate':
          dur = d3r?.annotate?.(cmd.id || cmd.target!, cmd.text || '', ctxAt(at)) ?? 0;
          break;

        case 'result':
          dur = d3r?.showResult?.(cmd.text || '', ctxAt(at)) ?? 0;
          break;

        case 'remove': {
          const el = this._getElement(cmd.id || cmd.target!);
          if (el) {
            dur = fadeOut(tl, el, at, { duration: (cmd.duration || 300) / 1000 });
            tl.call(() => d3r?.removeElement?.(cmd.id || cmd.target!), [], at + dur);
          }
          break;
        }

        // ── Emphasis ────────────────────────────────────────────────────
        case 'highlight':
          dur = d3r?.highlightCell?.(cmd.id!, cmd.color || '#fef08a', cmd.duration || 600, ctxAt(at)) ?? 0;
          if (dur === 0) {
            // Non-cell target: generic indicate
            const el = this._getElement(cmd.id!);
            if (el) dur = indicate(tl, el, at, { duration: (cmd.duration || 600) / 1000 });
          }
          break;

        case 'swap':
          dur = arcSwap(
            tl,
            () => this._getElement(cmd.id1!),
            () => this._getElement(cmd.id2!),
            at,
            () => d3r?.swapCells?.(cmd.id1!, cmd.id2!),
            { duration: (cmd.duration || 600) / 1000 }
          );
          break;

        case 'color_to': {
          const el = this._getElement(cmd.id!);
          const target = el?.querySelector('rect') || el;
          if (target) dur = colorTo(tl, target, at, cmd.color || '#3b82f6', { duration: (cmd.duration || 400) / 1000 });
          break;
        }

        case 'shake': {
          const el = this._getElement(cmd.id!);
          if (el) dur = shake(tl, el, at, { duration: (cmd.duration || 400) / 1000 });
          break;
        }

        case 'pulse': {
          const el = this._getElement(cmd.id!);
          if (el) dur = pulse(tl, el, at, { duration: (cmd.duration || 600) / 1000 });
          break;
        }

        case 'circumscribe': {
          const bbox = engine?.getBBoxOf?.(cmd.id || cmd.target!);
          const fxLayer = engine?.fxLayer?.node?.();
          if (bbox && fxLayer) dur = circumscribe(tl, fxLayer, bbox, at, { color: cmd.color });
          break;
        }

        case 'flash': {
          const bbox = engine?.getBBoxOf?.(cmd.id || cmd.target!);
          const fxLayer = engine?.fxLayer?.node?.();
          if (bbox && fxLayer) {
            dur = flashAt(tl, fxLayer, { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 }, at, { color: cmd.color });
          }
          break;
        }

        case 'fade_in': {
          const el = this._getElement(cmd.id!);
          if (el) dur = fadeIn(tl, el, at, { duration: (cmd.duration || 400) / 1000 });
          break;
        }

        case 'fade_out': {
          const el = this._getElement(cmd.id!);
          if (el) dur = fadeOut(tl, el, at, { duration: (cmd.duration || 400) / 1000 });
          break;
        }

        // ── External renderers (KaTeX / Desmos / Monaco / Matter) ───────
        case 'equation':
          tl.call(() => renderers.equation?.setFormula?.(cmd.formula || cmd.text || ''), [], at);
          dur = (cmd.duration || 800) / 1000;
          break;

        case 'graph':
          tl.call(() => renderers.graph?.setExpression?.(cmd.latex || cmd.formula || '', cmd.color), [], at);
          dur = (cmd.duration || 800) / 1000;
          break;

        case 'code':
          tl.call(() => renderers.code?.setCode?.(cmd.code || cmd.content || ''), [], at);
          dur = (cmd.duration || 800) / 1000;
          break;

        case 'physics_body':
          tl.call(() => renderers.physics?.addBody?.(cmd), [], at);
          dur = (cmd.duration || 300) / 1000;
          break;

        case 'force':
          tl.call(() => renderers.physics?.applyForce?.(cmd.body || cmd.id, cmd.fx, cmd.fy), [], at);
          dur = (cmd.duration || 300) / 1000;
          break;

        // ── Camera ──────────────────────────────────────────────────────
        case 'camera': {
          if (engine?.camera) {
            if (cmd.target || cmd.focusId) {
              // Focus a specific element (bbox resolved at compile time)
              const bbox = engine.getBBoxOf(cmd.target || cmd.focusId);
              if (bbox) dur = engine.camera.focusOn(tl, bbox, at, { zoom: cmd.zoom, duration: (cmd.duration || 900) / 1000 });
            } else if (cmd.zoom !== undefined || cmd.x !== undefined || cmd.y !== undefined) {
              const k = cmd.zoom || 1;
              const cx = (cmd.x ?? 0.5) * engine.width;
              const cy = (cmd.y ?? 0.5) * engine.height;
              dur = engine.camera.tweenTo(tl, {
                x: engine.width / 2 - k * cx,
                y: engine.height / 2 - k * cy,
                k,
              }, at, (cmd.duration || 900) / 1000);
            } else {
              dur = engine.camera.reset(tl, at);
            }
          }
          break;
        }

        // ── Flow control ────────────────────────────────────────────────
        case 'wait':
          dur = (cmd.ms || cmd.duration || 500) / 1000;
          break;

        case 'narrate':
          // Narration pacing is handled at the step level (voice-gated
          // advancement) — the command itself takes no timeline space.
          dur = 0;
          break;

        default:
          if (import.meta.env?.DEV) {
            console.warn(`[GSAPExecutor] Unknown command: ${cmd.cmd}`);
          }
      }

      const parallel = (cmd as any).parallel === true;
      if (!parallel) {
        cursor = at + dur + (dur > 0 ? COMMAND_GAP : 0);
      }
    }

    // Smart camera: frame newly created content while it animates in — but
    // only if it isn't already visible (evaluated at play time).
    if (engine?.camera && createdIds.length > 0) {
      engine.camera.ensureVisible(tl, () => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id of createdIds) {
          const b = engine.getBBoxOf(id);
          if (!b) continue;
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.w);
          maxY = Math.max(maxY, b.y + b.h);
        }
        if (!isFinite(minX)) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }, 0.01, { duration: Math.min(0.9, Math.max(0.5, cursor * 0.4)) });
    }

    tl.timeScale(this.speed);
    if (this.userPaused) {
      // Playback is paused (e.g. the user clicked a specific step): render
      // the step's final state instantly. onComplete still fires so the
      // completion gating stays accurate.
      tl.progress(1, false);
    } else {
      tl.play(0);
    }
    return cursor;
  }

  // ── Playback controls (all effective — every tween is a timeline child) ──

  public pause() {
    this.userPaused = true;
    this.masterTimeline?.pause();
  }

  public resume() {
    this.userPaused = false;
    this.masterTimeline?.resume();
  }

  public kill() {
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(4, speed || 1));
    this.masterTimeline?.timeScale(this.speed);
  }

  // ── Timeline scrubbing & progress ───────────────────────────────────────

  public seekTo(time: number): void {
    this.masterTimeline?.seek(time, false);
  }

  public getProgress(): number {
    return this.masterTimeline?.progress() ?? 0;
  }

  public getDuration(): number {
    return this.masterTimeline?.duration() ?? 0;
  }

  public getCurrentTime(): number {
    return this.masterTimeline?.time() ?? 0;
  }

  public isActive(): boolean {
    return this.masterTimeline?.isActive() || false;
  }

  /** Jump the current timeline to its end state instantly. */
  public finishInstantly(): void {
    this.masterTimeline?.progress(1, false);
  }

  private _getElement(id: string): Element | null {
    if (!id) return null;
    return (
      (this.container?.querySelector(`#${CSS.escape(id)}`) as Element) ||
      document.getElementById(id)
    );
  }
}
