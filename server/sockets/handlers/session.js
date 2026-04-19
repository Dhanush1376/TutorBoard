import { STATES, EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import ChatSession from '../../models/ChatSession.js';
import { generateTimeline, generateTextResponse, generateQuiz } from '../../engine/core/pedagogyEngine.js';
import { detectIntent } from '../../engine/core/intentEngine.js';
import { checkSocketRate } from '../../middleware/rateLimiter.js';
import { sanitizeInput } from '../../utils/validation/sanitize.js';
import { isGreeting } from '../../engine/agents/agentUtils.js';
import { 
  syncToDatabase, 
  getRateKey, 
  withTimeout, 
  resolveUserConfig, 
  buildTimelinePayload 
} from '../utils.js';

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
    } else {
      await sessionStore.update(sessionId, {
        learnerProfile: { level: 'beginner', pace: 'normal', confusionIndex: 0 },
      });
    }

    // Resumption Logic
    if (chatId) {
      try {
        const chatSession = await ChatSession.findOne({ _id: chatId, userId: socket.user?.id || socket.user?._id });
        if (chatSession) {
          const restored = await sessionStore.restoreFromMongo(sessionId, chatSession);
          if (restored && restored.steps && restored.steps.length > 0) {
            console.log(`[WS] Resuming session ${sessionId} from ChatSession ${chatId}`);
            machine.send(EVENTS.TIMELINE_READY, { timeline: { steps: restored.steps, title: restored.topic } });
            
            const payload = buildTimelinePayload(sessionId, { 
              steps: restored.steps, 
              topic: restored.topic,
              renderer: 'AgentCanvasRenderer' 
            });

            socket.emit('teaching:timeline', payload);
            socket.emit('teaching:step', {
              step:  restored.steps[restored.currentStepIndex],
              index: restored.currentStepIndex,
              total: restored.steps.length,
            });

            // CRITICAL: Tell the client the real MongoDB _id so REST sync targets the right document
            socket.emit('session:db-id', { chatSessionId: chatSession._id.toString() });
            return;
          }
        }
      } catch (err) {
        console.warn(`[WS] Resumption failed for chatId ${chatId}: ${err.message}`);
      }
    } else if (socket.user && !socket.user.isGuest) {
      // Create new ChatSession in MongoDB
      try {
        const newMongoSession = await ChatSession.create({
          userId: socket.user.id || socket.user._id,
          title: cleanTopic,
          topic: cleanTopic,
          engineSessionId: sessionId,
        });
        await sessionStore.update(sessionId, { chatSessionId: newMongoSession._id });
        await sessionStore.addMessage(sessionId, 'user', cleanTopic);
        await syncToDatabase(sessionId);

        // CRITICAL: Tell the client the real MongoDB _id so REST sync targets the right document
        socket.emit('session:db-id', { chatSessionId: newMongoSession._id.toString() });
      } catch (err) {
        console.error('[WS] Failed to create ChatSession:', err.message);
      }

    }

    // Generation Logic
    try {
      let intentResult;
      if (isGreeting(cleanTopic)) {
        intentResult = { intent: 'quick', renderer: 'none', confidence: 1.0 };
      } else {
        intentResult = await detectIntent(cleanTopic, activeMode, selectedAgent);
      }
      
      const userConfig = await resolveUserConfig(socket, socket.user, cleanTopic);

      if (intentResult.intent === 'quick' || intentResult.intent === 'text_only') {
        const response = await withTimeout(
          generateTextResponse(sessionId, cleanTopic, selectedAgent, userConfig),
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
          generateQuiz(sessionId, cleanTopic, (stage) => socket.emit('teaching:progress', { message: stage }), selectedAgent, userConfig),
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
          }, selectedAgent, userConfig),
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
        await sessionStore.addMessage(sessionId, 'assistant', introMsg);


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
    }
  });

  // ─── END SESSION ─────────────────────────────────────────────────────
  socket.on('session:end', async () => {
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
  });
}

