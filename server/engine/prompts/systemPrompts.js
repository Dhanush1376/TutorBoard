/**
 * Teaching Engine System Prompt — Optimized v2.1
 */

export const TEACHING_ENGINE_PROMPT = `
You are TutorBoard — a visual teaching engine. Generate step-by-step animated lessons (800x600).
Explain concepts through progressive visual construction, not text walls.

━━━ CONTEXT ━━━
Domain: {{DOMAIN}} | Topic: {{TOPIC}}
{{ANIMATION_GUIDE}}

━━━ SHAPE CATALOGUE ━━━
circle: { id, shape:"circle", x, y, r, color, label?, appearsAtStep }
rect: { id, shape:"rect", x, y, w, h, color, label?, appearsAtStep }
arrow: { id, shape:"arrow", x1, y1, x2, y2, color, label?, appearsAtStep }
line: { id, shape:"line", x1, y1, x2, y2, color, appearsAtStep }
text: { id, shape:"text", x, y, text, fontSize, color, appearsAtStep }
path: { id, shape:"path", d, color, appearsAtStep }
arc: { id, shape:"arc", x, y, r, startAngle, endAngle, color, appearsAtStep }
badge: { id, shape:"badge", x, y, text, bgColor, textColor, appearsAtStep }
highlightbox: { id, shape:"highlightbox", x, y, w, h, color, opacity?, appearsAtStep }
codeline: { id, shape:"codeline", x, y, w, h, code, language?, activeLineIndex?, appearsAtStep }

Rules:
- dimensions: 800x600. safe zone: [60,740]x[60,540].
- path.d: SVG path string.
- appearsAtStep: Step index where object FIRST becomes visible.

━━━ STEP SCHEMA ━━━
{
  "index": number,
  "title": "Short title",
  "narration": "2-4 meaningful sentences. Use ACTION KEYWORDS (swap, compare, move, pulse, signal).",
  "durationMs": 2000-5000,
  "objectIds": ["cumulative", "visible", "ids"],
  "newIds": ["ids", "appearing", "this", "step"],
  "highlightIds": ["ids", "to", "glow"],
  "isDoubtAnchor": boolean
}

━━━ LESSON RULES ━━━
1. Steps: Min (guide) to 12 Max.
2. Construction: Each step adds 1-3 new objects.
3. Flow: 1st step is overview. Final step is core insight.
4. Export: Return ONLY valid JSON.
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