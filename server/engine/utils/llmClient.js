/**
 * LLM Client — Pure OpenRouter Implementation
 * 
 * DESIGN:
 *   1. 100% OpenRouter only. No direct Google SDK.
 *   2. Support for OpenAI-compatible JSON mode.
 *   3. High-reliability model defaults.
 */


import OpenAI from 'openai';
import { circuitBreaker } from '../core/circuitBreaker.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

// OpenRouter processes standard OpenAI calls
let openRouterClient = null;

const initClients = () => {
  if (!openRouterClient && process.env.OPENROUTER_API_KEY) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://tutorboard.app',
        'X-Title': 'TutorBoard',
      }
    });
    console.log('[AI] Pure OpenRouter Engine Initialized ✅');
  }
};


/**
 * Helper to map UI-friendly model IDs to actual API slugs
 */
function resolveModelId(modelId) {
  if (!modelId || modelId === 'OpenRouter' || modelId === 'OpenRouterAI') {
    return getModel();
  }
  
  const mapping = {
    'Bytez': 'anthropic/claude-opus-4-5',
    'Bytez (Opus)': 'anthropic/claude-opus-4-5'
  };

  return mapping[modelId] || modelId;
}

/**
 * Robust LLM Call — Dedicated OpenRouter Dispatcher
 */
export async function requestCompletion({ model, messages, temperature, maxTokens, tools, responseSchema, responseMimeType }) {
  initClients();

  const orModel = resolveModelId(model);

  if (!openRouterClient) {
    throw new Error('NO_API_AVAILABLE: OpenRouter client not initialized. Check .env');
  }

  if (!circuitBreaker.isAvailable('openrouter')) {
    throw new Error('SERVICE_UNAVAILABLE: OpenRouter circuit is open.');
  }

  try {
    // Preparation for JSON mode if requested
    const isJson = responseMimeType === 'application/json' || !!responseSchema;
    
    let response_format;
    if (responseSchema) {
      response_format = {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          strict: false,
          schema: zodToJsonSchema(responseSchema, "root").definitions?.root || zodToJsonSchema(responseSchema)
        }
      };
    } else if (isJson) {
      response_format = { type: "json_object" };
    }
    
    console.log(`[AI:OpenRouter] Calling: ${orModel} (Structured: ${!!responseSchema}, JSON: ${isJson})`);

    const completion = await openRouterClient.chat.completions.create({
      model: orModel,
      messages,
      temperature: temperature ?? 0.1,
      max_tokens: maxTokens ?? 1000,
      tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
      response_format
    });

    circuitBreaker.reportSuccess('openrouter');
    const msg = completion.choices?.[0]?.message;

    return {
      content: msg?.content || '',
      finishReason: completion.choices?.[0]?.finish_reason || 'stop',
      provider: 'openrouter',
      tool_calls: msg?.tool_calls || null
    };
  } catch (err) {
    const isCredits = err.message.includes('402');
    const orStatus = isCredits ? 402 : (err.status || 500);
    console.error(`[AI:OpenRouter] Error: ${err.message}`);
    
    circuitBreaker.reportFailure('openrouter', orStatus);
    
    const customErr = new Error('OpenRouter Fail: ' + err.message);
    customErr.status = orStatus;
    throw customErr;
  }
}

/**
 * Get primary model identifier for deep pedagogical generation.
 * Defaulting to Claude 3.5 Sonnet via OpenRouter for maximum logic reliability.
 */
export const getModel = () => {
  return process.env.AI_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
};

/**
 * Get text-only model identifier
 */
export const getTextModel = () => {
  return process.env.AI_TEXT_MODEL || 'anthropic/claude-3.5-sonnet';
};

/**
 * BUG FIX #50: Get model identifier for a user-selected agent
 * Returns null if agent is not recognized (falls back to default)
 */
export const getModelForAgent = (agent) => {
  if (!agent) return null;
  
  const mapping = {
    'Bytez': 'anthropic/claude-opus-4-5',
    'Bytez (Opus)': 'anthropic/claude-opus-4-5',
    'OpenRouter': getModel(),
    'OpenRouterAI': getModel(),
  };

  return mapping[agent] || null;
};

// Legacy support
export const getAIClient = () => {
  initClients();
  return openRouterClient;
};

// Direct Anthropic path removed — transitioning to pure OpenRouter orchestration


/**
 * Get vector embeddings for a string.
 * Target model: openai/text-embedding-3-small
 */
export async function getEmbeddings(text) {
  initClients();
  
  if (!openRouterClient) {
    throw new Error('NO_API_AVAILABLE: OpenAI/OpenRouter client not initialized.');
  }

  try {
    const response = await openRouterClient.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error(`[AI:Embeddings] Error: ${err.message}`);
    return null;
  }
}
