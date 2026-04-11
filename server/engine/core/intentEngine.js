/**
 * intentEngine.js
 * v2.0 — AGENTIC CLASSIFICATION
 * Moves from regex-based intent detection to a structured LLM call.
 */

import { requestCompletion, getTextModel } from '../utils/llmClient.js';

/**
 * Detects user intent and preferred renderer using a cheap, fast LLM call.
 */
export async function detectIntent(prompt, explicitMode) {
  // 1. Explicit UI Mode always wins (for manual triggers)
  if (explicitMode && ['quick', 'deep', 'test_me'].includes(explicitMode)) {
    return {
      intent: explicitMode,
      renderer: explicitMode === 'deep' ? 'cinematic' : 'none',
      confidence: 1.0
    };
  }

  // 2. Request LLM Classification
  try {
    const res = await requestCompletion({
      model: 'openai/gpt-4o-mini', // Fast, cheap, high-reliability for JSON
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
          content: prompt
        }
      ],
      temperature: 0,
      responseSchema: true // Triggers JSON mode
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
    // Minimal regex fallback
    const isDeep = /\b(visualize|draw|animate|diagram|timeline|deep)\b/i.test(prompt);
    return {
      intent: isDeep ? 'deep' : 'quick',
      renderer: 'cinematic',
      confidence: 0.1
    };
  }
}
