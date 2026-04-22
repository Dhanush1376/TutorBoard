import { useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import useSocket from './useSocket';
import useTutorStore, { STATES } from '../store/tutorStore';
import { trackEvent, identifyUser } from '../utils/analytics';

export { STATES };

export function useTeachingMachine(isAuthReady = true) {
  const { emit, on, isConnected, connectionError } = useSocket(isAuthReady);
  const playIntervalRef   = useRef(null);
  const safetyTimeoutRef  = useRef(null);

  // ─── Pull store state & actions ──────────────────────────────────────────
  const {
    machineState, sessionId, topic,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory, activeDoubtId,
    error, greetingMessage,
    isPlaying, isPaused, playbackSpeed,
    setMachineState, setSessionId, setConnected, setConnectionError,
    setTimeline, setCurrentStep, setError, setGreeting, setChatSessionId,
    setDoubtProcessing, addDoubt, setDoubtResponse,
    mutateCanvasObjects, addCanvasObjects,
    startSession: storeStartSession,
    endSession,
    play: storePlay, pause: storePause,
    nextStep: storeNextStep, prevStep: storePrevStep,
    goToStep: storeGoToStep,
    setPlaybackSpeed,
    selectedAgent,
    setGuestTrialStatus,
  } = useTutorStore(useShallow(s => ({
    machineState: s.machineState,
    sessionId: s.sessionId,
    topic: s.topic,
    timeline: s.timeline,
    learningNodes: s.learningNodes,
    mode: s.mode,
    difficulty: s.difficulty,
    professorNote: s.professorNote,
    memoryAnchor: s.memoryAnchor,
    keyFormula: s.keyFormula,
    currentStepIndex: s.currentStepIndex,
    totalSteps: s.totalSteps,
    canvasObjects: s.canvasObjects,
    canvasConnections: s.canvasConnections,
    canvasSteps: s.canvasSteps,
    doubtResponse: s.doubtResponse,
    isDoubtProcessing: s.isDoubtProcessing,
    doubtHistory: s.doubtHistory,
    activeDoubtId: s.activeDoubtId,
    error: s.error,
    greetingMessage: s.greetingMessage,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    playbackSpeed: s.playbackSpeed,
    setMachineState: s.setMachineState,
    setSessionId: s.setSessionId,
    setConnected: s.setConnected,
    setConnectionError: s.setConnectionError,
    setTimeline: s.setTimeline,
    setCurrentStep: s.setCurrentStep,
    setError: s.setError,
    setGreeting: s.setGreeting,
    setChatSessionId: s.setChatSessionId,
    setDoubtProcessing: s.setDoubtProcessing,
    addDoubt: s.addDoubt,
    setDoubtResponse: s.setDoubtResponse,
    mutateCanvasObjects: s.mutateCanvasObjects,
    addCanvasObjects: s.addCanvasObjects,
    startSession: s.startSession,
    endSession: s.endSession,
    play: s.play,
    pause: s.pause,
    nextStep: s.nextStep,
    prevStep: s.prevStep,
    goToStep: s.goToStep,
    setPlaybackSpeed: s.setPlaybackSpeed,
    selectedAgent: s.selectedAgent,
    setGuestTrialStatus: s.setGuestTrialStatus,
    setLearnerProfile: s.setLearnerProfile,
    setResumeContext: s.setResumeContext,
  })));

  // ─── Sync connection state ────────────────────────────────────────────────
  useEffect(() => {
    setConnected(isConnected);
    if (connectionError) setConnectionError(connectionError);
  }, [isConnected, connectionError, setConnected, setConnectionError]);

  // ─── Notification Helper ──────────────────────────────────────────────────
  const notifyUser = useCallback((title, body) => {
    // Check if notifications are enabled
    const notifCompletion = localStorage.getItem('tb-notif-completion') !== 'false';
    const notifSound = localStorage.getItem('tb-notif-sound') !== 'false';

    if (notifCompletion && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }

    if (notifSound) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {
        // audio context failed or not allowed without user gesture
      }
    }
  }, []);

  // ─── Socket Event Listeners ───────────────────────────────────────────────
  useEffect(() => {
    const cleanups = [];

    // ─── Phase 2 Fix: Snapshot-Aware Sync ───
    // Only apply remote session sync if we aren't actively interacting AND not in snapshot mode.
    // This prevents "disappearing items" when editing a message snapshot.
    cleanups.push(on('canvas:sync', (data) => {
      const state = useTutorStore.getState();
      if (!state.isInteracting && !state.activeSnapshotId) {
        setCanvasObjects(data.objects);
      }
    }));

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

      if (data.isResume) {
        setResumeContext({ topic: data.title, stepIndex: data.currentStepIndex || 0 });
      }
      
      trackEvent('session_timeline_received', { 
        sessionId: data.sessionId, 
        topic: data.title, 
        steps: data.totalSteps,
        renderer: data.renderer
      });

      // Ensure machine state advances to TEACHING even if the FSM event
      // arrived before or after this timeline payload
      setMachineState(STATES.TEACHING);

      notifyUser("TutorBoard Agent", "Your lesson session is ready!");
    }));

    // Step update from server
    cleanups.push(on('teaching:step', (data) => {
      setCurrentStep(data.index);
    }));

    // Generation progress message
    cleanups.push(on('teaching:progress', (data) => {
      console.log(`[Machine] Progress: ${data.message}`);
      setNarrationTokens(''); // Clear previous tokens when stage changes
    }));

    // Streaming tokens for narration (Phase 1/2)
    cleanups.push(on('teaching:progress-tokens', (data) => {
      setNarrationTokens(data.text || '');
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
      notifyUser("New Agent Reply", "The AI has responded to your doubt.");
    }));
 
    // Doubt Delta received (Phase 3)
    cleanups.push(on('teaching:doubt-delta', (data) => {
      console.log(`[Machine] Doubt Delta: ${data.actions?.length} actions`);
      if (data.actions) mutateCanvasObjects(data.actions);
      addDoubt(data._question, data.answer, true, { actions: data.actions, isDelta: true });
      setDoubtProcessing(false);
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

    // ─── Adaptive Replanning Events ─────────────────────────────────────────
    // Server emits these when confusionIndex triggers a mid-lesson replan
    cleanups.push(on('teaching:replan', (data) => {
      console.log(`[Machine] 🔄 Adaptive replan: "${data.message}" (${data.newTotalSteps} steps)`);
      notifyUser('Lesson Adapted', data.message || 'Steps have been simplified for you.');
    }));

    cleanups.push(on('teaching:timeline-update', (data) => {
      console.log(`[Machine] 🔄 Timeline update received: ${data.totalSteps} steps`);
      setTimeline({
        steps:      data.steps,
        timeline:   data.steps,
        totalSteps: data.totalSteps,
        // Preserve existing elements/connections — only steps changed
        elements:    useTutorStore.getState().canvasObjects,
        objects:     useTutorStore.getState().canvasObjects,
        connections: useTutorStore.getState().canvasConnections,
        renderer:    useTutorStore.getState().renderer || 'cinematic',
      });
    }));

    // MongoDB session ID feedback
    cleanups.push(on('session:db-id', (data) => {
      if (data.chatSessionId) {
        console.log(`[Machine] Received MongoDB chatSessionId: ${data.chatSessionId}`);
        setChatSessionId(data.chatSessionId);
      }
    }));

    // Guest Trial Status
    cleanups.push(on('guest:status', (data) => {
      console.log(`[Machine] Guest Usage: ${data.count} / ${data.limit} (Warning: ${data.warning})`);
      setGuestTrialStatus(data);
    }));

    // Learner Profile update
    cleanups.push(on('teaching:profile', (data) => {
      console.log(`[Machine] Learner Profile sync:`, data);
      setLearnerProfile(data);
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [
    on, isConnected,
    setMachineState, setSessionId, setChatSessionId, setTimeline, setCurrentStep,
    setDoubtProcessing, addDoubt, mutateCanvasObjects, addCanvasObjects,
    setError, setGreeting, notifyUser,
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

  // ─── Real-time Canvas Sync (Manual edits) ─────────────────────────────────
  const lastSyncRef = useRef('');
  useEffect(() => {
    if (!isConnected || !sessionId || !canvasObjects || canvasObjects.length === 0) return;

    // Check if objects are actually different (shallow check on serializable string)
    const currentSig = JSON.stringify(canvasObjects);
    if (currentSig === lastSyncRef.current) return;

    const autoSaveMs = (parseInt(localStorage.getItem('tb-auto-save')) || 5) * 1000;
    
    const timer = setTimeout(() => {
      console.log('[Machine] 🔄 Syncing board state to server...');
      emit('canvas:sync', { objects: canvasObjects });
      lastSyncRef.current = currentSig;
    }, autoSaveMs);

    return () => clearTimeout(timer);
  }, [canvasObjects, isConnected, sessionId, emit]);


  // ─── Actions ──────────────────────────────────────────────────────────────
  const startSession = useCallback((topicStr, initialQuestion, activeMode) => {
    storeStartSession(topicStr, initialQuestion);
    // Pass the existing chatSessionId (if any) so the server can resume/link
    // the correct MongoDB document instead of creating a duplicate.
    const existingChatId = useTutorStore.getState().chatSessionId;
    
    identifyUser(topicStr, { last_topic: topicStr });
    trackEvent('session_started', { topic: topicStr, mode: activeMode, agent: selectedAgent });
    
    emit('session:start', { topic: topicStr, initialQuestion, selectedAgent, activeMode, chatId: existingChatId || undefined });
  }, [emit, storeStartSession, selectedAgent]);

  const askDoubt = useCallback((question, activeMode) => {
    storePause();
    setDoubtProcessing(true);
    trackEvent('doubt_asked', { question, agent: selectedAgent });
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