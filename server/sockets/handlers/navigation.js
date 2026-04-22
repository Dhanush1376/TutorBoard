import { STATES, EVENTS } from '../../engine/core/teachingMachine.js';
import sessionStore from '../../engine/core/sessionStore.js';
import { syncToDatabase } from '../utils.js';

export function registerNavigationHandlers(socket, machine, sessionId) {
  
  // ─── NAVIGATE STEPS ────────────────────────────────────────────────────
  socket.on('session:step', async ({ stepIndex }) => {
    const s = await sessionStore.get(sessionId);

    if (!s || !s.steps || s.steps.length === 0) return;
    if (!s.steps[stepIndex]) return;

    await sessionStore.goToStep(sessionId, stepIndex);

    // BUG-08: Decrement confusion index on forward progress
    if (s.learnerProfile && s.learnerProfile.confusionIndex > 0) {
      const newerConfusion = Math.max(0, s.learnerProfile.confusionIndex - 0.05);
      
      const safeLearnerProfile = {
        ...s.learnerProfile,
        topicsMastery: s.learnerProfile.topicsMastery instanceof Map
          ? Object.fromEntries(s.learnerProfile.topicsMastery)
          : (s.learnerProfile.topicsMastery || {})
      };

      await sessionStore.update(sessionId, { 
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
