/**
 * BehaviorIntelligence — Per-Object Behavioral Simulation Engine
 *
 * Implements the "Behavior Intelligence Layer":
 * Every object has behavior based on its domain, role, and state.
 * No object should behave statically.
 *
 * Rules:
 *  - CS arrays slide, swap, highlight
 *  - Physics objects have gravity/trajectory/field simulation
 *  - Biology cells breathe, hearts beat, neurons fire
 *  - Math graphs plot progressively, equations transform
 *
 * Returns Framer Motion animate configs that can be spread onto <motion.*>
 *
 * @module BehaviorIntelligence
 */

// ═══════════════════════════════════════════════════════════════════════════
// BEHAVIOR CATALOG
// Maps shape + role + state → animation config
// ═══════════════════════════════════════════════════════════════════════════

// ─── Computer Science / DSA ──────────────────────────────────────────────────

const CS_BEHAVIORS = {
  array: {
    idle:     () => null,
    active:   () => ({ scale: [1, 1.03, 1], transition: { duration: 0.4, ease: 'easeInOut' } }),
    swapping: () => ({ y: [0, -22, 0], scaleX: [1, 1.1, 1], transition: { duration: 0.55, type: 'spring', stiffness: 120, damping: 10 } }),
    swap:     () => ({ y: [0, -22, 0], scaleX: [1, 1.1, 1], transition: { duration: 0.55, type: 'spring', stiffness: 120, damping: 10 } }),
    sorted:   () => ({ scale: [1, 1.1, 1], transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] } }),
    comparing:() => ({ scale: [1, 1.05, 1.05], transition: { duration: 0.35, ease: 'easeIn' } }),
    compare:  () => ({ scale: [1, 1.05, 1.05], transition: { duration: 0.35, ease: 'easeIn' } }),
    sort:     () => ({ scale: [1, 1.08, 1], transition: { duration: 0.5, ease: 'easeInOut' } }),
    search:   () => ({ scale: [1, 1.04, 1], opacity: [1, 0.7, 1], transition: { duration: 0.4, repeat: 1 } }),
  },

  pointer: {
    idle:     () => ({ y: [0, -4, 0], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }),
    moving:   () => ({ x: [null, null], transition: { type: 'spring', stiffness: 160, damping: 14 } }),
    active:   () => ({ scale: [1, 1.2, 1], transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } }),
    traverse: () => ({ x: [null, null], y: [0, -8, 0], transition: { duration: 0.4, ease: 'backOut' } }),
  },

  comparator: {
    idle:     () => null,
    deciding: () => ({ scale: [1, 1.06], opacity: [1, 0.8, 1], transition: { duration: 0.25, repeat: 2 } }),
    compare:  () => ({ scale: [1, 1.06], opacity: [1, 0.8, 1], transition: { duration: 0.25, repeat: 2 } }),
    true:     () => ({ scale: [1, 1.12, 1], transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] } }),
    false:    () => ({ scale: [1, 0.95, 1], transition: { duration: 0.3, ease: 'easeInOut' } }),
  },

  node: {
    idle:     () => ({ scale: [1, 1.02, 1], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }),
    active:   () => ({ scale: [1, 1.12, 1], transition: { duration: 0.5, type: 'spring', damping: 10 } }),
    visited:  () => ({ opacity: [1, 0.6, 0.85], transition: { duration: 0.6, ease: 'easeOut' } }),
    traverse: () => ({ scale: [1, 1.15, 1], filter: 'brightness(1.4)', transition: { duration: 0.4 } }),
    pulse:    () => ({ scale: [1, 1.2, 1], transition: { duration: 0.5, repeat: 1 } }),
  },

  callstack: {
    push:   () => ({ y: [30, 0], opacity: [0, 1], transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } }),
    insert: () => ({ y: [30, 0], opacity: [0, 1], transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } }),
    pop:    () => ({ y: [0, -30], opacity: [1, 0], transition: { duration: 0.3, ease: 'easeIn' } }),
    delete: () => ({ y: [0, -30], opacity: [1, 0], transition: { duration: 0.3, ease: 'easeIn' } }),
  },
};

// ─── Physics ─────────────────────────────────────────────────────────────────

const PHYSICS_BEHAVIORS = {
  object: {
    falling:     (g = 9.8) => ({ y: [0, Math.min(g * 20, 300)], transition: { duration: 1.2, ease: [0.55, 0, 1, 0.45] } }),
    oscillating: () => ({ y: [0, -30, 0, 30, 0], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }),
    projectile:  () => ({ x: [0, 200], y: [0, 80, 200], transition: { duration: 1.5, ease: 'easeIn' } }),
    stationary:  () => null,
  },
  wave: {
    propagating: () => ({
      scaleX: [1, 1.15, 1],
      transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    }),
    standing: () => ({
      scaleY: [1, 1.3, 1, 0.7, 1],
      transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
    }),
  },
  field: {
    radiating: () => ({
      scale: [1, 1.5, 1],
      opacity: [0.7, 0, 0.7],
      transition: { duration: 2, repeat: Infinity, ease: 'easeOut' },
    }),
  },
  force_arrow: {
    idle: () => ({ scaleX: [1, 1.06, 1], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } }),
  },
};

// ─── Biology ─────────────────────────────────────────────────────────────────

const BIOLOGY_BEHAVIORS = {
  heart: {
    beating: () => ({
      scale: [1, 1.14, 1, 1.09, 1],
      transition: { duration: 1.4, repeat: Infinity, ease: [0.25, 0.46, 0.45, 0.94] },
    }),
  },
  lungs: {
    breathing: () => ({
      scaleX: [1, 1.18, 1],
      scaleY: [1, 1.12, 1],
      transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
    }),
  },
  cell: {
    living: () => ({
      scale: [1, 1.03, 0.98, 1.02, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    }),
    dividing: () => ({
      scaleX: [1, 1.4, 0.7, 1],
      scaleY: [1, 0.7, 1.4, 1],
      transition: { duration: 1.2, ease: 'easeInOut' },
    }),
  },
  neuron: {
    firing: () => ({
      scale: [1, 1.18, 1],
      filter: [`drop-shadow(0 0 4px #22d3ee40)`, `drop-shadow(0 0 16px #22d3eebb)`, `drop-shadow(0 0 4px #22d3ee40)`],
      transition: { duration: 0.35, ease: 'easeOut' },
    }),
    resting: () => ({
      scale: [1, 1.01, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    }),
  },
  organelle: {
    floating: () => ({
      x: [0, 4, -3, 2, 0],
      y: [0, -5, 3, -2, 0],
      transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
    }),
  },
};

// ─── Mathematics ─────────────────────────────────────────────────────────────

const MATH_BEHAVIORS = {
  function_curve: {
    plotting: () => ({
      pathLength: [0, 1],
      opacity: [0, 1],
      transition: { duration: 1.2, ease: [0.25, 0.8, 0.25, 1] },
    }),
  },
  equation: {
    transforming: () => ({
      y: [0, -8, 0],
      opacity: [1, 0.6, 1],
      transition: { duration: 0.5, ease: 'easeInOut' },
    }),
    highlighting: () => ({
      scale: [1, 1.08, 1],
      transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
    }),
  },
  point: {
    appearing: () => ({
      scale: [0, 1.3, 1],
      opacity: [0, 1],
      transition: { duration: 0.4, type: 'spring', stiffness: 200, damping: 12 },
    }),
  },
  bar: {
    growing: (targetH = 100) => ({
      scaleY: [0, 1],
      transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
    }),
  },
};

// ─── Chemistry ───────────────────────────────────────────────────────────────

const CHEMISTRY_BEHAVIORS = {
  atom: {
    vibrating: () => ({
      x: [0, 2, -2, 1, -1, 0],
      y: [0, -1, 1, -1, 0],
      transition: { duration: 0.8, repeat: Infinity, ease: 'linear' },
    }),
    bonding: () => ({
      scale: [1, 0.88, 1],
      transition: { duration: 0.6, ease: 'easeInOut' },
    }),
  },
  electron: {
    orbiting: () => ({
      rotate: [0, 360],
      transition: { duration: 2, repeat: Infinity, ease: 'linear' },
    }),
  },
  bond: {
    forming: () => ({
      pathLength: [0, 1],
      opacity: [0, 1],
      transition: { duration: 0.6, ease: 'easeOut' },
    }),
    breaking: () => ({
      pathLength: [1, 0.5, 0],
      opacity: [1, 0.5, 0],
      transition: { duration: 0.55, ease: 'easeIn' },
    }),
  },
};

// ─── Engineering ─────────────────────────────────────────────────────────────

const ENGINEERING_BEHAVIORS = {
  gear: {
    rotating_cw:  () => ({ rotate: 360,  transition: { duration: 6, repeat: Infinity, ease: 'linear' } }),
    rotating_ccw: () => ({ rotate: -360, transition: { duration: 6, repeat: Infinity, ease: 'linear' } }),
  },
  force: {
    applying: () => ({
      scaleX: [1, 1.12, 1],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    }),
  },
  signal: {
    propagating: () => ({
      strokeDashoffset: [48, 0],
      transition: { duration: 0.6, repeat: Infinity, ease: 'linear' },
    }),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// BEHAVIOR RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Role → catalog mapping per domain
 */
const DOMAIN_CATALOG = {
  dsa:              CS_BEHAVIORS,
  computer_science: CS_BEHAVIORS,
  physics:          PHYSICS_BEHAVIORS,
  biology:          BIOLOGY_BEHAVIORS,
  medicine:         BIOLOGY_BEHAVIORS,
  mathematics:      MATH_BEHAVIORS,
  chemistry:        CHEMISTRY_BEHAVIORS,
  engineering:      ENGINEERING_BEHAVIORS,
};

/**
 * Resolve the live behavior animation for a shape object.
 *
 * Priority:
 *   1. obj.behaviorRole + obj.behaviorState (explicit)
 *   2. obj.shape / obj.type → inferred role → 'idle' state
 *   3. Domain-default behavior
 *
 * @param {Object} obj     - Shape object from timeline
 * @param {string} domain  - Current domain
 * @returns {{ animate: Object, transition: Object } | null}
 */
export function resolveBehavior(obj, domain) {
  if (!obj) return null;

  const catalog = DOMAIN_CATALOG[domain];
  if (!catalog) return null;

  // Resolve role: explicit or inferred from shape type
  const role = obj.behaviorRole || _inferRole(obj, domain);
  const state = obj.behaviorState || 'idle';

  const roleCatalog = catalog[role];
  if (!roleCatalog) return _defaultActionBehavior(state);

  const factory = roleCatalog[state];
  if (!factory) return _defaultActionBehavior(state);

  const result = factory(obj.behaviorParam);
  if (!result) return _defaultActionBehavior(state);

  // Unpack { animate, transition } from factory result
  const { transition, ...animate } = result;
  return { animate, transition };
}

/**
 * Fallback for actions when no specific role behavior exists.
 */
function _defaultActionBehavior(state) {
  const S = {
    swap:      () => ({ y: [0, -15, 0], transition: { duration: 0.5 } }),
    compare:   () => ({ scale: [1, 1.1, 1], transition: { duration: 0.4 } }),
    pulse:     () => ({ scale: [1, 1.15, 1], transition: { duration: 0.6, repeat: 1 } }),
    highlight: () => ({ scale: [1, 1.1, 1], filter: 'brightness(1.2)', transition: { duration: 0.4 } }),
    intro:     () => ({ opacity: [0, 1], scale: [0.8, 1], transition: { duration: 0.8 } }),
    complete:  () => ({ scale: [1, 1.1, 1], filter: 'brightness(1.3)', transition: { duration: 0.8 } }),
  };
  const factory = S[state];
  if (!factory) return null;
  const { transition, ...animate } = factory();
  return { animate, transition };
}

/**
 * Get the "alive" behavior for idle state — ensures nothing stays static.
 * @param {Object} obj
 * @param {string} domain
 * @returns {{ animate, transition } | null}
 */
export function getIdleBehavior(obj, domain) {
  const catalog = DOMAIN_CATALOG[domain];
  if (!catalog) return _defaultIdleBehavior(obj);

  const role = obj.behaviorRole || _inferRole(obj, domain);
  const roleCatalog = catalog[role];
  if (!roleCatalog?.idle) return _defaultIdleBehavior(obj);

  const result = roleCatalog.idle();
  if (!result) return _defaultIdleBehavior(obj);

  const { transition, ...animate } = result;
  return { animate, transition };
}

/**
 * Infer role from shape type + domain context.
 * @param {Object} obj
 * @param {string} domain
 * @returns {string}
 */
function _inferRole(obj, domain) {
  const s = (obj.shape || obj.type || '').toLowerCase();

  const SHAPE_ROLE_MAP = {
    // DSA
    'array':      'array',
    'arraycell':  'array',
    'pointer':    'pointer',
    'comparator': 'comparator',
    'circle':     domain === 'dsa' || domain === 'computer_science' ? 'node' : 'cell',
    'node':       'node',

    // Physics
    'wave':       'wave',
    'field':      'field',
    'arrow':      domain === 'physics' ? 'force_arrow' : 'signal',

    // Biology
    'heartbeat':  'heart',
    'lungs':      'lungs',
    'organelle':  'organelle',
    'neuron':     'neuron',

    // Math
    'path':       domain === 'mathematics' ? 'function_curve' : 'bond',
    'text':       domain === 'mathematics' ? 'equation' : null,
    'rect':       domain === 'mathematics' ? 'bar' : null,

    // Engineering
    'gear':       'gear',
  };

  return SHAPE_ROLE_MAP[s] || s;
}

/**
 * Default idle — a very subtle float for any unrecognized shape.
 */
function _defaultIdleBehavior(obj) {
  const shape = (obj.shape || '').toLowerCase();

  // Texts and labels shouldn't float
  if (shape === 'text' || shape === 'label' || shape === 'badge') return null;

  return {
    animate: { y: [0, -3, 0] },
    transition: { duration: 4 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut' },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NARRATIVE SYNC ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze a narration string and extract behavioral hints for the current step.
 *
 * This drives Narrative Synchronization:
 * "When action is described → animate it"
 *
 * @param {string} narration - Step's narration text
 * @param {string} domain
 * @returns {{
 *   actionType: string|null,       // e.g., 'swap', 'compare', 'highlight', 'wave'
 *   emphasis: 'subtle'|'normal'|'dramatic',
 *   transitionHint: string,
 *   focusIntensity: number         // 1-5, how aggressively to focus camera
 * }}
 */
export function analyzeNarration(narration, domain) {
  if (!narration) return _defaultNarrativeHints();

  const t = narration.toLowerCase();

  // Action keywords → behavior
  const ACTION_MAP = [
    { keywords: ['swap', 'exchange', 'switch', 'swapping'],       action: 'swap',      emphasis: 'dramatic',  focus: 5, transition: 'springIn' },
    { keywords: ['compare', 'comparing', 'check', 'which is'],    action: 'compare',   emphasis: 'normal',    focus: 4, transition: 'springIn' },
    { keywords: ['move', 'shift', 'slide', 'advance'],            action: 'move',      emphasis: 'normal',    focus: 3, transition: 'cascadeReveal' },
    { keywords: ['highlight', 'focus on', 'notice', 'observe'],   action: 'highlight', emphasis: 'normal',    focus: 4, transition: 'fadeIn' },
    { keywords: ['sort', 'sorted', 'ordering', 'arrange'],        action: 'sort',      emphasis: 'dramatic',  focus: 4, transition: 'springIn' },
    { keywords: ['insert', 'add', 'append', 'push'],              action: 'insert',    emphasis: 'normal',    focus: 3, transition: 'springIn' },
    { keywords: ['delete', 'remove', 'pop', 'drop'],              action: 'delete',    emphasis: 'subtle',    focus: 3, transition: 'fadeIn' },
    { keywords: ['search', 'find', 'look for', 'scanning'],       action: 'search',    emphasis: 'normal',    focus: 4, transition: 'cascadeReveal' },
    { keywords: ['traverse', 'visit', 'walk', 'iterate'],         action: 'traverse',  emphasis: 'normal',    focus: 3, transition: 'cascadeReveal' },
    { keywords: ['split', 'divide', 'partition', 'half'],         action: 'split',     emphasis: 'dramatic',  focus: 5, transition: 'waveExpand' },
    { keywords: ['merge', 'combine', 'join', 'connect'],          action: 'merge',     emphasis: 'dramatic',  focus: 5, transition: 'waveExpand' },
    { keywords: ['oscillat', 'vibrat', 'wave', 'frequency'],      action: 'wave',      emphasis: 'normal',    focus: 3, transition: 'waveExpand' },
    { keywords: ['beat', 'pulse', 'rhythm', 'contract'],          action: 'pulse',     emphasis: 'normal',    focus: 3, transition: 'springIn' },
    { keywords: ['fire', 'signal', 'transmit', 'propagat'],       action: 'signal',    emphasis: 'dramatic',  focus: 4, transition: 'cascadeReveal' },
    { keywords: ['grow', 'expand', 'spread', 'scale'],            action: 'grow',      emphasis: 'normal',    focus: 3, transition: 'waveExpand' },
    { keywords: ['introduction', 'overview', 'begin', 'start we'],action: 'intro',     emphasis: 'subtle',    focus: 2, transition: 'fadeIn' },
    { keywords: ['final', 'complete', 'done', 'result', 'done'],  action: 'complete',  emphasis: 'dramatic',  focus: 5, transition: 'cascadeReveal' },
  ];

  for (const entry of ACTION_MAP) {
    if (entry.keywords.some(k => t.includes(k))) {
      return {
        actionType: entry.action,
        emphasis: entry.emphasis,
        transitionHint: entry.transition,
        focusIntensity: entry.focus,
      };
    }
  }

  return _defaultNarrativeHints();
}

function _defaultNarrativeHints() {
  return {
    actionType: null,
    emphasis: 'normal',
    transitionHint: 'springIn',
    focusIntensity: 2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OBJECT ATTENTION SCORER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score objects by how much attention they deserve this step.
 * Returns sorted list with dominance classification.
 *
 * Rule: Only 1–3 elements should dominate. Rest fade.
 *
 * @param {Object[]} objects
 * @param {Set<string>} highlightIds
 * @param {Set<string>} newIds
 * @param {string} actionType
 * @returns {{ dominant: string[], supporting: string[], background: string[] }}
 */
export function classifyAttention(objects, highlightIds, newIds, actionType) {
  const scores = new Map();

  for (const obj of objects) {
    let score = 0;

    if (highlightIds.has(obj.id)) score += 10;
    if (newIds.has(obj.id)) score += 5;

    // Shape-based relevance to action
    const shape = (obj.shape || '').toLowerCase();
    if (actionType === 'swap' && (shape === 'array' || shape === 'swapbridge')) score += 8;
    if (actionType === 'compare' && shape === 'comparator') score += 8;
    if (actionType === 'traverse' && shape === 'pointer') score += 8;
    if (actionType === 'signal' && shape === 'arrow') score += 6;
    if (actionType === 'pulse' && (shape === 'circle' || shape === 'node')) score += 6;

    // Behavioral state boost
    if (obj.behaviorState && obj.behaviorState !== 'idle') score += 3;

    scores.set(obj.id, score);
  }

  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const dominant    = sorted.slice(0, 3).filter(id => (scores.get(id) || 0) >= 5);
  const supporting  = sorted.slice(0, 8).filter(id => !dominant.includes(id));
  const background  = sorted.filter(id => !dominant.includes(id) && !supporting.includes(id));

  return { dominant, supporting, background };
}

export default {
  resolveBehavior,
  getIdleBehavior,
  analyzeNarration,
  classifyAttention,
};
