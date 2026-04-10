/**
 * UniversalAnimationEngine v2 — Intelligent Animation Controller
 *
 * Everything the engine needs in one place:
 *
 *   Layer 1: Base Motion      (spring physics entry, stagger, easing)
 *   Layer 2: Micro-Interactions (per-object behavioral simulation)
 *   Layer 3: Cinematic Effects  (depth, glow, focus/attention control)
 *
 *  NEW in v2:
 *   - BehaviorIntelligence: per-object behavioral simulation (no static objects)
 *   - NarrativeSync: reads step narration to extract action type → behavioral hints
 *   - AttentionClassifier: ranks objects 1-3 dominant, rest fade
 *   - CameraDirector integration: directs camera per step
 *   - Concept analyzer: maps topic to visual type (FLOW / STRUCTURE / NATURAL / DATA / ABSTRACT)
 *
 * @module UniversalAnimationEngine
 */

import {
  resolveTransition,
  resolveMicroAnimation,
  calculateStaggerDelay,
  getDefaultEntrance,
  getDefaultMicroAnimation,
  SPRING_STANDARD,
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  EASE_CINEMATIC,
  ENTRANCE,
  EMPHASIS,
  SUBJECT_PRESETS,
} from './animationPresets.js';


// ─── Concept Categories ───────────────────────────────────────────────────────

export const CONCEPT_TYPES = {
  FLOW:      'flow',       // step-by-step process
  STRUCTURE: 'structure',  // diagram or object
  NETWORK:   'network',    // interconnected parts
  DATA:      'data',       // blocks, arrays, logic
  NATURAL:   'natural',    // breathing, waves, orbit
  ABSTRACT:  'abstract',   // metaphor-based visuals
};

// ─── Domain → Concept type ───────────────────────────────────────────────────

const DOMAIN_CONCEPT_MAP = {
  dsa:                  CONCEPT_TYPES.DATA,
  mathematics:          CONCEPT_TYPES.ABSTRACT,
  physics:              CONCEPT_TYPES.NATURAL,
  chemistry:            CONCEPT_TYPES.STRUCTURE,
  biology:              CONCEPT_TYPES.NATURAL,
  medicine:             CONCEPT_TYPES.STRUCTURE,
  computer_science:     CONCEPT_TYPES.FLOW,
  engineering:          CONCEPT_TYPES.STRUCTURE,
  business:             CONCEPT_TYPES.FLOW,
  law:                  CONCEPT_TYPES.FLOW,
  history:              CONCEPT_TYPES.FLOW,
  geography:            CONCEPT_TYPES.STRUCTURE,
  psychology:           CONCEPT_TYPES.ABSTRACT,
  arts:                 CONCEPT_TYPES.ABSTRACT,
  economics:            CONCEPT_TYPES.DATA,
  data_science:         CONCEPT_TYPES.DATA,
  cybersecurity:        CONCEPT_TYPES.FLOW,
  linguistics:          CONCEPT_TYPES.STRUCTURE,
  philosophy:           CONCEPT_TYPES.ABSTRACT,
  environmental_science:CONCEPT_TYPES.NATURAL,
  music:                CONCEPT_TYPES.ABSTRACT,
  space_astronomy:      CONCEPT_TYPES.NATURAL,
  aviation_maritime:    CONCEPT_TYPES.STRUCTURE,
  general:              CONCEPT_TYPES.FLOW,
};

// ─── Glow color map ───────────────────────────────────────────────────────────

const GLOW_MAP = {
  blue:   '#3b82f6', red:    '#ef4444', green:  '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', cyan:   '#06b6d4', teal:   '#14b8a6',
  pink:   '#ec4899', gold:   '#f59e0b', gray:   '#94a3b8', white:  '#e2e8f0',
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class UniversalAnimationEngine {
  constructor() {
    /** @type {string} */
    this.domain = 'general';
    /** @type {string} */
    this.conceptType = CONCEPT_TYPES.FLOW;
    /** @type {number} */
    this.speed = 1;
    /** @type {boolean} */
    this.isPlaying = false;
    /** @type {boolean} */
    this.isPaused = false;
    /** @type {number|null} */
    this._autoTimer = null;
  }

  // ─── Configuration ─────────────────────────────────────────────────────

  setDomain(domain) {
    this.domain = domain || 'general';
    this.conceptType = DOMAIN_CONCEPT_MAP[this.domain] || CONCEPT_TYPES.FLOW;
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  // ─── Phase 3: AI-Directed Dispatch ─────────────────────────────────────

  /**
   * Get the complete animation configuration for a shape.
   * v3: AI-Faithful rendering. Priorities AI-defined 'animation' blocks and 'motionOverrides'.
   *
   * @param {Object} obj - The base shape object
   * @param {Object} options
   * @param {boolean} options.isNew
   * @param {boolean} options.isHighlighted
   * @param {boolean} options.isFaded
   * @param {string}  options.transition
   * @param {number}  options.staggerIndex
   * @param {Object}  options.currentStep - The full step object for overrides
   * @returns {Object}
   */
  getFullConfig(obj, options = {}) {
    const {
      isNew = false,
      isHighlighted = false,
      isFaded = false,
      transition = 'springIn',
      staggerIndex = 0,
      currentStep = null,
    } = options;

    // 1. Resolve Motion Overrides (Step-level AI control)
    const override = currentStep?.motionOverrides?.find(m => m.id === obj.id);
    const targetX = override?.moveTo?.x ?? obj.x;
    const targetY = override?.moveTo?.y ?? obj.y;
    const targetScale = override?.scaleTo ?? 1;
    const targetColor = override?.colorTo ?? obj.color;

    // 2. Resolve Animation Block (Object-level AI control)
    const aiAnim = obj.animation || {};
    const entryType = aiAnim.entry?.type || transition || 'fadeIn';
    const entryDuration = (aiAnim.entry?.duration || 600) / 1000; // to seconds
    const entryEasing = aiAnim.entry?.easing || 'spring';

    // 3. Layer 1: Entrance (Framer Motion 'initial' and 'animate')
    const preset = resolveTransition(isNew ? entryType : 'none');
    const delay = calculateStaggerDelay(staggerIndex, { isHighlighted, isNew, domain: this.domain });
    
    // Anchor 'initial' to the target coordinates so objects don't fly from (0,0)
    const initialCoords = isNew ? {
      x: targetX + (preset.hidden?.x ?? 0),
      y: targetY + (preset.hidden?.y ?? 0),
      scale: preset.hidden?.scale ?? 1,
      opacity: preset.hidden?.opacity ?? 0
    } : false;

    const entryTransition = {
      ...(entryEasing === 'spring' ? SPRING_STANDARD : { ease: entryEasing }),
      duration: entryDuration / this.speed,
      delay: delay / this.speed,
    };

    // 4. Layer 2: Idle & Highlights
    const idleType = aiAnim.idle?.type || 'none';
    const highlightType = aiAnim.highlight?.type || (isHighlighted ? 'glow' : 'none');
    
    let microAnim = null;
    if (idleType !== 'none') {
      microAnim = resolveMicroAnimation(idleType, { 
        intensity: aiAnim.idle?.intensity || 'low',
        period: (aiAnim.idle?.period || 2000) / 1000 
      });
    }

    // 5. Layer 3: Cinematic & Overrides
    const targetOpacity = isFaded ? 0.35 : 1;
    const filter = (isHighlighted || highlightType !== 'none')
      ? `drop-shadow(0 0 ${isNew ? '0px' : '8px'} ${targetColor}90)`
      : 'none';

    return {
      initial: initialCoords,
      animate: {
        x: targetX,
        y: targetY,
        scale: targetScale,
        opacity: targetOpacity,
        fill: targetColor,
        color: targetColor,
      },
      transition: {
        ...entryTransition,
        // If movement override exists, use its duration
        ...(override?.duration ? { duration: override.duration / 1000 / this.speed } : {})
      },
      style: {
        filter,
        transformOrigin: 'center',
        transformBox: 'fill-box'
      },
      microAnimation: microAnim,
      exit: {
        opacity: 0,
        scale: 0.5,
        transition: { duration: (aiAnim.exit?.duration || 400) / 1000 / this.speed }
      }
    };
  }

  // ─── Subject-Specific Helpers ──────────────────────────────────────────

  getArrayCellAnimation(operation) {
    const presets = SUBJECT_PRESETS.dsa?.arrayCell || {};
    return presets[operation] || { animate: {}, transition: {} };
  }

  getGlowHalo(radius, color = '#f59e0b') {
    const preset = EMPHASIS.haloRing;
    return typeof preset === 'function' ? preset(radius, color) : {};
  }

  // ─── Concept understanding ─────────────────────────────────────────────

  /**
   * Analyze a topic and return its concept type and visual plan.
   * @param {string} topic
   * @returns {{ conceptType: string, visualMapping: string, animationStyle: string }}
   */
  analyzeConcept(topic) {
    const t = (topic || '').toLowerCase();

    // Process detection
    if (/sort|search|traversal|algorithm|process|flow|step|phase/.test(t))
      return { conceptType: CONCEPT_TYPES.FLOW, visualMapping: 'sequential', animationStyle: 'cascade' };

    // Structure detection
    if (/diagram|structure|anatomy|architecture|layout|tree|hierarchy/.test(t))
      return { conceptType: CONCEPT_TYPES.STRUCTURE, visualMapping: 'spatial', animationStyle: 'springIn' };

    // Natural / physical process
    if (/wave|oscillat|vibrat|orbit|gravity|photosynthesis|heartbeat|breath/.test(t))
      return { conceptType: CONCEPT_TYPES.NATURAL, visualMapping: 'simulation', animationStyle: 'waveExpand' };

    // Data / logic
    if (/array|hash|graph|network|data|matrix|table/.test(t))
      return { conceptType: CONCEPT_TYPES.DATA, visualMapping: 'grid', animationStyle: 'springIn' };

    // Abstract
    if (/theory|concept|idea|philosophy|abstract|model/.test(t))
      return { conceptType: CONCEPT_TYPES.ABSTRACT, visualMapping: 'metaphor', animationStyle: 'fadeIn' };

    return { conceptType: this.conceptType, visualMapping: 'general', animationStyle: 'springIn' };
  }

  // ─── Auto-Play Controller ──────────────────────────────────────────────

  startAutoPlay(steps, startIndex, onStep, onComplete) {
    this.isPlaying = true;
    this.isPaused = false;
    this._autoPlayStep(steps, startIndex, onStep, onComplete);
  }

  _autoPlayStep(steps, index, onStep, onComplete) {
    if (!this.isPlaying || this.isPaused || index >= steps.length) {
      if (index >= steps.length) { this.isPlaying = false; onComplete?.(); }
      return;
    }
    const step = steps[index];
    const duration = (step.durationMs || step.duration || 3000) / this.speed;
    onStep?.(index);
    this._autoTimer = setTimeout(() => {
      this._autoPlayStep(steps, index + 1, onStep, onComplete);
    }, duration);
  }

  pause() {
    this.isPaused = true;
    this.isPlaying = false;
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  }

  resume(steps, currentIndex, onStep, onComplete) {
    this.isPaused = false;
    this.isPlaying = true;
    this._autoPlayStep(steps, currentIndex + 1, onStep, onComplete);
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  }

  destroy() { this.stop(); }

  // ─── Internals ─────────────────────────────────────────────────────────

  _resolveGlowColor(obj) {
    const color = (obj.color || obj.fill || obj.stroke || 'blue').toLowerCase();
    return GLOW_MAP[color] || color;
  }
}

// Singleton export
const engine = new UniversalAnimationEngine();
export default engine;
