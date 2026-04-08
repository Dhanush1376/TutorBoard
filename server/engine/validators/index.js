/**
 * Validators Index
 */
export { safeParse } from '../utils/parser.js';
export { validatePedagogyResponse } from './maestroValidator.js';
import { validateTimelineResponse } from '../agents/timelinePrompt.js';

export function validateTimeline(data) {
  // Structural safety check before calling rich validator
  if (!data || !Array.isArray(data.steps) || !Array.isArray(data.objects)) {
    return { 
      valid: false, 
      errors: ['Invalid timeline structure: missing steps or objects array'] 
    };
  }

  const errors = validateTimelineResponse(data);
  return { 
    valid: errors.length === 0, 
    errors: errors.map(e => e.message) 
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
