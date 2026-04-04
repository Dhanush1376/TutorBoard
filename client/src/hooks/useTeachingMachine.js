/**
 * useTeachingMachine — WebSocket-driven hook that syncs server state with Zustand store
 * 
 * This hook is now a thin bridge: it listens to socket events and pipes 
 * data into the centralized useTutorStore. Components read from the store directly.
 */

import { useCallback, useRef, useEffect } from 'react';
import useSocket from './useSocket';
import useTutorStore, { STATES } from '../store/tutorStore';

export { STATES };

export function useTeachingMachine() {
  const { emit, on, isConnected, connectionError } = useSocket();
  const playIntervalRef = useRef(null);

  // ─── Pull store state & actions ───
  const store = useTutorStore();
  const {
    machineState, sessionId, topic,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula, currentStepIndex, totalSteps,
    canvasObjects, canvasSteps,
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
  } = store;

  // ─── Sync connection state ───
  useEffect(() => {
    setConnected(isConnected);
    if (connectionError) setConnectionError(connectionError);
  }, [isConnected, connectionError, setConnected, setConnectionError]);

  // ─── Socket Event Listeners ───
  useEffect(() => {
    const cleanups = [];

    // State changes from server
    cleanups.push(on('teaching:state', (data) => {
      console.log(`[Machine] State: ${data.from} → ${data.state} (${data.event})`);
      setMachineState(data.state);
      if (data.payload?.sessionId) {
        setSessionId(data.payload.sessionId);
      }
    }));

    // Full timeline received
    cleanups.push(on('teaching:timeline', (data) => {
      console.log(`[Machine] Timeline received: ${data.title} (${data.totalSteps} steps)`);
      setTimeline({
        ...data,
        totalSteps: data.totalSteps || data.steps?.length || 0,
      });
    }));

    // Step update
    cleanups.push(on('teaching:step', (data) => {
      setCurrentStep(data.index);
    }));

    // Doubt acknowledged
    cleanups.push(on('teaching:doubt-ack', () => {
      setDoubtProcessing(true);
    }));

    // Doubt response
    cleanups.push(on('teaching:doubt-response', (data) => {
      // Add doubt to thread history
      addDoubt(
        data._question || '',
        data.answer,
        data.hasVisuals,
        data.visualUpdate
      );

      // Apply visual mutations if present
      if (data.hasVisuals && data.visualUpdate) {
        if (data.visualUpdate.mutations) {
          // New mutation-based system
          mutateCanvasObjects(data.visualUpdate.mutations);
        } else if (data.visualUpdate.objects) {
          // Legacy: add objects from doubt response
          addCanvasObjects(data.visualUpdate.objects);
        }
      }
    }));

    // Error
    cleanups.push(on('teaching:error', (data) => {
      console.error('[Machine] Error:', data.message);
      setError(data.message);
    }));

    // Greeting
    cleanups.push(on('teaching:greeting', (data) => {
      setGreeting(data.message);
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [on, isConnected, setMachineState, setSessionId, setTimeline, setCurrentStep, setDoubtProcessing, addDoubt, mutateCanvasObjects, addCanvasObjects, setError, setGreeting]);

  // ─── Auto-play logic ───
  useEffect(() => {
    if (isPlaying && !isPaused && machineState === STATES.TEACHING && timeline) {
      const currentStep = canvasSteps[currentStepIndex];
      const currentDuration = currentStep?.duration || 3000;
      const adjustedDuration = currentDuration / playbackSpeed;

      playIntervalRef.current = setTimeout(() => {
        if (currentStepIndex < totalSteps - 1) {
          const nextIndex = currentStepIndex + 1;
          emit('session:step', { stepIndex: nextIndex });
          setCurrentStep(nextIndex);
        } else {
          // Final step complete → Finish automatically
          emit('session:finish');
          storePause();
        }
      }, adjustedDuration);
    }

    return () => {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
      }
    };
  }, [isPlaying, isPaused, currentStepIndex, machineState, timeline, canvasSteps, totalSteps, playbackSpeed, emit, setCurrentStep, storePause]);

  // ─── Actions (emit to server + update store) ───
  const startSession = useCallback((topicStr, initialQuestion) => {
    storeStartSession(topicStr, initialQuestion);
    emit('session:start', { topic: topicStr, initialQuestion });
  }, [emit, storeStartSession]);

  const askDoubt = useCallback((question) => {
    storePause();
    setDoubtProcessing(true);
    emit('session:doubt', { question });
  }, [emit, storePause, setDoubtProcessing]);

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

  const nextStep = useCallback(() => {
    if (activeDoubtId) {
      resume();
      return;
    }
    if (currentStepIndex < totalSteps - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      finish();
    }
  }, [currentStepIndex, totalSteps, goToStep, finish, activeDoubtId, resume]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  return {
    // Connection
    isConnected,
    connectionError,

    // State (from store)
    machineState,
    sessionId,
    isIdle: machineState === STATES.IDLE,
    isGenerating: machineState === STATES.GENERATING,
    isTeaching: machineState === STATES.TEACHING,
    isDoubtTriggered: machineState === STATES.DOUBT_TRIGGERED,
    isResponding: machineState === STATES.RESPONDING,
    isResuming: machineState === STATES.RESUMING,
    isCompleted: machineState === STATES.COMPLETED,
    isError: machineState === STATES.ERROR,

    // Data (from store)
    timeline,
    currentStep: canvasSteps[currentStepIndex] || null,
    currentStepIndex,
    totalSteps,
    learningNodes,
    mode,
    difficulty,
    professorNote,
    memoryAnchor,
    keyFormula,
    canvasObjects,
    canvasSteps,
    doubtResponse,
    isDoubtProcessing,
    doubtHistory,
    error,
    greetingMessage,

    // Playback
    isPlaying,
    isPaused,

    // Actions
    startSession,
    askDoubt,
    goToStep,
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
