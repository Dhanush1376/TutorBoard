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


/**
 * Route a multi-turn conversation with SERVER-SENT EVENT streaming.
 * Returns an async generator that yields content chunks.
 * 
 * Usage:
 *   const stream = routeConversationStream(messages, options);
 *   for await (const chunk of stream) { res.write(`data: ${JSON.stringify(chunk)}\n\n`); }
 * 
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {AsyncGenerator<{ chunk: string, provider?: string, done?: boolean }>}
 */
export async function* routeConversationStream(messages, options = {}) {
  const { timeout = 60000, maxTokens, responseMimeType } = options;

  logger.info(`[Chat:Stream] Routing streaming conversation (${messages.length} messages)...`);

  const conversationPriority = ['openrouter', 'groq', 'gemini'];
  let succeeded = false;

  for (const providerKey of conversationPriority) {
    if (!AI_CONFIG.providers[providerKey]?.enabled) {
      logger.warn(`[Chat:Stream] Provider ${providerKey} disabled. Skipping.`);
      continue;
    }

    try {
      logger.info(`[Chat:Stream] Attempting ${providerKey} (streaming)...`);

      if (providerKey === 'openrouter') {
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
          const stream = await or.chat.completions.create(
            { 
              messages, 
              model: config.model, 
              stream: true,
              max_tokens: maxTokens || undefined,
              response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
            },
            { signal: controller.signal }
          );

          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              yield { chunk: content, provider: providerKey };
            }
          }

          succeeded = true;
        } finally {
          clearTimeout(timer);
        }

      } else if (providerKey === 'groq') {
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
            body: JSON.stringify({ 
              messages, 
              model: config.model, 
              stream: true,
              max_tokens: maxTokens || undefined,
              response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Groq stream error: ${err.error?.message || response.statusText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  yield { chunk: content, provider: providerKey };
                }
              } catch { /* skip malformed chunks */ }
            }
          }

          succeeded = true;
        } finally {
          clearTimeout(timer);
        }

      } else if (providerKey === 'gemini') {
        const config = AI_CONFIG.providers.gemini;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Gemini API key missing');

        // Gemini streaming via streamGenerateContent
        const prompt = messages
          .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
          .join('\n\n');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?key=${apiKey}&alt=sse`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: maxTokens || undefined,
                responseMimeType: responseMimeType || 'text/plain'
              }
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Gemini stream error: ${err.error?.message || response.statusText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);

              try {
                const parsed = JSON.parse(data);
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  yield { chunk: content, provider: providerKey };
                }
              } catch { /* skip malformed chunks */ }
            }
          }

          succeeded = true;
        } finally {
          clearTimeout(timer);
        }
      }

      if (succeeded) {
        logger.info(`[Chat:Stream] ✅ Streaming complete from ${providerKey}`);
        return;
      }

    } catch (err) {
      logger.error(`[Chat:Stream] ${providerKey} streaming failed: ${err.message}`);
    }
  }

  if (!succeeded) {
    throw new Error('CRITICAL_FAILURE: All AI providers failed for streaming conversation.');
  }
}
