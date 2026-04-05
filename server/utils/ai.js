import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Cache instances to avoid redundant initialization
const clients = {
  openrouter: null
};

const keys = {
  openrouter: null
};

/**
 * Robust AI Client Getter — OpenRouter Only
 */
export const getAIClient = () => {
  dotenv.config();

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('[AI] ❌ FATAL: OPENROUTER_API_KEY is not set in .env file!');
  }

  if (clients.openrouter && keys.openrouter === apiKey) return clients.openrouter;

  clients.openrouter = new OpenAI({
    apiKey: apiKey || 'missing-key',
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://tutorboard.app",
      "X-Title": "TutorBoard",
    }
  });
  keys.openrouter = apiKey;
  console.log(`[AI] OpenRouter Client Initialized ✅`);
  return clients.openrouter;
};

/**
 * Returns the primary model slug for OpenRouter — used for JSON timeline/doubt responses.
 * Must support response_format: { type: "json_object" }.
 */
export const getModel = () => {
  return "google/gemini-2.0-flash-001";
};

/**
 * Returns the text model slug for OpenRouter — used for non-JSON text chat responses.
 */
export const getTextModel = () => {
  return "google/gemini-2.0-flash-001";
};
