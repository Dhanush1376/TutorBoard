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
  default:    { bg: '#171A18', border: '#383E38', text: '#F5F5F0', glow: 'transparent' },
  active:     { bg: '#262014', border: '#F4C95D', text: '#FDF2D0', glow: 'transparent' }, // Warm amber
  comparing:  { bg: '#291B14', border: '#FF925C', text: '#FFE7DC', glow: 'transparent' }, // Coral
  eliminated: { bg: '#0E100F', border: '#202521', text: '#929991', glow: 'transparent' }, // Neutral muted
  sorted:     { bg: '#13261C', border: '#35C98A', text: '#D1FAE5', glow: 'transparent' }, // Emerald
  pivot:      { bg: '#291414', border: '#FF6B6B', text: '#FFE4E4', glow: 'transparent' }, // Soft crimson
  found:      { bg: '#13261C', border: '#35C98A', text: '#D1FAE5', glow: 'transparent' }, // Emerald
  visiting:   { bg: '#262014', border: '#F4C95D', text: '#FDF2D0', glow: 'transparent' },
  visited:    { bg: '#1D221E', border: '#454B46', text: '#B9BDB7', glow: 'transparent' },
  swapping:   { bg: '#291B14', border: '#FF925C', text: '#FFE7DC', glow: 'transparent' },
};
