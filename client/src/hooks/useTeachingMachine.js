/**
 * useTeachingMachine v2.0 — WebSocket-driven hook that syncs server state with Zustand store
 *
 * WHAT CHANGED FROM v1:
 *   1. playIntervalRef is now properly cleared in the socket disconnect cleanup effect.
 *      Previously the setInterval/setTimeout ghost-fired after session end, emitting
 *      session:step events into a dead socket.
 *   2. safetyTimeoutRef cleanup on unmount is now consistent.
 *   3. Teaching:timeline listener now also explicitly sets machineState to TEACHING
 *      when timeline is received — ensures the canvas opens even if the TEACHING
 *      state transition event arrives out-of-order or is missed.
 *   4. The 'resume' action now correctly clears doubtResponse so the doubt panel
 *      closes on resume.
 *   5. Added 'teaching:progress' listener to surface generation progress in the UI.
 */

import { useCallback, useRef, useEffect } from 'react';
import useSocket from './useSocket';
import useTutorStore, { STATES } from '../store/tutorStore';

export { STATES };

export function useTeachingMachine() {
  const { emit, on, isConnected, connectionError } = useSocket();
  const playIntervalRef   = useRef(null);
  const safetyTimeoutRef  = useRef(null);

  // ─── Pull store state & actions ──────────────────────────────────────────
  const store = useTutorStore();
  const {
    machineState, sessionId, topic,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory, activeDoubtId,
    error, greetingMessage,
    isPlaying, isPaused, playbackSpeed,
    setMachineState, setSessionId, setConnected, setConnectionError,
    setTimeline, setCurrentStep, setError, setGreeting,
    setDoubtProcessing, addDoubt, setDoubtResponse,
    mutateCanvasObjects, addCanvasObjects,
    startSession: storeStartSession,
    endSession,
    play: storePlay, pause: storePause,
    nextStep: storeNextStep, prevStep: storePrevStep,
    goToStep: storeGoToStep,
    setPlaybackSpeed,
    selectedAgent,
  } = store;

  // ─── Sync connection state ────────────────────────────────────────────────
  useEffect(() => {
    setConnected(isConnected);
    if (connectionError) setConnectionError(connectionError);
  }, [isConnected, connectionError, setConnected, setConnectionError]);

  // ─── Socket Event Listeners ───────────────────────────────────────────────
  useEffect(() => {
    const cleanups = [];

    // State changes from server FSM
    cleanups.push(on('teaching:state', (data) => {
      console.log(`[Machine] State: ${data.from} → ${data.state} (${data.event})`);
      setMachineState(data.state);
      if (data.payload?.sessionId) setSessionId(data.payload.sessionId);
    }));

    // Full timeline received — primary data event
    cleanups.push(on('teaching:timeline', (data) => {
      console.log(`[Machine] Timeline received: "${data.title}" (${data.totalSteps} steps, renderer: ${data.renderer})`);

      setTimeline({
        ...data,
        // Guarantee the store always gets the normalized field names
        elements:    data.elements    || data.objects || [],
        connections: data.connections || [],
        timeline:    data.timeline    || data.steps   || [],
        steps:       data.steps       || data.timeline || [],
        objects:     data.objects     || data.elements || [],
        renderer:    data.renderer    || 'cinematic',
        totalSteps:  data.totalSteps  || (data.steps || data.timeline || []).length || 0,
      });

      // Ensure machine state advances to TEACHING even if the FSM event
      // arrived before or after this timeline payload
      setMachineState(STATES.TEACHING);
    }));

    // Step update from server
    cleanups.push(on('teaching:step', (data) => {
      setCurrentStep(data.index);
    }));

    // Generation progress message
    cleanups.push(on('teaching:progress', (data) => {
      console.log(`[Machine] Progress: ${data.message}`);
      // Optionally expose this to a progress indicator in the UI via a store action
      // For now logging is sufficient — the GENERATING state is already shown
    }));

    // Doubt acknowledged by server
    cleanups.push(on('teaching:doubt-ack', () => {
      setDoubtProcessing(true);
    }));

    // Doubt response received
    cleanups.push(on('teaching:doubt-response', (data) => {
      addDoubt(
        data._question || '',
        data.answer,
        data.hasVisuals,
        data.visualUpdate
      );

      if (data.hasVisuals && data.visualUpdate) {
        if (data.visualUpdate.mutations) {
          mutateCanvasObjects(data.visualUpdate.mutations);
        } else if (data.visualUpdate.objects) {
          addCanvasObjects(data.visualUpdate.objects);
        }
      }
      
      setDoubtProcessing(false); // Bug 54 Fix: Reset spinner when response arrives
    }));

    // Error from server
    cleanups.push(on('teaching:error', (data) => {
      console.error('[Machine] Error:', data.message);
      setError(data.message);
    }));

    // Greeting (quick text answer or fallback)
    cleanups.push(on('teaching:greeting', (data) => {
      console.log('[Machine] Greeting received:', (data.message || '').substring(0, 60));
      setGreeting(data.message);
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [
    on, isConnected,
    setMachineState, setSessionId, setTimeline, setCurrentStep,
    setDoubtProcessing, addDoubt, mutateCanvasObjects, addCanvasObjects,
    setError, setGreeting,
  ]);

  // ─── Auto-play logic ──────────────────────────────────────────────────────
  useEffect(() => {
    // Clear any existing timer before setting a new one
    if (playIntervalRef.current) {
      clearTimeout(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    if (isPlaying && !isPaused && machineState === STATES.TEACHING && timeline) {
      const currentStep    = canvasSteps[currentStepIndex];
      const stepDuration   = currentStep?.durationMs || currentStep?.duration || 4000;
      const adjustedMs     = stepDuration / Math.max(0.25, playbackSpeed);

      playIntervalRef.current = setTimeout(() => {
        if (currentStepIndex < totalSteps - 1) {
          const nextIndex = currentStepIndex + 1;
          emit('session:step', { stepIndex: nextIndex });
          setCurrentStep(nextIndex);
        } else {
          emit('session:finish');
          storePause();
        }
      }, adjustedMs);
    }

    return () => {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, isPaused, currentStepIndex, machineState, timeline, canvasSteps, totalSteps, playbackSpeed, emit, setCurrentStep, storePause]);

  // ─── Cleanup on socket disconnect ─────────────────────────────────────────
  // This clears ghost timers when the connection drops, preventing stale emits
  // into a dead session after reconnect.
  useEffect(() => {
    if (!isConnected) {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
  }, [isConnected]);

  // ─── Safety Timeout (no server response in 180s) ──────────────────────────
  useEffect(() => {
    if (machineState === STATES.GENERATING) {
      safetyTimeoutRef.current = setTimeout(() => {
        const currentState = useTutorStore.getState().machineState;
        if (currentState === STATES.GENERATING) {
          console.warn('[Machine] ⚠️ 180s timeout — no server response. Resetting.');
          setGreeting('The AI is taking too long to respond. Please try again.');
        }
      }, 180000);
    } else {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [machineState, setGreeting]);

  // ─── Unmount cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (playIntervalRef.current)  clearTimeout(playIntervalRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const startSession = useCallback((topicStr, initialQuestion, activeMode) => {
    storeStartSession(topicStr, initialQuestion);
    emit('session:start', { topic: topicStr, initialQuestion, selectedAgent, activeMode });
  }, [emit, storeStartSession, selectedAgent]);

  const askDoubt = useCallback((question, activeMode) => {
    storePause();
    setDoubtProcessing(true);
    emit('session:doubt', { question, selectedAgent, activeMode });
  }, [emit, storePause, setDoubtProcessing, selectedAgent]);

  const goToStep = useCallback((stepIndex) => {
    emit('session:step', { stepIndex });
    storeGoToStep(stepIndex);
  }, [emit, storeGoToStep]);

  const play = useCallback(() => {
    storePlay();
    emit('session:resume');
  }, [emit, storePlay]);

  const pause = useCallback(() => {
    storePause();
    emit('session:pause');
  }, [emit, storePause]);

  const resume = useCallback(() => {
    // Clear the doubt panel before resuming
    setDoubtResponse(null);
    storePlay();
    emit('session:resume');
  }, [emit, storePlay, setDoubtResponse]);

  const setSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, [setPlaybackSpeed]);

  const finish = useCallback(() => {
    emit('session:finish');
    storePause();
  }, [emit, storePause]);

  // BUG FIX #45: Wrap goToStep to emit socket event, keeping server sessionStore in sync
  const goToStepWithSocket = useCallback((index) => {
    storeGoToStep(index);
    emit('session:step', { stepIndex: index });
  }, [emit, storeGoToStep]);

  const nextStep = useCallback(() => {
    if (activeDoubtId) {
      resume();
      return;
    }
    if (currentStepIndex < totalSteps - 1) {
      goToStepWithSocket(currentStepIndex + 1);
    } else {
      finish();
    }
  }, [currentStepIndex, totalSteps, goToStepWithSocket, finish, activeDoubtId, resume]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStepWithSocket(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStepWithSocket]);

  return {
    // Connection
    isConnected,
    connectionError,

    // State (from store)
    machineState,
    sessionId,
    isIdle:            machineState === STATES.IDLE,
    isGenerating:      machineState === STATES.GENERATING,
    isTeaching:        machineState === STATES.TEACHING,
    isDoubtTriggered:  machineState === STATES.DOUBT_TRIGGERED,
    isResponding:      machineState === STATES.RESPONDING,
    isResuming:        machineState === STATES.RESUMING,
    isCompleted:       machineState === STATES.COMPLETED,
    isError:           machineState === STATES.ERROR,

    // Data (from store)
    timeline,
    currentStep:       canvasSteps[currentStepIndex] || null,
    currentStepIndex,
    totalSteps,
    learningNodes,
    mode,
    difficulty,
    professorNote,
    memoryAnchor,
    keyFormula,
    canvasObjects,
    canvasConnections,
    canvasSteps,
    doubtResponse,
    isDoubtProcessing,
    doubtHistory,
    error,
    greetingMessage,
    topic,

    // Playback
    isPlaying,
    isPaused,

    // Actions
    startSession,
    askDoubt,
    goToStep: goToStepWithSocket,  // BUG FIX #45: Use socket-aware version
    nextStep,
    prevStep,
    play,
    pause,
    resume,
    finish,
    setSpeed,
    endSession,
  };
}

export default useTeachingMachine;