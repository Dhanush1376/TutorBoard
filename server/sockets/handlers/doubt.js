import { EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import Doubt from '../../models/Doubt.js';
import { handleDoubt, generateTextResponse } from '../../engine/core/pedagogyEngine.js';
import { detectIntent } from '../../engine/core/intentEngine.js';
import { checkSocketRate, checkGuestUsage, getGuestUsageCount, GUEST_MONTHLY_LIMIT } from '../../middleware/rateLimiter.js';
import { sanitizeInput } from '../../utils/validation/sanitize.js';
import { isGreeting } from '../../engine/agents/agentUtils.js';
import { replanRemainingSteps } from '../../engine/core/adaptivePlanner.js';
import {
  syncToDatabase,
  getRateKey,
  withTimeout,
  resolveUserConfig,
  resolveModelId
} from '../utils.js';
import redis from '../../utils/core/redis.js';
import { runDeltaAgent } from '../../engine/agents/deltaAgent.js';

export function registerDoubtHandlers(socket, machine, sessionId) {

  socket.on('session:doubt', async ({ question, selectedAgent, activeMode, file, snapshot }) => {
    // ─── Phase 3: Concurrency Lock ────────────────────────────────────────
    if (socket._isProcessingDoubt) return;
    socket._isProcessingDoubt = true;

    // ─── Sliding Window Rate Limiting (5 doubts / 60s) — Redis Backed ────────
    const now = Date.now();
    const ip = socket.handshake.address;
    const userId = socket.user?.id || socket.user?._id || ip;
    const rateKey = `rate:doubt:${userId}`;

    if (redis.isConnected) {
      await redis.zremrangebyscore(rateKey, 0, now - 60000);
      const count = await redis.zcard(rateKey);

      if (count >= 5) {
        socket.emit('teaching:error', { message: 'You are asking questions too fast. Please wait a minute.' });
        socket._isProcessingDoubt = false;
        return;
      }
      await redis.zadd(rateKey, now, `${now}-${Math.random()}`);
      await redis.expire(rateKey, 65); // Auto-cleanup
    }

    if (!(await checkSocketRate(getRateKey(socket)))) {
      socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
      socket._isProcessingDoubt = false;
      return;
    }

    const cleanQuestion = sanitizeInput(question, 5000);
    machine.send(EVENTS.DOUBT_ASKED, { question: cleanQuestion });
    socket.emit('teaching:doubt-ack', { question: cleanQuestion });

    try {
      const userConfig = await resolveUserConfig(socket, socket.user, cleanQuestion, selectedAgent);

      // ─── Phase 3: Surgical Delta Flow ─────────────────────────────────────
      // We use the provided snapshot if available, otherwise fall back to session state
      const response = await withTimeout(
        handleDoubt(
          sessionId,
          cleanQuestion,
          userConfig?.model || resolveModelId(selectedAgent),
          userConfig,
          file,
          snapshot // Pass client snapshot
        ),
        45000
      );

      machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

      if (response.visualUpdate?.isDelta) {
        console.log(`[Doubt] 🚀 Emitting DELTA for "${cleanQuestion}"`);
        socket.emit('teaching:doubt-delta', {
          _question: cleanQuestion,
          answer: response.answer,
          actions: response.visualUpdate.mutations || [],
          followUp: response.followUp
        });
      } else {
        socket.emit('teaching:doubt-response', {
          _question: cleanQuestion,
          answer: response.answer,
          isRelevant: response.isRelevant,
          hasVisuals: response.hasVisuals,
          visualUpdate: response.visualUpdate,
          followUp: response.followUp,
        });
      }


      // Persist interactions to conversation history
      await sessionStore.addMessage(sessionId, 'user', cleanQuestion);

      const sessionAfterDoubt = await sessionStore.get(sessionId);
      await sessionStore.addMessage(sessionId, 'assistant', response.answer, {
        hasCanvas: !!response.hasVisuals,
        canvasSnapshot: response.hasVisuals ? {
          canvasObjects: sessionAfterDoubt?.canvasState || [],
          canvasSteps: sessionAfterDoubt?.canvasSteps || [],
          totalSteps: sessionAfterDoubt?.canvasSteps?.length || 0
        } : null
      });
      await syncToDatabase(sessionId);  // CRITICAL: Flush to MongoDB


      // Update Session State
      const s = await sessionStore.get(sessionId);
      if (s) {
        if (socket.user && !socket.user.isGuest) {
          try {
            await Doubt.create({
              user: socket.user.id || socket.user._id,
              question: cleanQuestion,
              answer: response.answer,
              stepIndex: s.currentStepIndex || 0,
              stepDescription: s.topic || 'General Query',
            });
          } catch (dbErr) { }
        }

        // Confusion Classification
        try {
          const { classifyDoubt } = await import('../../engine/agents/doubtClassifier.js');
          const classification = await classifyDoubt(s.topic || '', cleanQuestion);
          const confusionPathways = ['misconception', 'wants_deeper'];

          if (classification && confusionPathways.includes(classification.pathway)) {
            const newConfusion = Math.min(1.0, (s.learnerProfile.confusionIndex || 0) + 0.1);

            const safeLearnerProfile = {
              ...s.learnerProfile,
              topicsMastery: s.learnerProfile.topicsMastery instanceof Map
                ? Object.fromEntries(s.learnerProfile.topicsMastery)
                : (s.learnerProfile.topicsMastery || {})
            };

            await sessionStore.update(sessionId, {
              learnerProfile: { ...safeLearnerProfile, confusionIndex: newConfusion }
            });
            s.learnerProfile.confusionIndex = newConfusion;
            socket.emit('teaching:profile', { ...safeLearnerProfile, confusionIndex: newConfusion });
          }
        } catch (e) { }

        // History
        if (!s.doubtHistory) s.doubtHistory = [];
        s.doubtHistory.push({ question: cleanQuestion, answer: response.answer, timestamp: Date.now() });

        await sessionStore.update(sessionId, {
          learnerProfile: {
            ...s.learnerProfile,
            topicsMastery: s.learnerProfile.topicsMastery instanceof Map
              ? Object.fromEntries(s.learnerProfile.topicsMastery)
              : (s.learnerProfile.topicsMastery || {})
          },
          doubtHistory: s.doubtHistory
        });

        await syncToDatabase(sessionId);
        if (socket.user && !socket.user.isGuest) {
          await sessionStore.persistProfile(sessionId, { question: cleanQuestion });
        }

        // Mid-lesson Replan
        const doubtsSinceReplan = (s.doubtHistory.length) - (s._lastReplanDoubtCount || 0);
        if (s.learnerProfile.confusionIndex >= 0.5 && s.steps?.length > 0 && doubtsSinceReplan >= 3) {
          const replan = await replanRemainingSteps(s, s.topic, userConfig);
          if (replan) {
            await sessionStore.update(sessionId, { steps: replan.mergedSteps });
            socket.emit('teaching:replan', { message: replan.notification, newTotalSteps: replan.mergedSteps.length });
            socket.emit('teaching:timeline-update', { steps: replan.mergedSteps, totalSteps: replan.mergedSteps.length });
            await sessionStore.update(sessionId, {
              learnerProfile: { ...s.learnerProfile, confusionIndex: 0 },
              _lastReplanDoubtCount: s.doubtHistory.length
            });
          }
        }
      }

    } catch (err) {
      console.error('[WS] session:doubt error:', err.message);
      machine.send(EVENTS.FAIL, { error: err.message });

      socket._isProcessingDoubt = false;

      // Classify error source for targeted frontend messaging

      const isCustomApiError = err.message?.includes('Your API') || err.message?.includes('Custom API');
      const isSystemError = err.message?.includes('SYSTEM_NOT_CONFIGURED') || err.message?.includes('SYSTEM_FAILURE');

      let errorMessage = 'Something went wrong while processing your question.';
      let errorType = 'generic';

      if (isCustomApiError) {
        errorMessage = err.message;
        errorType = 'custom_api_error';
      } else if (isSystemError) {
        errorMessage = 'TutorBoard system APIs are not available. Please add your own API key in Settings → AI Configuration.';
        errorType = 'system_not_configured';
      }

      socket.emit('teaching:doubt-response', {
        _question: cleanQuestion,
        answer: errorMessage,
        isRelevant: true,
        hasVisuals: false,
        errorType,
      });
    }
  });
}
