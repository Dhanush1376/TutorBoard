/**
 * Design tokens for Engine v2 — the look and motion of the launch film,
 * owned by the engine so every scene gets them regardless of what the AI wrote.
 */

export const INK = '#F5F5F0';
export const INK_DIM = '#B9BDB7';
export const INK_FAINT = '#929991';
export const AXIS = '#383E38';
export const FONT_SANS = 'Geist, Inter, system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Semantic tones → colour. */
export const TONES: Record<string, string> = {
  default: INK,
  primary: '#F4C95D', // Warm amber
  accent: '#FF925C',  // Coral comparison
  success: '#35C98A', // Emerald found / correct
  warning: '#F4C95D', // Warm amber
  danger: '#FF6B6B',  // Error / invalid
  info: '#38BDF8',    // Cyan pointer
  muted: '#929991',   // Muted label
};
export const toneColor = (tone?: string, fallback = INK) => (tone ? TONES[tone] ?? fallback : fallback);

/** Distinct semantic badge style for text entities: opaque solid fill, crisp border, high-contrast readable text. Matches the sleek dark pill styling. */
export function badgeStyle(e: { role?: string; tone?: string; text?: string }): { fill: string; stroke: string; text: string } {
  const txt = (e.text || '').toLowerCase();
  // Target / Goal / Found -> Emerald
  if (txt.includes('target') || txt.includes('found') || e.tone === 'success') {
    return { fill: '#101713', stroke: '#22543D', text: '#68D391' };
  }
  // Mid / Active / Pivot / Calculating -> Amber
  if (txt.includes('mid') || e.tone === 'warning' || e.tone === 'primary') {
    return { fill: '#17150F', stroke: '#744210', text: '#F6E05E' };
  }
  // Dual pointer tracking like "low = ... high = ..." or search window -> Cool slate cyan
  if ((txt.includes('low') || txt.includes('lo')) && (txt.includes('high') || txt.includes('hi'))) {
    return { fill: '#0E171E', stroke: '#1A365D', text: '#63B3ED' };
  }
  // Low / Start / Left / Info -> Cyan
  if (txt.includes('low') || txt.includes('left') || txt.includes('start') || e.tone === 'info') {
    return { fill: '#0E171E', stroke: '#1A365D', text: '#63B3ED' };
  }
  // High / End / Right / Accent -> Coral
  if (txt.includes('high') || txt.includes('right') || txt.includes('end') || e.tone === 'accent' || e.tone === 'danger') {
    return { fill: '#19110F', stroke: '#652B19', text: '#FBD38D' };
  }
  // Default dark pill capsule matching screenshot: #0F1012 fill, #22252A border, crisp pure white text
  return { fill: '#0F1012', stroke: '#22252A', text: '#FFFFFF' };
}


/** Highlight states — fully opaque solid card colors without glow halos or low-contrast washed out fills. */
/** Rich, diverse fully opaque solid card colors for array boxes (no translucent glow, completely filled) */
export const ARRAY_PALETTE: { fill: string; stroke: string; text: string }[] = [
  { fill: '#1E293B', stroke: '#334155', text: '#F8FAFC' }, // Deep solid slate
  { fill: '#142E2B', stroke: '#1D4D47', text: '#E6FFFA' }, // Solid teal forest
  { fill: '#2A1F1D', stroke: '#4A3430', text: '#FFEDD5' }, // Solid warm terracotta
  { fill: '#1E2438', stroke: '#313C5E', text: '#EEF2FF' }, // Solid navy indigo
  { fill: '#1C2E20', stroke: '#2B4A33', text: '#F0FDF4' }, // Solid sage emerald
  { fill: '#2B2416', stroke: '#4D3F22', text: '#FEFCE8' }, // Solid amber bronze
  { fill: '#261F2E', stroke: '#423352', text: '#FAF5FF' }, // Solid plum wine
  { fill: '#2D281E', stroke: '#4D4330', text: '#FFFBEB' }, // Solid ochre gold
];

export const STATES: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  default: { fill: '#1E293B', stroke: '#334155', text: '#FFFFFF', glow: 'none' }, // Solid opaque slate card
  active: { fill: '#2A2210', stroke: '#F4C95D', text: '#FDF2D0', glow: 'none' }, // Warm amber
  comparing: { fill: '#2D1B13', stroke: '#FF925C', text: '#FFE7DC', glow: 'none' }, // Coral
  swapping: { fill: '#2D1B13', stroke: '#FF925C', text: '#FFE7DC', glow: 'none' },
  sorted: { fill: '#13281E', stroke: '#35C98A', text: '#D1FAE5', glow: 'none' }, // Emerald
  found: { fill: '#13281E', stroke: '#35C98A', text: '#D1FAE5', glow: 'none' },
  visited: { fill: '#252B33', stroke: '#475363', text: '#D0D6E0', glow: 'none' },
  eliminated: { fill: '#121417', stroke: '#262B33', text: '#64748B', glow: 'none' },
  pivot: { fill: '#2E1515', stroke: '#FF6B6B', text: '#FFE4E4', glow: 'none' },
  error: { fill: '#2E1515', stroke: '#FF6B6B', text: '#FFE4E4', glow: 'none' },
  insight: { fill: '#2A2210', stroke: '#F4C95D', text: '#FDF2D0', glow: 'none' },
};

/** CPK-ish atom colours (ContentPlugin's palette). */
export const CPK: Record<string, string> = {
  H: '#E5E7EB', C: '#6B7280', N: '#3B82F6', O: '#EF4444', F: '#22C55E', Cl: '#22C55E', Br: '#B45309',
  S: '#EAB308', P: '#F97316', Na: '#0EA5E9', K: '#0EA5E9', Mg: '#16A34A', Ca: '#16A34A', Fe: '#B45309',
};

export const SIZE_PX: Record<string, number> = { xs: 44, sm: 60, md: 96, lg: 140, xl: 190 };
export const GAP_PX: Record<string, number> = { none: 0, sm: 12, md: 24, lg: 44, xl: 72 };

export const CELL = { size: 44, gap: 8, radius: 10, font: 15 };

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
