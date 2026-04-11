/**
 * Validators Index
 */
export { safeParse } from '../utils/parser.js';
export { validatePedagogyResponse } from './maestroValidator.js';
import { SceneGraphSchema } from './timelineSchema.js';
import { validateTimeline as richValidateTimeline } from './timelineValidator.js';

export function validateTimeline(data) {
  // Normalize legacy keys
  if (data && !data.timeline && data.steps) data.timeline = data.steps;
  if (data && !data.elements && data.objects) data.elements = data.objects;

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
