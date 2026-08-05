import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useTutorStore, { STATES } from '../store/tutorStore';
import { estimateReadingMs, smartPauseMs, stepDeadlineMs } from '../engine/narrationTiming';

/**
 * useSceneAutoplay — completion-gated playback for SSE-rendered scenes.
 *
 * A step advances only when BOTH of its completion signals arrive:
 *   - animDone : the step's master timeline finished (AgentCanvasRenderer
 *                marks it via the orchestrator's onComplete)
 *   - voiceDone: the narration finished. With no TTS on this path, a
 *                reading-time estimate proportional to the narration length
 *                stands in, so long explanations get long steps and short
 *                ones move quickly — narration and animation never overlap.
 *
 * A smart pause (longer after equations/results) separates steps, and a
 * safety deadline guarantees playback can never stall on a lost signal.
 *
 * The socket "teaching session" path has its own driver in useTeachingMachine
 * (gated on machineState === TEACHING); this hook only runs while IDLE.
 */
export default function useSceneAutoplay() {
  const {
    activeScene, currentStepIndex, isPlaying, isPaused, playbackSpeed,
    machineState, canvasLayout, stepPlayback,
  } = useTutorStore(useShallow((s) => ({
    activeScene: s.activeScene,
    currentStepIndex: s.currentStepIndex,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    playbackSpeed: s.playbackSpeed,
    machineState: s.machineState,
    canvasLayout: s.canvasLayout,
    stepPlayback: s.stepPlayback,
  })));

  // Timers, all owned per-step; index tracks which step they belong to.
  const timersRef = useRef({ index: -1, read: null, advance: null, deadline: null });

  const clearTimers = () => {
    const t = timersRef.current;
    if (t.read) clearTimeout(t.read);
    if (t.advance) clearTimeout(t.advance);
    if (t.deadline) clearTimeout(t.deadline);
    timersRef.current = { index: -1, read: null, advance: null, deadline: null };
  };

  useEffect(() => {
    // Only the SSE path — socket teaching sessions self-drive.
    if (machineState !== STATES.IDLE) { clearTimers(); return; }
    if (canvasLayout === 'inline') { clearTimers(); return; }

    const steps = activeScene?.steps || activeScene?.timeline || [];
    const total = steps.length;
    if (total <= 1) { clearTimers(); return; }
    if (!isPlaying || isPaused) { clearTimers(); return; }

    // Reached the end — stop cleanly so the control bar shows "paused".
    if (currentStepIndex >= total - 1 && stepPlayback.animDone && stepPlayback.voiceDone) {
      clearTimers();
      useTutorStore.getState().pause?.();
      return;
    }

    const step = steps[currentStepIndex] || {};
    const speed = Math.max(0.25, playbackSpeed || 1);
    const t = timersRef.current;

    // New step → arm the reading-time voice signal and the safety deadline.
    if (t.index !== currentStepIndex) {
      clearTimers();
      timersRef.current.index = currentStepIndex;

      const narration = step.narration || step.explanation || step.pedagogicalNarration || '';
      timersRef.current.read = setTimeout(() => {
        useTutorStore.getState().markStepVoiceDone?.(currentStepIndex);
      }, estimateReadingMs(narration, speed));

      timersRef.current.deadline = setTimeout(() => {
        const s = useTutorStore.getState();
        const liveTotal = (s.activeScene?.steps || s.activeScene?.timeline || []).length;
        if (s.isPlaying && !s.isPaused && s.currentStepIndex === currentStepIndex && currentStepIndex < liveTotal - 1) {
          s.setCurrentStep(currentStepIndex + 1);
        }
      }, stepDeadlineMs(step, speed));
    }

    // Both signals in → advance after the smart pause.
    const ready = stepPlayback.index === currentStepIndex && stepPlayback.animDone && stepPlayback.voiceDone;
    if (ready && !timersRef.current.advance && currentStepIndex < total - 1) {
      timersRef.current.advance = setTimeout(() => {
        const s = useTutorStore.getState();
        const liveTotal = (s.activeScene?.steps || s.activeScene?.timeline || []).length;
        if (s.isPlaying && !s.isPaused && s.currentStepIndex < liveTotal - 1) {
          s.setCurrentStep(s.currentStepIndex + 1);
        }
      }, smartPauseMs(step, speed));
    }

    return undefined;
  }, [activeScene, currentStepIndex, isPlaying, isPaused, playbackSpeed, machineState, canvasLayout, stepPlayback]);

  // Full cleanup on unmount only.
  useEffect(() => clearTimers, []);
}
