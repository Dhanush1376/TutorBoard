/**
 * Provider Factory v3 — Multi-Provider Client Factory + Versioned Pricing Engine
 * 
 * Creates OpenAI-compatible clients for any provider.
 * Includes structured, versioned pricing for precise cost tracking.
 */

import OpenAI from 'openai';

// ── Provider endpoint configurations ──────────────────────────────────────────
const PROVIDER_CONFIG = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    headerKey: 'x-api-key',
    headerPrefix: '',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
    extraHeaders: {
      'HTTP-Referer': 'https://tutorboard.app',
      'X-Title': 'TutorBoard',
    },
  },
};

// ── Versioned Pricing Engine ──────────────────────────────────────────────────
// Prices in USD per 1 million tokens
const PRICING_CONFIG = {
  version: '2025-04-17',
  lastUpdated: '2025-04-17T00:00:00Z',
  models: {
    // OpenAI
    'gpt-4o':         { input: 2.50,  output: 10.00, provider: 'openai' },
    'gpt-4o-mini':    { input: 0.15,  output: 0.60,  provider: 'openai' },
    'gpt-4-turbo':    { input: 10.00, output: 30.00, provider: 'openai' },
    'o3-mini':        { input: 1.10,  output: 4.40,  provider: 'openai' },

    // Google Gemini
    'gemini-1.5-pro':                { input: 1.25, output: 10.00, provider: 'google' },
    'gemini-2.0-flash':             { input: 0.10, output: 0.40,  provider: 'google' },
    'gemini-2.0-flash-lite':        { input: 0.02, output: 0.05,  provider: 'google' },

    // DeepSeek
    'deepseek-chat':              { input: 0.27,  output: 1.10,  provider: 'deepseek' },
    'deepseek-reasoner':          { input: 0.55,  output: 2.19,  provider: 'deepseek' },

    // Anthropic
    'claude-sonnet-4-20250514':   { input: 3.00,  output: 15.00, provider: 'anthropic' },
    'claude-3-5-haiku-20241022':  { input: 0.80,  output: 4.00,  provider: 'anthropic' },
    'claude-3-haiku-20240307':    { input: 0.25,  output: 1.25,  provider: 'anthropic' },

    // OpenRouter pass-through models (approximate)
    'anthropic/claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, provider: 'openrouter' },
    'anthropic/claude-3.5-sonnet':          { input: 3.00, output: 15.00, provider: 'openrouter' },
    'anthropic/claude-opus-4-5':            { input: 15.00, output: 75.00, provider: 'openrouter' },
  },
};

/**
 * Get the current pricing configuration
 */
export function getCurrentPricing() {
  return PRICING_CONFIG;
}

/**
 * Calculate precise cost for a request
 * @param {string} model — Model identifier
 * @param {number} promptTokens — Input tokens
 * @param {number} completionTokens — Output tokens
 * @returns {{ costCents: number, breakdown: { inputCost: number, outputCost: number }, model: string, pricingVersion: string }}
 */
export function calculateCost(model, promptTokens = 0, completionTokens = 0) {
  const pricing = PRICING_CONFIG.models[model] || { input: 1.0, output: 3.0 };
  
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalUsd = inputCost + outputCost;
  const costCents = Math.round(totalUsd * 100 * 100) / 100; // cents with 2 decimal precision

  return {
    costCents,
    breakdown: {
      inputCost: Math.round(inputCost * 100 * 100) / 100,
      outputCost: Math.round(outputCost * 100 * 100) / 100,
    },
    model,
    pricingVersion: PRICING_CONFIG.version,
  };
}

// Legacy-compatible wrapper
export function estimateCost(provider, model, promptTokens, completionTokens) {
  return calculateCost(model, promptTokens, completionTokens).costCents;
}

// ── Client Factory ────────────────────────────────────────────────────────────

/**
 * Create an OpenAI-compatible client for a given provider
 * @param {string} provider - Provider identifier
 * @param {string} apiKey - Decrypted API key
 * @param {string} [customBaseUrl] - Override base URL (for 'custom' provider)
 * @returns {OpenAI} OpenAI SDK client instance
 */
export function createProviderClient(provider, apiKey, customBaseUrl) {
  const config = PROVIDER_CONFIG[provider];

  if (provider === 'custom') {
    return new OpenAI({
      apiKey,
      baseURL: customBaseUrl?.replace(/\/+$/, '') || 'http://localhost:11434/v1',
    });
  }

  if (provider === 'anthropic') {
    return new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      defaultHeaders: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
  }

  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return new OpenAI({
    apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.extraHeaders || {},
  });
}

/**
 * Execute a completion request through a provider client
 * Handles provider-specific request/response differences
 * 
 * @param {OpenAI} client - The provider client  
 * @param {string} provider - Provider identifier
 * @param {object} params - Request parameters
 * @param {AbortSignal} [signal] - Optional abort signal for timeout/racing
 * @returns {Promise<{content: string, finishReason: string, provider: string, usage?: object}>}
 */
export async function executeProviderRequest(client, provider, { model, messages, temperature, maxTokens, tools, response_format, onStream }, signal, customBaseUrl) {
  if (provider === 'anthropic') {
    const apiKey = client.apiKey;
    const baseURL = (customBaseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    
    try {
      console.log(`[AI:Anthropic] Executing native fetch request to ${baseURL}/messages`);
      
      const payload = {
        model,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content,
        })),
        system: messages.find(m => m.role === 'system')?.content || '',
        max_tokens: maxTokens ?? 2000,
        temperature: temperature ?? 0.7,
        stream: !!onStream,
      };

      if (onStream) {
        console.log(`[AI:Anthropic] 🌊 Starting native stream parser for ${model}`);
        
        const response = await fetch(`${baseURL}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payload),
          signal: signal || undefined
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error?.message || `Anthropic API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep the partial line in the buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.substring(6));
                
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  const text = data.delta.text;
                  finalContent += text;
                  onStream(text);
                } else if (data.type === 'message_start' && data.message?.usage) {
                  inputTokens = data.message.usage.input_tokens || 0;
                } else if (data.type === 'message_delta' && data.usage) {
                  outputTokens = data.usage.output_tokens || 0;
                }
              } catch (e) {
                // Ignore parse errors for non-JSON or partial lines
              }
            }
          }
        }

        return {
          content: finalContent,
          finishReason: 'stop',
          provider: 'anthropic',
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        };
      }

      const res = await fetch(`${baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: signal || undefined
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Anthropic API error: ${res.status}`);
      }

      const data = await res.json();
      return {
        content: data.content?.[0]?.text || '',
        finishReason: data.stop_reason || 'stop',
        provider: 'anthropic',
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (err) {
      console.error(`[AI:Anthropic] Native fetch failed: ${err.message}`);
      throw err;
    }
  }

  // Standard OpenAI-compatible path
  // ─── Provider-specific response_format handling ───
  // Google Gemini's OpenAI-compatible endpoint returns EMPTY responses when 
  // response_format: { type: "json_object" } is sent. Similarly, Groq can be flaky.
  // Fix: Strip response_format for these providers and inject a JSON instruction 
  // into the system prompt instead.
  let effectiveMessages = messages;
  let effectiveResponseFormat = response_format;

  const stripJsonFormat = ['google', 'groq', 'deepseek'].includes(provider);
  if (stripJsonFormat && response_format?.type === 'json_object') {
    effectiveResponseFormat = undefined;
    // Inject JSON instruction into system message
    effectiveMessages = messages.map(m => {
      if (m.role === 'system') {
        return { ...m, content: m.content + '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just raw JSON.' };
      }
      return m;
    });
    console.log(`[AI:${provider}] Stripped response_format for compatibility, injected JSON instruction.`);
  }

  const completionParams = {
    model,
    messages: effectiveMessages,
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens ?? 1000,
    tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
    response_format: effectiveResponseFormat,
    stream: !!onStream,
  };

  try {
    const completion = await client.chat.completions.create(completionParams, signal ? { signal } : undefined);

    let finalContent = '';
    let msg, usage, finishReason = 'stop';
    let tool_calls = null;

    if (onStream) {
      for await (const chunk of completion) {
        const token = chunk.choices?.[0]?.delta?.content || "";
        if (token) {
          finalContent += token;
          onStream(token);
        }
        if (chunk.choices?.[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
        }
        if (chunk.usage) usage = chunk.usage;
      }
      msg = { content: finalContent };
    } else {
      // ── DIAGNOSTIC: Log raw completion for debugging empty responses ──
      console.log(`[AI:${provider}] Raw completion keys: ${Object.keys(completion || {}).join(', ')}`);
      console.log(`[AI:${provider}] Choices count: ${completion.choices?.length || 0}`);
      if (completion.choices?.[0]) {
        const choice = completion.choices[0];
        console.log(`[AI:${provider}] Choice[0] keys: ${Object.keys(choice).join(', ')}`);
        console.log(`[AI:${provider}] Message keys: ${Object.keys(choice.message || {}).join(', ')}`);
        console.log(`[AI:${provider}] Content type: ${typeof choice.message?.content}, length: ${(choice.message?.content || '').length}`);
        console.log(`[AI:${provider}] Content preview: ${(choice.message?.content || '(null)').substring(0, 200)}`);
        console.log(`[AI:${provider}] Finish reason: ${choice.finish_reason}`);
      } else {
        console.warn(`[AI:${provider}] ⚠️ No choices in completion! Full response: ${JSON.stringify(completion).substring(0, 500)}`);
      }
      
      msg = completion.choices?.[0]?.message;
      usage = completion.usage || null;
      finalContent = msg?.content || '';
      finishReason = completion.choices?.[0]?.finish_reason || 'stop';
      tool_calls = msg?.tool_calls || null;
    }

    if (!finalContent && !tool_calls) {
      console.warn(`[AI:${provider}] ⚠️ Received empty response from model ${completionParams.model}. Finish Reason: ${finishReason}. Params: ${JSON.stringify({ model: completionParams.model, response_format: completionParams.response_format, msgCount: completionParams.messages?.length })}`);
    }

    return {
      content: finalContent,
      finishReason: finishReason,
      provider,
      usage: usage,
      tool_calls: tool_calls,
    };
  } catch (err) {
    // Enrich error with provider context
    err.provider = provider;
    err.model = completionParams.model;
    
    // The OpenAI SDK sometimes reports "429 status code (no body)" for Google API errors,
    // even though Google DOES return a body with quota details. Enhance the error message.
    if (err.status === 429 && (err.message?.includes('no body') || !err.message?.includes('quota'))) {
      const enrichedMsg = `Your ${provider} free requests have run out for now. You can wait for the daily reset or upgrade your plan at Google AI Studio.`;
      console.error(`[AI:${provider}] ❌ Quota/Rate limit reached.`);
      const enrichedErr = new Error(enrichedMsg);
      enrichedErr.status = 429;
      enrichedErr.provider = provider;
      enrichedErr.model = completionParams.model;
      throw enrichedErr;
    }
    
    console.error(`[AI:${provider}] ❌ Request failed for model ${completionParams.model}: ${err.message}`);
    throw err;
  }
}
