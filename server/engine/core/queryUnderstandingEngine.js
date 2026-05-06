/**
 * queryUnderstandingEngine.js
 * v1.0 — Deep Intent Analysis
 * 
 * Replaces the shallow intent classification with a comprehensive LLM call
 * that understands educational intent, visualization necessity, interaction depth,
 * teaching mode, and the user's underlying learning objective.
 */

import { requestCompletion, getTextModel, getModelForAgent } from '../../utils/ai/llmClient.js';
import { sanitizeTopicForPrompt } from '../../utils/validation/topicValidator.js';

const cache = new Map();
const CACHE_LIMIT = 100;
const CACHE_TTL = 10 * 60 * 1000;

function getCacheEntry(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEntry(key, value) {
  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, timestamp: Date.now() });
}

const SYSTEM_PROMPT = `You are the QueryUnderstandingEngine for TutorBoard, an AI learning system.
Analyze the user's query deeply to determine their educational intent, not just a simple classification.

You must return a JSON object containing the following keys:
- "educational_intent": string describing what the user actually wants to learn or do (e.g., "understand recursion concepts", "debug a sorting algorithm").
- "visualization_necessity": string enum ("none", "optional", "highly_recommended", "required") indicating if visual aids would significantly help.
- "interaction_depth": string enum ("passive", "interactive", "collaborative"). Passive = just reading, interactive = clicking/stepping through, collaborative = writing code/sandbox.
- "teaching_mode": string enum ("explain", "visualize", "simulate", "immersive", "whiteboard", "coding", "interview", "quiz"). Pick the best fit.
- "user_learning_objective": string describing the ultimate goal of the user for this interaction.
- "renderer": suggested renderer enum ("none", "cinematic", "physics", "narrative", "d3", "matter", "katex", "three", "programming", "simulator"). Use "none" if visualization_necessity is "none".
- "confidence": number from 0.0 to 1.0 indicating your confidence in this analysis.

Return ONLY the raw JSON object. Do not include markdown code blocks (\`\`\`json).`;

export async function understandQuery(prompt, selectedAgent, userConfig) {
  const sanitizedPrompt = sanitizeTopicForPrompt(prompt);

  const cacheKey = `${sanitizedPrompt}|${selectedAgent}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    console.log(`[QueryUnderstandingEngine] ⚡ Cache hit for: ${sanitizedPrompt}`);
    return cached;
  }

  try {
    let modelToUse = getTextModel();
    if (selectedAgent) {
      const agentModel = getModelForAgent(selectedAgent);
      if (agentModel) {
        modelToUse = agentModel;
      }
    }

    const res = await requestCompletion({
      model: modelToUse,
      userConfig,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: sanitizedPrompt }
      ],
      temperature: 0,
      responseMimeType: 'application/json'
    });

    const raw = res.content || '{}';
    let jsonStr = raw.replace(/```json|```/g, '').trim();
    
    // Attempt to extract JSON from markdown or chatty responses
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    let result = {};
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn(`[QueryUnderstandingEngine] ⚠️ Strict JSON parse failed, returning empty object: ${parseErr.message}`);
    }
    
    console.log(`[QueryUnderstandingEngine] 🧠 Analyzed: Mode=${result.teaching_mode}, Visual=${result.visualization_necessity}, Confidence=${result.confidence}`);
    
    const finalResult = {
      educational_intent: result.educational_intent || 'general inquiry',
      visualization_necessity: result.visualization_necessity || 'none',
      interaction_depth: result.interaction_depth || 'passive',
      teaching_mode: result.teaching_mode || 'explain',
      user_learning_objective: result.user_learning_objective || 'learn',
      renderer: result.renderer || 'none',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5
    };
    
    setCacheEntry(cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    console.error(`[QueryUnderstandingEngine] ⚠️ LLM Classification failed, falling back: ${err.message}`);
    
    // Minimal fallback
    const isDeep = /\b(visualize|draw|animate|diagram|timeline|deep|explain|how|why)\b/i.test(prompt);
    return {
      educational_intent: 'fallback',
      visualization_necessity: isDeep ? 'optional' : 'none',
      interaction_depth: 'passive',
      teaching_mode: isDeep ? 'visualize' : 'explain',
      user_learning_objective: 'fallback objective',
      renderer: isDeep ? 'cinematic' : 'none',
      confidence: 0.1
    };
  }
}
