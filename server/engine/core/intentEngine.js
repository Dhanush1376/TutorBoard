/**
 * intentEngine.js
 * v2.0 — AGENTIC CLASSIFICATION
 * Moves from regex-based intent detection to a structured LLM call.
 * 
 * BUG FIX #50: Now respects user's selectedAgent when performing intent classification
 * BUG FIX #56: Now validates topics for prompt injection attempts
 */

import { requestCompletion, getTextModel, getModelForAgent } from '../../utils/ai/llmClient.js';
import { sanitizeTopicForPrompt } from '../../utils/validation/topicValidator.js';

/**
 * Detects user intent and preferred renderer using a cheap, fast LLM call.
 * 
 * BUG FIX #50: Now accepts selectedAgent parameter and uses appropriate model
 * BUG FIX #56: Sanitizes prompt to prevent injection attacks
 */
export async function detectIntent(prompt, explicitMode, selectedAgent, userConfig) {
  // 1. Explicit UI Mode always wins (for manual triggers)
  if (explicitMode && ['quick', 'deep', 'test_me'].includes(explicitMode)) {
    return {
      intent: explicitMode,
      renderer: explicitMode === 'deep' ? 'cinematic' : 'none',
      confidence: 1.0
    };
  }

  // BUG FIX #56: Sanitize prompt to prevent JSON-level prompt injection
  const sanitizedPrompt = sanitizeTopicForPrompt(prompt);

  // 2. Request LLM Classification
  try {
    // BUG FIX #50: Use user's selected agent model instead of hardcoded default
    let modelToUse = getTextModel();
    if (selectedAgent) {
      const agentModel = getModelForAgent(selectedAgent);
      if (agentModel) {
        modelToUse = agentModel;
        console.log(`[IntentEngine] Using selected agent model: ${modelToUse}`);
      }
    }

    const res = await requestCompletion({
      model: modelToUse,
      userConfig,
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for TutorBoard, an AI learning system.
Classify the user prompt into one of these intents:
- deep: The user wants a visualization, animation, diagram, or deep conceptual explanation.
- quick: The user wants a fast text answer, summary, or simple fact.
- test_me: The user wants to be quizzed or assessed.

Also suggest a renderer if the intent is 'deep':
- cinematic: For general abstract concepts, science, or logic.
- physics: For mechanical systems, orbits, pendulums, or force-based systems.
- narrative: For history, timelines, story-driven logic, or sequential events.

Return ONLY a JSON object:
{ "intent": "deep"|"quick"|"test_me", "renderer": "cinematic"|"physics"|"narrative", "confidence": 0-1 }`
        },
        {
          role: 'user',
          content: sanitizedPrompt
        }
      ],
      temperature: 0,
      responseMimeType: 'application/json'
    });


    const raw = (res.content || '{}').replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    console.log(`[IntentEngine] 🧠 Classified: ${result.intent} (${result.renderer}) | Conf: ${result.confidence}`);
    return {
      intent: result.intent || 'quick',
      renderer: result.renderer || 'cinematic',
      confidence: result.confidence || 0.5
    };
  } catch (err) {
    console.error(`[IntentEngine] ⚠️ LLM Classification failed, falling back to regex: ${err.message}`);
    if (err.name === 'SyntaxError') {
      console.warn(`[IntentEngine] RAW RESPONSE PREVIEW: ${res?.content?.substring(0, 500)}`);
    }
    // Minimal regex fallback
    const isDeep = /\b(visualize|draw|animate|diagram|timeline|deep)\b/i.test(prompt);
    return {
      intent: isDeep ? 'deep' : 'quick',
      renderer: 'cinematic',
      confidence: 0.1
    };
  }
}
