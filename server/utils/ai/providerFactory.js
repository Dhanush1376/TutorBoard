/**
 * Provider Factory v3 — Multi-Provider Client Factory + Versioned Pricing Engine
 * 
 * Creates OpenAI-compatible clients for any provider.
 * Includes structured, versioned pricing for precise cost tracking.
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * Helper to get base64 data from a file URL
 */
async function getBase64Image(fileUrl) {
  try {
    // If it's a local /uploads path
    if (fileUrl.includes('/uploads/')) {
      const filename = fileUrl.split('/uploads/').pop();
      const localPath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(localPath)) {
        const buffer = await fs.promises.readFile(localPath);
        return buffer.toString('base64');
      }
    }
    // Fallback: try to fetch it if it's a remote URL
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.error('[AI:ProviderFactory] Failed to get base64 for image:', err.message);
    return null;
  }
}

// ── Provider endpoint configurations ──────────────────────────────────────────
export const PROVIDER_CONFIG = {
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
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  cohere: {
    baseURL: 'https://api.cohere.ai/v1',
    headerKey: 'Authorization',    
    headerPrefix: 'Bearer ',
  },
  together: {
    baseURL: 'https://api.together.xyz/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  fireworks: {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  anyscale: {
    baseURL: 'https://api.endpoints.anyscale.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  nvidia: {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  ai21: {
    baseURL: 'https://api.ai21.com/studio/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  deepinfra: {
    baseURL: 'https://api.deepinfra.com/v1/openai',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  huggingface: {
    baseURL: 'https://api-inference.huggingface.co',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  cerebras: {
    baseURL: 'https://api.cerebras.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  sambanova: {
    baseURL: 'https://api.sambanova.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  novita: {
    baseURL: 'https://api.novita.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  lepton: {
    baseURL: 'https://api.lepton.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  voyage: {
    baseURL: 'https://api.voyageai.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  upstage: {
    baseURL: 'https://api.upstage.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  stability: {
    baseURL: 'https://api.stability.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  fal: {
    baseURL: 'https://api.fal.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  runpod: {
    baseURL: 'https://api.runpod.ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
    isLocal: true,
  },
  lmstudio: {
    baseURL: 'http://localhost:1234/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
    isLocal: true,
  },
  vllm: {
    baseURL: 'http://localhost:8000/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
    isLocal: true,
  },
  replicate: {
    baseURL: 'https://api.replicate.com/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  workers: {
    baseURL: 'https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
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
    'google/gemini-2.0-flash-001':          { input: 0.10, output: 0.40,  provider: 'openrouter' },
    'deepseek/deepseek-r1':                 { input: 0.55, output: 2.19,  provider: 'openrouter' },
    'openai/gpt-4o-mini':                   { input: 0.15, output: 0.60,  provider: 'openrouter' },
    'meta-llama/llama-3.3-70b-instruct':    { input: 0.59, output: 0.79,  provider: 'openrouter' },

    // Groq
    'llama-3.3-70b-versatile':    { input: 0.59,  output: 0.79,  provider: 'groq' },
    'llama-3.1-8b-instant':       { input: 0.05,  output: 0.08,  provider: 'groq' },
    'mixtral-8x7b-32768':         { input: 0.24,  output: 0.24,  provider: 'groq' },
    'gemma2-9b-it':               { input: 0.20,  output: 0.20,  provider: 'groq' },
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
  if (!apiKey) {
    throw new Error(`CRITICAL: No API key provided for custom ${provider} path. Isolation firewall blocked fallback to system environment.`);
  }

  const config = PROVIDER_CONFIG[provider];

  if (provider === 'custom') {
    // BUG FIX: The OpenAI SDK appends /chat/completions automatically.
    // If the user pasted the full endpoint URL (ending with /chat/completions),
    // strip it so the SDK doesn't double-append it and get a 404.
    let baseURL = (customBaseUrl || 'http://localhost:11434/v1')
      .replace(/\/+$/, '')                           // strip trailing slashes
      .replace(/\/chat\/completions$/i, '')          // strip /chat/completions suffix
      .replace(/\/completions$/i, '');               // strip /completions suffix (bare)
    
    // Also normalise: if they pasted just the v1 base, keep it as-is
    console.log(`[ProviderFactory:Custom] Normalized baseURL: ${baseURL}`);
    
    return new OpenAI({
      apiKey,
      baseURL,
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
export async function executeProviderRequest(client, provider, { model, messages, temperature, maxTokens, tools, response_format, onStream, file }, signal, customBaseUrl) {
  if (provider === 'anthropic') {
    const apiKey = client.apiKey;
    const baseURL = (customBaseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    
    try {
      console.log(`[AI:Anthropic] Executing native fetch request to ${baseURL}/messages`);
      
      const lastMsg = messages[messages.length - 1];
      const otherMsgs = messages.filter(m => m.role !== 'system' && m !== lastMsg);
      
      let lastMsgContent = lastMsg?.content || '';
      if (file && file.type?.startsWith('image/') && lastMsg?.role === 'user') {
        const base64 = await getBase64Image(file.url);
        if (base64) {
          console.log(`[AI:Anthropic] Injecting multimodal image data into request.`);
          lastMsgContent = [
            { type: 'text', text: lastMsg.content },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: file.type || 'image/jpeg', 
                data: base64 
              } 
            }
          ];
        }
      }

      const payload = {
        model,
        messages: [
          ...otherMsgs.map(m => ({ role: m.role, content: m.content })),
          { role: lastMsg?.role || 'user', content: lastMsgContent }
        ],
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

  // ─── HuggingFace Inference API ───
  // HF free-tier requires model in the URL path: /models/{model}/v1/chat/completions
  if (provider === 'huggingface') {
    const hfBaseURL = `https://api-inference.huggingface.co/models/${model}/v1`;
    const hfClient = new OpenAI({
      apiKey: client.apiKey,
      baseURL: hfBaseURL,
    });

    try {
      console.log(`[AI:HuggingFace] Using model-specific endpoint: ${hfBaseURL}/chat/completions`);
      const completion = await hfClient.chat.completions.create({
        model,
        messages,
        temperature: temperature ?? 0.1,
        max_tokens: maxTokens ?? 1000,
        stream: !!onStream,
      }, signal ? { signal } : undefined);

      let finalContent = '';
      if (onStream) {
        for await (const chunk of completion) {
          const token = chunk.choices?.[0]?.delta?.content || '';
          if (token) { finalContent += token; onStream(token); }
        }
      } else {
        finalContent = completion.choices?.[0]?.message?.content || '';
      }

      return {
        content: finalContent,
        finishReason: 'stop',
        provider: 'huggingface',
        usage: completion?.usage || null,
      };
    } catch (err) {
      console.error(`[AI:HuggingFace] ❌ Request failed for model ${model}: ${err.message}`);
      err.provider = 'huggingface';
      err.model = model;
      throw err;
    }
  }

  // ─── Provider-specific response_format handling ───
  // Google Gemini's OpenAI-compatible endpoint returns EMPTY responses when 
  // response_format: { type: "json_object" } is sent. Similarly, Groq can be flaky.
  // Fix: Strip response_format for these providers and inject a JSON instruction 
  // into the system prompt instead.
  let effectiveMessages = messages;
  let effectiveResponseFormat = response_format;

  // FIX: Strip response_format for providers that return empty content when they receive it.
  // 'custom' added — Groq/Ollama/LMStudio/etc silently return empty on json_object or json_schema.
  // Replace with a system-prompt JSON instruction that every provider understands.
  const stripJsonFormat = ['google', 'groq', 'deepseek', 'custom'].includes(provider);
  if (stripJsonFormat && response_format) {
    effectiveResponseFormat = undefined;
    const jsonInstruction = 'CRITICAL: Respond with valid JSON only. No markdown fences, no explanation — raw JSON.';
    const hasSystem = effectiveMessages.some(m => m.role === 'system');
    effectiveMessages = hasSystem
      ? effectiveMessages.map(m => m.role === 'system'
          ? { ...m, content: m.content + '\n\n' + jsonInstruction }
          : m)
      : [{ role: 'system', content: jsonInstruction }, ...effectiveMessages];
    console.log('[AI:' + provider + '] Stripped response_format (' + (response_format && response_format.type) + ') — injected JSON instruction.');
  }

  // ─── Multimodal (Vision) Handling ───
  let multimodalMessages = effectiveMessages;
  if (file && file.type?.startsWith('image/')) {
    const lastMsg = effectiveMessages[effectiveMessages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      console.log(`[AI:${provider}] Injecting vision context for model ${model}`);
      multimodalMessages = [
        ...effectiveMessages.slice(0, -1),
        {
          role: 'user',
          content: [
            { type: 'text', text: lastMsg.content },
            { type: 'image_url', image_url: { url: file.url } }
          ]
        }
      ];
    }
  }

  const completionParams = {
    model,
    messages: multimodalMessages,
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
      // ── DIAGNOSTIC: Log full raw completion for debugging ──
      console.log(`[AI:${provider}] RAW RESPONSE:`, JSON.stringify(completion, null, 2));
      
      // Robust Normalization Layer
      // 1. Standard OpenAI / Groq / OpenRouter / DeepSeek
      if (completion?.choices?.[0]?.message) {
        msg = completion.choices[0].message;
        finalContent = msg.content || '';
        tool_calls = msg.tool_calls || null;
        finishReason = completion.choices[0].finish_reason || 'stop';
      }
      // 2. Google Gemini Native (if somehow accessed outside OpenAI shim)
      else if (completion?.candidates?.[0]?.content?.parts?.[0]?.text) {
        finalContent = completion.candidates[0].content.parts[0].text;
        finishReason = completion.candidates[0].finishReason || 'stop';
      }
      // 3. Anthropic Native (if called via this shim)
      else if (completion?.content?.[0]?.text) {
        finalContent = completion.content[0].text;
        finishReason = completion.stop_reason || 'stop';
      }
      // 4. Fallback for bare text responses (some local models)
      else if (typeof completion === 'string') {
        finalContent = completion;
      }
      else if (completion?.text) {
        finalContent = completion.text;
      }

      usage = completion?.usage || null;
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