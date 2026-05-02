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


/**
 * Route a multi-turn conversation through AI providers.
 * Accepts an array of OpenAI-format messages [{role, content}].
 * Returns { content, provider, model, latency }.
 */
export async function routeConversation(messages, options = {}) {
  const {
    timeout = 30000,
    maxRetries = 2,
  } = options;

  logger.info(`[Chat] Routing conversation (${messages.length} messages)...`);

  // Priority: OpenRouter (Claude) → Groq → Gemini for conversation quality
  const conversationPriority = ['openrouter', 'groq', 'gemini'];
  let fallbackUsed = false;

  for (const providerKey of conversationPriority) {
    if (!AI_CONFIG.providers[providerKey]?.enabled) {
      logger.warn(`[Chat] Provider ${providerKey} disabled. Skipping.`);
      fallbackUsed = true;
      continue;
    }

    const startTime = Date.now();
    try {
      logger.info(`[Chat] Attempting ${providerKey}...`);

      let content;

      if (providerKey === 'openrouter') {
        // OpenRouter natively supports messages array via OpenAI SDK
        const OpenAI = (await import('openai')).default;
        const config = AI_CONFIG.providers.openrouter;
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('OpenRouter API key missing');

        const or = new OpenAI({
          apiKey,
          baseURL: config.baseUrl,
          defaultHeaders: {
            'HTTP-Referer': 'https://tutorboard.app',
            'X-Title': 'TutorBoard',
          },
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const completion = await or.chat.completions.create(
            { messages, model: config.model },
            { signal: controller.signal }
          );
          content = completion.choices[0].message.content;
        } finally {
          clearTimeout(timer);
        }
      } else if (providerKey === 'groq') {
        // Groq also supports OpenAI-compatible messages
        const config = AI_CONFIG.providers.groq;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('Groq API key missing');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({ messages, model: config.model }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Groq error: ${err.error?.message || response.statusText}`);
          }

          const data = await response.json();
          content = data.choices[0].message.content;
        } finally {
          clearTimeout(timer);
        }
      } else if (providerKey === 'gemini') {
        // Gemini uses a different format — convert messages to single prompt
        const config = AI_CONFIG.providers.gemini;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Gemini API key missing');

        const prompt = messages
          .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
          .join('\n\n');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Gemini error: ${err.error?.message || response.statusText}`);
          }

          const data = await response.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } finally {
          clearTimeout(timer);
        }
      }

      if (!content) throw new Error(`Empty response from ${providerKey}`);

      const latency = Date.now() - startTime;
      const { model } = resolveModel(providerKey, null, false);

      logger.info(`[Chat] ✅ Response from ${providerKey} (${latency}ms)`);
      return {
        content,
        provider: providerKey,
        model,
        status: fallbackUsed ? 'fallback' : 'success',
        latency: `${latency}ms`,
        fallbackUsed,
      };
    } catch (err) {
      logger.error(`[Chat] ${providerKey} failed: ${err.message}`);
      fallbackUsed = true;
    }
  }

  throw new Error('CRITICAL_FAILURE: All AI providers failed for conversation.');
}
