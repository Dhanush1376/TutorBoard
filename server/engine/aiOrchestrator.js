/**
 * AI Orchestrator — Manages LLM interactions for teaching sessions
 * 
 * Handles:
 *   - Generating teaching timelines from topics
 *   - Generating doubt responses with visual context
 *   - JSON validation with retry logic
 *   - Conversation context management
 */

import aiClient, { getModel } from '../utils/ai.js';
import { TEACHING_TIMELINE_PROMPT, DOUBT_RESPONSE_PROMPT, isGreeting } from './prompts.js';
import { safeParse, validateTimeline, validateDoubtResponse, buildRetryPrompt } from './validator.js';
import sessionStore from './sessionStore.js';

// ─── Fallback Timeline ───
const FALLBACK_TIMELINE = {
  title: 'Visual Overview',
  domain: 'general',
  totalSteps: 3,
  objects: [
    { id: 'f1', shape: 'circle', x: 250, y: 300, r: 60, color: 'blue', fillOpacity: 0.2, label: 'Concept', appearsAtStep: 0 },
    { id: 'f2', shape: 'arrow', x1: 320, y1: 300, x2: 430, y2: 300, color: 'white', label: 'leads to', appearsAtStep: 1 },
    { id: 'f3', shape: 'circle', x: 550, y: 300, r: 60, color: 'green', fillOpacity: 0.2, label: 'Result', appearsAtStep: 2 },
    { id: 'ft', shape: 'text', x: 400, y: 480, text: 'Visual Engine Ready', fontSize: 18, color: 'gray', appearsAtStep: 0 },
  ],
  steps: [
    { index: 0, title: 'Identify', description: 'Identify the core concept', objectIds: ['f1', 'ft'], highlightIds: ['f1'], transition: 'fadeIn', focusPoint: { x: 250, y: 300 }, duration: 3000 },
    { index: 1, title: 'Connect', description: 'Connect to the next idea', objectIds: ['f1', 'f2', 'ft'], highlightIds: ['f2'], transition: 'drawLine', focusPoint: { x: 400, y: 300 }, duration: 3000 },
    { index: 2, title: 'Result', description: 'Arrive at the conclusion', objectIds: ['f1', 'f2', 'f3', 'ft'], highlightIds: ['f3'], transition: 'scaleIn', focusPoint: { x: 550, y: 300 }, duration: 3000 },
  ],
};

// ─── Fallback Doubt Response ───
const FALLBACK_DOUBT_RESPONSE = {
  answer: "That's a great question! Let me think about that. The key idea relates to the core concept we've been exploring.",
  isRelevant: true,
  hasVisuals: false,
  visualUpdate: null,
};

/**
 * Call LLM with retry logic and validation.
 */
async function callLLMWithRetry(messages, validateFn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI Orchestrator] LLM call attempt ${attempt + 1}/${maxRetries + 1}`);

      const completion = await aiClient.chat.completions.create({
        model: getModel(),
        temperature: attempt === 0 ? 0.4 : 0.1,
        messages,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0].message.content;
      console.log(`[AI Orchestrator] Raw output (${raw.length} chars)`);

      const parsed = safeParse(raw);
      if (!parsed) {
        console.error(`[AI Orchestrator] JSON parse FAILED on attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: 'INVALID JSON. Your response was not parseable. Return ONLY valid JSON.' });
          continue;
        }
        return null;
      }

      const validation = validateFn(parsed);
      if (!validation.valid) {
        console.error(`[AI Orchestrator] Validation FAILED:`, validation.errors);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: buildRetryPrompt(validation.errors) });
          continue;
        }
        // Return partially valid data on last attempt
        return parsed;
      }

      console.log(`[AI Orchestrator] ✅ Valid response on attempt ${attempt + 1}`);
      return parsed;

    } catch (err) {
      console.error(`[AI Orchestrator] LLM error on attempt ${attempt + 1}:`, err.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

/**
 * Generate a teaching timeline for a topic.
 */
export async function generateTimeline(sessionId, topic) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // Check for greetings
  if (isGreeting(topic)) {
    return {
      type: 'greeting',
      answer: "Hey there! 👋 I'm your visual tutor. Tell me a topic and I'll teach it to you step-by-step with animations!",
    };
  }

  // Build messages
  const contextSummary = sessionStore.buildContextSummary(sessionId);
  const messages = [
    { role: 'system', content: TEACHING_TIMELINE_PROMPT },
  ];

  if (contextSummary) {
    messages.push({
      role: 'system',
      content: `SESSION CONTEXT:\n${contextSummary}`,
    });
  }

  messages.push({ role: 'user', content: `Create a visual teaching timeline for: "${topic}"` });

  // Call LLM
  const data = await callLLMWithRetry(messages, validateTimeline);

  if (!data) {
    console.warn(`[AI Orchestrator] All attempts failed for topic: "${topic}". Using fallback.`);
    const fallback = { ...FALLBACK_TIMELINE, title: topic.substring(0, 50) };
    return fallback;
  }

  // Ensure required fields
  if (!data.domain) data.domain = 'general';
  if (!data.totalSteps) data.totalSteps = data.steps.length;

  // Add appearsAtStep to objects that don't have it
  if (data.objects) {
    data.objects.forEach((obj, i) => {
      if (typeof obj.appearsAtStep !== 'number') {
        obj.appearsAtStep = Math.min(i, data.steps.length - 1);
      }
    });
  }

  // Ensure each step has objectIds if not present
  data.steps.forEach((step, i) => {
    if (!step.objectIds) {
      step.objectIds = data.objects
        .filter(obj => (obj.appearsAtStep || 0) <= i)
        .map(obj => obj.id);
    }
    if (!step.highlightIds) step.highlightIds = [];
    if (!step.transition) step.transition = 'fadeIn';
    if (!step.duration) step.duration = 3000;
    if (!step.focusPoint) step.focusPoint = { x: 400, y: 300 };
    step.index = i;
  });

  // Update session
  sessionStore.setTimeline(sessionId, data);
  sessionStore.addContext(sessionId, 'user', `Teach me: ${topic}`);
  sessionStore.addContext(sessionId, 'assistant', `Teaching timeline: ${data.title} (${data.steps.length} steps)`);

  return data;
}

/**
 * Generate a response to a student's doubt.
 */
export async function handleDoubt(sessionId, question) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // Build context
  const contextSummary = sessionStore.buildContextSummary(sessionId);
  const currentStep = session.steps[session.currentStepIndex];

  const messages = [
    { role: 'system', content: DOUBT_RESPONSE_PROMPT },
    {
      role: 'system',
      content: `CURRENT SESSION:
${contextSummary}
CURRENT STEP (${session.currentStepIndex + 1}/${session.steps.length}):
  Title: ${currentStep?.title || 'N/A'}
  Description: ${currentStep?.description || 'N/A'}`,
    },
  ];

  // Add conversation context
  session.conversationContext.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
  });

  messages.push({ role: 'user', content: question });

  // Call LLM
  const data = await callLLMWithRetry(messages, validateDoubtResponse);

  if (!data) {
    console.warn(`[AI Orchestrator] Doubt response failed. Using fallback.`);
    sessionStore.addDoubt(sessionId, question, FALLBACK_DOUBT_RESPONSE.answer);
    return FALLBACK_DOUBT_RESPONSE;
  }

  // Process visual update if present
  if (data.hasVisuals && data.visualUpdate) {
    // Ensure objects have appearsAtStep
    if (data.visualUpdate.objects) {
      data.visualUpdate.objects.forEach((obj, i) => {
        if (typeof obj.appearsAtStep !== 'number') {
          obj.appearsAtStep = 0;
        }
      });
    }
    // Ensure steps have required fields
    if (data.visualUpdate.steps) {
      data.visualUpdate.steps.forEach((step, i) => {
        if (!step.objectIds) {
          step.objectIds = (data.visualUpdate.objects || [])
            .filter(obj => (obj.appearsAtStep || 0) <= i)
            .map(obj => obj.id);
        }
        step.index = i;
        if (!step.highlightIds) step.highlightIds = [];
        if (!step.transition) step.transition = 'fadeIn';
        if (!step.duration) step.duration = 3000;
      });
    }
  }

  // Save to session
  sessionStore.addDoubt(sessionId, question, data.answer, data.visualUpdate);
  sessionStore.addContext(sessionId, 'user', `Doubt: ${question}`);
  sessionStore.addContext(sessionId, 'assistant', data.answer);

  return data;
}
