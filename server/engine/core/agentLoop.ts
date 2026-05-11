/**
 * AgentLoop v8.0 — 6-Stage Autonomous Orchestration Pipeline (TypeScript)
 */

import { requestCompletion, getModel, getFastModel, resolveModelId } from '../../utils/ai/llmClient.js';
import { getPrompt } from '../config/promptRegistry.js';
import { SceneGraphSchema } from '../validators/timelineSchema.js';
import VectorStoreService from './vectorStore.js';
import { validateVisualScript } from './visualScriptValidator.js';
import { searchWeb } from '../../utils/ai/webSearchService.js';
import { shouldSearch, detectTools } from '../../utils/ai/searchGate.js';
import { formatForPrompt, extractSources } from '../../utils/ai/searchContextFormatter.js';
import { calculateCost } from '../../utils/ai/providerFactory.js';
import * as Sentry from '@sentry/node';

// Utilities
import { extractJSON } from './utils/jsonUtils.js';
import { unwrapValidatorOutput } from './utils/schemaBridge.js';
import { PipelineState, LearnerProfile, runStageParams, AgentLoopParams } from './utils/types.js';

// Pipeline Constants
const SESSION_TOKEN_BUDGET = 100000;
const COST_DOWNGRADE_THRESHOLD_CENTS = 50; // $0.50 (Raised from 5c to prevent premature downgrade)
const STAGE_TIMEOUT = 30000; // 30 seconds (keeps 6 stages under 240s budget)

/**
 * Single Stage Executor
 */
async function runStage(params: runStageParams): Promise<any> {
  const { stageName, prompt, input, model, onProgress, userConfig, onStream, signal, requiredKeys = [], pipelineState, requestId } = params;
  
  onProgress(stageName);
  console.log(`[AgentLoop] 🎭 Stage: ${stageName}...`);

  const userContext = getUserContext(userConfig);
  let lastError: any = null;

  // Token Budget Check
  if (pipelineState && (pipelineState.tokens_in + pipelineState.tokens_out) > SESSION_TOKEN_BUDGET) {
    throw new Error('SESSION_TOKEN_BUDGET_EXCEEDED');
  }

  let activeModel = model || getModel();

  // Cost Guardrail: Downgrade model if it's too expensive for this stage
  const promptText = prompt + (typeof input === 'string' ? input : JSON.stringify(input));
  const estPromptTokens = promptText.length / 3.5; 
  const estCompletionTokens = stageName.includes('Finalizing') ? 2000 : 1000;
  const estCost = calculateCost(resolveModelId(activeModel), Math.ceil(estPromptTokens), estCompletionTokens).costCents;

  if (estCost > COST_DOWNGRADE_THRESHOLD_CENTS && activeModel !== getFastModel()) {
    console.warn(`[AgentLoop:Guardrail] Stage "${stageName}" estimated cost (${estCost.toFixed(2)}¢) exceeds threshold. Downgrading to fast model.`);
    activeModel = getFastModel();
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const currentMessages = [
        { role: 'system' as const, content: userContext + prompt },
        { role: 'user' as const, content: typeof input === 'string' ? input : JSON.stringify(input) }
      ];

      if (attempt > 1) {
        const schemaHint = requiredKeys.length > 0 
          ? ` Your output MUST be a JSON object containing these keys: ${requiredKeys.join(', ')}.`
          : '';
        currentMessages.push({ 
          role: 'user' as const, 
          content: `Your previous response was not valid or was missing required data.${schemaHint} Please respond ONLY with the complete, valid JSON object. No explanation.` 
        });
      }

      const stageFile = input?.file || null;
      const stageMaxTokens = stageName.includes('Finalizing') ? 8000 : 4000;

      const response = await Promise.race([
        requestCompletion({
          model: activeModel,
          messages: currentMessages,
          temperature: 0.3,
          maxTokens: stageMaxTokens, 
          userConfig,
          responseMimeType: 'application/json',
          taskType: 'teaching',
          onStream: attempt === 1 ? onStream : undefined,
          file: stageFile,
          skipRacing: true,
          signal,
          sessionContext: pipelineState?.topic || null,
          requestId,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('STAGE_TIMEOUT')), STAGE_TIMEOUT))
      ]) as any;

      if (response?.error) throw new Error(response.error);
      if (!response?.content) throw new Error('Empty response from AI');

      if (pipelineState) {
        pipelineState.tokens_in += response._meta?.tokens_in || 0;
        pipelineState.tokens_out += response._meta?.tokens_out || 0;
        pipelineState.total_cost_cents += response._meta?.estimated_cost_cents || 0;
        console.log(`[AgentLoop:Cost] ${stageName}: ${(response._meta?.estimated_cost_cents || 0).toFixed(2)}¢ | Pipeline Total: ${pipelineState.total_cost_cents.toFixed(2)}¢`);
      }

      const parsed = extractJSON(response.content);
      if (!parsed) throw new Error(`JSON parse failed.`);

      if (requiredKeys.length > 0) {
        const missing = requiredKeys.filter(k => !parsed[k]);
        if (missing.length > 0) throw new Error(`Missing required keys: ${missing.join(', ')}`);
      }

      return parsed;
    } catch (err) {
      console.error(`[AgentLoop] ❌ Stage "${stageName}" attempt ${attempt} FAILED:`, err);
      lastError = err;
      if (err instanceof Error && err.message === 'STAGE_TIMEOUT' && attempt >= 2) break;
    }
  }
  throw lastError;
}

/**
 * Failsafe Fallback Generator
 */
async function createFallbackTimeline(topic: string, userConfig: any, errorMsg = 'Pedagogical validation failed') {
  console.log(`[AgentLoop] 🛡️ Creating fallback timeline for: "${topic}"`);
  
  let explanation = `Our visual engine is experiencing high demand right now. Let me explain the core concept of **${topic}** here while I try to re-initialize the simulation in the background. (${errorMsg})`;

  try {
    // Attempt a quick text-only explanation if the pipeline failed
    const res = await requestCompletion({
      model: getFastModel(),
      messages: [
        { role: 'system', content: 'You are a helpful tutor. The visual engine failed. Provide a brief, 3-sentence high-level explanation of the topic requested.' },
        { role: 'user', content: `Topic: ${topic}` }
      ],
      temperature: 0.7,
      maxTokens: 300,
      userConfig
    });
    if (res.content) explanation = res.content;
  } catch (err) {
    console.warn('[AgentLoop] Fallback explanation generation failed');
  }

  return {
    scene: { title: topic || 'Learning Session', type: 'linear' },
    meta: { topic: topic || 'Learning Session', concept_type: 'general', level: 'intermediate' },
    elements: [
      { id: 'fallback-orb', type: 'orb', x: 0.5, y: 0.4, radius: 0.1, color: '#4F46E5', label: topic || 'Topic' }
    ],
    timeline: [
      {
        title: 'Introduction',
        explanation,
        objectIds: ['fallback-orb'],
        animation: { type: 'fade', duration: 0.8, actions: [{ id: 'fallback-orb', cmd: 'fade_in' }] }
      }
    ]
  };
}

/**
 * Scene Graph Validator
 */
function validateSceneGraph(obj: any) {
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  if (obj.objects && !obj.elements) obj.elements = obj.objects;
  if (obj.steps   && !obj.timeline) obj.timeline = obj.steps;

  // fixObjectIds logic
  const elements = obj.elements || [];
  const validIds = new Set(elements.map((e: any) => e?.id).filter(Boolean));
  (obj.timeline || []).forEach((step: any) => {
    if (!step) return;
    const raw = step.objectIds || step.elements || [];
    const filtered = raw.filter((id: any) => validIds.has(id));
    step.objectIds = filtered.length > 0 ? filtered : [];
    if (step.highlightIds) step.highlightIds = step.highlightIds.filter((id: any) => validIds.has(id));
    if (step.mutations)    step.mutations    = step.mutations.filter((m: any) => validIds.has(m?.id));
  });

  const result = SceneGraphSchema.safeParse(obj);
  const errors: string[] = [];

  if (!result.success) {
    result.error.issues.forEach(i => errors.push(`${i.path.join('.')}: ${i.message}`));
  }

  if ((obj.timeline || []).length < 1) {
    return { valid: false, errors: ['Timeline empty'], fatal: true };
  }

  if (errors.length > 12) { 
    return { valid: false, errors, fatal: true };
  }

  return { valid: errors.length === 0, errors, data: result.success ? result.data : obj };
}

function getUserContext(userConfig: any) {
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

/**
 * Main Autonomous Loop
 */
export async function runAgentLoop(params: AgentLoopParams) {
  const { 
    topic, domain, model, onProgress = (s: string, d?: any) => {}, 
    systemPrompt, maxSteps, planningResult, 
    userConfig, learnerProfile, file, 
    signal, socket, requestId 
  } = params;

  console.log(`[AgentLoop] 🚀 Starting 6-Stage Orchestration for: "${topic}"`);

  const pipelineState: PipelineState = {
    tokens_in: 0,
    tokens_out: 0,
    total_cost_cents: 0,
    topic: topic
  };

  const fullModel = model || getModel();
  const fastModel = getFastModel();

  try {
    const minSteps = Math.max(4, Math.floor((maxSteps || 16) / 2));
    const targetMax = maxSteps || 16;
    
    const userId = userConfig?.userId || null;
    const toolDecision = detectTools(topic);
    const doSearch = toolDecision.useWebSearch || shouldSearch(topic, domain);

    onProgress('🔍 Researching background context & web data...');
    
    const researchTask = Promise.all([
      VectorStoreService.getContextForTopic(topic, 3, userId).catch(() => "Local context unavailable."),
      doSearch ? searchWeb(topic, { count: 5 }).catch(() => []) : Promise.resolve([])
    ]);

    const [pastContext, webResults] = await Promise.race([
      researchTask,
      new Promise<[string, any[]]>((resolve) => setTimeout(() => resolve(["Timeout", []]), 15000))
    ]);

    const pastContextStr = learnerProfile?.past_context || pastContext || "No prior sessions found for this topic.";
    const learnerStyleStr = learnerProfile?.learning_style || "General (Visual-Conceptual balance)";
    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

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
      model: fullModel, onProgress, userConfig, signal,
      requiredKeys: ['flow', 'topic'],
      pipelineState,
      requestId
    });

    const normalizedTopic = plannerOutput.topic || topic;
    
    // Stages 2 & 3 in Parallel
    const [narratorOutput, visualizerOutput] = await Promise.all([
      runStage({
        stageName: '🎙️ Crafting pedagogical explanations...',
        prompt: getPrompt('narrator'),
        input: { plannerOutput, learnerProfile, webContextStr, file },
        model: fullModel, onProgress, userConfig,
        onStream: (chunk) => onProgress('narration_chunk', chunk),
        signal,
        requiredKeys: ['narrations'],
        pipelineState
      }),
      runStage({
        stageName: '🎨 Designing visual representation...',
        prompt: getPrompt('visualizer'),
        input: { plannerOutput, learnerProfile, webContextStr: webContextStr?.split("\n").slice(0, 8).join("\n"), file },
        model: fullModel, onProgress, userConfig,
        signal,
        requiredKeys: ['visual_steps'],
        pipelineState,
        requestId
      })
    ]);

    // Stage 4: Animation
    let animatorOutput = await runStage({
      stageName: '🎞️ Choreographing cinematic motion...',
      prompt: getPrompt('animator'),
      input: { 
        plannerOutput, 
        visualizerOutput: visualizerOutput || { visual_steps: [] }, 
        narratorOutput: narratorOutput || { narrations: [] },
        learnerProfile 
      },
      model: fastModel, onProgress, userConfig, signal,
      onStream: (token) => onProgress('animating', token),
      requiredKeys: ['animation_steps'],
      pipelineState,
      requestId
    });

    if (!animatorOutput.animation_steps && animatorOutput.actions) {
       animatorOutput = { animation_steps: [{ step: animatorOutput.step || 1, actions: animatorOutput.actions }] };
    }

    // Stage 5: Critique
    if (!narratorOutput?.narrations?.length || !visualizerOutput?.visual_steps?.length) {
      if (socket) socket.emit('teaching:warning', { code: 'VISUAL_DEGRADED', message: 'Visual generation used simplified mode.' });
      return await createFallbackTimeline(normalizedTopic, userConfig, 'Upstream timeout');
    }

    const criticOutput = await runStage({
      stageName: '⚖️ Reviewing for consistency & clarity...',
      prompt: getPrompt('critic'),
      input: { narrations: narratorOutput.narrations, visual_steps: visualizerOutput.visual_steps, animation_steps: animatorOutput.animation_steps, topic: normalizedTopic, domain, learnerProfile },
      model: fastModel, onProgress, userConfig, signal,
      requiredKeys: ['approved', 'scores'],
      pipelineState,
      requestId
    });

    if (criticOutput.approved === false && (criticOutput.scores?.overall || 0) < 8) {
       throw new Error(`Critic rejection (score ${criticOutput.scores?.overall})`);
    }

    // Apply Patches
    if (criticOutput.patch_suggestions) {
      const patches = criticOutput.patch_suggestions;
      if (patches.narrations) narratorOutput.narrations = patches.narrations;
      if (patches.visual_steps) visualizerOutput.visual_steps = patches.visual_steps;
      if (patches.animation_steps) animatorOutput.animation_steps = patches.animation_steps;
    }

    // Stage 6: Validation
    const validatorRaw = await runStage({
      stageName: '✨ Finalizing high-fidelity plan...',
      prompt: getPrompt('validator'),
      input: { critic: criticOutput, narrations: narratorOutput.narrations, visual_steps: visualizerOutput.visual_steps, animation_steps: animatorOutput.animation_steps, topic: normalizedTopic, learnerProfile },
      model: fastModel, onProgress, userConfig, signal,
      // Use a custom validation check instead of strict requiredKeys to handle aliases
      requiredKeys: [], 
      pipelineState,
      requestId
    });

    // Resilience: Handle 'output' alias if 'final_output' is missing
    if (!validatorRaw.final_output && validatorRaw.output) {
      validatorRaw.final_output = validatorRaw.output;
    }

    if (!validatorRaw.final_output && !validatorRaw.elements && !validatorRaw.timeline) {
      throw new Error('Validator output missing required lesson data.');
    }

    const unwrapped = unwrapValidatorOutput(validatorRaw);
    if (!unwrapped) return await createFallbackTimeline(normalizedTopic, userConfig, 'Unwrap failed');

    const validated = validateSceneGraph(unwrapped);
    if (!validated.valid && validated.fatal) return await createFallbackTimeline(normalizedTopic, userConfig, validated.errors[0] || 'Fatal validation error');

    const output = validated.data || unwrapped;
    if (sources && sources.length > 0) output.sources = sources;

    console.log(`[AgentLoop] ✅ Pipeline SUCCESS — Total Cost: ${pipelineState.total_cost_cents.toFixed(2)}¢`);

    // ASYNC: Persist this lesson to long-term memory for future RAG
    if (output.meta?.topic || topic) {
      VectorStoreService.addMemory({
        ownerId: userId || 'anonymous',
        namespace: 'project',
        referenceId: requestId || 'manual',
        content: `LESSON SUMMARY for "${output.meta?.topic || topic}": ${output.timeline?.[0]?.explanation || 'No summary available.'}`,
        metadata: { type: 'lesson', domain, complexity: output.meta?.level }
      }).catch(e => console.warn('[AgentLoop] Lesson memory storage failed:', e.message));
    }

    return output;

  } catch (err: any) {
    console.error(`[AgentLoop] ❌ Pipeline failure: ${err.message}`);
    if (socket) socket.emit('teaching:warning', { code: 'VISUAL_DEGRADED', message: 'Visual generation used simplified mode.' });
    return await createFallbackTimeline(topic, userConfig, err.message);
  }
}
