/**
 * RendererRouter (Server-side) v3.0
 *
 * Determines the optimal renderer based on concept classification.
 * DSA/algorithm topics always get the algorithm renderer.
 */
export const RENDERER_MAP = {
  FLOW:       'd3',
  PHYSICS:    'matter',
  DATA:       'd3',
  NARRATIVE:  'narrative',
  ABSTRACT:   'katex',
  COMPARISON: 'cinematic',
  DSA:        'algorithm',
  ALGORITHM:  'algorithm',
};

const DSA_KEYWORDS = [
  'sort','search','array','tree','graph','stack','queue','linked','heap',
  'bfs','dfs','binary','bubble','merge','quick','insertion','selection','traversal',
];

export function getRendererForConcept(conceptType, topic = '') {
  if (RENDERER_MAP[conceptType]) return RENDERER_MAP[conceptType];
  // Fallback fuzzy detection by topic
  const lc = (topic || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => lc.includes(k))) return 'algorithm';
  return 'cinematic';
}