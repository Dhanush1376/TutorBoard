/**
 * AI Orchestrator v2.0
 *
 * Enhancements:
 * 1. Uses buildTeachingPrompt() for domain-aware prompts
 * 2. temperature: 0.2 on first attempt (more reliable JSON)
 * 3. max_tokens: 10000 for complex topics (medicine, law, DSA)
 * 4. Empty objectIds rebuilt from appearsAtStep
 * 5. Objects without IDs get auto-IDs
 * 6. finish_reason: "length" triggers immediate retry with condensed instruction
 * 7. Domain injected into processed timeline
 */

import { getAIClient, getModel } from '../utils/ai.js';
import {
  TEACHING_TIMELINE_PROMPT,
  DOUBT_RESPONSE_PROMPT,
  isGreeting,
  buildTeachingPrompt,
  detectDomain,
} from './prompts.js';
import { safeParse, validateTimeline, validateDoubtResponse, buildRetryPrompt } from './validator.js';
import sessionStore from './sessionStore.js';

// ─── Fallback — only shown when ALL retries fail ───────────────────────────────
const FALLBACK_TIMELINE = {
  mode: 'explain',
  title: 'Visual Overview',
  domain: 'general',
  difficulty: 'beginner',
  estimatedTime: '2 minutes',
  professorNote: 'A smooth introduction to your topic.',
  learningNodes: [
    { type: 'hook',      title: 'Start Here',   content: "Let's look at the big picture." },
    { type: 'concept',   title: 'Core Idea',    content: 'The fundamental principle here.' },
    { type: 'intuition', title: 'Why it works', content: 'Think of it as a bridge between two ideas.' },
    { type: 'result',    title: 'Conclusion',   content: 'You now have the foundation.' },
  ],
  totalSteps: 4,
  objects: [
    { id: 'f1',  shape: 'circle', x: 250, y: 300, r: 55, color: 'blue',   label: 'Start',  appearsAtStep: 0 },
    { id: 'f2',  shape: 'circle', x: 400, y: 300, r: 55, color: 'orange', label: 'Core',   appearsAtStep: 1 },
    { id: 'f3',  shape: 'circle', x: 550, y: 300, r: 55, color: 'green',  label: 'Finish', appearsAtStep: 2 },
    { id: 'fa1', shape: 'arrow',  x1: 310, y1: 300, x2: 342, y2: 300, color: 'white', label: '', appearsAtStep: 1 },
    { id: 'fa2', shape: 'arrow',  x1: 458, y1: 300, x2: 492, y2: 300, color: 'white', label: '', appearsAtStep: 2 },
    { id: 'ft',  shape: 'text',   x: 400, y: 500, text: 'Starting session...', fontSize: 15, color: 'gray', appearsAtStep: 0 },
  ],
  steps: [
    { index: 0, title: 'Introduction', description: 'Setting the stage',       narration: "Let's begin.",              objectIds: ['f1','ft'],                       highlightIds: ['f1'],  newIds: ['f1','ft'],  transition: 'fadeIn',  duration: 3000 },
    { index: 1, title: 'Development',  description: 'Building the concept',    narration: 'Now the core idea.',        objectIds: ['f1','f2','fa1','ft'],            highlightIds: ['f2'],  newIds: ['f2','fa1'], transition: 'slideUp', duration: 3000 },
    { index: 2, title: 'Advanced',     description: 'Deeper meaning',          narration: 'The full picture emerges.', objectIds: ['f1','f2','f3','fa1','fa2','ft'], highlightIds: ['f3'],  newIds: ['f3','fa2'], transition: 'scaleIn', duration: 3000 },
    { index: 3, title: 'Final Thought','description':'Complete understanding',  narration: "And that is the journey.", objectIds: ['f1','f2','f3','fa1','fa2','ft'], highlightIds: ['ft'],  newIds: [],          transition: 'fadeIn',  duration: 3500 },
  ],
};

const FALLBACK_DOUBT = {
  answer: "Great question! This connects directly to what we have been exploring. Let me point to the relevant part of the canvas.",
  isRelevant: true,
  hasVisuals: false,
  visualUpdate: null,
};

// ─── Token budget by domain ───────────────────────────────────────────────────
function getTokenBudget(domain) {
  const heavy = ['dsa', 'medicine', 'chemistry', 'biology', 'engineering', 'law'];
  return heavy.includes(domain) ? 10000 : 8000;
}

// ─── LLM call with retry ──────────────────────────────────────────────────────
async function callLLMWithRetry(messages, validateFn, maxRetries = 2, maxTokens = 8000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Orchestrator] Attempt ${attempt + 1}/${maxRetries + 1} (maxTokens: ${maxTokens})`);

      const ai = getAIClient();

      // Lower temperature on first attempt for JSON reliability
      // Slight increase on retries to escape bad local minima
      const temperature = attempt === 0 ? 0.2 : 0.15;

      const completion = await ai.chat.completions.create({
        model: getModel(),
        temperature,
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0].message.content;
      const finishReason = completion.choices[0].finish_reason;

      console.log(`[Orchestrator] Raw: ${raw.length} chars, finish_reason: ${finishReason}`);

      if (finishReason === 'length') {
        console.warn(`[Orchestrator] ⚠️ HIT TOKEN LIMIT at ${maxTokens} tokens.`);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({
            role: 'user',
            content: 'Your JSON was truncated by token limit. Rebuild it MORE CONCISELY. Keep narrations to 2 sentences max. Reduce step count if needed. Return ONLY valid complete JSON.',
          });
          continue;
        }
      }

      const parsed = safeParse(raw);
      if (!parsed) {
        console.error(`[Orchestrator] JSON parse FAILED. Tail:`, raw.slice(-400));
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: 'Your JSON was invalid. Return ONLY complete valid JSON. Nothing else.' });
          continue;
        }
        return null;
      }

      const validation = validateFn(parsed);
      if (!validation.valid) {
        console.warn(`[Orchestrator] Validation issues:`, validation.errors);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: buildRetryPrompt(validation.errors) });
          continue;
        }
        return parsed; // Return partial rather than null
      }

      console.log(`[Orchestrator] ✅ Success on attempt ${attempt + 1}`);
      return parsed;

    } catch (err) {
      console.error(`[Orchestrator] Error attempt ${attempt + 1}:`, err.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

// ─── Post-process timeline ────────────────────────────────────────────────────
function processTimeline(data, detectedDomain) {
  const objects = Array.isArray(data.objects) ? data.objects : [];
  const steps   = Array.isArray(data.steps)   ? data.steps   : [];
  const total   = steps.length;

  // 1. Auto-ID objects
  objects.forEach((obj, i) => {
    if (!obj.id) obj.id = `obj-auto-${i}`;
  });

  // 2. Fix appearsAtStep — proportional distribution
  objects.forEach((obj, i) => {
    if (typeof obj.appearsAtStep !== 'number' || obj.appearsAtStep < 0) {
      obj.appearsAtStep = total > 1 ? Math.floor((i / objects.length) * total) : 0;
    }
    obj.appearsAtStep = Math.max(0, Math.min(obj.appearsAtStep, total - 1));
  });

  // 3. Fix steps
  steps.forEach((step, i) => {
    step.index = i;

    // CRITICAL: empty objectIds → rebuild from appearsAtStep
    if (!Array.isArray(step.objectIds) || step.objectIds.length === 0) {
      step.objectIds = objects
        .filter(o => o.appearsAtStep <= i)
        .map(o => o.id);
    }

    // Derive newIds if missing
    if (!Array.isArray(step.newIds) || step.newIds.length === 0) {
      step.newIds = objects
        .filter(o => o.appearsAtStep === i)
        .map(o => o.id);
    }

    if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
    if (!step.transition) step.transition = 'fadeIn';
    if (!step.duration)   step.duration   = 3000;
    if (!step.narration)  step.narration  = step.description || step.title || '';
  });

  data.objects    = objects;
  data.steps      = steps;
  data.totalSteps = total;

  // Ensure domain is set correctly
  if (!data.domain || data.domain === 'general') {
    data.domain = detectedDomain || 'general';
  }

  return data;
}

// ─── Generate Timeline ────────────────────────────────────────────────────────
export async function generateTimeline(sessionId, topic) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return {
      type: 'greeting',
      answer: "Hey there! 👋 I'm your visual tutor. Tell me any topic — from Bubble Sort to Brain Surgery — and I'll teach it with full step-by-step animations!",
    };
  }

  // Detect domain upfront for token budget and prompt
  const domain = detectDomain(topic);
  const tokenBudget = getTokenBudget(domain);

  console.log(`[Orchestrator] Topic: "${topic}" → Domain: ${domain}, Tokens: ${tokenBudget}`);

  const contextSummary = sessionStore.buildContextSummary(sessionId);
  const messages = [{ role: 'system', content: TEACHING_TIMELINE_PROMPT }];

  if (contextSummary) {
    messages.push({ role: 'system', content: `SESSION CONTEXT:\n${contextSummary}` });
  }

  // Use domain-aware prompt
  const userPrompt = buildTeachingPrompt(topic);
  messages.push({ role: 'user', content: userPrompt });

  const data = await callLLMWithRetry(messages, validateTimeline, 2, tokenBudget);

  if (!data) {
    console.warn(`[Orchestrator] All attempts failed for: "${topic}". Using fallback.`);
    return {
      ...FALLBACK_TIMELINE,
      title: topic.substring(0, 60),
      domain,
    };
  }

  const processed = processTimeline(data, domain);
  processed.domain        = processed.domain        || domain;
  processed.mode          = processed.mode          || 'explain';
  processed.difficulty    = processed.difficulty    || 'beginner';
  processed.learningNodes = processed.learningNodes || [];
  processed.professorNote = processed.professorNote || '';
  processed.memoryAnchor  = processed.memoryAnchor  || '';
  processed.keyFormula    = processed.keyFormula    || '';

  sessionStore.setTimeline(sessionId, processed);
  sessionStore.addContext(sessionId, 'user', `Teach me: ${topic}`);
  sessionStore.addContext(sessionId, 'assistant',
    `Teaching: ${processed.title} (${processed.steps.length} steps, domain: ${processed.domain}, mode: ${processed.mode})`);

  return processed;
}

// ─── Handle Doubt ─────────────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const contextSummary = sessionStore.buildContextSummary(sessionId);
  const currentStep    = session.steps[session.currentStepIndex];
  const domain         = session.timeline?.domain || 'general';

  const objectsSummary = session.objects.map(obj => {
    const props = [`id="${obj.id}"`, `shape="${obj.shape}"`];
    if (obj.x !== undefined) props.push(`x=${obj.x}`);
    if (obj.y !== undefined) props.push(`y=${obj.y}`);
    if (obj.label) props.push(`label="${obj.label}"`);
    if (obj.text)  props.push(`text="${obj.text}"`);
    if (obj.color) props.push(`color="${obj.color}"`);
    return `  ${props.join(', ')}`;
  }).join('\n');

  const messages = [
    { role: 'system', content: DOUBT_RESPONSE_PROMPT },
    {
      role: 'system',
      content: `CURRENT SESSION:\n${contextSummary}\nDOMAIN: ${domain}\n\nSTEP ${session.currentStepIndex + 1}/${session.steps.length}: ${currentStep?.title || 'N/A'}\nSTEP NARRATION: ${currentStep?.narration || ''}\n\nCANVAS OBJECTS:\n${objectsSummary || '  (none)'}`,
    },
  ];

  session.conversationContext.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
  messages.push({ role: 'user', content: question });

  const data = await callLLMWithRetry(messages, validateDoubtResponse, 2, 3000);

  if (!data) {
    sessionStore.addDoubt(sessionId, question, FALLBACK_DOUBT.answer);
    return FALLBACK_DOUBT;
  }

  // Process mutations
  if (data.hasVisuals && data.visualUpdate) {
    if (data.visualUpdate.mutations) {
      data.visualUpdate.mutations.forEach(m => {
        if (m.action === 'add' && m.object) {
          if (!m.object.id) m.object.id = `doubt-obj-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          if (typeof m.object.appearsAtStep !== 'number') m.object.appearsAtStep = 0;
        }
      });
    }

    // Legacy backward-compat
    if (data.visualUpdate.objects && !data.visualUpdate.mutations) {
      data.visualUpdate.mutations = data.visualUpdate.objects.map(obj => ({
        action: 'add',
        object: { ...obj, appearsAtStep: obj.appearsAtStep ?? 0 },
      }));
    }

    if (data.visualUpdate.steps) {
      const allIds = session.objects.map(o => o.id);
      (data.visualUpdate.mutations || []).forEach(m => {
        if (m.action === 'add' && m.object?.id) allIds.push(m.object.id);
      });

      data.visualUpdate.steps.forEach((step, i) => {
        step.index = i;
        if (!Array.isArray(step.objectIds) || step.objectIds.length === 0) step.objectIds = allIds;
        if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
        if (!step.newIds)     step.newIds     = [];
        if (!step.transition) step.transition = 'fadeIn';
        if (!step.duration)   step.duration   = 3500;
      });
    }
  }

  sessionStore.addDoubt(sessionId, question, data.answer, data.visualUpdate);
  sessionStore.addContext(sessionId, 'user',      `Doubt: ${question}`);
  sessionStore.addContext(sessionId, 'assistant', data.answer);
  data._question = question;
  return data;
}