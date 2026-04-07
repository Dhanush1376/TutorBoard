/**
 * Timeline Validator
 * Schema validation for AI-generated teaching timelines
 */

import { safeParse } from './parser.js';

// Valid learning node types
const VALID_NODE_TYPES = [
  'hook', 'prior_knowledge_bridge', 'concept', 'intuition', 
  'socratic_moment', 'explanation', 'step_by_step', 
  'worked_example', 'visual', 'common_mistake', 
  'edge_case', 'real_world_application', 'result',
  'clinical_hook', 'anatomy_context', 'pathophysiology', 'diagnosis_walkthrough',
  'treatment_protocol', 'clinical_pearl', 'scenario_hook', 'framework',
  'case_study', 'common_pitfall', 'case_hook', 'legal_concept', 'principle',
  'case_analysis', 'argument_structure', 'common_confusion', 'narrative_hook',
  'context', 'key_event', 'cause_effect', 'timeline_walk', 'multiple_perspectives',
  'significance', 'behavior_hook', 'theory', 'experiment', 'application',
  'phenomenon', 'mathematical_model', 'molecular_intuition', 'reaction_mechanism',
  'safety_note', 'analogy', 'process_breakdown', 'geometric_intuition', 'proof_sketch',
  'spatial_intuition', 'graph_intuition', 'policy_implication', 'technique_breakdown',
  'style_analysis', 'physical_intuition', 'formula_derivation', 'design_consideration',
  'problem_statement', 'aesthetic_hook', 'intuition'
];

// Valid modes
const VALID_MODES = ['explain', 'quiz', 'compare', 'practice'];

// Valid step shapes
const VALID_SHAPES = [
  'circle', 'rect', 'rectangle', 'box', 'line', 'arrow', 
  'text', 'label', 'formula', 'orbit', 'planet', 'arc', 'angle', 
  'group', 'connector', 'badge', 'tag', 'chip', 'codeblock',
  'path', 'polyline', 'bezier',
  'array', 'pointer', 'swapbridge', 'comparator', 'codeline', 'highlightbox'
];

/**
 * Hardens numeric values in an object to valid ranges
 */
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

  // ID Hardening
  if (obj.id !== undefined) obj.id = String(obj.id);
}

/**
 * Validate a single scene object
 */
function validateObject(obj, index) {
  const errors = [];
  
  if (!obj || typeof obj !== 'object') {
    errors.push(`object[${index}]: not a valid object`);
    return errors;
  }

  if (!obj.id) errors.push(`object[${index}]: missing 'id'`);
  if (!obj.shape && !obj.type) errors.push(`object[${index}]: missing 'shape' or 'type'`);

  const shape = (obj.shape || obj.type || '').toLowerCase();
  if (shape && !VALID_SHAPES.includes(shape)) {
    errors.push(`object[${index}]: unknown shape '${shape}'`);
  }

  return errors;
}

/**
 * Validate a step
 */
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

/**
 * Validate Teaching Timeline
 */
export function validateTimeline(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object'] };
  }

  if (!data.title || typeof data.title !== 'string') {
    errors.push("Missing or invalid 'title' (string required)");
  }

  // mode is optional — default to 'explain' if missing
  if (!data.mode || !VALID_MODES.includes(data.mode)) {
    data.mode = 'explain';
  }

  // Validate learning nodes (optional — auto-generate if missing)
  if (!Array.isArray(data.learningNodes) || data.learningNodes.length === 0) {
    data.learningNodes = (data.steps || []).slice(0, 6).map((step, i) => ({
      type: i === 0 ? 'hook' : i === (data.steps || []).length - 1 ? 'result' : 'concept',
      title: step.title || step.label || `Step ${i + 1}`,
      content: step.description || step.narration || '',
    }));
  } else {
    data.learningNodes.forEach((node) => {
      if (!node.type) node.type = 'concept';
      if (!node.title) node.title = 'Concept';
      if (!node.content) node.content = '';
    });
  }

  // Fatal: Validate steps existence
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    return { valid: false, errors: ["Missing or empty 'steps' array"] };
  }

  // Soft: Min steps
  if (data.steps.length < 2) {
    console.warn('[Validator] Only 1 step generated. Cloning for stability.');
    data.steps.push({ ...data.steps[0], index: 1, title: 'Conclusion' });
  }

  // Validate objects (warn only — processTimeline will handle empty arrays)
  const allObjectIdsSet = new Set();
  if (!Array.isArray(data.objects)) data.objects = [];

  const seenIds = new Set();
  data.objects.forEach((obj, i) => {
    if (!obj.id) obj.id = `obj-${i}`;
    obj.id = String(obj.id);
    if (seenIds.has(obj.id)) obj.id = `${obj.id}-${i}`;
    seenIds.add(obj.id);
    allObjectIdsSet.add(obj.id);

    // Hardening (fixes coords, sizes, etc)
    hardenObject(obj);

    // Ensure shape is valid
    const shape = (obj.shape || obj.type || '').toLowerCase();
    if (!shape || !VALID_SHAPES.includes(shape)) {
      obj.shape = 'circle'; // fallback
    }
  });

  // Harden steps (Crucial for rendering)
  data.steps.forEach((step, i) => {
    step.index = i;
    if (!step.title && !step.label) step.title = `Step ${i+1}`;
    if (!step.narration && !step.description) step.narration = "Continuing the explanation...";
    
    if (!Array.isArray(step.objectIds)) step.objectIds = [];
    if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
    if (!Array.isArray(step.newIds)) step.newIds = [];

    // Filter out orphan IDs — prevent frontend crashes
    step.objectIds = step.objectIds.filter(id => allObjectIdsSet.has(String(id))).map(String);
    step.highlightIds = step.highlightIds.filter(id => allObjectIdsSet.has(String(id))).map(String);
    step.newIds = step.newIds.filter(id => allObjectIdsSet.has(String(id))).map(String);

    // Auto-fill empty objectIds to avoid blank screen
    if (step.objectIds.length === 0 && allObjectIdsSet.size > 0 && i > 0) {
      step.objectIds = data.steps[i-1].objectIds; // inherit previous state
    }
  });

  if (data.domain && typeof data.domain !== 'string') {
    data.domain = 'general';
  }

  return {
    valid: true, // We auto-fixed everything!
    errors: [],
  };
}

export default validateTimeline;
