/**
 * LLM Client for OpenRouter (DeepSeek)
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Cache instances
const clients = { openrouter: null };
const keys = { openrouter: null };

// In-memory response cache
const responseCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

function getCacheKey(messages) {
  const content = messages.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
  return Buffer.from(content).toString('base64').substring(0, 50);
}

function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    responseCache.delete(cacheKey);
    return null;
  }
  return cached.response;
}

function setCachedResponse(cacheKey, response) {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { response, timestamp: Date.now() });
}

/**
 * Get or initialize OpenRouter client
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
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://tutorboard.app',
      'X-Title': 'TutorBoard',
    }
  });
  keys.openrouter = apiKey;
  console.log(`[AI] OpenRouter Client Initialized ✅`);
  return clients.openrouter;
};

/**
 * Get primary model - DeepSeek is fast and free-tier friendly
 */
export const getModel = () => {
  return process.env.AI_MODEL || 'deepseek/deepseek-chat';
};

/**
 * Get text model
 */
export const getTextModel = () => {
  return process.env.AI_TEXT_MODEL || 'deepseek/deepseek-chat';
};

/**
 * Get max tokens
 */
export const getMaxTokens = (model) => {
  if (model.includes('deepseek')) return 4096;
  return 3072;
};

export function clearCache() {
  responseCache.clear();
  console.log('[LLM] Cache cleared');
}

export function getCacheStats() {
  return { size: responseCache.size, maxSize: MAX_CACHE_SIZE, ttl: CACHE_TTL };
}
