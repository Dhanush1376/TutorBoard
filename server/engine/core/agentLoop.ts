/**
 * AgentLoop v8.0 — 6-Stage Autonomous Orchestration Pipeline (TypeScript)
 */

import { requestCompletion, getModel, getFastModel, resolveModelId } from '../../utils/ai/llmClient.js';
import { getPrompt } from '../config/promptRegistry.js';
import { SceneGraphSchema, LessonSchema } from '../validators/timelineSchema.js';
import VectorStoreService from './vectorStore.js';
import { searchWeb } from '../../utils/ai/webSearchService.js';
import { shouldSearch, detectTools } from '../../utils/ai/searchGate.js';
import { formatForPrompt, extractSources } from '../../utils/ai/searchContextFormatter.js';
import { calculateCost } from '../../utils/ai/providerFactory.js';
import * as Sentry from '@sentry/node';

// Domain Generators
import { generateMathFallback } from '../generators/math.js';
import { generateScienceFallback } from '../generators/science.js';
import { generateProgrammingFallback } from '../generators/programming.js';

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
          responseSchema: params.responseSchema,
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

  // Ensure elements is always an array
  if (!Array.isArray(obj.elements)) obj.elements = [];

  // fixObjectIds logic
  const elements = obj.elements || [];
  const validIds = new Set(elements.map((e: any) => e?.id).filter(Boolean));
  const allIds = [...validIds];
  
  (obj.timeline || []).forEach((step: any) => {
    if (!step) return;
    const raw = step.objectIds || step.elements || [];
    // Only filter if raw contains strings (IDs), skip if it contains objects
    const rawIds = raw.filter((id: any) => typeof id === 'string');
    const filtered = rawIds.filter((id: any) => validIds.has(id));
    // FIX: Fall back to ALL element IDs instead of empty array
    // Empty objectIds causes the renderer to show a blank canvas
    step.objectIds = filtered.length > 0 ? filtered : (allIds.length > 0 ? allIds : []);
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

  // Raised threshold — VisualScript format can produce many passthrough fields
  // that cause Zod warnings but are not actual errors
  if (errors.length > 20) { 
    return { valid: false, errors, fatal: true };
  }

  // Always return the original object rather than the Zod-parsed result
  return { valid: errors.length === 0, errors, data: obj };
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

function parseLessonToSceneGraph(rawLesson: any) {
  // Extract the root lesson object if wrapped, otherwise assume it's flat
  const lesson = rawLesson.lesson || rawLesson;

  const elements: any[] = [];
  const connections: any[] = [];
  const timeline: any[] = [];
  const addedElementIds = new Set();
  const addedConnectionIds = new Set();

  // Standard Canvas Dimensions for normalization
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  if (lesson.steps && Array.isArray(lesson.steps)) {
    lesson.steps.forEach((step: any, index: number) => {
      const stepObjectIds: string[] = [];
      const scene = step.scene || step.canvas || {};
      
      // Nodes
      if (scene.nodes && Array.isArray(scene.nodes)) {
        scene.nodes.forEach((node: any) => {
          if (!addedElementIds.has(node.id)) {
            // Normalize coordinates if they are absolute pixels
            let normX = node.position?.x ?? node.x ?? 0.5;
            let normY = node.position?.y ?? node.y ?? 0.5;
            if (normX > 1) normX = normX / CANVAS_WIDTH;
            if (normY > 1) normY = normY / CANVAS_HEIGHT;

            elements.push({ 
              ...node, 
              shape: node.type || 'orb',
              x: normX,
              y: normY
            });
            addedElementIds.add(node.id);
          }
          stepObjectIds.push(node.id);
        });
      }

      // Edges
      if (scene.edges && Array.isArray(scene.edges)) {
        scene.edges.forEach((edge: any) => {
          const edgeId = edge.id || `${edge.from}-${edge.to}`;
          if (!addedConnectionIds.has(edgeId)) {
            connections.push({ ...edge, id: edgeId });
            addedConnectionIds.add(edgeId);
          }
        });
      }

      timeline.push({
        title: step.title || `Step ${index + 1}`,
        explanation: step.explanation || step.narration || '',
        narration: step.narration || step.explanation || '',
        objectIds: stepObjectIds,
        mutations: [],
        animation: { type: 'fade', duration: 0.5, actions: scene.animations || [] }
      });
    });
  }

  // Fallback defaults if AI failed to return valid nodes
  if (elements.length === 0) {
    console.log(`[NodeGenerator] No nodes returned from AI, injecting fallback visual generators for topic: ${lesson.title}`);
    
    const topicStr = (lesson.title || '').toLowerCase();
    
      // Mathematics
      if (topicStr.includes('math') || topicStr.includes('pythagoras') || topicStr.includes('triangle') || topicStr.includes('circle') || topicStr.includes('area')) {
        const mathFallback = generateMathFallback(topicStr);
        elements.push(...mathFallback.elements);
        connections.push(...mathFallback.connections);
      } 
      // Science
      else if (topicStr.includes('science') || topicStr.includes('atom') || topicStr.includes('force') || topicStr.includes('motion')) {
        const scienceFallback = generateScienceFallback(topicStr);
        elements.push(...scienceFallback.elements);
        connections.push(...scienceFallback.connections);
      }
      // Programming
      else if (topicStr.includes('code') || topicStr.includes('array') || topicStr.includes('tree') || topicStr.includes('graph')) {
        const progFallback = generateProgrammingFallback(topicStr);
        elements.push(...progFallback.elements);
        connections.push(...progFallback.connections);
      }
      // Generic fallback
      else {
        const id = "fallback_1";
        elements.push({ id, type: 'orb', label: lesson.title || 'Topic', x: 0.5, y: 0.5, color: 'indigo' });
      }

    if (timeline.length > 0) {
      elements.forEach(el => timeline[0].objectIds.push(el.id));
    } else {
      timeline.push({
        title: 'Introduction',
        explanation: `Let's learn about ${lesson.title}.`,
        objectIds: elements.map(e => e.id),
        mutations: [],
        animation: { type: 'fade', duration: 0.5, actions: [] }
      });
    }
  }

  console.log(`[CanvasNodeGenerator] Mapped lesson to ${elements.length} nodes, ${connections.length} edges, ${timeline.length} steps.`);


  return {
    title: lesson.title || 'Lesson',
    scene: { title: lesson.title || 'Lesson', type: 'linear' },
    elements,
    connections,
    timeline,
    meta: lesson.meta || {}
  };
}

export async function runAgentLoop(params: AgentLoopParams) {
  const { 
    topic, domain, model, onProgress = (s: string, d?: any) => {}, 
    userConfig, learnerProfile, signal, socket, requestId 
  } = params;

  console.log(`[AgentLoop] 🚀 Starting Single-Pass Structured Orchestration for: "${topic}"`);

  const pipelineState: PipelineState = {
    tokens_in: 0,
    tokens_out: 0,
    total_cost_cents: 0,
    topic: topic
  };

  const fullModel = model || getModel();

  try {
    const userId = userConfig?.userId || null;
    const toolDecision = detectTools(topic);
    const doSearch = toolDecision.useWebSearch || shouldSearch(topic, domain);

    onProgress('🔍 Researching background context & web data...', { stage: 1, totalStages: 2 });
    
    const researchTask = Promise.all([
      VectorStoreService.getContextForTopic(topic, 3, userId).catch(() => "Local context unavailable."),
      doSearch ? searchWeb(topic, { count: 5 }).catch(() => []) : Promise.resolve([])
    ]);

    const [pastContext, webResults] = await Promise.race([
      researchTask,
      new Promise<[string, any[]]>((resolve) => setTimeout(() => resolve(["Timeout", []]), 15000))
    ]);

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    onProgress('✨ Generating structured interactive lesson...', { stage: 2, totalStages: 2 });
    
    // Single-pass generation
    const systemPrompt = `You are the core Visual Lesson Engine for TutorBoard.
    You must convert the educational topic "${topic}" into a highly interactive, visual scene graph.
    Your response MUST match the JSON schema provided exactly. NEVER output plain text.
    
    1. For each step, create a 'scene' containing 'nodes', 'edges', and 'animations'.
    2. Available node types: 'orb', 'rect', 'circle', 'triangle', 'text', 'equation', 'atom', 'tree', 'array'.
    3. Use 'position: {x, y}' where x and y are between 0.0 and 1.0 (e.g. {x: 0.5, y: 0.5} is center).
    4. Provide specific properties in 'props' depending on the node type (e.g., 'base', 'height', 'labels').
    5. Animate the appearance of elements using the 'animations' array (e.g., 'draw', 'fade', 'move').
    
    Context:
    ${webContextStr || ''}`;

    const lessonOutput = await runStage({
      stageName: '💡 Generating lesson...',
      prompt: systemPrompt,
      input: { topic },
      model: fullModel, 
      onProgress, 
      userConfig, 
      signal,
      responseSchema: LessonSchema,
      requiredKeys: ['title', 'steps'],
      pipelineState,
      requestId
    });

    console.log(`[AgentLoop] ✅ Pipeline SUCCESS — Total Cost: ${pipelineState.total_cost_cents.toFixed(2)}¢`);

    let output = lessonOutput;
    output.meta = { topic, domain, level: learnerProfile?.level || 'intermediate' };
    
    // Transform LessonSchema to SceneGraphSchema
    output = parseLessonToSceneGraph(output);
    if (sources && sources.length > 0) output.sources = sources;

    // ASYNC: Persist this lesson to long-term memory for future RAG
    if (topic) {
      VectorStoreService.addMemory({
        ownerId: userId || 'anonymous',
        namespace: 'project',
        referenceId: requestId || 'manual',
        content: `LESSON SUMMARY for "${topic}": Generated structured lesson.`,
        metadata: { type: 'lesson', domain, complexity: output.meta?.level }
      }).catch(e => console.warn('[AgentLoop] Lesson memory storage failed:', e.message));
    }

    return output;

  } catch (err: any) {
    console.error(`[AgentLoop] ❌ Pipeline failure: ${err.message}`);
    if (socket) socket.emit('teaching:warning', { code: 'VISUAL_DEGRADED', message: 'Visual generation failed.' });
    return await createFallbackTimeline(topic, userConfig, err.message);
  }
}
