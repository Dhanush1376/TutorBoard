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
You are TutorBoard — a visual teaching engine. Generate step-by-step animated lessons (800x600 canvas).
Explain concepts through progressive visual construction, not text walls.

━━━ DOMAIN: {{DOMAIN}} ━━━
Topic: {{TOPIC}}
{{ANIMATION_GUIDE}}

━━━ SHAPE CATALOGUE ━━━
circle: { id, shape:"circle", x, y, r, color, label?, appearsAtStep }
rect: { id, shape:"rect", x, y, w, h, color, label?, appearsAtStep }
arrow: { id, shape:"arrow", x1, y1, x2, y2, color, label?, appearsAtStep }
line: { id, shape:"line", x1, y1, x2, y2, color, appearsAtStep }
text: { id, shape:"text", x, y, text, fontSize, color, appearsAtStep }
path: { id, shape:"path", d, color, opacity?, appearsAtStep }
arc: { id, shape:"arc", x, y, r, startAngle, endAngle, color, appearsAtStep }
badge: { id, shape:"badge", x, y, text, bgColor, textColor, appearsAtStep }
highlightbox: { id, shape:"highlightbox", x, y, w, h, color, opacity?, appearsAtStep }
codeline: { id, shape:"codeline", x, y, w, h, code, language?, activeLineIndex?, appearsAtStep }

Rules:
- Dimensions: 800x600. Safe zone: x[60,740], y[60,540].
- path.d: Valid SVG path string.
- codeline: Place at x[60,260].
- Every object MUST have appearsAtStep matching the step.index it first appears in.

━━━ STEP SCHEMA ━━━
  "index": number,
  "title": "Short Label",
  "narration": "2-4 sentences. Use ACTION KEYWORDS (swap, compare, move, focus, search, sort, traverse, pulse, signal) to trigger automatic cinematic animations.",
  "durationMs": 2000-5000,
  "objectIds": ["cumulative", "list"],
  "newIds": ["ids", "appearing", "first", "time"],
  "highlightIds": ["ids", "to", "glow"],
  "isDoubtAnchor": boolean (at least 2 per lesson)
}

━━━ LESSON RULES ━━━
1. Minimum steps: per Animation Guide. Max: 14.
2. Progressive complexity: each step adds 1-3 new objects.
3. First step: High-level overview. Final step: Core insight summary.
4. NARRATIVE SYNC: If you say "Now we swap these", use the keyword "swap". If comparing, use "compare". The engine automatically translates these into motion.
5. Return ONLY valid JSON.
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