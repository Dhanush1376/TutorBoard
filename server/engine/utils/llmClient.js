/**
 * LLM Client — Supports Multi-Provider (Google Direct & OpenRouter)
 * 
 * DESIGN:
 *   1. Prefer GOOGLE_API_KEY (Direct Gemini) for stability and speed.
 *   2. Fallback to OPENROUTER_API_KEY if Google fails or is not present.
 *   3. Standardized response format to keep Orchestrator simple.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { circuitBreaker } from '../core/circuitBreaker.js';

// Ensure .env is loaded correctly from the server root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Provider Clients
let googleAI = null;
let openRouterClient = null;

/**
 * Initialize Providers
 */
const initProviders = () => {
  if (!googleAI && process.env.GOOGLE_API_KEY) {
    googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    console.log('[AI] Google Direct Provider Initialized ✅');
  }

  if (!openRouterClient && process.env.OPENROUTER_API_KEY) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://tutorboard.app',
        'X-Title': 'TutorBoard',
      }
    });
    console.log('[AI] OpenRouter Provider Initialized ✅');
  }
};

/**
 * Robust LLM Call — Handles Provider Selection and Switching
 */
export async function requestCompletion({ model, messages, temperature, maxTokens }) {
  initProviders();

  // 1. Try Google Direct first (if key is present and model is Gemini and circuit is closed)
  if (googleAI && circuitBreaker.isAvailable('google') && (model.includes('gemini') || !model.includes('/'))) {
    try {
      let geminiModel = model.includes('/') ? model.split('/').pop() : model;
      if (geminiModel.includes('gemini-2.0-flash')) geminiModel = 'gemini-2.0-flash';
      if (geminiModel.includes('gemini-1.5-pro'))   geminiModel = 'gemini-1.5-pro';
      
      const modelInstance = googleAI.getGenerativeModel({ 
        model: geminiModel || 'gemini-2.0-flash',
        generationConfig: {
          temperature: temperature ?? 0.1,
          maxOutputTokens: maxTokens ?? 2048,
        }
      });

      const lastMessage = messages[messages.length - 1].content;
      const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
      const fullPrompt = systemInstruction ? `SYSTEM INSTRUCTION:\n${systemInstruction}\n\nUSER REQUEST:\n${lastMessage}` : lastMessage;

      const result = await modelInstance.generateContent(fullPrompt);
      const content = result.response.text();

      circuitBreaker.reportSuccess('google');
      return { content, finishReason: 'stop', provider: 'google' };
    } catch (err) {
      // Look for 429 quota errors in message
      const isQuota = err.message.includes('429') || err.message.includes('Quota exceeded');
      const statusCode = isQuota ? 429 : 500;
      console.error(`[AI:Google] Error: ${err.message}. Falling back...`);
      circuitBreaker.reportFailure('google', statusCode);
    }
  }

  // 2. Fallback to OpenRouter (OpenAI SDK)
  if (openRouterClient && circuitBreaker.isAvailable('openrouter')) {
    try {
      let orModel = model;
      if (!orModel.includes('/')) {
        if (orModel.includes('gemini-2.0-flash')) orModel = 'google/gemini-2.0-flash-001';
        else if (orModel.includes('gemini-1.5-flash')) orModel = 'google/gemini-flash-1.5';
        else if (orModel.includes('gemini-1.5-pro')) orModel = 'google/gemini-pro-1.5';
        else orModel = `google/${orModel}`;
      }

      console.log(`[AI:OpenRouter] Calling fallback model: ${orModel}`);
      const completion = await openRouterClient.chat.completions.create({
        model: orModel,
        messages,
        temperature: temperature ?? 0.1,
        max_tokens: maxTokens ?? 2048,
      });

      circuitBreaker.reportSuccess('openrouter');
      return {
        content: completion.choices?.[0]?.message?.content || '',
        finishReason: completion.choices?.[0]?.finish_reason || 'stop',
        provider: 'openrouter'
      };
    } catch (orErr) {
      const isCredits = orErr.message.includes('402');
      const orStatus = isCredits ? 402 : (orErr.status || 500);
      console.error(`[AI:OpenRouter] Error: ${orErr.message}`);
      circuitBreaker.reportFailure('openrouter', orStatus);
      const customErr = new Error('OpenRouter Fail: ' + orErr.message);
      customErr.status = orStatus;
      throw customErr; // Send to orchestrator logic
    }
  }

  throw new Error('NO_API_AVAILABLE');
}

/**
 * Get primary model identifier
 */
export const getModel = () => {
  return process.env.AI_MODEL || 'gemini-2.0-flash';
};

/**
 * Get text-only model identifier
 */
export const getTextModel = () => {
  return process.env.AI_TEXT_MODEL || 'gemini-2.0-flash';
};

// Legacy support
export const getAIClient = () => {
  initProviders();
  return openRouterClient;
};
