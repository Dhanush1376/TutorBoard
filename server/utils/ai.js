import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const isOpenRouterEnabled = !!process.env.OPENROUTER_API_KEY;

const aiClient = new OpenAI({
  apiKey: isOpenRouterEnabled ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY,
  baseURL: isOpenRouterEnabled ? "https://openrouter.ai/api/v1" : undefined,
  defaultHeaders: isOpenRouterEnabled ? {
    "HTTP-Referer": "https://tutorboard.app", // Optional, for OpenRouter rankings
    "X-Title": "TutorBoard", // Optional, for OpenRouter rankings
  } : undefined,
});

export const getModel = () => {
  if (isOpenRouterEnabled) {
    // Default to a balanced model on OpenRouter if not specified
    // Recommended: "openai/gpt-4o-mini" or "anthropic/claude-3.5-sonnet"
    return "openai/gpt-4o-mini"; 
  }
  return "gpt-4o-mini";
};

export default aiClient;
