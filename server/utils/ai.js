import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

let aiClient = null;

/**
 * Lazy-load the AI client to ensure environment variables are loaded
 * before instantiation (fixes ESM hoisting issues).
 */
// Constants for self-healing initialization
let aiClientInstance = null;
let lastUsedApiKey = null;

/**
 * Robust AI Client Getter
 * Handles ESM hoisting and ensures the client is re-initialized if a missing 
 * key is later provided in .env (self-healing).
 */
export const getAIClient = () => {
  // Re-run dotenv config as a failsafe
  dotenv.config();
  
  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;

  // If we already have a client with this EXACT key, return it
  if (aiClientInstance && lastUsedApiKey === apiKey) {
    return aiClientInstance;
  }

  // Otherwise, create/re-create the client
  if (!apiKey || apiKey === 'missing-key') {
    console.warn("⚠️ [AI] API Key missing from .env. Retrying initialization...");
  }

  aiClientInstance = new OpenAI({
    apiKey: apiKey || 'missing-key',
    baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
    defaultHeaders: isOpenRouter ? {
      "HTTP-Referer": "https://tutorboard.app",
      "X-Title": "TutorBoard",
    } : undefined,
  });

  lastUsedApiKey = apiKey;
  console.log(`[AI] Client initialized (${isOpenRouter ? 'OpenRouter' : 'OpenAI'}) ✅`);
  return aiClientInstance;
};

export const getModel = () => {
  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
  if (isOpenRouter) {
    // OpenRouter slug: openai/gpt-4o-mini (highly cost effective for large prompts)
    return "openai/gpt-4o-mini"; 
  }
  return "gpt-4o-mini";
};

