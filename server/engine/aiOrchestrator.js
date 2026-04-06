/**
 * AI Orchestrator v4.0 — DeepSeek via OpenRouter
 */

import { getAIClient, getModel, getTextModel } from './ai/llmClient.js';
import {
  TEACHING_ENGINE_PROMPT,
  DOUBT_RESPONSE_PROMPT,
  isGreeting,
  buildTeachingPrompt,
  detectDomain,
} from './prompts/index.js';
import { safeParse, validateTimeline, validateDoubtResponse, buildRetryPrompt } from './validation/index.js';
import sessionStore from './sessionStore.js';

const FALLBACK_TIMELINE = {
  mode: 'explain',
  title: 'Visual Overview',
  domain: 'general',
  difficulty: 'beginner',
  estimatedTime: '2 minutes',
  professorNote: 'A smooth introduction to your topic.',
  learningNodes: [
    { type: 'hook', title: 'Start Here', content: "Let's look at the big picture." },
    { type: 'concept', title: 'Core Idea', content: 'The fundamental principle here.' },
    { type: 'intuition', title: 'Why it works', content: 'Think of it as a bridge between two ideas.' },
    { type: 'result', title: 'Conclusion', content: 'You now have the foundation.' },
  ],
  totalSteps: 4,
  objects: [
    { id: 'f1', shape: 'circle', x: 250, y: 300, r: 55, color: 'blue', label: 'Start', appearsAtStep: 0 },
    { id: 'f2', shape: 'circle', x: 400, y: 300, r: 55, color: 'orange', label: 'Core', appearsAtStep: 1 },
    { id: 'f3', shape: 'circle', x: 550, y: 300, r: 55, color: 'green', label: 'Finish', appearsAtStep: 2 },
    { id: 'fa1', shape: 'arrow', x1: 310, y1: 300, x2: 342, y2: 300, color: 'white', appearsAtStep: 1 },
    { id: 'fa2', shape: 'arrow', x1: 458, y1: 300, x2: 492, y2: 300, color: 'white', appearsAtStep: 2 },
    { id: 'ft', shape: 'text', x: 400, y: 500, text: 'Starting session...', fontSize: 15, color: 'gray', appearsAtStep: 0 },
  ],
  steps: [
    { index: 0, title: 'Intro', description: 'Start', narration: "Let's begin.", objectIds: ['f1','ft'], highlightIds: ['f1'], newIds: ['f1','ft'], transition: 'fadeIn', duration: 2000 },
    { index: 1, title: 'Step 1', description: 'Add second', narration: "Now we add B.", objectIds: ['f1','f2','fa1'], highlightIds: ['f2'], newIds: ['f2','fa1'], transition: 'scaleIn', duration: 2000 },
    { index: 2, title: 'Step 2', description: 'Complete', narration: "And C completes it.", objectIds: ['f1','f2','f3','fa1','fa2'], highlightIds: ['f3'], newIds: ['f3','fa2'], transition: 'slideUp', duration: 2000 },
    { index: 3, title: 'Done', description: 'Summary', narration: "That's the overview.", objectIds: ['f1','f2','f3','fa1','fa2'], highlightIds: ['f1'], newIds: [], transition: 'fadeIn', duration: 2000 },
  ],
};

const FALLBACK_DOUBT = {
  answer: "Great question! This connects directly to what we have been exploring.",
  isRelevant: true,
  hasVisuals: false,
  visualUpdate: null,
};

function stripThinkTags(text) {
  if (!text) return text;
  return text.replace(/<[\/]?think>/gi, '').trim();
}

function getTokenBudget() {
  return 4096;
}

function withTimeout(promise, ms, errorMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

async function callLLMWithRetry(messages, validateFn, maxRetries = 2, maxTokens = 3072) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Orchestrator] Attempt ${attempt + 1}/${maxRetries + 1}`);

      const ai = getAIClient();
      const model = getModel();
      const temperature = attempt === 0 ? 0.3 : 0.2;

      const completion = await withTimeout(
        ai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        90000,
        'AI timeout'
      );

      let raw = completion.choices?.[0]?.message?.content || '';
      const finishReason = completion.choices?.[0]?.finish_reason || 'stop';

      raw = stripThinkTags(raw);
      console.log(`[Orchestrator] Raw: ${raw.length} chars, finish: ${finishReason}`);

      if (finishReason === 'length' || (raw.length > 0 && !raw.trim().endsWith('}'))) {
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: 'Be more concise. Return only valid JSON.' });
          continue;
        }
      }

      const parsed = safeParse(raw);
      if (!parsed) {
        console.error('[Orchestrator] JSON parse FAILED');
        if (attempt < maxRetries) continue;
        return null;
      }

      const validation = validateFn(parsed);
      if (!validation.valid) {
        console.warn('[Orchestrator] Validation issues:', validation.errors);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: buildRetryPrompt(validation.errors) });
          continue;
        }
      }

      console.log(`[Orchestrator] ✅ Success`);
      return parsed;

    } catch (err) {
      console.error(`[Orchestrator] ❌ Error:`, err.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

function processTimeline(data, detectedDomain) {
  const objects = Array.isArray(data.objects) ? data.objects : [];
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const total = steps.length;

  objects.forEach((obj, i) => {
    if (!obj.id) obj.id = `obj-${i}`;
  });

  objects.forEach((obj, i) => {
    if (typeof obj.appearsAtStep !== 'number' || obj.appearsAtStep < 0) {
      obj.appearsAtStep = total > 1 ? Math.floor((i / objects.length) * total) : 0;
    }
    obj.appearsAtStep = Math.max(0, Math.min(obj.appearsAtStep, total - 1));
  });

  steps.forEach((step, i) => {
    step.index = i;
    if (!Array.isArray(step.objectIds) || step.objectIds.length === 0) {
      step.objectIds = objects.filter(o => o.appearsAtStep <= i).map(o => o.id);
    }
    if (!Array.isArray(step.newIds) || step.newIds.length === 0) {
      step.newIds = objects.filter(o => o.appearsAtStep === i).map(o => o.id);
    }
    if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
    if (!step.transition) step.transition = 'fadeIn';
    if (!step.duration) step.duration = 2000;
    if (!step.narration) step.narration = step.description || step.title || '';
  });

  data.objects = objects;
  data.steps = steps;
  data.totalSteps = total;
  if (!data.domain) data.domain = detectedDomain || 'general';

  return data;
}

export async function generateTimeline(sessionId, topic) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return { type: 'greeting', answer: "Hey there! 👋 I'm your visual tutor. Tell me any topic!" };
  }

  const domain = detectDomain(topic);
  console.log(`[Orchestrator] Topic: "${topic}" → Domain: ${domain}`);

  const messages = [
    { role: 'system', content: TEACHING_ENGINE_PROMPT },
    { role: 'user', content: buildTeachingPrompt(topic) }
  ];

  let data;
  try {
    data = await callLLMWithRetry(messages, validateTimeline, 1, getTokenBudget());
  } catch (err) {
    console.error('[Orchestrator] Error:', err);
  }

  if (!data) {
    return { ...FALLBACK_TIMELINE, title: topic.substring(0, 60), domain };
  }

  const processed = processTimeline(data, domain);
  processed.domain = processed.domain || domain;
  processed.mode = processed.mode || 'explain';

  sessionStore.setTimeline(sessionId, processed);

  return processed;
}

export async function generateTextResponse(sessionId, promptStr) {
  const ai = getAIClient();
  const model = getTextModel();

  try {
    const completion = await ai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are TutorBoard, a helpful tutor.' },
        { role: 'user', content: promptStr }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const answer = completion.choices?.[0]?.message?.content || "I'm here to help!";
    return { type: 'greeting', answer };
  } catch (err) {
    console.error('[Orchestrator] Text error:', err);
    return { type: 'greeting', answer: "Something went wrong. Please try again." };
  }
}

export async function handleDoubt(sessionId, question) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const messages = [
    { role: 'system', content: DOUBT_RESPONSE_PROMPT },
    { role: 'user', content: question }
  ];

  const data = await callLLMWithRetry(messages, validateDoubtResponse, 2, 1500);

  if (!data) {
    return FALLBACK_DOUBT;
  }

  sessionStore.addDoubt(sessionId, question, data.answer, data.visualUpdate);
  data._question = question;
  return data;
}
