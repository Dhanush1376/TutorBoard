/**
 * Teaching Timeline Prompt — Optimized v2.1
 */

export const TEACHING_TIMELINE_PROMPT = `You are TutorBoard — a minimalist teaching engine. Output a pedagogical plan (learningNodes) and a canvas animation (objects + steps).
Your goal is clarity and understandability, not visual flair. Avoid unnecessary visuals, distractions, or complex jargon.

━━━ MINIMALIST VISUAL RULES ━━━
1. NO GLOW / NEON: Do not use glow:true or any neon-bloom effects.
2. NO 3D / SHADOWS: Avoid 3D-like gradients or heavy drop-shadows.
3. CLEAN LABELS: Every object representing a logic unit MUST be labeled clearly.
4. SIMPLE COLORS: Use flat, high-contrast colors. No complex gradients.
5. NO CINEMATIC FILLER: No pulse, float, or orbit animations unless functionally necessary.
6. EXAM CLARITY: Ensure all diagrams look like they could be drawn in an exam.
7. DEPTH: You MUST generate at least {{MIN_STEPS}} steps for this topic to ensure pedagogical completeness.
8. PREMIUM SHAPES: For DSA/Algorithms, prioritize using 'pointer', 'swapbridge', and 'comparator' over basic arrows and text.

━━━ PARAMS ━━━
Topic: {{TOPIC}} | Domain: {{DOMAIN}} | Difficulty: {{DIFFICULTY}}

━━━ PLANNING CONTEXT ━━━
Concept Type: {{CONCEPT_TYPE}}
Learning Goal: {{LEARNING_GOAL}}
Explanation Strategy: {{STRATEGY}}
Visualization Type: {{VIS_TYPE}}

━━━ BEHAVIOR — REQUIRED STEPS ━━━
{{BEHAVIOR_STEPS}}

━━━ EXECUTION STRATEGY ━━━
{{EXECUTION_STRATEGY}}

━━━ REFLECTION & FEEDBACK ━━━
{{REFLECTION_NOTES}}

━━━ PEDAGOGY — learningNodes (STRICT 5-PART) ━━━
Follow this sequence strictly:
1. Concept Explanation
2. Visual Representation Planning
3. Step-by-Step Process
4. Practical Example
5. Final Summary

Types (Use ONLY these): {{NODE_TEMPLATES}}
- type: node type string.
- title: ≤ 6 words. Topic-specific.
- content: 1–2 sentences for the student.
- exam_key: Essential point for learner.
- stepSpan: [start, end] contiguous indices.

━━━ ANIMATION VOCABULARY — MINIMALIST ━━━
entry: { type: "slideFromLeft"|"slideFromRight"|"slideFromTop"|"slideFromBottom"|"fadeIn"|"springIn"|"morph", duration: ms, easing: "linear" }
idle: { type: "none", intensity: "low", period: 0 }
highlight: { type: "shake"|"scale"|"ring", color: hex, scale: number }
exit: { type: "fadeOut"|"slideOut"|"shrink", duration: ms }

━━━ MOTION OVERRIDES — USE THESE IN STEP.motionOverrides ━━━
- id: target object ID.
- moveTo: { x, y } target coordinates.
- duration: ms.

━━━ RENDER MODES ━━━
- svg_canvas: ONLY allowed mode. Clean, flat SVG diagrams only. No HTML/React components.

━━━ STEP SCHEMA (AGENTIC MINIMAL) ━━━
{
  "index": number,
  "title": string,
  "narration": "Vivid, technically precise sentences (2-4). Explicitly mention objects by their labels, colors, and the 'premium' actions they are performing (e.g. 'the yellow pointer shifts to Index 5'). Focus on logical cause-and-effect.",
  "durationMs": number,
  "objectIds": [string],
  "newIds": [string],
  "highlightIds": [string],
  "transition": "fadeIn"|"slideUp"|"scaleIn"|"popIn"|"drawLine",
  "motionOverrides": [{ id, moveTo?, duration }],
  "contextUpdates": {
    "shapeId": { "context": "swap"|"sorted"|"compare", "values": [...], "highlightCells": [...] }
  }
}

━━━ SHAPE CATALOGUE (CLEAN & MINIMAL) ━━━

ARRAY: { id, shape:"array", x, y, values:[...], color, label?, showIndex:bool, appearsAtStep }

CIRCLE: { id, shape:"circle", x, y, r, color, label?, innerLabel?, pulse:false, glow:false, appearsAtStep }

RECT: { id, shape:"rect", x, y, w, h, color, label?, rx:0, appearsAtStep }

ARROW: { id, shape:"arrow", x1, y1, x2, y2, color, label?, dashed:bool, thickness:1, appearsAtStep }

LINE: { id, shape:"line", x1, y1, x2, y2, color, dashed:bool, appearsAtStep }

TEXT: { id, shape:"text", x, y, text, fontSize:14-24, color, fontWeight:"600", appearsAtStep }

━━━ RULES ━━━
1. render_mode: MUST be "svg_canvas".
2. COORDINATES: [60,740]x[60,540].
3. NO MARKDOWN. NO FENCES. RETURN ONLY JSON.
`;

/**
 * @param {TimelinePromptContext} ctx
 * @returns {string}
 */
export function buildTimelinePrompt(ctx) {
  const difficulty = ctx.difficulty ?? ctx.plan?.difficulty_level ?? 'intermediate';
  const plan = ctx.plan || {};
  
  // Reflection-aware data selection
  const reflection = ctx.reflection || { status: 'good', issues: [] };
  const isRefined = reflection.status === 'needs_improvement';
  
  const behaviorSteps = isRefined && reflection.refined_steps?.length > 0 
    ? reflection.refined_steps 
    : (ctx.behavior?.steps || []);

  const executionSteps = isRefined && reflection.execution_adjustments?.length > 0
    ? reflection.execution_adjustments
    : (ctx.execution?.execution_plan || []);

  // Format behavior steps for the model
  const behaviorStepsFormatted = behaviorSteps.map(s => {
    const exec = s.execution || {};
    return `Step ${s.step_number}: (${s.concept_unit})\n  Explanation: ${s.explanation}\n  Clarification: ${s.micro_clarification}\n  Visual Hint: ${s.visual_hint}\n  Execution: intensity=${exec.intensity || 'medium'}, pacing=${exec.pacing || 'slow'}, interaction=${exec.interaction || 'guided'}`;
  }).join('\n\n');

  // Format execution strategy
  const executionStrategyFormatted = executionSteps.map(p => (
    `Step ${p.step_number}: intensity=${p.visualization_intensity}, mode=${p.interaction_type}, pace=${p.pacing}`
  )).join('\n');

  // Format reflection notes
  const reflectionNotes = isRefined
    ? `CRITICAL IMPROVEMENTS APPLIED: ${reflection.issues.join(', ')}`
    : 'Planning and Behavior approved by ReflectionAgent.';

  // Format node templates as a readable numbered list for the model
  const nodeTemplatesList = ctx.nodeTemplates
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join('\n');

  let prompt = TEACHING_TIMELINE_PROMPT
    .replaceAll('{{TOPIC}}',           ctx.topic)
    .replaceAll('{{DOMAIN}}',          ctx.domain)
    .replaceAll('{{NODE_TEMPLATES}}',  nodeTemplatesList)
    .replaceAll('{{ANIMATION_GUIDE}}', ctx.animationGuide)
    .replaceAll('{{DIFFICULTY}}',      difficulty)
    .replaceAll('{{CONCEPT_TYPE}}',    plan.concept_type || 'general')
    .replaceAll('{{LEARNING_GOAL}}',   plan.learning_goal || 'Understand the core concept')
    .replaceAll('{{STRATEGY}}',        plan.explanation_strategy || 'step_by_step')
    .replaceAll('{{VIS_TYPE}}',        plan.visualization_type || 'abstract_visual')
    .replaceAll('{{BEHAVIOR_STEPS}}',  behaviorStepsFormatted || 'Follow a logical progression.')
    .replaceAll('{{EXECUTION_STRATEGY}}', executionStrategyFormatted || 'Maintain steady pacing.')
    .replaceAll('{{REFLECTION_NOTES}}', reflectionNotes)
    .replaceAll('{{SCENE_SCAFFOLD}}', JSON.stringify(ctx.visualScaffold || [], null, 2))
    .replaceAll('{{MIN_STEPS}}', String(ctx.minSteps || 10));

  if (ctx.grounding) {
    prompt = `${ctx.grounding}\n\n${prompt}`;
  }

  return prompt;
}

// ─── Response Types ───────────────────────────────────────────────────────────

/**
 * @typedef { 'circle' | 'rect' | 'arrow' | 'line' | 'text' | 'path' | 'arc' | 'badge' | 'highlightbox' | 'codeline' } ShapeType
 */

/**
 * @typedef {Object} CanvasShape
 * @property {string} id
 * @property {ShapeType} shape
 * @property {number} appearsAtStep
 */

/**
 * @typedef {Object} LearningNode
 * @property {string} type
 * @property {string} title
 * @property {string} content
 * @property {[number, number]} stepSpan
 */

/**
 * @typedef {Object} TimelineStep
 * @property {number} index
 * @property {string} title
 * @property {string} narration
 * @property {number} durationMs
 * @property {string[]} objectIds
 * @property {string[]} newIds
 * @property {string[]} highlightIds
 * @property {string[]} fadeIds
 * @property {boolean} isDoubtAnchor
 */

/**
 * @typedef {Object} TeachingTimelineResponse
 * @property {'explain'} mode
 * @property {string} title
 * @property {string} domain
 * @property {Difficulty} difficulty
 * @property {number} totalSteps
 * @property {LearningNode[]} learningNodes
 * @property {CanvasShape[]} objects
 * @property {TimelineStep[]} steps
 */

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TimelineValidationError
 * @property {string} code
 * @property {string} message
 */

/**
 * @param {TeachingTimelineResponse} r
 * @returns {TimelineValidationError[]}
 */
export function validateTimelineResponse(r) {
  const errors = [];
  const objectIdSet = new Set(r.objects.map(o => o.id));
  const seenInNewIds = new Set();

  const difficulty = r.difficulty || 'intermediate';
  const limits = {
    beginner:     { min: 3500, max: 5500 },
    intermediate: { min: 2500, max: 4500 },
    advanced:     { min: 2000, max: 3500 },
  };
  const { min, max } = limits[difficulty] || limits.intermediate;

  // ── Step-level checks ─────────────────────────────────────────────────────
  for (const step of r.steps) {
    const ctx = `Step ${step.index} ("${step.title}")`;

    // All referenced IDs must exist
    for (const id of [...step.objectIds, ...step.newIds, ...step.highlightIds, ...step.fadeIds]) {
      if (!objectIdSet.has(id)) {
        errors.push({ code: 'UNKNOWN_ID', message: `${ctx}: ID "${id}" not found in objects array.` });
      }
    }

    // newIds must not repeat across steps
    for (const id of step.newIds) {
      if (seenInNewIds.has(id)) {
        errors.push({ code: 'DUPLICATE_NEW_ID', message: `${ctx}: "${id}" appears in newIds more than once.` });
      }
      seenInNewIds.add(id);
    }

    // highlightIds and fadeIds must not overlap
    const hl = new Set(step.highlightIds);
    for (const id of step.fadeIds) {
      if (hl.has(id)) {
        errors.push({ code: 'HIGHLIGHT_FADE_OVERLAP', message: `${ctx}: "${id}" is in both highlightIds and fadeIds.` });
      }
    }

    // appearsAtStep must match newIds step
    for (const id of step.newIds) {
      const obj = r.objects.find(o => o.id === id);
      if (obj && obj.appearsAtStep !== step.index) {
        errors.push({ code: 'APPEARS_AT_STEP_MISMATCH', message: `${ctx}: "${id}" has appearsAtStep=${obj.appearsAtStep} but first appears in newIds at step ${step.index}.` });
      }
    }

    // durationMs sanity - based on difficulty rules in prompt
    if (step.durationMs < min || step.durationMs > max) {
      errors.push({ code: 'DURATION_OUT_OF_RANGE', message: `${ctx}: durationMs=${step.durationMs} out of [${min}, ${max}] for ${difficulty} difficulty.` });
    }
  }

  // ── Doubt anchor check ────────────────────────────────────────────────────
  const anchorCount = r.steps.filter(s => s.isDoubtAnchor).length;
  if (anchorCount < 2) {
    errors.push({ code: 'INSUFFICIENT_DOUBT_ANCHORS', message: `Only ${anchorCount} doubt anchor(s). Minimum is 2.` });
  }

  // ── learningNode stepSpan checks ──────────────────────────────────────────
  const totalSteps = r.steps.length;
  const covered = new Array(totalSteps).fill(false);

  for (const node of r.learningNodes) {
    const [start, end] = node.stepSpan;
    if (start < 0 || end >= totalSteps || start > end) {
      errors.push({ code: 'INVALID_STEP_SPAN', message: `Node "${node.type}" has invalid stepSpan [${start},${end}] for ${totalSteps} steps.` });
      continue;
    }
    for (let i = start; i <= end; i++) {
      if (covered[i]) {
        errors.push({ code: 'STEP_SPAN_OVERLAP', message: `Node "${node.type}" overlaps at step ${i}.` });
      }
      covered[i] = true;
    }
  }

  const uncovered = covered.map((c, i) => c ? null : i).filter(i => i !== null);
  if (uncovered.length > 0) {
    errors.push({ code: 'STEP_SPAN_GAP', message: `Steps ${uncovered.join(', ')} not covered by any learningNode stepSpan.` });
  }

  // ── totalSteps consistency ────────────────────────────────────────────────
  if (r.totalSteps !== r.steps.length) {
    errors.push({ code: 'TOTAL_STEPS_MISMATCH', message: `totalSteps=${r.totalSteps} but steps array has ${r.steps.length} entries.` });
  }

  return errors;
}


// ─── Usage Example ────────────────────────────────────────────────────────────
/*
import { getDomainConfig }      from './domainConfig';
import { buildTimelinePrompt,
         validateTimelineResponse,
         TeachingTimelineResponse } from './teachingTimelinePrompt';

const topic  = "How does Dijkstra's algorithm work?";
const config = getDomainConfig(topic);

const prompt = buildTimelinePrompt({
  topic,
  domain:         config.primary,
  nodeTemplates:  config.nodeTemplates,
  animationGuide: config.animationGuide,
  difficulty:     'intermediate',
});

const raw    = await callClaude(prompt);           // your API call
const parsed = JSON.parse(raw) as TeachingTimelineResponse;
const errors = validateTimelineResponse(parsed);

if (errors.length > 0) {
  console.warn('Timeline validation failed:', errors);
  // retry or surface to user
} else {
  renderLesson(parsed);
}
*/
// --- Response Schema (Gemini Optimized) -------------------------------------

export const TIMELINE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["explain"] },
    title: { type: "string" },
    domain: { type: "string" },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    render_mode: { type: "string", enum: ["svg_canvas"] },
    tech_rationale: { type: "string" },
    totalSteps: { type: "number" },
    learningNodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          stepSpan: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }
        },
        required: ["type", "title", "content", "stepSpan"]
      }
    },
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          shape: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          r: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          color: { type: "string" },
          label: { type: "string" },
          appearsAtStep: { type: "number" },
          animation: {
            type: "object",
            properties: {
              entry: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  duration: { type: "number" },
                  easing: { type: "string" }
                }
              },
              idle: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  intensity: { type: "string" },
                  period: { type: "number" }
                }
              },
              highlight: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  color: { type: "string" },
                  scale: { type: "number" }
                }
              },
              exit: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  duration: { type: "number" }
                }
              }
            }
          },
          context: { type: "string" }
        },
        required: ["id", "shape", "appearsAtStep"]
      }
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          title: { type: "string" },
          narration: { type: "string" },
          durationMs: { type: "number" },
          objectIds: { type: "array", items: { type: "string" } },
          newIds: { type: "array", items: { type: "string" } },
          highlightIds: { type: "array", items: { type: "string" } },
          fadeIds: { type: "array", items: { type: "string" } },
          motionOverrides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                moveTo: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" } }
                },
                scaleTo: { type: "number" },
                rotateTo: { type: "number" },
                colorTo: { type: "string" },
                duration: { type: "number" }
              },
              required: ["id"]
            }
          },
          cameraHint: {
            type: "object",
            properties: {
              focusX: { type: "number" },
              focusY: { type: "number" },
              zoom: { type: "number" }
            }
          },
          isDoubtAnchor: { type: "boolean" },
          pacing: { type: "string", enum: ["slow", "medium", "fast"] },
          transition: { type: "string" },
          contextUpdates: { type: "object" }
        },
        required: ["index", "title", "narration", "durationMs", "objectIds"]
      }
    },
    component_code: { type: "string" }
  },
  required: ["mode", "title", "domain", "render_mode", "learningNodes", "objects", "steps"]
};
