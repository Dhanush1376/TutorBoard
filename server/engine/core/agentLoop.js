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

import { requestCompletion, getModel, getFastModel } from '../../utils/ai/llmClient.js';
import { getPrompt } from '../config/promptRegistry.js';
import { SceneGraphSchema } from '../validators/timelineSchema.js';
import VectorStoreService from './vectorStore.js';
import { validateVisualScript } from './visualScriptValidator.js';
import { searchWeb } from '../../utils/ai/webSearchService.js';
import { shouldSearch, detectTools } from '../../utils/ai/searchGate.js';
import { formatForPrompt, extractSources } from '../../utils/ai/searchContextFormatter.js';

// Global concurrency limiter — prevents provider rate limit saturation
let activeAgentLoops = 0;
const MAX_CONCURRENT_LOOPS = 3;

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

  // FORCE NORMALIZATION: Always check for alternate field names like visual_steps vs steps
  const meta        = inner.meta || {};
  const rawNarrations  = inner.narrations    || inner.explanation_steps || inner.narration_steps || inner.narrative_steps || inner.steps || inner.sequence || inner.roadmap || [];
  const rawVisualSteps = inner.visual_steps  || inner.visuals || inner.scene_steps || inner.visual_timeline || inner.visualization || inner.frames || inner.script || [];
  const rawAnimSteps   = inner.animation_steps || inner.animations || inner.transitions || inner.motion_steps || inner.animation_timeline || [];

  // If the Validator output was already in legacy format (raw.steps), 
  // but those steps had "elements" instead of "actions", we need to normalize them.
  const narrations = rawNarrations.map(n => typeof n === 'string' ? { text: n } : n);
  const visualSteps = rawVisualSteps.map(v => ({
    ...v,
    elements: v.elements || v.objects || v.shapes || v.visuals || [],
    _script: v.script || [] // Kept separate, merged into animationActions below
  }));
  const animSteps = rawAnimSteps;

  if (visualSteps.length === 0 && narrations.length === 0 && animSteps.length === 0) {
    console.warn('[AgentLoop] ⚠️ Checked all aliases (visual_steps, narrations, animation_steps, etc.) and found 0 content. Unwrap failed.');
    return null;
  }

  // Collect all elements declared across all steps (deduplicated by id)
  const elementMap = new Map();
  for (const vs of visualSteps) {
    // A. Explicit elements
    for (const el of vs.elements) {
      if (el?.id && !elementMap.has(el.id)) {
        if (!el.type && el.shape) el.type = el.shape;
        if (!el.type) el.type = 'orb';
        elementMap.set(el.id, el);
      }
    }
    // B. Elements implied by script commands (e.g. array, pointer)
    const ELEMENT_DEFINING_COMMANDS = new Set(['array', 'pointer', 'tree', 'chart', 'timeline', 'equation', 'physics_body', 'draw_boundary', 'result']);
    for (const cmd of (vs._script || [])) {
      if (cmd.id && ELEMENT_DEFINING_COMMANDS.has(cmd.cmd) && !elementMap.has(cmd.id)) {
        elementMap.set(cmd.id, { id: cmd.id, type: cmd.cmd || 'orb', ...cmd });
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
    const visualActions = (vs.elements || []).map(a => ({
      ...a,
      cmd: a.cmd || a.action || a.type,
      duration: a.duration || 0, // Setup is usually instant
      delay: a.delay || 0
    }));

    const rawAnimationActions = anim.actions || anim.animations || [];
    const animationActions = [...(vs._script || []), ...rawAnimationActions].map(a => ({
      ...a,
      cmd: a.cmd || a.action
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
      howItWorks:      narration.howItWorks || [],
      pseudocode:      narration.pseudocode || '',
      timeComplexity:  narration.timeComplexity || '',
      spaceComplexity: narration.spaceComplexity || '',
      variables:       narration.variables || vs.variables || {},
      activeStates:    narration.activeStates || vs.activeStates || [],
      interactiveControls: vs.interactive_controls || vs.interactiveControls || visualActions.find(a => a.action === 'interactive_controls' || a.cmd === 'interactive_controls') || null,
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
async function runStage({ stageName, prompt, input, model, onProgress, userConfig, onStream, signal }) {
  onProgress(stageName);
  console.log(`[AgentLoop] 🎭 Stage: ${stageName}...`);

  const userContext = getUserContext(userConfig);
  let lastError = null;

  // AGGRESSIVE TIMEOUT FOR AGENT PIPELINE:
  // We want individual agents to fail fast so the whole pipeline doesn't hang for 10+ minutes.
  const STAGE_TIMEOUT = 20000; // 20 seconds

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[AgentLoop] Agent retry attempt ${attempt} for "${stageName}"`);
      }

      const currentMessages = [
        { role: 'system', content: userContext + prompt },
        { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }
      ];

      if (attempt > 1) {
        currentMessages.push({ 
          role: 'user', 
          content: 'Your previous response was not valid JSON. Please respond ONLY with a valid JSON object. No explanation and no markdown code fences.' 
        });
      }

      const stageFile = input?.file || null;

      // Wrap in timeout to prevent provider hangs
      const response = await Promise.race([
        requestCompletion({
          model: model || getModel(),
          messages: currentMessages,
          temperature: 0.3,
          maxTokens: stageName.includes('Finalizing') ? 8000 : 4000, 
          userConfig,
          responseMimeType: 'application/json',
          taskType: 'teaching',
          onStream: attempt === 1 ? onStream : undefined,
          file: stageFile,
          skipRacing: true, // Don't double-race within the loop
          signal,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('STAGE_TIMEOUT')), STAGE_TIMEOUT))
      ]);

      if (!response?.content) throw new Error('Empty response');

      const parsed = extractJSON(response.content);
      if (!parsed) throw new Error(`JSON parse failed. Preview: ${response.content.substring(0, 100)}`);

      return parsed;
    } catch (err) {
      console.warn(`[AgentLoop] ⚠️ Stage "${stageName}" attempt ${attempt} FAILED: ${err.message}`);
      lastError = err;
      
      // If it's a timeout, don't even bother retrying if it's already been a long time
      if (err.message === 'STAGE_TIMEOUT' && attempt >= 1) break;
    }
  }
  throw lastError;
}

// ─── Failsafe Fallback Generator ───────────────────────────────────────────
function createFallbackTimeline(topic, errorMsg = 'Pedagogical validation failed') {
  console.log(`[AgentLoop] 🛡️ Creating fallback timeline for: "${topic}"`);
  return {
    scene: { title: topic || 'Learning Session', type: 'linear' },
    meta: { topic: topic || 'Learning Session', concept_type: 'general', level: 'intermediate' },
    elements: [
      { id: 'fallback-orb', type: 'orb', x: 0.5, y: 0.4, radius: 0.1, color: '#4F46E5', label: topic || 'Topic' }
    ],
    timeline: [
      {
        title: 'Introduction',
        explanation: `Our visual engine is experiencing high demand right now. Let me explain the core concept of **${topic}** here while I try to re-initialize the simulation in the background. (${errorMsg})`,
        objectIds: ['fallback-orb'],
        animation: { type: 'fade', duration: 0.8, actions: [{ id: 'fallback-orb', cmd: 'fade_in' }] }
      }
    ]
  };
}

// ─── Main Autonomous Loop ─────────────────────────────────────────────────────
export async function runAgentLoop(params) {
  // If too many loops are running, queue this one
  if (activeAgentLoops >= MAX_CONCURRENT_LOOPS) {
    if (params.onProgress) params.onProgress('⏳ Preparing your lesson...');
    // Jittered wait to prevent thundering herd
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
  }
  
  activeAgentLoops++;
  try {
    return await _runAgentLoopInternal(params);
  } finally {
    activeAgentLoops--;
  }
}

async function _runAgentLoopInternal({ topic, domain, model = null, onProgress = () => {}, systemPrompt = null, maxSteps = null, planningResult = null, userConfig = null, learnerProfile = null, file = null, signal = null }) {
  console.log(`[AgentLoop] 🚀 Starting 6-Stage Orchestration for: "${topic}"`);

  // Use a deep reasoning model for planning/narrative, but a fast/cheap one for
  // structural tasks (visualizer, animator, critic, validator).
  const fullModel = model || getModel();
  const fastModel = getFastModel();

  try {
    // Stage 1: PLANNING (Inject dynamic step limits)
    const minSteps = Math.max(4, Math.floor((maxSteps || 16) / 2));
    const targetMax = maxSteps || 16;
    
    // Phase 5: Semantic Retrieval + Web Search (Parallel)
    const userId = userConfig?.userId || learnerProfile?.userId || null;

    const toolDecision = detectTools(topic);
    const doSearch = toolDecision.useWebSearch || shouldSearch(topic, domain);

    onProgress('🔍 Researching background context & web data...');
    const researchStart = Date.now();

    const [pastContext, webResults] = await Promise.all([
      VectorStoreService.getContextForTopic(topic, 3, userId),
      doSearch ? searchWeb(topic, { count: 5 }) : Promise.resolve([])
    ]).catch(err => {
      console.warn(`[AgentLoop] ⚠️ Research phase error: ${err.message}. Continuing without context.`);
      return ["", []];
    });

    console.log(`[AgentLoop] ✅ Research phase COMPLETE (${Date.now() - researchStart}ms)`);

    const pastContextStr = learnerProfile?.past_context || pastContext || "No prior sessions found for this topic.";
    const learnerStyleStr = learnerProfile?.learning_style || "General (Visual-Conceptual balance)";
    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    if (sources.length > 0) {
      console.log(`[AgentLoop] 🌐 Web search returned ${sources.length} sources for: "${topic.substring(0, 40)}..."`);
    }

    onProgress('🧠 Synthesizing lesson plan & curriculum structure...');
    const plannerPrompt = (systemPrompt || getPrompt('planner'))
      .replace(/{{MIN_STEPS}}/g, String(minSteps))
      .replace(/{{MAX_STEPS}}/g, String(targetMax))
      .replace(/{{PAST_CONTEXT}}/g, String(pastContextStr))
      .replace(/{{LEARNER_STYLE}}/g, String(learnerStyleStr))
      .replace(/{{WEB_CONTEXT}}/g, webContextStr || 'No recent web data available.');

    const plannerOutput = planningResult || await runStage({
      stageName: '💡 Thinking deeply about the topic...',
      prompt: plannerPrompt,
      input: { topic, domain, maxSteps: targetMax, learnerProfile, file },
      model: fullModel, onProgress, userConfig, signal
    });

    // Capture normalized topic from planner if available
    const normalizedTopic = plannerOutput.topic || topic;
    console.log(`[AgentLoop] ✅ Stage 1 (Planner) COMPLETE — ${plannerOutput.flow?.length || 0} steps planned | Topic: ${normalizedTopic}`);

    // Stages 2 & 3: PARALLEL EXECUTION (Narration & Visualization)
    console.log('[AgentLoop] ⚡ Starting Stages 2 (Narrator) & 3 (Visualizer) in PARALLEL...');
    
    const [narratorOutput, visualizerOutput] = await Promise.all([
      // Stage 2: NARRATION (Streaming) — FULL MODEL
      runStage({
        stageName: '🎙️ Crafting pedagogical explanations...',
        prompt: getPrompt('narrator'),
        input: { plannerOutput, learnerProfile, webContextStr },
        model: fullModel, onProgress, userConfig,
        onStream: (chunk) => onProgress('narration_chunk', chunk),
        signal
      }),
      // Stage 3: VISUALIZATION — FAST MODEL
      runStage({
        stageName: '🎨 Designing visual representation...',
        prompt: getPrompt('visualizer'),
        input: { plannerOutput, learnerProfile, webContextStr }, // Pass webContext to visualizer too
        model: fastModel, onProgress, userConfig,
        signal
      })
    ]);

    console.log(`[AgentLoop] ✅ Stages 2 & 3 COMPLETE — ${narratorOutput.narrations?.length || 0} narrations, ${visualizerOutput.visual_steps?.length || 0} visual steps`);

    onProgress('🎞️ Generating cinematic animation sequences...');
    // Stage 4: ANIMATION — FAST MODEL
    let animatorOutput = await runStage({
      stageName: 'Choreographing cinematic motion...',
      prompt: getPrompt('animator'),
      input: { plannerOutput, visualizerOutput, learnerProfile },
      model: fastModel, onProgress, userConfig, signal
    });

    // FIX STAGE 4: Schema Normalization (Single object -> Array)
    if (!animatorOutput.animation_steps && animatorOutput.actions) {
       console.log('[AgentLoop] 🔄 Normalizing Animator output (single step object -> array)');
       animatorOutput = { animation_steps: [{ step: animatorOutput.step || 1, actions: animatorOutput.actions }] };
    }

    console.log(`[AgentLoop] ✅ Stage 4 — ${animatorOutput.animation_steps?.length || 0} animation steps`);

    // Stage 5: CRITIQUE — FAST MODEL
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
      model: fastModel, onProgress, userConfig, signal
    });
    console.log(`[AgentLoop] ✅ Stage 5 — approved: ${criticOutput.approved}, score: ${criticOutput.scores?.overall}`);

    // CRITIC GATING (STAGE 5)
    const overallScore = criticOutput.scores?.overall || 0;
    if (criticOutput.approved === false) {
      if (overallScore < 7) {
         console.warn(`[AgentLoop] ❌ CRITICAL: Critic rejected pipeline with score ${overallScore}. Triggering failsafe.`);
         throw new Error(`Critic rejection (score ${overallScore})`);
      } else {
         console.warn(`[AgentLoop] ⚠️ WARNING: Critic scored ${overallScore} but rejected. Proceeding with patches.`);
      }
    }

    // APPLY PATCHES: Merge critic's patch_suggestions into prior outputs AFTER gating
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

    // Stage 6: VALIDATION — FAST MODEL
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
      model: fastModel, onProgress, userConfig, signal
    });
    console.log(`[AgentLoop] ✅ Stage 6 — status: ${validatorRaw.status}`);

    // FIX 2: Unwrap { final_output: { visual_steps, narrations } } → { elements, timeline }
    const unwrapped = unwrapValidatorOutput(validatorRaw);
    if (!unwrapped) {
      console.warn('[AgentLoop] ⚠️ unwrapValidatorOutput returned null — triggering failsafe.');
      return createFallbackTimeline(normalizedTopic, 'Unwrap failed');
    }

    const validated = validateSceneGraph(unwrapped);
    if (!validated.valid) {
      if (validated.fatal) {
        return createFallbackTimeline(normalizedTopic, validated.errors[0] || 'Fatal validation error');
      }
      console.warn('[AgentLoop] ⚠️ Validation issues (non-fatal):', validated.errors.join(', '));
    }

    const output = validated.data || unwrapped;

    // Attach web sources to the output for citation display
    if (sources && sources.length > 0) {
      output.sources = sources;
    }

    console.log(`[AgentLoop] ✅ Pipeline SUCCESS — ${output.elements?.length || 0} elements, ${output.timeline?.length || 0} steps`);
    return output;

  } catch (err) {
    console.error(`[AgentLoop] ❌ Critical failure: ${err.message}`);
    return createFallbackTimeline(topic, err.message);
  }
}