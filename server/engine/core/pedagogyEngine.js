/**
 * AI Orchestrator v4.0 — DeepSeek via OpenRouter
 */

import { requestCompletion, getModel, getTextModel } from '../utils/llmClient.js';
import {
  DOUBT_RESPONSE_PROMPT,
  MAESTRO_PEDAGOGY_PROMPT,
  isGreeting,
  buildTeachingPrompt,
  detectDomain,
  getAnimationGuide,
  buildTimelinePrompt,
  getNodeTemplates,
  REFLECTION_AGENT_PROMPT,
  buildDoubtPrompt
} from '../agents/index.js';
import { safeParse, validateTimeline, validateDoubtResponse, buildRetryPrompt, validatePedagogyResponse, validateReflectionResponse } from '../validators/index.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';

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
  // DeepSeek-R1 wraps its thought process in <think> tags.
  // We must remove the entire block (including newlines and contents), not just the tags.
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function getTokenBudget() {
  // Increased to 4096 to match modern model capacity (Gemini/DeepSeek-V3)
  // This prevents truncated visual plans for complex topics.
  return 4096;
}

function withTimeout(promise, ms, errorMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

async function callLLMWithRetry(messages, validateFn, maxRetries = 1, maxTokens = 3072) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const attemptTag = `[Orchestrator:${attempt + 1}/${maxRetries + 1}]`;
      const totalPromptLength = messages.reduce((acc, m) => acc + m.content.length, 0);
      console.log(`${attemptTag} Starting LLM call... (Prompt: ${totalPromptLength} chars, Max Tokens: ${maxTokens})`);

      const model = getModel();
      const temperature = attempt === 0 ? 0.1 : 0.05;
      
      // Attempt 1: 90s, Attempt 2+: 120s (OpenRouter proxying can add overhead)
      const timeoutMs = attempt === 0 ? 90000 : 120000;

      const completion = await withTimeout(
        requestCompletion({
          model,
          messages,
          temperature,
          maxTokens: maxTokens,
        }),
        timeoutMs,
        `LLM timeout after ${timeoutMs}ms`
      );

      let raw = completion.content || '';
      const finishReason = completion.finishReason || 'stop';

      raw = stripThinkTags(raw);
      console.log(`${attemptTag} Received response (${raw.length} chars), finish: ${finishReason}`);

      if (!raw.trim()) {
        console.warn(`${attemptTag} Empty response from LLM`);
        if (attempt < maxRetries) continue;
        return null;
      }

      if (finishReason === 'length' || (raw.length > 0 && !raw.trim().endsWith('}'))) {
        console.warn(`${attemptTag} Incomplete JSON response`);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: 'The JSON was incomplete. Please continue the JSON exactly where you left off. Do not repeat anything.' });
          continue;
        }
      }

      const parsed = safeParse(raw);
      if (!parsed) {
        console.error(`${attemptTag} JSON parse FAILED`);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: 'Invalid JSON. Return only the valid JSON object requested.' });
          continue;
        }
        return null;
      }

      const validation = validateFn(parsed);
      if (!validation.valid) {
        console.warn(`${attemptTag} Validation issues:`, validation.errors);
        if (attempt < maxRetries) {
          messages.push({ role: 'assistant', content: raw });
          messages.push({ role: 'user', content: buildRetryPrompt(validation.errors) });
          continue;
        }
      }

      console.log(`[Orchestrator] ✅ Successful generation on attempt ${attempt + 1}`);
      return parsed;

    } catch (err) {
      console.error(`[Orchestrator] ❌ Attempt ${attempt + 1} Error:`, err.message);
      
      // Fast-fail if APIs are completely exhausted
      if (err.message.includes('NO_API_AVAILABLE')) {
        throw new Error('OFFLINE_MODE');
      }

      if (attempt === maxRetries) return null;
      
      // Token Compression Strategy: Reduce maxTokens for next attempt
      maxTokens = Math.floor(maxTokens * 0.75); // Shrink by 25% on failure
      messages.forEach(m => {
        if (m.content && m.content.length > 500) {
           m.content += "\n[SYSTEM RULE: Return shorter, concise output. Reduce step count if needed.]";
        }
      });

      // Small pause before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

function processTimeline(data, detectedDomain, rawTopic) {
  const objects = Array.isArray(data.objects) ? data.objects : [];
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const total = steps.length;

  // Derive animationKey from raw topic or domain
  const slug = (rawTopic || data.title || "").toLowerCase()
    .replace(/explain /g, "")
    .replace(/me /g, "")
    .replace(/concept /g, "")
    .replace(/visualize /g, "")
    .trim()
    .replace(/\s+/g, "-");

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
    step.domain = data.domain || detectedDomain;
    step.animationKey = slug; // Pass slugified topic to trigger specific animations
    
    if (!Array.isArray(step.objectIds) || step.objectIds.length === 0) {
      step.objectIds = objects.filter(o => o.appearsAtStep <= i).map(o => o.id);
    }
    if (!Array.isArray(step.newIds) || step.newIds.length === 0) {
      step.newIds = objects.filter(o => o.appearsAtStep === i).map(o => o.id);
    }
    if (!Array.isArray(step.highlightIds)) step.highlightIds = [];
    if (!step.transition) step.transition = 'fadeIn';
    if (!step.duration) step.duration = step.durationMs || 3000;
    // Map durationMs back to duration for all steps to ensure client consistency
    if (step.durationMs && !step.duration) {
      step.duration = step.durationMs;
    }
    // If neither exists, use a sensible default (3000ms)
    if (!step.duration) step.duration = 3000;
    
    // Ensure both are present for maximum compatibility across older client versions
    if (step.duration && !step.durationMs) step.durationMs = step.duration;

    if (!step.narration) step.narration = step.description || step.title || '';
  });

  data.objects = objects;
  data.steps = steps;
  data.totalSteps = total;
  if (!data.domain) data.domain = detectedDomain || 'general';

  return data;
}


async function refinePedagogy(pedagogy, topic, userProfile) {
  console.log('[Orchestrator] 🚩 Refining pedagogy to remove complexity/confusion...');
  
  const userContent = REFLECTION_AGENT_PROMPT
    .replace('{{PLANNER_OUTPUT_JSON}}', JSON.stringify(pedagogy, null, 2))
    .replace('{{BEHAVIOR_OUTPUT_JSON}}', JSON.stringify(pedagogy.final_steps, null, 2))
    .replace('{{EXECUTION_PLAN_JSON}}', JSON.stringify(pedagogy.final_steps?.map(s => s.execution), null, 2));

  const messages = [
    { role: 'system', content: 'You are a Feedback Agent. Your role is to improve clarity and remove confusion from the provided pedagogical plan.' },
    { role: 'user', content: userContent }
  ];

  const refinement = await callLLMWithRetry(messages, validateReflectionResponse, 1, 1000);
  
  if (refinement && refinement.status === 'needs_improvement') {
    console.log('[Orchestrator] ✨ Pedagogy refined successfully.');
    // Map refined steps back to pedagogy format
    pedagogy.final_steps = refinement.refined_steps.map((s, i) => {
      const adj = refinement.execution_adjustments[i] || {};
      return {
        step_number: s.step_number,
        explanation: s.explanation,
        visual_hint: s.visual_hint,
        concept_unit: s.concept_unit,
        micro_clarification: s.micro_clarification,
        execution: {
          intensity: adj.visualization_intensity || 'medium',
          pacing: adj.pacing || 'slow',
          interaction: adj.interaction_type || 'guided'
        }
      };
    });
    // Ensure step count matches
    pedagogy.step_count = pedagogy.final_steps.length;
    pedagogy.steps = pedagogy.final_steps; // Sync for Stage 2
    pedagogy.reflection_result = refinement; 
  }
  
  return pedagogy;
}

export async function generatePedagogy(topic, userProfile) {
  const cached = cache.get(topic, userProfile);
  if (cached) return cached;

  console.log(`[Orchestrator] 🧠 The Maestro is planning curriculum for: "${topic}" (Profile: ${userProfile})`);
  
  const messages = [
    { role: 'system', content: MAESTRO_PEDAGOGY_PROMPT },
    { role: 'user', content: `Topic: ${topic}\nStudent Context: ${userProfile}` }
  ];

  let pedagogy;
  try {
    pedagogy = await callLLMWithRetry(messages, validatePedagogyResponse, 1, 1000);
  } catch (err) {
    if (err.message === 'OFFLINE_MODE') pedagogy = null;
  }

  if (!pedagogy) {
    console.warn('[Orchestrator] ⚠️ Maestro failed or Offline, using default generic pedagogy.');
    const fallback = {
      concept: topic,
      concept_type: 'abstract_concept',
      difficulty_level: 'intermediate',
      learning_intent: 'quick_overview',
      learning_goal: `Understand ${topic}`,
      predicted_pain_points: ["Abstract nature of the topic"],
      teaching_approach: 'visual_first',
      visualization_type: 'abstract',
      animation_style: 'slow_explanatory',
      final_steps: [
        {
          step_number: 1,
          explanation: `Let's explore ${topic} together.`,
          visual_hint: 'Show the main subject clearly.',
          concept_unit: 'Initial Hook',
          micro_clarification: 'We will take this one step at a time.',
          execution: {
            intensity: 'low',
            pacing: 'slow',
            interaction: 'guided'
          }
        }
      ]
    };
    fallback.steps = fallback.final_steps; // Backward compatibility for mapping
    return fallback;
  }

  pedagogy.final_steps = (pedagogy.steps || []).map(s => ({
    step_number: s.step_number,
    explanation: s.explanation,
    visual_hint: s.visual_hint,
    concept_unit: s.concept_unit,
    micro_clarification: s.micro_clarification,
    execution: {
      intensity: s.visualization_intensity || s.execution?.intensity || 'medium',
      pacing: s.pacing || s.execution?.pacing || 'slow',
      interaction: s.interaction_type || s.execution?.interaction || 'guided'
    }
  }));

  pedagogy.steps = pedagogy.final_steps; // Sync for Stage 2
  console.log('[Orchestrator] ✅ Orchestrator prepared final_steps package.');

  const validation = validatePedagogyResponse(pedagogy);
  if (validation.shouldRefine) {
    console.log(`[Orchestrator] 🔍 Self-Correction triggered. Issues: ${validation.issues.join(', ')}`);
    pedagogy = await refinePedagogy(pedagogy, topic, userProfile);
  }

  cache.set(topic, userProfile, pedagogy);
  return pedagogy;
}

export async function generateTimeline(sessionId, topic, onProgress = () => {}) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return { type: 'greeting', answer: "Hey there! 👋 I'm your visual tutor. Tell me any topic like 'Recursion' or 'Selection Sort' to see a visual lesson!" };
  }

  const domain = detectDomain(topic);
  console.log(`[Orchestrator] Topic: "${topic}" → Domain: ${domain}`);

  try {
    // Step 1: Generate Curriculum (Maestro)
    onProgress('Step 1/2: The Maestro is composing your lesson...');
    const userProfile = `Target Complexity = ${session.complexityPreference}, Confusion Level = ${session.confusionIndex}/10`;
    const pedagogy = await generatePedagogy(topic, userProfile);
    await new Promise(r => setTimeout(r, 1000));

    // Step 2: Generate Timeline & Animations
    onProgress('Step 2/2: Generating final visual timeline...');
    const animationGuide = getAnimationGuide(domain);
    const nodeTemplates = getNodeTemplates(domain);
    
    const systemPrompt = buildTimelinePrompt({
      topic,
      domain,
      nodeTemplates,
      animationGuide,
      plan: pedagogy,
      behavior: { steps: pedagogy.final_steps },
      execution: { execution_plan: pedagogy.final_steps?.map(s => ({ ...s.execution, step_number: s.step_number })) },
      reflection: pedagogy.reflection_result || { status: 'good', issues: [] },
      difficulty: pedagogy.difficulty_level || 'intermediate'
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildTeachingPrompt(topic) }
    ];

    let data;
    try {
      data = await callLLMWithRetry(messages, validateTimeline, 1, getTokenBudget());
    } catch (err) {
      if (err.message === 'OFFLINE_MODE') {
        console.warn(`[Orchestrator] APIs exhausted. Enabling Offline Intelligence Mode for: "${topic}".`);
        const offlineData = { ...FALLBACK_TIMELINE };
        offlineData.title = `Understanding ${topic}`;
        offlineData.professorNote = `Note: Real-time AI is offline. I have generated this structural overview of "${topic}" using local intelligence rules.`;
        return processTimeline(offlineData, domain, topic);
      }
      throw err;
    }

    if (!data) {
      console.warn(`[Orchestrator] AI failed to generate timeline for: "${topic}". Using high-quality fallback.`);
      const fallback = { ...FALLBACK_TIMELINE };
      fallback.title = `Understanding ${topic}`;
      fallback.professorNote = `Note: The AI agent returned incomplete data. Showing standard visual overview.`;
      return processTimeline(fallback, domain, topic);
    }

    const processed = processTimeline(data, domain, topic);
    processed.domain = processed.domain || domain;
    processed.mode = processed.mode || 'explain';

    sessionStore.setTimeline(sessionId, processed);
    return processed;

  } catch (err) {
    console.error('[Orchestrator] Fatal Error during 5-stage pipeline:', err.message);
    // Absolute safety fallback
    const safety = { ...FALLBACK_TIMELINE };
    safety.title = `Lesson: ${topic}`;
    safety.chatMessage = "I encountered a minor issue with the AI provider, so I have optimized this lesson with our fast-track pedagogical logic.";
    return processTimeline(safety, domain, topic);
  }
}

export async function generateTextResponse(sessionId, promptStr) {
  try {
    const model = getModel();
    const completion = await requestCompletion({
      model,
      messages: [
        { role: 'system', content: 'You are TutorBoard, a helpful tutor.' },
        { role: 'user', content: promptStr }
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const answer = completion.content || "I'm here to help!";
    return { type: 'greeting', answer };
  } catch (err) {
    console.error('[Orchestrator] Text error:', err);
    return { type: 'greeting', answer: `I'm currently unable to access the full AI reasoning engine, but I can still help you visualize topics! Try typing something like 'Visualize Selection Sort'. (Error: ${err.message})` };
  }
}

export async function handleDoubt(sessionId, question) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const systemPrompt = buildDoubtPrompt({
    topic: session.topic || '',
    domain: session.timeline?.domain || 'general',
    currentFrames: (session.steps && session.steps[session.currentStepIndex]?.objectIds) || [],
    priorDoubts: (session.doubts || []).slice(-3).map(d => ({ 
      question: d.question, 
      answer: d.response 
    })),
  });

  const messages = [
    { role: 'system', content: systemPrompt },
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
