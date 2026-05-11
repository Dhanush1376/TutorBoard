import { STATES, EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import { syncToDatabase, emitProfile } from '../utils.js';
import { deriveNextLevel } from '../../utils/core/pedagogyHelper.js';
import { trackEvent } from '../../utils/core/analytics.js';

export function registerNavigationHandlers(socket, machine, sessionId) {
  
  // ─── NAVIGATE STEPS ────────────────────────────────────────────────────
  socket.on('session:step', async ({ stepIndex }) => {
    const s = await sessionStore.get(sessionId);

    if (!s || !s.steps || s.steps.length === 0) return;
    if (!s.steps[stepIndex]) return;

    await sessionStore.goToStep(sessionId, stepIndex);

    // BUG-08: Decrement confusion index on forward progress
    if (s.learnerProfile) {
      const currentConfusion = s.learnerProfile.confusionIndex || 0;
      
      // ONLY decrement if the student advanced WITHOUT asking a doubt on this step
      const wasClearStep = s.hasAskedDoubtOnStep === false; 
      const newerConfusion = wasClearStep 
        ? Math.max(0, currentConfusion - 0.05) // Stable reward for clear steps
        : currentConfusion; // No penalty, but no reward either
      
      // Track Engagement
      const engagement = s.learnerProfile.engagementMetrics || { visualStepsCompleted: 0, conceptualDoubtsAsked: 0, avgStepDuration: 0, styleDetected: 'unknown' };
      engagement.visualStepsCompleted += 1;

      // Track "Consecutive Clear Steps" for Level Up
      let consecutiveClearSteps = wasClearStep ? (s.consecutiveClearSteps || 0) + 1 : 0;
      if (newerConfusion >= 0.1) consecutiveClearSteps = 0; // Reset if confusion peaks

      const safeLearnerProfile = {
        ...s.learnerProfile,
        engagementMetrics: engagement,
        topicsMastery: s.learnerProfile.topicsMastery instanceof Map
          ? Object.fromEntries(s.learnerProfile.topicsMastery)
          : (s.learnerProfile.topicsMastery || {})
      };

      // PHASE 5: PostHog Analytics
      const userId = socket.user?.id || socket.user?._id || socket.handshake.address;
      trackEvent(userId, 'Step Completed', {
        topic: s.topic,
        stepIndex: stepIndex,
        wasClearStep: wasClearStep,
        confusionIndex: newerConfusion
      });

      if (newerConfusion < 0.1 && consecutiveClearSteps >= 5) {
        console.log(`[Navigation] 🏆 Level Up! Streak: ${consecutiveClearSteps}`);
        
        trackEvent(userId, 'Level Up', {
          topic: s.topic,
          oldLevel: s.learnerProfile.level,
          newLevel: deriveNextLevel(s.learnerProfile.level)
        });

        socket.emit('teaching:level-up', { 
          message: "You're on a roll — moving to more advanced concepts!",
          newLevel: deriveNextLevel(s.learnerProfile.level)
        });
        consecutiveClearSteps = 0; // Reset after level up
        safeLearnerProfile.level = deriveNextLevel(s.learnerProfile.level);
      }

      await sessionStore.update(sessionId, { 
        consecutiveClearSteps,
        hasAskedDoubtOnStep: false, // RESET for the new step
        learnerProfile: { ...safeLearnerProfile, confusionIndex: newerConfusion } 
      });
    }

    socket.emit('teaching:step', { step: s.steps[stepIndex], index: stepIndex, total: s.steps.length });

    if (machine.state === STATES.COMPLETED || machine.state === STATES.RESPONDING) {
      machine.send(EVENTS.RESUME);
    }

    await syncToDatabase(sessionId);
    if (socket.user && !socket.user.isGuest) {
      await sessionStore.persistProfile(sessionId);
      await emitProfile(socket, sessionId);
    }
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
}
