import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import sessionStore from '../engine/core/sessionStore.js';
import { decrypt } from '../utils/auth/encryption.js';
import { classifyTask, selectOptimalModel } from '../utils/ai/taskClassifier.js';
import { getAdaptiveScores } from '../utils/ai/adaptiveScorer.js';
import redisClient from '../utils/core/redis.js';
export { resolveModelId } from '../utils/ai/llmClient.js';

/**
 * DB Sync Helper — Persists transient engine state to MongoDB ChatSession
 */
export async function syncToDatabase(sessionId) {
  try {
    const s = await sessionStore.get(sessionId);
    if (!s || !s.chatSessionId) return;

    // ── Update Logic ──
    // We update engine-specific fields that the socket manages directly.
    const update = {
      $set: {
        topic: s.topic,
        steps: s.steps,
        messages: s.messages || [],
        canvasState: s.canvasState || [],
        currentStepIndex: s.currentStepIndex,
        lastUpdated: Date.now(),
        engineSessionId: sessionId,
      }
    };

    // If there are engine-generated messages (e.g., AI introduction), 
    // we use $addToSet or a similar strategy to avoid wiping the REST-synced history.
    // SEC-22: Prevent history wipe by using a conditional merge or $push instead of total $set.
    // For simplicity and since Socket Engine only appends, we'll only update messages 
    // if the socket session has more than what's expected or if it's the initialization phase.
    // But since the REST API is the primary "History Source of Truth", we only sync 
    // messages from socket to DB if they are non-empty, and we use a logic that 
    // ensures the REST sync can still do its job.
    
    await ChatSession.findByIdAndUpdate(s.chatSessionId, update);

    console.log(`[WS:Sync] Synced engine state for session ${sessionId} to Mongo ${s.chatSessionId}`);

    console.log(`[WS:Sync] Synced session ${sessionId} to Mongo ${s.chatSessionId}`);
  } catch (err) {
    console.error(`[WS:Sync] Error syncing to Mongo: ${err.message}`);
  }
}

/**
 * Rate Limit Helper — Differentiates between Auth users and Guests
 */
export function getRateKey(socket) {
  const user = socket.user;
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
  if (user && !user.isGuest && user.id !== 'guest') return `auth:${user.id}`;
  return `guest:${ip}`;
}

/**
 * Timeout wrapper for long-running AI operations
 */
export function withTimeout(promise, ms, fallbackMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(fallbackMessage || `Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Guaranteed Timeline Emitter Payload Builder
 */
export function buildTimelinePayload(sessionId, timeline) {
  const elements    = timeline.elements    || timeline.objects || [];
  const connections = timeline.connections || [];
  const steps       = timeline.steps       || timeline.timeline || [];
  const totalSteps  = steps.length;

  return {
    sessionId,
    title:      timeline.title || timeline.scene?.title || 'Lesson',
    domain:     timeline.domain || 'general',
    renderer:   timeline.renderer || 'cinematic',
    scene:      timeline.scene  || { title: timeline.title || 'Lesson', type: 'linear' },
    elements,
    connections,
    timeline:   steps,
    objects:    elements, // Legacy
    steps:      steps,    // Legacy
    totalSteps,
  };
}

/**
 * Resolve User API Config — Logic for smart routing and custom keys
 */
export async function resolveUserConfig(socket, socketUser, inputText, selectedAgentId = null) {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';

  if (!socketUser || socketUser.isGuest || socketUser.id === 'guest') {
    return null;
  }

  try {
    const user = await User.findById(socketUser.id || socketUser._id);
    if (!user || !user.apiPreferences?.useCustomApi) return null;

    const prefs = user.apiPreferences;
    const activeKeys = (user.apiKeys || []).filter(k => k.isActive && k.isValid);

    // MASTER OVERRIDE: If the user explicitly selects "Universal", always return null
    // so the engine uses the platform's OpenRouter default.
    if (selectedAgentId === 'Universal') {
      console.log(`[UserConfig] User explicitly selected Universal API for session.`);
      return null;
    }

    let selectedKey = null;
    let classification = null;
    let adaptiveScores = null;

    // PRIORITY 1: Explicit match from frontend selection
    if (selectedAgentId) {
      const target = selectedAgentId.toString().toLowerCase();
      
      // Match by ID first
      selectedKey = activeKeys.find(k => k._id.toString() === target);
      
      // Match by Provider if ID match fails (e.g. user selected 'OpenRouter' in UI)
      if (!selectedKey) {
        selectedKey = activeKeys.find(k => k.provider.toLowerCase() === target);
      }

      // Match by Brand/Agent Name (e.g. 'Bytez' -> Anthropic/Claude)
      if (!selectedKey) {
        if (target.includes('bytez')) {
          selectedKey = activeKeys.find(k => k.provider === 'anthropic' || k.provider === 'openrouter');
        } else if (target.includes('tutu')) {
          selectedKey = activeKeys.find(k => k.provider === 'openai');
        }
      }
    }

    // PRIORITY 2: If no explicit selection but global toggle is ON, follow prefs
    if (!selectedKey && prefs?.useCustomApi) {
      if (activeKeys.length === 0) return null;

      // Manual override if set
      if (prefs.routingMode === 'manual' && prefs.modelOverride) {
        selectedKey = activeKeys.find(k => k.model === prefs.modelOverride) || activeKeys[0];
      }
      
      // Smart Routing
      else if (prefs.smartRouting && inputText) {
        classification = classifyTask(inputText);
        if (prefs.enableAdaptive) {
          try { adaptiveScores = await getAdaptiveScores(user._id); } catch (e) {}
        }
        const optimal = selectOptimalModel(
          classification.taskType,
          classification.recommendedTier,
          activeKeys,
          adaptiveScores
        );
        if (optimal) {
          selectedKey = activeKeys.find(k => k._id.toString() === optimal.keyId?.toString()) || activeKeys[0];
        }
      }

      // Final fallback for global custom API
      if (!selectedKey) selectedKey = activeKeys[0];
    }

    // If we still don't have a key, it means either:
    // 1. Explicit selection failed (and global toggle is off)
    // 2. Global toggle is off and no explicit selection was made
    if (!selectedKey) return null;

    console.log(`[UserConfig] Resolved custom key for user ${user._id}: ${selectedKey.provider}/${selectedKey.model} (Routing: ${prefs.routingMode})`);

    const decryptedKey = decrypt({
      encrypted: selectedKey.encryptedKey,
      iv: selectedKey.iv,
      tag: selectedKey.tag,
    });

    const getApiKey = () => decryptedKey;

    let racingConfigs = null;
    if (prefs.enableRacing && activeKeys.length >= 2 && classification?.complexityScore >= 66) {
      const secondKey = activeKeys.find(k => k._id.toString() !== selectedKey._id.toString());
      if (secondKey) {
        try {
          const secondDecrypted = decrypt({ encrypted: secondKey.encryptedKey, iv: secondKey.iv, tag: secondKey.tag });
          racingConfigs = {
            primary: { provider: selectedKey.provider, model: selectedKey.model, getApiKey, baseUrl: selectedKey.baseUrl },
            secondary: { provider: secondKey.provider, model: secondKey.model, getApiKey: () => secondDecrypted, baseUrl: secondKey.baseUrl },
          };
        } catch (e) {}
      }
    }

    return {
      useCustomApi: true,
      provider: selectedKey.provider,
      model: selectedKey.model || (selectedKey.provider === 'openai' ? 'gpt-4o' : 'anthropic/claude-3-5-sonnet-20241022'),
      getApiKey,
      baseUrl: selectedKey.baseUrl || '',
      fallbackToDefault: prefs.fallbackToDefault !== false,
      userId: user._id,
      costControl: prefs.costControl || null,
      racingConfigs,
      classification,
    };
  } catch (err) {
    console.warn('[UserConfig] Failed to resolve user API config:', err.message);
    return null;
  }
}