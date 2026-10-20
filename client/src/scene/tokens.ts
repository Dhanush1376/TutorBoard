/**
 * Design tokens for Engine v2 — the look and motion of the launch film,
 * owned by the engine so every scene gets them regardless of what the AI wrote.
 */

export const INK = '#F2F0EA';
export const INK_DIM = '#B9B6AE';
export const INK_FAINT = 'rgba(242,240,234,0.45)';
export const AXIS = 'rgba(255,255,255,0.28)';
export const FONT_SANS = 'Geist, Inter, system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Semantic tones → colour. */
export const TONES: Record<string, string> = {
  default: INK,
  primary: '#6366F1',
  accent: '#EC4899',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#60A5FA',
  muted: '#8F8F8F',
};
export const toneColor = (tone?: string, fallback = INK) => (tone ? TONES[tone] ?? fallback : fallback);

/** Highlight states — the app's ALGO_COLORS plus "insight" (the film's amber). */
export const STATES: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  default: { fill: 'rgba(255,255,255,0)', stroke: 'rgba(255,255,255,0.13)', text: INK, glow: 'rgba(0,0,0,0)' },
  active: { fill: 'rgba(139,92,246,0.18)', stroke: '#8b5cf6', text: '#e9d5ff', glow: 'rgba(139,92,246,0.35)' },
  comparing: { fill: 'rgba(245,158,11,0.18)', stroke: '#f59e0b', text: '#fef3c7', glow: 'rgba(245,158,11,0.3)' },
  swapping: { fill: 'rgba(251,191,36,0.2)', stroke: '#fbbf24', text: '#fef9c3', glow: 'rgba(251,191,36,0.3)' },
  sorted: { fill: 'rgba(34,197,94,0.15)', stroke: '#22c55e', text: '#bbf7d0', glow: 'rgba(34,197,94,0.25)' },
  found: { fill: 'rgba(59,130,246,0.2)', stroke: '#3b82f6', text: '#bfdbfe', glow: 'rgba(59,130,246,0.35)' },
  visited: { fill: 'rgba(99,102,241,0.12)', stroke: '#6366f1', text: '#c7d2fe', glow: 'rgba(99,102,241,0.15)' },
  eliminated: { fill: 'rgba(100,116,139,0.04)', stroke: 'rgba(100,116,139,0.18)', text: '#71717a', glow: 'rgba(0,0,0,0)' },
  pivot: { fill: 'rgba(236,72,153,0.18)', stroke: '#ec4899', text: '#fbcfe8', glow: 'rgba(236,72,153,0.3)' },
  error: { fill: 'rgba(239,68,68,0.18)', stroke: '#ef4444', text: '#fecaca', glow: 'rgba(239,68,68,0.3)' },
  insight: { fill: 'rgba(249,115,22,0.16)', stroke: '#f97316', text: '#ffedd5', glow: 'rgba(249,115,22,0.45)' },
};

/** CPK-ish atom colours (ContentPlugin's palette). */
export const CPK: Record<string, string> = {
  H: '#E5E7EB', C: '#6B7280', N: '#3B82F6', O: '#EF4444', F: '#22C55E', Cl: '#22C55E', Br: '#B45309',
  S: '#EAB308', P: '#F97316', Na: '#A855F7', K: '#A855F7', Mg: '#16A34A', Ca: '#16A34A', Fe: '#B45309',
};

export const SIZE_PX: Record<string, number> = { xs: 48, sm: 72, md: 110, lg: 160, xl: 220 };
export const GAP_PX: Record<string, number> = { none: 0, sm: 16, md: 32, lg: 56, xl: 96 };

export const CELL = { size: 72, gap: 12, radius: 16, font: 26 };

// ── Motion ──────────────────────────────────────────────────────────────────
export const EASE = {
  enter: 'power3.out',
  exit: 'power2.in',
  move: 'power2.inOut',
  pop: 'back.out(1.6)',
  draw: 'power2.inOut',
  linear: 'none',
};

/** Base durations in seconds, scaled by beat pace. */
export const DUR = {
  create: 0.55,
  draw: 0.9,
  type: 0.6,
  remove: 0.35,
  swap: 0.8,
  push: 0.6,
  pop: 0.55,
  set: 0.35,
  morph: 0.85,
  highlight: 0.3,
  flash: 0.7,
  annotate: 0.4,
  connect: 0.65,
  trace: { short: 1.0, normal: 1.6, long: 2.4 },
  tween: 0.8,
  move: 0.7,
  focus: 0.9,
  wait: 0.6,
  stagger: 0.08,
};
export const PACE: Record<string, number> = { slow: 1.35, normal: 1, fast: 0.7 };

/** Time the learner gets to read a beat's narration, beyond its animation. */
export const readingSeconds = (text: string) => Math.max(1.2, text.trim().split(/\s+/).length * 0.3);
