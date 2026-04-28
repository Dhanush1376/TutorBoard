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

      const s = await sessionStore.get(sessionId);
      const confusionIndex = s?.learnerProfile?.confusionIndex || 0;
      const mode = confusionIndex > 0.4 ? 'SIMPLIFY' : 'EXPLAIN';

      const response = await withTimeout(
        handleDoubt(
          sessionId,
          cleanQuestion,
          userConfig?.model || resolveModelId(selectedAgent),
          userConfig,
          file,
          snapshot,
          mode
        ),
        45000
      );

      machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

      if (response.visualUpdate?.isDelta) {
        console.log(`[Doubt] 🚀 Emitting DELTA for "${cleanQuestion}"`);
        socket.emit('teaching:doubt-delta', {
          _question: cleanQuestion,
          answer: response.answer,
          actions: response.commands || response.visualUpdate?.mutations || [],
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


      // Update Session State (Use the snapshot we just fetched)
      if (sessionAfterDoubt) {
        const activeSession = sessionAfterDoubt;
        if (socket.user && !socket.user.isGuest) {
          try {
            await Doubt.create({
              user: socket.user.id || socket.user._id,
              question: cleanQuestion,
              answer: response.answer,
              stepIndex: activeSession.currentStepIndex || 0,
              stepDescription: activeSession.topic || 'General Query',
            });
          } catch (dbErr) { }
        }

        // Confusion Classification
        try {
          const { classifyDoubt } = await import('../../engine/agents/doubtClassifier.js');
          const classification = await classifyDoubt(activeSession.topic || '', cleanQuestion);
          const confusionPathways = ['misconception', 'wants_deeper'];

          if (classification && confusionPathways.includes(classification.pathway)) {
            const newConfusion = Math.min(1.0, (activeSession.learnerProfile.confusionIndex || 0) + 0.1);
            const newStreak = (activeSession.learnerProfile.confusionStreak || 0) + 1;

            const engagement = activeSession.learnerProfile.engagementMetrics || { visualStepsCompleted: 0, conceptualDoubtsAsked: 0, avgStepDuration: 0, styleDetected: 'unknown' };
            engagement.conceptualDoubtsAsked += 1;

            const safeLearnerProfile = {
              ...activeSession.learnerProfile,
              confusionStreak: newStreak,
              engagementMetrics: engagement,
              topicsMastery: activeSession.learnerProfile.topicsMastery instanceof Map
                ? Object.fromEntries(activeSession.learnerProfile.topicsMastery)
                : (activeSession.learnerProfile.topicsMastery || {})
            };

            await sessionStore.update(sessionId, {
              learnerProfile: { ...safeLearnerProfile, confusionIndex: newConfusion }
            });
            activeSession.learnerProfile.confusionIndex = newConfusion;
            activeSession.learnerProfile.confusionStreak = newStreak;

            if (newConfusion > 0.6 && newStreak >= 3) {
              console.log(`[Doubt] 🚨 High confusion streak detected (${newStreak}). Activating SIMPLIFY mode.`);
              userConfig.mode = 'SIMPLIFY';
            }

            socket.emit('teaching:profile', { ...safeLearnerProfile, confusionIndex: newConfusion });
          } else {
            // Low confusion / relevant query
            const engagement = activeSession.learnerProfile.engagementMetrics || { visualStepsCompleted: 0, conceptualDoubtsAsked: 0, avgStepDuration: 0, styleDetected: 'unknown' };
            engagement.visualStepsCompleted += 0.5; // Incremental visual engagement boost
            
            await sessionStore.update(sessionId, {
              learnerProfile: { ...activeSession.learnerProfile, confusionStreak: 0, engagementMetrics: engagement }
            });
          }
        } catch (e) { }

        // History
        if (!activeSession.doubtHistory) activeSession.doubtHistory = [];
        activeSession.doubtHistory.push({ question: cleanQuestion, answer: response.answer, timestamp: Date.now() });

        await sessionStore.update(sessionId, {
          learnerProfile: {
            ...activeSession.learnerProfile,
            topicsMastery: activeSession.learnerProfile.topicsMastery instanceof Map
              ? Object.fromEntries(activeSession.learnerProfile.topicsMastery)
              : (activeSession.learnerProfile.topicsMastery || {})
          },
          doubtHistory: activeSession.doubtHistory
        });

        await syncToDatabase(sessionId);
        if (socket.user && !socket.user.isGuest) {
          await sessionStore.persistProfile(sessionId, { question: cleanQuestion });
        }

        // Mid-lesson Replan
        const doubtsSinceReplan = (activeSession.doubtHistory.length) - (activeSession._lastReplanDoubtCount || 0);
        if (activeSession.learnerProfile.confusionIndex >= 0.5 && activeSession.steps?.length > 0 && doubtsSinceReplan >= 3) {
          const replan = await replanRemainingSteps(activeSession, activeSession.topic, userConfig);
          if (replan) {
            await sessionStore.update(sessionId, { steps: replan.mergedSteps });
            socket.emit('teaching:replan', { message: replan.notification, newTotalSteps: replan.mergedSteps.length });
            socket.emit('teaching:timeline-update', { steps: replan.mergedSteps, totalSteps: replan.mergedSteps.length });
            await sessionStore.update(sessionId, {
              learnerProfile: { ...activeSession.learnerProfile, confusionIndex: 0 },
              _lastReplanDoubtCount: activeSession.doubtHistory.length
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
