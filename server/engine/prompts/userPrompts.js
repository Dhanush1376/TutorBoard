/**
 * User Prompt Templates — v2
 *
 * This module is the single entry point for building every prompt sent to the model.
 * It replaces ad-hoc string concatenation with typed builders that pull from the
 * upgraded domainConfig and wire directly into the v2 prompt schemas.
 *
 * What changed from v1:
 *   - DOMAIN_HINTS removed — fully superseded by getAnimationGuide() in domainConfig
 *   - buildTeachingPrompt() → buildLessonPrompt(): typed, pulls full domain config,
 *     infers difficulty from topic phrasing, delegates to buildTimelinePrompt()
 *   - buildRetryPrompt(): now includes original error context + the invalid JSON
 *     fragment so the model can diff and fix rather than regenerate blindly
 *   - buildCondensedPrompt(): upgraded to targeted repair, not a blank "try again"
 *   - buildDoubtContext(): replaced by buildDoubtUserMessage() matching v2 doubt schema
 *   - isGreeting(): extended greeting list, handles punctuation + mixed case
 *   - inferDifficulty(): new — infers beginner/intermediate/advanced from topic phrasing
 *   - All functions fully typed (TypeScript)
 */

import { getDomainConfig } from './domainConfig.js';
import { buildTimelinePrompt } from './timelinePrompt.js';
import { buildDoubtPrompt } from './doubtPrompt.js';

// ─── Greeting Detection ───────────────────────────────────────────────────────

const GREETINGS = new Set([
  'hi', 'hello', 'hey', 'yo', 'sup', 'hola', 'greetings', 'howdy', 'namaste',
  'hiya', 'heya', 'salut', 'ola', 'ciao', 'bonjour', 'hallo', 'wassup', 'whatsup',
  "what's up", 'good morning', 'good afternoon', 'good evening', 'morning', 'evening',
]);

/**
 * @param {string | null | undefined} text
 * @returns {boolean}
 */
export function isGreeting(text) {
  if (!text?.trim()) return false;
  const cleaned = text.trim().toLowerCase().replace(/[!?.,'"]/g, '').trim();
  // Exact match or greeting followed by name/emoji ("hey there", "hi claude")
  return GREETINGS.has(cleaned) ||
    [...GREETINGS].some(g => cleaned.startsWith(g + ' ') && cleaned.length < g.length + 20);
}

// ─── Difficulty Inference ─────────────────────────────────────────────────────
//
// Infers difficulty from the student's phrasing. Call this when no explicit
// difficulty preference is available from user profile / settings.

const BEGINNER_SIGNALS = [
  'what is', "what's", 'explain', 'introduction to', 'intro to', 'basics of',
  'for beginners', 'simply', 'in simple terms', 'like i\'m five', 'eli5',
  'i don\'t understand', 'i\'m new to', 'never learned',
];

const ADVANCED_SIGNALS = [
  'deep dive', 'internals', 'under the hood', 'advanced', 'in depth',
  'proof of', 'derive', 'formal definition', 'mathematically', 'rigorously',
  'complexity analysis', 'optimise', 'optimize', 'trade-offs', 'tradeoffs',
  'compare', 'vs ', 'versus', 'nuance', 'edge case',
];

/**
 * @param {string} topic
 * @returns {'beginner' | 'intermediate' | 'advanced'}
 */
export function inferDifficulty(topic) {
  const t = topic.toLowerCase();
  const beginnerScore = BEGINNER_SIGNALS.filter(s => t.includes(s)).length;
  const advancedScore = ADVANCED_SIGNALS.filter(s => t.includes(s)).length;
  if (advancedScore > beginnerScore) return 'advanced';
  if (beginnerScore > 0)            return 'beginner';
  return 'intermediate';
}

// ─── Main Lesson Prompt Builder ───────────────────────────────────────────────

/**
 * @typedef {Object} LessonPromptOptions
 * @property {string} topic
 * @property {'beginner' | 'intermediate' | 'advanced'} [difficulty]
 */

/**
 * @typedef {Object} LessonPromptResult
 * @property {string} prompt
 * @property {string} domain
 * @property {'beginner' | 'intermediate' | 'advanced'} difficulty
 * @property {string} displayName
 * @property {string} icon
 */

/**
 * @param {LessonPromptOptions} options
 * @returns {LessonPromptResult}
 */
export function buildLessonPrompt(options) {
  const { topic } = options;
  const difficulty = options.difficulty ?? inferDifficulty(topic);

  const config = getDomainConfig(topic);

  const prompt = buildTimelinePrompt({
    topic,
    domain:         config.primary,
    nodeTemplates:  config.nodeTemplates,
    animationGuide: config.animationGuide,
    difficulty,
  });

  return {
    prompt,
    domain:      config.primary,
    difficulty,
    displayName: config.meta.displayName,
    icon:        config.meta.icon,
  };
}

// ─── Retry Prompt Builder ─────────────────────────────────────────────────────

/**
 * @typedef {Object} RetryPromptOptions
 * @property {string[]} errors
 * @property {string} originalJson
 * @property {number} [maxLength]
 */

/**
 * @param {RetryPromptOptions} options
 * @returns {string}
 */
export function buildRetryPrompt(options) {
  const { errors, originalJson, maxLength = 6000 } = options;

  const truncated = originalJson.length > maxLength
    ? originalJson.slice(0, maxLength) + '\n… [truncated]'
    : originalJson;

  const errorList = errors
    .map((e, i) => `  ${i + 1}. ${e}`)
    .join('\n');

  return `Your previous response contained validation errors. Fix ONLY the issues listed below
and return the corrected complete JSON. Do not change anything else.

ERRORS TO FIX:
${errorList}

YOUR PREVIOUS RESPONSE (fix this):
${truncated}

Return ONLY the corrected valid JSON. No explanation, no markdown.`;
}

// ─── Condensed Repair Prompt ──────────────────────────────────────────────────

/**
 * @typedef {Object} CondensedPromptOptions
 * @property {string} brokenJson
 * @property {string} parseError
 * @property {number} [maxLength]
 */

/**
 * @param {CondensedPromptOptions} options
 * @returns {string}
 */
export function buildCondensedPrompt(options) {
  const { brokenJson, parseError, maxLength = 3000 } = options;

  const fragment = brokenJson.length > maxLength
    ? brokenJson.slice(0, maxLength) + '\n… [truncated]'
    : brokenJson;

  return `The JSON you returned could not be parsed: "${parseError}"

Broken fragment:
${fragment}

Fix the JSON syntax error and return ONLY the corrected valid JSON. No explanation, no markdown.`;
}

// ─── Doubt User Message Builder ───────────────────────────────────────────────

/**
 * @typedef {Object} DoubtUserMessageOptions
 * @property {string} question
 * @property {number} currentStepIndex
 * @property {string} currentStepTitle
 * @property {boolean} isDoubtAnchor
 */

/**
 * @param {DoubtUserMessageOptions} options
 * @returns {string}
 */
export function buildDoubtUserMessage(options) {
  const { question, currentStepIndex, currentStepTitle, isDoubtAnchor } = options;

  const anchorNote = isDoubtAnchor
    ? '(This step is flagged as a likely confusion point — give extra care to the explanation.)'
    : '';

  return `Student doubt at Step ${currentStepIndex} — "${currentStepTitle}":

"${question}"
${anchorNote}`.trim();
}

// ─── Full Doubt Context Builder ───────────────────────────────────────────────

/**
 * @param {Object} session
 * @param {number} activeStepIndex
 * @returns {Object}
 */
export function buildDoubtContext(session, activeStepIndex) {
  const timeline = session.timeline;

  const topic  = timeline?.title  ?? 'Unknown Topic';
  const domain = timeline?.domain ?? 'general';

  // Extract the shapes currently visible at the active step
  const activeStep = timeline?.steps?.find(s => s.index === activeStepIndex);
  const visibleIds = new Set(activeStep?.objectIds ?? []);
  const currentFrames = (timeline?.objects ?? [])
    .filter(obj => visibleIds.has(obj.id))
    .map(obj => ({
      id:        obj.id,
      shape:     obj.shape,
      label:     obj.label,
      color:     obj.color,
      isNew:     activeStep?.newIds?.includes(obj.id) ?? false,
      isHighlit: activeStep?.highlightIds?.includes(obj.id) ?? false,
    }));

  const priorDoubts = session.doubtHistory ?? [];

  return { topic, domain, currentFrames, priorDoubts };
}

// ─── Backward Compatibility ───────────────────────────────────────────────────

/** @deprecated Use buildLessonPrompt() instead. */
export function buildTeachingPrompt(topic) {
  return buildLessonPrompt({ topic }).prompt;
}

/** @deprecated Use buildRetryPrompt({ errors, originalJson }) instead. */
export function buildSimpleRetryPrompt(errors) {
  return buildRetryPrompt({ errors, originalJson: '(not available)' });
}