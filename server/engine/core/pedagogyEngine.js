/**
 * AI Orchestrator v9.0 — Cinematic SCENE GRAPH Engine
 *
 * WHAT CHANGED FROM v8:
 *   1. shape/type precedence fixed — postProcessTimeline now preserves the LLM's `type`
 *      field as the canonical shape key. Previously `el.shape || el.type || 'circle'`
 *      would collapse ANY element with no `shape` field (which is ALL of them, since the
 *      LLM outputs `type`) to 'circle'. Fixed to `el.type || el.shape || 'orb'`.
 *   2. generateFailSafeTimeline now goes through postProcessTimeline before being
 *      returned, so it always carries all required fields (renderer, scene, domain, etc.)
 *      that AgentCanvasRenderer needs. Previously the raw failsafe object was missing
 *      these fields and caused silent canvas failures.
 *   3. totalSteps is now computed from the processed timeline array, not the raw input,
 *      so it's always accurate.
 *   4. A 'chatMessage' is attached to failsafe timelines so the chat UI always shows
 *      a friendly explanation even when visuals are minimal.
 */

import { requestCompletion, getModel, getTextModel } from '../utils/llmClient.js';
import { isGreeting, buildDoubtPrompt, classifyDoubt } from '../agents/index.js';
import { buildUnifiedPrompt } from '../agents/unifiedPrompt.js';
import { safeParse } from '../utils/parser.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';
import { planAnimation } from './animationPlanner.js';
import { runAgentLoop } from './agentLoop.js';
import { getPrimaryDomain } from '../agents/domainConfig.js';

// ─── Raw Fail-Safe Data ───────────────────────────────────────────────────────
// NOTE: This is raw data BEFORE postProcessTimeline. It is NEVER returned directly.
// It always flows through postProcessTimeline first.
function buildRawFailSafe(topic) {
  return {
    scene: { title: `Understanding ${topic}`, type: 'linear' },
    elements: [
      { id: 'core', type: 'orb', x: 0.5, y: 0.35, color: 'blue', label: topic },
      { id: 'note', type: 'block', x: 0.5, y: 0.65, color: 'gray', label: 'Let\'s break this down step by step.' },
    ],
    connections: [],
    timeline: [
      {
        title: `Introduction to ${topic}`,
        explanation: `Let's start exploring ${topic} from the ground up.`,
        objectIds: ['core'],
        highlightIds: ['core'],
        animation: { type: 'fade', duration: 0.6 },
      },
      {
        title: 'Core Concept',
        explanation: `${topic} is a fundamental concept worth understanding deeply. Ask a question to dive deeper.`,
        objectIds: ['core', 'note'],
        highlightIds: ['core'],
        animation: { type: 'draw', duration: 0.8 },
      },
    ],
  };
}

// ─── Post-Processing: Normalize & Adapt SCENE GRAPH ───────────────────────────
function postProcessTimeline(raw, topic, planningResult) {
  if (!raw) {
    console.warn('[PostProcess] ⚠️ Received null raw graph. Using failsafe.');
    raw = buildRawFailSafe(topic);
  }

  const rawElements = (raw.elements || raw.objects || raw.nodes || raw.shapes || raw.items || []).filter(Boolean);
  const rawTimeline = (raw.timeline || raw.steps || raw.narrative || raw.events || raw.flow || raw.sequence || []).filter(Boolean);

  // Detect if LLM used pixel coordinates instead of 0-1 normalized
  const isPixel = rawElements.some(el => {
    if (!el) return false;
    const checkX = parseFloat(el.x ?? el.p?.x ?? 0);
    const checkY = parseFloat(el.y ?? el.p?.y ?? 0);
    return checkX > 1.0 || checkY > 1.0;
  });

  const elements = rawElements.map(el => {
    if (!el) return { id: `el_${Math.random().toString(36).slice(2)}`, type: 'orb', x: 0.5, y: 0.5, label: '?' };

    let x = parseFloat(el.x ?? el.p?.x ?? 0.5);
    let y = parseFloat(el.y ?? el.p?.y ?? 0.5);
    const scale = parseFloat(el.scale ?? 1);

    if (isNaN(x)) x = 0.5;
    if (isNaN(y)) y = 0.5;

    if (isPixel) {
      if (x > 1) x = x / 800;
      if (y > 1) y = y / 600;
    }

    // FIX: type takes precedence over shape. The LLM outputs `type`, never `shape`.
    // Old code: `shape: el.shape || el.type || 'circle'` collapsed everything to 'circle'
    //           when el.shape was undefined (always), since it evaluated before el.type.
    // New code: `type` is the canonical key, `shape` is the alias, fallback is 'orb'.
    const resolvedType = (el.type || el.shape || 'orb').toLowerCase();

    return {
      ...el,
      id: el.id || `el_${Math.random().toString(36).slice(2)}`,
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
      scale: isNaN(scale) ? 1 : scale,
      // Both fields set for maximum renderer compatibility
      type: resolvedType,
      shape: resolvedType,
    };
  });

  const elementIds = new Set(elements.map(e => e.id));

  const timeline = rawTimeline.map((t, idx) => {
    if (!t) return { index: idx, title: `Step ${idx + 1}`, narration: '...', objectIds: [...elementIds] };

    // Cross-reference objectIds against real element ids
    const rawIds = t.objectIds || t.elements || [];
    const validIds = rawIds.filter(id => elementIds.has(id));
    const finalIds = validIds.length > 0 ? validIds : [...elementIds];

    // Clean highlightIds too
    const rawHighlight = t.highlightIds || t.highlight || [];
    const validHighlight = rawHighlight.filter(id => elementIds.has(id));

    // Clean mutation ids
    const rawMutations = t.mutations || [];
    const validMutations = rawMutations.filter(m => m?.id && elementIds.has(m.id));

      const rawDurationArr = t.duration || t.durationMs || 5000;
      const parsedDuration = parseFloat(rawDurationArr);
      const durationMs = (parsedDuration > 0 && parsedDuration < 20) ? parsedDuration * 1000 : parsedDuration;
      
      return {
        ...t,
        index: idx,
        title: t.title || t.label || `Step ${idx + 1}`,
        narration: t.explanation || t.narration || t.audio || '...',
        explanation: t.explanation || t.narration || '...',
        durationMs: isNaN(durationMs) ? 5000 : durationMs,
      highlightIds: validHighlight,
      objectIds: finalIds,
      mutations: validMutations,
    };
  });

  const processed = {
    mode: 'explain',
    title: raw.scene?.title || raw.title || `Understanding ${topic}`,
    scene: raw.scene || { title: topic, type: planningResult?.animationStyle || 'linear' },
    elements,
    connections: (raw.connections || []).filter(Boolean),
    timeline,
    // Always use planning result renderer — it's chosen by the classification pipeline
    renderer: planningResult?.renderer || raw.renderer || 'cinematic',
    domain: planningResult?.domain || 'general',
    // Backward compat aliases for any consumer still using old keys
    objects: elements,
    steps: timeline,
    totalSteps: timeline.length,
  };

  return processed;
}

// ─── Main Generation Entry Point ──────────────────────────────────────────────
export async function generateTimeline(sessionId, topic, onProgress = () => {}, modelId = null, userConfig = null) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const level = session.learnerProfile?.level || 'beginner';
  const confusion = session.learnerProfile?.confusionIndex || 0;
  const userProfile = `Target Level = ${level}, Confusion Level = ${confusion}/10`;

  console.log(`[CinematicEngine] 🎬 Orchestrating for: "${topic}" (${userProfile})`);

  const cached = await cache.get(topic, userProfile);
  if (cached) {
    console.log(`[CinematicEngine] ⚡ Cache HIT for: "${topic}"`);
    return cached;
  }

  try {
    // Stage 1: Animation Planner
    onProgress('Classifying concept & selecting renderer...');
    const domain = getPrimaryDomain(topic);
    const planningResult = await planAnimation(topic, domain);

    // Stage 2: Execute Agent Loop
    onProgress('Running autonomous visual planning loop...');
    const systemPrompt = buildUnifiedPrompt(planningResult);

    const rawSceneGraph = await runAgentLoop({
      topic,
      domain,
      systemPrompt,
      model: modelId,
      maxSteps: 6,
      planningResult,
      onProgress,
      userConfig,
    });

    if (!rawSceneGraph || (!rawSceneGraph.timeline && !rawSceneGraph.steps)) {
      console.warn('[CinematicEngine] ❗ Agent loop failed to produce a valid scene graph. Using failsafe.');
      // CRITICAL FIX: failsafe MUST go through postProcessTimeline so it has all required fields
      const failsafe = postProcessTimeline(buildRawFailSafe(topic), topic, planningResult);
      failsafe.chatMessage = `I couldn't generate a full visual lesson for "${topic}" right now. Here's a starting point — ask me a specific question to go deeper!`;
      return failsafe;
    }

    // Stage 3: Normalize and Sanitize
    onProgress('Finalizing scene graph pipeline...');
    const timeline = postProcessTimeline(rawSceneGraph, topic, planningResult);

    console.log(`[CinematicEngine] 📊 Data density: ${timeline.elements.length} elements, ${timeline.timeline.length} steps`);

    // Hard-seal metadata from the planner (never let LLM override renderer choice)
    timeline.domain = domain || planningResult.domain || 'general';
    timeline.renderer = planningResult.renderer || 'cinematic';

    await cache.set(topic, userProfile, timeline);
    console.log(`[CinematicEngine] ✅ SUCCESS: "${topic}" via [${timeline.renderer.toUpperCase()}] renderer (${timeline.timeline.length} steps)`);
    return timeline;

  } catch (err) {
    console.error(`[CinematicEngine] ❌ Critical Failure: ${err.message}`);
    // CRITICAL FIX: Even on exception, go through postProcessTimeline
    const domain = getPrimaryDomain(topic);
    const failsafe = postProcessTimeline(buildRawFailSafe(topic), topic, { renderer: 'cinematic', domain, animationStyle: 'linear' });
    failsafe.chatMessage = `I hit a snag generating your lesson on "${topic}". Try rephrasing or asking a more specific question!`;
    return failsafe;
  }
}

// ─── Doubt/Text Handlers ──────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question, modelId = null, userConfig = null) {
  const session = sessionStore.get(sessionId);
  const topic = session?.topic || 'General Education';
  const domain = session?.domain || 'general';

  try {
    const classification = await classifyDoubt(topic, question);

    const currentStepIndex = session?.currentStepIndex || 0;
    const currentStep = session?.steps?.[currentStepIndex] || {};
    const currentFrames = currentStep.elements || session?.timeline?.elements || [];

    const prompt = buildDoubtPrompt({
      topic,
      domain,
      currentFrames,
      priorDoubts: session?.doubtHistory || [],
      classification,
    });

    const result = await requestCompletion({
      model: modelId || getModel(),
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'doubt',
    });

    const parsed = safeParse(result.content);

    return {
      answer: parsed?.answer || result.content || "That's a great question.",
      isRelevant: parsed?.isRelevant ?? true,
      hasVisuals: parsed?.hasVisuals || (parsed?.framePatches && parsed.framePatches.length > 0),
      visualUpdate: { mutations: parsed?.framePatches || [] },
      followUp: parsed?.followUp || null,
    };
  } catch (err) {
    console.error('[PedagogyEngine] Doubt handling failed:', err.message);
    return {
      answer: 'I encountered a minor glitch while analyzing that. Could you rephrase your question?',
      isRelevant: true,
      hasVisuals: false,
      visualUpdate: { mutations: [] },
    };
  }
}

export async function generateTextResponse(sessionId, prompt, modelId = null, userConfig = null) {
  try {
    const session = sessionStore.get(sessionId);
    const topic = session?.topic || 'General Discussion';

    console.log(`[PedagogyEngine] 💬 Generating text response for: "${prompt.substring(0, 30)}..."`);

    const response = await requestCompletion({
      model: modelId || getTextModel(),
      messages: [
        {
          role: 'system',
          content: `You are Tutu, a friendly and helpful AI pedagogical assistant. 
          The current context is: ${topic}. 
          Answer conversationally, be encouraging, and keep it under 3 sentences.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
      userConfig,
      taskType: 'simple_qa',
    });

    return { answer: response.content || "I'm here to help!", type: 'text' };
  } catch (err) {
    console.error('[PedagogyEngine] Text response failed:', err.message);
    return {
      answer: "I'm having a bit of trouble connecting. Could you try asking that again?",
      type: 'text',
    };
  }
}