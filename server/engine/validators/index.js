/**
 * Validators Index
 */
export { safeParse } from '../utils/parser.js';
export { validatePedagogyResponse } from './maestroValidator.js';

export function validateTimeline(data) {
  // Simple pass-through or basic structural check
  if (!data || !Array.isArray(data.steps)) return { valid: false, errors: ['Invalid timeline structure'] };
  return { valid: true, errors: [] };
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
