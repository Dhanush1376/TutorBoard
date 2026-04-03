/**
 * useTeachingMachine — Client-side state machine for teaching sessions
 * 
 * Mirrors the server-side state machine, driven by WebSocket events.
 * All UI rendering decisions are derived from this hook's state.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import useSocket from './useSocket';

// State constants (must match server)
export const STATES = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  TEACHING: 'TEACHING',
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING: 'RESPONDING',
  RESUMING: 'RESUMING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
};

export function useTeachingMachine() {
  const { emit, on, isConnected, connectionError } = useSocket();

  // Core state
  const [machineState, setMachineState] = useState(STATES.IDLE);
  const [sessionId, setSessionId] = useState(null);

  // Teaching data
  const [timeline, setTimeline] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  // Doubt data
  const [doubtResponse, setDoubtResponse] = useState(null);
  const [isDoubtProcessing, setIsDoubtProcessing] = useState(false);
  const [doubtHistory, setDoubtHistory] = useState([]);

  // Error state
  const [error, setError] = useState(null);

  // Greeting
  const [greetingMessage, setGreetingMessage] = useState(null);

  // Playback
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const playSpeedRef = useRef(1);

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
      setError(null);
    }));

    // Full timeline received
    cleanups.push(on('teaching:timeline', (data) => {
      console.log(`[Machine] Timeline received: ${data.title} (${data.totalSteps} steps)`);
      setTimeline(data);
      setTotalSteps(data.totalSteps);
      setCurrentStepIndex(0);
      setDoubtResponse(null);
      setGreetingMessage(null);
    }));

    // Step update
    cleanups.push(on('teaching:step', (data) => {
      setCurrentStep(data.step);
      setCurrentStepIndex(data.index);
      setTotalSteps(data.total);
    }));

    // Doubt acknowledged
    cleanups.push(on('teaching:doubt-ack', () => {
      setIsDoubtProcessing(true);
    }));

    // Doubt response
    cleanups.push(on('teaching:doubt-response', (data) => {
      setDoubtResponse(data);
      setIsDoubtProcessing(false);
      setDoubtHistory(prev => [...prev, {
        question: data._question,
        answer: data.answer,
        timestamp: Date.now(),
      }]);
    }));

    // Error
    cleanups.push(on('teaching:error', (data) => {
      console.error('[Machine] Error:', data.message);
      setError(data.message);
    }));

    // Greeting
    cleanups.push(on('teaching:greeting', (data) => {
      setGreetingMessage(data.message);
      setMachineState(STATES.IDLE);
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [on]);

  // ─── Auto-play logic ───
  useEffect(() => {
    if (isPlaying && !isPaused && machineState === STATES.TEACHING && timeline) {
      const speed = playSpeedRef.current;
      const currentDuration = currentStep?.duration || 3000;
      const adjustedDuration = currentDuration / speed;

      playIntervalRef.current = setTimeout(() => {
        if (currentStepIndex < totalSteps - 1) {
          const nextIndex = currentStepIndex + 1;
          emit('session:step', { stepIndex: nextIndex });
          setCurrentStepIndex(nextIndex);
        } else {
          setIsPlaying(false);
        }
      }, adjustedDuration);
    }

    return () => {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
      }
    };
  }, [isPlaying, isPaused, currentStepIndex, machineState, timeline, currentStep, totalSteps, emit]);

  // ─── Actions ───
  const startSession = useCallback((topic) => {
    setError(null);
    setTimeline(null);
    setDoubtResponse(null);
    setDoubtHistory([]);
    setGreetingMessage(null);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setIsPaused(false);
    emit('session:start', { topic });
  }, [emit]);

  const askDoubt = useCallback((question) => {
    setIsPlaying(false);
    setIsPaused(true);
    emit('session:doubt', { question });
  }, [emit]);

  const goToStep = useCallback((stepIndex) => {
    emit('session:step', { stepIndex });
    setIsPlaying(false);
  }, [emit]);

  const play = useCallback(() => {
    setIsPlaying(true);
    setIsPaused(false);
    emit('session:resume');
  }, [emit]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(true);
    emit('session:pause');
  }, [emit]);

  const resume = useCallback(() => {
    setDoubtResponse(null);
    setIsPlaying(true);
    setIsPaused(false);
    emit('session:resume');
  }, [emit]);

  const setSpeed = useCallback((speed) => {
    playSpeedRef.current = speed;
  }, []);

  const endSession = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    emit('session:end');
    setTimeline(null);
    setCurrentStep(null);
    setCurrentStepIndex(0);
    setTotalSteps(0);
    setDoubtResponse(null);
    setDoubtHistory([]);
    setError(null);
    setGreetingMessage(null);
    setMachineState(STATES.IDLE);
  }, [emit]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      goToStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, totalSteps, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  return {
    // Connection
    isConnected,
    connectionError,

    // State
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

    // Data
    timeline,
    currentStep,
    currentStepIndex,
    totalSteps,
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
    setSpeed,
    endSession,
  };
}

export default useTeachingMachine;
