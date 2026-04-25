/**
 * API Keys Controller v3
 * 
 * CRUD + validation + usage queries + health monitoring + cost status
 * Security hardened with input validation
 */

import User from '../models/User.js';
import UsageLog from '../models/UsageLog.js';
import { encrypt, decrypt, maskApiKey } from '../utils/auth/encryption.js';
import { validateApiKey, PROVIDER_MODELS } from '../utils/validation/apiValidator.js';
import { validateApiKeyInput, validateProviderInput, validateModelInput, validateBaseUrlInput, sanitizeForLog } from '../utils/validation/logSanitizer.js';
import { circuitBreaker } from '../engine/core/circuitBreaker.js';

/**
 * GET /api/apikeys/dashboard
 * Unified dashboard data: keys + preferences + usage stats + universal usage
 */
export const getApiKeyDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [perProviderUsage, universalUsageRaw, totals] = await Promise.all([
      UsageLog.aggregate([
        { $match: { userId: req.user._id, isCustomKey: true, timestamp: { $gte: startOfMonth } } },
        { $group: {
          _id: { provider: '$provider', model: '$model' },
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
          lastUsed: { $max: '$timestamp' },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
        }},
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, isCustomKey: false, timestamp: { $gte: startOfMonth } } },
        { $group: {
          _id: '$model',
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
        }}
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$tokensUsed' },
          totalCost: { $sum: '$costEstimate' },
          avgResponseTime: { $avg: '$responseTimeMs' },
          failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
        }}
      ])
    ]);

    // Define tier-based limits for universal models to show usage bars
    const UNIVERSAL_LIMITS = {
      'gpt-4o': 50,
      'gpt-4o-mini': 200,
      'gemini-1.5-pro': 50,
      'gemini-1.5-flash': 300,
      'claude-3-5-sonnet': 50,
      'claude-3-opus': 20,
      'default': 100
    };

    const universalBreakdown = universalUsageRaw.map(u => {
      const limit = UNIVERSAL_LIMITS[u._id] || UNIVERSAL_LIMITS.default;
      return {
        model: u._id || 'unknown',
        requests: u.requests,
        tokens: u.tokens,
        costCents: u.cost,
        limit,
        percent: Math.min(100, Math.round((u.requests / limit) * 100))
      };
    });

    const totalUniversalRequests = universalUsageRaw.reduce((sum, u) => sum + u.requests, 0);
    const totalUniversalCost = universalUsageRaw.reduce((sum, u) => sum + u.cost, 0);
    const UNIVERSAL_TOTAL_LIMIT = 1000;

    const keys = (user.apiKeys || []).map(k => {
      const usage = perProviderUsage.find(u => u._id.provider === k.provider && u._id.model === k.model) || { requests: 0, tokens: 0, cost: 0 };
      return {
        id: k._id, 
        provider: k.provider, 
        model: k.model,
        label: k.label || `${k.provider} Key`,
        isActive: k.isActive, 
        isValid: k.isValid,
        baseUrl: k.baseUrl || '',
        maskedKey: k.maskedKey || '••••••••••••••••',
        usage: { requests: usage.requests, tokens: usage.tokens, costCents: usage.cost }
      };
    });

    res.json({
      keys,
      preferences: user.apiPreferences || {},
      usage: totals[0] || { totalRequests: 0, totalTokens: 0, totalCost: 0, avgResponseTime: 0 },
      universal: {
        requests: totalUniversalRequests,
        costCents: totalUniversalCost,
        limit: UNIVERSAL_TOTAL_LIMIT,
        percent: Math.min(100, Math.round((totalUniversalRequests / UNIVERSAL_TOTAL_LIMIT) * 100)),
        breakdown: universalBreakdown
      }
    });
  } catch (err) {
    console.error('[ApiKeys] Dashboard error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * GET /api/apikeys
 * List user's API keys (masked, never raw)
 */
export const getApiKeys = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch per-provider usage for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [perProviderUsage, universalUsageRaw] = await Promise.all([
      UsageLog.aggregate([
        { $match: { userId: req.user._id, isCustomKey: true, timestamp: { $gte: startOfMonth } } },
        { $group: {
          _id: { provider: '$provider', model: '$model' },
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
          lastUsed: { $max: '$timestamp' },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
        }},
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, isCustomKey: false, timestamp: { $gte: startOfMonth } } },
        { $group: {
          _id: null,
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
        }}
      ])
    ]);

    const universal = universalUsageRaw[0] || { requests: 0, tokens: 0, cost: 0 };
    const UNIVERSAL_LIMIT = 500; // Proposed monthly limit for universal credits

    const keys = (user.apiKeys || []).map(k => {
      // Match usage data to this key
      const usage = perProviderUsage.find(
        u => u._id.provider === k.provider && u._id.model === k.model
      ) || { requests: 0, tokens: 0, cost: 0, lastUsed: null, failures: 0 };

      return {
        id: k._id,
        provider: k.provider,
        model: k.model,
        label: k.label || `${k.provider} key`,
        baseUrl: k.baseUrl || '',
        isActive: k.isActive,
        isValid: k.isValid,
        isLowCredits: k.isLowCredits,
        isExpired: k.isExpired,
        lastValidated: k.lastValidated,
        createdAt: k.createdAt,
        maskedKey: k.maskedKey || '****', // SEC-03: Use stored mask instead of decrypting in loop
        // Per-key usage stats for this month
        usage: {
          requests: usage.requests,
          tokens: usage.tokens,
          costCents: usage.cost,
          lastUsed: usage.lastUsed,
          failures: usage.failures,
        },
      };
    });

    const preferences = user.apiPreferences || {
      useCustomApi: false, fallbackToDefault: true, smartRouting: false,
      enableRacing: false, enableAdaptive: false, routingMode: 'auto',
      modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true },
    };

    res.json({ 
      keys, 
      preferences,
      universalUsage: {
        requests: universal.requests,
        tokens: universal.tokens,
        costCents: universal.cost,
        limit: UNIVERSAL_LIMIT,
        percent: Math.min(100, Math.round((universal.requests / UNIVERSAL_LIMIT) * 100))
      }
    });
  } catch (err) {
    console.error('[ApiKeys] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
};

/**
 * POST /api/apikeys
 * Add and validate a new API key (security hardened)
 */
export const addApiKey = async (req, res) => {
  try {
    const { provider, apiKey, model, label, baseUrl } = req.body;

    // Input validation
    const providerCheck = validateProviderInput(provider);
    if (!providerCheck.valid) return res.status(400).json({ error: providerCheck.error });

    const keyCheck = validateApiKeyInput(apiKey);
    if (!keyCheck.valid) return res.status(400).json({ error: keyCheck.error });

    const modelCheck = validateModelInput(model);
    if (!modelCheck.valid) return res.status(400).json({ error: modelCheck.error });

    if (provider === 'custom') {
      const urlCheck = validateBaseUrlInput(baseUrl);
      if (!urlCheck.valid) return res.status(400).json({ error: urlCheck.error });
    }

    // Step 1: Validate the key
    console.log(`[ApiKeys] Validating ${provider} key for user ${req.user.id}...`);
    const validation = await validateApiKey(provider, apiKey, model, baseUrl);
    console.log(`[ApiKeys] Validation result:`, validation);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'API key validation failed',
        details: validation.error,
        latencyMs: validation.latencyMs,
      });
    }

    // RESET CIRCUIT: Since the key is now validated, we can safely reset the circuit 
    // for this provider to clear any previous "All circuits are open" states.
    circuitBreaker.reset(provider);

    // Step 2: Encrypt
    console.log(`[ApiKeys] Encrypting key...`);
    const encrypted = encrypt(apiKey);

    // Step 3: Store
    console.log(`[ApiKeys] Fetching user ${req.user.id}...`);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error(`[ApiKeys] User ${req.user.id} not found in DB`);
      return res.status(404).json({ error: 'User not found' });
    }

    const keyData = {
      provider,
      encryptedKey: encrypted.encrypted,
      iv: encrypted.iv,
      tag: encrypted.tag,
      model: model || '',
      label: label || `${provider} Key`,
      maskedKey: maskApiKey(apiKey),
      baseUrl: baseUrl || '',
      isActive: true,
      isValid: true,
      lastValidated: new Date(),
      createdAt: new Date(),
    };

    user.apiKeys.push(keyData);

    if (!user.apiPreferences) user.apiPreferences = {};
    user.apiPreferences.useCustomApi = true;
    await user.save();

    const newKey = user.apiKeys[user.apiKeys.length - 1];

    console.log(`[ApiKeys] ✅ ${provider} key validated and stored for user ${req.user.id} (${validation.latencyMs}ms)`);

    res.json({
      success: true,
      message: `${provider} API key validated and saved`,
      latencyMs: validation.latencyMs,
      key: {
        id: newKey._id,
        provider: newKey.provider,
        model: newKey.model,
        label: newKey.label,
        maskedKey: newKey.maskedKey,
        isActive: true,
        isValid: true,
      },
    });
  } catch (err) {
    console.error('[ApiKeys] POST error:', err);
    res.status(500).json({ 
      error: 'Failed to save API key', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * PUT /api/apikeys/:id
 */
export const updateApiKey = async (req, res) => {
  try {
    const { model, label, isActive, baseUrl, apiKey } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const key = user.apiKeys.id(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found' });

    // If a new API key string is provided, validate and encrypt it
    if (apiKey && apiKey.trim() && !apiKey.includes('****')) {
      console.log(`[ApiKeys] Re-validating updated ${key.provider} key...`);
      const validation = await validateApiKey(key.provider, apiKey.trim(), model || key.model, baseUrl || key.baseUrl);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Updated API key validation failed',
          details: validation.error
        });
      }

      const encrypted = encrypt(apiKey.trim());
      key.encryptedKey = encrypted.encrypted;
      key.iv = encrypted.iv;
      key.tag = encrypted.tag;
      key.maskedKey = maskApiKey(apiKey.trim());
      key.isValid = true;
      key.lastValidated = new Date();

      // IMPORTANT: Reset the circuit breaker so the new key works immediately without restarting the server
      // circuitBreaker is already imported at top level
      if (circuitBreaker) {
        circuitBreaker.reset(key.provider);
      }
    }

    if (model !== undefined) key.model = model;
    if (label !== undefined) key.label = label;
    if (isActive !== undefined) key.isActive = isActive;
    if (baseUrl !== undefined) key.baseUrl = baseUrl;

    await user.save();
    res.json({ success: true, message: 'API key updated successfully' });
  } catch (err) {
    console.error('[ApiKeys] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update API key' });
  }
};

/**
 * DELETE /api/apikeys/:id
 */
export const deleteApiKey = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const key = user.apiKeys.id(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found' });

    key.deleteOne();
    if (user.apiKeys.length === 0) {
      if (!user.apiPreferences) user.apiPreferences = {};
      user.apiPreferences.useCustomApi = false;
    }
    await user.save();
    res.json({ success: true, message: 'API key removed' });
  } catch (err) {
    console.error('[ApiKeys] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
};

/**
 * PUT /api/apikeys/preferences
 * Update all API preferences (extended)
 */
export const updatePreferences = async (req, res) => {
  try {
    const {
      useCustomApi, smartRouting,
      enableRacing, enableAdaptive, routingMode, modelOverride,
      costControl,
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.apiPreferences) user.apiPreferences = {};
    const p = user.apiPreferences;

    if (useCustomApi !== undefined) p.useCustomApi = useCustomApi;
    // fallbackToDefault is deprecated — custom mode is fully isolated
    if (smartRouting !== undefined) p.smartRouting = smartRouting;
    if (enableRacing !== undefined) p.enableRacing = enableRacing;
    if (enableAdaptive !== undefined) p.enableAdaptive = enableAdaptive;
    if (routingMode !== undefined && ['auto', 'manual'].includes(routingMode)) p.routingMode = routingMode;
    if (modelOverride !== undefined) p.modelOverride = String(modelOverride).substring(0, 128);

    // Cost control sub-document
    if (costControl && typeof costControl === 'object') {
      if (!p.costControl) p.costControl = {};
      if (costControl.monthlyLimitCents !== undefined) p.costControl.monthlyLimitCents = Math.max(0, Number(costControl.monthlyLimitCents) || 0);
      if (costControl.warningThresholdPct !== undefined) p.costControl.warningThresholdPct = Math.min(100, Math.max(10, Number(costControl.warningThresholdPct) || 80));
      if (costControl.hardStop !== undefined) p.costControl.hardStop = !!costControl.hardStop;
    }

    await user.save();
    res.json({ success: true, preferences: user.apiPreferences });
  } catch (err) {
    console.error('[ApiKeys] Preferences error:', err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

/**
 * GET /api/apikeys/usage
 * Usage analytics (enhanced)
 */
export const getUsageStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totals, byProvider, byDay, recentLogs] = await Promise.all([
      UsageLog.aggregate([
        { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$tokensUsed' },
          totalCost: { $sum: '$costEstimate' },
          avgResponseTime: { $avg: '$responseTimeMs' },
          failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
          fallbackCount: { $sum: { $cond: ['$wasFallback', 1, 0] } },
        }},
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: '$provider',
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
          avgLatency: { $avg: '$responseTimeMs' },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
        }},
        { $sort: { requests: -1 } },
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          requests: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$costEstimate' },
        }},
        { $sort: { _id: 1 } },
      ]),
      UsageLog.aggregate([
        { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$model', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      period: '30d',
      totals: totals[0] || { totalRequests: 0, totalTokens: 0, totalCost: 0, avgResponseTime: 0, failedRequests: 0, fallbackCount: 0 },
      byProvider, dailyUsage: byDay, topModels: recentLogs,
    });
  } catch (err) {
    console.error('[ApiKeys] Usage stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
};

/**
 * GET /api/apikeys/health
 * Provider health status from circuit breaker + usage data
 */
export const getHealthStatus = async (req, res) => {
  try {
    const cbHealth = circuitBreaker.getHealthReport();

    // Also pull last 24h stats from UsageLog per provider
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dbHealth = await UsageLog.aggregate([
      { $match: { 
        userId: req.user._id,
        timestamp: { $gte: twentyFourHoursAgo } 
      } },
      { $group: {
        _id: '$provider',
        requests24h: { $sum: 1 },
        failures24h: { $sum: { $cond: ['$success', 0, 1] } },
        avgLatency24h: { $avg: '$responseTimeMs' },
        lastRequest: { $max: '$timestamp' },
      }},
    ]);

    // Merge circuit breaker state with DB stats
    const health = {};
    for (const [pid, cb] of Object.entries(cbHealth)) {
      const db = dbHealth.find(d => d._id === pid) || {};
      health[pid] = {
        ...cb,
        requests24h: db.requests24h || 0,
        failures24h: db.failures24h || 0,
        avgLatency24h: Math.round(db.avgLatency24h || 0),
        lastRequest: db.lastRequest || null,
        successRate24h: db.requests24h > 0
          ? Math.round(((db.requests24h - (db.failures24h || 0)) / db.requests24h) * 100)
          : 100,
      };
    }

    res.json({ health, timestamp: new Date() });
  } catch (err) {
    console.error('[ApiKeys] Health error:', err.message);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
};

/**
 * GET /api/apikeys/cost-status
 * Current month spend vs. limit
 */
export const getCostStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [result] = await UsageLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: startOfMonth }, isCustomKey: true } },
      { $group: { _id: null, totalSpend: { $sum: '$costEstimate' }, totalRequests: { $sum: 1 }, totalTokens: { $sum: '$tokensUsed' } } },
    ]);

    const costControl = user.apiPreferences?.costControl || {};
    const currentSpendCents = result?.totalSpend || 0;
    const limitCents = costControl.monthlyLimitCents || 0;
    const warningPct = costControl.warningThresholdPct || 80;

    res.json({
      currentSpendCents,
      limitCents,
      usagePercent: limitCents > 0 ? Math.round((currentSpendCents / limitCents) * 100) : 0,
      isWarning: limitCents > 0 && currentSpendCents >= (limitCents * warningPct / 100),
      isExceeded: limitCents > 0 && costControl.hardStop && currentSpendCents >= limitCents,
      totalRequests: result?.totalRequests || 0,
      totalTokens: result?.totalTokens || 0,
      period: 'current_month',
    });
  } catch (err) {
    console.error('[ApiKeys] Cost status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cost status' });
  }
};

/**
 * GET /api/apikeys/models
 */
export const getModels = async (_req, res) => {
  res.json(PROVIDER_MODELS);
};

/**
 * POST /api/apikeys/:id/test
 * Re-validate an existing API key without deleting it
 */
export const testApiKey = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const key = user.apiKeys.id(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found' });

    // Decrypt and validate
    const rawKey = decrypt({ encrypted: key.encryptedKey, iv: key.iv, tag: key.tag });
    const validation = await validateApiKey(key.provider, rawKey, key.model, key.baseUrl);

    // Update validation status
    key.isValid = validation.valid;
    if (!validation.valid && (validation.error?.toLowerCase().includes('expired') || validation.error?.toLowerCase().includes('balance'))) {
      key.isExpired = true;
    } else if (validation.valid) {
      key.isExpired = false;
    }
    
    key.lastValidated = new Date();
    
    // RESET CIRCUIT: If validation passed, reset the circuit breaker for this provider
    if (validation.valid) {
      circuitBreaker.reset(key.provider);
    }
    
    await user.save();

    res.json({
      valid: validation.valid,
      latencyMs: validation.latencyMs,
      error: validation.error || null,
    });
  } catch (err) {
    console.error('[ApiKeys] Test error:', err.message);
    res.status(500).json({ error: 'Failed to test API key' });
  }
};
/**
 * POST /api/apikeys/test-transient
 * Validate a key WITHOUT saving it first
 */
export const testTransientKey = async (req, res) => {
  try {
    const { provider, apiKey, model, baseUrl } = req.body;
    console.log(`[ApiKeys:Transient] Starting test for ${provider}. Model: ${model || 'default'}`);

    if (!apiKey) return res.status(400).json({ error: 'API key is required' });
    if (!provider) return res.status(400).json({ error: 'Provider is required' });

    const validation = await validateApiKey(provider, apiKey, model, baseUrl);
    console.log(`[ApiKeys:Transient] Validation finished for ${provider}. Valid: ${validation.valid}`);

    res.json({
      valid: validation.valid,
      latencyMs: validation.latencyMs,
      error: validation.error || null,
      details: validation.error,
      suggestions: validation.suggestions || [],
      status: validation.status || (validation.valid ? 'valid' : 'invalid'),
    });
  } catch (err) {
    console.error('[ApiKeys:Transient] CRITICAL ERROR:', err);
    res.status(500).json({ 
      error: 'Validation engine failure', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};
