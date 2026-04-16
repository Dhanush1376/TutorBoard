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
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    headerKey: 'x-api-key',
    headerPrefix: '',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
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
    'gemini-2.5-pro-preview-05-06': { input: 1.25, output: 10.00, provider: 'google' },
    'gemini-2.0-flash':             { input: 0.10, output: 0.40,  provider: 'google' },
    'gemini-2.0-flash-lite':        { input: 0.02, output: 0.05,  provider: 'google' },

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
export async function executeProviderRequest(client, provider, { model, messages, temperature, maxTokens, tools, response_format }, signal) {
  if (provider === 'anthropic') {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: temperature ?? 0.1,
        max_tokens: maxTokens ?? 1000,
        response_format,
      }, signal ? { signal } : undefined);

      const msg = completion.choices?.[0]?.message;
      return {
        content: msg?.content || '',
        finishReason: completion.choices?.[0]?.finish_reason || 'stop',
        provider,
        usage: completion.usage || null,
      };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // Anthropic fallback to direct fetch
      const controller = signal ? undefined : new AbortController();
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': client.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
          })),
          system: messages.find(m => m.role === 'system')?.content || '',
          max_tokens: maxTokens ?? 1000,
          temperature: temperature ?? 0.1,
        }),
        signal: signal || controller?.signal,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error?.message || `Anthropic API error: ${res.status}`);
      }

      const data = await res.json();
      return {
        content: data.content?.[0]?.text || '',
        finishReason: data.stop_reason || 'stop',
        provider,
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    }
  }

  // Standard OpenAI-compatible path
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens ?? 1000,
    tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
    response_format,
  }, signal ? { signal } : undefined);

  const msg = completion.choices?.[0]?.message;
  return {
    content: msg?.content || '',
    finishReason: completion.choices?.[0]?.finish_reason || 'stop',
    provider,
    usage: completion.usage || null,
    tool_calls: msg?.tool_calls || null,
  };
}
