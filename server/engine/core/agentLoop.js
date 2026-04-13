/**
 * AgentLoop v7.0 — 6-Stage Autonomous Orchestration Pipeline
 *
 * v7.0 FIXES:
 *   [FIX 1] extractJSON: Removed the over-restrictive regex that only passed JSON
 *           containing "elements"/"timeline" at root. The new Validator wraps output
 *           inside "final_output" so the old regex returned null EVERY time.
 *
 *   [FIX 2] unwrapValidatorOutput: The Validator produces:
 *           { status, repairs, final_output: { visual_steps, narrations, animation_steps } }
 *           postProcessTimeline needs { elements, timeline } at root.
 *           This function bridges the two schemas — THIS IS WHY YOU ALWAYS SAW THE FAILSAFE ORB.
 *
 *   [FIX 3] maxTokens raised from 3000 → 6000 so the 6-agent pipeline has
 *           room to produce full output without truncating mid-JSON.
 *
 *   [FIX 4] model param now correctly forwarded to every runStage call.
 */

import { requestCompletion, getModel } from '../utils/llmClient.js';
import {
  PLANNER_AGENT_PROMPT,
  NARRATOR_AGENT_PROMPT,
  VISUALIZER_AGENT_PROMPT,
  ANIMATOR_AGENT_PROMPT,
  CRITIC_AGENT_PROMPT,
  VALIDATOR_AGENT_PROMPT
} from '../agents/index.js';
import { SceneGraphSchema } from '../validators/timelineSchema.js';

// ─── Robust JSON Extractor ────────────────────────────────────────────────────
// FIX 1: Old code had a regex that only matched JSON with "elements"/"timeline" 
// at root level. New Validator wraps everything in "final_output" → old regex = null always.
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Attempt 1: Direct parse
  try { return JSON.parse(cleaned); } catch (_) { /* fall through */ }

  // Attempt 2: Brace-balanced extraction (handles trailing text/newlines after JSON)
  let depth = 0, start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(cleaned.substring(start, i + 1)); } catch (_) { start = -1; }
      }
    }
  }

  return null;
}

// ─── FIX 2: Bridge new agent schema → legacy renderer schema ─────────────────
// THIS IS THE ROOT CAUSE OF THE ALWAYS-FAILING PIPELINE.
//
// New Validator output shape:
//   { status, repairs, final_output: { meta, narrations, visual_steps, animation_steps } }
//
// Legacy postProcessTimeline expects at root:
//   { elements, timeline, scene, connections }
//   where timeline[i].explanation = narration text for that step
//
// This function converts between them. If already in legacy format, passes through.
function unwrapValidatorOutput(raw) {
  if (!raw) return null;

  // Case A: Already legacy format
  if (raw.elements || raw.objects) {
    console.log('[AgentLoop] Output already in legacy format — passing through.');
    return raw;
  }

  // Case B: New format — unwrap final_output
  const inner = raw.final_output;
  if (!inner) {
    console.warn('[AgentLoop] ⚠️ No "final_output" and no "elements". Cannot unwrap.');
    return null;
  }

  const meta        = inner.meta || {};
  const narrations  = inner.narrations    || [];
  const visualSteps = inner.visual_steps  || [];
  const animSteps   = inner.animation_steps || [];

  // Collect all elements declared across all steps (deduplicated by id)
  const elementMap = new Map();
  for (const vs of visualSteps) {
    for (const el of (vs.elements || [])) {
      if (el?.id && !elementMap.has(el.id)) {
        elementMap.set(el.id, el);
      }
    }
  }
  const elements = [...elementMap.values()];

  // Build legacy timeline steps
  const animTypeAliases = {
    fade_in: 'fade', scale_in: 'scale', slide_in: 'slide', draw_in: 'draw',
    fade: 'fade', scale: 'scale', slide: 'slide', draw: 'draw',
  };

  const timeline = visualSteps.map((vs, idx) => {
    const stepNum   = vs.step ?? idx + 1;
    const anim      = animSteps.find(a => a.step === stepNum) || animSteps[idx] || {};
    const narration = narrations.find(n => n.step === stepNum) || narrations[idx] || {};
    const firstAnim = (anim.animations || [])[0] || {};
    const exitIds   = new Set(vs.exits || []);
    const allIds    = [...elementMap.keys()].filter(id => !exitIds.has(id));

    return {
      title:           narration.title || `Step ${stepNum}`,
      explanation:     narration.text  || `Step ${stepNum}.`,
      narration:       narration.text  || '',
      callout:         narration.callout || null,
      highlight_terms: narration.highlight_terms || [],
      objectIds:       allIds.length > 0 ? allIds : elements.map(e => e.id),
      highlightIds:    (vs.elements || []).map(e => e.id).filter(Boolean),
      mutations:       (vs.mutations || []).map(m => ({ id: m.id, props: m.props || {} })),
      camera:          vs.camera || anim.camera || { x: 0.5, y: 0.5, zoom: 1.0 },
      animation: {
        type:     animTypeAliases[anim.global_transition || firstAnim.action] || 'fade',
        duration: firstAnim.duration || 0.6,
        easing:   firstAnim.easing   || 'ease_out',
        actions:  anim.animations    || [],
      },
    };
  });

  const result = {
    scene:       { title: meta.topic || 'Learning Session', type: 'linear' },
    meta:        { topic: meta.topic, concept_type: meta.concept_type, level: meta.level, core_insight: meta.core_insight },
    elements,
    connections: [],
    timeline,
    _raw: { narrations, visual_steps: visualSteps, animation_steps: animSteps },
  };

  console.log(`[AgentLoop] 🔄 Unwrapped → ${elements.length} elements, ${timeline.length} steps`);
  return result;
}

// ─── objectIds cross-reference fix ───────────────────────────────────────────
function fixObjectIds(obj) {
  const elements = obj.elements || obj.objects || [];
  const validIds = new Set(elements.map(e => e?.id).filter(Boolean));
  const timeline = obj.timeline || obj.steps || [];

  timeline.forEach(step => {
    if (!step) return;
    const raw      = step.objectIds || step.elements || [];
    const filtered = raw.filter(id => validIds.has(id));
    step.objectIds = filtered.length > 0 ? filtered : [...validIds];
    if (step.highlightIds) step.highlightIds = step.highlightIds.filter(id => validIds.has(id));
    if (step.mutations)    step.mutations    = step.mutations.filter(m => validIds.has(m?.id));
  });
  return obj;
}

// ─── Scene Graph Validator ───────────────────────────────────────────────────
function validateSceneGraph(obj) {
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  if (obj.objects && !obj.elements) obj.elements = obj.objects;
  if (obj.steps   && !obj.timeline) obj.timeline = obj.steps;

  fixObjectIds(obj);

  const result = SceneGraphSchema.safeParse(obj);
  const errors = [];

  if (!result.success) {
    result.error.issues.forEach(i => errors.push(`${i.path.join('.')}: ${i.message}`));
  }

  if ((obj.elements || []).length < 1) errors.push('Visualization empty.');
  if ((obj.timeline || []).length < 2) errors.push('Lesson too short.');

  if (errors.length > 5) {
    console.warn(`[AgentLoop] ❌ FATAL Scene Graph Validation: ${errors.length} issues detected. Tripping failsafe.`);
    return { valid: false, errors, fatal: true };
  }

  return { valid: errors.length === 0, errors, data: result.success ? result.data : obj };
}

// ─── Single Stage Executor ────────────────────────────────────────────────────
async function runStage({ stageName, prompt, input, model, onProgress }) {
  onProgress(stageName);
  console.log(`[AgentLoop] 🎭 Stage: ${stageName}...`);

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user',   content: `INPUT CONTEXT:\n${JSON.stringify(input, null, 2)}\n\nGenerate your output now.` }
  ];

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[AgentLoop] ⏳ Retrying Stage "${stageName}" in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await requestCompletion({
        model: model || getModel(),
        messages,
        temperature: 0.3,
        maxTokens: 6000,          // FIX 3: was 3000 — too small for 6-agent output
        responseMimeType: 'application/json'
      });

      if (!response?.content) throw new Error('Empty response');

      const parsed = extractJSON(response.content);
      if (!parsed) throw new Error(`JSON parse failed. Preview: ${response.content.substring(0, 300)}`);

      return parsed;
    } catch (err) {
      console.warn(`[AgentLoop] ⚠️ Stage "${stageName}" attempt ${attempt}: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

// ─── Main Autonomous Loop ─────────────────────────────────────────────────────
export async function runAgentLoop({ topic, domain, model = null, onProgress = () => {}, systemPrompt = null, maxSteps = null, planningResult = null }) {
  console.log(`[AgentLoop] 🚀 Starting 6-Stage Orchestration for: "${topic}"`);

  try {
    // Stage 1: PLANNING
    const plannerOutput = planningResult || await runStage({
      stageName: 'Thinking deeply about the topic...',
      prompt: systemPrompt || PLANNER_AGENT_PROMPT,
      input: { topic, domain, maxSteps },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 1 — ${plannerOutput.flow?.length || 0} steps planned`);

    // Stage 2: NARRATION
    const narratorOutput = await runStage({
      stageName: 'Crafting pedagogical explanations...',
      prompt: NARRATOR_AGENT_PROMPT,
      input: { plannerOutput },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 2 — ${narratorOutput.narrations?.length || 0} narrations`);

    // Stage 3: VISUALIZATION
    const visualizerOutput = await runStage({
      stageName: 'Designing visual representation...',
      prompt: VISUALIZER_AGENT_PROMPT,
      input: { plannerOutput, narratorOutput },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 3 — ${visualizerOutput.visual_steps?.length || 0} visual steps`);

    // Stage 4: ANIMATION
    const animatorOutput = await runStage({
      stageName: 'Choreographing cinematic motion...',
      prompt: ANIMATOR_AGENT_PROMPT,
      input: { plannerOutput, visualizerOutput },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 4 — ${animatorOutput.animation_steps?.length || 0} animation steps`);

    // Stage 5: CRITIQUE
    const criticOutput = await runStage({
      stageName: 'Reviewing for consistency & clarity...',
      prompt: CRITIC_AGENT_PROMPT,
      input: { planner: plannerOutput, narrator: narratorOutput, visualizer: visualizerOutput, animator: animatorOutput },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 5 — approved: ${criticOutput.approved}, score: ${criticOutput.scores?.overall}`);

    // Stage 6: VALIDATION
    const validatorRaw = await runStage({
      stageName: 'Finalizing high-fidelity plan...',
      prompt: VALIDATOR_AGENT_PROMPT,
      input: { planner: plannerOutput, narrator: narratorOutput, visualizer: visualizerOutput, animator: animatorOutput, critic: criticOutput },
      model, onProgress
    });
    console.log(`[AgentLoop] ✅ Stage 6 — status: ${validatorRaw.status}`);

    // FIX 2: Unwrap { final_output: { visual_steps, narrations } } → { elements, timeline }
    const unwrapped = unwrapValidatorOutput(validatorRaw);
    if (!unwrapped) {
      console.warn('[AgentLoop] ⚠️ unwrapValidatorOutput returned null — triggering failsafe.');
      return null;
    }

    const validated = validateSceneGraph(unwrapped);
    if (!validated.valid) {
      if (validated.fatal) return null;
      console.warn('[AgentLoop] ⚠️ Validation issues (non-fatal):', validated.errors.join(', '));
    }

    const output = validated.data || unwrapped;
    fixObjectIds(output);

    console.log(`[AgentLoop] ✅ Pipeline SUCCESS — ${output.elements?.length || 0} elements, ${output.timeline?.length || 0} steps`);
    return output;

  } catch (err) {
    console.error(`[AgentLoop] ❌ Critical failure: ${err.message}`);
    return null;
  }
}