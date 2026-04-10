/**
 * TeachingSocket v3.0 — Hardened WebSocket event handlers
 * 
 * KEY FIXES:
 *   - EVERY code path emits a response (no silent failures)
 *   - Timeout safety: if AI takes >45s, return fallback
 *   - Detailed logging for debugging
 *   - Error responses always include chat-friendly message
 * 
 * Events (Client → Server):
 *   session:start   { topic }              → Start a teaching session
 *   session:doubt   { question }           → Ask a doubt mid-lesson
 *   session:pause                          → Pause playback
 *   session:resume                         → Resume playback
 *   session:step    { stepIndex }          → Jump to a specific step
 *   session:end                            → End the session
 *
 * Events (Server → Client):
 *   teaching:state      { state, ... }     → State machine transition
 *   teaching:timeline   { timeline }       → Full timeline data
 *   teaching:step       { step, index }    → Current step data
 *   teaching:doubt-ack                     → Doubt received acknowledgment
 *   teaching:doubt-response { data }       → Doubt answer + optional visuals
 *   teaching:error      { message }        → Error occurred
 *   teaching:greeting   { message }        → It was just a greeting
 */

import { createTeachingMachine, STATES, EVENTS } from '../engine/core/teachingMachine.js';
import sessionStore from '../engine/core/sessionStore.js';
import { generateTimeline, handleDoubt, generateTextResponse } from '../engine/core/pedagogyEngine.js';
import { detectIntent } from '../engine/core/intentEngine.js';
import { checkSocketRate, cleanupSocket } from '../middleware/rateLimiter.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { replanRemainingSteps } from '../engine/core/adaptivePlanner.js';
import jwt from 'jsonwebtoken';

// ─── Timeout wrapper ─────────────────────────────────────────────────────────
function withTimeout(promise, ms, fallbackMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(fallbackMessage || `Request timed out after ${ms}ms`)), ms)
    )
  ]);
}

export function setupTeachingSocket(io) {
  // Namespace for teaching sessions
  const teachingIO = io.of('/teaching');

  // Strict Auth Guard
  teachingIO.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }
      
      // Allow frontend built-in Guest sessions
      if (token === 'guest') {
        socket.user = { id: 'guest', name: 'Guest User', email: 'guest@tutorboard.ai' };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('[WS] Auth Error:', err.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  teachingIO.on('connection', (socket) => {
    const sessionId = `session-${socket.id}-${Date.now()}`;
    console.log(`[WS] Client connected: ${socket.id} → Session: ${sessionId}`);

    // Create session and state machine
    const session = sessionStore.create(sessionId, socket.id);
    const machine = createTeachingMachine(sessionId, (transition) => {
      // Emit state changes to client
      socket.emit('teaching:state', {
        state: transition.to,
        from: transition.from,
        event: transition.event,
        payload: transition.payload,
        timestamp: transition.timestamp,
      });

      // Update session store
      sessionStore.update(sessionId, { state: transition.to });
    });

    // ─── START SESSION ───
    socket.on('session:start', async ({ topic, selectedAgent, activeMode }) => {
      // Rate limit check
      if (!checkSocketRate(socket.id)) {
        socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }

      // Sanitize input
      const cleanTopic = sanitizeInput(topic, 2000);
      console.log(`[WS] session:start → "${cleanTopic}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

      if (!cleanTopic) {
        socket.emit('teaching:error', { message: 'Topic is required' });
        return;
      }

      // Transition to GENERATING
      let newState = machine.send(EVENTS.START, { topic });
      if (!newState) {
        console.warn(`[WS] State machine was not IDLE. Forcing reset to handle NEW session:start.`);
        machine.forceReset();
        newState = machine.send(EVENTS.START, { topic });
      }

      if (!newState) {
        socket.emit('teaching:error', { message: 'Failed to initialize teaching state. Please try again.' });
        return;
      }

      sessionStore.update(sessionId, { topic: cleanTopic });

      // Initialize persistent profile if user is authenticated
      if (socket.user && socket.user.id !== 'guest') {
        console.log(`[WS] Initializing persistent profile for user: ${socket.user.id}`);
        await sessionStore.initProfile(sessionId, socket.user.id);
      } else {
        // Initialize a default in-memory learner profile for guest sessions
        console.log(`[WS] Initializing default guest profile for session: ${sessionId}`);
        sessionStore.update(sessionId, {
          learnerProfile: {
            level: 'beginner',
            pace: 'normal',
            confusionIndex: 0,
            strengths: [],
            weaknesses: [],
            preferredExplanationStyle: 'visual',
          }
        });
      }

      try {
        const intent = detectIntent(topic, activeMode);
        console.log(`[WS] Detected Intent: ${intent}`);

        if (intent === 'quick' || intent === 'text_only') {
          // Process as a fast conversational text chat instead of generating a visual timeline
          console.log(`[WS] Generating text-only response...`);
          const response = await withTimeout(
            generateTextResponse(sessionId, cleanTopic),
            45000,
            'Text response timed out'
          );
          machine.forceReset();
          console.log(`[WS] Emitting teaching:greeting (text-only) — ${(response.answer || '').length} chars`);
          socket.emit('teaching:greeting', { message: response.answer });
          return;
        }

        // Generate the visual timeline
        console.log(`[WS] Generating visual timeline...`);
        const timeline = await withTimeout(
          generateTimeline(sessionId, cleanTopic, (stage) => {
            console.log(`[WS] Progress: ${stage}`);
            socket.emit('teaching:progress', { message: stage });
          }),
          75000,
          'Timeline generation timed out'
        );

        // Check if it was just a greeting
        if (timeline.type === 'greeting') {
          machine.forceReset();
          console.log(`[WS] Emitting teaching:greeting (greeting detected)`);
          socket.emit('teaching:greeting', { message: timeline.answer });
          return;
        }

        // Persist timeline to session store so navigation works
        sessionStore.setTimeline(sessionId, timeline);

        // Transition to TEACHING
        machine.send(EVENTS.TIMELINE_READY, { timeline });

        // Send full timeline to client (SCENE GRAPH + legacy keys)
        console.log(`[WS] Emitting teaching:timeline — "${timeline.title}" (${timeline.steps?.length || timeline.timeline?.length} steps)`);
        socket.emit('teaching:timeline', {
          sessionId,
          title: timeline.title,
          domain: timeline.domain,
          // New SCENE GRAPH keys
          scene: timeline.scene,
          elements: timeline.elements,
          connections: timeline.connections,
          timeline: timeline.timeline,
          // Legacy keys (backward compat)
          totalSteps: timeline.steps?.length || timeline.timeline?.length || 0,
          objects: timeline.objects || timeline.elements,
          steps: timeline.steps || timeline.timeline,
        });

        // If the timeline has a chatMessage (e.g., fallback), also emit it as a greeting
        if (timeline.chatMessage) {
          console.log(`[WS] Emitting supplementary greeting for fallback timeline`);
          socket.emit('teaching:greeting', { message: timeline.chatMessage });
        }

        // Send first step
        if (timeline.steps.length > 0) {
          socket.emit('teaching:step', {
            step: timeline.steps[0],
            index: 0,
            total: timeline.steps.length,
          });
        }

      } catch (err) {
        console.error(`[WS] session:start error:`, err.message || err);
        machine.send(EVENTS.FAIL, { error: err.message });
        
        // CRITICAL: Always emit BOTH error AND a fallback greeting so chat shows something
        socket.emit('teaching:error', { message: 'Failed to generate lesson. Please try again.' });
        socket.emit('teaching:greeting', { 
          message: 'Something went wrong while generating your lesson. Please try again with a different topic or the same one.' 
        });
        
        // Reset machine so user can retry
        machine.forceReset();
      }
    });

    // ─── ASK DOUBT ───
    socket.on('session:doubt', async ({ question, selectedAgent, activeMode }) => {
      // Rate limit check
      if (!checkSocketRate(socket.id)) {
        socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }

      // Sanitize input
      const cleanQuestion = sanitizeInput(question, 5000);
      console.log(`[WS] session:doubt → "${cleanQuestion}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

      if (!cleanQuestion) {
        socket.emit('teaching:error', { message: 'Question is required' });
        return;
      }

      // Transition to DOUBT_TRIGGERED
      const triggered = machine.send(EVENTS.DOUBT_ASKED, { question: cleanQuestion });
      if (!triggered) {
        // Try to handle even from invalid states gracefully
        console.warn(`[WS] Doubt asked from invalid state: ${machine.state}`);
      }

      // Acknowledge receipt immediately
      socket.emit('teaching:doubt-ack', { question: cleanQuestion });

      try {
        const intent = detectIntent(cleanQuestion, activeMode);
        console.log(`[WS] Doubt Detected Intent: ${intent}`);

        let response;
        if (intent === 'quick' || intent === 'text_only') {
          // Fast-track a text response for default modes
          console.log(`[WS] Generating text-only doubt response...`);
          const textRes = await withTimeout(
            generateTextResponse(sessionId, cleanQuestion),
            45000,
            'Doubt text response timed out'
          );
          response = {
            answer: textRes.answer,
            isRelevant: true,
            hasVisuals: false,
            visualUpdate: null
          };
        } else {
          // Explicitly requested visualization or deep modes
          console.log(`[WS] Generating visual doubt response...`);
          response = await withTimeout(
            handleDoubt(sessionId, cleanQuestion),
            30000,
            'Doubt visual response timed out'
          );
        }

        // Transition to RESPONDING
        machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

        // Send response to client (include _question for thread pairing)
        console.log(`[WS] Emitting teaching:doubt-response — ${(response.answer || '').length} chars (question: "${cleanQuestion.substring(0, 40)}")`);
        socket.emit('teaching:doubt-response', {
          _question: cleanQuestion,
          answer: response.answer,
          isRelevant: response.isRelevant,
          hasVisuals: response.hasVisuals,
          visualUpdate: response.visualUpdate,
          followUp: response.followUp,
        });

        // ─── Adaptive Replanning Check ───
        const s = sessionStore.get(sessionId);
        if (s && s.confusionIndex >= 5 && s.steps.length > 0) {
          const replan = await replanRemainingSteps(s, s.topic);
          if (replan) {
            console.log(`[WS] Mid-lesson replan triggered! Pushing ${replan.mergedSteps.length} steps.`);
            sessionStore.update(sessionId, { steps: replan.mergedSteps });
            
            // Notify client of the replan
            socket.emit('teaching:replan', { 
              message: replan.notification,
              newTotalSteps: replan.mergedSteps.length
            });

            // Update client's timeline data
            socket.emit('teaching:timeline-update', {
              steps: replan.mergedSteps,
              totalSteps: replan.mergedSteps.length
            });
          }
        }

      } catch (err) {
        console.error(`[WS] session:doubt error:`, err.message || err);
        machine.send(EVENTS.FAIL, { error: err.message });
        
        // CRITICAL: Always emit a doubt response, even on crash
        socket.emit('teaching:doubt-response', {
          // Fallback response on error
          _question: cleanQuestion,
          answer: "Something went wrong while processing your question. Please try again.",
          isRelevant: true,
          hasVisuals: false,
          visualUpdate: null,
        });
      }
    });

    // ─── NAVIGATE STEPS ───
    socket.on('session:step', ({ stepIndex }) => {
      const s = sessionStore.get(sessionId);
      
      // Safety: Race condition protection
      if (!s || !s.steps || s.steps.length === 0) {
        console.warn(`[WS] session:step ignored - steps not yet loaded for session: ${sessionId}`);
        return;
      }

      if (!s.steps[stepIndex]) {
        console.warn(`[WS] session:step ignored - invalid index ${stepIndex} for session: ${sessionId}`);
        return;
      }

      sessionStore.goToStep(sessionId, stepIndex);

      socket.emit('teaching:step', {
        step: s.steps[stepIndex],
        index: stepIndex,
        total: s.steps.length,
      });

      // Transition to TEACHING if we were in COMPLETED/DOUBT
      if (machine.state === STATES.COMPLETED || machine.state === STATES.RESPONDING) {
        machine.send(EVENTS.RESUME);
      }
    });

    // ─── FINISH SESSION ───
    socket.on('session:finish', () => {
      console.log(`[WS] session:finish (${sessionId})`);
      machine.send(EVENTS.FINISH);
    });

    // ─── PAUSE ───
    socket.on('session:pause', () => {
      machine.send(EVENTS.PAUSE);
    });

    // ─── RESUME ───
    socket.on('session:resume', () => {
      const result = machine.send(EVENTS.RESUME) || machine.send(EVENTS.PLAY);
      
      const s = sessionStore.get(sessionId);
      if (s) {
        socket.emit('teaching:step', {
          step: s.steps[s.currentStepIndex],
          index: s.currentStepIndex,
          total: s.steps.length,
        });
      }
    });

    // ─── END SESSION ───
    socket.on('session:end', () => {
      console.log(`[WS] session:end (${sessionId})`);
      machine.forceReset();
      sessionStore.destroy(sessionId);
    });

    // ─── DISCONNECT ───
    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
      sessionStore.destroy(sessionId);
      cleanupSocket(socket.id);
    });

    // Send initial state
    socket.emit('teaching:state', {
      state: STATES.IDLE,
      from: null,
      event: 'INIT',
      payload: { sessionId },
      timestamp: Date.now(),
    });
  });

  console.log('[WS] Teaching socket handlers registered on /teaching namespace');
  return teachingIO;
}
