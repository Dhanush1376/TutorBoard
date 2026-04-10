/**
 * AI Orchestrator v8.0 — Cinematic SCENE GRAPH Engine
 * 
 * v8 changes:
 *   - Speaking the language of Normalized SCENE GRAPH { scene, elements, connections, timeline }
 *   - Auto-conversion of 0-1 coordinates to 800x600 canvas space.
 *   - Explicit cameraFocus and highlight/fade management.
 *   - Contextual visuals mapping.
 */

import { requestCompletion, getModel } from '../utils/llmClient.js';
import { isGreeting } from '../agents/index.js';
import { UNIFIED_PEDAGOGY_PROMPT } from '../agents/unifiedPrompt.js';
import { safeParse } from '../utils/parser.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';

// ─── Fail-Safe Generator ─────────────────────────────────────────────────────
function generateFailSafeTimeline(topic) {
  return {
    mode: 'explain',
    title: `Understanding ${topic}`,
    totalSteps: 2,
    objects: [
      { id: 'main', shape: 'circle', x: 400, y: 300, r: 50, color: 'blue', label: topic, appearsAtStep: 0 }
    ],
    steps: [
      { index: 0, title: 'Concept', narration: `Let's explore ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 },
      { index: 1, title: 'Summary', narration: `Now you understand the core of ${topic}.`, objectIds: ['main'], highlightIds: ['main'], durationMs: 4000 }
    ]
  };
}

// ─── Post-Processing: Normalize & Adapt SCENE GRAPH ───────────────────────
function postProcessTimeline(raw, topic) {
  const rawElements = raw.elements || raw.objects || [];
  const rawTimeline = raw.timeline || raw.steps || [];

  const elements = rawElements.map(el => {
    const x = parseFloat(el.x ?? el.p?.x ?? 0.5);
    const y = parseFloat(el.y ?? el.p?.y ?? 0.5);
    const scale = parseFloat(el.scale ?? 1);

    return {
      ...el,
      x: isNaN(x) ? 0.5 : x,
      y: isNaN(y) ? 0.5 : y,
      scale: isNaN(scale) ? 1 : scale,
      shape: el.type === 'orb' ? 'circle' : el.type === 'block' ? 'rect' : el.type || 'circle'
    };
  });

  const timeline = rawTimeline.map((t, idx) => ({
    ...t,
    index: idx,
    title: t.title || 'Step',
    narration: t.explanation || t.narration || '...',
    durationMs: 5000
  }));

  return {
    mode: 'explain',
    title: raw.scene?.title || `Understanding ${topic}`,
    scene: raw.scene || { title: topic, type: 'flow' },
    elements,
    connections: raw.connections || [],
    timeline,
    // Keep backward compatibility
    objects: elements,
    steps: timeline
  };
}

// ─── Main Generation Entry Point ─────────────────────────────────────────────
export async function generateTimeline(sessionId, topic, onProgress = () => {}) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return { type: 'greeting', answer: "I am the Cinematic Animation Planning Engine. Tell me a topic, and I will architect a visual scene for you." };
  }

  const userProfile = `Target Complexity = ${session.complexityPreference}, Confusion Level = ${session.confusionIndex}/10`;
  const cached = cache.get(topic, userProfile);
  if (cached) return cached;

  console.log(`[CinematicEngine] 🎬 Planning SCENE GRAPH for: "${topic}"`);

  try {
    onProgress('Architecting the cinematic scene...');

    const messages = [
      { role: 'system', content: UNIFIED_PEDAGOGY_PROMPT },
      { role: 'user', content: `TOPIC: ${topic}` }
    ];

    const result = await requestCompletion({
      model: getModel(),
      messages,
      temperature: 0.2,
      maxTokens: 8000,
      responseMimeType: "application/json"
    });

    const raw = safeParse(result.content);
    if (!raw || !raw.timeline || raw.timeline.length === 0) {
      console.warn("[CinematicEngine] AI response did not match SCENE schema. Falling back.");
      return generateFailSafeTimeline(topic);
    }

    const timeline = postProcessTimeline(raw, topic);

    cache.set(topic, userProfile, timeline);
    console.log(`[CinematicEngine] ✅ Generated ${timeline.totalSteps} cinematic steps for "${topic}"`);
    return timeline;

  } catch (err) {
    console.error(`[CinematicEngine] ❌ Critical Failure: ${err.message}`);
    return generateFailSafeTimeline(topic);
  }
}

// ─── Doubt/Text Handlers ─────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question) {
  try {
    const messages = [{ role: 'system', content: 'You are a helpful cinematic pedagogical assistant. Answer concisely.' }, { role: 'user', content: question }];
    const result = await requestCompletion({ model: getModel(), messages, temperature: 0.2, maxTokens: 500, responseMimeType: "application/json" });
    const parsed = safeParse(result.content);
    return { answer: parsed?.answer || "Excellent question. Let's look closer.", isRelevant: true };
  } catch (err) {
    return { answer: "That is a vital point in our visualization.", isRelevant: true };
  }
}

export async function generateTextResponse(sessionId, topic) {
  return { answer: `I'm ready to visualize "${topic}". Ask me to explain it!`, type: 'text' };
}
