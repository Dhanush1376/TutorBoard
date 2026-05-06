/**
 * TransitionEngine v1.0 — Step-to-Step Transition Manager
 *
 * Manages the visual transitions between teaching steps:
 * - Cross-fade: Default for most content switches (opacity swap)
 * - Morph: For data changes within the same visualization type
 * - Slide: For sequential narrative content (horizontal slide)
 * - Zoom: For drill-down into sub-components
 * - Cinematic Wipe: For dramatic topic transitions
 *
 * Works with GSAP for hardware-accelerated transitions
 * and integrates with the SceneOrchestrator step lifecycle.
 */

import gsap from 'gsap';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransitionType = 'crossfade' | 'slide' | 'zoom' | 'morph' | 'wipe' | 'none';

export type TransitionDirection = 'forward' | 'backward';

export interface TransitionConfig {
  type: TransitionType;
  duration: number;          // in seconds
  ease: string;
  direction: TransitionDirection;
  stagger?: number;          // stagger delay for child elements
  scaleFrom?: number;        // for zoom transitions
  slideDistance?: number;     // for slide transitions in px
}

export interface TransitionCallbacks {
  onStart?: () => void;
  onMidpoint?: () => void;   // Called when old content is hidden and new can begin
  onComplete?: () => void;
}

// ─── Default Configs ────────────────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<TransitionType, Omit<TransitionConfig, 'direction'>> = {
  crossfade: {
    type: 'crossfade',
    duration: 0.5,
    ease: 'power2.inOut',
  },
  slide: {
    type: 'slide',
    duration: 0.6,
    ease: 'power3.inOut',
    slideDistance: 60,
  },
  zoom: {
    type: 'zoom',
    duration: 0.7,
    ease: 'power2.inOut',
    scaleFrom: 0.85,
  },
  morph: {
    type: 'morph',
    duration: 0.4,
    ease: 'power2.out',
    stagger: 0.03,
  },
  wipe: {
    type: 'wipe',
    duration: 0.8,
    ease: 'power3.inOut',
  },
  none: {
    type: 'none',
    duration: 0,
    ease: 'none',
  },
};

// ─── TransitionEngine ───────────────────────────────────────────────────────

export class TransitionEngine {
  private activeTimeline: gsap.core.Timeline | null = null;
  private isTransitioning: boolean = false;
  private reducedMotion: boolean = false;

  constructor() {
    // Detect prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  /**
   * Execute a transition between two container states.
   *
   * @param container - The parent element containing the scene
   * @param config - Transition configuration (or just a type string)
   * @param callbacks - Lifecycle callbacks
   * @returns Promise that resolves when transition completes
   */
  async transition(
    container: HTMLElement,
    config: TransitionType | Partial<TransitionConfig>,
    callbacks: TransitionCallbacks = {}
  ): Promise<void> {
    // Kill any in-progress transition
    this.kill();

    const resolvedConfig = this._resolveConfig(config);

    // Honor reduced motion preference
    if (this.reducedMotion || resolvedConfig.type === 'none') {
      callbacks.onStart?.();
      callbacks.onMidpoint?.();
      callbacks.onComplete?.();
      return;
    }

    this.isTransitioning = true;

    return new Promise<void>((resolve) => {
      callbacks.onStart?.();

      switch (resolvedConfig.type) {
        case 'crossfade':
          this._executeCrossfade(container, resolvedConfig, callbacks, resolve);
          break;
        case 'slide':
          this._executeSlide(container, resolvedConfig, callbacks, resolve);
          break;
        case 'zoom':
          this._executeZoom(container, resolvedConfig, callbacks, resolve);
          break;
        case 'morph':
          this._executeMorph(container, resolvedConfig, callbacks, resolve);
          break;
        case 'wipe':
          this._executeWipe(container, resolvedConfig, callbacks, resolve);
          break;
        default:
          callbacks.onMidpoint?.();
          callbacks.onComplete?.();
          this.isTransitioning = false;
          resolve();
      }
    });
  }

  /**
   * Determine the best transition type based on content change characteristics.
   */
  autoDetect(
    prevStepType?: string,
    nextStepType?: string,
    direction: TransitionDirection = 'forward'
  ): TransitionConfig {
    // Same type = morph (data changed, structure same)
    if (prevStepType && nextStepType && prevStepType === nextStepType) {
      return { ...DEFAULT_CONFIGS.morph, direction };
    }

    // Going to/from summary or result = zoom
    if (nextStepType === 'summary' || nextStepType === 'result' || prevStepType === 'result') {
      return { ...DEFAULT_CONFIGS.zoom, direction };
    }

    // Intro steps = slide (entry/exit feel)
    if (nextStepType === 'intro' || prevStepType === 'intro') {
      return { ...DEFAULT_CONFIGS.slide, direction };
    }

    // Default to crossfade
    return { ...DEFAULT_CONFIGS.crossfade, direction };
  }

  /**
   * Check if a transition is currently in progress.
   */
  isActive(): boolean {
    return this.isTransitioning;
  }

  /**
   * Kill any in-progress transition immediately.
   */
  kill(): void {
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
    }
    this.isTransitioning = false;
  }

  // ── Transition Implementations ─────────────────────────────────────────

  private _executeCrossfade(
    container: HTMLElement,
    config: TransitionConfig,
    callbacks: TransitionCallbacks,
    resolve: () => void
  ): void {
    const halfDur = config.duration / 2;

    this.activeTimeline = gsap.timeline({
      onComplete: () => {
        this.isTransitioning = false;
        callbacks.onComplete?.();
        resolve();
      },
    });

    // Phase 1: Fade out current content
    this.activeTimeline
      .to(container, {
        opacity: 0,
        duration: halfDur,
        ease: 'power2.in',
      })
      .call(() => {
        callbacks.onMidpoint?.(); // New content can now be rendered
      })
      // Phase 2: Fade in new content
      .to(container, {
        opacity: 1,
        duration: halfDur,
        ease: 'power2.out',
      });
  }

  private _executeSlide(
    container: HTMLElement,
    config: TransitionConfig,
    callbacks: TransitionCallbacks,
    resolve: () => void
  ): void {
    const dist = config.slideDistance || 60;
    const direction = config.direction === 'forward' ? 1 : -1;
    const halfDur = config.duration / 2;

    this.activeTimeline = gsap.timeline({
      onComplete: () => {
        this.isTransitioning = false;
        callbacks.onComplete?.();
        resolve();
      },
    });

    // Phase 1: Slide out
    this.activeTimeline
      .to(container, {
        x: -dist * direction,
        opacity: 0,
        duration: halfDur,
        ease: 'power3.in',
      })
      .call(() => {
        // Reset position for incoming slide
        gsap.set(container, { x: dist * direction });
        callbacks.onMidpoint?.();
      })
      // Phase 2: Slide in from opposite side
      .to(container, {
        x: 0,
        opacity: 1,
        duration: halfDur,
        ease: 'power3.out',
      });
  }

  private _executeZoom(
    container: HTMLElement,
    config: TransitionConfig,
    callbacks: TransitionCallbacks,
    resolve: () => void
  ): void {
    const scaleTo = config.direction === 'forward' ? (config.scaleFrom || 0.85) : 1.15;
    const halfDur = config.duration / 2;

    this.activeTimeline = gsap.timeline({
      onComplete: () => {
        this.isTransitioning = false;
        callbacks.onComplete?.();
        resolve();
      },
    });

    this.activeTimeline
      .to(container, {
        scale: scaleTo,
        opacity: 0,
        duration: halfDur,
        ease: 'power2.in',
      })
      .call(() => {
        gsap.set(container, { scale: config.direction === 'forward' ? 1.15 : (config.scaleFrom || 0.85) });
        callbacks.onMidpoint?.();
      })
      .to(container, {
        scale: 1,
        opacity: 1,
        duration: halfDur,
        ease: 'power2.out',
      });
  }

  private _executeMorph(
    container: HTMLElement,
    config: TransitionConfig,
    callbacks: TransitionCallbacks,
    resolve: () => void
  ): void {
    // Morph is the simplest — we just notify the midpoint and let
    // the renderer handle the data transition internally
    callbacks.onMidpoint?.();

    // Subtle pulse animation to indicate data change
    this.activeTimeline = gsap.timeline({
      onComplete: () => {
        this.isTransitioning = false;
        callbacks.onComplete?.();
        resolve();
      },
    });

    // Select all child elements for staggered animation
    const children = container.querySelectorAll('[data-type], .cell, .node, .event, .chart-bar, [data-type="tree-node"]');
    if (children.length > 0) {
      this.activeTimeline.fromTo(
        Array.from(children),
        { opacity: 0.6, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: config.duration,
          stagger: config.stagger || 0.03,
          ease: 'back.out(1.2)',
        }
      );
    } else {
      this.activeTimeline.fromTo(
        container,
        { opacity: 0.7 },
        { opacity: 1, duration: config.duration, ease: config.ease }
      );
    }
  }

  private _executeWipe(
    container: HTMLElement,
    config: TransitionConfig,
    callbacks: TransitionCallbacks,
    resolve: () => void
  ): void {
    const halfDur = config.duration / 2;

    // Create a wipe overlay
    const wipe = document.createElement('div');
    wipe.style.cssText = `
      position: absolute; inset: 0; z-index: 9999;
      background: var(--bg-primary, #0b0b0a);
      transform: scaleX(0); transform-origin: left;
      pointer-events: none;
    `;
    container.style.position = 'relative';
    container.appendChild(wipe);

    this.activeTimeline = gsap.timeline({
      onComplete: () => {
        wipe.remove();
        this.isTransitioning = false;
        callbacks.onComplete?.();
        resolve();
      },
    });

    this.activeTimeline
      .to(wipe, {
        scaleX: 1,
        duration: halfDur,
        ease: 'power3.inOut',
      })
      .call(() => {
        callbacks.onMidpoint?.();
      })
      .to(wipe, {
        scaleX: 0,
        transformOrigin: 'right',
        duration: halfDur,
        ease: 'power3.inOut',
        delay: 0.05,
      });
  }

  // ── Config Resolution ─────────────────────────────────────────────────

  private _resolveConfig(input: TransitionType | Partial<TransitionConfig>): TransitionConfig {
    if (typeof input === 'string') {
      return {
        ...DEFAULT_CONFIGS[input] || DEFAULT_CONFIGS.crossfade,
        direction: 'forward',
      };
    }

    const base = DEFAULT_CONFIGS[input.type || 'crossfade'] || DEFAULT_CONFIGS.crossfade;
    return {
      ...base,
      direction: 'forward',
      ...input,
    };
  }
}
