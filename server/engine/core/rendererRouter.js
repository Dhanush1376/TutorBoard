/**
 * RendererRouter (Server-side) v1.0
 * 
 * Determines the optimal renderer based on concept classification.
 */
export const RENDERER_MAP = {
  FLOW:       'cinematic',
  PHYSICS:    'matter',
  DATA:       'd3',
  NARRATIVE:  'narrative',
  ABSTRACT:   'katex',
  COMPARISON: 'cinematic'
};

export function getRendererForConcept(conceptType) {
  return RENDERER_MAP[conceptType] || 'cinematic';
}
