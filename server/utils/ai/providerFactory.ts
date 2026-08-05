/**
 * providerFactory.ts — Enterprise Multi-Provider Factory v7.0
 * 
 * Features:
 *   1. OpenAI-compatible client abstraction
 *   2. Precise, versioned token pricing
 *   3. Multimodal (Vision) support
 *   4. Native fetch fallbacks for non-standard providers
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  baseURL: string;
  headerKey: string;
  headerPrefix: string;
  extraHeaders?: Record<string, string>;
  isLocal?: boolean;
}

export interface PricingModel {
  input: number;
  output: number;
  provider: string;
}

export interface PricingConfig {
  version: string;
  lastUpdated: string;
  models: Record<string, PricingModel>;
}

export interface ProviderRequestParams {
  model: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  response_format?: any;
  onStream?: (token: string) => void;
  file?: { url: string; type: string };
}

export interface ProviderResponse {
  content: string;
  finishReason: string;
  provider: string;
  usage?: any;
  tool_calls?: any;
}

// ── Configuration ───────────────────────────────────────────────────────────

export const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
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
  huggingface: {
    baseURL: 'https://api-inference.huggingface.co',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    headerKey: 'Authorization',
    headerPrefix: 'Bearer ',
    isLocal: true,
  }
};

export const PRICING_CONFIG: PricingConfig = {
  version: '2026-05-10',
  lastUpdated: new Date().toISOString(),
  models: {
    'gpt-4o': { input: 2.50, output: 10.00, provider: 'openai' },
    'gpt-4o-mini': { input: 0.15, output: 0.60, provider: 'openai' },
    'gemini-2.0-flash': { input: 0.10, output: 0.40, provider: 'google' },
    'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40, provider: 'openrouter' },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, provider: 'anthropic' },
    'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00, provider: 'openrouter' },
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBase64Image(fileUrl: string): Promise<string | null> {
  try {
    if (fileUrl.includes('/uploads/')) {
      const filename = fileUrl.split('/uploads/').pop();
      if (filename) {
        const localPath = path.join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(localPath)) {
          const buffer = await fs.promises.readFile(localPath);
          return buffer.toString('base64');
        }
      }
    }
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.error('[AI:ProviderFactory] Base64 failed:', (err as Error).message);
    return null;
  }
}

export function calculateCost(model: string, promptTokens = 0, completionTokens = 0) {
  const pricing = PRICING_CONFIG.models[model] || { input: 1.0, output: 3.0 };
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalUsd = inputCost + outputCost;
  const costCents = totalUsd * 100; // Return raw cents for higher precision in tracking

  return {
    costCents,
    model,
    pricingVersion: PRICING_CONFIG.version,
  };
}

export function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  return calculateCost(model, promptTokens, completionTokens).costCents;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createProviderClient(provider: string, apiKey: string, customBaseUrl?: string): OpenAI {
  if (!apiKey) throw new Error(`API Key missing for ${provider}`);

  const config = PROVIDER_CONFIG[provider];

  if (provider === 'custom') {
    const baseURL = (customBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
    return new OpenAI({ apiKey, baseURL });
  }

  if (!config) throw new Error(`Unknown provider: ${provider}`);

  return new OpenAI({
    apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.extraHeaders || {},
  });
}

export async function executeProviderRequest(
  client: OpenAI, 
  provider: string, 
  params: ProviderRequestParams, 
  signal?: AbortSignal
): Promise<ProviderResponse> {
  const { model, messages, temperature, maxTokens, tools, response_format, onStream, file } = params;

  // ANTHROPIC NATIVE FETCH (due to SDK differences)
  if (provider === 'anthropic') {
    return _executeAnthropicRequest(client.apiKey, model, params, signal);
  }

  // STANDARD OPENAI-COMPATIBLE PATH
  let effectiveMessages = messages;
  let effectiveResponseFormat = response_format;

  // Robustness: these providers support json_object but not json_schema mode.
  // Downgrade the format and reinforce with an instruction (Groq requires the
  // word "JSON" in the prompt when json_object mode is active). JSON mode is
  // incompatible with streaming on some of these providers, so streaming calls
  // keep the instruction-only behavior.
  if (['google', 'groq', 'deepseek'].includes(provider) && response_format) {
    effectiveResponseFormat = onStream ? undefined : { type: 'json_object' };
    const jsonInstruction = 'CRITICAL: Respond with valid JSON only. No markdown fences.';
    effectiveMessages = [{ role: 'system', content: jsonInstruction }, ...messages];
  }

  const completion = await client.chat.completions.create({
    model,
    messages: effectiveMessages,
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens ?? 4000,
    tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
    response_format: effectiveResponseFormat,
    stream: !!onStream,
  }, { signal });

  let finalContent = '';
  let finishReason = 'stop';
  let usage: any = null;
  let tool_calls: any = null;

  if (onStream && 'choices' in completion === false) { // It's a stream
    for await (const chunk of completion as any) {
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (token) {
        finalContent += token;
        onStream(token);
      }
      if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
      if (chunk.usage) usage = chunk.usage;
    }
  } else {
    const data = completion as OpenAI.Chat.Completions.ChatCompletion;
    finalContent = data.choices[0].message.content || '';
    tool_calls = data.choices[0].message.tool_calls || null;
    finishReason = data.choices[0].finish_reason || 'stop';
    usage = data.usage;
  }

  return { content: finalContent, finishReason, provider, usage, tool_calls };
}

async function _executeAnthropicRequest(apiKey: string, model: string, params: ProviderRequestParams, signal?: AbortSignal): Promise<ProviderResponse> {
  const { messages, temperature, maxTokens, onStream } = params;
  const baseURL = 'https://api.anthropic.com/v1';

  const payload = {
    model,
    messages: messages.filter(m => m.role !== 'system'),
    system: messages.find(m => m.role === 'system')?.content || '',
    max_tokens: maxTokens ?? 2000,
    temperature: temperature ?? 0.7,
    stream: !!onStream,
  };

  const res = await fetch(`${baseURL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);

  if (onStream) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Failed to get stream reader from Anthropic');
    
    let finalContent = '';
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta' && data.delta?.text) {
                const token = data.delta.text;
                finalContent += token;
                onStream(token);
              }
            } catch (e) { /* skip malformed JSON */ }
          }
        }
      }
      return { content: finalContent, finishReason: 'stop', provider: 'anthropic' };
    } finally {
      reader.releaseLock();
    }
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text || '',
    finishReason: data.stop_reason || 'stop',
    provider: 'anthropic',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
    }
  };
}
