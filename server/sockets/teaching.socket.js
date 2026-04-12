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
import { generateTimeline, handleDoubt, generateTextResponse } from '../engine/core/pedagogyEngine.js';
import { detectIntent } from '../engine/core/intentEngine.js';
import { checkSocketRate, cleanupSocket } from '../middleware/rateLimiter.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { replanRemainingSteps } from '../engine/core/adaptivePlanner.js';
import jwt from 'jsonwebtoken';

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
    title:      timeline.title  || 'Lesson',
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

  // ─── Auth Guard ──────────────────────────────────────────────────────────
  teachingIO.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication error: No token provided'));

      if (token === 'guest') {
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

  teachingIO.on('connection', (socket) => {
    const sessionId = `session-${socket.id}-${Date.now()}`;
    console.log(`[WS] Client connected: ${socket.id} → Session: ${sessionId}`);

    const session = sessionStore.create(sessionId, socket.id);
    const machine = createTeachingMachine(sessionId, (transition) => {
      socket.emit('teaching:state', {
        state:     transition.to,
        from:      transition.from,
        event:     transition.event,
        payload:   transition.payload,
        timestamp: transition.timestamp,
      });
      sessionStore.update(sessionId, { state: transition.to });
    });

    // ─── START SESSION ──────────────────────────────────────────────────
    socket.on('session:start', async ({ topic, selectedAgent, activeMode }) => {
      if (!checkSocketRate(getRateKey(socket))) {
        socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }

      const cleanTopic = sanitizeInput(topic, 2000);
      console.log(`[WS] session:start → "${cleanTopic}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

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

      sessionStore.update(sessionId, { topic: cleanTopic });

      if (socket.user && socket.user.id !== 'guest') {
        console.log(`[WS] Initializing persistent profile for user: ${socket.user.id}`);
        await sessionStore.initProfile(sessionId, socket.user.id);
      } else {
        console.log(`[WS] Initializing default guest profile for session: ${sessionId}`);
        sessionStore.update(sessionId, {
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

      try {
        const intentResult = await detectIntent(cleanTopic, activeMode);
        const intent = intentResult.intent;
        console.log(`[WS] Detected Intent: ${intent} (${intentResult.renderer})`);

        if (intent === 'quick' || intent === 'text_only') {
          console.log('[WS] Generating text-only response...');
          const response = await withTimeout(
            generateTextResponse(sessionId, cleanTopic, selectedAgent),
            45000,
            'Text response timed out'
          );
          machine.forceReset();
          console.log(`[WS] Emitting teaching:greeting (text-only) — ${(response.answer || '').length} chars`);
          socket.emit('teaching:greeting', { message: response.answer });
          return;
        }

        // ─── Generate visual timeline ─────────────────────────────────────
        console.log('[WS] Generating visual timeline...');
        const timeline = await withTimeout(
          generateTimeline(sessionId, cleanTopic, (stage) => {
            console.log(`[WS] Progress: ${stage}`);
            socket.emit('teaching:progress', { message: stage });
          }, selectedAgent),
          120000,
          'Timeline generation timed out'
        );

        if (timeline.type === 'greeting') {
          machine.forceReset();
          socket.emit('teaching:greeting', { message: timeline.answer });
          return;
        }

        // Persist to session store
        sessionStore.setTimeline(sessionId, timeline);

        // Transition FSM
        machine.send(EVENTS.TIMELINE_READY, { timeline });

        // ─── CRITICAL: Build guaranteed payload shape ─────────────────────
        const payload = buildTimelinePayload(sessionId, timeline);
        const steps   = payload.steps; // already normalized

        console.log(`[WS] Emitting teaching:timeline — "${payload.title}" (${payload.totalSteps} steps, renderer: ${payload.renderer})`);
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

    // ─── ASK DOUBT ─────────────────────────────────────────────────────────
    socket.on('session:doubt', async ({ question, selectedAgent, activeMode }) => {
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
        const intentResult = await detectIntent(cleanQuestion, activeMode);
        const intent = intentResult.intent;
        console.log(`[WS] Doubt Detected Intent: ${intent}`);

        let response;
        if (intent === 'quick' || intent === 'text_only') {
          const textRes = await withTimeout(
            generateTextResponse(sessionId, cleanQuestion, selectedAgent),
            45000,
            'Doubt text response timed out'
          );
          response = { answer: textRes.answer, isRelevant: true, hasVisuals: false, visualUpdate: null };
        } else {
          response = await withTimeout(
            handleDoubt(sessionId, cleanQuestion, selectedAgent),
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

        // Adaptive replanning
        const s = sessionStore.get(sessionId);
        if (s && s.confusionIndex >= 5 && s.steps.length > 0) {
          const replan = await replanRemainingSteps(s, s.topic);
          if (replan) {
            console.log(`[WS] Mid-lesson replan triggered! Pushing ${replan.mergedSteps.length} steps.`);
            sessionStore.update(sessionId, { steps: replan.mergedSteps });
            socket.emit('teaching:replan', { message: replan.notification, newTotalSteps: replan.mergedSteps.length });
            socket.emit('teaching:timeline-update', { steps: replan.mergedSteps, totalSteps: replan.mergedSteps.length });
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
    socket.on('session:step', ({ stepIndex }) => {
      const s = sessionStore.get(sessionId);

      if (!s || !s.steps || s.steps.length === 0) {
        console.warn(`[WS] session:step ignored - steps not yet loaded for session: ${sessionId}`);
        return;
      }

      if (!s.steps[stepIndex]) {
        console.warn(`[WS] session:step ignored - invalid index ${stepIndex} for session: ${sessionId}`);
        return;
      }

      sessionStore.goToStep(sessionId, stepIndex);
      socket.emit('teaching:step', { step: s.steps[stepIndex], index: stepIndex, total: s.steps.length });

      if (machine.state === STATES.COMPLETED || machine.state === STATES.RESPONDING) {
        machine.send(EVENTS.RESUME);
      }
    });

    // ─── FINISH SESSION ────────────────────────────────────────────────────
    socket.on('session:finish', () => {
      console.log(`[WS] session:finish (${sessionId})`);
      machine.send(EVENTS.FINISH);
    });

    // ─── PAUSE ─────────────────────────────────────────────────────────────
    socket.on('session:pause', () => { machine.send(EVENTS.PAUSE); });

    // ─── RESUME ────────────────────────────────────────────────────────────
    socket.on('session:resume', () => {
      machine.send(EVENTS.RESUME) || machine.send(EVENTS.PLAY);

      const s = sessionStore.get(sessionId);
      if (s && s.steps && s.steps.length > 0) {
        socket.emit('teaching:step', {
          step:  s.steps[s.currentStepIndex],
          index: s.currentStepIndex,
          total: s.steps.length,
        });
      }
    });

    // ─── END SESSION ───────────────────────────────────────────────────────
    socket.on('session:end', () => {
      console.log(`[WS] session:end (${sessionId})`);
      machine.forceReset();
      sessionStore.destroy(sessionId);
    });

    // ─── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
      sessionStore.destroy(sessionId);
      cleanupSocket(socket.id);
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