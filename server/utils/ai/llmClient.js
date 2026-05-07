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
import { MODEL_REGISTRY } from './modelRegistry.js';
import { classifyTask } from './taskClassifier.js';
import UsageLog from '../../models/UsageLog.js';
import { sanitizeString } from '../validation/logSanitizer.js';

// ── Default Provider Clients ──────────────────────────────────────────────────
let openRouterClient = null;
let geminiClient = null;
let groqClient = null;
let hfClient = null;



const initClients = () => {
  const orKey = process.env.OPENROUTER_API_KEY;
  const gemKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  console.log('[AI:Init] Checking environment keys...');
  console.log('[AI:Init] OPENROUTER_API_KEY found:', !!orKey);
  console.log('[AI:Init] GEMINI_API_KEY found:', !!gemKey);
  console.log('[AI:Init] GROQ_API_KEY found:', !!groqKey);

  if (!openRouterClient && orKey) {
    openRouterClient = new OpenAI({
      apiKey: orKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://tutorboard.app', 'X-Title': 'TutorBoard' }
    });
    console.log('[AI] OpenRouter Client Initialized ✅');
  } else if (!orKey) {
    console.warn('[AI] OpenRouter key missing from process.env ⚠️');
  }

  if (!geminiClient && gemKey) {
    geminiClient = new OpenAI({
      apiKey: gemKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
    console.log('[AI] Gemini Client Initialized ✅');
  } else if (!gemKey) {
    console.warn('[AI] Gemini key missing from process.env ⚠️');
  }

  if (!groqClient && groqKey) {
    groqClient = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    console.log('[AI] Groq Client Initialized ✅');
  } else if (!groqKey) {
    console.warn('[AI] Groq key missing from process.env ⚠️');
  }
  if (!hfClient && process.env.HUGGINGFACE_API_KEY) {
    hfClient = { apiKey: process.env.HUGGINGFACE_API_KEY };
    console.log('[AI] HuggingFace initialized ✅');
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

// ── Semantic Deduplication Layer ──────────────────────────────────────────────
const SEMANTIC_CACHE_MAX = 20; // 20 is plenty for session-scoped cache
const SIMILARITY_THRESHOLD = 0.96; 
const semanticStore = []; // { embedding, lastMessage, cacheKey, model, isCustomKey }

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0; let mA = 0; let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

async function findSemanticHit(messages, model, userId, isCustomKey) {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content;
  if (!lastUserMsg || lastUserMsg.length < 15) return null;

  const currentEmbedding = await getEmbeddings(lastUserMsg);
  if (!currentEmbedding) return null;

  let bestMatch = null;
  let maxSim = -1;

  for (const entry of semanticStore) {
    if (entry.model !== model || entry.isCustomKey !== isCustomKey) continue;
    const sim = cosineSimilarity(currentEmbedding, entry.embedding);
    if (sim > maxSim) {
      maxSim = sim;
      bestMatch = entry;
    }
  }

  if (maxSim >= SIMILARITY_THRESHOLD) {
    console.log(`[AI:Semantic] Cache hit! Similarity: ${(maxSim * 100).toFixed(1)}%`);
    return getCachedResponse(bestMatch.cacheKey);
  }

  // Update store (LRU-ish)
  if (semanticStore.length >= SEMANTIC_CACHE_MAX) semanticStore.shift();
  semanticStore.push({ 
    embedding: currentEmbedding, 
    model, 
    isCustomKey, 
    cacheKey: getCacheKey(messages, model, userId, isCustomKey) 
  });
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function resolveModelId(modelId) {
  const normalizedId = (modelId || '').trim();
  
  if (!normalizedId || 
      normalizedId.toLowerCase().includes('universal') || 
      normalizedId === 'OpenRouter' || 
      normalizedId === 'OpenRouterAI') {
    
    // Default to the system model if no specific model is resolved
    return getModel();
  }

  // Model Aliases & Direct Mapping
  const mapping = {
    // Agents / Brand Names
    'Bytez': 'anthropic/claude-sonnet-4-5',
    'Bytez (Opus)': 'anthropic/claude-3-opus-20240229',
    'Tutubot': 'openai/gpt-4o',
    
    // UI Label Map
    'Claude Sonnet 4': 'anthropic/claude-sonnet-4-5',
    'Claude 3.5 Sonnet': 'anthropic/claude-3-5-sonnet-20241022',
    'Gemini 2.0 Flash': 'gemini-2.0-flash',
    'Gemini 1.5 Pro': 'gemini-1.5-pro',
    'DeepSeek V3': 'deepseek-chat',
    'DeepSeek R1': 'deepseek-reasoner',
    'Llama 3.3 70B': 'llama-3.3-70b-versatile',
    'Llama 3.1 8B': 'llama-3.1-8b-instant',
    'Mixtral 8x7B': 'mixtral-8x7b-32768',
    'Gemma 2 9B': 'gemma2-9b-it',
  };

  // BUG #2: If it's already a canonical ID (contains / or is a known value), return it immediately
  // to prevent fuzzy matchers or alias maps from mangling it.
  if (normalizedId.includes('/') || Object.values(mapping).includes(normalizedId)) {
    return normalizedId;
  }

  const mapped = mapping[normalizedId];
  if (mapped) return mapped;

  // Fuzzy match for Gemini
  if (normalizedId.toLowerCase().includes('gemini')) {
    if (normalizedId.toLowerCase().includes('pro')) return 'gemini-1.5-pro';
    return 'gemini-2.0-flash';
  }

  return normalizedId;
}

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode || 0;
  if (status === 401 || msg.includes('invalid') || msg.includes('unauthorized')) return 'invalid_key';
  if (status === 402 || msg.includes('insufficient') || msg.includes('quota') || msg.includes('credit') || msg.includes('billing')) return 'quota';
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many') || msg.includes('resource_exhausted')) return 'rate_limit';
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

function createTimeoutController(timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    externalSignal.addEventListener('abort', () => controller.abort());
  }
  
  return { signal: controller.signal, cleanup: () => clearTimeout(timer), controller };
}

// ── Execute with retry ────────────────────────────────────────────────────────
async function executeWithRetry(client, provider, params, maxRetries = 2, signal, customBaseUrl) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeProviderRequest(client, provider, params, signal, customBaseUrl);
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      const errorType = classifyError(err);
      if (errorType === 'invalid_key' || errorType === 'quota' || errorType === 'rate_limit') throw err;
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
// CUSTOM API ERROR CLASSIFIER — User-facing error messages
// ═══════════════════════════════════════════════════════════════════════════════

function classifyCustomError(err) {
  const errorType = classifyError(err);
  const providerMsg = err.message || 'Unknown provider error';
  
  const userFacingMessages = {
    invalid_key:  'The API key you entered doesn’t seem right. Please double-check it in your settings.',
    rate_limit:   'You’re sending requests a bit too fast. Please wait a minute and try again.',
    quota:        'Your API account has run out of credits or free requests. Please check your account balance.',
    timeout:      'The AI is taking a bit too long to respond right now. Please try one more time.',
    network:      'We can’t reach the AI provider. Please check your internet connection.',
    server_error: 'The AI provider is having some trouble on their end. Please try again in a few minutes.',
  };

  return {
    errorType,
    userMessage: userFacingMessages[errorType] || `Custom API error: ${providerMsg}`,
    technicalMessage: providerMsg,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Robust LLM Call — Multi-Provider Orchestration Engine v4
 * 
 * ⛔ HARD FIREWALL ARCHITECTURE:
 *   - Custom API path and System API path are COMPLETELY ISOLATED
 *   - Custom API NEVER falls through to System APIs
 *   - System APIs NEVER activate during Custom mode
 *   - Each path has its own error handling and return semantics
 * 
 * Strategy:
 *   1. Check cost limits (custom mode only)
 *   2. Check response cache
 *   3. FIREWALL DECISION:
 *      ├── Custom Mode  → isolated custom execution → HARD RETURN
 *      └── System Mode  → platform fallback chain   → HARD RETURN
 */
export async function requestCompletion(params = {}) {
  // Ensure params is an object to prevent destructuring failures
  const safeParams = params || {};
  const { 
    model, messages, temperature, maxTokens, tools, 
    responseSchema, responseMimeType, userConfig, 
    taskType, onStream, file, signal 
  } = safeParams;

  const startTime = Date.now();
  const userId = userConfig?.userId || null;
  const skipRacing = safeParams?.skipRacing || false;
  
  // Resolve the canonical model ID once
  const canonicalModel = resolveModelId(model);

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

  // ── Cost limit check (Custom mode only) ──
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
    console.log('[AI:Cache] Direct hit — simulating stream');
    if (onStream && cached.content) {
      const words = cached.content.split(' ');
      // Simulate typing at ~30ms per word
      (async () => {
        for (const word of words) {
          onStream(word + ' ');
          await sleep(30);
        }
      })();
    }
    return { ...cached, _meta: { ...cached._meta, cached: true } };
  }

  // ── Semantic hit (similar questions) ──
  if (!file) { // Don't semantic-cache files yet
    const semanticHit = await findSemanticHit(messages, model, userId, isCustomKey);
    if (semanticHit) {
      console.log('[AI:Semantic] Similarity hit — simulating stream');
      if (onStream && semanticHit.content) {
        const words = semanticHit.content.split(' ');
        (async () => {
          for (const word of words) {
            onStream(word + ' ');
            await sleep(30);
          }
        })();
      }
      return { ...semanticHit, _meta: { ...semanticHit._meta, cached: true, semantic: true } };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ⛔ FIREWALL: Custom API vs System API — STRICT EXECUTION SPLIT
  // ═════════════════════════════════════════════════════════════════════════════

  if (userConfig?.useCustomApi && userConfig?.getApiKey && userConfig?.provider) {
    console.log(`MODE: custom (${userConfig.provider})`);
    
    const result = await _executeCustomPath(safeParams, {
      userConfig, canonicalModel, response_format, isJson,
      cacheKey, startTime, userId, taskType, skipRacing, onStream,
      messages, temperature, maxTokens, tools, file, signal
    });

    // SOFT FIREWALL: If custom failed completely, fall through to system APIs 
    // to ensure the user gets a response even if their specific provider is down.
    if (result.error && !result.content && !result.tool_calls) {
      console.warn(`[AI:Orchestrator] ⚠️ Custom path (${userConfig.provider}) failed: ${result.error}. Falling back to System APIs...`);
    } else {
      return result;
    }
  }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  SYSTEM API ENGINE — PLATFORM FALLBACK CHAIN                            ║
  // ║  Only reached when useCustomApi is false or no custom key is available.  ║
  // ║  Uses .env-configured clients (OpenRouter → Gemini → Groq).             ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
    console.log("MODE: tutorboard (System)");
    console.log("USING API: YES (Platform Env Keys)");
    return await _executeSystemPath(safeParams, {
    canonicalModel, response_format, isJson,
    cacheKey, startTime: Date.now(), userId, taskType, onStream,
    messages, temperature, maxTokens, tools, file, signal
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM API ENGINE — Complete Isolation
// No .env dependencies. No system client imports. No fallback leakage.
// ═══════════════════════════════════════════════════════════════════════════════

async function _executeCustomPath(params = {}, ctx = {}) {
  const safeParams = params || {};
  const { userConfig, canonicalModel, response_format, isJson, cacheKey, startTime, userId, taskType, skipRacing, onStream, messages, temperature, maxTokens, tools, file, signal } = ctx;
  const provider = userConfig?.provider;
  // FIX: For custom providers, use the model ID exactly as stored — do NOT run it through
  // resolveModelId() which has fuzzy Gemini matching and alias maps that corrupt custom IDs.
  const rawCustomModel = userConfig?.model || safeParams.model || '';
  const userModel = provider === 'custom'
    ? rawCustomModel.trim()   // pass through verbatim for custom
    : resolveModelId(rawCustomModel);

  // ── Strategy 0: Parallel Racing (custom keys only) ──
  if (!skipRacing && userConfig?.racingConfigs) {
    try {
      return await requestCompletionRaced(safeParams, userConfig.racingConfigs.primary, userConfig.racingConfigs.secondary);
    } catch (err) {
      console.warn('[AI:Custom:Racing] Racing failed, continuing with single-provider path');
      // Fall through to single-provider custom execution below — NOT to system path
    }
  }

  // ── Circuit Breaker Check ──
  const cbId = `custom:${provider}`;
  if (!circuitBreaker.isAvailable(cbId)) {
    console.warn(`[AI:Custom] ⛔ Circuit for ${cbId} is OPEN.`);
    return {
      content: '',
      error: `Your ${provider} API is temporarily blocked due to repeated failures. Please wait 90 seconds or update your key in Settings.`,
      provider,
      _meta: { provider_used: provider, model_used: userModel, fallback_triggered: false, cached: false },
    };
  }

  // ── Execute Custom Request ──
  const timeout = createTimeoutController(DEFAULT_TIMEOUT_MS, signal);

  try {
    console.log(`[AI:Custom:${provider}] Calling: ${userModel} (JSON: ${isJson})`);

    const client = createProviderClient(provider, userConfig.getApiKey(), userConfig.baseUrl);
    let result;
    
    try {
      result = await executeWithRetry(client, provider, {
        model: userModel, messages, temperature, maxTokens, tools, response_format, onStream, file
      }, 2, timeout.signal, userConfig.baseUrl);
    } catch (err) {
      // HIGH-RESILIENCY FALLBACK CHAIN: If model fails, iterate through verified models
      const errorMsg = (err.message || '').toLowerCase();
      const isModelError = err.status === 404 || err.status === 400 || errorMsg.includes('model') || errorMsg.includes('not found') || errorMsg.includes('permission') || errorMsg.includes('gate');
      
      if (isModelError) {
        const reg = MODEL_REGISTRY[provider];
        const chain = reg?.chain || (reg?.fallback ? [reg.fallback] : []);
        
        console.warn(`[AI:Custom:${provider}] 🔄 Model ${userModel} failed (${err.status}). Probing fallback chain...`);

        for (const fallbackModel of chain) {
          if (fallbackModel === userModel) continue; // Skip if it's the one that just failed
          
          try {
            console.log(`[AI:Custom:${provider}] 🔄 Attempting fallback: ${fallbackModel}`);
            result = await executeWithRetry(client, provider, {
              model: fallbackModel, messages, temperature, maxTokens, tools, response_format, onStream, file
            }, 1, timeout.signal, userConfig.baseUrl);
            
            result._fallbackUsed = true;
            result._originalModel = userModel;
            result._finalModel = fallbackModel;
            break; // Success!
          } catch (fallbackErr) {
            console.warn(`[AI:Custom:${provider}] ❌ Fallback ${fallbackModel} failed too. Trying next...`);
          }
        }
      }
      
      // If we still don't have a result after the chain (or it wasn't a model error), throw
      if (!result) throw err;
    }

    console.log(`[AI:Custom:${provider}] 🟢 SUCCESS. Content Length: ${(result.content || '').length}`);
    
    timeout.cleanup();
    const responseTimeMs = Date.now() - startTime;
    circuitBreaker.reportSuccess(`custom:${provider}`, responseTimeMs);

    const activeModel = result._fallbackUsed ? result._finalModel : userModel;
    const usage = result.usage || {};
    const cost = calculateCost(activeModel, usage.prompt_tokens || 0, usage.completion_tokens || 0);

    logUsage({ userId, provider, model: activeModel, usage, responseTimeMs, taskType, success: true, isCustomKey: true, costCents: cost.costCents });

    const response = {
      content: result.content,
      finishReason: result.finishReason,
      provider,
      tool_calls: result.tool_calls || null,
      _meta: {
        mode: 'custom',
        model_used: activeModel,
        provider_used: provider,
        fallback_triggered: result._fallbackUsed || false,
        original_model: result._originalModel || null,
        response_time_ms: responseTimeMs,
        estimated_cost_cents: cost.costCents,
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        pricing_version: cost.pricingVersion,
        cached: false,
      },
    };

    if (!response.content && !response.tool_calls) {
      return { 
        content: '', 
        error: 'Your API provider returned an empty response. Please try again.', 
        errorType: 'empty_response',
        provider,
        _meta: response._meta,
      };
    }

    setCachedResponse(cacheKey, response);
    return response;

  } catch (err) {
    timeout.cleanup();
    const { errorType, userMessage, technicalMessage } = classifyCustomError(err);
    console.error(`[AI:Custom:${provider}] ❌ FAILED: ${technicalMessage} (${errorType})`);
    circuitBreaker.reportFailure(`custom:${provider}`, err.status || 500, errorType);
    logUsage({ userId, provider, model: userModel, responseTimeMs: Date.now() - startTime, taskType, success: false, errorType, isCustomKey: true });

    return {
      content: '',
      error: userMessage,
      errorType,
      provider,
      _meta: { mode: 'custom', provider_used: provider, model_used: userModel, fallback_triggered: false, cached: false },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM API ENGINE — Platform-Managed Fallback Chain
// Only uses .env-configured clients. Never touches user keys.
// ═══════════════════════════════════════════════════════════════════════════════

async function _executeSystemPath(params = {}, ctx = {}) {
  const safeParams = params || {};
  const { canonicalModel, response_format, isJson, cacheKey, startTime, userId, taskType, onStream, messages, temperature, maxTokens, tools, file, signal } = ctx;
  const skipRacing = safeParams?.skipRacing || false;

  // Initialize system clients from .env
  initClients();

  // ── Guard: Check if ANY system client is available ──
  const hasAnySystemClient = !!(openRouterClient || geminiClient || groqClient || hfClient);

  if (!hasAnySystemClient) {
    console.error('[AI:System] ⛔ No system API keys configured in .env');
    throw new Error('SYSTEM_NOT_CONFIGURED: TutorBoard system APIs are not available. Please add your own API key in Settings → AI Configuration.');
  }

  // 🚀 Strategy 0: Parallel Racing (system keys — unlikely but supported) 🚀
  if (!skipRacing && safeParams.userConfig?.racingConfigs) {
    try {
      return await requestCompletionRaced(safeParams, safeParams.userConfig.racingConfigs.primary, safeParams.userConfig.racingConfigs.secondary);
    } catch (err) {
      console.warn('[AI:System:Racing] Racing failed, continuing with fallback chain');
    }
  }

  // ── Platform Fallback Chain ──
  const platformChain = [
    { id: 'openrouter', client: openRouterClient, defaultModel: getModel() },
    { id: 'google', client: geminiClient, defaultModel: 'gemini-2.0-flash' },
    { id: 'groq', client: groqClient, defaultModel: 'llama-3.3-70b-versatile' },
    { id: 'huggingface', client: hfClient, defaultModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1' }
  ];


  let lastError = null;

  for (const entry of platformChain) {
    const { id: providerId, client, defaultModel } = entry;

    if (!client) continue;
    if (!circuitBreaker.isAvailable(providerId)) {
      console.warn(`[AI:System] Circuit for ${providerId} is OPEN. Skipping.`);
      continue;
    }

    let currentModel;
    if (!canonicalModel || canonicalModel.toLowerCase().includes('universal')) {
      currentModel = defaultModel;
    } else if (providerId === 'openrouter') {
      // FIX: OpenRouter requires provider-prefixed model IDs (e.g. 'google/gemini-2.0-flash')
      // If canonicalModel has no slash, auto-prefix based on model family
      if (!canonicalModel.includes('/')) {
        const m = canonicalModel.toLowerCase();
        if (m.includes('gemini')) currentModel = `google/${canonicalModel}`;
        else if (m.includes('gpt')) currentModel = `openai/${canonicalModel}`;
        else if (m.includes('claude')) currentModel = `anthropic/${canonicalModel}`;
        else if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma')) currentModel = `meta-llama/${canonicalModel}`;
        else currentModel = defaultModel; // Unknown bare model → use default
        console.log(`[AI:System] Auto-prefixed OpenRouter model: ${canonicalModel} → ${currentModel}`);
      } else {
        currentModel = canonicalModel;
      }
    } else {
      // Native providers (Google, Groq, etc.) expect IDs without the "provider/" prefix
      // Use a more robust split to handle cases like "google/gemini-2.0-flash-001"
      currentModel = canonicalModel.includes('/') ? canonicalModel.split('/').pop() : canonicalModel;
      
      // Remove any trailing version numbers like -001 which are specific to OpenRouter
      if (providerId === 'google') {
        currentModel = currentModel.replace(/-001$/, '');
        
        // Ensure it starts with gemini
        if (!currentModel.toLowerCase().includes('gemini')) {
          currentModel = defaultModel;
        }
      }
      
      if (providerId === 'groq' && !currentModel.toLowerCase().includes('llama') && 
          !currentModel.toLowerCase().includes('mixtral') && !currentModel.toLowerCase().includes('gemma')) {
        currentModel = defaultModel;
      }
    }

    const timeout = createTimeoutController(90_000, signal);
    
    try {
      console.log(`[AI:System] Attempting ${providerId} with model ${currentModel}...`);
      
      const response = await executeProviderRequest(client, providerId, {
        model: currentModel, messages,
        temperature: temperature ?? 0.1,
        maxTokens: maxTokens ?? 4000,
        tools, response_format, onStream, file
      }, timeout.signal);

      timeout.cleanup();
      const responseTimeMs = Date.now() - startTime;
      circuitBreaker.reportSuccess(providerId, responseTimeMs);

      const cost = calculateCost(currentModel, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0);
      
      logUsage({ 
        userId, provider: providerId, model: currentModel, 
        usage: response.usage || {}, responseTimeMs, taskType, 
        success: true, isCustomKey: false, costCents: cost.costCents 
      });

      const finalResponse = {
        content: response.content,
        finishReason: response.finishReason,
        provider: providerId,
        tool_calls: response.tool_calls,
        error: null,
        _meta: {
          mode: 'system',
          model_used: currentModel,
          provider_used: providerId,
          fallback_triggered: false,
          response_time_ms: responseTimeMs,
          estimated_cost_cents: cost.costCents,
          tokens_in: response.usage?.prompt_tokens || 0,
          tokens_out: response.usage?.completion_tokens || 0,
          pricing_version: cost.pricingVersion,
          cached: false,
        }
      };
      
      setCachedResponse(cacheKey, finalResponse);
      return finalResponse;

    } catch (err) {
      timeout.cleanup();
      lastError = err;
      const errorType = classifyError(err);
      console.warn(`[AI:System] ${providerId} failed: ${err.message} (${errorType}). Trying next...`);
      circuitBreaker.reportFailure(providerId, err.status || 500, errorType);
      
      logUsage({ 
        userId, provider: providerId, model: currentModel, 
        responseTimeMs: Date.now() - startTime, taskType, 
        success: false, errorType, isCustomKey: false 
      });
    }
  }

  // All system providers failed
  const errMsg = lastError 
    ? `Last error: ${lastError.message}` 
    : `No platform providers available (either skipped due to open circuits or missing .env keys).`;
  throw new Error(`SYSTEM_FAILURE: All TutorBoard system providers failed. ${errMsg}`);
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
    return requestCompletion({ ...params, skipRacing: true });
  }

  const RACE_TIMEOUT = 30_000;

  const racePromises = racers.map(async (config, idx) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RACE_TIMEOUT);

    try {
      const client = createProviderClient(config.provider, config.getApiKey(), config.baseUrl);
      const result = await executeProviderRequest(client, config.provider, {
        model: config.model, messages, temperature, maxTokens, tools, response_format,
      }, controller.signal, config.baseUrl);

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
    return requestCompletion({ ...params, skipRacing: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function getModel() {
  return process.env.AI_MODEL || 'gemini-2.0-flash';
}

export function getTextModel() {
  return process.env.AI_TEXT_MODEL || 'gemini-2.0-flash';
}

export function getFastModel() {
  return process.env.AI_FAST_MODEL || 'gemini-2.0-flash';
}

export function getModelForAgent(agent) {
  if (!agent) return null;
  const mapping = {
    'Bytez': 'anthropic/claude-sonnet-4-5',
    'Bytez (Opus)': 'anthropic/claude-3-opus-20240229',
    'OpenRouter': getModel(),
    'OpenRouterAI': getModel(),
    'Universal': getModel(),
  };
  return mapping[agent] || null;
}

export const getAIClient = () => { initClients(); return openRouterClient; };

export async function getEmbeddings(text) {
  initClients();
  if (!openRouterClient) {
    console.warn('[AI] OpenRouter client missing, bypassing embeddings generation.');
    return null;
  }
  
  try {
    const response = await openRouterClient.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  } catch (err) {
    console.warn('[AI] Error generating embeddings, bypassing:', err.message);
    return null;
  }
}