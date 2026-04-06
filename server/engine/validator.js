/**
 * Validator — Schema validation for AI-generated content
 * 
 * NEXT-GEN: Supports dynamic step counts, new shapes (path, badge),
 * and mutation-based doubt responses.
 */

// ─── Safe JSON Parse ───
export function safeParse(content) {
  if (!content || typeof content !== 'string') return null;
  try {
    let cleaned = content.trim();
    
    // Strip <think>...</think> blocks (DeepSeek R1 and other reasoning models)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    
    // Find the first '{' and last '}' to strip any leading/trailing commentary
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[Validator] safeParse Error:", err.message);
    return null;
  }
}

// ─── Data Hardening (Auto-fixer) ───
function hardenObject(obj) {
  if (!obj || typeof obj !== 'object') return;

  const toNum = (v, d) => {
    const n = parseFloat(v);
    return isNaN(n) ? d : n;
  };

  // Positional coordinates
  if ('x' in obj)  obj.x =  toNum(obj.x, 400);
  if ('y' in obj)  obj.y =  toNum(obj.y, 300);
  if ('cx' in obj) obj.cx = toNum(obj.cx, 400);
  if ('cy' in obj) obj.cy = toNum(obj.cy, 300);

  // Dimensions
  if ('r' in obj)    obj.r =    Math.max(2, toNum(obj.r, 40));
  if ('size' in obj) obj.size = Math.max(2, toNum(obj.size, 40));
  if ('w' in obj)    obj.w =    Math.max(5, toNum(obj.w, 100));
  if ('h' in obj)    obj.h =    Math.max(5, toNum(obj.h, 60));
  if ('width' in obj)  obj.width =  Math.max(5, toNum(obj.width, 100));
  if ('height' in obj) obj.height = Math.max(5, toNum(obj.height, 60));

  // Line/Arrow coordinates
  if ('x1' in obj) obj.x1 = toNum(obj.x1, 100);
  if ('y1' in obj) obj.y1 = toNum(obj.y1, 100);
  if ('x2' in obj) obj.x2 = toNum(obj.x2, 200);
  if ('y2' in obj) obj.y2 = toNum(obj.y2, 100);

  // Specialized props
  if ('orbitRadius' in obj) obj.orbitRadius = Math.max(10, toNum(obj.orbitRadius, 100));
  if ('startAngle' in obj)  obj.startAngle = toNum(obj.startAngle, 0);
  if ('endAngle' in obj)    obj.endAngle = toNum(obj.endAngle, 180);
  if ('thickness' in obj)   obj.thickness = Math.max(1, toNum(obj.thickness, 2));
  if ('strokeWidth' in obj) obj.strokeWidth = Math.max(1, toNum(obj.strokeWidth, 2));
  if ('fontSize' in obj)    obj.fontSize = Math.max(8, toNum(obj.fontSize, 16));

  // ID Hardening - ensure string
  if (obj.id !== undefined) obj.id = String(obj.id);
}

function hardenStep(step, allObjectIdsSet) {
  if (!step || typeof step !== 'object') return;

  // objectIds MUST be array
  if (!Array.isArray(step.objectIds)) step.objectIds = [];
  if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
  if (!Array.isArray(step.newIds)) step.newIds = [];

  // Ensure all objectIds are strings
  step.objectIds = step.objectIds.map(String);
  step.highlightIds = step.highlightIds.map(String);
  step.newIds = step.newIds.map(String);

  // 🚨 CRITICAL FIX: If objectIds is empty, use all known IDs or fallback
  if (step.objectIds.length === 0 && allObjectIdsSet.size > 0) {
    step.objectIds = Array.from(allObjectIdsSet);
    console.warn(`[Validator] Auto-filled empty objectIds in step ${step.index}`);
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
  const validShapes = [
    'circle', 'rect', 'rectangle', 'box', 'line', 'arrow', 
    'text', 'label', 'formula', 'orbit', 'planet', 'arc', 'angle', 
    'group', 'connector', 'badge', 'tag', 'chip', 'codeblock',
    'path', 'polyline', 'bezier',
    'array', 'pointer', 'swapbridge', 'comparator', 'codeline', 'highlightbox'
  ];

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

// ─── Validate a mutation ───
function validateMutation(mutation, index) {
  const errors = [];

  if (!mutation || typeof mutation !== 'object') {
    errors.push(`mutation[${index}]: not a valid object`);
    return errors;
  }

  const validActions = ['add', 'modify', 'remove', 'highlight'];
  if (!mutation.action || !validActions.includes(mutation.action)) {
    errors.push(`mutation[${index}]: invalid action '${mutation.action}'. Must be one of: ${validActions.join(', ')}`);
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

  return errors;
}

// ─── Validate Teaching Timeline ───
export function validateTimeline(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object'] };
  }

  if (!data.title || typeof data.title !== 'string') {
    errors.push("Missing or invalid 'title' (string required)");
  }

  const validModes = ['explain', 'quiz', 'compare', 'practice'];
  if (!data.mode || !validModes.includes(data.mode)) {
    errors.push(`Missing or invalid 'mode'. Must be one of: ${validModes.join(', ')}`);
  }

  if (!Array.isArray(data.learningNodes) || data.learningNodes.length < 4) {
    errors.push("Missing or invalid 'learningNodes' (array with at least 4 pedagogical steps required)");
  } else {
    const validNodeTypes = [
      'hook', 'prior_knowledge_bridge', 'concept', 'intuition', 
      'socratic_moment', 'explanation', 'step_by_step', 
      'worked_example', 'visual', 'common_mistake', 
      'edge_case', 'real_world_application', 'result'
    ];
    
    data.learningNodes.forEach((node, i) => {
      if (!node.type || !node.title || !node.content) {
        errors.push(`learningNodes[${i}]: missing 'type', 'title', or 'content'`);
      } else if (!validNodeTypes.includes(node.type.toLowerCase())) {
        errors.push(`learningNodes[${i}]: unknown type '${node.type}'. Expected one of: ${validNodeTypes.join(', ')}`);
      }
    });
  }

  // Dynamic step count: just require at least 2
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

  const allObjectIdsSet = new Set();
  if (!Array.isArray(data.objects) || data.objects.length === 0) {
    errors.push("Missing or empty 'objects' array (visual shapes required)");
  } else {
    const seenIds = new Set();
    data.objects.forEach((obj, i) => {
      // 🚨 AUTO-FIX: Ensure ID exists to prevent renderer crashes
      if (obj.id === undefined || obj.id === null) {
        obj.id = `auto-gen-${i}-${Math.random().toString(36).slice(2, 6)}`;
      }
      
      // Force ID to string
      obj.id = String(obj.id);

      // Fix duplicate IDs
      if (seenIds.has(obj.id)) {
        obj.id = `${obj.id}-dup-${i}`;
      }
      seenIds.add(obj.id);
      allObjectIdsSet.add(obj.id);

      // Hardening geometric data
      hardenObject(obj);

      const objErrors = validateObject(obj, i);
      errors.push(...objErrors);
    });
  }

  // Harden steps after objects are processed
  if (Array.isArray(data.steps)) {
    data.steps.forEach((step) => {
      hardenStep(step, allObjectIdsSet);
    });
  }

  if (data.domain && typeof data.domain !== 'string') {
    errors.push("'domain' must be a string");
  }

  // Metadata verification (optional but helpful)
  if (data.difficulty && !['beginner', 'intermediate', 'advanced'].includes(data.difficulty)) {
     // soft warning or just pass
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

  // Validate visual update if present
  if (data.isRelevant && data.hasVisuals && data.visualUpdate) {
    // Validate mutations (new format)
    if (data.visualUpdate.mutations) {
      if (!Array.isArray(data.visualUpdate.mutations)) {
        errors.push("'visualUpdate.mutations' must be an array");
      } else {
        data.visualUpdate.mutations.forEach((mut, i) => {
          // 🚨 AUTO-FIX: Ensure ID for 'add' mutations
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

// ─── Build Retry Prompt from Errors ───
export function buildRetryPrompt(errors) {
  return `YOUR PREVIOUS OUTPUT WAS INVALID. Fix these errors and try again:
${errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}

Return ONLY valid JSON matching the exact schema specified. No markdown, no commentary.`;
}
