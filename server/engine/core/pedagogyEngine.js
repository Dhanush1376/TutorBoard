/**
 * AI Orchestrator v8.0 — Cinematic SCENE GRAPH Engine
 * 
 * v8 changes:
 *   - Speaking the language of Normalized SCENE GRAPH { scene, elements, connections, timeline }
 *   - Auto-conversion of 0-1 coordinates to 800x600 canvas space.
 *   - Explicit cameraFocus and highlight/fade management.
 *   - Contextual visuals mapping.
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

// ─── Fail-Safe Generator ─────────────────────────────────────────────────────
function generateFailSafeTimeline(topic) {
  return {
    mode: 'explain',
    title: `Understanding ${topic}`,
    domain: 'general',
    renderer: 'cinematic',
    totalSteps: 2,
    elements: [
      { id: 'main', type: 'orb', x: 0.5, y: 0.5, size: 80, color: 'blue', label: topic, appearsAtStep: 0 }
    ],
    timeline: [
      { index: 0, title: 'Concept', narration: `Let's explore ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 },
      { index: 1, title: 'Summary', narration: `Now you understand the core of ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 }
    ],
    // Backward compat
    objects: [{ id: 'main', type: 'orb', x: 0.5, y: 0.5, size: 80, color: 'blue', label: topic, appearsAtStep: 0 }],
    steps: [
      { index: 0, title: 'Concept', narration: `Let's explore ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 },
      { index: 1, title: 'Summary', narration: `Now you understand the core of ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 }
    ]
  };
}

// ─── Post-Processing: Normalize & Adapt SCENE GRAPH ───────────────────────
function postProcessTimeline(raw, topic, planningResult) {
  if (!raw) {
    console.warn("[PostProcess] ⚠️ Received null raw graph. Using fallback.");
    return generateFailSafeTimeline(topic);
  }

  const rawElements = (raw.elements || raw.objects || raw.nodes || raw.shapes || raw.items || []).filter(Boolean);
  const rawTimeline = (raw.timeline || raw.steps || raw.narrative || raw.events || raw.flow || raw.sequence || []).filter(Boolean);

  const isPixel = rawElements.some(el => {
    if (!el) return false;
    let checkX = parseFloat(el.x ?? el.p?.x ?? 0);
    let checkY = parseFloat(el.y ?? el.p?.y ?? 0);
    return checkX > 1.0 || checkY > 1.0;
  });

  const elements = rawElements.map(el => {
    if (!el) return { id: 'err', type: 'orb', x: 0.5, y: 0.5, label: '?' };
    
    let x = parseFloat(el.x ?? el.p?.x ?? 0.5);
    let y = parseFloat(el.y ?? el.p?.y ?? 0.5);
    const scale = parseFloat(el.scale ?? 1);

    if (isNaN(x)) x = 0.5;
    if (isNaN(y)) y = 0.5;

    if (isPixel) {
      if (x > 1) x = x / 800;
      if (y > 1) y = y / 600;
    }

    return {
      ...el,
      x: Math.max(0.01, Math.min(0.99, x)),
      y: Math.max(0.01, Math.min(0.99, y)),
      scale: isNaN(scale) ? 1 : scale,
      shape: el.shape || (el.type === 'orb' ? 'circle' : el.type === 'block' ? 'rect' : el.type || 'circle')
    };
  });

  const timeline = rawTimeline.map((t, idx) => {
    if (!t) return { index: idx, title: 'Step', narration: '...' };
    return {
      ...t,
      index: idx,
      title: t.title || t.label || `Step ${idx + 1}`,
      narration: t.explanation || t.narration || t.audio || '...',
      durationMs: parseFloat(t.duration || t.durationMs || 5000),
      highlightIds: t.highlightIds || t.highlight || [],
      objectIds: t.objectIds || t.elements || []
    };
  });

  return {
    mode: 'explain',
    title: raw.scene?.title || raw.title || `Understanding ${topic}`,
    scene: raw.scene || { title: topic, type: planningResult?.animationStyle || 'linear' },
    elements,
    connections: (raw.connections || []).filter(Boolean),
    timeline,
    renderer: planningResult?.renderer || raw.renderer || 'cinematic',
    objects: elements,
    steps: timeline,
    domain: planningResult?.domain || 'general'
  };
}

// ─── Main Generation Entry Point ─────────────────────────────────────────────
export async function generateTimeline(sessionId, topic, onProgress = () => {}, modelId = null) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const level = session.learnerProfile?.level || 'beginner';
  const confusion = session.learnerProfile?.confusionIndex || 0;
  const userProfile = `Target Level = ${level}, Confusion Level = ${confusion}/10`;
  
  console.log(`[CinematicEngine] 🎬 Orchestrating Agentic Pipeline for: "${topic}" (Quality: ${userProfile})`);

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
      maxSteps: 6, // Increased to allow Research -> Design -> Critique -> Revise -> Finish
      planningResult,
      onProgress
    });

    if (!rawSceneGraph || (!rawSceneGraph.timeline && !rawSceneGraph.steps)) {
      console.warn("[CinematicEngine] ❗ Agent loop failed to produce a valid scene graph. Using fallback.");
      return generateFailSafeTimeline(topic);
    }

    // Stage 3: Normalize and Sanitize
    onProgress('Finalizing scene graph pipeline...');
    const timeline = postProcessTimeline(rawSceneGraph, topic, planningResult);
    
    console.log(`[CinematicEngine] 📊 Data density: ${timeline.elements.length} elements, ${timeline.timeline.length} steps`);

    // Explicitly hard-seal metadata
    timeline.domain = domain || planningResult.domain || timeline.domain || 'general';
    timeline.renderer = planningResult.renderer || timeline.renderer || 'cinematic';

    // Pipe Consistency Check
    if (timeline.renderer !== planningResult.renderer) {
      console.log(`[CinematicEngine] 🔄 Renderer requested: ${planningResult.renderer} | Actually assigned: ${timeline.renderer}`);
    }

    await cache.set(topic, userProfile, timeline);
    console.log(`[CinematicEngine] ✅ SUCCESS: "${topic}" via [${timeline.renderer.toUpperCase()}] renderer`);
    return timeline;

  } catch (err) {
    console.error(`[CinematicEngine] ❌ Critical Failure: ${err.message}`);
    return generateFailSafeTimeline(topic);
  }
}

// ─── Doubt/Text Handlers ─────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question, modelId = null) {
  const session = sessionStore.get(sessionId);
  const topic = session?.topic || "General Education";
  const domain = session?.domain || "general";
  
  try {
    // 1. Classify the intent of the doubt
    const classification = await classifyDoubt(topic, question);
    
    // 2. Build the context-rich prompt
    const currentStepIndex = session?.currentStepIndex || 0;
    const currentStep = session?.steps?.[currentStepIndex] || {};
    const currentFrames = currentStep.elements || session?.timeline?.elements || [];
    
    const prompt = buildDoubtPrompt({
      topic,
      domain,
      currentFrames,
      priorDoubts: session?.doubtHistory || [],
      classification
    });

    const result = await requestCompletion({ 
      model: modelId || getModel(), 
      messages: [{ role: 'system', content: prompt }], 
      temperature: 0.3, 
      maxTokens: 1000,
      responseMimeType: 'application/json'
    });

    const parsed = safeParse(result.content);
    
    // Return the full structured response including visual patches
    return { 
      answer: parsed?.answer || result.content || "That's a great question.",
      isRelevant: parsed?.isRelevant ?? true,
      hasVisuals: parsed?.hasVisuals || (parsed?.framePatches && parsed.framePatches.length > 0),
      visualUpdate: {
        mutations: parsed?.framePatches || []
      },
      followUp: parsed?.followUp || null
    };
  } catch (err) {
    console.error("[PedagogyEngine] Doubt handling failed:", err.message);
    return { 
      answer: "I encountered a minor glitch while analyzing that. Could you rephrase your question?", 
      isRelevant: true,
      hasVisuals: false,
      visualUpdate: { mutations: [] }
    };
  }
}

export async function generateTextResponse(sessionId, prompt, modelId = null) {
  try {
    const session = sessionStore.get(sessionId);
    const topic = session?.topic || "General Discussion";
    
    console.log(`[PedagogyEngine] 💬 Generating text response for: "${prompt.substring(0, 30)}..."`);
    
    const response = await requestCompletion({
      model: modelId || getTextModel(),
      messages: [
        { 
          role: 'system', 
          content: `You are Tutu, a friendly and helpful AI pedagogical assistant. 
          The current context is: ${topic}. 
          Answer conversationally, be encouraging, and keep it under 3 sentences.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 500
    });

    return { 
      answer: response.content || "I'm here to help!", 
      type: 'text' 
    };
  } catch (err) {
    console.error(`[PedagogyEngine] Text response failed:`, err.message);
    return { answer: "I'm having a bit of trouble connecting to my brain. Could you try asking that again?", type: 'text' };
  }
}
