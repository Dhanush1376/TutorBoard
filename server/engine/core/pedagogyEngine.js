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

import { requestCompletion, getModel, getTextModel, resolveModelId } from '../../utils/ai/llmClient.js';
import { isGreeting, buildDoubtPrompt } from '../agents/index.js';
import { safeParse } from '../../utils/core/parser.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';
import { planAnimation } from './animationPlanner.js';
import { runAgentLoop } from './agentLoop.js';
import { getPrimaryDomain, DOMAIN_MIN_STEPS } from '../config/domainConfig.js';
import { calculateMastery, deriveLevel } from '../../utils/core/pedagogyHelper.js';
import { generateDelta } from '../agents/deltaAgent.js';
import LearnerProfile from '../../models/LearnerProfile.js';
import SessionMemory from '../../models/SessionMemory.js';
import SpacedRepetitionScheduler from './SpacedRepetitionScheduler.js';

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
      // Extract values from nested props (Visualizer outputs { props: { values: [...] } })
      values: el.values || el.props?.values || undefined,
      leftVal: el.leftVal || el.props?.leftVal || undefined,
      rightVal: el.rightVal || el.props?.rightVal || undefined,
      operator: el.operator || el.props?.operator || undefined,
      result: el.result ?? el.props?.result ?? undefined,
      code: el.code || el.props?.code || undefined,
      id: el.id || `el_${Math.random().toString(36).slice(2)}`,
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
      scale: isNaN(scale) ? 1 : scale,
      // Both fields set for maximum renderer compatibility
      type: resolvedType,
      shape: resolvedType,
    };
  });

  // ─── Spatial Declutter ──────────────────────────────────────────────────────
  // If elements are clustered (bounding box < 30% of canvas), redistribute them
  // using type-aware layout rules.
  const xs = elements.map(e => e.x);
  const ys = elements.map(e => e.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const isClustered = elements.length > 2 && (xSpread < 0.3 && ySpread < 0.3);

  if (isClustered) {
    console.log(`[PostProcess] ⚠️ Spatial declutter: elements clustered in ${(xSpread * 100).toFixed(0)}% × ${(ySpread * 100).toFixed(0)}% area. Redistributing.`);

    // Type-based Y-position assignments (top to bottom)
    const typeYMap = {
      'orb': 0.12,
      'badge': 0.12,
      'equation': 0.30,
      'array': 0.35,
      'data_block': 0.35,
      'datablock': 0.35,
      'list': 0.35,
      'pointer': 0.52,
      'cursor': 0.52,
      'index': 0.52,
      'comparator': 0.65,
      'compare': 0.65,
      'swapbridge': 0.55,
      'swap': 0.55,
      'block': 0.50,
      'codeline': 0.82,
      'code': 0.82,
    };

    // Group elements by their assigned Y level
    const levels = {};
    elements.forEach(el => {
      const yTarget = typeYMap[el.type] || 0.45;
      const key = yTarget.toFixed(2);
      if (!levels[key]) levels[key] = [];
      levels[key].push(el);
    });

    // Distribute each level horizontally
    Object.entries(levels).forEach(([yStr, group]) => {
      const y = parseFloat(yStr);
      const totalWidth = 0.80; // Use 80% of canvas width
      const startX = 0.10;
      const spacing = group.length > 1 ? totalWidth / (group.length - 1) : 0;

      group.forEach((el, i) => {
        el.y = y;
        el.x = group.length === 1 ? 0.50 : startX + (i * spacing);
        el.x = Math.max(0.08, Math.min(0.92, el.x));
      });
    });
  }

  const elementIds = new Set(elements.map(e => e.id));

  const timeline = rawTimeline.map((t, idx) => {
    if (!t) return { index: idx, title: `Step ${idx + 1}`, narration: '...', objectIds: [...elementIds] };

    // Cross-reference objectIds against real element ids
    const rawIds = t.objectIds || t.elements || t.objects || [];
    const validIds = rawIds.filter(id => elementIds.has(id));

    // If AI explicitly provided IDs, use them. If not, fallback to ALL only if it's the first step or explicitly requested.
    // This prevents "cluttering" the canvas when the AI intended a blank or specific view.
    const finalIds = validIds.length > 0 ? validIds : (idx === 0 ? [...elementIds] : []);

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
    title: raw.meta?.topic || raw.scene?.title || raw.title || `Understanding ${topic}`,
    scene: raw.scene || { title: raw.meta?.topic || topic, type: planningResult?.animationStyle || 'linear' },
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
export async function generateTimeline(sessionId, topic, onProgress = () => { }, modelId = null, userConfig = null, file = null) {
  const session = await sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // Dynamically derive level from user mastery history
  const mastery = calculateMastery(session.learnerProfile?.topicsMastery, topic);
  const level = deriveLevel(mastery);
  const confusion = session.learnerProfile?.confusionIndex || 0;

  // Phase 5: Retrieve Semantically Similar Past Sessions
  let pastContext = "";
  if (userConfig?.userId) {
    const VectorStoreService = (await import('./vectorStore.js')).default;
    pastContext = await VectorStoreService.getContextForTopic(topic, 3, userConfig.userId);
  }

  // Resolve learner profile for cross-session "shared memory"
  const learnerProfile = {
    level,
    confusionIndex: confusion,
    prior_mastery: session.learnerProfile?.topicsMastery instanceof Map
      ? Object.fromEntries(session.learnerProfile.topicsMastery)
      : (session.learnerProfile?.topicsMastery || {}),
     learning_style: session.learnerProfile?.learningStyle || 'visual',
     past_context: pastContext, // NEW: Injected into Planner
    weak_areas: (session.learnerProfile?.doubtHistory || [])
      .filter(d => d.confusionScore > 5)
      .map(d => d.topic)
  };

  // Phase 4: Retrieve Session History and Fingerprint
  if (userConfig?.userId) {
    const history = await SessionMemory.findOne({ userId: userConfig.userId });
    if (history && history.sessions.length > 0) {
      learnerProfile.history = history.sessions.map(s => ({
        topic: s.topic,
        summary: s.summary,
        concepts: s.keyConcepts,
        timestamp: s.timestamp
      }));
    }

    const profile = await LearnerProfile.findOne({ userId: userConfig.userId });
    if (profile) {
      // 1. Spaced Repetition Reinforcement
      const dueConcepts = await SpacedRepetitionScheduler.getDueConcepts(userConfig.userId);
      if (dueConcepts.length > 0) {
        learnerProfile.reinforcementTopics = dueConcepts;
        console.log(`[PedagogyEngine] 🧠 Found ${dueConcepts.length} concepts due for reinforcement: ${dueConcepts.join(", ")}`);
      }

      // 2. Learning Style Fingerprinting
      if (profile.engagementMetrics?.styleDetected && profile.engagementMetrics.styleDetected !== 'unknown') {
        learnerProfile.learning_style = profile.engagementMetrics.styleDetected;
        console.log(`[PedagogyEngine] 🕵️ Using Persistent Learner Style: ${learnerProfile.learning_style.toUpperCase()}`);
      } else if (profile.totalSessions >= 3) {
        const { visualStepsCompleted, conceptualDoubtsAsked } = profile.engagementMetrics;
        const style = visualStepsCompleted > conceptualDoubtsAsked ? 'visual' : 'conceptual';
        learnerProfile.learning_style = style;
        console.log(`[PedagogyEngine] 🕵️ Using Live Calculated Style: ${style.toUpperCase()} (v:${visualStepsCompleted} c:${conceptualDoubtsAsked})`);
      }
    }
  }

  const userProfile = `Target Level = ${level}, Confusion Level = ${confusion}/10 (Mastery Score: ${mastery})`;

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
    const planningResult = await planAnimation(topic, domain, userConfig);

    // Stage 2: Execute Agent Loop
    onProgress('Running autonomous visual planning loop...');

    const targetSteps = DOMAIN_MIN_STEPS[domain]?.default || 10;
    const rawSceneGraph = await runAgentLoop({
      topic,
      domain,
      model: modelId,
      maxSteps: targetSteps,
      planningResult,
      onProgress,
      userConfig,
      learnerProfile,
      file,
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
    failsafe.chatMessage = err.message || `I hit a snag generating your lesson on "${topic}". Try rephrasing or asking a more specific question!`;
    return failsafe;
  }
}

export async function generateQuiz(sessionId, topic, onProgress = () => { }, modelId = null, userConfig = null) {
  const session = await sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  onProgress('Building personalized quiz...');

  try {
    const userContext = userConfig ? `
    Student Info:
    - Name: ${userConfig.nickname || userConfig.name || 'Student'}
    - Role: ${userConfig.role || 'Student'}
    ${userConfig.customInstructions ? `- Custom AI Behavior: ${userConfig.customInstructions}` : ''}
    ` : '';

    const prompt = `You are a Quiz Master. ${userContext}
    Create a 4-question interactive quiz on "${topic}".
    The output must be a JSON object:
    {
      "mode": "quiz",
      "title": "Quick Quiz: ${topic}",
      "questions": [
        {
          "prompt": "Question text...",
          "options": ["A", "B", "C", "D"],
          "answer": "Correct Option",
          "explanation": "Why it is correct..."
        }
      ]
    }`;

    const result = await requestCompletion({
      model: modelId || getModel(),
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.5,
      maxTokens: 2000,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'teaching',
    });

    if (result.error) throw new Error(result.error);

    const parsed = safeParse(result.content);
    if (!parsed || !parsed.questions) throw new Error('Invalid quiz format');

    // Attach renderer info so client knows how to handle it
    parsed.renderer = 'quiz';
    parsed.type = 'quiz';

    return parsed;
  } catch (err) {
    console.error('[PedagogyEngine] Quiz generation failed:', err.message);
    return {
      mode: 'quiz',
      title: `Quiz: ${topic}`,
      questions: [],
      chatMessage: err.message || "I couldn't build a quiz for you right now, but I can definitely explain the topic! What would you like to know?",
      renderer: 'quiz'
    };
  }
}

// ─── Doubt/Text Handlers ──────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question, modelId = null, userConfig = null, file = null, snapshot = null, mode = 'EXPLAIN') {
  const session = await sessionStore.get(sessionId);
  const topic = session?.topic || 'General Education';

  try {
    let canvasState = [];
    if (snapshot) {
      canvasState = snapshot.nodes || snapshot.elements || [];
    } else {
      const currentStepIndex = session?.currentStepIndex || 0;
      const currentStep = session?.steps?.[currentStepIndex] || {};
      const visibleIds = new Set(currentStep.objectIds || []);
      const sessionCanvas = session?.canvasState || [];
      const timelineElements = session?.timeline?.elements || [];
      const currentFrames = timelineElements.filter(e => visibleIds.has(e.id));
      canvasState = [...sessionCanvas, ...currentFrames];
    }

    // 2. Call specialized DeltaAgent
    const delta = await generateDelta({
      topic,
      canvasState,
      question,
      modelId,
      userConfig,
      file,
      mode
    });

    if (delta.isError) {
      return {
        answer: delta.answer || 'I hit a snag analyzing your question. Please try again!',
        isRelevant: true,
        hasVisuals: false,
        visualUpdate: { mutations: [] }
      };
    }

    return {
      answer: delta.answer,
      isRelevant: true,
      hasVisuals: (delta.commands || []).length > 0,
      visualUpdate: {
        mutations: delta.commands || [],
        isDelta: true // Mark as delta to prevent canvas wipe
      },
      followUp: delta.followUp,
    };
  } catch (err) {
    console.error('[PedagogyEngine] Doubt handling failed:', err.message);

    // Propagate custom API errors clearly
    const isCustomError = err.message?.includes('Custom API error') || err.message?.includes('Your API');
    const isSystemError = err.message?.includes('SYSTEM_NOT_CONFIGURED');

    let answer;
    if (isSystemError) {
      answer = 'TutorBoard system APIs are not currently available. Please add your own API key in Settings → AI Configuration.';
    } else if (isCustomError) {
      answer = err.message;
    } else {
      answer = "I'm sorry, I encountered an error while processing that. Let's try again!";
    }

    return {
      answer,
      isRelevant: true,
      hasVisuals: false,
      isError: true
    };
  }
}

export async function generateTextResponse(sessionId, prompt, modelId = null, userConfig = null, file = null) {
  try {
    const session = await sessionStore.get(sessionId);
    const topic = session?.topic || 'General Discussion';

    console.log(`[PedagogyEngine] 💬 Generating text response for: "${prompt.substring(0, 30)}..."`);

    const response = await requestCompletion({
      model: resolveModelId(modelId || getTextModel()),
      messages: [
        {
          role: 'system',
          content: `You are Tutu, a friendly and helpful AI pedagogical assistant. 
          The student you are teaching is ${userConfig?.nickname || userConfig?.name || 'a student'} (Role: ${userConfig?.role || 'Learner'}).
          ${userConfig?.customInstructions ? `PERSONALIZED INSTRUCTIONS: ${userConfig.customInstructions}` : ''}
          The current context is: ${topic}. 
          Answer conversationally, be encouraging, and keep it under 3 sentences.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
      userConfig,
      taskType: 'simple_qa',
      file,
    });

    if (response.error || !response.content) {
      const errorMsg = response.error || 'The AI provider returned an empty response.';
      const isCustomError = response._meta?.mode === 'custom' || response.errorType;

      console.warn(`[PedagogyEngine] Text response failed: ${errorMsg}`);

      // Surface custom API errors directly — they are already user-friendly
      if (isCustomError) {
        return {
          answer: errorMsg,
          type: 'text',
          isCustomApiError: true,
        };
      }

      return {
        answer: `I'm having trouble generating a response. (${errorMsg}). If you're using a custom API key, please check your credits and connection in Settings.`,
        type: 'text'
      };
    }

    return { answer: response.content, type: 'text' };
  } catch (err) {
    const detail = err.message ? ` (${err.message})` : '';
    const isSystemNotConfigured = err.message?.includes('SYSTEM_NOT_CONFIGURED');
    console.error('[PedagogyEngine] Text response failed:', err.message);

    if (isSystemNotConfigured) {
      return {
        answer: 'TutorBoard system APIs are not currently available. Please add your own API key in Settings → AI Configuration to continue learning.',
        type: 'text',
        isSystemError: true,
      };
    }

    return {
      answer: `I'm having a bit of trouble connecting${detail}. Please check your API configuration in Settings.`,
      type: 'text',
    };
  }
}

export async function generateSessionSummary(sessionId, modelId = null, userConfig = null) {
  try {
    const session = await sessionStore.get(sessionId);
    if (!session || !session.topic) return null;

    const messages = session.messages || [];
    const dialogue = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const topic = session.topic;

    const prompt = `Synthesize a brief (2-sentence) pedagogical summary for a learning session on "${topic}". 
    Focus on what the student learned or struggled with based on this dialogue:
    
    ${dialogue.slice(-2000)}
    
    Format: "Learner explored [X]. They showed mastery in [Y] but required delta-clarification on [Z]."`;

    const result = await requestCompletion({
      model: modelId || getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 300,
      userConfig,
    });

    return result.content || `Completed a session on ${topic}.`;
  } catch (err) {
    console.error('[PedagogyEngine] Summary generation failed:', err.message);
    return null;
  }
}