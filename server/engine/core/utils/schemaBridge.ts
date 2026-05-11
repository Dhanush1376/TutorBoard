/**
 * Schema bridge for normalizing agent outputs into renderer formats
 */

export function unwrapValidatorOutput(raw: any) {
  if (!raw) return null;

  // Case A: Already legacy format
  if (raw.elements || raw.objects || raw.timeline || raw.steps) {
    console.log('[SchemaBridge] Output already in legacy format — passing through.');
    return raw;
  }

  // Case B: New format — unwrap final_output
  const inner = raw.final_output || raw; 
  if (typeof inner !== 'object' || inner === null) {
    console.warn('[SchemaBridge] Validator returned invalid structure:', raw);
    return null;
  }

  const result = {
    elements: (inner.visual_steps || inner.elements || inner.objects || []).filter(Boolean),
    timeline: (inner.narrations || inner.timeline || inner.steps || []).filter(Boolean),
    scene: inner.meta || inner.scene || { type: 'linear' }
  };

  // Convert visual_steps format to legacy elements if needed
  if (inner.visual_steps && result.elements.length === 0) {
    result.elements = inner.visual_steps;
  }

  return result;
}
