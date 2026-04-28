import { STATES, EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import { syncToDatabase } from '../utils.js';
import { deriveNextLevel } from '../../utils/core/pedagogyHelper.js';

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
      const newerConfusion = Math.max(0, currentConfusion - 0.05);
      
      // Track Engagement
      const engagement = s.learnerProfile.engagementMetrics || { visualStepsCompleted: 0, conceptualDoubtsAsked: 0, avgStepDuration: 0, styleDetected: 'unknown' };
      engagement.visualStepsCompleted += 1;

      // Track "Consecutive Clear Steps" for Level Up
      let consecutiveClearSteps = (s.consecutiveClearSteps || 0) + 1;
      if (newerConfusion >= 0.1) consecutiveClearSteps = 0; // Reset if confusion peaks

      const safeLearnerProfile = {
        ...s.learnerProfile,
        engagementMetrics: engagement,
        topicsMastery: s.learnerProfile.topicsMastery instanceof Map
          ? Object.fromEntries(s.learnerProfile.topicsMastery)
          : (s.learnerProfile.topicsMastery || {})
      };

      if (newerConfusion < 0.1 && consecutiveClearSteps >= 5) {
        console.log(`[Navigation] 🏆 Level Up! Streak: ${consecutiveClearSteps}`);
        socket.emit('teaching:level-up', { 
          message: "You're on a roll — moving to more advanced concepts!",
          newLevel: deriveNextLevel(s.learnerProfile.level)
        });
        consecutiveClearSteps = 0; // Reset after level up
        safeLearnerProfile.level = deriveNextLevel(s.learnerProfile.level);
      }

      await sessionStore.update(sessionId, { 
        consecutiveClearSteps,
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
