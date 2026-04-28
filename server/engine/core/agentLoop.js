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

import { requestCompletion, getModel } from '../../utils/ai/llmClient.js';
import { getPrompt } from '../config/promptRegistry.js';
import { SceneGraphSchema } from '../validators/timelineSchema.js';
import VectorStoreService from './vectorStore.js';
import { validateVisualScript } from './visualScriptValidator.js';

// ─── Robust JSON Extractor ────────────────────────────────────────────────────
// FIX 1: Old code had a regex that only matched JSON with "elements"/"timeline" 
// at root level. New Validator wraps everything in "final_output" → old regex = null always.
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Precise Markdown Block Extraction
  const jsonBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of jsonBlocks) {
    try {
      const cleaned = match[1].trim();
      return JSON.parse(cleaned);
    } catch (_) { /* continue */ }
  }

  // 2. Loose Brace Extraction (handles leading/trailing chatter)
  const stack = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (stack.length === 0) start = i;
      stack.push('{');
    } else if (text[i] === '}') {
      if (stack.length > 0) {
        stack.pop();
        if (stack.length === 0 && start !== -1) {
          try {
            const candidate = text.substring(start, i + 1);
            return JSON.parse(candidate);
          } catch (_) { /* continue search */ }
        }
      }
    }
  }

  // 3. Last Resort: Trimmed direct parse
  try {
    return JSON.parse(text.trim());
  } catch (_) {
    return null;
  }
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
  if (raw.elements || raw.objects || raw.timeline || raw.steps) {
    console.log('[AgentLoop] Output already in legacy format — passing through.');
    return raw;
  }

  // Case B: New format — unwrap final_output
  const inner = raw.final_output || raw; 
  if (typeof inner !== 'object' || inner === null) {
    console.warn('[AgentLoop] ⚠️ inner final_output is not an object. Unwrap failed.');
    return null;
  }
  
  const meta        = inner.meta || {};
  const narrations  = inner.narrations    || inner.explanation_steps || inner.narration_steps || inner.narrative_steps || inner.steps || inner.sequence || inner.roadmap || [];
  const visualSteps = inner.visual_steps  || inner.visuals || inner.scene_steps || inner.visual_timeline || inner.visualization || inner.frames || [];
  const animSteps   = inner.animation_steps || inner.animations || inner.transitions || inner.motion_steps || inner.animation_timeline || [];

  if (visualSteps.length === 0 && narrations.length === 0 && animSteps.length === 0) {
    console.warn('[AgentLoop] ⚠️ Checked all aliases (visual_steps, narrations, animation_steps, etc.) and found 0 content. Unwrap failed.');
    return null;
  }

  // Collect all elements declared across all steps (deduplicated by id)
  const elementMap = new Map();
  for (const vs of visualSteps) {
    for (const el of (vs.elements || vs.objects || vs.shapes || [])) {
      if (el?.id && !elementMap.has(el.id)) {
        // Ensure every element has a type fallback
        if (!el.type && el.shape) el.type = el.shape;
        if (!el.type) el.type = 'orb';
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
    
    // Combine visualizer elements (setup) with animator actions
    const visualActions = (vs.elements || vs.objects || vs.shapes || []).map(el => ({
      ...el,
      action: el.action || el.cmd || el.type,
      duration: el.duration || 0, // Setup is usually instant
      delay: el.delay || 0
    }));

    const rawAnimationActions = anim.actions || anim.animations || [];
    const animationActions = rawAnimationActions.map(a => ({
      ...a,
      action: a.action || a.cmd
    }));

    const combinedActions = [...visualActions, ...animationActions];
    
    const firstAnim = animationActions[0] || {};
    const exitIds   = new Set(vs.exits || []);
    const mutations = (vs.mutations || []).map(m => ({ id: m.id, props: m.props || m.values || {} }));
    
    // Determine which elements are visible in this specific step
    const stepLocalIds = (vs.elements || vs.objects || vs.shapes || []).map(e => e.id).filter(Boolean);
    const allKnownIds = [...elementMap.keys()];
    const visibleIds = allKnownIds.filter(id => {
      if (exitIds.has(id)) return false;
      return true; // Simple "additive" visibility for now
    });

    return {
      title:           narration.title || vs.title || `Step ${stepNum}`,
      explanation:     narration.text  || narration.explanation || narration.narration || vs.description || `Step ${stepNum}.`,
      narration:       narration.text  || narration.explanation || '',
      callout:         narration.callout || null,
      highlight_terms: narration.highlight_terms || narration.keywords || [],
      objectIds:       visibleIds,
      highlightIds:    stepLocalIds,
      mutations:       mutations,
      camera:          vs.camera || anim.camera || { x: 0.5, y: 0.5, zoom: 1.0 },
      animation: {
        type:     animTypeAliases[anim.global_transition || vs.transition || firstAnim.action] || 'fade',
        duration: firstAnim.duration || 0.6,
        easing:   firstAnim.easing   || 'ease_out',
        actions:  validateVisualScript(combinedActions),
      },
    };
  });

  const result = {
    scene:       { title: meta.topic || 'Learning Session', type: 'linear' },
    meta:        { topic: meta.topic, concept_type: meta.concept_type, level: meta.level, core_insight: meta.core_insight },
    elements,
    connections: inner.connections || [],
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
    step.objectIds = filtered.length > 0 ? filtered : [];
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

// ─── User Context Helper ──────────────────────────────────────────────────────
function getUserContext(userConfig) {
  if (!userConfig) return '';
  return `
---
STUDENT CONTEXT:
- Name: ${userConfig.nickname || userConfig.name || 'Student'}
- Role: ${userConfig.role || 'Learner'}
${userConfig.customInstructions ? `- Custom AI Behavior: ${userConfig.customInstructions}` : ''}
---
`;
}

// ─── Single Stage Executor ────────────────────────────────────────────────────
async function runStage({ stageName, prompt, input, model, onProgress, userConfig, onStream }) {
  onProgress(stageName);
  console.log(`[AgentLoop] 🎭 Stage: ${stageName}...`);

  const userContext = getUserContext(userConfig);
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[AgentLoop] Agent retry attempt ${attempt}, rebuilding messages fresh`);
      }

      const currentMessages = [
        { role: 'system', content: userContext + prompt },
        { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }
      ];

      if (attempt > 1) {
        currentMessages.push({ 
          role: 'user', 
          content: 'Your previous response was not valid JSON. Please respond ONLY with a valid JSON object. No explanation, no conversational text, and no markdown code fences.' 
        });

        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[AgentLoop] ⏳ Retrying Stage "${stageName}" (Attempt ${attempt}) in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const stageFile = input?.file || null;

      const response = await requestCompletion({
        model: model || getModel(),
        messages: currentMessages,
        temperature: 0.3,
        maxTokens: stageName.includes('Finalizing') ? 8000 : 4000, 
        userConfig,
        responseMimeType: 'application/json',
        taskType: 'teaching',
        onStream: attempt === 1 ? onStream : undefined, // Only stream on the first attempt to avoid UI duplication
        file: stageFile,
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
export async function runAgentLoop({ topic, domain, model = null, onProgress = () => {}, systemPrompt = null, maxSteps = null, planningResult = null, userConfig = null, learnerProfile = null, file = null }) {
  console.log(`[AgentLoop] 🚀 Starting 6-Stage Orchestration for: "${topic}"`);

  try {
    // Stage 1: PLANNING (Inject dynamic step limits)
    const minSteps = Math.max(4, Math.floor((maxSteps || 16) / 2));
    const targetMax = maxSteps || 16;
    
    // Phase 5: Semantic Retrieval
    const pastContext = await VectorStoreService.getContextForTopic(topic);
    

    const pastContextStr = learnerProfile?.history 
      ? learnerProfile.history.map(s => `[${new Date(s.timestamp).toLocaleDateString()}] ${s.topic}: ${s.summary}`).join('\n')
      : (pastContext || "No prior sessions found for this topic.");

    const learnerStyleStr = learnerProfile?.learning_style || "General (Visual-Conceptual balance)";

    const plannerPrompt = (systemPrompt || getPrompt('planner'))
      .replace('{{MIN_STEPS}}', minSteps.toString())
      .replace('{{MAX_STEPS}}', targetMax.toString())
      .replace('{{PAST_CONTEXT}}', pastContextStr)
      .replace('{{LEARNER_STYLE}}', learnerStyleStr);

    const plannerOutput = planningResult || await runStage({
      stageName: '💡 Thinking deeply about the topic...',
      prompt: plannerPrompt,
      input: { topic, domain, maxSteps: targetMax, learnerProfile, file },
      model, onProgress, userConfig
    });

    // Capture normalized topic from planner if available
    const normalizedTopic = plannerOutput.topic || topic;
    console.log(`[AgentLoop] ✅ Stage 1 (Planner) COMPLETE — ${plannerOutput.flow?.length || 0} steps planned | Topic: ${normalizedTopic}`);

    // Stages 2 & 3: PARALLEL EXECUTION (Narration & Visualization)
    console.log('[AgentLoop] ⚡ Starting Stages 2 (Narrator) & 3 (Visualizer) in PARALLEL...');
    
    const [narratorOutput, visualizerOutput] = await Promise.all([
      // Stage 2: NARRATION (Streaming)
      runStage({
        stageName: '🎙️ Crafting pedagogical explanations...',
        prompt: getPrompt('narrator'),
        input: { plannerOutput, learnerProfile },
        model, onProgress, userConfig,
        onStream: (chunk) => onProgress('narration_chunk', chunk)
      }),
      // Stage 3: VISUALIZATION (Now independent of Narrator)
      runStage({
        stageName: '🎨 Designing visual representation...',
        prompt: getPrompt('visualizer'),
        input: { plannerOutput, learnerProfile }, // Decoupled: only needs the plan
        model, onProgress, userConfig
      })
    ]);

    console.log(`[AgentLoop] ✅ Stages 2 & 3 COMPLETE — ${narratorOutput.narrations?.length || 0} narrations, ${visualizerOutput.visual_steps?.length || 0} visual steps`);

    // Stage 4: ANIMATION
    const animatorOutput = await runStage({
      stageName: 'Choreographing cinematic motion...',
      prompt: getPrompt('animator'),
      input: { plannerOutput, visualizerOutput, learnerProfile },
      model, onProgress, userConfig
    });
    console.log(`[AgentLoop] ✅ Stage 4 — ${animatorOutput.animation_steps?.length || 0} animation steps`);

    // Stage 5: CRITIQUE — Trimmed context to prevent context window explosion
    const criticInput = {
      narrations:      narratorOutput.narrations || [],
      visual_steps:    visualizerOutput.visual_steps || [],
      animation_steps: animatorOutput.animation_steps || [],
      topic:           normalizedTopic,
      domain,
      learnerProfile,
      stepCount:       plannerOutput.flow?.length || 0,
    };
    const criticOutput = await runStage({
      stageName: '⚖️ Reviewing for consistency & clarity...',
      prompt: getPrompt('critic'),
      input: criticInput,
      model, onProgress, userConfig
    });
    console.log(`[AgentLoop] ✅ Stage 5 — approved: ${criticOutput.approved}, score: ${criticOutput.scores?.overall}`);

    // APPLY PATCHES: Merge critic's patch_suggestions into prior outputs before validation
    if (criticOutput.patch_suggestions) {
      const patches = criticOutput.patch_suggestions;
      if (patches.narrations) {
        console.log(`[AgentLoop] 🩹 Patching narrations (${narratorOutput.narrations?.length} -> ${patches.narrations.length} items)`);
        narratorOutput.narrations = patches.narrations;
      }
      if (patches.visual_steps) {
        console.log(`[AgentLoop] 🩹 Patching visual_steps (${visualizerOutput.visual_steps?.length} -> ${patches.visual_steps.length} items)`);
        visualizerOutput.visual_steps = patches.visual_steps;
      }
      if (patches.animation_steps) {
        console.log(`[AgentLoop] 🩹 Patching animation_steps (${animatorOutput.animation_steps?.length} -> ${patches.animation_steps.length} items)`);
        animatorOutput.animation_steps = patches.animation_steps;
      }
    }

    // CRITIC GATING
    const overallScore = criticOutput.scores?.overall || 10;
    if (criticOutput.approved === false) {
      if (overallScore < 3) {
         console.warn(`[AgentLoop] ❌ CRITICAL: Critic rejected pipeline with score ${overallScore}. Triggering failsafe.`);
         throw new Error(`Critic rejection (score ${overallScore})`);
      } else if (overallScore < 5) {
         console.warn(`[AgentLoop] ⚠️ WARNING: Critic scored ${overallScore}. Proceeding with patches but quality may be low.`);
      }
    }

    // Stage 6: VALIDATION — Only critic feedback + patched essential outputs
    const validatorInput = {
      critic:          { approved: criticOutput.approved, scores: criticOutput.scores, issues: criticOutput.issues },
      narrations:      narratorOutput.narrations || [],
      visual_steps:    visualizerOutput.visual_steps || [],
      animation_steps: animatorOutput.animation_steps || [],
      topic:           normalizedTopic,
      learnerProfile,
    };
    const validatorRaw = await runStage({
      stageName: '✨ Finalizing high-fidelity plan...',
      prompt: getPrompt('validator'),
      input: validatorInput,
      model, onProgress, userConfig
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

    console.log(`[AgentLoop] ✅ Pipeline SUCCESS — ${output.elements?.length || 0} elements, ${output.timeline?.length || 0} steps`);
    return output;

  } catch (err) {
    console.error(`[AgentLoop] ❌ Critical failure: ${err.message}`);
    return null;
  }
}