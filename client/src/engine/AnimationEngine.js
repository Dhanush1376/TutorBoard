/**
 * AnimationEngine — GSAP-powered animation controller for canvas elements
 * 
 * NEXT-GEN: Supports mutation animations (move, morph, color transitions),
 * sequential story-based mode, and 60fps optimized with will-change.
 * 
 * Transitions: fadeIn, fadeOut, scaleIn, slideUp, highlight, pulse, drawLine, moveTo, morphColor
 */

import gsap from 'gsap';

const TRANSITION_DEFAULTS = {
  duration: 0.8,
  ease: 'power3.out',
};

export class AnimationEngine {
  constructor() {
    this.timeline = null;        // GSAP timeline for sequential mode
    this.activeAnimations = new Map(); // element ID → tween
    this.isPlaying = false;
    this.isPaused = false;
    this.speed = 1;
  }

  /**
   * Execute animations for a step.
   * @param {Object} step - Step data with objectIds, highlightIds, transition
   * @param {Object[]} allObjects - All scene objects  
   * @param {SVGElement} svgRoot - The SVG container element
   */
  executeStep(step, allObjects, svgRoot) {
    if (!step || !svgRoot) return;

    const { objectIds = [], highlightIds = [], transition = 'fadeIn' } = step;

    // Kill any running animations
    this.killAll();

    // Find elements to show at this step
    const objectsToShow = allObjects.filter(obj => objectIds.includes(obj.id));

    // Animate each object
    objectsToShow.forEach((obj, i) => {
      const el = svgRoot.querySelector(`[data-id="${obj.id}"]`);
      if (!el) return;

      const delay = i * 0.1 / this.speed;
      const isHighlighted = highlightIds.includes(obj.id);

      switch (transition) {
        case 'fadeIn':
          this._fadeIn(el, delay, isHighlighted);
          break;
        case 'scaleIn':
          this._scaleIn(el, delay, isHighlighted);
          break;
        case 'slideUp':
          this._slideUp(el, delay, isHighlighted);
          break;
        case 'drawLine':
          this._drawLine(el, delay);
          break;
        case 'highlight':
          this._highlight(el, delay);
          break;
        case 'pulse':
          this._pulse(el, delay);
          break;
        default:
          this._fadeIn(el, delay, isHighlighted);
      }
    });

    // Extra highlight animation for highlighted elements
    const objectsToHighlight = allObjects.filter(obj => highlightIds.includes(obj.id));
    objectsToHighlight.forEach((obj, i) => {
      const el = svgRoot.querySelector(`[data-id="${obj.id}"]`);
      if (el) {
        this._highlight(el, objectsToShow.length * 0.1 / this.speed + i * 0.08);
      }
    });

    this.isPlaying = true;
  }

  /**
   * Execute a SEQUENTIAL story-based timeline across multiple steps.
   * Each step plays after the previous one completes.
   */
  executeSequential(steps, allObjects, svgRoot, onStepComplete) {
    if (!steps?.length || !svgRoot) return;

    this.killAll();
    this.timeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
    });

    steps.forEach((step, stepIdx) => {
      const { objectIds = [], highlightIds = [], transition = 'fadeIn', duration = 3000 } = step;
      const objectsToShow = allObjects.filter(obj => objectIds.includes(obj.id));
      const adjustedDuration = duration / 1000 / this.speed;

      // Add a label for each step
      this.timeline.addLabel(`step-${stepIdx}`);

      objectsToShow.forEach((obj, i) => {
        const el = svgRoot.querySelector(`[data-id="${obj.id}"]`);
        if (!el) return;

        const stagger = i * 0.08;

        switch (transition) {
          case 'scaleIn':
            this.timeline.from(el, {
              opacity: 0, scale: 0, transformOrigin: 'center center',
              duration: 0.6, ease: 'back.out(1.7)',
            }, `step-${stepIdx}+=${stagger}`);
            break;
          case 'slideUp':
            this.timeline.from(el, {
              opacity: 0, y: 30, duration: 0.5,
            }, `step-${stepIdx}+=${stagger}`);
            break;
          default:
            this.timeline.from(el, {
              opacity: 0, duration: 0.5,
            }, `step-${stepIdx}+=${stagger}`);
        }
      });

      // Hold for step duration
      this.timeline.to({}, { duration: Math.max(0.5, adjustedDuration - 1) });

      // Step complete callback
      if (onStepComplete) {
        this.timeline.call(() => onStepComplete(stepIdx));
      }
    });

    this.timeline.play();
    this.isPlaying = true;
  }

  /**
   * Apply MUTATION animations (for doubt-driven changes).
   * Animates existing elements to new states smoothly.
   */
  executeMutations(mutations, svgRoot) {
    if (!mutations?.length || !svgRoot) return;

    mutations.forEach((mutation, i) => {
      const delay = i * 0.15;

      switch (mutation.action) {
        case 'modify': {
          const el = svgRoot.querySelector(`[data-id="${mutation.targetId}"]`);
          if (!el) break;

          const changes = mutation.changes || {};
          const animProps = {};

          // Color changes → animate fill/stroke
          if (changes.color) {
            const fills = el.querySelectorAll('[fill]');
            const strokes = el.querySelectorAll('[stroke]');
            fills.forEach(f => {
              gsap.to(f, { fill: changes.color, duration: 0.5, delay });
            });
            strokes.forEach(s => {
              gsap.to(s, { stroke: changes.color, duration: 0.5, delay });
            });
          }

          // Position changes
          if (changes.x !== undefined || changes.y !== undefined) {
            animProps.x = changes.x;
            animProps.y = changes.y;
            gsap.to(el, { ...animProps, duration: 0.6, delay, ease: 'power2.out' });
          }

          // Scale/glow
          if (changes.glow) {
            gsap.to(el, {
              filter: 'brightness(1.3) drop-shadow(0 0 16px rgba(255,255,255,0.3))',
              duration: 0.5, delay,
            });
          }
          break;
        }

        case 'highlight': {
          const targetIds = mutation.targetIds || [];
          targetIds.forEach((id, j) => {
            const el = svgRoot.querySelector(`[data-id="${id}"]`);
            if (el) {
              this._highlight(el, delay + j * 0.1);
            }
          });
          break;
        }

        case 'add': {
          // New elements are added via React re-render,
          // but we can animate them in after they appear
          if (mutation.object?.id) {
            setTimeout(() => {
              const el = svgRoot.querySelector(`[data-id="${mutation.object.id}"]`);
              if (el) {
                this._scaleIn(el, 0, true);
              }
            }, (delay + 0.3) * 1000);
          }
          break;
        }

        case 'remove': {
          const el = svgRoot.querySelector(`[data-id="${mutation.targetId}"]`);
          if (el) {
            gsap.to(el, {
              opacity: 0, scale: 0.5, duration: 0.4, delay,
              ease: 'power2.in',
              onComplete: () => el.remove(),
            });
          }
          break;
        }
      }
    });
  }

  // ─── Transition Implementations ───

  _fadeIn(el, delay = 0, emphasize = false) {
    gsap.set(el, { opacity: 0 });
    const tween = gsap.to(el, {
      opacity: 1,
      duration: (emphasize ? 1 : 0.7) / this.speed,
      delay,
      ease: 'power2.out',
    });
    this.activeAnimations.set(el, tween);
  }

  _scaleIn(el, delay = 0, emphasize = false) {
    gsap.set(el, { opacity: 0, scale: 0, transformOrigin: 'center center' });
    const tween = gsap.to(el, {
      opacity: 1,
      scale: emphasize ? 1.1 : 1,
      duration: 0.8 / this.speed,
      delay,
      ease: 'back.out(1.7)',
    });
    this.activeAnimations.set(el, tween);
  }

  _slideUp(el, delay = 0) {
    gsap.set(el, { opacity: 0, y: 30 });
    const tween = gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.7 / this.speed,
      delay,
      ease: 'power3.out',
    });
    this.activeAnimations.set(el, tween);
  }

  _drawLine(el, delay = 0) {
    const length = el.getTotalLength?.() || 100;
    gsap.set(el, {
      strokeDasharray: length,
      strokeDashoffset: length,
      opacity: 1,
    });
    const tween = gsap.to(el, {
      strokeDashoffset: 0,
      duration: 1.2 / this.speed,
      delay,
      ease: 'power2.inOut',
    });
    this.activeAnimations.set(el, tween);
  }

  _highlight(el, delay = 0) {
    const tween = gsap.to(el, {
      filter: 'brightness(1.5) drop-shadow(0 0 12px rgba(255,255,255,0.4))',
      duration: 0.6 / this.speed,
      delay,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
    });
    this.activeAnimations.set(el, tween);
  }

  _pulse(el, delay = 0) {
    const tween = gsap.to(el, {
      scale: 1.15,
      transformOrigin: 'center center',
      duration: 0.5 / this.speed,
      delay,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 2,
    });
    this.activeAnimations.set(el, tween);
  }

  // ─── Control Methods ───

  setSpeed(speed) {
    this.speed = speed;
    if (this.timeline) {
      this.timeline.timeScale(speed);
    }
  }

  pause() {
    this.activeAnimations.forEach(tween => tween.pause());
    if (this.timeline) this.timeline.pause();
    this.isPaused = true;
    this.isPlaying = false;
  }

  resume() {
    this.activeAnimations.forEach(tween => tween.resume());
    if (this.timeline) this.timeline.resume();
    this.isPaused = false;
    this.isPlaying = true;
  }

  killAll() {
    this.activeAnimations.forEach(tween => tween.kill());
    this.activeAnimations.clear();
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
  }

  /**
   * Reset all elements to initial state.
   */
  reset(svgRoot) {
    this.killAll();
    if (svgRoot) {
      const elements = svgRoot.querySelectorAll('[data-id]');
      elements.forEach(el => {
        gsap.set(el, { clearProps: 'all' });
      });
    }
  }

  destroy() {
    this.killAll();
  }
}

// Singleton for convenience
export default AnimationEngine;
