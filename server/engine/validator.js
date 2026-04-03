/**
 * Validator — Strict schema validation for AI-generated content
 * 
 * Validates:
 *   - Teaching timeline responses
 *   - Doubt response payloads
 *   - Individual scene objects
 */

// ─── Safe JSON Parse ───
export function safeParse(content) {
  if (!content || typeof content !== 'string') return null;
  try {
    let cleaned = content.trim();
    // Strip markdown code fences
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── Validate a single scene object ───
function validateObject(obj, index) {
  const errors = [];
  
  if (!obj || typeof obj !== 'object') {
    errors.push(`object[${index}]: not a valid object`);
    return errors;
  }

  if (!obj.id) errors.push(`object[${index}]: missing 'id'`);
  if (!obj.shape && !obj.type) errors.push(`object[${index}]: missing 'shape' or 'type'`);

  const shape = (obj.shape || obj.type || '').toLowerCase();
  const validShapes = ['circle', 'rect', 'rectangle', 'box', 'line', 'arrow', 'text', 'label', 'formula', 'orbit', 'planet', 'arc', 'angle', 'group', 'connector', 'badge', 'codeblock'];

  if (shape && !validShapes.includes(shape)) {
    errors.push(`object[${index}]: unknown shape '${shape}'`);
  }

  return errors;
}

// ─── Validate a step ───
function validateStep(step, index) {
  const errors = [];

  if (!step || typeof step !== 'object') {
    errors.push(`step[${index}]: not a valid object`);
    return errors;
  }

  if (!step.label && !step.title && !step.description) {
    errors.push(`step[${index}]: must have at least one of 'label', 'title', or 'description'`);
  }

  return errors;
}

// ─── Validate Teaching Timeline ───
export function validateTimeline(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object'] };
  }

  // Must have title
  if (!data.title || typeof data.title !== 'string') {
    errors.push("Missing or invalid 'title' (string required)");
  }

  // Must have steps array
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push("Missing or empty 'steps' array (at least 2 steps required)");
  } else {
    if (data.steps.length < 2) {
      errors.push("'steps' must have at least 2 items for a teaching timeline");
    }
    data.steps.forEach((step, i) => {
      const stepErrors = validateStep(step, i);
      errors.push(...stepErrors);
    });
  }

  // Must have objects array
  if (!Array.isArray(data.objects) || data.objects.length === 0) {
    errors.push("Missing or empty 'objects' array (visual shapes required)");
  } else {
    data.objects.forEach((obj, i) => {
      const objErrors = validateObject(obj, i);
      errors.push(...objErrors);
    });
  }

  // Optional but validated if present
  if (data.domain && typeof data.domain !== 'string') {
    errors.push("'domain' must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Validate Doubt Response ───
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

  // If relevant and has visuals, validate them
  if (data.isRelevant && data.hasVisuals) {
    if (data.visualUpdate) {
      if (data.visualUpdate.objects) {
        if (!Array.isArray(data.visualUpdate.objects)) {
          errors.push("'visualUpdate.objects' must be an array");
        } else {
          data.visualUpdate.objects.forEach((obj, i) => {
            const objErrors = validateObject(obj, i);
            errors.push(...objErrors);
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Build Retry Prompt from Errors ───
export function buildRetryPrompt(errors) {
  return `YOUR PREVIOUS OUTPUT WAS INVALID. Fix these errors and try again:
${errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}

Return ONLY valid JSON matching the exact schema specified. No markdown, no commentary.`;
}
