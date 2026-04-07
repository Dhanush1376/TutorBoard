/**
 * Animation Presets — Centralized motion library for TutorBoard
 * 
 * Provides Framer Motion variants and spring configurations for all
 * animation types across every subject domain.
 * 
 * @module animationPresets
 */

// ═══════════════════════════════════════════════════════════════════════════
// SPRING PHYSICS CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Spring config for general element entry — balanced feel */
export const SPRING_STANDARD = { type: 'spring', stiffness: 100, damping: 15, mass: 1 };

/** Spring config for snappy micro-interactions */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 200, damping: 20, mass: 0.8 };

/** Spring config for bouncy, playful entry */
export const SPRING_BOUNCY = { type: 'spring', stiffness: 80, damping: 10, mass: 1.2 };

/** Spring config for smooth, elegant motion */
export const SPRING_SMOOTH = { type: 'spring', stiffness: 60, damping: 18, mass: 1.5 };

/** Spring config for dramatic cinematic reveals */
export const SPRING_CINEMATIC = { type: 'spring', stiffness: 40, damping: 12, mass: 2 };

// ═══════════════════════════════════════════════════════════════════════════
// EASING CURVES (cubic-bezier)
// ═══════════════════════════════════════════════════════════════════════════

/** Default cinematic ease — never use linear */
export const EASE_CINEMATIC = [0.25, 0.8, 0.25, 1];

/** Smooth deceleration for entries */
export const EASE_OUT = [0.16, 1, 0.3, 1];

/** Acceleration for exits */
export const EASE_IN = [0.55, 0.055, 0.675, 0.19];

/** Overshoot for emphasis */
export const EASE_OVERSHOOT = [0.34, 1.56, 0.64, 1];

/** Bounce settle */
export const EASE_BOUNCE = [0.68, -0.55, 0.265, 1.55];

// ═══════════════════════════════════════════════════════════════════════════
// ENTRANCE VARIANTS (Layer 1: Base Motion)
// ═══════════════════════════════════════════════════════════════════════════

export const ENTRANCE = {
  /** Spring-powered scale + fade entry */
  springIn: {
    hidden: { opacity: 0, scale: 0.3, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    transition: { ...SPRING_STANDARD },
  },

  /** Cascade reveal — slide from left with stagger-ready delay */
  cascadeReveal: {
    hidden: { opacity: 0, x: -40, scale: 0.9 },
    visible: { opacity: 1, x: 0, scale: 1 },
    transition: { duration: 0.5, ease: EASE_OUT },
  },

  /** Orbital entry — element spirals in from outside */
  orbitalEntry: {
    hidden: { opacity: 0, scale: 0, rotate: -180 },
    visible: { opacity: 1, scale: 1, rotate: 0 },
    transition: { ...SPRING_BOUNCY, duration: 0.8 },
  },

  /** Wave expand — elements ripple outward from center */
  waveExpand: {
    hidden: { opacity: 0, scale: 0.5, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0 },
    transition: { ...SPRING_SMOOTH },
  },

  /** Typewriter build — elements slide in from bottom-left */
  typewriterBuild: {
    hidden: { opacity: 0, x: -20, y: 15 },
    visible: { opacity: 1, x: 0, y: 0 },
    transition: { duration: 0.4, ease: EASE_CINEMATIC },
  },

  /** Fade in — simplest, for subtle elements */
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    transition: { duration: 0.5, ease: EASE_OUT },
  },

  /** Slide up — standard vertical reveal */
  slideUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE_OUT },
  },

  /** Scale in — pop into existence */
  scaleIn: {
    hidden: { opacity: 0, scale: 0.4 },
    visible: { opacity: 1, scale: 1 },
    transition: { ...SPRING_SNAPPY },
  },

  /** Pop with overshoot */
  popIn: {
    hidden: { opacity: 0, scale: 0.5 },
    visible: { opacity: 1, scale: 1 },
    transition: { duration: 0.45, ease: EASE_OVERSHOOT },
  },

  /** Reveal from left */
  reveal: {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 },
    transition: { duration: 0.45, ease: EASE_OUT },
  },

  /** Path drawing */
  drawLine: {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.7, ease: EASE_CINEMATIC },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// EMPHASIS / MICRO-INTERACTION VARIANTS (Layer 2)
// ═══════════════════════════════════════════════════════════════════════════

export const EMPHASIS = {
  /** Gentle breathing pulse — for organic/living elements */
  breathe: {
    animate: { scale: [1, 1.03, 1] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },

  /** Floating motion — gentle vertical bob */
  float: {
    animate: { y: [0, -6, 0] },
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },

  /** Neon glow pulse — expanding/contracting glow ring */
  glowPulse: (color = '#3b82f6') => ({
    animate: {
      filter: [
        `drop-shadow(0 0 4px ${color}80)`,
        `drop-shadow(0 0 16px ${color}b0)`,
        `drop-shadow(0 0 4px ${color}80)`,
      ],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  }),

  /** Orbital halo — expanding ring */
  haloRing: (radius = 50, color = '#f59e0b') => ({
    animate: {
      r: [radius + 6, radius + 18, radius + 6],
      opacity: [0.2, 0.55, 0.2],
    },
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  }),

  /** Ripple wave — single expanding ring then fade */
  ripple: {
    animate: { scale: [0.85, 1.3], opacity: [0.7, 0] },
    transition: { duration: 0.7, ease: 'easeOut' },
  },

  /** Pulse — scale bounce for highlights */
  pulse: {
    animate: { scale: [1, 1.12, 1] },
    transition: { duration: 0.6, repeat: 2, ease: 'easeInOut' },
  },

  /** Heartbeat — double-beat pulse for medical/biology */
  heartbeat: {
    animate: { scale: [1, 1.12, 1, 1.08, 1] },
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },

  /** Wave — lateral oscillation for physics */
  wave: {
    animate: { y: [0, -4, 0, 4, 0] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// EXIT VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

export const EXIT = {
  /** Fade + collapse */
  fadeCollapse: {
    exit: { opacity: 0, scale: 0.8, y: -10 },
    transition: { duration: 0.3, ease: EASE_IN },
  },

  /** Scatter dissolve */
  scatterDissolve: {
    exit: { opacity: 0, scale: 0.5, x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 },
    transition: { duration: 0.4, ease: EASE_IN },
  },

  /** Vortex exit — spin out */
  vortexExit: {
    exit: { opacity: 0, scale: 0, rotate: 90 },
    transition: { duration: 0.5, ease: EASE_IN },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBJECT-SPECIFIC PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const SUBJECT_PRESETS = {
  dsa: {
    arrayCell: {
      swap: {
        animate: { y: [0, -20, 0], scaleX: [1, 1.08, 1] },
        transition: { duration: 0.55, type: 'spring', stiffness: 120, damping: 12 },
      },
      sort: {
        animate: { scale: [1, 1.1, 1] },
        transition: { duration: 0.4, ease: EASE_OVERSHOOT },
      },
      compare: {
        animate: { scale: [1, 1.05, 1.05] },
        transition: { duration: 0.35, ease: 'easeInOut' },
      },
    },
    pointer: {
      bounce: {
        hidden: { opacity: 0, y: 20, scale: 0.6 },
        visible: { opacity: 1, y: 0, scale: 1 },
        transition: { ...SPRING_BOUNCY },
      },
    },
    swapArc: {
      draw: {
        hidden: { pathLength: 0, opacity: 0 },
        visible: { pathLength: 1, opacity: 0.9 },
        transition: { duration: 0.55, ease: 'easeOut' },
      },
    },
  },

  physics: {
    forceVector: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 },
      transition: { duration: 0.6, ease: EASE_CINEMATIC },
    },
    trajectory: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 0.8 },
      transition: { duration: 1.2, ease: EASE_CINEMATIC },
    },
    oscillate: {
      animate: { y: [0, -8, 0, 8, 0] },
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  },

  biology: {
    cellPulse: {
      animate: { scale: [1, 1.02, 1] },
      transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
    },
    signalPropagate: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 },
      transition: { duration: 0.8, ease: 'easeOut' },
    },
    organelleFloat: {
      animate: { x: [0, 3, -2, 0], y: [0, -4, 2, 0] },
      transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
    },
  },

  mathematics: {
    graphPlot: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 },
      transition: { duration: 1, ease: EASE_CINEMATIC },
    },
    equationTransform: {
      hidden: { opacity: 0, y: 10, scale: 0.9 },
      visible: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.5, ease: EASE_OVERSHOOT },
    },
  },

  chemistry: {
    bondForm: {
      hidden: { pathLength: 0, opacity: 0, strokeWidth: 0 },
      visible: { pathLength: 1, opacity: 1, strokeWidth: 2.5 },
      transition: { duration: 0.6, ease: 'easeOut' },
    },
    electronShift: {
      animate: { offsetDistance: ['0%', '100%'] },
      transition: { duration: 0.8, ease: 'easeInOut' },
    },
  },

  history: {
    timelineEvent: {
      hidden: { opacity: 0, x: -30, scale: 0.85 },
      visible: { opacity: 1, x: 0, scale: 1 },
      transition: { duration: 0.5, ease: EASE_OUT },
    },
  },

  engineering: {
    forceArrow: {
      hidden: { pathLength: 0 },
      visible: { pathLength: 1 },
      transition: { duration: 0.7, ease: EASE_CINEMATIC },
    },
    gearRotate: {
      animate: { rotate: 360 },
      transition: { duration: 8, repeat: Infinity, ease: 'linear' },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STAGGER CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate stagger delay for an element based on its index and importance.
 * @param {number} index - Position in the entry sequence
 * @param {Object} [options]
 * @param {number} [options.baseDelay=100] - Base delay in ms between elements
 * @param {boolean} [options.isHighlighted=false] - Highlighted elements enter first
 * @param {boolean} [options.isNew=true] - Only new elements are staggered
 * @param {string} [options.domain='general'] - Domain influences stagger rhythm
 * @returns {number} Delay in seconds (for Framer Motion)
 */
export function calculateStaggerDelay(index, options = {}) {
  const {
    baseDelay = 100,
    isHighlighted = false,
    isNew = true,
    domain = 'general',
  } = options;

  if (!isNew) return 0;

  // Highlighted elements enter 50ms earlier
  const highlightOffset = isHighlighted ? -0.05 : 0;

  // Domain-specific rhythm multipliers
  const domainMultiplier = {
    dsa: 0.8,            // Methodical, crisp timing
    mathematics: 1.0,    // Balanced
    physics: 1.1,        // Slightly more dramatic
    biology: 1.3,        // Organic, slower unfold
    chemistry: 1.0,
    medicine: 1.2,
    history: 1.1,
    general: 1.0,
  }[domain] || 1.0;

  // Clamp base delay to 80-150ms range
  const clampedBase = Math.max(80, Math.min(150, baseDelay));

  return Math.max(0, (index * clampedBase * domainMultiplier) / 1000 + highlightOffset);
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSITION RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve a transition name to its Framer Motion variant config.
 * @param {string} name - Transition name (e.g., 'springIn', 'fadeIn', 'scaleIn')
 * @returns {{ hidden: Object, visible: Object, transition: Object }}
 */
export function resolveTransition(name) {
  return ENTRANCE[name] || ENTRANCE.springIn;
}

/**
 * Resolve a micro-animation name to its continuous animation config.
 * @param {string} name - Animation name (e.g., 'breathe', 'float', 'pulse')
 * @returns {{ animate: Object, transition: Object } | null}
 */
export function resolveMicroAnimation(name) {
  if (!name || name === 'none') return null;
  return EMPHASIS[name] || null;
}

/**
 * Get the appropriate default entrance for a domain.
 * @param {string} domain 
 * @returns {string}
 */
export function getDefaultEntrance(domain) {
  const defaults = {
    dsa: 'springIn',
    mathematics: 'cascadeReveal',
    physics: 'waveExpand',
    biology: 'waveExpand',
    chemistry: 'springIn',
    medicine: 'fadeIn',
    computer_science: 'cascadeReveal',
    engineering: 'springIn',
    history: 'typewriterBuild',
    psychology: 'fadeIn',
    economics: 'cascadeReveal',
    general: 'springIn',
  };
  return defaults[domain] || 'springIn';
}

/**
 * Get default micro-animation for a shape in a domain.
 * @param {string} shape - Shape type
 * @param {string} domain - Domain key
 * @returns {string|null}
 */
export function getDefaultMicroAnimation(shape, domain) {
  // Shapes that naturally float/breathe
  const floaters = {
    biology: ['circle', 'badge'],
    physics: ['circle'],
    chemistry: ['circle'],
    medicine: ['circle'],
  };

  if (floaters[domain]?.includes(shape)) return 'breathe';
  if (shape === 'badge') return 'float';
  return null;
}
