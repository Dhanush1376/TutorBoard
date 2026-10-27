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
import { circuitBreaker, retryAfterMs, withCircuitBreaker } from '../../engine/core/circuitBreaker.js';

/**
 * A provider that is only briefly unavailable — a per-minute limit ("try again in 4.6s") or a
 * circuit about to reopen — is worth one short wait before falling back (or failing).
 */
const SHORT_WAIT_MS = 15000;
function shortWaitMs(err: any, provider: string): number | null {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) {
    const ms = retryAfterMs(err);
    return ms !== null && ms <= SHORT_WAIT_MS ? ms + 250 : null;
  }
  if (/^CIRCUIT_OPEN/.test(err?.message || '')) {
    const ms = circuitBreaker.retryInMs(provider);
    return ms > 0 && ms <= SHORT_WAIT_MS ? ms + 250 : null;
  }
  return null;
}
import { captureException } from '../core/monitoring.js';
import { MODEL_REGISTRY } from './modelRegistry.js';
import { getAdminChain, recordProviderOutcome } from './adminProviders.js';
import { getPlatformSettings } from '../../services/platformConfig.service.js';
import UsageLog from '../../models/UsageLog.js';
import User from '../../models/User.js';
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
  /** Thinking budget for reasoning models; part of the cache key. */
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
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

  // 1. Default for empty, universal, or generic agent names — honours AI_MODEL
  // so the default model can be switched by configuration alone.
  if (!normalizedId ||
    normalizedId.toLowerCase().includes('universal') ||
    normalizedId.toLowerCase() === 'tutor' ||
    normalizedId.toLowerCase() === 'bytez' ||
    normalizedId.toLowerCase() === 'tutu') {
    return getModel();
  }

  const mapping: Record<string, string> = {
    'Claude Sonnet 5': 'claude-sonnet-5',
    'Claude 3.5 Sonnet': 'claude-sonnet-5',
    'Gemini 3.8 Flash': 'gemini-3.8-flash',
    'Gemini 1.5 Flash': 'gemini-3.8-flash',
    'Gemini 1.5 Pro': 'gemini-3.8-flash',
    'Gemini 2.5 Flash': 'gemini-3.8-flash',
    'Gemini 2.5 Pro': 'gemini-3.8-flash',
    'DeepSeek V3': 'deepseek/deepseek-chat',
    'Llama 3.3 70B': 'openai/gpt-oss-120b'
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
      'gemini-3.8-flash': 'google/gemini-3.8-flash',
      'gemini-flash-latest': 'google/gemini-3.8-flash',
      'gemini-pro-latest': 'google/gemini-3.8-flash',
      'google/gemini-flash-latest': 'google/gemini-3.8-flash',
      'google/gemini-pro-latest': 'google/gemini-3.8-flash',
      'claude-sonnet-5': 'anthropic/claude-sonnet-5',
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
  return process.env.AI_TEXT_MODEL || process.env.AI_MODEL_TEXT || 'gemini-3.8-flash';
}

export function getModel(): string {
  return process.env.AI_MODEL || process.env.AI_TEXT_MODEL || 'gemini-3.8-flash';
}

export function getFastModel(): string {
  return process.env.AI_MODEL_FAST || process.env.AI_MODEL_TEXT || 'gemini-3.8-flash';
}

export function getModelForAgent(agentType: string): string {
  const mapping: Record<string, string> = {
    'doubt': 'gemini-3.8-flash',
    'planner': 'gemini-3.8-flash',
    'visualizer': 'gemini-3.8-flash'
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

async function markKeyLowCredits(userId?: any, keyId?: any, provider?: string) {
  try {
    if (!userId) return;
    if (keyId) {
      await (User as any).updateOne(
        { _id: userId, 'apiKeys._id': keyId },
        { $set: { 'apiKeys.$.isLowCredits': true } }
      );
      console.log(`[AI:Custom] Marked key ${keyId} as low credits for user ${userId}`);
    } else if (provider) {
      await (User as any).updateOne(
        { _id: userId, 'apiKeys.provider': provider },
        { $set: { 'apiKeys.$.isLowCredits': true } }
      );
      console.log(`[AI:Custom] Marked provider ${provider} key as low credits for user ${userId}`);
    }
  } catch (e: any) {
    console.warn('[AI:Custom] Could not mark key as low credits:', e?.message);
  }
}

/* E2E mock only: binary search in each language the code walkthrough runs. */
const MOCK_PROGRAMS: Record<string, [string, string]> = {
  python: ['Python', 'def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        if arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nnums = [2, 5, 8, 12, 16, 23, 38]\ntry:\n    target = int(input())\nexcept EOFError:\n    target = 23  # no input given\nprint(binary_search(nums, target))'],
  javascript: ['JavaScript', 'function binarySearch(arr, target) {\n  let lo = 0, hi = arr.length - 1;\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}\n\nconst nums = [2, 5, 8, 12, 16, 23, 38];\nconsole.log(binarySearch(nums, 23));'],
  java: ['Java', 'public class Main {\n    static int binarySearch(int[] arr, int target) {\n        int lo = 0, hi = arr.length - 1;\n        while (lo <= hi) {\n            int mid = (lo + hi) / 2;\n            if (arr[mid] == target) return mid;\n            if (arr[mid] < target) lo = mid + 1;\n            else hi = mid - 1;\n        }\n        return -1;\n    }\n\n    public static void main(String[] args) {\n        int[] nums = {2, 5, 8, 12, 16, 23, 38};\n        System.out.println(binarySearch(nums, 23));\n    }\n}'],
  cpp: ['C++', '#include <iostream>\n#include <vector>\n\nint binarySearch(const std::vector<int>& arr, int target) {\n    int lo = 0, hi = (int)arr.size() - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}\n\nint main() {\n    std::vector<int> nums = {2, 5, 8, 12, 16, 23, 38};\n    std::cout << binarySearch(nums, 23) << std::endl;\n    return 0;\n}'],
  c: ['C', '#include <stdio.h>\n\nint binary_search(int arr[], int n, int target) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}\n\nint main(void) {\n    int nums[] = {2, 5, 8, 12, 16, 23, 38};\n    printf("%d\\n", binary_search(nums, 7, 23));\n    return 0;\n}'],
};

/** E2E mock: a request for code that names one of the five languages gets a short program in it. */
function mockCodeAnswer(messages: any[]): string | null {
  const last = [...(messages || [])].reverse().find((m) => m?.role === 'user');
  const text = typeof last?.content === 'string' ? last.content : '';
  if (!/\b(write|show|code|program|implement|step through|visuali[sz]e)\b/i.test(text)) return null;
  const lang = /\bjavascript\b/i.test(text) ? 'javascript'
    : /\bjava\b/i.test(text) ? 'java'
      : /c\+\+|\bcpp\b/i.test(text) ? 'cpp'
        : /\bin c\b|\bc program\b/i.test(text) ? 'c'
          : /\bpython\b/i.test(text) ? 'python' : null;
  if (!lang) return null;
  const [name, program] = MOCK_PROGRAMS[lang];
  return `Here is binary search in ${name}:\n\n\`\`\`${lang}\n${program}\n\`\`\`\n\nEach pass halves the range that can still hold the target.`;
}

export async function requestCompletion(params: LLMParams): Promise<LLMResponse> {
  const { model, messages, userConfig, requestId, onStream, temperature, maxTokens, tools, responseSchema, responseMimeType } = params;
  const startTime = Date.now();
  const userId = userConfig?.userId || null;
  const canonicalModel = resolveModelId(model);

  if (userConfig?.isE2EMock) {
    console.log(`[AI:Mock] Intercepting request for E2E testing (requestId: ${requestId})`);

    let mockContent = "This is a mock response from the AI provider. Testing E2E functionality.";
    const codeAnswer = onStream ? mockCodeAnswer(messages) : null;
    if (codeAnswer) {
      // E2E: an answer with a program in it, streamed a line at a time (code walkthrough suite).
      for (const line of codeAnswer.split(/(?<=\n)/)) onStream!(line);
      return {
        content: codeAnswer,
        provider: 'mock',
        finishReason: 'stop',
        _meta: { mode: 'system', model_used: 'mock-model', provider_used: 'mock', fallback_triggered: false, cached: false },
      };
    }

    if (!onStream && params.taskType !== 'explanation') {
      // For backend services (Planner, Orchestrator, Critique) that expect JSON
      // (an explanation — e.g. the code walkthrough's tutor — is plain text)
      mockContent = JSON.stringify({
        teaching_mode: "socratic",
        complexity: "beginner",
        topic: "E2E Test Topic",
        suggest_canvas: false,
        educational_intent: "E2E Testing",
        core_concepts: ["test"],
        tools: { rag: false, web_search: false },
        visualization: { generate: false, type: "none", necessity: "none" },
        artifacts: { generate: false, type: "none" },
        narration: { narrations: [] },
        visualScript: { renderer: "react", script: [] },
        critique: "LGTM",
        score: 10
      });
    } else if (onStream) {
      // Simulate streaming for the main chat response
      const words = mockContent.split(' ');
      for (const word of words) {
        onStream(word + ' ');
      }
    }
    return {
      content: mockContent,
      provider: 'mock',
      finishReason: 'stop',
      _meta: {
        mode: 'system',
        model_used: 'mock-model',
        provider_used: 'mock',
        fallback_triggered: false,
        cached: false
      }
    };
  }

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
  const cacheKey = getCacheKey(messages, canonicalModel, userId, isCustom, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.reasoningEffort ? `${params.taskType}|${params.reasoningEffort}` : params.taskType);
  
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
  // Track whether any token reached the caller. Once part of an answer has been
  // streamed, falling back to another provider would stream a SECOND answer
  // after the first one (duplicated text in the chat), so mid-stream failures
  // surface as interrupted instead. A cancelled request never falls back.
  let streamedTokens = 0;
  if (params.onStream) {
    const original = params.onStream;
    params = { ...params, onStream: (token: string) => { streamedTokens++; original(token); } };
  }
  (params as any).__noFallback = () => streamedTokens > 0 || !!params.signal?.aborted;

  try {
    initClients();

    // TRACING: Enterprise Request ID Injection
    const tracingHeaders = { 'X-Request-Id': requestId || crypto.randomUUID() };

    if (isCustom) {
      try {
        return await _executeCustomPath(params, canonicalModel, response_format, tracingHeaders, startTime);
      } catch (customErr: any) {
        const errMsg = customErr?.message || String(customErr);
        const status = customErr?.status || customErr?.statusCode;
        const isQuotaOrCredits = status === 402 || /credit|quota|balance|payment/i.test(errMsg);

        console.warn(`[AI:Custom] Custom provider ${userConfig?.provider} failed: ${errMsg}`);
        if ((params as any).__noFallback()) throw asInterrupted(customErr, params.signal);

        if (isQuotaOrCredits) {
          markKeyLowCredits(userConfig?.userId, userConfig?.keyId, userConfig?.provider);
        }

        const allowFallback = userConfig?.fallbackToDefault !== false;
        if (allowFallback) {
          console.log(`[AI:Custom] Gracefully falling back to system provider chain for request ${requestId || 'req'}...`);
          const fallbackRes = await _executeSystemPath(params, canonicalModel, response_format, tracingHeaders, startTime);
          fallbackRes._meta = {
            ...fallbackRes._meta,
            fallback_triggered: true,
            custom_provider_failed: userConfig?.provider,
            custom_error: errMsg,
          };
          return fallbackRes;
        }

        throw customErr;
      }
    } else if (params.onStream && params.taskType === 'final_answer' && ANSWER_HEDGE_MS > 0) {
      return await _executeHedgedStream(params, canonicalModel, response_format, tracingHeaders, startTime);
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

/**
 * A chat answer must start streaming within a few seconds. A provider can sit
 * silent far longer — measured: gemini-3.8-flash thought for 44 s before its
 * first token, and under load it hung ~55 s then failed (503) — while the
 * learner watched an empty chat. If the answer has not started after this
 * long, the next provider in the chain is started alongside it; whichever
 * streams first is kept and the other is aborted (no duplicated text: only
 * one attempt ever reaches the caller). 0 turns this off.
 */
const ANSWER_HEDGE_MS = Number(process.env.CHAT_ANSWER_HEDGE_MS ?? 6000);

async function _executeHedgedStream(params: LLMParams, model: string, response_format: any, headers: any, startTime: number): Promise<LLMResponse> {
  const outerNoFallback = (params as any).__noFallback as () => boolean;
  const deliver = params.onStream!;
  const attempts: { ctrl: AbortController; done: boolean; error?: any; result?: LLMResponse }[] = [];
  let owner = -1;

  return new Promise<LLMResponse>((resolve, reject) => {
    const settle = () => {
      if (owner >= 0) {
        const a = attempts[owner];
        if (!a.done) return;
        clearTimeout(timer);
        return a.error ? reject(a.error) : resolve(a.result!);
      }
      // nobody has streamed yet
      const finished = attempts.find((a) => a.done && !a.error);
      if (finished) {
        // answered without streaming (cache, non-streaming provider): keep it, stop the rest
        clearTimeout(timer);
        attempts.forEach((a) => { if (a !== finished) a.ctrl.abort(); });
        return resolve(finished.result!);
      }
      // every attempt failed (each already tried its own fallbacks): nothing left to wait for
      if (attempts.every((a) => a.done)) {
        clearTimeout(timer);
        reject(attempts[0].error);
      }
    };
    const launch = (chainFrom: number) => {
      const i = attempts.length;
      const ctrl = new AbortController();
      if (params.signal) {
        if (params.signal.aborted) ctrl.abort();
        else params.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
      }
      const attempt = { ctrl, done: false } as (typeof attempts)[number];
      attempts.push(attempt);
      const child: any = {
        ...params,
        signal: ctrl.signal,
        onStream: (token: string) => {
          if (owner === -1) {
            owner = i;
            clearTimeout(timer);
            attempts.forEach((a, j) => { if (j !== i) a.ctrl.abort(); });
          }
          if (owner === i) deliver(token);
        },
      };
      child.__noFallback = () => outerNoFallback() || ctrl.signal.aborted;
      _executeSystemPath(child, model, response_format, headers, startTime, chainFrom)
        .then((r) => { attempt.result = r; }, (e) => { attempt.error = e; })
        .finally(() => { attempt.done = true; settle(); });
    };

    const timer = setTimeout(() => {
      if (owner >= 0 || attempts[0].done || params.signal?.aborted) return;
      console.warn(`[AI:Hedge] no first token after ${ANSWER_HEDGE_MS} ms — starting the next provider alongside`);
      launch(1);
    }, ANSWER_HEDGE_MS);
    timer.unref?.();

    launch(0);
  });
}

/** A failure after tokens were streamed (or after the caller aborted): keep the cause, mark it. */
function asInterrupted(err: any, signal?: AbortSignal) {
  if (signal?.aborted) {
    const abortErr = new Error('Request aborted by client');
    abortErr.name = 'AbortError';
    return abortErr;
  }
  const e: any = new Error(`STREAM_INTERRUPTED: ${err?.message || err}`);
  e.code = 'AI_3007';
  e.status = err?.status;
  e.cause = err;
  return e;
}

const GROQ_FALLBACK_MODELS: Record<string, string> = {
  'gemini-flash-latest': 'openai/gpt-oss-120b',
  'gemini-pro-latest': 'openai/gpt-oss-120b',
  'gemini-3.8-flash': 'openai/gpt-oss-120b',
  'gemini-3.7-flash': 'openai/gpt-oss-120b',
  'gemini-3.6-flash': 'openai/gpt-oss-120b',
  'claude-sonnet-5': 'openai/gpt-oss-120b',
  'claude-haiku-4-5': 'openai/gpt-oss-20b',
  // Deprecated Groq IDs mapped to active Groq replacements
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b': 'openai/gpt-oss-120b',
  'llama3.1-8b': 'openai/gpt-oss-20b',
  'gemini-1.5-flash': 'openai/gpt-oss-120b',
  'gemini-1.5-pro': 'openai/gpt-oss-120b',
  'claude-3-5-sonnet-20241022': 'openai/gpt-oss-120b',
  'claude-sonnet-4-20250514': 'openai/gpt-oss-120b',
};

/** Groq-servable model for a fallback. Gemini/Claude IDs missing from the
 *  table (e.g. a new AI_MODEL) used to be forwarded as-is and 404 on Groq. */
const GROQ_MAX_OUTPUT = Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 3500;
/** Groq's tokens-per-minute budget (8k on the free tier); a request's prompt + max output must fit in it. */
const GROQ_TPM = Number(process.env.GROQ_TPM) || 8000;

/** Output we can ask Groq for: what's left of its per-minute budget after the prompt (≈3.3 chars a token). */
export function groqMaxOutput(messages: unknown, requested?: number): number {
  const promptTokens = Math.ceil(JSON.stringify(messages ?? '').length / 3.3);
  return Math.max(1024, Math.min(requested ?? GROQ_MAX_OUTPUT, GROQ_MAX_OUTPUT, GROQ_TPM - promptTokens - 150));
}

function toGroqModel(model: string, providerModel: string): string {
  const base = model.includes('/') ? model.split('/').pop()! : model;
  const mapped = GROQ_FALLBACK_MODELS[base] || GROQ_FALLBACK_MODELS[providerModel];
  if (mapped) return mapped;
  if (/^(gemini|claude)/i.test(base)) return 'openai/gpt-oss-120b';
  return providerModel;
}

async function _executeCustomPath(params: LLMParams, model: string, response_format: any, headers: any, startTime: number): Promise<LLMResponse> {
  const { userConfig, messages, temperature, maxTokens, tools, onStream, file, signal } = params;
  const provider = userConfig.provider || 'openai';

  // FIX: Prioritize user's custom model if provided, otherwise map the system model
  let providerModel = userConfig.model;
  
  if (!providerModel) {
    providerModel = sanitizeModelIdForProvider(model, provider);
    if (provider === 'groq') {
      providerModel = toGroqModel(model, providerModel);
    }
  }

  return await withCircuitBreaker(`custom:${provider}`, async () => {
    const client = createProviderClient(provider, userConfig.getApiKey(), userConfig.baseUrl);
    const result = await executeProviderRequest(client, provider, {
      model: providerModel, messages, temperature, maxTokens, tools, response_format, onStream, file, reasoningEffort: params.reasoningEffort
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
      await setCachedResponse(getCacheKey(messages, model, userConfig.userId, true, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.reasoningEffort ? `${params.taskType}|${params.reasoningEffort}` : params.taskType), response);
    }
    return response;
  });
}

async function _executeSystemPath(params: LLMParams, model: string, response_format: any, headers: any, startTime: number, chainFrom = 0): Promise<LLMResponse> {
  // SYSTEM FALLBACK CHAIN: Google -> OpenRouter -> Groq
  // Google first: it serves the default gemini-*-latest aliases directly, while
  // OpenRouter needs vendor slugs and fails fast when the account has no credits.
  // Admin-configured providers (priority order) run first; the env-keyed ones
  // stay as the final fallback unless the platform settings turn them off.
  // A provider whose model lacks a capability the request needs is skipped.
  const settings = await getPlatformSettings().catch(() => null);
  const admin = settings?.ai?.useAdminProviders === false ? [] : await getAdminChain().catch(() => []);
  const eligibleAdmin = admin.filter((p) => !params.file || p.capabilities.includes('vision'));
  const envEntries: Array<{ id: string; client: OpenAI | null; fixedModel?: string; dbId?: string }> = [
    { id: 'google', client: geminiClient },
    { id: 'openrouter', client: openRouterClient },
    { id: 'groq', client: groqClient }
  ];
  const chain: Array<{ id: string; client: OpenAI | null; fixedModel?: string; dbId?: string }> = [
    ...eligibleAdmin.map((p) => ({ id: p.id, client: p.client, fixedModel: p.model, dbId: p.dbId })),
    // envFallback=false is honoured only when an admin provider can serve the request
    ...(settings?.ai?.envFallback === false && eligibleAdmin.length > 0 ? [] : envEntries),
  ].slice(chainFrom);

  let lastErr: any = null;

  for (const entry of chain) {
    if (!entry.client) continue;

    for (let round = 0; round < 2; round++) {
    try {
      return await withCircuitBreaker(entry.id, async () => {
        let providerModel = entry.fixedModel || sanitizeModelIdForProvider(model, entry.id);
        
        // FIX: If falling back to Groq, use a Groq-compatible model
        if (entry.id === 'groq') {
          providerModel = toGroqModel(model, providerModel);
        }

        const result = await executeProviderRequest(entry.client!, entry.id, {
          model: providerModel,
          messages: params.messages,
          temperature: params.temperature,
          // Groq counts the requested output against its per-minute token budget (8k on the free
          // tier): a 4k-token prompt asking for 8k out is refused outright (413), so cap it there.
          maxTokens: entry.id === 'groq' ? groqMaxOutput(params.messages, params.maxTokens) : params.maxTokens,
          tools: params.tools,
          response_format,
          onStream: params.onStream,
          file: params.file,
          reasoningEffort: params.reasoningEffort,
        }, params.signal);

        const responseTimeMs = Date.now() - startTime;
        if (entry.dbId) recordProviderOutcome(entry.dbId, true, null, responseTimeMs);
        const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

        const response: LLMResponse = {
          content: result.content,
          finishReason: result.finishReason,
          provider: entry.id,
          tool_calls: result.tool_calls,
          _meta: {
            mode: 'system',
            // what actually answered (a fallback provider runs its own model)
            model_used: providerModel,
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
          await setCachedResponse(getCacheKey(params.messages, model, params.userConfig?.userId, false, params.sessionContext, params.temperature, params.maxTokens, params.responseMimeType, params.reasoningEffort ? `${params.taskType}|${params.reasoningEffort}` : params.taskType), response);
        }
        return response;
      });
    } catch (err) {
      if (entry.dbId) recordProviderOutcome(entry.dbId, false, err);
      if ((params as any).__noFallback?.()) throw asInterrupted(err, params.signal);
      const msg = (err as any)?.message || String(err);
      const wait = round === 0 && !params.signal?.aborted ? shortWaitMs(err, entry.id) : null;
      if (wait !== null) {
        console.warn(`[AI:System] ${entry.id} is briefly limited — waiting ${(wait / 1000).toFixed(1)}s, then retrying once`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.warn(`[AI:System] ${entry.id} failed (${String(msg).slice(0, 300)}), trying next...`);
      lastErr = err;
      break;
    }
    }
  }

  if (chain.every(entry => !entry.client)) {
    const err = new Error('SYSTEM_NOT_CONFIGURED: No AI provider keys found in environment.');
    (err as any).status = 401;
    throw err;
  }

  throw lastErr || new Error('All system AI providers failed');
}
