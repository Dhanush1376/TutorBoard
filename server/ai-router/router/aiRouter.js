import { AI_CONFIG } from '../config/providers.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { resolveModel } from '../../utils/ai/modelResolver.js';

// Provider Imports
import * as gemini from '../providers/gemini.js';
import * as groq from '../providers/groq.js';
import * as openrouter from '../providers/openrouter.js';

const providers = { gemini, groq, openrouter };


/**
 * Intelligent AI Router with fallback logic
 */
export async function routeRequest(query, options = {}) {
  const { 
    priority = AI_CONFIG.priority, 
    timeout = AI_CONFIG.timeout,
    maxRetries = AI_CONFIG.maxRetries
  } = options;

  logger.info(`Routing query: "${query.substring(0, 50)}..."`, { priority });

  const prompt = `
    You are an AI Tutor for TutorBoard.
    Topic: ${query}

    Generate a structured lesson in EXACTLY this JSON format:
    {
      "steps": ["Step 1", "Step 2", "Step 3"],
      "explanation": "A deep pedagogical explanation of the topic.",
      "visualization": ["Description of what to draw on canvas", "Animation instructions"]
    }

    Respond ONLY with the JSON object.
  `;

  // Dynamic Routing Logic: If it's a coding query, prioritize Groq
  let activePriority = [...priority];
  if (query.toLowerCase().includes('code') || query.toLowerCase().includes('function') || query.toLowerCase().includes('loop')) {
    logger.info("Coding intent detected. Prioritizing Groq.");
    activePriority = ["groq", ...priority.filter(p => p !== "groq")];
  }

  let fallbackUsed = false;

  // Iterate through priority list
  for (const providerKey of activePriority) {
    const provider = providers[providerKey];
    
    if (!provider || !AI_CONFIG.providers[providerKey]?.enabled) {
      logger.warn(`Provider ${providerKey} is disabled or missing. Skipping.`);
      fallbackUsed = true;
      continue;
    }

    const startTime = Date.now();
    try {
      logger.info(`Attempting ${providerKey}...`);
      
      const response = await withRetry(
        (signal) => provider.generateResponse(prompt, signal),
        providerKey,
        maxRetries,
        timeout
      );

      const latency = Date.now() - startTime;
      const { model } = resolveModel(providerKey, null, false);

      logger.info(`Successfully received response from ${providerKey}`);
      return {
        ...response,
        provider: providerKey,
        model: model,
        status: fallbackUsed ? 'fallback' : 'success',
        latency: `${latency}ms`,
        fallbackUsed,
        suggestions: [],
        message: 'Successfully generated response'
      };

    } catch (err) {
      logger.error(`${providerKey} failed all attempts. Trying next fallback...`, err);
      fallbackUsed = true;
    }
  }

  // All providers failed
  throw new Error("CRITICAL_FAILURE: All AI providers failed to generate a response.");
}
