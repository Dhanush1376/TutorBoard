import { STATES, EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import ChatSession from '../../models/ChatSession.js';
import { generateTimeline, generateTextResponse, generateQuiz } from '../../engine/core/pedagogyEngine.js';
import { detectIntent } from '../../engine/core/intentEngine.js';
import { checkSocketRate, checkGuestUsage, getGuestUsageCount, GUEST_MONTHLY_LIMIT } from '../../middleware/rateLimiter.js';
import { sanitizeInput } from '../../utils/validation/sanitize.js';
import { isGreeting } from '../../engine/agents/agentUtils.js';
import { 
  syncToDatabase, 
  getRateKey, 
  withTimeout, 
  resolveUserConfig,
  buildTimelinePayload,
  resolveModelId 
} from '../utils.js';
import { generateSessionSummary } from '../../engine/core/pedagogyEngine.js';
import { logActivity } from '../../controllers/session.controller.js';

export function registerSessionHandlers(socket, machine, sessionId, requestId) {
  
  // ─── START SESSION ──────────────────────────────────────────────────
  socket.on('session:start', async ({ topic, selectedAgent, activeMode, chatId }) => {
    const rateKey = getRateKey(socket);
    
    if (!checkSocketRate(rateKey)) {
      socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
      return;
    }

    if (socket.user?.isGuest) {
      if (!checkSocketRate(`session:guest:${rateKey}`)) {
        socket.emit('teaching:error', { message: 'Guest limit reached: 1 session per minute. Please sign up for more.' });
        return;
      }

      // monthly limit check
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      const isAllowed = await checkGuestUsage(ip);
      const newCount = await getGuestUsageCount(ip);
      socket.emit('guest:status', { count: newCount, limit: GUEST_MONTHLY_LIMIT, warning: newCount >= 40 });

      if (!isAllowed) {
        socket.emit('teaching:error', { message: 'Trial limit exceeded (50 interactions/mo). Please sign in to continue learning.' });
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

    // Profile Initialization
    if (socket.user && socket.user.id !== 'guest') {
      await sessionStore.initProfile(sessionId, socket.user.id);
      const s = await sessionStore.get(sessionId);
      if (s && s.learnerProfile) {
        socket.emit('teaching:profile', s.learnerProfile);
      }
    } else {
      const guestProfile = { level: 'beginner', pace: 'normal', confusionIndex: 0, topicsMastery: {} };
      await sessionStore.update(sessionId, {
        learnerProfile: guestProfile,
      });
      socket.emit('teaching:profile', guestProfile);
    }

    // Resumption / Linking Logic
    if (chatId) {
      try {
        const chatSession = await ChatSession.findOne({ _id: chatId, userId: socket.user?.id || socket.user?._id });
        if (chatSession) {
          // Always link the engine session to this MongoDB document
          await sessionStore.update(sessionId, { chatSessionId: chatSession._id });

          const restored = await sessionStore.restoreFromMongo(sessionId, chatSession);
          if (restored && restored.steps && restored.steps.length > 0) {
            console.log(`[WS] Resuming session ${sessionId} from ChatSession ${chatId}`);
            machine.send(EVENTS.TIMELINE_READY, { timeline: { steps: restored.steps, title: restored.topic } });
            
            const payload = buildTimelinePayload(sessionId, { 
              steps: restored.steps, 
              topic: restored.topic,
              renderer: 'AgentCanvasRenderer' 
            });

            socket.emit('teaching:timeline', { ...payload, isResume: true, currentStepIndex: restored.currentStepIndex });
            socket.emit('teaching:step', {
              step:  restored.steps[restored.currentStepIndex],
              index: restored.currentStepIndex,
              total: restored.steps.length,
            });

            // CRITICAL: Tell the client the real MongoDB _id so REST sync targets the right document
            socket.emit('session:db-id', { chatSessionId: chatSession._id.toString() });
            return;
          }

          // chatId exists but no steps to resume — still confirm the link to client
          socket.emit('session:db-id', { chatSessionId: chatSession._id.toString() });
          await sessionStore.addMessage(sessionId, 'user', cleanTopic);
          // Fall through to generation logic below
        }
      } catch (err) {
        console.warn(`[WS] Resumption/linking failed for chatId ${chatId}: ${err.message}`);
      }
    } else if (socket.user && !socket.user.isGuest) {
      // No chatId passed — create a new ChatSession in MongoDB
      try {
        const newMongoSession = await ChatSession.create({
          userId: socket.user.id || socket.user._id,
          title: cleanTopic,
          topic: cleanTopic,
          engineSessionId: sessionId,
        });
        await sessionStore.update(sessionId, { chatSessionId: newMongoSession._id });
        
        // LOG ACTIVITY: Session Start
        logActivity({
          userId: socket.user.id || socket.user._id,
          sessionId: newMongoSession._id.toString(),
          eventType: 'session_start',
          eventData: { topic: cleanTopic, agent: selectedAgent, mode: activeMode }
        });

        await sessionStore.addMessage(sessionId, 'user', cleanTopic);
        await syncToDatabase(sessionId);

        // CRITICAL: Tell the client the real MongoDB _id so REST sync targets the right document
        socket.emit('session:db-id', { chatSessionId: newMongoSession._id.toString() });
      } catch (err) {
        console.error('[WS] Failed to create ChatSession:', err.message);
      }

    } else {
      console.log(`[${requestId}] [WS] Continuing as Guest session: ${sessionId}`);
    }

    // Generation Logic
    try {
      if (!socket.user) {
        console.warn(`[${requestId}] [WS] socket.user missing! Defaulting to guest context.`);
        socket.user = { id: 'guest', isGuest: true };
      }
      const userConfig = await resolveUserConfig(socket, socket.user, cleanTopic);
      
      let intentResult;
      if (isGreeting(cleanTopic)) {
        intentResult = { intent: 'quick', renderer: 'none', confidence: 1.0 };
      } else {
        intentResult = await detectIntent(cleanTopic, activeMode, selectedAgent, userConfig);
      }

      if (intentResult.intent === 'quick' || intentResult.intent === 'text_only') {
        const response = await withTimeout(
          generateTextResponse(sessionId, cleanTopic, resolveModelId(selectedAgent), userConfig),
          45000
        );
        machine.forceReset();
        await sessionStore.addMessage(sessionId, 'assistant', response.answer);
        await syncToDatabase(sessionId);
        socket.emit('teaching:greeting', { message: response.answer });
        return;
      }



      if (intentResult.intent === 'test_me') {
        const quiz = await withTimeout(
          generateQuiz(sessionId, cleanTopic, (stage) => socket.emit('teaching:progress', { message: stage }), resolveModelId(selectedAgent), userConfig),
          60000
        );
        socket.emit('teaching:quiz', quiz);
        machine.send(EVENTS.TIMELINE_READY, { timeline: quiz });
        return;
      }

      // Generate visual timeline
      let lastProgressAt = Date.now();
      const heartbeat = setInterval(() => {
        if (Date.now() - lastProgressAt >= 15000) {
          socket.emit('teaching:progress', { message: 'Still working on your visual lesson...' });
          lastProgressAt = Date.now(); 
        }
      }, 5000);

      try {
        const timeline = await withTimeout(
          generateTimeline(sessionId, cleanTopic, (stage, chunk) => {
            lastProgressAt = Date.now();
            if (chunk) socket.emit('teaching:progress-tokens', { stage, token: chunk });
            else socket.emit('teaching:progress', { message: stage });
          }, resolveModelId(selectedAgent), userConfig),
          240000
        );

        if (timeline.type === 'greeting') {
          machine.forceReset();
          await sessionStore.addMessage(sessionId, 'assistant', timeline.answer);
          await syncToDatabase(sessionId);
          socket.emit('teaching:greeting', { message: timeline.answer });
          return;
        }

        const introMsg = `I've prepared a visual learning canvas for you on **${timeline.title}**. Dive in whenever you're ready!`;
        await sessionStore.addMessage(sessionId, 'assistant', introMsg, {
          hasCanvas: true,
          canvasSnapshot: {
            canvasObjects: timeline.elements || timeline.objects || [],
            canvasSteps: timeline.steps || timeline.timeline || [],
            totalSteps: (timeline.steps || timeline.timeline || []).length
          }
        });


        await sessionStore.setTimeline(sessionId, timeline);
        machine.send(EVENTS.TIMELINE_READY, { timeline });

        const payload = buildTimelinePayload(sessionId, timeline);
        socket.emit('teaching:timeline', payload);
        if (payload.timeline.length > 0) {
          socket.emit('teaching:step', { step: payload.timeline[0], index: 0, total: payload.timeline.length });
        }

        // Persist full state (intro message + timeline) to MongoDB
        await syncToDatabase(sessionId);
      } finally {
        clearInterval(heartbeat);
      }


    } catch (err) {
      console.error('[WS] session:start error:', err.message);
      machine.send(EVENTS.FAIL, { error: err.message });
      socket.emit('teaching:error', { message: 'Failed to generate lesson.' });
      machine.forceReset();
    }
  });

  // ─── FINISH SESSION ──────────────────────────────────────────────────
  socket.on('session:finish', async () => {
    machine.send(EVENTS.FINISH);
    if (socket.user && !socket.user.isGuest) {
      await sessionStore.persistProfile(sessionId);
      
      // Phase 5: Semantic Finalization
      const summary = await generateSessionSummary(sessionId);
      if (summary) {
        await sessionStore.finalizeSessionMemory(sessionId, summary);
      }
    }
  });

  // ─── END SESSION ─────────────────────────────────────────────────────
  socket.on('session:end', async () => {
    if (socket.user && !socket.user.isGuest) {
      await sessionStore.persistProfile(sessionId);

      // Phase 5: Semantic Finalization (last chance)
      const summary = await generateSessionSummary(sessionId);
      if (summary) {
        await sessionStore.finalizeSessionMemory(sessionId, summary);
      }
    }
    machine.forceReset();
    await sessionStore.destroy(sessionId);
  });

  // ─── CANVAS SYNC ──────────────────────────────────────────────────────
  socket.on('canvas:sync', async ({ objects }) => {
    if (!Array.isArray(objects)) return;
    await sessionStore.updateCanvasState(sessionId, objects);
    // Debounced sync to DB is usually handled by the caller or periodic sync, 
    // but we'll do an immediate sync for manual interactions
    await syncToDatabase(sessionId);

    // LOG ACTIVITY: Canvas Action
    const s = await sessionStore.get(sessionId);
    if (s && s.chatSessionId) {
      logActivity({
        userId: socket.user?.id || socket.user?._id,
        sessionId: s.chatSessionId.toString(),
        eventType: 'canvas_action',
        eventData: { objectCount: objects.length }
      });
    }
  });

  // ─── DB ID RECOVERY ──────────────────────────────────────────────────
  socket.on('session:request-db-id', async () => {
    const s = await sessionStore.get(sessionId);
    if (s && s.chatSessionId) {
      socket.emit('session:db-id', { chatSessionId: s.chatSessionId.toString() });
    }
  });
}