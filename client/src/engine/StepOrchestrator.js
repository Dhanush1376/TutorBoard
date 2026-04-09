/**
 * StepOrchestrator — Intelligent Step Transition Controller
 * 
 * Manages cinematic transitions between teaching steps:
 * - Progressive complexity tracking
 * - Stagger calculation per step
 * - Focus management (auto-pan suggestion)
 * - Subject-aware transition rhythms
 * 
 * @module StepOrchestrator
 */

import { calculateStaggerDelay } from './animationPresets.js';

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class StepOrchestrator {
  constructor() {
    /** @type {string} Current domain */
    this.domain = 'general';
    /** @type {number} Speed multiplier */
    this.speed = 1;
    /** @type {Set<string>} IDs that have already been introduced */
    this.seenIds = new Set();
    /** @type {number} Current step index */
    this.currentStepIndex = 0;
    /** @type {Set<string>} Internal cache of all objects seen across a timeline */
    this._history = new Set();
    /** @type {string|null} Key of the active session to prevent state leakage */
    this.currentSessionKey = null;
  }

  /**
   * Configure for a new session.
   * @param {string} domain 
   */
  setDomain(domain) {
    this.domain = domain || 'general';
  }

  /**
   * Set speed multiplier.
   * @param {number} speed 
   */
  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  /**
   * Reset for a new session.
   */
  reset() {
    this.seenIds.clear();
    this._history.clear();
    this.currentStepIndex = 0;
    this.currentSessionKey = null;
  }

  /**
   * Sync the 'seen' state for a specific step.
   * Call this from an effect to avoid render-cycle mutations.
   * @param {Object[]} visibleObjects 
   * @param {string} sessionKey
   */
  syncSeen(visibleObjects, sessionKey) {
    if (!visibleObjects) return;
    
    // Safety: ignore sync calls from previous sessions (Prevents race conditions in effects)
    if (sessionKey && sessionKey !== this.currentSessionKey) {
      console.warn(`StepOrchestrator: Ignoring syncSeen for stale session "${sessionKey}"`);
      return;
    }

    visibleObjects.forEach(obj => {
      if (obj?.id) this.seenIds.add(obj.id);
    });
  }

  // ─── Step Analysis ─────────────────────────────────────────────────────

  /**
   * Analyze a step and produce rendering instructions.
   * 
   * @param {Object} step - Step from timeline
   * @param {Object[]} allObjects - All scene objects
   * @param {number} stepIndex - Current step index
   * @param {string|null} sessionKey - Unique key for the current lesson/session
   * @returns {{
   *   visibleObjects: Object[],
   *   newIds: Set<string>,
   *   highlightIds: Set<string>,
   *   fadeIds: Set<string>,
   *   transition: string,
   *   staggerDelays: Map<string, number>,
   *   focusPoint: { x: number, y: number } | null,
   *   stepDuration: number,
   * }}
   */
  analyzeStep(step, allObjects, stepIndex, sessionKey = null) {
    // ─── Session Isolation ───
    if (sessionKey && sessionKey !== this.currentSessionKey) {
      console.log(`StepOrchestrator: New session detected (${sessionKey}). Resetting state.`);
      this.reset();
      this.currentSessionKey = sessionKey;
    }

    if (!step || !allObjects) {
      return this._emptyResult();
    }

    this.currentStepIndex = stepIndex;

    // Build object lookup
    const objectMap = new Map();
    allObjects.forEach(o => { if (o?.id) objectMap.set(o.id, o); });

    // Resolve IDs
    const currentIds = new Set(step.objectIds || []);
    const explicitNewIds = new Set(step.newIds || []);
    const highlightIds = new Set(step.highlightIds || []);
    const fadeIds = new Set(step.fadeIds || []);

    // Determine truly-new objects (using a snapshot of seenIds)
    const freshIds = new Set();
    for (const id of currentIds) {
      if (!this.seenIds.has(id)) {
        freshIds.add(id);
      }
    }

    // Effective new IDs = explicit newIds if provided, else freshIds
    const effectiveNewIds = explicitNewIds.size > 0 ? explicitNewIds : freshIds;

    // Visible objects in display order
    const visibleObjects = [...currentIds]
      .map(id => objectMap.get(id))
      .filter(Boolean);

    // Calculate stagger delays for new objects
    const staggerDelays = new Map();
    let staggerIdx = 0;

    // Highlighted new objects enter first
    const newHighlighted = [...effectiveNewIds].filter(id => highlightIds.has(id));
    const newNormal = [...effectiveNewIds].filter(id => !highlightIds.has(id));

    for (const id of [...newHighlighted, ...newNormal]) {
      staggerDelays.set(id, calculateStaggerDelay(staggerIdx, {
        isHighlighted: highlightIds.has(id),
        isNew: true,
        domain: this.domain,
      }));
      staggerIdx++;
    }

    // Calculate focus point — centroid of new objects
    const focusPoint = this._calculateFocusPoint(effectiveNewIds, objectMap);

    // Step duration adjusted by speed
    const baseDuration = step.durationMs || step.duration || 3000;
    const stepDuration = baseDuration / this.speed;

    return {
      visibleObjects,
      newIds: effectiveNewIds,
      highlightIds,
      fadeIds,
      transition: step.transition || 'springIn',
      staggerDelays,
      focusPoint,
      stepDuration,
    };
  }

  /**
   * Get the best default transition for the domain's step type.
   * @param {string} stepTitle 
   * @returns {string}
   */
  inferTransition(stepTitle) {
    const t = (stepTitle || '').toLowerCase();

    // Intro/overview steps → gentle fade
    if (t.includes('intro') || t.includes('overview') || t.includes('start'))
      return 'fadeIn';

    // Conclusion/summary → cascade
    if (t.includes('conclusion') || t.includes('summary') || t.includes('done'))
      return 'cascadeReveal';

    // Action steps → spring
    if (t.includes('swap') || t.includes('compare') || t.includes('sort'))
      return 'springIn';

    // Domain defaults
    return this._domainDefaultTransition();
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  _emptyResult() {
    return {
      visibleObjects: [],
      newIds: new Set(),
      highlightIds: new Set(),
      fadeIds: new Set(),
      transition: 'fadeIn',
      staggerDelays: new Map(),
      focusPoint: null,
      stepDuration: 3000,
    };
  }

  _calculateFocusPoint(newIds, objectMap) {
    if (newIds.size === 0) return null;

    let sumX = 0, sumY = 0, count = 0;
    for (const id of newIds) {
      const obj = objectMap.get(id);
      if (!obj) continue;
      const x = parseFloat(obj.x ?? obj.cx ?? obj.x1) || 400;
      const y = parseFloat(obj.y ?? obj.cy ?? obj.y1) || 300;
      sumX += x;
      sumY += y;
      count++;
    }

    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  }

  _domainDefaultTransition() {
    const map = {
      dsa: 'springIn',
      mathematics: 'cascadeReveal',
      physics: 'waveExpand',
      biology: 'waveExpand',
      chemistry: 'springIn',
      computer_science: 'cascadeReveal',
      engineering: 'springIn',
      history: 'typewriterBuild',
      general: 'springIn',
    };
    return map[this.domain] || 'springIn';
  }
}

// Singleton
const orchestrator = new StepOrchestrator();
export default orchestrator;
