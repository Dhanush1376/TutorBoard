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

import {
  resolveBehavior,
  getIdleBehavior,
  analyzeNarration,
  classifyAttention,
} from './BehaviorIntelligence.js';

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

  // ─── v2: Narrative Synchronization ─────────────────────────────────────

  /**
   * Analyze the step narration and update internal hints.
   * Call this ONCE per step before calling getFullConfig for any object.
   *
   * @param {string} narration - Step's narration text
   * @param {Object[]} objects - All visible objects this step
   * @param {Set<string>} highlightIds
   * @param {Set<string>} newIds
   */
  syncNarration(narration, objects = [], highlightIds = new Set(), newIds = new Set()) {
    // Parse narration for behavioral hints
    const hints = analyzeNarration(narration, this.domain);

    // Classify attention (dominant / supporting / background)
    const attention = classifyAttention(
      objects,
      highlightIds,
      newIds,
      hints.actionType,
    );

    return { narrativeHints: hints, attention };
  }

  /**
   * Get the narrative-driven transition type for the current step.
   * Overrides step-level transition when narration analysis yields a stronger signal.
   * @param {string} stepTransition - The step's declared transition
   * @returns {string}
   */
  resolveStepTransition(stepTransition, narrativeHints = null) {
    const hints = narrativeHints || { actionType: null, transitionHint: 'springIn' };
    if (hints.actionType && hints.actionType !== 'intro') {
      return hints.transitionHint;
    }
    return stepTransition || getDefaultEntrance(this.domain);
  }

  // ─── v2: Attention & Focus ─────────────────────────────────────────────

  /**
   * Determine the attention role of an object.
   * @param {string} id
   * @returns {'dominant'|'supporting'|'background'|'neutral'}
   */
  /**
   * Determine the attention role of an object.
   * @param {string} id
   * @param {Object} [attentionOverride]
   * @returns {'dominant'|'supporting'|'background'|'neutral'}
   */
  getAttentionRole(id, attentionOverride = null) {
    if (!attentionOverride) return 'neutral';
    if (attentionOverride.dominant?.includes(id))   return 'dominant';
    if (attentionOverride.supporting?.includes(id))  return 'supporting';
    if (attentionOverride.background?.includes(id))  return 'background';
    return 'neutral';
  }

  /**
   * Are we in a step where attention management is active?
   * @param {Object} [attentionOverride]
   */
  getIsAttentionActive(attentionOverride = null) {
    return attentionOverride?.dominant?.length > 0;
  }

  // ─── Layer 1: Base Motion ──────────────────────────────────────────────

  /**
   * Get entrance animation config for an object.
   * Now narrative-aware: uses resolved transition from narration.
   */
  getEntrance(obj, { isNew = false, transition = 'springIn', staggerIndex = 0, isHighlighted = false, narrativeHints = null } = {}) {
    if (!isNew) {
      return { initial: false, animate: {}, transition: {} };
    }

    // Narrative sync: override transition if action hint is strong
    const hints = narrativeHints || { actionType: null, transitionHint: 'springIn' };
    const resolvedTransition = (hints.actionType && hints.actionType !== 'intro')
      ? hints.transitionHint
      : (transition || getDefaultEntrance(this.domain));

    const preset = resolveTransition(resolvedTransition);
    const delay = calculateStaggerDelay(staggerIndex, {
      isHighlighted,
      isNew,
      domain: this.domain,
    });

    const adjustedTransition = {
      ...preset.transition,
      delay: delay / this.speed,
    };
    if (adjustedTransition.duration) {
      adjustedTransition.duration = adjustedTransition.duration / this.speed;
    }

    return {
      initial: preset.hidden,
      animate: preset.visible,
      transition: adjustedTransition,
    };
  }

  // ─── Layer 2: Micro-Interactions (Behavioral Simulation) ──────────────

  /**
   * Get the behavioral animation for an object.
   * v2: Uses BehaviorIntelligence catalog instead of simple micro presets.
   *
   * @param {Object} obj
   * @returns {{ animate: Object, transition: Object } | null}
   */
  getMicroAnimation(obj, narrativeHints = null, attentionOverride = null) {
    // 1. Check explicit microAnimation field
    if (obj.microAnimation) {
      return resolveMicroAnimation(obj.microAnimation);
    }

    // 2. Narrative Sync: If an action is detected in narration, auto-apply behavior
    const attentionRole = this.getAttentionRole(obj.id, attentionOverride);
    const hints = narrativeHints || { actionType: null };

    if (hints.actionType && (attentionRole === 'dominant' || obj.isHighlighted)) {
      const behavior = resolveBehavior({ ...obj, behaviorState: hints.actionType }, this.domain);
      if (behavior) return behavior;
    }

    // 3. Check explicit behaviorRole + behaviorState (full BehaviorIntelligence path)
    if (obj.behaviorRole || obj.behaviorState) {
      const behavior = resolveBehavior(obj, this.domain);
      if (behavior) return behavior;
    }

    // 4. Auto-infer idle behavior from BehaviorIntelligence
    const idleBehavior = getIdleBehavior(obj, this.domain);
    if (idleBehavior) return idleBehavior;

    // 5. Legacy micro presets fallback
    const shape = (obj.shape || obj.type || '').toLowerCase();
    const autoAnim = getDefaultMicroAnimation(shape, this.domain);
    if (autoAnim) return resolveMicroAnimation(autoAnim);

    return null;
  }

  /**
   * Get highlight effect — v2: intensity scales with narrative emphasis.
   */
  getHighlightEffect(obj, isHighlighted, narrativeHints = null) {
    if (!isHighlighted) return null;

    const hints = narrativeHints || { emphasis: 'normal' };
    const emphasis = hints.emphasis || 'normal';

    // Scale highlight intensity with narrative emphasis
    const scales = {
      subtle:   [1, 1.04, 1],
      normal:   [1, 1.08, 1],
      dramatic: [1, 1.14, 1],
    };
    const scale = scales[emphasis] || scales.normal;
    const duration = emphasis === 'dramatic' ? 0.8 : 0.6;

    return {
      animate: { scale },
      transition: { duration: duration / this.speed, repeat: 1, ease: 'easeInOut' },
    };
  }

  // ─── Layer 3: Cinematic Effects ────────────────────────────────────────

  /**
   * Get depth/glow/fade style for an object.
   * v2: Attention-aware — dominant objects glow more, background objects fade.
   */
  getCinematicStyle(obj, { isHighlighted = false, isFaded = false, narrativeHints = null, attentionOverride = null } = {}) {
    const attentionRole = this.getAttentionRole(obj.id, attentionOverride);
    const hints = narrativeHints || { emphasis: 'normal' };
    const emphasis = hints.emphasis || 'normal';

    // Explicit fade request
    if (isFaded) {
      return { filter: 'saturate(0.4) brightness(0.65)', opacity: 0.32 };
    }

    // Attention-system fade: background objects recede
    if (this.getIsAttentionActive(attentionOverride) && attentionRole === 'background') {
      return { filter: 'saturate(0.5) brightness(0.7)', opacity: 0.32 };
    }

    // Dominant / highlighted glow
    if (isHighlighted || attentionRole === 'dominant') {
      const color = this._resolveGlowColor(obj);
      const glowRadius = emphasis === 'dramatic' ? '14px' : '8px';
      const shadowDepth = emphasis === 'dramatic' ? '16px' : '10px';
      return {
        filter: `drop-shadow(0 0 ${glowRadius} ${color}90) drop-shadow(0 4px ${shadowDepth} rgba(0,0,0,0.45))`,
        opacity: 1,
      };
    }

    // Depth based on depth field
    const depth = obj.depth || (attentionRole === 'supporting' ? 2 : 1);
    const shadows = [
      'none',
      'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
      'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
      'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
      'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
      'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
    ];

    return {
      filter: shadows[Math.min(depth, 5)] || shadows[2],
      opacity: this.getIsAttentionActive(attentionOverride) && attentionRole === 'supporting' ? 0.75 : 1,
    };
  }

  // ─── Composite: Full Config ────────────────────────────────────────────

  /**
   * Get the complete animation configuration for a shape.
   * Combines all three layers — now fully narrative-aware.
   *
   * @param {Object} obj
   * @param {Object} options
   * @param {boolean} options.isNew
   * @param {boolean} options.isHighlighted
   * @param {boolean} options.isFaded
   * @param {string}  options.transition
   * @param {number}  options.staggerIndex
   * @returns {{
   *   initial: Object,
   *   animate: Object,
   *   transition: Object,
   *   style: Object,
   *   microAnimation: { animate: Object, transition: Object } | null,
   *   attentionRole: 'dominant'|'supporting'|'background'|'neutral'
   * }}
   */
  getFullConfig(obj, options = {}) {
    const {
      isNew       = false,
      isHighlighted = false,
      isFaded     = false,
      transition  = 'springIn',
      staggerIndex = 0,
      narrativeHints = null,
      attentionOverride = null,
    } = options;

    // Layer 1: Base Entrance
    const entrance = this.getEntrance(obj, { isNew, transition, staggerIndex, isHighlighted, narrativeHints });

    // Layer 2: Behavioral / Action Overlay
    const micro    = this.getMicroAnimation(obj, narrativeHints, attentionOverride);
    const highlight = this.getHighlightEffect(obj, isHighlighted, narrativeHints);

    // Layer 3: Cinematic Look
    const cinematic = this.getCinematicStyle(obj, { isHighlighted, isFaded, narrativeHints, attentionOverride });

    // Merge only non-layout props into the root animation block
    // CinematicShapes handle their own x,y,cx,cy via SVG attributes to avoid double translation
    let mergedAnimate = { ...entrance.animate };
    if (highlight && isHighlighted && !isNew) {
      mergedAnimate = { ...mergedAnimate, ...highlight.animate };
    }

    return {
      initial: entrance.initial,
      animate: mergedAnimate,
      exit: {
        opacity: 0,
        scale: 0.7,
        filter: 'blur(8px)',
        transition: { duration: 0.38 / this.speed, ease: 'easeIn' }
      },
      transition: (isHighlighted && !isNew && highlight)
        ? highlight.transition
        : entrance.transition,
      style: {
        filter: cinematic.filter,
        opacity: cinematic.opacity,
      },
      microAnimation: micro,
      attentionRole: this.getAttentionRole(obj.id, attentionOverride),
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
