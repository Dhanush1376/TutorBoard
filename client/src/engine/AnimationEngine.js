/**
 * AnimationEngine — GSAP-powered animation controller for canvas elements
 * 
 * Manages step-based animations on SVG elements.
 * Supports transitions: fadeIn, fadeOut, scaleIn, slideUp, highlight, pulse, drawLine, moveTo
 */

import gsap from 'gsap';

const TRANSITION_DEFAULTS = {
  duration: 0.8,
  ease: 'power3.out',
};

export class AnimationEngine {
  constructor() {
    this.timeline = null;
    this.activeAnimations = new Map(); // element ID → tween
    this.isPlaying = false;
    this.isPaused = false;
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
    const objectsToHighlight = allObjects.filter(obj => highlightIds.includes(obj.id));

    // Animate each object
    objectsToShow.forEach((obj, i) => {
      const el = svgRoot.querySelector(`[data-id="${obj.id}"]`);
      if (!el) return;

      const delay = i * 0.12;
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
    objectsToHighlight.forEach((obj, i) => {
      const el = svgRoot.querySelector(`[data-id="${obj.id}"]`);
      if (el) {
        this._highlight(el, objectsToShow.length * 0.12 + i * 0.1);
      }
    });

    this.isPlaying = true;
  }

  // ─── Transition Implementations ───

  _fadeIn(el, delay = 0, emphasize = false) {
    gsap.set(el, { opacity: 0 });
    const tween = gsap.to(el, {
      opacity: 1,
      duration: emphasize ? 1 : 0.7,
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
      duration: 0.8,
      delay,
      ease: 'back.out(1.7)',
    });
    this.activeAnimations.set(el, tween);
  }

  _slideUp(el, delay = 0, emphasize = false) {
    gsap.set(el, { opacity: 0, y: 30 });
    const tween = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      delay,
      ease: 'power3.out',
    });
    this.activeAnimations.set(el, tween);
  }

  _drawLine(el, delay = 0) {
    // For line/path elements, animate stroke-dashoffset
    const length = el.getTotalLength?.() || 100;
    gsap.set(el, {
      strokeDasharray: length,
      strokeDashoffset: length,
      opacity: 1,
    });
    const tween = gsap.to(el, {
      strokeDashoffset: 0,
      duration: 1.2,
      delay,
      ease: 'power2.inOut',
    });
    this.activeAnimations.set(el, tween);
  }

  _highlight(el, delay = 0) {
    const tween = gsap.to(el, {
      filter: 'brightness(1.5) drop-shadow(0 0 12px rgba(255,255,255,0.4))',
      duration: 0.6,
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
      duration: 0.5,
      delay,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 2,
    });
    this.activeAnimations.set(el, tween);
  }

  // ─── Control Methods ───

  pause() {
    this.activeAnimations.forEach(tween => tween.pause());
    this.isPaused = true;
    this.isPlaying = false;
  }

  resume() {
    this.activeAnimations.forEach(tween => tween.resume());
    this.isPaused = false;
    this.isPlaying = true;
  }

  killAll() {
    this.activeAnimations.forEach(tween => tween.kill());
    this.activeAnimations.clear();
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

// Singleton for convenience, or create instances per canvas
export default AnimationEngine;
