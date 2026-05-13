import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import sessionStore from '../engine/core/sessionStore.js';
import { decrypt } from '../utils/auth/encryption.js';
import { classifyTask, selectOptimalModel } from '../utils/ai/taskClassifier.js';
import { getAdaptiveScores } from '../utils/ai/adaptiveScorer.js';
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
    // NOTE: Messages are NOT synced here — they are written directly to the
    // ChatMessage collection by sessionStore.addMessage() and sessionRepository.addMessage().
    // This prevents the dual-storage split where socket messages went to the embedded
    // array and HTTP messages went to ChatMessage (causing invisible message silos).
    const update = {
      $set: {
        topic: s.topic,
        title: s.topic,
        steps: s.steps,
        canvasSteps: s.steps,
        canvasState: s.canvasState || [],
        currentStepIndex: s.currentStepIndex,
        lastUpdated: Date.now(),
        engineSessionId: sessionId,
      }
    };

    await ChatSession.findByIdAndUpdate(s.chatSessionId, update);

    console.log(`[WS:Sync] Synced engine state for session ${sessionId} to Mongo ${s.chatSessionId}`);
  } catch (err) {
    console.error(`[WS:Sync] Error syncing to Mongo: ${err.message}`);
  }
}

/**
 * Emit the latest learner profile to the client
 */
export async function emitProfile(socket, sessionId) {
  try {
    const s = await sessionStore.get(sessionId);
    if (s && s.learnerProfile) {
      // Hardening: Ensure topicsMastery is a clean object for the frontend.
      // Mongoose Maps require explicit conversion before being emitted via socket.
      let topicsMastery = s.learnerProfile.topicsMastery || {};
      
      if (topicsMastery instanceof Map) {
        topicsMastery = Object.fromEntries(topicsMastery);
      } else if (topicsMastery.toObject && typeof topicsMastery.toObject === 'function') {
        // Mongoose Map specific conversion
        topicsMastery = topicsMastery.toObject();
      }

      const safeProfile = {
        ...s.learnerProfile,
        topicsMastery
      };
      
      console.log(`[WS:Profile] Emitting mastery update for ${s.userId || 'guest'}`);
      socket.emit('teaching:profile', safeProfile);
    }
  } catch (err) {
    console.warn('[WS:Profile] Failed to emit profile:', err.message);
  }
}

/**
 * Extract normalized IP address from socket or request
 */
export function getIp(socketOrReq) {
  const rawIp = socketOrReq?.handshake 
    ? (socketOrReq.handshake.headers['x-forwarded-for'] || socketOrReq.handshake.address || 'unknown')
    : (socketOrReq?.ip || 'unknown');
  return rawIp.split(',')[0].trim();
}

/**
 * Rate Limit Helper — Differentiates between Auth users and Guests
 */
export function getRateKey(socket) {
  const user = socket.user;
  const ip = getIp(socket);
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
    // ── Cinematic enrichment passthrough ──────────────────────────────────
    cameraTimeline:     timeline.cameraTimeline || [],
    narrationTimeline:  timeline.narrationTimeline || [],
    playbackTimeline:   timeline.playbackTimeline || null,
    interactions:       timeline.interactions || [],
    viewportState:      timeline.viewportState || null,
    expansionGraph:     timeline.expansionGraph || [],
    cinematicMeta:      timeline.cinematicMeta || null,
  };
}

/**
 * Resolve User API Config — Logic for smart routing and custom keys
 */
export async function resolveUserConfig(socketOrReq, socketUser, inputText, selectedAgentId = null) {
  const ip = getIp(socketOrReq);

  if (!socketUser || socketUser.isGuest || socketUser.id === 'guest') {
    return {
      useCustomApi: false,
      mode: 'system',
      userId: `guest_${ip}`,
      provider: 'openrouter'
    };
  }

  try {
    const user = await User.findById(socketUser.id || socketUser._id);
    if (!user) return null;

    const prefs = user.apiPreferences || {};
    const activeKeys = (user.apiKeys || []).filter(k => k.isActive && k.isValid);
    
    console.log(`[UserConfig] Resolving config for user ${user._id}. Active keys: ${activeKeys.length}, Global Toggle: ${prefs.useCustomApi}, SelectedAgent: ${selectedAgentId}`);

    // MASTER OVERRIDE: If the user explicitly selects "Universal", always return null
    // so the engine uses the platform's OpenRouter default.
    if (selectedAgentId === 'Universal') {
      console.log(`[UserConfig] User explicitly selected Universal API. Using platform default.`);
      return null;
    }

    // PRIORITY 0: If an explicit agent is selected, we ALWAYS try to use it 
    // even if the global useCustomApi toggle is OFF. This allows per-session overrides.
    let selectedKey = null;
    if (selectedAgentId) {
      const target = selectedAgentId.toString().toLowerCase();
      selectedKey = activeKeys.find(k => k._id.toString() === target);

      if (selectedKey) {
        console.log(`[UserConfig] Found explicit agent match for ID ${target}: ${selectedKey.label}`);
      }
    }

    // PRIORITY 0.5: If no ID match but we have a selectedAgentId, try provider/brand matching
    if (!selectedKey && selectedAgentId && selectedAgentId !== 'Universal') {
      const target = selectedAgentId.toString().toLowerCase();
      selectedKey = activeKeys.find(k => k.provider.toLowerCase() === target);
      
      if (!selectedKey) {
        if (target.includes('bytez')) {
          selectedKey = activeKeys.find(k => k.provider === 'anthropic' || k.provider === 'openrouter');
        } else if (target.includes('tutu')) {
          selectedKey = activeKeys.find(k => k.provider === 'openai');
        }
      }

      if (selectedKey) {
        console.log(`[UserConfig] Found explicit agent match via provider/brand for "${selectedAgentId}": ${selectedKey.label}`);
      } else {
        // PRIORITY 0.7: Smart provider matching for model names
        const modelLower = target.toLowerCase();
        if (modelLower.includes('gemini')) {
          selectedKey = activeKeys.find(k => k.provider === 'google' || k.provider === 'openrouter');
        } else if (modelLower.includes('gpt')) {
          selectedKey = activeKeys.find(k => k.provider === 'openai' || k.provider === 'openrouter');
        } else if (modelLower.includes('claude')) {
          selectedKey = activeKeys.find(k => k.provider === 'anthropic' || k.provider === 'openrouter');
        } else if (modelLower.includes('llama')) {
          selectedKey = activeKeys.find(k => k.provider === 'groq' || k.provider === 'openrouter');
        } else if (modelLower.includes('deepseek')) {
          selectedKey = activeKeys.find(k => k.provider === 'deepseek' || k.provider === 'openrouter');
        }
        
        if (selectedKey) {
          console.log(`[UserConfig] Smart-matched model "${selectedAgentId}" to provider: ${selectedKey.provider}`);
        }
      }
    }

    // If no explicit selection was made (or it failed), check the global toggle
    if (!selectedKey && !prefs.useCustomApi) {
      return null;
    }

    let classification = null;
    let adaptiveScores = null;

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

    const getApiKey = () => decrypt({
      encrypted: selectedKey.encryptedKey,
      iv: selectedKey.iv,
      tag: selectedKey.tag,
    });

    let racingConfigs = null;
    if (prefs.enableRacing && activeKeys.length >= 2 && classification?.complexityScore >= 66) {
      const secondKey = activeKeys.find(k => k._id.toString() !== selectedKey._id.toString());
      if (secondKey) {
        try {
          racingConfigs = {
            primary: { provider: selectedKey.provider, model: selectedKey.model, getApiKey, baseUrl: selectedKey.baseUrl },
            secondary: { 
              provider: secondKey.provider, 
              model: secondKey.model, 
              getApiKey: () => decrypt({ encrypted: secondKey.encryptedKey, iv: secondKey.iv, tag: secondKey.tag }), 
              baseUrl: secondKey.baseUrl 
            },
          };
        } catch (e) {}
      }
    }

    return {
      useCustomApi: true,
      mode: 'custom',
      provider: selectedKey.provider,
      model: selectedKey.model || (() => {
        // FIX: Per-provider safe defaults — 'anthropic/...' is an OpenRouter path, wrong for other providers
        const defaults = {
          openai: 'gpt-4o',
          google: 'gemini-1.5-flash',
          groq: 'llama-3.3-70b-versatile',
          anthropic: 'claude-3-5-haiku-20241022',
          deepseek: 'deepseek-chat',
          openrouter: 'anthropic/claude-3.5-sonnet',
          custom: '',
        };
        return defaults[selectedKey.provider] || '';
      })(),
      getApiKey,
      baseUrl: selectedKey.baseUrl || '',
      // ⛔ No fallbackToDefault — Custom mode is fully isolated from system APIs
      userId: user._id,
      name: user.name,
      nickname: user.settings?.general?.nickname || user.name.split(' ')[0],
      role: user.settings?.general?.role || 'student',
      customInstructions: user.settings?.general?.preferences || '',
      costControl: prefs.costControl || null,
      racingConfigs,
      classification,
    };
  } catch (err) {
    console.warn('[UserConfig] Failed to resolve user API config:', err.message);
    // Even if we fail to resolve custom keys, we might still want the user profile for system API mode
    if (socketUser && !socketUser.isGuest) {
      try {
        const user = await User.findById(socketUser.id || socketUser._id);
        if (user) {
          return {
            useCustomApi: false,
            userId: user._id,
            name: user.name,
            nickname: user.settings?.general?.nickname || user.name.split(' ')[0],
            role: user.settings?.general?.role || 'student',
            customInstructions: user.settings?.general?.preferences || '',
          };
        }
      } catch (e) {}
    }
    return null;
  }
}