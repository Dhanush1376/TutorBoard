/**
 * LLM Client v3.0 — Intelligent Multi-Provider Orchestration Engine
 * 
 * Features:
 *   1. Response metadata (_meta) on every response
 *   2. Parallel response racing for high-complexity prompts
 *   3. User cost control enforcement (monthly limits)
 *   4. AbortController timeouts on all requests
 *   5. In-memory response cache (LRU, 50 entries, 5min TTL)
 *   6. Security-sanitized logging
 *   7. Adaptive scoring integration
 *   8. Automatic failover with transparent metadata
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { circuitBreaker } from '../../engine/core/circuitBreaker.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createProviderClient, executeProviderRequest, calculateCost, estimateCost } from './providerFactory.js';
import { classifyTask } from './taskClassifier.js';
import UsageLog from '../../models/UsageLog.js';
import { sanitizeString } from '../validation/logSanitizer.js';

// ── Default OpenRouter client ─────────────────────────────────────────────────
let openRouterClient = null;

const initClients = () => {
  if (!openRouterClient && process.env.OPENROUTER_API_KEY) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://tutorboard.app',
        'X-Title': 'TutorBoard',
      }
    });
    console.log('[AI] OpenRouter Engine Initialized ✅');
  }
};

// ── Response Cache (LRU) ──────────────────────────────────────────────────────
const CACHE_MAX = 50;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const responseCache = new Map();

function getCacheKey(messages, model, userId, isCustomKey) {
  const raw = JSON.stringify(messages) + '|' + model + '|' + (userId || 'anon') + '|' + (!!isCustomKey);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  // Move to end (LRU)
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.response;
}

function setCachedResponse(key, response) {
  // Evict oldest if at capacity
  if (responseCache.size >= CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { response, timestamp: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveModelId(modelId) {
  if (!modelId || modelId === 'OpenRouter' || modelId === 'OpenRouterAI') {
    return getModel();
  }
  const mapping = {
    'Bytez': 'anthropic/claude-opus-4-5',
    'Bytez (Opus)': 'anthropic/claude-opus-4-5'
  };
  return mapping[modelId] || modelId;
}

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode || 0;
  if (status === 401 || msg.includes('invalid') || msg.includes('unauthorized')) return 'invalid_key';
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'rate_limit';
  if (status === 402 || msg.includes('insufficient') || msg.includes('quota') || msg.includes('credit')) return 'quota';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) return 'timeout';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused')) return 'network';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Log usage (fire-and-forget)
 */
function logUsage({ userId, provider, model, usage, responseTimeMs, taskType, success, errorType, isCustomKey, wasFallback, costCents }) {
  try {
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const tokensUsed = usage?.total_tokens || (promptTokens + completionTokens);
    const cost = costCents ?? estimateCost(provider, model, promptTokens, completionTokens);

    UsageLog.create({
      userId, provider, model, tokensUsed, promptTokens, completionTokens,
      responseTimeMs, taskType: taskType || 'unknown',
      success: success !== false, errorType: errorType || 'none',
      costEstimate: cost, currency: 'USD', unit: 'cents',
      isCustomKey: !!isCustomKey, wasFallback: !!wasFallback,
    }).catch(() => {});
  } catch (e) {
    // Never let logging break the pipeline
  }
}

/**
 * Check user's monthly cost against their limit
 * @returns {{ allowed: boolean, currentSpendCents: number, limitCents: number, warning: boolean }}
 */
async function checkCostLimit(userId, costControl) {
  if (!userId || !costControl || !costControl.monthlyLimitCents || costControl.monthlyLimitCents <= 0) {
    return { allowed: true, currentSpendCents: 0, limitCents: 0, warning: false };
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [result] = await UsageLog.aggregate([
      { $match: { userId, timestamp: { $gte: startOfMonth }, isCustomKey: true } },
      { $group: { _id: null, totalCost: { $sum: '$costEstimate' } } },
    ]);

    const currentSpendCents = result?.totalCost || 0;
    const limitCents = costControl.monthlyLimitCents;
    const warningThreshold = (costControl.warningThresholdPct || 80) / 100;

    if (costControl.hardStop && currentSpendCents >= limitCents) {
      return { allowed: false, currentSpendCents, limitCents, warning: true };
    }

    return {
      allowed: true,
      currentSpendCents,
      limitCents,
      warning: currentSpendCents >= (limitCents * warningThreshold),
    };
  } catch (err) {
    // On error, allow the request (don't block on monitoring failure)
    return { allowed: true, currentSpendCents: 0, limitCents: 0, warning: false };
  }
}

// ── Request timeout ───────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 60_000;

function createTimeoutController(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer), controller };
}

// ── Execute with retry ────────────────────────────────────────────────────────
async function executeWithRetry(client, provider, params, maxRetries = 2, signal) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeProviderRequest(client, provider, params, signal);
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      const errorType = classifyError(err);
      if (errorType === 'invalid_key' || errorType === 'quota') throw err;
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 500;
        console.warn(`[AI:${sanitizeString(provider)}] Attempt ${attempt + 1} failed. Retrying in ${backoff}ms...`);
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Robust LLM Call — Multi-Provider Orchestration Engine v3
 * 
 * Strategy:
 *   1. Check cost limits (if custom key + cost control enabled)
 *   2. Check response cache for identical prompts
 *   3. If userConfig → use user's custom key with timeout
 *   4. On failure → retry up to 2x with backoff
 *   5. On persistent failure → fallback to platform default
 *   6. Attach _meta to every response
 *   7. Log every attempt
 */
export async function requestCompletion({ model, messages, temperature, maxTokens, tools, responseSchema, responseMimeType, userConfig, taskType, onStream }) {
  initClients();

  const startTime = Date.now();
  const userId = userConfig?.userId || null;

  // ── Prepare response format ──
  let response_format;
  const isJson = responseMimeType === 'application/json' || !!responseSchema;
  if (responseSchema) {
    response_format = {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: false,
        schema: zodToJsonSchema(responseSchema, "root").definitions?.root || zodToJsonSchema(responseSchema)
      }
    };
  } else if (isJson) {
    response_format = { type: "json_object" };
  }

  // ── Cost limit check ──
  if (userConfig?.useCustomApi && userConfig?.costControl) {
    const costCheck = await checkCostLimit(userId, userConfig.costControl);
    if (!costCheck.allowed) {
      const err = new Error(`COST_LIMIT_EXCEEDED: Monthly spend $${(costCheck.currentSpendCents / 100).toFixed(2)} exceeds limit $${(costCheck.limitCents / 100).toFixed(2)}`);
      err.costWarning = true;
      err.currentSpendCents = costCheck.currentSpendCents;
      err.limitCents = costCheck.limitCents;
      throw err;
    }
  }

  // ── Cache check ──
  const isCustomKey = !!userConfig?.useCustomApi;
  const cacheKey = getCacheKey(messages, model, userId, isCustomKey);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    console.log('[AI:Cache] Cache hit — returning cached response');
    return { ...cached, _meta: { ...cached._meta, cached: true } };
  }

  // ── Strategy 1: User's Custom API Key ──
  if (userConfig?.useCustomApi && userConfig?.getApiKey && userConfig?.provider) {
    const provider = userConfig.provider;
    const userModel = userConfig.model || model;

    if (circuitBreaker.isAvailable(provider)) {
      const timeout = createTimeoutController(DEFAULT_TIMEOUT_MS);

      try {
        console.log(`[AI:${provider}] Calling: ${userModel} (JSON: ${isJson})`);

        const client = createProviderClient(provider, userConfig.getApiKey(), userConfig.baseUrl);
        const result = await executeWithRetry(client, provider, {
          model: userModel, messages, temperature, maxTokens, tools, response_format, onStream
        }, 2, timeout.signal);

        timeout.cleanup();
        const responseTimeMs = Date.now() - startTime;
        circuitBreaker.reportSuccess(provider, responseTimeMs);

        const usage = result.usage || {};
        const cost = calculateCost(userModel, usage.prompt_tokens || 0, usage.completion_tokens || 0);

        // Log success
        logUsage({ userId, provider, model: userModel, usage, responseTimeMs, taskType, success: true, isCustomKey: true, costCents: cost.costCents });

        const response = {
          content: result.content,
          finishReason: result.finishReason,
          provider,
          tool_calls: result.tool_calls || null,
          _meta: {
            model_used: userModel,
            provider_used: provider,
            fallback_triggered: false,
            response_time_ms: responseTimeMs,
            estimated_cost_cents: cost.costCents,
            tokens_in: usage.prompt_tokens || 0,
            tokens_out: usage.completion_tokens || 0,
            pricing_version: cost.pricingVersion,
            cached: false,
          },
        };

        setCachedResponse(cacheKey, response);
        return response;
      } catch (err) {
        timeout.cleanup();
        if (err.name === 'AbortError') {
          console.warn(`[AI:${provider}] Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
        }
        const errorType = classifyError(err);
        console.warn(`[AI:${provider}] User key failed: ${sanitizeString(err.message)} (${errorType})`);
        circuitBreaker.reportFailure(provider, err.status || 500, errorType);

        logUsage({ userId, provider, model: userModel, responseTimeMs: Date.now() - startTime, taskType, success: false, errorType, isCustomKey: true });

        if (!userConfig.fallbackToDefault) throw err;
        console.log('[AI] Falling back to platform default (OpenRouter)...');
      }
    } else {
      console.warn(`[AI:${provider}] Circuit is OPEN. Falling back to default.`);
    }
  }

  // ── Strategy 2: Platform Default (OpenRouter) ──
  const orModel = resolveModelId(model);
  const fallbackStart = Date.now();
  const wasFallback = !!userConfig?.useCustomApi;

  if (!openRouterClient) throw new Error('NO_API_AVAILABLE: OpenRouter client not initialized. Check .env');
  if (!circuitBreaker.isAvailable('openrouter')) throw new Error('SERVICE_UNAVAILABLE: All circuits are open.');

  const timeout = createTimeoutController(DEFAULT_TIMEOUT_MS);

  try {
    console.log(`[AI:OpenRouter] Calling: ${orModel}${wasFallback ? ' [FALLBACK]' : ''}`);

    const completionParams = {
      model: orModel, messages, temperature: temperature ?? 0.1,
      max_tokens: maxTokens ?? 1000,
      tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
      response_format,
      stream: !!onStream,
    };

    const completion = await openRouterClient.chat.completions.create(completionParams, { signal: timeout.signal });

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
        // Grab usage if it arrives in the final chunk (OpenRouter sometimes sends it)
        if (chunk.usage) usage = chunk.usage;
      }
      msg = { content: finalContent };
    } else {
      msg = completion.choices?.[0]?.message;
      usage = completion.usage || {};
      finalContent = msg?.content || '';
      finishReason = completion.choices?.[0]?.finish_reason || 'stop';
      tool_calls = msg?.tool_calls || null;
    }
    timeout.cleanup();
    const responseTimeMs = Date.now() - fallbackStart;
    circuitBreaker.reportSuccess('openrouter', responseTimeMs);
    const cost = calculateCost(orModel, usage?.prompt_tokens || 0, usage?.completion_tokens || 0);

    logUsage({ userId, provider: 'openrouter', model: orModel, usage: usage || {}, responseTimeMs, taskType, success: true, isCustomKey: false, wasFallback, costCents: cost.costCents });

    const response = {
      content: finalContent,
      finishReason: finishReason,
      provider: 'openrouter',
      tool_calls: tool_calls,
      _meta: {
        model_used: orModel,
        provider_used: 'openrouter',
        fallback_triggered: wasFallback,
        response_time_ms: responseTimeMs,
        estimated_cost_cents: cost.costCents,
        tokens_in: usage?.prompt_tokens || 0,
        tokens_out: usage?.completion_tokens || 0,
        pricing_version: cost.pricingVersion,
        cached: false,
      },
    };

    setCachedResponse(cacheKey, response);
    return response;
  } catch (err) {
    timeout.cleanup();
    const errorType = classifyError(err);
    const isCredits = err.message?.includes('402');
    const orStatus = isCredits ? 402 : (err.status || 500);
    console.error(`[AI:OpenRouter] Error: ${sanitizeString(err.message)}`);
    circuitBreaker.reportFailure('openrouter', orStatus, errorType);

    logUsage({ userId, provider: 'openrouter', model: orModel, responseTimeMs: Date.now() - fallbackStart, taskType, success: false, errorType, isCustomKey: false, wasFallback });

    const customErr = new Error('OpenRouter Fail: ' + sanitizeString(err.message));
    customErr.status = orStatus;
    throw customErr;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARALLEL RESPONSE RACING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Race two providers in parallel for high-complexity prompts
 * Returns the fastest valid response.
 * 
 * @param {object} params — Same as requestCompletion params
 * @param {object} primaryConfig — { provider, model, key, baseUrl }
 * @param {object} secondaryConfig — { provider, model, key, baseUrl }
 * @returns {Promise<object>} — Winning response with _meta
 */
export async function requestCompletionRaced(params, primaryConfig, secondaryConfig) {
  const { messages, temperature, maxTokens, tools, responseSchema, responseMimeType, taskType, userConfig } = params;
  const userId = userConfig?.userId || null;
  const startTime = Date.now();

  let response_format;
  const isJson = responseMimeType === 'application/json' || !!responseSchema;
  if (responseSchema) {
    response_format = { type: "json_schema", json_schema: { name: "structured_output", strict: false, schema: zodToJsonSchema(responseSchema, "root").definitions?.root || zodToJsonSchema(responseSchema) } };
  } else if (isJson) {
    response_format = { type: "json_object" };
  }

  const racers = [primaryConfig, secondaryConfig].filter(Boolean);
  if (racers.length < 2) {
    // Not enough providers to race — just use normal path
    return requestCompletion(params);
  }

  const RACE_TIMEOUT = 30_000;

  const racePromises = racers.map(async (config, idx) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RACE_TIMEOUT);

    try {
      const client = createProviderClient(config.provider, config.getApiKey(), config.baseUrl);
      const result = await executeProviderRequest(client, config.provider, {
        model: config.model, messages, temperature, maxTokens, tools, response_format,
      }, controller.signal);

      clearTimeout(timer);
      const responseTimeMs = Date.now() - startTime;
      circuitBreaker.reportSuccess(config.provider, responseTimeMs);

      const usage = result.usage || {};
      const cost = calculateCost(config.model, usage.prompt_tokens || 0, usage.completion_tokens || 0);

      logUsage({ userId, provider: config.provider, model: config.model, usage, responseTimeMs, taskType, success: true, isCustomKey: true, costCents: cost.costCents });

      return {
        content: result.content,
        finishReason: result.finishReason,
        provider: config.provider,
        tool_calls: result.tool_calls || null,
        _meta: {
          model_used: config.model,
          provider_used: config.provider,
          fallback_triggered: false,
          response_time_ms: responseTimeMs,
          estimated_cost_cents: cost.costCents,
          tokens_in: usage.prompt_tokens || 0,
          tokens_out: usage.completion_tokens || 0,
          racing: true,
          racer_index: idx,
          cached: false,
        },
      };
    } catch (err) {
      clearTimeout(timer);
      const errorType = classifyError(err);
      circuitBreaker.reportFailure(config.provider, err.status || 500, errorType);
      logUsage({ userId, provider: config.provider, model: config.model, responseTimeMs: Date.now() - startTime, taskType, success: false, errorType, isCustomKey: true });
      throw err;
    }
  });

  try {
    // Return first successful response
    const winner = await Promise.any(racePromises);
    console.log(`[AI:Race] Winner: ${winner._meta.provider_used}/${winner._meta.model_used} in ${winner._meta.response_time_ms}ms`);
    return winner;
  } catch (err) {
    // All racers failed — fallback to normal path
    console.warn('[AI:Race] All racers failed, falling back to normal path');
    return requestCompletion(params);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export const getModel = () => process.env.AI_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
export const getTextModel = () => process.env.AI_TEXT_MODEL || 'anthropic/claude-3.5-sonnet';

export const getModelForAgent = (agent) => {
  if (!agent) return null;
  const mapping = {
    'Bytez': 'anthropic/claude-opus-4-5',
    'Bytez (Opus)': 'anthropic/claude-opus-4-5',
    'OpenRouter': getModel(),
    'OpenRouterAI': getModel(),
  };
  return mapping[agent] || null;
};

export const getAIClient = () => { initClients(); return openRouterClient; };

export async function getEmbeddings(text) {
  initClients();
  if (!openRouterClient) throw new Error('NO_API_AVAILABLE: OpenAI/OpenRouter client not initialized.');
  try {
    const response = await openRouterClient.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error(`[AI:Embeddings] Error: ${sanitizeString(err.message)}`);
    return null;
  }
}
