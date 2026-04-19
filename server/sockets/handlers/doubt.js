import { EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import Doubt from '../../models/Doubt.js';
import { handleDoubt, generateTextResponse } from '../../engine/core/pedagogyEngine.js';
import { detectIntent } from '../../engine/core/intentEngine.js';
import { checkSocketRate } from '../../middleware/rateLimiter.js';
import { sanitizeInput } from '../../utils/validation/sanitize.js';
import { isGreeting } from '../../engine/agents/agentUtils.js';
import { replanRemainingSteps } from '../../engine/core/adaptivePlanner.js';
import { 
  syncToDatabase, 
  getRateKey, 
  withTimeout, 
  resolveUserConfig 
} from '../utils.js';

export function registerDoubtHandlers(socket, machine, sessionId) {
  
  socket.on('session:doubt', async ({ question, selectedAgent, activeMode }) => {
    // ─── Sliding Window Rate Limiting (5 doubts / 60s) ────────────────────
    const now = Date.now();
    if (!socket._doubtTimestamps) socket._doubtTimestamps = [];
    socket._doubtTimestamps = socket._doubtTimestamps.filter(t => now - t < 60000);
    
    if (socket._doubtTimestamps.length >= 5) {
      socket.emit('teaching:error', { message: 'You are asking questions too fast. Please wait a minute.' });
      return;
    }
    socket._doubtTimestamps.push(now);

    if (!checkSocketRate(getRateKey(socket))) {
      socket.emit('teaching:error', { message: 'Too many requests. Please wait a moment.' });
      return;
    }

    const cleanQuestion = sanitizeInput(question, 5000);
    if (!cleanQuestion) {
      socket.emit('teaching:error', { message: 'Question is required' });
      return;
    }

    machine.send(EVENTS.DOUBT_ASKED, { question: cleanQuestion });
    socket.emit('teaching:doubt-ack', { question: cleanQuestion });

    try {
      let intentResult;
      if (isGreeting(cleanQuestion)) {
        intentResult = { intent: 'quick', renderer: 'none', confidence: 1.0 };
      } else {
        intentResult = await detectIntent(cleanQuestion, activeMode, selectedAgent);
      }
      
      const userConfig = await resolveUserConfig(socket, socket.user, cleanQuestion);

      let response;
      if (intentResult.intent === 'quick' || intentResult.intent === 'text_only') {
        const textRes = await withTimeout(
          generateTextResponse(sessionId, cleanQuestion, selectedAgent, userConfig),
          45000
        );
        response = { answer: textRes.answer, isRelevant: true, hasVisuals: false, visualUpdate: null };
      } else {
        response = await withTimeout(
          handleDoubt(sessionId, cleanQuestion, selectedAgent, userConfig),
          30000
        );
      }

      machine.send(EVENTS.DOUBT_RESPONSE_READY, { response });

      socket.emit('teaching:doubt-response', {
        _question:    cleanQuestion,
        answer:       response.answer,
        isRelevant:   response.isRelevant,
        hasVisuals:   response.hasVisuals,
        visualUpdate: response.visualUpdate,
        followUp:     response.followUp,
      });

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
          } catch (dbErr) {}
        }

        // Confusion Classification
        try {
          const { classifyDoubt } = await import('../../engine/agents/doubtClassifier.js');
          const classification = await classifyDoubt(s.topic || '', cleanQuestion);
          const confusionPathways = ['misconception', 'wants_deeper'];
          
          if (classification && confusionPathways.includes(classification.pathway)) {
            const newConfusion = Math.min(10, (s.learnerProfile.confusionIndex || 0) + 1);
            await sessionStore.update(sessionId, { 
              learnerProfile: { ...s.learnerProfile, confusionIndex: newConfusion } 
            });
            s.learnerProfile.confusionIndex = newConfusion;
          }
        } catch (e) {}

        // History
        if (!s.doubtHistory) s.doubtHistory = [];
        s.doubtHistory.push({ question: cleanQuestion, answer: response.answer, timestamp: Date.now() });
        
        await sessionStore.update(sessionId, { 
          learnerProfile: s.learnerProfile,
          doubtHistory: s.doubtHistory 
        });

        await syncToDatabase(sessionId);
        if (socket.user && !socket.user.isGuest) {
          await sessionStore.persistProfile(sessionId, { question: cleanQuestion });
        }

        // Mid-lesson Replan
        const doubtssinceReplan = (s.doubtHistory.length) - (s._lastReplanDoubtCount || 0);
        if (s.learnerProfile.confusionIndex >= 5 && s.steps?.length > 0 && doubtssinceReplan >= 3) {
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
      socket.emit('teaching:doubt-response', {
        _question: cleanQuestion,
        answer: 'Something went wrong while processing your question.',
        isRelevant: true,
        hasVisuals: false,
      });
    }
  });
}
