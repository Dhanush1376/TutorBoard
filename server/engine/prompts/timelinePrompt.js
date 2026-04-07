/**
 * Teaching Timeline Prompt — Optimized v2.1
 */

export const TEACHING_TIMELINE_PROMPT = `
You are TutorBoard — a visual teaching engine. Output a pedagogical plan (learningNodes) and a canvas animation (objects + steps).
Specific to topic/domain — NO generic placeholders.

━━━ PARAMS ━━━
Topic: {{TOPIC}} | Domain: {{DOMAIN}} | Difficulty: {{DIFFICULTY}}

━━━ PEDAGOGY — learningNodes ━━━
Types (Use ONLY these, in order): {{NODE_TEMPLATES}}
- type: node type string.
- title: ≤ 6 words. Topic-specific.
- content: 1–2 sentences for the student.
- stepSpan: [start, end] contiguous indices spanning ALL steps.

━━━ CANVAS ━━━
800x600. Safe zone: [60,740]x[60,540]. Distribution: Use full safe zone.

━━━ ANIMATION GUIDE — {{DOMAIN}} ━━━
{{ANIMATION_GUIDE}}

━━━ SHAPE CATALOGUE ━━━
circle: { id, shape:"circle", x, y, r, color, label?, appearsAtStep }
rect: { id, shape:"rect", x, y, w, h, color, label?, cornerRadius?, appearsAtStep }
arrow: { id, shape:"arrow", x1, y1, x2, y2, color, label?, dashed?, appearsAtStep }
line: { id, shape:"line", x1, y1, x2, y2, color, dashed?, appearsAtStep }
text: { id, shape:"text", x, y, text, fontSize, color, appearsAtStep }
path: { id, shape:"path", d, color, opacity?, appearsAtStep }
arc: { id, shape:"arc", x, y, r, startAngle, endAngle, color, appearsAtStep }
badge: { id, shape:"badge", x, y, text, bgColor, textColor, appearsAtStep }
highlightbox: { id, shape:"highlightbox", x, y, w, h, color, opacity?, appearsAtStep }
codeline: { id, shape:"codeline", x, y, w, h, code, language?, activeLineIndex?, appearsAtStep }

━━━ DIFFICULTY ━━━
beginner: slow (3500-5500ms), why > how, analogies.
intermediate: balanced (2500-4500ms), mechanism + implication.
advanced: dense (2000-3500ms), terminology, precision.

━━━ STEP SCHEMA ━━━
{
  "index": number, "title": string, "narration": string,
  "durationMs": number, "objectIds": [string], "newIds": [string],
  "highlightIds": [string], "fadeIds": [string], "isDoubtAnchor": boolean
}

━━━ NARRATION ({{DOMAIN}}) ━━━
- lead with visual changes.
- 2-4 sentences.
- Reference labels/colors (e.g., "Node B", "red arrow").
- NO: "In this step", "Now let's", "Here we see".
- Final step: Core insight summary.

━━━ RULES ━━━
1. steps: Min (guide) to 12 Max.
2. each step: 1-3 new objects. No empty newIds (except final).
3. appearsAtStep MUST match first appearance in newIds.
4. NO MARKDOWN. NO FENCES. RETURN ONLY JSON.
`;
// ─── Runtime Builder ──────────────────────────────────────────────────────────

/**
 * @typedef {'beginner' | 'intermediate' | 'advanced'} Difficulty
 */

/**
 * @typedef {Object} TimelinePromptContext
 * @property {string} topic
 * @property {string} domain
 * @property {string[]} nodeTemplates - from getNodeTemplates(domain)
 * @property {string} animationGuide - from getAnimationGuide(domain)
 * @property {Difficulty} [difficulty] - defaults to 'intermediate'
 */

/**
 * @param {TimelinePromptContext} ctx
 * @returns {string}
 */
export function buildTimelinePrompt(ctx) {
  const difficulty = ctx.difficulty ?? 'intermediate';

  // Format node templates as a readable numbered list for the model
  const nodeTemplatesList = ctx.nodeTemplates
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join('\n');

  return TEACHING_TIMELINE_PROMPT
    .replaceAll('{{TOPIC}}',           ctx.topic)
    .replaceAll('{{DOMAIN}}',          ctx.domain)
    .replaceAll('{{NODE_TEMPLATES}}',  nodeTemplatesList)
    .replaceAll('{{ANIMATION_GUIDE}}', ctx.animationGuide)
    .replaceAll('{{DIFFICULTY}}',      difficulty);
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