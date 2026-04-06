/**
 * Parser & Validator Index
 * Re-exports all validation modules
 */

export { safeParse } from './parser.js';
export { validateTimeline } from './timelineValidator.js';
export { validateDoubtResponse } from './doubtValidator.js';

export function buildRetryPrompt(errors) {
  return `YOUR PREVIOUS OUTPUT WAS INVALID. Fix these errors and try again:
${errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}

Return ONLY valid JSON matching the exact schema specified. No markdown, no commentary.`;
}

export function buildCondensedPrompt() {
  return `Your session was truncated because the response was too long. Please REGENERATE the full lesson, but be SIGNIFICANTLY more concise. Keep narrations to 1-2 short sentences. Reduce the number of steps if needed to fit the token limit. Return ONLY complete valid JSON.`;
}
