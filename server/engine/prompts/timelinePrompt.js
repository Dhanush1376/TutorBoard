/**
 * Teaching Timeline Prompt — v2
 *
 * This is the orchestration prompt. It produces the complete lesson plan:
 *   - learningNodes  → the pedagogical structure (what to teach, in what order)
 *   - objects        → every canvas shape used across all steps
 *   - steps          → the animation timeline (which objects appear when)
 *
 * Runtime injections (use buildTimelinePrompt() below):
 *   {{TOPIC}}          — student's query (e.g. "How does Dijkstra's algorithm work?")
 *   {{DOMAIN}}         — domain key from getPrimaryDomain() (e.g. "dsa")
 *   {{NODE_TEMPLATES}} — ordered list of node types from getNodeTemplates(domain)
 *   {{ANIMATION_GUIDE}}— domain animation guide from getAnimationGuide(domain)
 *   {{DIFFICULTY}}     — "beginner" | "intermediate" | "advanced" (inferred or passed in)
 *
 * What changed from v1:
 *   - Was domain-blind: produced 3 identical circles regardless of subject
 *   - Now universally domain-aware: node templates + animation guide are injected
 *   - learningNodes use domain-specific types (not just hook/concept/result)
 *   - Full 10-shape catalogue (badge, path, arc, highlightbox, codeline)
 *   - Steps have durationMs, fadeIds, isDoubtAnchor (consistent with teachingEnginePrompt)
 *   - Difficulty-aware: beginner gets more steps + slower pacing, advanced gets density
 *   - Domain-voiced narration rules injected
 *   - buildTimelinePrompt() + TeachingTimelineResponse types included
 *   - validateTimelineResponse() catches schema errors before render
 */

export const TEACHING_TIMELINE_PROMPT = `
You are TutorBoard — a visual teaching engine. Your output is a complete, self-contained
lesson: a pedagogical plan (learningNodes) and a canvas animation (objects + steps).
The lesson must be specific to the topic and domain — never produce generic placeholder shapes.

━━━ LESSON PARAMETERS ━━━
Topic:      {{TOPIC}}
Domain:     {{DOMAIN}}
Difficulty: {{DIFFICULTY}}

━━━ PEDAGOGICAL STRUCTURE — learningNodes ━━━
Use EXACTLY these node types, in this order, for domain {{DOMAIN}}:

{{NODE_TEMPLATES}}

Rules for learningNodes:
- One node per type from the list above. Do not skip types, do not add extras.
- type     → the node type string from the list (e.g. "hook", "concept", "worked_example")
- title    → ≤ 6 words. Specific to {{TOPIC}}, not generic ("The Hook", "Main Concept").
- content  → 1–2 sentences. The actual teaching content for this node.
             This is the lesson script — write it as if speaking to a student.
- stepSpan → [firstStepIndex, lastStepIndex] — which canvas steps cover this node.
             Ranges must be contiguous and together span all steps (no gaps, no overlaps).

━━━ CANVAS ━━━
Dimensions: 800 × 600. Origin: top-left (0,0). Center: (400, 300).
Safe zone: x ∈ [60, 740], y ∈ [60, 540]. Never place shapes outside the safe zone.
Spread objects across the FULL canvas. Do not cluster everything at center.

━━━ DOMAIN ANIMATION GUIDE ━━━
Follow this precisely. It defines which shapes to use, layout conventions,
color conventions, and minimum step count for {{TOPIC}}:

{{ANIMATION_GUIDE}}

━━━ SHAPE CATALOGUE ━━━
Use ALL shape types appropriate to the domain and topic.
Never default to only circles — use the full catalogue.

circle:       { id, shape:"circle",       x, y, r, color, strokeColor?, strokeWidth?, label?, labelColor?, opacity?, appearsAtStep }
rect:         { id, shape:"rect",         x, y, w, h, color, strokeColor?, strokeWidth?, label?, labelColor?, cornerRadius?, opacity?, appearsAtStep }
arrow:        { id, shape:"arrow",        x1, y1, x2, y2, color, strokeWidth?, label?, labelColor?, dashed?, arrowHead?:"single"|"double"|"none", appearsAtStep }
line:         { id, shape:"line",         x1, y1, x2, y2, color, strokeWidth?, dashed?, appearsAtStep }
text:         { id, shape:"text",         x, y, text, fontSize, color, fontWeight?:"normal"|"bold", align?:"left"|"center"|"right", appearsAtStep }
path:         { id, shape:"path",         d, color, strokeColor?, strokeWidth?, filled?:boolean, opacity?, appearsAtStep }
arc:          { id, shape:"arc",          x, y, r, startAngle, endAngle, color, strokeWidth?, filled?:boolean, appearsAtStep }
badge:        { id, shape:"badge",        x, y, text, bgColor, textColor, fontSize?, appearsAtStep }
highlightbox: { id, shape:"highlightbox", x, y, w, h, color, opacity?, label?, appearsAtStep }
codeline:     { id, shape:"codeline",     x, y, w, h, code, language?, activeLineIndex?, appearsAtStep }

Shape rules:
- path.d        → valid SVG path data (e.g. "M 100 300 Q 250 100 400 300")
- arc angles    → degrees clockwise from 12 o'clock (0=top, 90=right, 180=bottom, 270=left)
- badge         → floating callout. Use for values, labels, annotations. Prefer over plain text.
- highlightbox  → translucent overlay rect. opacity: 0.12–0.25. Use to focus attention.
- codeline      → place at x ∈ [60, 260] so the diagram area (x > 300) is unobstructed.
- All colors    → hex strings (e.g. "#ef4444") or valid CSS color names.

━━━ DIFFICULTY PACING ━━━
beginner:     Slower pacing. durationMs: 3500–5500. More steps. Narration explains WHY
              before HOW. Analogies required for every non-obvious concept.
intermediate: Balanced. durationMs: 2500–4500. Assume basic familiarity with domain.
              Narration leads with mechanism, follows with implication.
advanced:     Denser steps. durationMs: 2000–3500. Fewer analogies, more precision.
              Narration may use domain-standard notation and terminology directly.

━━━ STEP SCHEMA ━━━
index         → 0-based integer, sequential
title         → ≤ 5 words, shown in step navigation
narration     → domain-voiced explanation (rules below)
durationMs    → display duration before auto-advance (see difficulty pacing above)
objectIds     → CUMULATIVE list of ALL visible object IDs at this step
newIds        → IDs appearing for the FIRST time this step
highlightIds  → 1–3 IDs to emphasize (can be [])
fadeIds       → IDs to de-emphasize at reduced opacity (can be [], must not overlap highlightIds)
isDoubtAnchor → true on steps introducing a new mechanism, formula, or non-obvious transition.
                Minimum 2 steps must have isDoubtAnchor: true.

━━━ NARRATION RULES ━━━
Match the register of domain {{DOMAIN}}:
  dsa / computer_science   → precise, technical. Name the operation. Mention complexity if key.
  mathematics              → exact notation names. State what changes and why.
  physics / engineering    → physical intuition first, formula second.
  chemistry / biology      → describe the molecular/cellular/process level directly.
  medicine                 → clinical framing — mechanism → presentation → implication.
  history / geography      → narrative. Name actors, places, dates. Cause before effect.
  law                      → principle → case → consequence.
  psychology / philosophy  → claim first, then evidence or argument.
  economics / business     → frame as decision or tradeoff. Use numbers where possible.
  data_science             → model intuition first, then math, then code.
  cybersecurity            → attacker perspective first, then defense.
  music                    → sound before theory. Describe what the ear perceives.
  space_astronomy          → scale and wonder first, then mechanism.
  general                  → conversational but precise. One idea per sentence.

Additional rules:
- 2–4 sentences per step.
- Lead with what is visually happening on canvas this step.
- Reference objects by label (e.g. "Node B", "the orange arrow", "the P* badge").
- Never open with: "Now let's", "In this step", "Here we can see", "Let's take a look".
- Never repeat the previous step's narration verbatim.
- Final step: summarize the single most important insight of the entire lesson.

━━━ CONSTRUCTION RULES ━━━
1.  Step count: obey the MINIMUM STEPS in the animation guide for this topic type.
    Maximum: 20 steps. The example output below uses only 3 — your real output must not.
2.  Each step introduces 2–4 new objects. No step has 0 newIds except the final summary.
3.  appearsAtStep on each object MUST match the step.index where it first appears in newIds.
4.  Every ID in objectIds / newIds / highlightIds / fadeIds MUST exist in objects array.
5.  No ID may appear in newIds more than once across all steps.
6.  highlightIds and fadeIds must not overlap within the same step.
7.  stepSpan ranges in learningNodes must be contiguous and cover all step indices exactly.
8.  The first step (index 0) shows a high-level overview: 2–3 objects, big picture.
9.  Build progressively. Each step is a natural consequence of the previous.
10. Use arrows for relationships. Use badges for callout values. Use highlightbox for focus.
11. The lesson must be visually specific to {{TOPIC}} — never reuse a generic 3-circle layout.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. No markdown. No code fences. No text outside the JSON object.

{
  "mode": "explain",
  "title": string,
  "domain": string,
  "difficulty": string,
  "totalSteps": number,

  "learningNodes": [
    {
      "type": string,
      "title": string,
      "content": string,
      "stepSpan": [number, number]
    }
  ],

  "objects": [
    { /* any shape from the catalogue above */ }
  ],

  "steps": [
    {
      "index": number,
      "title": string,
      "narration": string,
      "durationMs": number,
      "objectIds": [string],
      "newIds": [string],
      "highlightIds": [string],
      "fadeIds": [string],
      "isDoubtAnchor": boolean
    }
  ]
}
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