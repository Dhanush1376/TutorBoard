/**
 * Doubt Response Validator
 * Schema validation for AI-generated doubt responses
 */

import { safeParse } from './parser.js';

// Valid mutation actions
const VALID_ACTIONS = ['add', 'modify', 'remove', 'highlight', 'annotate', 'connect'];

// Valid doubt categories
const VALID_DOUBT_CATEGORIES = [
  'misconception', 'missing_context', 'wants_deeper', 'wants_example', 'off_topic'
];

/**
 * Validate a mutation
 */
function validateMutation(mutation, index) {
  const errors = [];

  if (!mutation || typeof mutation !== 'object') {
    errors.push(`mutation[${index}]: not a valid object`);
    return errors;
  }

  if (!mutation.action || !VALID_ACTIONS.includes(mutation.action)) {
    errors.push(`mutation[${index}]: invalid action '${mutation.action}'. Must be one of: ${VALID_ACTIONS.join(', ')}`);
  }

  if (mutation.action === 'add' && !mutation.object) {
    errors.push(`mutation[${index}]: 'add' action requires 'object'`);
  }

  if (mutation.action === 'modify' && !mutation.targetId) {
    errors.push(`mutation[${index}]: 'modify' action requires 'targetId'`);
  }

  if (mutation.action === 'highlight' && !mutation.targetIds) {
    errors.push(`mutation[${index}]: 'highlight' action requires 'targetIds'`);
  }

  if (mutation.action === 'remove' && !mutation.targetId) {
    errors.push(`mutation[${index}]: 'remove' action requires 'targetId'`);
  }

  return errors;
}

/**
 * Validate Doubt Response
 */
export function validateDoubtResponse(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object'] };
  }

  if (!data.answer || typeof data.answer !== 'string') {
    errors.push("Missing or invalid 'answer' (string required)");
  }

  if (typeof data.isRelevant !== 'boolean') {
    errors.push("Missing 'isRelevant' (boolean required)");
  }

  // Validate category if present
  if (data.doubtCategory && !VALID_DOUBT_CATEGORIES.includes(data.doubtCategory)) {
    errors.push(`Invalid 'doubtCategory'. Must be one of: ${VALID_DOUBT_CATEGORIES.join(', ')}`);
  }

  // Validate visual update if present
  if (data.isRelevant && data.hasVisuals && data.visualUpdate) {
    // Validate mutations (new format)
    if (data.visualUpdate.mutations) {
      if (!Array.isArray(data.visualUpdate.mutations)) {
        errors.push("'visualUpdate.mutations' must be an array");
      } else {
        data.visualUpdate.mutations.forEach((mut, i) => {
          // Auto-fix: Ensure ID for 'add' mutations
          if (mut.action === 'add' && mut.object && !mut.object.id) {
            mut.object.id = `auto-gen-mut-${i}-${Date.now()}`;
          }
          const mutErrors = validateMutation(mut, i);
          errors.push(...mutErrors);
        });
      }
    }

    // Validate legacy objects (backward compat)
    if (data.visualUpdate.objects) {
      if (!Array.isArray(data.visualUpdate.objects)) {
        errors.push("'visualUpdate.objects' must be an array");
      } else {
        data.visualUpdate.objects.forEach((obj, i) => {
          if (!obj.id) obj.id = `auto-gen-legacy-${i}-${Date.now()}`;
          const objErrors = validateObject(obj, i);
          errors.push(...objErrors);
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single object (helper)
 */
function validateObject(obj, index) {
  const errors = [];
  
  if (!obj || typeof obj !== 'object') {
    errors.push(`object[${index}]: not a valid object`);
    return errors;
  }

  if (!obj.id) errors.push(`object[${index}]: missing 'id'`);

  return errors;
}

export default validateDoubtResponse;
