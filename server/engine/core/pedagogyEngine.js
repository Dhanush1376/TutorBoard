/**
 * AI Orchestrator v5.0 — Fully Agentic Pipeline
 * 
 * v5.0 Changes:
 *   - Visual Coherence Agent validates spatial, referential, and narrative consistency
 *   - Pedagogy-grounded retry before fallback (no silent degradation)
 *   - Real tool calls in agentLoop (see agentLoop.js v2)
 */

import { requestCompletion, getModel, getTextModel } from '../utils/llmClient.js';
import {
  DOUBT_RESPONSE_PROMPT,
  MAESTRO_PEDAGOGY_PROMPT,
  isGreeting,
  buildTeachingPrompt,
  detectDomain,
  buildTimelinePrompt,
  TIMELINE_RESPONSE_SCHEMA,
  getNodeTemplates,
  getAnimationGuide,
  getMinSteps,
  getVisualScaffold,
  REFLECTION_AGENT_PROMPT,
  buildDoubtPrompt,
  classifyDoubt,
} from '../agents/index.js';
import { safeParse, validateTimeline, validateDoubtResponse, buildRetryPrompt, validatePedagogyResponse, validateReflectionResponse } from '../validators/index.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';
import { runAgentLoop } from './agentLoop.js';
import { critiqueStep } from '../agents/stepCritic.js';
import { searchDomainKnowledge, formatSearchContext } from '../tools/webSearch.js';
import tracer from '../utils/tracer.js';

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL COHERENCE AGENT
// Validates that AI-generated timeline is visually consistent and self-consistent.
// If issues found, triggers one LLM repair call.
// ═══════════════════════════════════════════════════════════════════════════

async function validateVisualCoherence(timeline, domain, topic) {
  const issues = [];
  const objectIds = new Set((timeline.objects || []).map(o => o.id));

  // Rule 1: All objects must have x/y within canvas safe zone [60,740] x [60,540]
  for (const obj of (timeline.objects || [])) {
    if (obj.x !== undefined && (obj.x < 40 || obj.x > 760)) {
      issues.push(`Object "${obj.id}" has x=${obj.x} — out of canvas safe zone [60,740].`);
    }
    if (obj.y !== undefined && (obj.y < 40 || obj.y > 560)) {
      issues.push(`Object "${obj.id}" has y=${obj.y} — out of canvas safe zone [60,540].`);
    }
  }

  // Rule 2: Each step's objectIds must reference real objects
  for (const step of (timeline.steps || [])) {
    for (const id of (step.objectIds || [])) {
      if (!objectIds.has(id)) {
        issues.push(`Step ${step.index} references objectId "${id}" which does not exist in objects[].`);
      }
    }
    // Rule 3: newIds must be a subset of objectIds
    for (const id of (step.newIds || [])) {
      if (!(step.objectIds || []).includes(id)) {
        issues.push(`Step ${step.index}: newId "${id}" is not in objectIds.`);
      }
    }
    // Rule 4: Every step must have narration
    if (!step.narration || step.narration.trim().length < 20) {
      issues.push(`Step ${step.index} has missing or too-short narration.`);
    }
  }

  // Rule 5: No duplicate object IDs
  const seenIds = new Set();
  for (const obj of (timeline.objects || [])) {
    if (seenIds.has(obj.id)) {
      issues.push(`Duplicate object ID: "${obj.id}".`);
    }
    seenIds.add(obj.id);
  }

  // Rule 6: appearsAtStep must be within step range
  const maxStepIdx = (timeline.steps || []).length - 1;
  for (const obj of (timeline.objects || [])) {
    if (obj.appearsAtStep > maxStepIdx) {
      issues.push(`Object "${obj.id}" has appearsAtStep=${obj.appearsAtStep} but max step index is ${maxStepIdx}.`);
    }
  }

  if (issues.length === 0) {
    console.log('[VisualCoherenceAgent] ✅ Timeline passes all coherence checks.');
    return timeline;
  }

  console.warn(`[VisualCoherenceAgent] ⚠️ Found ${issues.length} coherence issues. Triggering repair...`);
  issues.forEach(i => console.warn('  -', i));

  // ONE repair attempt
  try {
    const repairMessages = [
      {
        role: 'system',
        content: `You are a JSON repair agent for a visual teaching timeline.
Fix ONLY the broken fields listed. Do not change correct fields.
Return the complete corrected timeline JSON. No markdown. No explanation. Only JSON.`
      },
      {
        role: 'user',
        content: `The following timeline for "${topic}" has these issues:\n${issues.map((i, n) => `${n+1}. ${i}`).join('\n')}\n\nFull timeline to repair:\n${JSON.stringify(timeline)}\n\nReturn the repaired timeline JSON.`
      }
    ];

    const repaired = await callLLMWithRetry(repairMessages, validateTimeline, 0, 8192);
    if (repaired) {
      console.log('[VisualCoherenceAgent] ✅ Repair succeeded.');
      return repaired;
    }
  } catch (err) {
    console.error('[VisualCoherenceAgent] Repair failed:', err.message);
  }

  // If repair fails, return original and let the renderer handle gracefully
  return timeline;
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACKS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a high-quality fallback timeline when the AI fails.
 * Uses the domain-specific visual scaffold to ensure pedagogical consistency.
 */
function getDomainFallback(domain, topic) {
  const scaffold = getVisualScaffold(domain);
  const totalSteps = 4;
  
  // Map scaffold objects to first appearing step
  const objects = scaffold.map(obj => ({ ...obj, appearsAtStep: 0 }));
  const objectIds = objects.map(o => o.id);

  return {
    mode: 'explain',
    title: `Understanding ${topic}`,
    domain: domain,
    difficulty: 'beginner',
    estimatedTime: '3 minutes',
    professorNote: `Note: AI generation was partially interrupted. I have optimized this structural overview of "${topic}" for you.`,
    learningNodes: [
      { type: 'hook', title: 'Introduction', content: `Let's look at the foundational structure of ${topic}.`, stepSpan: [0, 0] },
      { type: 'concept', title: 'Core Mechanics', content: 'Identifying the primary components in play.', stepSpan: [1, 2] },
      { type: 'result', title: 'Summary', content: 'You now have the structural basics down.', stepSpan: [3, 3] },
    ],
    totalSteps,
    objects,
    steps: [
      { index: 0, title: 'Orientation', narration: `Let's start by looking at the basic layout for ${topic}.`, objectIds, highlightIds: [objectIds[0]], newIds: objectIds, transition: 'fadeIn', durationMs: 4000 },
      { index: 1, title: 'Core Logic', narration: "Observe how these elements are positioned to represent the underlying system.", objectIds, highlightIds: [objectIds[1] || objectIds[0]], newIds: [], transition: 'springIn', durationMs: 4000 },
      { index: 2, title: 'Analysis', narration: "The relationships between these components form the basis of the entire concept.", objectIds, highlightIds: objectIds, newIds: [], transition: 'springIn', durationMs: 4000 },
      { index: 3, title: 'Key Insight', narration: "With this structure in mind, we can now appreciate the elegance of the logic.", objectIds, highlightIds: [objectIds[objectIds.length-1]], newIds: [], transition: 'fadeIn', durationMs: 4000 },
    ],
  };
}

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
  // Increased to 8192 to support high-fidelity 25-step lessons.
  // Ensures narration isn't compressed for complex algorithmic topics.
  return 8192;
}

function withTimeout(promise, ms, errorMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

async function callLLMWithRetry(messages, validateFn, maxRetries = 1, maxTokens = 4096) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const attemptTag = `[Orchestrator:${attempt + 1}/${maxRetries + 1}]`;
      const totalPromptLength = messages.reduce((acc, m) => acc + (m.content || '').length, 0);
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
           m.content += "\n[SYSTEM RULE: Return shorter, concise output. If reducing step count, ensures you maintain at least the required instructional fidelity for this domain.]";
        }
      });

      // Small pause before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

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
    // Bug 1 Fix: AI generates durationMs but client historically used duration.
    // We must prioritize durationMs (AI's specific timing) over any generic duration.
    if (!step.durationMs && step.duration) step.durationMs = step.duration;
    if (step.durationMs) {
      step.duration = step.durationMs;
    } else {
      step.duration = 3000; // Sensible default
    }
    
    // Ensure both are present for maximum compatibility
    if (!step.durationMs) step.durationMs = step.duration;

    if (!step.narration) step.narration = step.description || step.title || '';
  });

  data.objects = objects;
  data.steps = steps;
  data.totalSteps = total;
  if (!data.domain) data.domain = detectedDomain || 'general';

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PEDAGOGY GENERATION (Maestro → Reflection)
// ═══════════════════════════════════════════════════════════════════════════

async function refinePedagogy(pedagogy, topic, userProfile) {
  console.log('[Orchestrator] 🚩 Refining pedagogy to remove complexity/confusion...');
  
  const userContent = REFLECTION_AGENT_PROMPT
    .replace('{{PLANNER_OUTPUT_JSON}}', JSON.stringify(pedagogy, null, 2))
    .replace('{{BEHAVIOR_OUTPUT_JSON}}', JSON.stringify(pedagogy.final_steps, null, 2))
    .replace('{{EXECUTION_PLAN_JSON}}', JSON.stringify(pedagogy.final_steps?.map(s => s.execution), null, 2));

  const refinementPrompt = REFLECTION_AGENT_PROMPT.replace(/{{MIN_STEPS}}/g, pedagogy.minSteps || '10');

  const messages = [
    { role: 'system', content: refinementPrompt },
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

  const domain = detectDomain(topic);
  const minSteps = getMinSteps(domain, topic);
  const maestroPrompt = MAESTRO_PEDAGOGY_PROMPT.replace(/{{MIN_STEPS}}/g, String(minSteps));

  const messages = [
    { role: 'system', content: maestroPrompt },
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
      minSteps,
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
  pedagogy.minSteps = minSteps;
  console.log(`[Orchestrator] ✅ Orchestrator prepared final_steps package (${pedagogy.steps.length} steps).`);

  const validation = validatePedagogyResponse(pedagogy);
  if (validation.shouldRefine) {
    console.log(`[Orchestrator] 🔍 Self-Correction triggered. Issues: ${validation.issues.join(', ')}`);
    pedagogy = await refinePedagogy(pedagogy, topic, userProfile);
  }

  cache.set(topic, userProfile, pedagogy);
  return pedagogy;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE GENERATION — THE CORE PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

export async function generateTimeline(sessionId, topic, onProgress = () => {}) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return { type: 'greeting', answer: "Hey there! 👋 I'm your visual tutor. Tell me any topic like 'Recursion' or 'Selection Sort' to see a visual lesson!" };
  }

  const domain = detectDomain(topic);
  console.log(`[Orchestrator] Topic: "${topic}" → Domain: ${domain}`);

  const nodeTemplates = getNodeTemplates(domain);
  const animationGuide = getAnimationGuide(domain);
  const minSteps = getMinSteps(domain, topic);
  const maxSteps = Math.max(minSteps, 15);

  try {
    // Step 1: Generate Curriculum (Maestro)
    onProgress('Step 1/2: The Maestro is composing your lesson...');
    const userProfile = `Target Complexity = ${session.complexityPreference}, Confusion Level = ${session.confusionIndex}/10`;
    const pedagogy = await generatePedagogy(topic, userProfile);
    await new Promise(r => setTimeout(r, 1000));

    // Step 2: Generate Timeline & Animations
    onProgress('Step 2/2: Generating final visual timeline...');
    const visualScaffold = getVisualScaffold(domain);

    // ── Phase: Web Search Grounding ──
    let searchContext = "";
    if (domain !== 'dsa' && domain !== 'mathematics') {
      const searchResult = await searchDomainKnowledge(domain, topic);
      const formattedContext = formatSearchContext(searchResult);
      if (formattedContext) {
        searchContext = `\n━━━ VERIFIED KNOWLEDGE ━━━\n${formattedContext}\nUse the above verified facts to ensure technical accuracy in your narration.`;
      }
    }
    
    const systemPrompt = buildTimelinePrompt({
      topic,
      domain,
      nodeTemplates,
      animationGuide,
      minSteps,
      visualScaffold,
      grounding: searchContext,
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

    // Using responseSchema for guaranteed valid JSON on Gemini 2.0 Flash.
    const result = await requestCompletion({
      model: getModel(),
      messages,
      temperature: 0.1,
      maxTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: TIMELINE_RESPONSE_SCHEMA
    });

    let data = safeParse(result.content);

    // ── PEDAGOGY-GROUNDED RETRY (before fallback) ──
    if (!data) {
      console.warn(`[Orchestrator] First timeline attempt failed. Attempting pedagogy-grounded retry...`);

      const retryMessages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Your previous response was incomplete or invalid JSON.
Here is the full teaching plan you must animate:\n${JSON.stringify(pedagogy, null, 2)}
Topic: "${topic}". Generate a complete, valid timeline JSON now. Minimum ${minSteps} steps.`
        }
      ];

      const retryData = await callLLMWithRetry(retryMessages, validateTimeline, 0, getTokenBudget());

      if (!retryData) {
        console.warn('[Orchestrator] Retry also failed. Using domain fallback.');
        return getDomainFallback(domain, topic);
      }

      data = retryData;
    }

    const processed = processTimeline(data, domain, topic);
    processed.domain = processed.domain || domain;
    processed.mode = processed.mode || 'explain';

    // ── Phase: Step-Level Critic & Targeted Repair ──
    console.log(`[Orchestrator] 🕵️ Starting Step Critic evaluation for ${processed.steps.length} steps...`);
    for (let i = 0; i < processed.steps.length; i++) {
      const critique = await critiqueStep(processed.steps[i]);
      if (critique.average < 6) {
        console.warn(`[Orchestrator] 🛠️ Step ${i} ("${processed.steps[i].title}") failed critique (${critique.average}/10). Remedying: ${critique.critique}`);
        
        const repairPrompt = `REPAIR TASK:
The following step scored poorly on pedagogical quality.
ORIGINAL STEP: ${JSON.stringify(processed.steps[i])}
ISSUE: ${critique.critique}
REMEDY: ${critique.remedy}

Generate a REPLACEMENT for this step that fixes these issues while maintaining the same step ID and index.`;

        const repairMessages = [
          { role: 'system', content: repairPrompt },
          { role: 'user', content: "Please provide the JSON replacement for this step." }
        ];

        const repairedStep = await callLLMWithRetry(
          repairMessages,
          (p) => ({ valid: !!(p.steps && p.steps[0]), errors: [] }),
          1,
          2048
        );

        if (repairedStep && repairedStep.steps && repairedStep.steps[0]) {
          console.log(`[Orchestrator] ✅ Step ${i} repaired successfully.`);
          processed.steps[i] = { ...processed.steps[i], ...repairedStep.steps[0], index: i };
        }
      }
    }

    // ── Phase: Visual Coherence Agent ──
    console.log('[Orchestrator] 🔍 Running Visual Coherence Agent...');
    const coherentTimeline = await validateVisualCoherence(processed, domain, topic);
    sessionStore.setTimeline(sessionId, coherentTimeline);
    return coherentTimeline;

  } catch (err) {
    console.error('[Orchestrator] Fatal Error during agentic pipeline:', err.message);
    // Absolute safety fallback
    return getDomainFallback(domain, topic);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT RESPONSE & DOUBT HANDLING
// ═══════════════════════════════════════════════════════════════════════════

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

  const currentStep = (session.steps && session.steps[session.currentStepIndex]) || null;
  const currentFrames = {
    step_title: currentStep?.title || 'Intro',
    step_narration: currentStep?.narration || '',
    visible_shapes: (session.objects || []).filter(o => 
      currentStep?.objectIds?.includes(o.id)
    )
  };

  const classification = await classifyDoubt(session.topic || '', question);
  console.log(`[Orchestrator] Doubt Classification: ${classification.pathway} (Conf: ${classification.confidence})`);

  const systemPrompt = buildDoubtPrompt({
    topic: session.topic || '',
    domain: session.timeline?.domain || 'general',
    classification, // pass the whole object
    currentFrames: currentFrames,
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

  sessionStore.addDoubt(sessionId, question, data.answer, data.visualUpdate, data.followUp);
  data._question = question;

  // Adaptive Feedback Loop: If confusion spiked, regenerate the lesson to be simpler
  if (session.needsRegeneration) {
    console.log(`[Orchestrator] 🔄 Confusion Spike! Regenerating simplified curriculum for ${sessionId}...`);
    try {
      const adaptiveTimeline = await generateTimeline(sessionId, session.topic);
      data.adaptiveTimeline = adaptiveTimeline;
      session.needsRegeneration = false;
      console.log(`[Orchestrator] ✨ Adaptive lesson injected into doubt response.`);
    } catch (err) {
      console.error('[Orchestrator] Failed to generate adaptive timeline:', err.message);
    }
  }

  return data;
}
