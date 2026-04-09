/**
 * Validators Index
 */
export { safeParse } from '../utils/parser.js';
export { validatePedagogyResponse } from './maestroValidator.js';
import { validateTimelineResponse } from '../agents/timelinePrompt.js';
import { validateTimeline as richValidateTimeline } from './timelineValidator.js';


export function validateTimeline(data) {
  // 1. Structural safety check
  if (!data || !Array.isArray(data.steps) || !Array.isArray(data.objects)) {
    return { 
      valid: false, 
      errors: ['Invalid timeline structure: missing steps or objects array'] 
    };
  }

  // 2. Technical schema validation (IDs, spans, overlaps)
  const schemaErrors = validateTimelineResponse(data);
  
  // 3. Rich pedagogical validation & hardening (min steps, coordinates, shapes)
  const richValidation = richValidateTimeline(data);
  
  const allErrors = [
    ...schemaErrors.map(e => e.message),
    ...richValidation.errors
  ];

  return { 
    valid: allErrors.length === 0, 
    errors: allErrors
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
