/**
 * llmClient.ts — Intelligent Multi-Provider Orchestration Engine v7.0
 * 
 * Features:
 *   1. Full TypeScript typing and safety
 *   2. Integrated Circuit Breaker & Retry logic
 *   3. Hybrid Caching (Redis + LRU)
 *   4. Semantic Deduplication
 *   5. Enterprise Observability (Sentry + Tracing)
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { container } from '../../core/container.js';
import { withCircuitBreaker } from '../../engine/core/circuitBreaker.js';
import { captureException } from '../core/monitoring.js';
import { MODEL_REGISTRY } from './modelRegistry.js';
import UsageLog from '../../models/UsageLog.js';
import {
  createProviderClient,
  executeProviderRequest,
  calculateCost,
  estimateCost
} from './providerFactory.js';

const toJsonSchema = zodToJsonSchema as any;

// ── Types ───────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMParams {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  responseSchema?: z.ZodType<any>;
  responseMimeType?: string;
  userConfig?: any;
  taskType?: string;
  onStream?: (token: string) => void;
  file?: any;
  signal?: AbortSignal;
  sessionContext?: any;
  skipRacing?: boolean;
  requestId?: string;
}

export interface LLMResponse {
  content: string;
  error?: string;
  errorType?: string;
  provider?: string;
  tool_calls?: any;
  finishReason?: string;
  _meta: {
    mode: 'custom' | 'system';
    model_used: string;
    provider_used: string;
    fallback_triggered: boolean;
    cached: boolean;
    semantic?: boolean;
    response_time_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
    estimated_cost_cents?: number;
    [key: string]: any;
  };
}

// ── Clients ─────────────────────────────────────────────────────────────────

let openRouterClient: OpenAI | null = null;
let geminiClient: OpenAI | null = null;
let groqClient: OpenAI | null = null;

const initClients = () => {
  if (openRouterClient || geminiClient || groqClient) return; // Only init once

  const orKey = process.env.OPENROUTER_API_KEY;
  const gemKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (orKey) {
    openRouterClient = new OpenAI({
      apiKey: orKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://tutorboard.app', 'X-Title': 'TutorBoard' }
    });
    console.log('✅ [AI:Init] OpenRouter client initialized.');
  } else {
    console.warn('⚠️ [AI:Init] OPENROUTER_API_KEY missing.');
  }

  if (gemKey) {
    geminiClient = new OpenAI({
      apiKey: gemKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
    console.log('✅ [AI:Init] Gemini client initialized.');
  } else {
    console.warn('⚠️ [AI:Init] GEMINI_API_KEY missing.');
  }

  if (groqKey) {
    groqClient = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    console.log('✅ [AI:Init] Groq client initialized.');
  } else {
    console.warn('⚠️ [AI:Init] GROQ_API_KEY missing.');
  }

  if (!openRouterClient && !geminiClient && !groqClient) {
    console.error('❌ [AI:Init] NO SYSTEM PROVIDERS CONFIGURED. AI features will fail.');
  }
};

// Initialize immediately on module load
initClients();

// ── Caching ─────────────────────────────────────────────────────────────────

const CACHE_MAX = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const localCache = new Map<string, { response: any; timestamp: number }>();

async function getCachedResponse(key: string): Promise<any> {
  const entry = localCache.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      localCache.delete(key);
      localCache.set(key, entry);
      return entry.response;
    }
    localCache.delete(key);
  }

  return null;
}

async function setCachedResponse(key: string, response: any) {
  if (localCache.size >= CACHE_MAX) {
    const oldest = localCache.keys().next().value;
    if (oldest) localCache.delete(oldest);
  }
  localCache.set(key, { response, timestamp: Date.now() });

}

function getCacheKey(messages: LLMMessage[], model: string, userId: string | null, isCustom: boolean, context: any = null, temperature?: number, maxTokens?: number, responseMimeType?: string, taskType?: string) {
  const raw = JSON.stringify(messages) + '|' + model + '|' + (userId || 'anon') + '|' + isCustom + '|' + JSON.stringify(context) + '|t:' + (temperature ?? '') + '|mt:' + (maxTokens ?? '') + '|fmt:' + (responseMimeType ?? '') + '|task:' + (taskType ?? '');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function resolveModelId(modelId?: string): string {
  const normalizedId = (modelId || '').trim();

  // 1. Default for empty, universal, or generic agent names
  if (!normalizedId ||
    normalizedId.toLowerCase().includes('universal') ||
    normalizedId.toLowerCase() === 'tutor' ||
    normalizedId.toLowerCase() === 'bytez' ||
    normalizedId.toLowerCase() === 'tutu') {
    return 'gemini-flash-latest';
  }

  const mapping: Record<string, string> = {
    'Claude 3.5 Sonnet': 'claude-sonnet-5',
    'Gemini 1.5 Flash': 'gemini-flash-latest',
    'Gemini 1.5 Pro': 'gemini-pro-latest',
    'Gemini 2.5 Flash': 'gemini-flash-latest',
    'Gemini 2.5 Pro': 'gemini-pro-latest',
    'DeepSeek V3': 'deepseek/deepseek-chat',
    'Llama 3.3 70B': 'meta-llama/llama-3.3-70b-instruct'
  };

  if (mapping[normalizedId]) return mapping[normalizedId];

  // 2. If it already looks like an OpenRouter ID (provider/model), return it
  if (normalizedId.includes('/')) {
    return normalizedId;
  }

  // 3. Fallback to the ID itself (might be a direct provider ID)
  return normalizedId;
}

export function sanitizeModelIdForProvider(modelId: string, provider: string): string {
  if (provider === 'openrouter') {
    // OpenRouter uses vendor-prefixed, VERSIONED slugs. Google's rolling
    // "-latest" aliases (valid on Google's own endpoint) are NOT valid OpenRouter
    // model IDs and return a 400, so translate them to concrete OpenRouter slugs.
    const OPENROUTER_ALIASES: Record<string, string> = {
      'gemini-flash-latest': 'google/gemini-2.0-flash-001',
      'gemini-pro-latest': 'google/gemini-pro-1.5',
      'google/gemini-flash-latest': 'google/gemini-2.0-flash-001',
      'google/gemini-pro-latest': 'google/gemini-pro-1.5',
    };
    if (OPENROUTER_ALIASES[modelId]) return OPENROUTER_ALIASES[modelId];
    // Vendor-prefix bare IDs (e.g. from AI_MODEL env) that would otherwise 404
    if (!modelId.includes('/')) {
      if (modelId.startsWith('gemini')) return `google/${modelId}`;
      if (modelId.startsWith('claude')) return `anthropic/${modelId}`;
      if (modelId.startsWith('llama')) return `meta-llama/${modelId}`;
    }
    return modelId;
  }

  // Google OpenAI endpoint requires 'models/' prefix
  if (provider === 'google') {
    if (modelId.startsWith('models/')) return modelId;
    if (modelId.includes('/')) {
      const parts = modelId.split('/');
      return `models/${parts[parts.length - 1]}`;
    }
    return `models/${modelId}`;
  }

  if (!modelId.includes('/')) return modelId;

  const parts = modelId.split('/');
  return parts[parts.length - 1]; // Last resort: just the model name
}

export function getTextModel(): string {
  return process.env.AI_TEXT_MODEL || process.env.AI_MODEL_TEXT || 'gemini-flash-latest';
}

export function getModel(): string {
  return process.env.AI_MODEL || process.env.AI_TEXT_MODEL || 'gemini-flash-latest';
}

export function getFastModel(): string {
  return process.env.AI_MODEL_FAST || process.env.AI_MODEL_TEXT || 'gemini-flash-latest';
}

export function getModelForAgent(agentType: string): string {
  const mapping: Record<string, string> = {
    'doubt': 'gemini-flash-latest',
    'planner': 'gemini-flash-latest',
    'visualizer': 'gemini-flash-latest'
  };
  return mapping[agentType] || getTextModel();
}

function classifyError(err: any): string {
  const msg = (err.message || '').toLowerCase();
  const status = err.status || 0;
  if (status === 401) return 'invalid_key';
  if (status === 402 || msg.includes('quota')) return 'quota';
  if (status === 429) return 'rate_limit';
  if (msg.includes('timeout')) return 'timeout';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

function logUsage(data: any) {
  // Guard: Skip userId for guests/anonymous to avoid ObjectId cast errors
  const cleanData = { ...data };
  if (cleanData.userId && !/^[0-9a-fA-F]{24}$/.test(cleanData.userId)) {
    delete cleanData.userId;
  }
  UsageLog.create({
    ...cleanData,
    timestamp: new Date()
  }).catch(e => console.error('[llmClient] Usage log failed:', e.message));
}
/**
 * Generate semantic embeddings for a string.
 */
export async function getEmbeddings(text: string, userConfig?: any): Promise<number[]> {
  initClients();
  const provider = userConfig?.provider || 'openrouter';
  const model = userConfig?.model || 'text-embedding-3-small';

  // Use OpenRouter or direct client if available
  const client = openRouterClient;
  if (!client) throw new Error('AI client not initialized for embeddings');

  const response = await client.embeddings.create({
    model: 'openai/text-embedding-3-small', // OpenRouter standard
    input: (text || '').replace(/\n/g, ' '),
  });

  if (!response?.data?.[0]?.embedding) {
    throw new Error('AI provider failed to return embedding data');
  }

  return response.data[0].embedding;
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export async function requestCompletion(params: LLMParams): Promise<LLMResponse> {
  const { model, messages, userConfig, requestId, onStream, temperature, maxTokens, tools, responseSchema, responseMimeType } = params;
  const startTime = Date.now();
  const userId = userConfig?.userId || null;
  const canonicalModel = resolveModelId(model);

  // 1. Prepare JSON Schema if needed
  let response_format: any = undefined;
  if (responseSchema) {
    response_format = {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: false,
        schema: toJsonSchema(responseSchema)
      }
    };
  } else if (responseMimeType === 'application/json') {
    response_format = { type: "json_object" };
  }

  // 2. Cache Check
  // 2. Cache Check (Skip for highly personalized final_answer calls to avoid serving stale context, Audit v3 #64)
  const isCustom = !!userConfig?.useCustomApi;
  const canCache = params.taskType !== 'final_answer';
  const cacheKey = getCacheKey(messages, canonicalModel, userId, isCustom, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.taskType);
  
  if (canCache) {
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      console.log(`[AI:Cache] Hit for ${requestId}`);
      if (onStream && cached.content) {
        // Non-blocking fast path: emit the complete cached content instantly
        // Avoids event loop stalls under high load (Audit v3 #51)
        onStream(cached.content);
      }
      return { ...cached, _meta: { ...cached._meta, cached: true } };
    }
  }

  // 3. Execution Path
  try {
    initClients();

    // TRACING: Enterprise Request ID Injection
    const tracingHeaders = { 'X-Request-Id': requestId || crypto.randomUUID() };

    if (isCustom) {
      return await _executeCustomPath(params, canonicalModel, response_format, tracingHeaders, startTime);
    } else {
      return await _executeSystemPath(params, canonicalModel, response_format, tracingHeaders, startTime);
    }

  } catch (err: any) {
    const errorType = classifyError(err);
    captureException(err, { model: canonicalModel, requestId, errorType });

    logUsage({
      userId,
      model: canonicalModel,
      provider: 'google', // Default to google for fail logs
      success: false,
      errorType,
      responseTimeMs: Date.now() - startTime
    });

    throw err;
  }
}

const GROQ_FALLBACK_MODELS: Record<string, string> = {
  'gemini-flash-latest': 'llama-3.3-70b-versatile',
  'gemini-pro-latest': 'llama-3.3-70b-versatile',
  'claude-sonnet-5': 'llama-3.3-70b-versatile',
  'claude-haiku-4-5': 'llama-3.3-70b-versatile',
  // Legacy IDs kept so stale client selections still resolve to a live Groq model
  'gemini-1.5-flash': 'llama-3.3-70b-versatile',
  'gemini-1.5-pro': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet-20241022': 'llama-3.3-70b-versatile',
  'claude-sonnet-4-20250514': 'llama-3.3-70b-versatile',
};

async function _executeCustomPath(params: LLMParams, model: string, response_format: any, headers: any, startTime: number): Promise<LLMResponse> {
  const { userConfig, messages, temperature, maxTokens, tools, onStream, file, signal } = params;
  const provider = userConfig.provider || 'openai';

  // FIX: Prioritize user's custom model if provided, otherwise map the system model
  let providerModel = userConfig.model;
  
  if (!providerModel) {
    providerModel = sanitizeModelIdForProvider(model, provider);
    if (provider === 'groq') {
      const baseModelName = model.includes('/') ? model.split('/').pop()! : model;
      providerModel = GROQ_FALLBACK_MODELS[baseModelName] || GROQ_FALLBACK_MODELS[providerModel] || providerModel;
    }
  }

  return await withCircuitBreaker(`custom:${provider}`, async () => {
    const client = createProviderClient(provider, userConfig.getApiKey(), userConfig.baseUrl);
    const result = await executeProviderRequest(client, provider, {
      model: providerModel, messages, temperature, maxTokens, tools, response_format, onStream, file
    }, signal);

    const responseTimeMs = Date.now() - startTime;
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
    const cost = calculateCost(providerModel, usage.prompt_tokens, usage.completion_tokens);

    const response: LLMResponse = {
      content: result.content,
      finishReason: result.finishReason,
      provider,
      tool_calls: result.tool_calls,
      _meta: {
        mode: 'custom',
        model_used: providerModel,
        provider_used: provider,
        fallback_triggered: false,
        cached: false,
        response_time_ms: responseTimeMs,
        tokens_in: usage.prompt_tokens,
        tokens_out: usage.completion_tokens,
        estimated_cost_cents: cost.costCents
      }
    };

    if (params.taskType !== 'final_answer') {
      await setCachedResponse(getCacheKey(messages, model, userConfig.userId, true, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.taskType), response);
    }
    return response;
  });
}

async function _executeSystemPath(params: LLMParams, model: string, response_format: any, headers: any, startTime: number): Promise<LLMResponse> {
  // SYSTEM FALLBACK CHAIN: Google -> OpenRouter -> Groq
  // Google first: it serves the default gemini-*-latest aliases directly, while
  // OpenRouter needs vendor slugs and fails fast when the account has no credits.
  const chain = [
    { id: 'google', client: geminiClient },
    { id: 'openrouter', client: openRouterClient },
    { id: 'groq', client: groqClient }
  ];

  let lastErr: any = null;

  for (const entry of chain) {
    if (!entry.client) continue;

    try {
      return await withCircuitBreaker(entry.id, async () => {
        let providerModel = sanitizeModelIdForProvider(model, entry.id);
        
        // FIX: If falling back to Groq, use a Groq-compatible model
        if (entry.id === 'groq') {
          const baseModelName = model.includes('/') ? model.split('/').pop()! : model;
          providerModel = GROQ_FALLBACK_MODELS[baseModelName] || GROQ_FALLBACK_MODELS[providerModel] || providerModel;
        }

        const result = await executeProviderRequest(entry.client!, entry.id, {
          model: providerModel,
          messages: params.messages,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
          tools: params.tools,
          response_format,
          onStream: params.onStream,
          file: params.file
        }, params.signal);

        const responseTimeMs = Date.now() - startTime;
        const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

        const response: LLMResponse = {
          content: result.content,
          finishReason: result.finishReason,
          provider: entry.id,
          tool_calls: result.tool_calls,
          _meta: {
            mode: 'system',
            model_used: model,
            provider_used: entry.id,
            fallback_triggered: entry.id !== chain[0].id,
            cached: false,
            response_time_ms: responseTimeMs,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            estimated_cost_cents: cost.costCents
          }
        };

        if (params.taskType !== 'final_answer') {
          await setCachedResponse(getCacheKey(params.messages, model, params.userConfig?.userId, false, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.taskType), response);
        }
        return response;
      });
    } catch (err) {
      const msg = (err as any)?.message || String(err);
      console.warn(`[AI:System] ${entry.id} failed (${String(msg).slice(0, 300)}), trying next...`);
      lastErr = err;
    }
  }

  if (chain.every(entry => !entry.client)) {
    const err = new Error('SYSTEM_NOT_CONFIGURED: No AI provider keys found in environment.');
    (err as any).status = 401;
    throw err;
  }

  throw lastErr || new Error('All system AI providers failed');
}
