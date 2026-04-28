/**
 * Virtual Space Constants for coordinate normalization.
 * Standardizing on 800x600 for the original canvas coordinate system.
 */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// ─── Algorithm Renderer Layout ──────────────────────────────────────────────
export const ALGO_GRID = {
  MAIN_COLS: 8,
  INFO_COLS: 4,
  PADDING: 16,
  CELL_GAP: 8,
  MIN_CELL_SIZE: 28,
  MAX_CELL_SIZE: 48,
  POINTER_HEIGHT: 28,
  LABEL_SIZE: 12,
  TITLE_SIZE: 18,
};

export const ALGO_STATES = {
  DEFAULT:    'default',
  ACTIVE:     'active',
  COMPARING:  'comparing',
  ELIMINATED: 'eliminated',
  SORTED:     'sorted',
  PIVOT:      'pivot',
  FOUND:      'found',
  VISITING:   'visiting',
  VISITED:    'visited',
  SWAPPING:   'swapping',
};

export const ALGO_COLORS = {
  default:    { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)', text: 'var(--text-primary)',    glow: 'transparent' },
  active:     { bg: 'rgba(139,92,246,0.18)',   border: '#8b5cf6',                text: '#e9d5ff',               glow: 'rgba(139,92,246,0.35)' },
  comparing:  { bg: 'rgba(245,158,11,0.18)',   border: '#f59e0b',                text: '#fef3c7',               glow: 'rgba(245,158,11,0.3)' },
  eliminated: { bg: 'rgba(100,116,139,0.04)',  border: 'rgba(100,116,139,0.12)', text: 'var(--text-tertiary)',   glow: 'transparent' },
  sorted:     { bg: 'rgba(34,197,94,0.15)',    border: '#22c55e',                text: '#bbf7d0',               glow: 'rgba(34,197,94,0.25)' },
  pivot:      { bg: 'rgba(236,72,153,0.18)',   border: '#ec4899',                text: '#fbcfe8',               glow: 'rgba(236,72,153,0.3)' },
  found:      { bg: 'rgba(59,130,246,0.2)',    border: '#3b82f6',                text: '#bfdbfe',               glow: 'rgba(59,130,246,0.35)' },
  visiting:   { bg: 'rgba(139,92,246,0.25)',   border: '#8b5cf6',                text: '#e9d5ff',               glow: 'rgba(139,92,246,0.4)' },
  visited:    { bg: 'rgba(99,102,241,0.12)',   border: '#6366f1',                text: 'var(--text-secondary)', glow: 'rgba(99,102,241,0.15)' },
  swapping:   { bg: 'rgba(251,191,36,0.2)',    border: '#fbbf24',                text: '#fef9c3',               glow: 'rgba(251,191,36,0.3)' },
};
