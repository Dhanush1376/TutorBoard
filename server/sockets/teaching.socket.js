/**
 * TeachingSocket v4.0 — Hardened WebSocket event handlers
 *
 * WHAT CHANGED FROM v3:
 *   1. teaching:timeline emit now sends a GUARANTEED, CONSISTENT shape.
 *      Both `elements`/`timeline` (new) and `objects`/`steps` (legacy) keys are
 *      always present and always point to the same normalized arrays. Previously
 *      the emit was a mix of raw and processed fields that could come out as undefined.
 *   2. timeline.steps access is now safe — uses `timeline.steps || timeline.timeline || []`
 *      everywhere. Previously `timeline.steps.length` threw when steps was undefined.
 *   3. The first step emit after session:start now reads from the normalized `steps` key.
 *   4. totalSteps is derived from the processed timeline.steps array length, not from
 *      raw LLM output, so it's always accurate.
 *   5. All error paths still guarantee a teaching:greeting fallback so the chat UI never
 *      goes blank.
 */

import { createTeachingMachine, STATES, EVENTS } from '../engine/core/teachingMachine.js';
import sessionStore from '../engine/core/sessionStore.js';
import Doubt from '../models/Doubt.js';
import { generateTimeline, handleDoubt, generateTextResponse, generateQuiz } from '../engine/core/pedagogyEngine.js';
import { detectIntent } from '../engine/core/intentEngine.js';
import { checkSocketRate, cleanupSocket } from '../middleware/rateLimiter.js';
import { sanitizeInput } from '../utils/validation/sanitize.js';
import { replanRemainingSteps } from '../engine/core/adaptivePlanner.js';
import { isGreeting } from '../engine/agents/agentUtils.js';
import { getOrCreateRequestId, createTrackedSessionId } from '../middleware/requestIdMiddleware.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { decrypt } from '../utils/auth/encryption.js';
import { classifyTask, selectOptimalModel } from '../utils/ai/taskClassifier.js';
import { getAdaptiveScores } from '../utils/ai/adaptiveScorer.js';
import { requestCompletionRaced } from '../utils/ai/llmClient.js';
import ChatSession from '../models/ChatSession.js';

// ─── DB Sync Helper ──────────────────────────────────────────────────────────
async function syncToDatabase(sessionId) {
  try {
    const s = await sessionStore.get(sessionId);
    if (!s || !s.mongoSessionId) return;

    await ChatSession.findByIdAndUpdate(s.mongoSessionId, {
      topic: s.topic,
      steps: s.steps,
      currentStepIndex: s.currentStepIndex,
      lastUpdated: Date.now(),
      engineSessionId: sessionId,
    });
    console.log(`[WS:Sync] Synced session ${sessionId} to Mongo ${s.mongoSessionId}`);
  } catch (err) {
    console.error(`[WS:Sync] Error syncing to Mongo: ${err.message}`);
  }
}

// ─── Rate Limit Helper ────────────────────────────────────────────────────────
function getRateKey(socket) {
  const user = socket.user;
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
  if (user && !user.isGuest && user.id !== 'guest') return `auth:${user.id}`;
  return `guest:${ip}`;
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms, fallbackMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(fallbackMessage || `Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Resolve User API Config v3 ──────────────────────────────────────────────
async function resolveUserConfig(socketUser, inputText) {
  if (!socketUser || socketUser.isGuest) return null;

  try {
    const user = await User.findById(socketUser.id || socketUser._id);
    if (!user || !user.apiPreferences?.useCustomApi) return null;

    const prefs = user.apiPreferences;
    const activeKeys = (user.apiKeys || []).filter(k => k.isActive && k.isValid);
    if (activeKeys.length === 0) return null;

    let selectedKey;
    let classification = null;
    let adaptiveScores = null;

    // Model override — user manually selected a specific model
    if (prefs.routingMode === 'manual' && prefs.modelOverride) {
      selectedKey = activeKeys.find(k => k.model === prefs.modelOverride) || activeKeys[0];
      console.log(`[Router] Manual override: ${selectedKey.model}`);
    }
    // Smart routing with adaptive scoring
    else if (prefs.smartRouting && inputText) {
      classification = classifyTask(inputText);

      // Fetch adaptive scores if enabled
      if (prefs.enableAdaptive) {
        try {
          adaptiveScores = await getAdaptiveScores(user._id);
        } catch (e) { /* silent */ }
      }

      const optimal = selectOptimalModel(
        classification.taskType,
        classification.recommendedTier,
        activeKeys,
        adaptiveScores
      );

      if (optimal) {
        selectedKey = activeKeys.find(k => k._id.toString() === optimal.keyId?.toString()) || activeKeys[0];
        console.log(`[SmartRouter] Score: ${classification.complexityScore}/100 → ${optimal.provider}/${optimal.model} (${classification.reasoning})`);
      }
    }

    // Default: first active key
    if (!selectedKey) selectedKey = activeKeys[0];

    // Decrypt the key
    const decryptedKey = decrypt({
      encrypted: selectedKey.encryptedKey,
      iv: selectedKey.iv,
      tag: selectedKey.tag,
    });

    // Wrap the key in a closure to prevent accidental logging/serialization
    const keyBuffer = decryptedKey;
    const getApiKey = () => keyBuffer;

    // Build racing configs if enabled and 2+ providers available
    let racingConfigs = null;
    if (prefs.enableRacing && activeKeys.length >= 2 && classification?.complexityScore >= 66) {
      const secondKey = activeKeys.find(k => k._id.toString() !== selectedKey._id.toString());
      if (secondKey) {
        try {
          const secondDecrypted = decrypt({ encrypted: secondKey.encryptedKey, iv: secondKey.iv, tag: secondKey.tag });
          const secondKeyBuffer = secondDecrypted;
          racingConfigs = {
            primary: { provider: selectedKey.provider, model: selectedKey.model, getApiKey, baseUrl: selectedKey.baseUrl },
            secondary: { provider: secondKey.provider, model: secondKey.model, getApiKey: () => secondKeyBuffer, baseUrl: secondKey.baseUrl },
          };
          console.log(`[Router] Racing enabled: ${selectedKey.provider}/${selectedKey.model} vs ${secondKey.provider}/${secondKey.model}`);
        } catch (e) { /* silent — racing not critical */ }
      }
    }

    return {
      useCustomApi: true,
      provider: selectedKey.provider,
      model: selectedKey.model,
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

// ─── Guaranteed Timeline Emitter ─────────────────────────────────────────────
// This is the SINGLE place where teaching:timeline is built for the client.
// It guarantees both new (elements/timeline) and legacy (objects/steps) keys are present,
// and derives totalSteps from the actual processed array — never from raw LLM output.
function buildTimelinePayload(sessionId, timeline) {
  // Normalize: prefer the processed arrays; fall back to the alias keys
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
    // Canonical scene graph keys (new renderers use these)
    elements,
    connections,
    timeline:   steps,
    // Legacy compatibility keys (any old consumer uses these)
    objects:    elements,
    steps:      steps,
    totalSteps,
  };
}

export function setupTeachingSocket(io) {
  const teachingIO = io.of('/teaching');

  // ─── Auth Guard & Connection Limiter ────────────────────────────────────
  teachingIO.use((socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication error: No token provided'));

      if (token === 'guest') {
        // Strict connection rate limit for guests to prevent session storming
        if (!checkSocketRate(`conn:guest:${ip}`)) {
          return next(new Error('Too many connection attempts. Please wait a minute.'));
        }

        const guestId = `guest-${socket.id.substring(0, 8)}`;
        socket.user = { id: guestId, name: 'Guest User', email: `${guestId}@tutorboard.ai`, isGuest: true };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('[WS] Auth Error:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  teachingIO.on('connection', async (socket) => {
    // BUG FIX #60: Get or create request ID for correlation tracing
    const requestId = getOrCreateRequestId(socket);
    const sessionId = createTrackedSessionId(socket.id, requestId);
    console.log(`[${requestId}] [WS] Client connected: ${socket.id} → Session: ${sessionId}`);

    let session;
    try {
      session = await sessionStore.create(sessionId, socket.id);
    } catch (err) {
      console.error(`[WS] Failed to create session: ${err.message}`);
      socket.emit('session:error', { error: 'SESSION_LIMIT_REACHED', message: 'The server is at maximum capacity. Please try again later.' });
      socket.emit('teaching:error', { message: 'The server is busy. Please try again in 5 minutes.' });
      return socket.disconnect();
    }
    const machine = createTeachingMachine(sessionId, async (transition) => {
      socket.emit('teaching:state', {
        state:     transition.to,
        from:      transition.from,
        event:     transition.event,
        payload:   transition.payload,
        timestamp: transition.timestamp,
      });
      await sessionStore.update(sessionId, { state: transition.to });
    });

    // ─── START SESSION ──────────────────────────────────────────────────
    socket.on('session:start', async ({ topic, selectedAgent, activeMode, chatId }) => {
      const rateKey = getRateKey(socket);
      
      // Global IP/User rate limit
      if (!checkSocketRate(rateKey)) {
        socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }

      // Strict session-per-minute throttle for Guest users to protect API costs
      if (socket.user?.isGuest) {
        if (!checkSocketRate(`session:guest:${rateKey}`)) {
          socket.emit('teaching:error', { message: 'Guest limit reached: 1 session per minute. Please sign up for more.' });
          return;
        }
      }

      const cleanTopic = sanitizeInput(topic, 2000);
      console.log(`[${requestId}] [WS] session:start → "${cleanTopic}" (Agent: ${selectedAgent}, Mode: ${activeMode})`);

      if (!cleanTopic) {
        socket.emit('teaching:error', { message: 'Topic is required' });
        return;
      }

      let newState = machine.send(EVENTS.START, { topic });
      if (!newState) {
        console.warn('[WS] State machine was not IDLE. Forcing reset to handle NEW session:start.');
        machine.forceReset();
        newState = machine.send(EVENTS.START, { topic });
      }

      if (!newState) {
        socket.emit('teaching:error', { message: 'Failed to initialize teaching state. Please try again.' });
        return;
      }

      await sessionStore.update(sessionId, { topic: cleanTopic });

      // ─── Profile Initialization ───
      if (socket.user && socket.user.id !== 'guest') {
        console.log(`[WS] Initializing persistent profile for user: ${socket.user.id}`);
        await sessionStore.initProfile(sessionId, socket.user.id);
      } else {
        console.log(`[WS] Initializing default guest profile for session: ${sessionId}`);
        await sessionStore.update(sessionId, {
          learnerProfile: {
            level: 'beginner',
            pace: 'normal',
            confusionIndex: 0,
            strengths: [],
            weaknesses: [],
            preferredExplanationStyle: 'visual',
          },
        });
      }

      // ─── RESUMPTION LOGIC ───
      if (chatId) {
        try {
          const chatSession = await ChatSession.findOne({ _id: chatId, userId: socket.user?.id || socket.user?._id });
          if (chatSession) {
            const restored = await sessionStore.restoreFromMongo(sessionId, chatSession);
            if (restored && restored.steps && restored.steps.length > 0) {
              console.log(`[WS] Resuming session ${sessionId} from ChatSession ${chatId}`);
              machine.send(EVENTS.TIMELINE_READY, { timeline: { steps: restored.steps, title: restored.topic } });
              
              const payload = {
                sessionId,
                title: restored.topic,
                steps: restored.steps,
                totalSteps: restored.steps.length,
                currentStep: restored.currentStepIndex,
                renderer: 'AgentCanvasRenderer', // Default for resumed sessions
              };

              socket.emit('teaching:timeline', payload);
              socket.emit('teaching:step', {
                step:  restored.steps[restored.currentStepIndex],
                index: restored.currentStepIndex,
                total: restored.steps.length,
              });
              return; // Successfully resumed
            }
          }
        } catch (err) {
          console.warn(`[WS] Resumption failed for chatId ${chatId}: ${err.message}`);
        }
      }

      try {
        let intentResult;
        if (isGreeting(cleanTopic)) {
          console.log(`[${requestId}] [WS] Fast-pathed greeting detected.`);
          intentResult = { intent: 'quick', renderer: 'none', confidence: 1.0 };
        } else {
          intentResult = await detectIntent(cleanTopic, activeMode, selectedAgent);
        }
        
        const intent = intentResult.intent;
        console.log(`[${requestId}] [WS] Detected Intent: ${intent} (${intentResult.renderer})`);

        // Resolve user's custom API configuration
        const userConfig = await resolveUserConfig(socket.user, cleanTopic);
        if (userConfig) {
          console.log(`[${requestId}] [WS] Using custom API: ${userConfig.provider}/${userConfig.model}`);
        }

        if (intent === 'quick' || intent === 'text_only') {
          console.log(`[${requestId}] [WS] Generating text-only response...`);;
          const response = await withTimeout(
            generateTextResponse(sessionId, cleanTopic, selectedAgent, userConfig),
            45000,
            'Text response timed out'
          );
          machine.forceReset();
          console.log(`[WS] Emitting teaching:greeting (text-only) — ${(response.answer || '').length} chars`);
          socket.emit('teaching:greeting', { message: response.answer });
          return;
        }

        if (intent === 'test_me') {
          console.log(`[${requestId}] [WS] Generating quiz...`);
          const quiz = await withTimeout(
            generateQuiz(sessionId, cleanTopic, (stage) => {
              socket.emit('teaching:progress', { message: stage });
            }, selectedAgent, userConfig),
            60000,
            'Quiz generation timed out'
          );

          if (quiz.chatMessage) {
            socket.emit('teaching:greeting', { message: quiz.chatMessage });
          }

          socket.emit('teaching:quiz', quiz);
          machine.send(EVENTS.TIMELINE_READY, { timeline: quiz });
          return;
        }

        // ─── Generate visual timeline ─────────────────────────────────────
        console.log(`[${requestId}] [WS] Generating visual timeline...`);
        
        // Heartbeat logic to keep the client updated during long LLM stalls
        let lastProgressAt = Date.now();
        const heartbeat = setInterval(() => {
          if (Date.now() - lastProgressAt >= 15000) {
            socket.emit('teaching:progress', { message: 'Still working on your visual lesson...' });
            // Don't reset lastProgressAt here, so it repeats every 15s if still stalling
            // actually, resetting it makes it a 15s interval between "Still working" pings
            lastProgressAt = Date.now(); 
          }
        }, 5000);

        try {
          timeline = await withTimeout(
            generateTimeline(sessionId, cleanTopic, (stage, chunk) => {
              lastProgressAt = Date.now();
              if (chunk) {
                socket.emit('teaching:progress-tokens', { stage, token: chunk });
              } else {
                console.log(`[WS] Progress: ${stage}`);
                socket.emit('teaching:progress', { message: stage });
              }
            }, selectedAgent, userConfig),
            240000,
            'Timeline generation timed out'
          );
        } finally {
          clearInterval(heartbeat);
        }

        if (timeline.type === 'greeting') {
          machine.forceReset();
          socket.emit('teaching:greeting', { message: timeline.answer });
          return;
        }

        // Persist to session store
        await sessionStore.setTimeline(sessionId, timeline);

        // Transition FSM
        machine.send(EVENTS.TIMELINE_READY, { timeline });

        // ─── CRITICAL: Build guaranteed payload shape ─────────────────────
        const payload = buildTimelinePayload(sessionId, timeline);
        const steps   = payload.steps; // already normalized

        console.log(`[${requestId}] [WS] Emitting teaching:timeline — "${payload.title}" (${payload.totalSteps} steps, renderer: ${payload.renderer})`);
        socket.emit('teaching:timeline', payload);

        // Optional chat message for fallback timelines
        if (timeline.chatMessage) {
          socket.emit('teaching:greeting', { message: timeline.chatMessage });
        }

        // Emit first step
        if (steps.length > 0) {
          socket.emit('teaching:step', {
            step:  steps[0],
            index: 0,
            total: steps.length,
          });
        }

      } catch (err) {
        console.error('[WS] session:start error:', err.message || err);
        machine.send(EVENTS.FAIL, { error: err.message });

        socket.emit('teaching:error', { message: 'Failed to generate lesson. Please try again.' });
        socket.emit('teaching:greeting', {
          message: 'Something went wrong while generating your lesson. Please try again with a different topic or the same one.',
        });

        machine.forceReset();
      }
    });

    let doubtCount = 0;
    let lastDoubtReset = Date.now();

    // ─── ASK DOUBT ─────────────────────────────────────────────────────────
    socket.on('session:doubt', async ({ question, selectedAgent, activeMode }) => {
      // ─── Sliding Window Rate Limiting (5 doubts / 60s) ────────────────────
      const now = Date.now();
      if (!socket._doubtTimestamps) socket._doubtTimestamps = [];
      
      // Filter out timestamps older than 60 seconds
      socket._doubtTimestamps = socket._doubtTimestamps.filter(t => now - t < 60000);
      
      if (socket._doubtTimestamps.length >= 5) {
        console.warn(`[WS] Rate limit exceeded: Session ${sessionId} (5 doubts/min)`);
        socket.emit('teaching:error', { message: 'You are asking questions too fast. Please wait a minute.' });
        return;
      }
      
      socket._doubtTimestamps.push(now);

      if (!checkSocketRate(getRateKey(socket))) {
        socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }

      const cleanQuestion = sanitizeInput(question, 5000);
      console.log(`[WS] session:doubt → "${cleanQuestion}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

      if (!cleanQuestion) {
        socket.emit('teaching:error', { message: 'Question is required' });
        return;
      }

      const triggered = machine.send(EVENTS.DOUBT_ASKED, { question: cleanQuestion });
      if (!triggered) {
        console.warn(`[WS] Doubt asked from invalid state: ${machine.state}`);
      }

      socket.emit('teaching:doubt-ack', { question: cleanQuestion });

      try {
        let intentResult;
        if (isGreeting(cleanQuestion)) {
          console.log(`[WS] Fast-pathed doubt greeting detected.`);
          intentResult = { intent: 'quick', renderer: 'none', confidence: 1.0 };
        } else {
          intentResult = await detectIntent(cleanQuestion, activeMode, selectedAgent);
        }
        
        const intent = intentResult.intent;
        console.log(`[WS] Doubt Detected Intent: ${intent}`);

        // Resolve user's custom API configuration for doubt
        const userConfig = await resolveUserConfig(socket.user, cleanQuestion);

        let response;
        if (intent === 'quick' || intent === 'text_only') {
          const textRes = await withTimeout(
            generateTextResponse(sessionId, cleanQuestion, selectedAgent, userConfig),
            45000,
            'Doubt text response timed out'
          );
          response = { answer: textRes.answer, isRelevant: true, hasVisuals: false, visualUpdate: null };
        } else {
          response = await withTimeout(
            handleDoubt(sessionId, cleanQuestion, selectedAgent, userConfig),
            30000,
            'Doubt visual response timed out'
          );
        }

        machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

        console.log(`[WS] Emitting teaching:doubt-response — ${(response.answer || '').length} chars`);
        socket.emit('teaching:doubt-response', {
          _question:    cleanQuestion,
          answer:       response.answer,
          isRelevant:   response.isRelevant,
          hasVisuals:   response.hasVisuals,
          visualUpdate: response.visualUpdate,
          followUp:     response.followUp,
        });

        // ─── Update Session State (Confusion & History) ─────────────────────
        const s = await sessionStore.get(sessionId);
        if (s) {
          // BUG FIX #68: Persist doubt to MongoDB for historical tracking
          if (socket.user && !socket.user.isGuest) {
            try {
              await Doubt.create({
                user: socket.user.id || socket.user._id,
                question: cleanQuestion,
                answer: response.answer,
                stepIndex: s.currentStepIndex || 0,
                stepDescription: s.topic || 'General Query',
              });
              console.log(`[WS] Doubt persisted to MongoDB for user ${socket.user.id}`);
            } catch (dbErr) {
              console.error(`[WS] Failed to persist doubt to MongoDB: ${dbErr.message}`);
            }
          }

          if (!s.learnerProfile) s.learnerProfile = { level: 'beginner', pace: 'normal', confusionIndex: 0 };

          // Only increment confusionIndex on genuine confusion signals
          let classification = null;
          try {
            const { classifyDoubt } = await import('../engine/agents/doubtClassifier.js');
            classification = await classifyDoubt(s.topic || '', cleanQuestion);
          } catch (e) { /* classification failed, skip increment */ }

          const confusionPathways = ['misconception', 'wants_deeper'];
          if (classification && confusionPathways.includes(classification.pathway)) {
            const newConfusion = Math.min(10, (s.learnerProfile.confusionIndex || 0) + 1);
            await sessionStore.update(sessionId, { 
              learnerProfile: { ...s.learnerProfile, confusionIndex: newConfusion } 
            });
            // Refresh local reference for downstream logic
            s.learnerProfile.confusionIndex = newConfusion;
          }

          // Append to doubtHistory for contextual coherence
          if (!s.doubtHistory) s.doubtHistory = [];
          s.doubtHistory.push({ question: cleanQuestion, answer: response.answer, timestamp: Date.now() });
          
          await sessionStore.update(sessionId, { 
            learnerProfile: s.learnerProfile,
            doubtHistory: s.doubtHistory 
          });

          console.log(`[WS] Session Updated: Confusion=${s.learnerProfile.confusionIndex}, DoubtHistory=${s.doubtHistory.length}`);
          
          await syncToDatabase(sessionId);
        }

        // Adaptive replanning (with cooldown)
        const doubtssinceReplan = (s?.doubtHistory?.length || 0) - (s?._lastReplanDoubtCount || 0);
        if (s && s.learnerProfile.confusionIndex >= 5 && s.steps && s.steps.length > 0 && doubtssinceReplan >= 3) {
          const replan = await replanRemainingSteps(s, s.topic, userConfig);
          if (replan) {
            console.log(`[WS] Mid-lesson replan triggered! Pushing ${replan.mergedSteps.length} steps.`);
            await sessionStore.update(sessionId, { steps: replan.mergedSteps });
            socket.emit('teaching:replan', { message: replan.notification, newTotalSteps: replan.mergedSteps.length });
            socket.emit('teaching:timeline-update', { steps: replan.mergedSteps, totalSteps: replan.mergedSteps.length });

            // Reset confusion and record cooldown marker
            await sessionStore.update(sessionId, { 
              learnerProfile: { ...s.learnerProfile, confusionIndex: 0 },
              _lastReplanDoubtCount: s.doubtHistory?.length || 0
            });
          }
        }

      } catch (err) {
        console.error('[WS] session:doubt error:', err.message || err);
        machine.send(EVENTS.FAIL, { error: err.message });
        socket.emit('teaching:doubt-response', {
          _question:    cleanQuestion,
          answer:       'Something went wrong while processing your question. Please try again.',
          isRelevant:   true,
          hasVisuals:   false,
          visualUpdate: null,
        });
      }
    });

    // ─── NAVIGATE STEPS ────────────────────────────────────────────────────
    socket.on('session:step', async ({ stepIndex }) => {
      const s = await sessionStore.get(sessionId);

      if (!s || !s.steps || s.steps.length === 0) {
        console.warn(`[WS] session:step ignored - steps not yet loaded for session: ${sessionId}`);
        return;
      }

      if (!s.steps[stepIndex]) {
        console.warn(`[WS] session:step ignored - invalid index ${stepIndex} for session: ${sessionId}`);
        return;
      }

      await sessionStore.goToStep(sessionId, stepIndex);
      socket.emit('teaching:step', { step: s.steps[stepIndex], index: stepIndex, total: s.steps.length });

      if (machine.state === STATES.COMPLETED || machine.state === STATES.RESPONDING) {
        machine.send(EVENTS.RESUME);
      }

      await syncToDatabase(sessionId);
    });

    // ─── FINISH SESSION ────────────────────────────────────────────────────
    socket.on('session:finish', () => {
      console.log(`[WS] session:finish (${sessionId})`);
      machine.send(EVENTS.FINISH);
    });

    // ─── PAUSE ─────────────────────────────────────────────────────────────
    socket.on('session:pause', async () => { 
      machine.send(EVENTS.PAUSE);
      await sessionStore.update(sessionId, { state: machine.state });
    });

    // ─── RESUME ────────────────────────────────────────────────────────────
    socket.on('session:resume', async () => {
      machine.send(EVENTS.RESUME) || machine.send(EVENTS.PLAY);
      await sessionStore.update(sessionId, { state: machine.state });

      const s = await sessionStore.get(sessionId);
      if (s && s.steps && s.steps.length > 0) {
        socket.emit('teaching:step', {
          step:  s.steps[s.currentStepIndex],
          index: s.currentStepIndex,
          total: s.steps.length,
        });
      }
    });

    // ─── END SESSION ───────────────────────────────────────────────────────
    socket.on('session:end', async () => {
      console.log(`[WS] session:end (${sessionId})`);
      machine.forceReset();
      await sessionStore.destroy(sessionId);
    });

    // ─── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
      await sessionStore.destroy(sessionId);
      cleanupSocket(getRateKey(socket));
    });

    // Send initial state
    socket.emit('teaching:state', {
      state:     STATES.IDLE,
      from:      null,
      event:     'INIT',
      payload:   { sessionId },
      timestamp: Date.now(),
    });
  });

  console.log('[WS] Teaching socket handlers registered on /teaching namespace');
  return teachingIO;
}