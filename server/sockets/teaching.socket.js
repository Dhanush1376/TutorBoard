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

import { createTeachingMachine, STATES, EVENTS } from '../engine/teachingMachine.js';
import sessionStore from '../engine/sessionStore.js';
import { generateTimeline, handleDoubt, generateTextResponse } from '../engine/aiOrchestrator.js';
import { detectIntent } from '../engine/intentEngine.js';

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
      console.log(`[WS] session:start → "${topic}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

      if (!topic || !topic.trim()) {
        socket.emit('teaching:error', { message: 'Topic is required' });
        return;
      }

      // Transition to GENERATING
      const newState = machine.send(EVENTS.START, { topic });
      if (!newState) {
        socket.emit('teaching:error', { message: 'Cannot start session from current state' });
        return;
      }

      sessionStore.update(sessionId, { topic: topic.trim() });

      try {
        const intent = detectIntent(topic, activeMode);
        console.log(`[WS] Detected Intent: ${intent}`);

        if (intent === 'text_only') {
          // Process as a fast conversational text chat instead of generating a visual timeline
          console.log(`[WS] Generating text-only response...`);
          const response = await withTimeout(
            generateTextResponse(sessionId, topic.trim()),
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
          generateTimeline(sessionId, topic.trim()),
          120000,
          'Timeline generation timed out'
        );

        // Check if it was just a greeting
        if (timeline.type === 'greeting') {
          machine.forceReset();
          console.log(`[WS] Emitting teaching:greeting (greeting detected)`);
          socket.emit('teaching:greeting', { message: timeline.answer });
          return;
        }

        // Transition to TEACHING
        machine.send(EVENTS.TIMELINE_READY, { timeline });

        // Send full timeline to client
        console.log(`[WS] Emitting teaching:timeline — "${timeline.title}" (${timeline.steps?.length} steps)`);
        socket.emit('teaching:timeline', {
          sessionId,
          title: timeline.title,
          domain: timeline.domain,
          totalSteps: timeline.steps.length,
          objects: timeline.objects,
          steps: timeline.steps,
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
      console.log(`[WS] session:doubt → "${question}" (Agent: ${selectedAgent}, Mode: ${activeMode}) (${sessionId})`);

      if (!question || !question.trim()) {
        socket.emit('teaching:error', { message: 'Question is required' });
        return;
      }

      // Transition to DOUBT_TRIGGERED
      const triggered = machine.send(EVENTS.DOUBT_ASKED, { question });
      if (!triggered) {
        // Try to handle even from invalid states gracefully
        console.warn(`[WS] Doubt asked from invalid state: ${machine.state}`);
      }

      // Acknowledge receipt immediately
      socket.emit('teaching:doubt-ack', { question });

      try {
        const intent = detectIntent(question, activeMode);
        console.log(`[WS] Doubt Detected Intent: ${intent}`);

        let response;
        if (intent === 'text_only') {
          // Fast-track a text response for default modes
          console.log(`[WS] Generating text-only doubt response...`);
          const textRes = await withTimeout(
            generateTextResponse(sessionId, question.trim()),
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
            handleDoubt(sessionId, question.trim()),
            45000,
            'Doubt visual response timed out'
          );
        }

        // Transition to RESPONDING
        machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

        // Send response to client (include _question for thread pairing)
        console.log(`[WS] Emitting teaching:doubt-response — ${(response.answer || '').length} chars`);
        socket.emit('teaching:doubt-response', {
          _question: question.trim(),
          answer: response.answer,
          isRelevant: response.isRelevant,
          hasVisuals: response.hasVisuals,
          visualUpdate: response.visualUpdate,
        });

      } catch (err) {
        console.error(`[WS] session:doubt error:`, err.message || err);
        machine.send(EVENTS.FAIL, { error: err.message });
        
        // CRITICAL: Always emit a doubt response, even on crash
        socket.emit('teaching:doubt-response', {
          _question: question.trim(),
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
      if (!s || !s.steps[stepIndex]) return;

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
