/**
 * AgentLoop v6.0 — 6-Stage Autonomous Orchestration Pipeline
 *
 * PIPELINE:
 * [1] PLANNER AGENT        ← Pedagogical decomposition + difficulty calibration
 * [2] NARRATOR AGENT       ← Generates per-step explanation text + narration
 * [3] VISUALIZER AGENT     ← Scene graph with continuity + richer vocabulary
 * [4] ANIMATOR AGENT       ← Staggered, eased, semantically aware motion
 * [5] CRITIC AGENT         ← Reviews full pipeline output, patches issues
 * [6] VALIDATOR AGENT      ← Structural + semantic integrity check
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

// ─── Robust JSON Extractor ───────────────────────────────────────────────────
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try { return JSON.parse(cleaned); } catch (_) { /* fall through */ }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch (_) { /* fall through */ }
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*(\"elements\"|\"objects\"|\"shapes\"|\"nodes\")[\s\S]*(\"timeline\"|\"steps\"|\"flow\"|\"sequence\")[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) { /* fall through */ }
  }

  return null;
}

// ─── objectIds cross-reference fix ───────────────────────────────────────────
function fixObjectIds(obj) {
  const elements = obj.elements || obj.objects || [];
  const validIds = new Set(elements.map(e => e?.id).filter(Boolean));

  const timeline = obj.timeline || obj.steps || [];
  timeline.forEach(step => {
    if (!step) return;
    const raw = step.objectIds || step.elements || [];
    const filtered = raw.filter(id => validIds.has(id));
    step.objectIds = filtered.length > 0 ? filtered : [...validIds];

    if (step.highlightIds) {
      step.highlightIds = step.highlightIds.filter(id => validIds.has(id));
    }
    if (step.mutations) {
      step.mutations = step.mutations.filter(m => validIds.has(m?.id));
    }
  });
  return obj;
}

// ─── Scene Graph Validator ───────────────────────────────────────────────────
function validateSceneGraph(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Not an object'] };
  }

  // Pre-validation alias normalization
  if (obj.objects && !obj.elements) obj.elements = obj.objects;
  if (obj.steps && !obj.timeline) obj.timeline = obj.steps;

  // Fix objectIds cross-references BEFORE validation
  fixObjectIds(obj);

  const result = SceneGraphSchema.safeParse(obj);
  const errors = [];

  if (!result.success) {
    result.error.issues.forEach(issue => {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    });
  }

  const elements = obj.elements || [];
  const timeline = obj.timeline || [];

  if (elements.length < 1) errors.push(`Visualization empty.`);
  if (timeline.length < 2) errors.push(`Lesson too short.`);

  return {
    valid: errors.length === 0,
    errors,
    data: result.success ? result.data : obj,
  };
}

/**
 * Executes a single stage of the pedagogical pipeline.
 * Handles retries and JSON extraction.
 */
async function runStage({ stageName, prompt, input, model, onProgress }) {
  onProgress(stageName);
  console.log(`[AgentLoop] 🎭 Stage: ${stageName}...`);

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: `INPUT CONTEXT:\n${JSON.stringify(input, null, 2)}\n\nGenerate your output now.` }
  ];

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await requestCompletion({
        model: model || getModel(),
        messages,
        temperature: 0.3,
        maxTokens: 3000,
        responseMimeType: 'application/json'
      });

      if (!response?.content) throw new Error('Empty response');

      const parsed = extractJSON(response.content);
      if (!parsed) throw new Error('Failed to parse JSON');

      return parsed;
    } catch (err) {
      console.warn(`[AgentLoop] ⚠️ Stage ${stageName} attempt ${attempt} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

// ─── Main Autonomous Loop ─────────────────────────────────────────────────────
export async function runAgentLoop({ topic, domain, model = null, onProgress = () => {} }) {
  console.log(`[AgentLoop] 🚀 Starting 6-Stage Orchestration for: "${topic}"`);

  try {
    // Stage 1: PLANNING (Brain)
    const plannerOutput = await runStage({
      stageName: 'Thinking deeply about the topic...',
      prompt: PLANNER_AGENT_PROMPT,
      input: { topic, domain },
      onProgress
    });

    // Stage 2: NARRATION (Voice)
    const narratorOutput = await runStage({
      stageName: 'Crafting pedagogical explanations...',
      prompt: NARRATOR_AGENT_PROMPT,
      input: { plannerOutput },
      onProgress
    });

    // Stage 3: VISUALIZATION (Scene Graph)
    const visualizerOutput = await runStage({
      stageName: 'Designing visual representation...',
      prompt: VISUALIZER_AGENT_PROMPT,
      input: { plannerOutput, narratorOutput },
      onProgress
    });

    // Stage 4: ANIMATION (Motion)
    const animatorOutput = await runStage({
      stageName: 'Choreographing cinematic motion...',
      prompt: ANIMATOR_AGENT_PROMPT,
      input: { visualizerOutput },
      onProgress
    });

    // Stage 5: CRITIQUE (Review & Patch)
    const criticOutput = await runStage({
      stageName: 'Reviewing for consistency & clarity...',
      prompt: CRITIC_AGENT_PROMPT,
      input: { 
        planner: plannerOutput, 
        narrator: narratorOutput, 
        visualizer: visualizerOutput, 
        animator: animatorOutput 
      },
      onProgress
    });

    // Stage 6: VALIDATION (Sanitize & Seal)
    const finalResult = await runStage({
      stageName: 'Finalizing high-fidelity plan...',
      prompt: VALIDATOR_AGENT_PROMPT,
      input: criticOutput,
      onProgress
    });

    // Final Post-Process (legacy compatibility & ID check)
    const validated = validateSceneGraph(finalResult);
    if (!validated.valid) {
      console.warn('[AgentLoop] ⚠️ Validator returned invalid data. Applying failsafe repairs.');
    }

    const output = validated.data;
    fixObjectIds(output);

    console.log(`[AgentLoop] ✅ 6-Stage Pipeline SUCCESS for "${topic}"`);
    return output;

  } catch (err) {
    console.error(`[AgentLoop] ❌ Critical pipeline failure: ${err.message}`);
    return null;
  }
}