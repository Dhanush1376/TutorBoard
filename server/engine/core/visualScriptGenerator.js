/**
 * VisualScriptGenerator v1.0 — Portable Educational Script Engine
 *
 * The MOST IMPORTANT new layer in the pipeline.
 *
 * Current pipeline:  User → IntentEngine → Planner → AgentLoop → Renderer  (coupled)
 * New pipeline:      User → IntentEngine → VisualIntentRouter → Teaching Planner
 *                    → VisualScriptGenerator → SceneGraphGenerator → RendererAdapter → Canvas
 *
 * This module generates PORTABLE, RENDERER-AGNOSTIC visual scripts that describe
 * WHAT should happen educationally, not HOW to render it.
 *
 * Benefits:
 *   - Same script → D3, Matter.js, Three.js, or any future renderer
 *   - AI can edit individual actions (not entire scenes)
 *   - Replay, undo, collaborative sync all work at the script level
 *   - Renderer is just a "skin" over the semantic script
 */

import { requestCompletion, getModel } from '../../utils/ai/llmClient.js';
import { getTeachingMode } from '../config/teachingModes.js';
import { sanitizeTopicForPrompt } from '../../utils/validation/topicValidator.js';

// ─── Script Schema ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} VisualScript
 * @property {string} scriptVersion - Schema version ("1.0")
 * @property {string} topic - Subject being taught
 * @property {string} domain - Knowledge domain
 * @property {string} teachingMode - Active teaching mode
 * @property {ScriptStep[]} steps - Ordered sequence of educational steps
 * @property {ScriptMetadata} metadata - Script-level metadata
 */

/**
 * @typedef {Object} ScriptStep
 * @property {string} stepId - Unique step identifier
 * @property {string} intent - Educational intent (show_initial_state, compare, swap, highlight, etc.)
 * @property {string} narration - Text narration for this step
 * @property {ScriptAction[]} actions - Ordered actions within this step
 * @property {number} durationMs - Suggested duration in milliseconds
 * @property {string} [transition] - Transition type to this step
 */

/**
 * @typedef {Object} ScriptAction
 * @property {string} action - Semantic action name (create_array, highlight, swap, narrate, etc.)
 * @property {string} [id] - Target entity ID
 * @property {Object} [params] - Action-specific parameters
 */

// ─── LLM Prompt ──────────────────────────────────────────────────────────────

const VISUAL_SCRIPT_GENERATOR_PROMPT = `You are the VisualScriptGenerator for TutorBoard.

Your job is to generate a PORTABLE, RENDERER-AGNOSTIC visual teaching script.
The script describes WHAT should happen educationally — NOT how to render it.

━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (strict JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "scriptVersion": "1.0",
  "topic": "<topic>",
  "domain": "<domain>",
  "steps": [
    {
      "stepId": "step_1",
      "intent": "<educational_intent>",
      "narration": "<what to tell the student>",
      "actions": [
        { "action": "<action_name>", "id": "<entity_id>", ...params }
      ],
      "durationMs": 3000,
      "transition": "crossfade"
    }
  ],
  "metadata": {
    "totalSteps": <N>,
    "difficulty": "beginner|intermediate|advanced",
    "estimatedDurationMs": <total_ms>,
    "keyConceptsCovered": ["concept1", "concept2"]
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━
SEMANTIC ACTIONS (use ONLY these)
━━━━━━━━━━━━━━━━━━━━━━━━━

Data Structure Actions:
  create_array(id, values, label?)          — Declare an array
  create_pointer(id, position, label, color?) — Index marker
  create_tree(id, data)                     — Tree hierarchy
  create_graph(id, nodes, edges)            — Graph with connections
  create_stack(id, values)                  — Stack visualization
  create_queue(id, values)                  — Queue visualization
  create_matrix(id, rows)                   — 2D matrix/grid

Mutation Actions:
  highlight(targets, style)                 — Highlight elements (compare, active, found, sorted)
  swap(target1, target2)                    — Swap two elements
  move_pointer(id, toPosition)              — Move a pointer
  insert(targetId, value, position)         — Insert into structure
  remove(targetId, position)                — Remove from structure
  update_value(targetId, position, newValue) — Change a value
  mark_sorted(targetId, positions)          — Mark elements as sorted/finalized
  set_boundary(start, end, label?)          — Draw a partition/range boundary

Visual Actions:
  annotate(targetId, text, position?)       — Attach text label
  remove_annotation(targetId)               — Remove annotation
  show_result(text, style?)                 — Display result/conclusion banner
  show_equation(formula, label?)            — Display a math equation
  show_code(code, language, highlight_lines?) — Display code snippet
  create_chart(id, data, chartType)         — Create bar/line/pie chart
  create_timeline_viz(id, events)           — Timeline visualization

Physics Actions:
  create_body(id, type, position, mass, properties?) — Physical object
  apply_force(targetId, force, direction)    — Apply force vector
  set_gravity(value)                         — Set simulation gravity
  create_constraint(id, bodyA, bodyB, type)  — Connect bodies

Camera/Scene Actions:
  camera_focus(target, zoom?)               — Focus camera on entity
  camera_pan(x, y)                          — Pan viewport
  narrate(text)                             — Set narration text
  wait(durationMs)                          — Pause between actions
  transition(type)                          — Scene transition

━━━━━━━━━━━━━━━━━━━━━━━━━
EDUCATIONAL INTENTS
━━━━━━━━━━━━━━━━━━━━━━━━━
show_initial_state, setup, introduce
compare_elements, compare
swap_elements, swap, exchange
highlight_result, reveal, conclude
iterate, advance, progress
partition, divide, merge
recurse, backtrack
apply_force, simulate
prove, derive, compute
summarize, recap

━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━
1. Use ONLY semantic actions — no pixel coordinates, no CSS, no SVG
2. Use descriptive IDs: "main_array", "ptr_left", "pivot_node" — not "a1", "p1"  
3. Every step MUST have a narration — no silent steps
4. 5-12 steps per script (never fewer, never more than 15)
5. Each step should teach ONE concept or show ONE operation
6. Build complexity gradually — simple → complex
7. Return ONLY raw JSON. No markdown. No preamble.`;

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generate a portable visual script for a topic.
 *
 * @param {Object} params
 * @param {string} params.topic - What to teach
 * @param {string} params.domain - Knowledge domain (dsa, physics, math, etc.)
 * @param {string} params.teachingMode - Active teaching mode
 * @param {Object} [params.learnerProfile] - Learner context
 * @param {string} [params.modelId] - LLM model override
 * @param {Object} [params.userConfig] - User API configuration
 * @param {AbortSignal} [params.signal] - Cancellation signal
 * @returns {Promise<VisualScript|null>}
 */
export async function generateVisualScript({ topic, domain, teachingMode = 'visualize', learnerProfile = {}, webContext = '', modelId, userConfig, signal }) {
  const modeConfig = getTeachingMode(teachingMode);

  const contextBlock = buildLearnerContext(learnerProfile);
  const searchBlock = webContext ? `\nWeb Search Context:\n${webContext}\n` : '';
  const modeBlock = `Teaching Mode: ${modeConfig.label} — ${modeConfig.description}\nTone: ${modeConfig.tone}\nDepth: ${modeConfig.depth}\nPacing: ${modeConfig.pacing}`;

  console.log(`[VisualScriptGenerator] 🎬 Generating script for: "${topic}" (${domain}, mode: ${teachingMode})`);

  try {
    const safeTopic = sanitizeTopicForPrompt(topic);
    const res = await requestCompletion({
      model: modelId || getModel(),
      messages: [
        { role: 'system', content: VISUAL_SCRIPT_GENERATOR_PROMPT },
        {
          role: 'user',
          content: `Generate a visual teaching script for:\n\nTopic: ${safeTopic}\nDomain: ${domain}\n${modeBlock}\n${contextBlock}${searchBlock}\n\nReturn ONLY raw JSON.`
        }
      ],
      temperature: 0.15,
      maxTokens: 4000,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'visualization',
      signal,
    });

    const raw = (res.content || '{}').replace(/```json|```/g, '').trim();
    const script = JSON.parse(raw);

    // Validate and normalize
    return normalizeScript(script, topic, domain, teachingMode);
  } catch (err) {
    console.error(`[VisualScriptGenerator] ❌ Generation failed: ${err.message}`);
    return buildFallbackScript(topic, domain, teachingMode);
  }
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeScript(raw, topic, domain, teachingMode) {
  const steps = (raw.steps || []).map((step, idx) => ({
    stepId: step.stepId || `step_${idx + 1}`,
    intent: step.intent || 'show',
    narration: step.narration || step.explanation || `Step ${idx + 1}`,
    actions: (step.actions || []).map(normalizeAction),
    durationMs: step.durationMs || 3000,
    transition: step.transition || (idx === 0 ? 'none' : 'crossfade'),
  }));

  return {
    scriptVersion: '1.0',
    topic: raw.topic || topic,
    domain: raw.domain || domain,
    teachingMode,
    steps,
    metadata: {
      totalSteps: steps.length,
      difficulty: raw.metadata?.difficulty || 'intermediate',
      estimatedDurationMs: steps.reduce((sum, s) => sum + (s.durationMs || 3000), 0),
      keyConceptsCovered: raw.metadata?.keyConceptsCovered || [topic],
    },
  };
}

function normalizeAction(action) {
  if (!action || !action.action) {
    return { action: 'narrate', text: 'Processing...' };
  }
  return {
    action: action.action,
    id: action.id || undefined,
    ...action,
  };
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function buildFallbackScript(topic, domain, teachingMode) {
  return {
    scriptVersion: '1.0',
    topic,
    domain,
    teachingMode,
    steps: [
      {
        stepId: 'intro',
        intent: 'introduce',
        narration: `Let's explore ${topic} step by step.`,
        actions: [
          { action: 'narrate', text: `Welcome! Today we'll learn about ${topic}.` },
        ],
        durationMs: 3000,
        transition: 'none',
      },
      {
        stepId: 'core',
        intent: 'show_initial_state',
        narration: `Here's the core concept behind ${topic}.`,
        actions: [
          { action: 'annotate', targetId: 'concept', text: topic },
          { action: 'narrate', text: `${topic} is a fundamental concept worth exploring deeper. Ask a question to continue.` },
        ],
        durationMs: 5000,
        transition: 'crossfade',
      },
    ],
    metadata: {
      totalSteps: 2,
      difficulty: 'beginner',
      estimatedDurationMs: 8000,
      keyConceptsCovered: [topic],
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLearnerContext(profile) {
  if (!profile || Object.keys(profile).length === 0) return '';

  const parts = [];
  if (profile.level) parts.push(`Level: ${profile.level}`);
  if (profile.learning_style) parts.push(`Learning Style: ${profile.learning_style}`);
  if (profile.confusionIndex > 3) parts.push(`Student is confused (confusion: ${profile.confusionIndex}/10) — simplify!`);
  if (profile.weak_areas?.length > 0) parts.push(`Weak areas: ${profile.weak_areas.join(', ')}`);
  if (profile.reinforcementTopics?.length > 0) parts.push(`Reinforce these concepts: ${profile.reinforcementTopics.join(', ')}`);

  return parts.length > 0 ? `\nLearner Context:\n${parts.join('\n')}` : '';
}

export default { generateVisualScript };
