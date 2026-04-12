/**
 * Validators Index
 */
export { safeParse } from '../utils/parser.js';
export { validatePedagogyResponse } from './maestroValidator.js';
import { SceneGraphSchema } from './timelineSchema.js';
import { validateTimeline as richValidateTimeline } from './timelineValidator.js';

export function validateTimeline(data) {
  // Normalize legacy keys
  const elems = data.elements || data.objects;
  const steps = data.timeline || data.steps;

  // 0. Hard Guard Fix: Ensure we have at least these arrays before Zod
  if (!data || !Array.isArray(elems) || !Array.isArray(steps)) {
    return { valid: false, errors: ['Invalid timeline structure: missing elements or timeline array'], data };
  }

  // Ensure normalized keys for Zod and legacy pipeline
  if (!data.timeline) data.timeline = steps;
  if (!data.elements) data.elements = elems;
  if (!data.steps) data.steps = steps;
  if (!data.objects) data.objects = elems;

  // 1. Structural Validation via Zod
  const result = SceneGraphSchema.safeParse(data);
  const errors = [];

  if (!result.success) {
    result.error.issues.forEach(issue => {
      errors.push(`${issue.path.join('.') || 'root'}: ${issue.message}`);
    });
  }

  // 2. Rich pedagogical validation (Fall back to legacy for density and ID isolation)
  const richValidation = richValidateTimeline(data);
  
  const allErrors = [
    ...errors,
    ...richValidation.errors
  ];

  return { 
    valid: allErrors.length === 0, 
    errors: allErrors,
    data: result.success ? result.data : data
  };
}

export function validateDoubtResponse(data) {
  if (!data || !data.answer) return { valid: false, errors: ['Missing answer'] };
  return { valid: true, errors: [] };
}

export function validateReflectionResponse(data) {
  if (!data || !data.status) return { valid: false, errors: ['Missing status'] };
  return { valid: true, errors: [] };
}

export function buildRetryPrompt(errors) {
  return `YOUR PREVIOUS OUTPUT WAS INVALID. Fix these errors and try again:\n${errors.join('\n')}`;
}
