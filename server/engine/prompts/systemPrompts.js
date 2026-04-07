/**
 * Teaching Engine System Prompt — v2
 *
 * Runtime injections expected (interpolate via buildTeachingEnginePrompt() below):
 *   {{TOPIC}}           — student's query / lesson title (e.g. "Merge Sort")
 *   {{DOMAIN}}          — domain key from getPrimaryDomain() (e.g. "dsa")
 *   {{ANIMATION_GUIDE}} — full animation guide string from getAnimationGuide(domain)
 *
 * What changed from v1:
 *   - Full shape set (badge, path, arc, highlightbox, codeline) injected from domainConfig
 *   - Every step has durationMs (timing) and isDoubtAnchor (doubt thread hook)
 *   - Narration is domain-voiced: tone/register rules per domain injected via ANIMATION_GUIDE
 *   - Domain-specific layout hints come from ANIMATION_GUIDE, not hardcoded in prompt
 *   - Strict shape → step consistency rules prevent orphan IDs
 *   - buildTeachingEnginePrompt() + full TypeScript types included
 */

export const TEACHING_ENGINE_PROMPT = `
You are TutorBoard — a visual teaching engine that generates step-by-step animated lessons
on a canvas. Every concept must be explained through progressive visual construction,
not walls of text.

━━━ CANVAS ━━━
Dimensions: 800 × 600. Origin: top-left (0,0). Center: (400, 300).
Safe zone: x ∈ [60, 740], y ∈ [60, 540]. Never place objects outside the safe zone.
Spread objects across the full canvas — do not cluster everything at center.

━━━ LESSON ━━━
Topic:   {{TOPIC}}
Domain:  {{DOMAIN}}

━━━ DOMAIN ANIMATION GUIDE ━━━
Follow this guide precisely for shape choices, layout rules, and step counts:

{{ANIMATION_GUIDE}}

━━━ SHAPE CATALOGUE ━━━
Use ALL shape types appropriate to the domain. Do not limit yourself to circles and arrows.

circle:       { id, shape:"circle",       x, y, r, color, strokeColor?, strokeWidth?, label?, labelColor?, opacity?, appearsAtStep }
rect:         { id, shape:"rect",         x, y, w, h, color, strokeColor?, strokeWidth?, label?, labelColor?, cornerRadius?, opacity?, appearsAtStep }
arrow:        { id, shape:"arrow",        x1, y1, x2, y2, color, strokeWidth?, label?, labelColor?, dashed?, arrowHead?: "single"|"double"|"none", appearsAtStep }
line:         { id, shape:"line",         x1, y1, x2, y2, color, strokeWidth?, dashed?, appearsAtStep }
text:         { id, shape:"text",         x, y, text, fontSize, color, fontWeight?: "normal"|"bold", align?: "left"|"center"|"right", appearsAtStep }
path:         { id, shape:"path",         d, color, strokeColor?, strokeWidth?, filled?: boolean, opacity?, appearsAtStep }
arc:          { id, shape:"arc",          x, y, r, startAngle, endAngle, color, strokeWidth?, filled?: boolean, appearsAtStep }
badge:        { id, shape:"badge",        x, y, text, bgColor, textColor, fontSize?, appearsAtStep }
highlightbox: { id, shape:"highlightbox", x, y, w, h, color, opacity?, label?, appearsAtStep }
codeline:     { id, shape:"codeline",     x, y, w, h, code, language?, activeLineIndex?, appearsAtStep }

Shape rules:
- path.d   → valid SVG path data string (e.g. "M 100 200 C 200 100 300 300 400 200")
- arc angles → degrees, clockwise from 12 o'clock (0=top, 90=right, 180=bottom, 270=left)
- badge    → for floating labels, values, annotations. Prefer over plain text for callouts.
- highlightbox → transparent overlay rect to draw attention. Use opacity 0.15–0.25.
- codeline → for algorithm/code steps. Place at x ∈ [60,260] so diagram has room at right.
- All color values → valid hex strings (e.g. "#3b82f6") or CSS named colors.

━━━ STEP SCHEMA ━━━
Each step must include:
  index        — 0-based integer, sequential
  title        — short label shown in step nav (≤ 5 words)
  narration    — explanation for this step (rules below)
  durationMs   — how long to display this step before auto-advancing: 2000–6000 ms
                 Use longer durations for complex steps, shorter for simple reveals.
  objectIds    — CUMULATIVE list of ALL object IDs visible at this step
  newIds       — IDs appearing for the FIRST time this step (subset of objectIds)
  highlightIds — 1–3 IDs to visually emphasize this step (can be [])
  fadeIds      — IDs to render at reduced opacity this step to de-emphasize (can be [])
  isDoubtAnchor — boolean. Mark true on steps where a student is most likely to have
                  a doubt — typically the first step introducing a new mechanism,
                  formula, or non-obvious transition. At least 2 steps must be true.

━━━ NARRATION RULES ━━━
Narration is domain-voiced. Match the register of {{DOMAIN}}:
  dsa / computer_science  → precise, technical. Name the operation. State complexity if relevant.
  mathematics             → exact. Use correct notation names (e.g. "the partial derivative of f").
  physics / engineering   → physical intuition first, formula second.
  chemistry / biology     → process-oriented. Describe what is happening at the molecular/cellular level.
  medicine                → clinical framing. Connect mechanism to patient presentation.
  history / law           → narrative. Cause before effect. Name actors.
  psychology / philosophy → conceptual. State the claim, then the evidence or argument.
  economics / business    → frame as decision or tradeoff. Use concrete numbers where possible.
  general                 → conversational but precise. One idea per sentence.

Additional narration rules:
- 2–4 sentences per step. Lead with the single most important thing happening on canvas.
- Reference specific objects by their label (e.g. "Node B", "the red arrow", "the equilibrium point").
- Never use filler openers ("Now let's", "In this step", "Here we can see").
- Never repeat information from the previous step's narration verbatim.
- Final step narration must summarize the core insight of the entire lesson in 1–2 sentences.

━━━ LESSON CONSTRUCTION RULES ━━━
1. Step count: follow the MINIMUM STEPS from the domain animation guide. Never fewer.
   Maximum: 18 steps.
2. Each step introduces 2–4 new objects (newIds). No step should introduce 0 new objects
   except the final summary step.
3. appearsAtStep on each object MUST exactly match the step.index it first appears in.
4. Every ID in objectIds / newIds / highlightIds / fadeIds MUST exist in the objects array.
5. No ID may appear in newIds more than once across all steps.
6. highlightIds and fadeIds must not overlap within the same step.
7. Objects must span the canvas — use the full safe zone. Avoid x ∈ [300,500] as the
   only region used.
8. Use arrows to show relationships, flow, and causation between objects.
9. Use badge shapes for floating annotations, values, and callouts — not plain text.
10. The first step (index 0) must be a high-level overview: show 2–3 objects that give
    the student a mental map of what's coming.
11. Build complexity progressively. Each step should feel like a natural consequence
    of the previous one.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. No markdown, no code fences, no explanation outside the object.

{
  "title": string,
  "domain": string,
  "totalSteps": number,
  "objects": [ /* all shape objects, any order */ ],
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
 * @typedef {Object} TeachingEngineContext
 * @property {string} topic
 * @property {string} domain
 * @property {string} animationGuide
 */

/**
 * @param {TeachingEngineContext} ctx
 * @returns {string}
 */
export function buildTeachingEnginePrompt(ctx) {
  return TEACHING_ENGINE_PROMPT
    .replaceAll('{{TOPIC}}',           ctx.topic)
    .replaceAll('{{DOMAIN}}',          ctx.domain)
    .replaceAll('{{ANIMATION_GUIDE}}', ctx.animationGuide);
}

// ─── Response Types ───────────────────────────────────────────────────────────

/**
 * @typedef { 'circle' | 'rect' | 'arrow' | 'line' | 'text' | 'path' | 'arc' | 'badge' | 'highlightbox' | 'codeline' } ShapeType
 */

/**
 * @typedef {Object} ShapeBase
 * @property {string} id
 * @property {ShapeType} shape
 * @property {number} appearsAtStep
 * @property {number} [opacity]
 */

/**
 * @typedef {Object} CircleShape
 * @augments ShapeBase
 * @property {'circle'} shape
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {string} color
 * @property {string} [strokeColor]
 * @property {number} [strokeWidth]
 * @property {string} [label]
 * @property {string} [labelColor]
 */

/**
 * @typedef {Object} RectShape
 * @augments ShapeBase
 * @property {'rect'} shape
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} color
 * @property {string} [strokeColor]
 * @property {number} [strokeWidth]
 * @property {string} [label]
 * @property {string} [labelColor]
 * @property {number} [cornerRadius]
 */

/**
 * @typedef {Object} ArrowShape
 * @augments ShapeBase
 * @property {'arrow'} shape
 * @property {number} x1
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 * @property {string} color
 * @property {number} [strokeWidth]
 * @property {string} [label]
 * @property {string} [labelColor]
 * @property {boolean} [dashed]
 * @property {'single' | 'double' | 'none'} [arrowHead]
 */

/**
 * @typedef {Object} LineShape
 * @augments ShapeBase
 * @property {'line'} shape
 * @property {number} x1
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 * @property {string} color
 * @property {number} [strokeWidth]
 * @property {boolean} [dashed]
 */

/**
 * @typedef {Object} TextShape
 * @augments ShapeBase
 * @property {'text'} shape
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {number} fontSize
 * @property {string} color
 * @property {'normal' | 'bold'} [fontWeight]
 * @property {'left' | 'center' | 'right'} [align]
 */

/**
 * @typedef {Object} PathShape
 * @augments ShapeBase
 * @property {'path'} shape
 * @property {string} d
 * @property {string} color
 * @property {string} [strokeColor]
 * @property {number} [strokeWidth]
 * @property {boolean} [filled]
 */

/**
 * @typedef {Object} ArcShape
 * @augments ShapeBase
 * @property {'arc'} shape
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} startAngle
 * @property {number} endAngle
 * @property {string} color
 * @property {number} [strokeWidth]
 * @property {boolean} [filled]
 */

/**
 * @typedef {Object} BadgeShape
 * @augments ShapeBase
 * @property {'badge'} shape
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {string} bgColor
 * @property {string} textColor
 * @property {number} [fontSize]
 */

/**
 * @typedef {Object} HighlightBoxShape
 * @augments ShapeBase
 * @property {'highlightbox'} shape
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} color
 * @property {string} [label]
 */

/**
 * @typedef {Object} CodeLineShape
 * @augments ShapeBase
 * @property {'codeline'} shape
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} code
 * @property {string} [language]
 * @property {number} [activeLineIndex]
 */

/**
 * @typedef {CircleShape | RectShape | ArrowShape | LineShape | TextShape | PathShape | ArcShape | BadgeShape | HighlightBoxShape | CodeLineShape} CanvasShape
 */

/**
 * @typedef {Object} LessonStep
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
 * @typedef {Object} TeachingEngineResponse
 * @property {string} title
 * @property {string} domain
 * @property {number} totalSteps
 * @property {CanvasShape[]} objects
 * @property {LessonStep[]} steps
 */

// ─── Validation Helper ────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationError
 * @property {string} code
 * @property {string} message
 */

/**
 * @param {TeachingEngineResponse} r
 * @returns {ValidationError[]}
 */
export function validateTeachingEngineResponse(r) {
  const errors = [];
  const objectIdSet = new Set(r.objects.map(o => o.id));
  const seenInNewIds = new Set();

  for (const step of r.steps) {
    const ctx = `Step ${step.index} ("${step.title}")`;

    // All IDs referenced must exist in objects array
    for (const id of [...step.objectIds, ...step.newIds, ...step.highlightIds, ...step.fadeIds]) {
      if (!objectIdSet.has(id)) {
        errors.push({ code: 'UNKNOWN_ID', message: `${ctx}: ID "${id}" not found in objects array.` });
      }
    }

    // newIds must not repeat across steps
    for (const id of step.newIds) {
      if (seenInNewIds.has(id)) {
        errors.push({ code: 'DUPLICATE_NEW_ID', message: `${ctx}: ID "${id}" appears in newIds more than once.` });
      }
      seenInNewIds.add(id);
    }

    // highlightIds and fadeIds must not overlap
    const highlightSet = new Set(step.highlightIds);
    for (const id of step.fadeIds) {
      if (highlightSet.has(id)) {
        errors.push({ code: 'HIGHLIGHT_FADE_OVERLAP', message: `${ctx}: ID "${id}" is in both highlightIds and fadeIds.` });
      }
    }

    // appearsAtStep on each object must match step.index it first appears in
    for (const id of step.newIds) {
      const obj = r.objects.find(o => o.id === id);
      if (obj && obj.appearsAtStep !== step.index) {
        errors.push({ code: 'APPEARS_AT_STEP_MISMATCH', message: `${ctx}: Object "${id}" has appearsAtStep=${obj.appearsAtStep} but first appears in newIds at step ${step.index}.` });
      }
    }

    // durationMs in range (aligned with prompt: 2000–6000ms)
    if (step.durationMs < 2000 || step.durationMs > 6000) {
      errors.push({ code: 'DURATION_OUT_OF_RANGE', message: `${ctx}: durationMs=${step.durationMs} is outside [2000, 6000].` });
    }
  }

  // At least 2 doubtAnchor steps
  const anchorCount = r.steps.filter(s => s.isDoubtAnchor).length;
  if (anchorCount < 2) {
    errors.push({ code: 'INSUFFICIENT_DOUBT_ANCHORS', message: `Only ${anchorCount} step(s) marked isDoubtAnchor. Minimum is 2.` });
  }

  return errors;
}