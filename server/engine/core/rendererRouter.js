/**
 * RendererRouter (Server-side) v2.0
 * 
 * Determines the optimal renderer based on concept classification.
 * Aligned with animationPlanner.js RENDERER_MAP.
 */
export const RENDERER_MAP = {
  FLOW:       'd3',
  PHYSICS:    'matter',
  DATA:       'd3',
  NARRATIVE:  'narrative',
  ABSTRACT:   'katex',
  COMPARISON: 'cinematic'
};

export function getRendererForConcept(conceptType) {
  return RENDERER_MAP[conceptType] || 'cinematic';
}
