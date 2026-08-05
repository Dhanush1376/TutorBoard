import { useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSocket from './useSocket';
import useTutorStore, { STATES } from '../store/tutorStore';
import { trackEvent, identifyUser } from '../utils/analytics';
import CanvasStateSnapshot from '../engine/CanvasStateSnapshot';
import { smartPauseMs, stepDeadlineMs } from '../engine/narrationTiming';

export { STATES };

const EMPTY_ARRAY = [];

export function useTeachingMachine(isAuthReady = true, isMaster = true) {
  const { emit, on, isConnected, connectionError } = useSocket(isAuthReady);
  const playIntervalRef = useRef(null);
  const safetyTimeoutRef = useRef(null);
  const isStartingRef = useRef(false);

  // ─── Pull store state & actions ──────────────────────────────────────────
    const {
    machineState, sessionId, topic,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory, activeDoubtId,
    error, greetingMessage, chatSessionId, generationProgress,

    isPlaying, isPaused, playbackSpeed, isDeltaRunning,
    isInteracting, activeSnapshotId, guestTrialStatus,
    stepPlayback,
    isConnected: storeIsConnected, connectionError: storeConnectionError,



    setMachineState, setSessionId, setConnected, setConnectionError, syncConnection,
    setTimeline, loadScene, setCurrentStep, setError, setGreeting, setChatSessionId,
    setLearnerProfile, setResumeContext, setLevelUpEvent,
    setGenerationProgress,

    setDoubtProcessing, addDoubt, setDoubtResponse, setDeltaState,
    mutateCanvasObjects, addCanvasObjects,
    setNarrationTokens,
    startSession: storeStartSession,
    endSession,
    forceReset,
    play: storePlay, pause: storePause,
    goToStep: storeGoToStep,

    setPlaybackSpeed,
    selectedAgent,
    setGuestTrialStatus,
    incrementGuestUsage,
    incrementGuestSession,
    pinDoubtToCanvas,
    jumpToDoubt,
    showToast,
    setTopic,
    setCanvasObjectsWithHistory,
  } = useTutorStore(useShallow(s => ({

    machineState: s.machineState,
    sessionId: s.sessionId,
    topic: s.topic,
    timeline: s.activeScene,
    learningNodes: s.activeScene?.learningNodes || EMPTY_ARRAY,
    mode: s.activeScene?.mode || 'explain',
    difficulty: s.activeScene?.difficulty || 'beginner',
    professorNote: s.activeScene?.professorNote || '',
    memoryAnchor: s.activeScene?.memoryAnchor || '',
    keyFormula: s.activeScene?.keyFormula || '',
    currentStepIndex: s.currentStepIndex,
    totalSteps: s.activeScene?.steps?.length || s.activeScene?.timeline?.length || s.canvasSteps?.length || s.totalSteps || 0,
    canvasObjects: s.canvasObjects,
    canvasConnections: s.activeScene?.connections || EMPTY_ARRAY,
    canvasSteps: s.activeScene?.steps || s.activeScene?.timeline || s.canvasSteps || EMPTY_ARRAY,
    doubtResponse: s.doubtResponse,
    isDoubtProcessing: s.isDoubtProcessing,
    doubtHistory: s.doubtHistory,
    activeDoubtId: s.activeDoubtId,
    error: s.error,
    greetingMessage: s.greetingMessage,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    playbackSpeed: s.playbackSpeed,
    isDeltaRunning: s.isDeltaRunning,
    stepPlayback: s.stepPlayback,
    isInteracting: s.isInteracting,
    activeSnapshotId: s.activeSnapshotId,
    guestTrialStatus: s.guestTrialStatus,
    isConnected: s.isConnected,
    connectionError: s.connectionError,
    generationProgress: s.generationProgress,



    setNarrationTokens: s.setNarrationTokens,
    setMachineState: s.setMachineState,
    setSessionId: s.setSessionId,
    setConnected: s.setConnected,
    setConnectionError: s.setConnectionError,
    setTimeline: s.setTimeline,
    loadScene: s.loadScene,
    setCurrentStep: s.setCurrentStep,
    setError: s.setError,
    setGreeting: s.setGreeting,
    setChatSessionId: s.setChatSessionId,
    setDoubtProcessing: s.setDoubtProcessing,
    addDoubt: s.addDoubt,
    setDoubtResponse: s.setDoubtResponse,
    setDeltaState: s.setDeltaState,
    setGenerationProgress: s.setGenerationProgress,

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
    incrementGuestUsage: s.incrementGuestUsage,
    incrementGuestSession: s.incrementGuestSession,
    setLearnerProfile: s.setLearnerProfile,
    setResumeContext: s.setResumeContext,
    setLevelUpEvent: s.setLevelUpEvent,
    pinDoubtToCanvas: s.pinDoubtToCanvas,
    jumpToDoubt: s.jumpToDoubt,
    showToast: s.showToast,
    setTopic: s.setTopic,
    setCanvasObjectsWithHistory: s.setCanvasObjectsWithHistory,
    forceReset: s.forceReset,
    syncConnection: s.syncConnection,
  })));

  // ─── Refs for Listener Stability ───
  // These refs allow socket listeners to access the LATEST state without 
  // triggering an effect re-run (which would unmount/remount the socket listener).
  const stateRef = useRef({
    isInteracting,
    activeSnapshotId,
    canvasObjects,
    canvasConnections,
    timeline,
    guestTrialStatus,
    topic
  });

  useEffect(() => {
    stateRef.current = {
      isInteracting,
      activeSnapshotId,
      canvasObjects,
      canvasConnections,
      timeline,
      guestTrialStatus,
      topic
    };
  }, [isInteracting, activeSnapshotId, canvasObjects, canvasConnections, timeline, guestTrialStatus, topic]);





  // ─── Notification Helper ──────────────────────────────────────────────────
  const notifyUser = useCallback((title, body) => {
    // Check if notifications are enabled
    const notifCompletion = localStorage.getItem('tb-notif-completion') !== 'false';
    const notifSound = localStorage.getItem('tb-notif-sound') !== 'false';

    if (notifCompletion) {
      // 1. In-app Toast (Top Right)
      showToast({
        message: body,
        type: 'info',
        duration: 4000
      });


      // 2. System Push Notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
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
    if (!isMaster) return;
    const cleanups = [];

    // ─── Phase 2 Fix: Snapshot-Aware Sync ───
    // Only apply remote session sync if we aren't actively interacting AND not in snapshot mode.
    // This prevents "disappearing items" when editing a message snapshot.
    cleanups.push(on('canvas:sync', (data) => {
      // We check raw state here for logic, but it's safe to use hook values if we wrap correctly.
      // But for listeners, sometimes getState() is safer to avoid stale closures.
      // However, to fix the ReferenceError, let's use the hook values which are updated.
      if (!stateRef.current.isInteracting && !stateRef.current.activeSnapshotId) {
        setCanvasObjectsWithHistory(data.objects);
      }

    }));


    // State changes from server FSM
    cleanups.push(on('teaching:state', (data) => {
      import.meta.env.DEV && console.log(`[Machine] State: ${data.from} → ${data.state} (${data.event})`);
      setMachineState(data.state);
      if (data.payload?.sessionId) setSessionId(data.payload.sessionId);
    }));

    // Full timeline received — primary data event
    cleanups.push(on('teaching:timeline', (data) => {
      import.meta.env.DEV && console.log(`[Machine] Timeline received: "${data.title}" (${data.totalSteps} steps, renderer: ${data.renderer})`);

      const normalizedTimeline = {
        ...data,
        // Guarantee the store always gets the normalized field names
        elements: data.elements || data.objects || [],
        connections: data.connections || [],
        timeline: data.timeline || data.steps || [],
        steps: data.steps || data.timeline || [],
        objects: data.objects || data.elements || [],
        renderer: data.renderer || 'cinematic',
        totalSteps: data.totalSteps || (data.steps || data.timeline || []).length || 0,
      };

      if (data.title) setTopic(data.title);

      if (data.isResume) {
        setResumeContext({ topic: data.title, stepIndex: data.currentStepIndex || 0 });
      }

      trackEvent('session_timeline_received', {
        sessionId: data.sessionId,
        topic: data.title,
        steps: data.totalSteps,
        renderer: data.renderer
      });

      // ATOMIC UPDATE: Use the combined setter to prevent UI flicker/race conditions
      // This sets machineState, timeline, objects, and totalSteps in one go.
      useTutorStore.getState().setTeachingTimeline(normalizedTimeline);

      notifyUser("TutorBoard Agent", "Your lesson session is ready!");
    }));

    // Step update from server
    cleanups.push(on('teaching:step', (data) => {
      if (data.isInit) {
        // Force the step render even if index is 0 (Zustand won't re-render on same value)
        useTutorStore.getState().setCurrentStep(-1); // Trigger diff
        requestAnimationFrame(() => useTutorStore.getState().setCurrentStep(data.index));
      } else {
        setCurrentStep(data.index);
      }
    }));

    // Generation progress message
    cleanups.push(on('teaching:progress', (data) => {
      import.meta.env.DEV && console.log(`[Machine] Progress: ${data.message}`);
      setGenerationProgress(data.message);
      setNarrationTokens(''); // Clear previous tokens when stage changes
    }));

    // Streaming tokens for narration (Phase 1/2)
    cleanups.push(on('teaching:progress-tokens', (data) => {
      setNarrationTokens(data.text || '');
    }));

    // Doubt acknowledged by server
    cleanups.push(on('teaching:doubt-ack', () => {
      setDoubtProcessing(true);
      
      // Safety timeout: if no response in 60s, reset
      const timer = setTimeout(() => {
        const store = useTutorStore.getState();
        if (store.isDoubtProcessing) {
          console.warn('[Machine] Doubt response timeout (60s)');
          store.setDoubtProcessing(false);
          store.setWaitingForAI(false);
        }
      }, 60000);
      cleanups.push(() => clearTimeout(timer));
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
      import.meta.env.DEV && console.log(`[Machine] 🚀 Doubt Delta received: ${data.actions?.length || 0} actions`);
      
      if (!data.actions || data.actions.length === 0) {
        console.warn('[Machine] ⚠️ Received doubt-delta with 0 actions. Checking visualUpdate fallback...');
      }

      // CRITICAL FIX: Ensure the socket data immediately triggers the delta state
      // even if addDoubt hasn't finished its async store updates.
      setDeltaState({ 
        actions: data.actions || [], 
        timestamp: Date.now() 
      });

      addDoubt(data._question, data.answer, true, { 
        actions: data.actions || [], 
        isDelta: true 
      });
      
      setDoubtProcessing(false);
      notifyUser("Adaptive Support", "The AI has updated the visuals to answer your doubt.");
    }));


    // Error from server
    cleanups.push(on('teaching:error', (data) => {
      console.error('[Machine] Error:', data.message);
      setError(data.message);
      // FIX: Clear all waiting indicators so the spinner doesn't spin forever after an error
      const store = useTutorStore.getState();
      const sid = store.chatSessionId || store.sessionId || 'temp';
      store.setWaitingForAI(false, sid);
      store.setDoubtProcessing(false);
    }));

    // Greeting (quick text answer or fallback)
    // FIX: Route through startStreaming/finishStreaming so the response appears in the chat window.
    // The old setGreeting() wrote to greetingMessage state which is read by a chatHistory useEffect in Home.jsx
    // but conversationMessages (what ChatWindow renders) never got updated — so nothing showed.
    cleanups.push(on('teaching:greeting', (data) => {
      import.meta.env.DEV && console.log('[Machine] Greeting received:', (data.message || '').substring(0, 60));
      if (!data.message) return;
      const store = useTutorStore.getState();
      // FIX: Prefer sessionId from server payload (most reliable), then fall back to store state.
      // Without this, store.chatSessionId may be null (reset by setSessionId) and
      // store.sessionId may not yet match the socket session, causing sid mismatch.
      const sid = data.sessionId || store.chatSessionId || store.sessionId || store.activeConversationSessionId || 'temp';
      const msgId = `greeting-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const token = `gtok-${Date.now()}`;
      store.startStreaming(msgId, sid, token);
      // Small delay so isWaitingForAI clears before we finalize, avoiding a flicker
      setTimeout(() => {
        store.finishStreaming(data.message, sid, null, [], null, null, 0, token);
      }, 50);
    }));

    // ─── Adaptive Replanning Events ─────────────────────────────────────────
    // Server emits these when confusionIndex triggers a mid-lesson replan
    cleanups.push(on('teaching:replan', (data) => {
      import.meta.env.DEV && console.log(`[Machine] 🔄 Adaptive replan: "${data.message}" (${data.newTotalSteps} steps)`);
      notifyUser('Lesson Adapted', data.message || 'Steps have been simplified for you.');
    }));

    cleanups.push(on('teaching:timeline-update', (data) => {
      import.meta.env.DEV && console.log(`[Machine] 🔄 Timeline update received: ${data.totalSteps} steps`);
      
      const oldTimeline = stateRef.current.timeline || {};
      setTimeline({
        ...oldTimeline,
        steps: data.steps,
        timeline: data.steps,
        totalSteps: data.totalSteps,
        // Preserve existing state-driven objects/connections
        elements: stateRef.current.canvasObjects,
        objects: stateRef.current.canvasObjects,
        connections: stateRef.current.canvasConnections,
        renderer: oldTimeline.renderer || 'cinematic',
      });
    }));



    // MongoDB session ID feedback
    cleanups.push(on('session:db-id', (data) => {
      if (data.chatSessionId) {
        import.meta.env.DEV && console.log(`[Machine] Received MongoDB chatSessionId: ${data.chatSessionId}`);
        const oldId = useTutorStore.getState().chatSessionId || useTutorStore.getState().sessionId;
        useTutorStore.getState().promoteSessionId(oldId, data.chatSessionId);
        setChatSessionId(data.chatSessionId);
      }
    }));

    // Guest Trial Status
    cleanups.push(on('guest:status', (data) => {
      // Only sync if server has a higher count (persistence safety)
      const currentCount = stateRef.current.guestTrialStatus?.messageCount || 0;
      if (data.count > currentCount) {

        import.meta.env.DEV && console.log(`[Machine] Syncing guest usage from server: ${data.count}`);
        setGuestTrialStatus(data);
      }
    }));


    // Guest Trial Limit Reached
    cleanups.push(on('guest:limit-reached', (data) => {
      console.warn(`[Machine] 🚫 Guest limit reached (Server): ${data.count}/${data.limit}`);
      setGuestTrialStatus({
        isLimitReached: true,
        messageCount: Math.max(data.count, stateRef.current.guestTrialStatus?.messageCount || 0),
        limit: data.limit,

        warning: true
      });
    }));


    // Learner Profile update
    cleanups.push(on('teaching:profile', (data) => {
      import.meta.env.DEV && console.log(`[Machine] Learner Profile sync:`, data);
      setLearnerProfile(data);
    }));
    
    // Level Up Event
    cleanups.push(on('teaching:level-up', (data) => {
      import.meta.env.DEV && console.log(`[Machine] 🏆 LEVEL UP: ${data.newLevel}`);
      setLevelUpEvent({ message: data.message, newLevel: data.newLevel, ts: Date.now() });
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [
    on, isConnected,
    setMachineState, setSessionId, setChatSessionId, setTimeline, setCurrentStep,
    setDoubtProcessing, addDoubt, mutateCanvasObjects, addCanvasObjects, setDeltaState,
    setError, setGreeting, notifyUser, setLevelUpEvent

  ]);

  // ─── Auto-play logic (completion-gated, not timer-based) ──────────────────
  // A step advances only when BOTH signals arrive: the animation timeline
  // finished (animDone, set by the canvas renderer) AND the narration finished
  // (voiceDone, set by the voice narrator or its reading-time fallback).
  // A safety deadline scaled to the narration length guarantees playback can
  // never stall on a lost signal — but it no longer cuts speech mid-sentence.
  useEffect(() => {
    if (playIntervalRef.current) {
      clearTimeout(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    if (!(isPlaying && !isPaused && !isDeltaRunning && machineState === STATES.TEACHING && timeline)) {
      return undefined;
    }

    const currentStep = canvasSteps[currentStepIndex];
    const speed = Math.max(0.25, playbackSpeed);

    const advance = () => {
      if (currentStepIndex < totalSteps - 1) {
        const nextIndex = currentStepIndex + 1;
        emit('session:step', { stepIndex: nextIndex });
        setCurrentStep(nextIndex);
      } else {
        emit('session:finish');
        storePause();
      }
    };

    const ready = stepPlayback?.index === currentStepIndex && stepPlayback.animDone && stepPlayback.voiceDone;

    if (ready) {
      // Both animation and narration are done — smart pause, then advance.
      playIntervalRef.current = setTimeout(advance, smartPauseMs(currentStep, speed));
    } else {
      // Safety deadline so a lost signal can never freeze the lesson.
      playIntervalRef.current = setTimeout(advance, stepDeadlineMs(currentStep, speed));
    }

    return () => {
      if (playIntervalRef.current) {
        clearTimeout(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, isPaused, isDeltaRunning, currentStepIndex, machineState, timeline, canvasSteps, totalSteps, playbackSpeed, stepPlayback, emit, setCurrentStep, storePause]);

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

  // ─── Safety Timeout (no server response in 30s) ───────────────────────────
  useEffect(() => {
    if (machineState === STATES.GENERATING) {
      // 1. Initial warning at 20s
      const warningTimer = setTimeout(() => {
        if (machineState === STATES.GENERATING) {
          showToast({ 
            message: 'Generation is taking a bit longer than usual. You can cancel if you wish.', 
            type: 'info', 
            duration: 5000 
          });
        }
      }, 20000);

      // 2. Fatal timeout at 180s (autonomous agents can be slow)
      safetyTimeoutRef.current = setTimeout(() => {
        if (machineState === STATES.GENERATING) {
          console.warn('[Machine] ⚠️ 180s timeout — no server response. Resetting.');
          setError('The AI is taking too long to respond. Please try again or check your connection.');
          forceReset();
        }
      }, 180000);

      return () => {
        clearTimeout(warningTimer);
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      };
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
      if (playIntervalRef.current) clearTimeout(playIntervalRef.current);
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
      import.meta.env.DEV && console.log('[Machine] 🔄 Syncing board state to server...');
      emit('canvas:sync', { objects: canvasObjects });
    }, autoSaveMs);

    lastSyncRef.current = currentSig;


    return () => clearTimeout(timer);
  }, [canvasObjects, isConnected, sessionId, emit]);


  // ─── Actions ──────────────────────────────────────────────────────────────
  const startSession = useCallback((topicStr, initialQuestion, activeMode, file = null) => {
    if (machineState === STATES.GENERATING || isStartingRef.current) return;
    isStartingRef.current = true;
    
    // Guest limits disabled per user request

    // ── Bug C Fix: Always reset ID before starting a new session to prevent overwrites ──
    setChatSessionId(null);

    storeStartSession(topicStr, initialQuestion);
    // After setChatSessionId(null), existingChatId will effectively be null for new sessions
    const existingChatId = null;

    identifyUser(topicStr, { last_topic: topicStr });
    trackEvent('session_started', { topic: topicStr, mode: activeMode, agent: selectedAgent });

    emit('session:start', {
      topic: topicStr,
      initialQuestion,
      selectedAgent,
      activeMode,
      chatId: undefined, // Force a new ID on server
      file // Multimodal support
    });
    
    // Reset guard after short window
    setTimeout(() => { isStartingRef.current = false; }, 2000);
  }, [emit, storeStartSession, selectedAgent, setChatSessionId, incrementGuestSession, incrementGuestUsage, machineState]);


  const askDoubt = useCallback(async (question, activeMode, file = null) => {
    // Guest limits disabled per user request

    storePause();
    setDoubtProcessing(true);
    trackEvent('doubt_asked', { question, agent: selectedAgent });

    // --- Phase 3: Surgical Snapshot ---
    // Pass current state values from the hook directly
    const snapshot = CanvasStateSnapshot.capture({
      canvasObjects,
      canvasConnections,
      currentStepIndex,
      timeline,
      topic
    });

    emit('session:doubt', {
      question,
      selectedAgent,
      activeMode,
      file,
      snapshot // CRITICAL: Send context-rich state to DeltaAgent
    });
  }, [emit, storePause, setDoubtProcessing, selectedAgent, incrementGuestUsage, canvasObjects, canvasConnections, currentStepIndex, timeline, topic]);




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
    canvasConnections,
    canvasSteps,
    doubtResponse,
    isDoubtProcessing,
    doubtHistory,
    generationProgress,
    error,
    greetingMessage,
    topic,
    activeDoubtId,

    // Playback
    isPlaying,
    isPaused,
    playbackSpeed,

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
    cancelSession: useCallback(() => {
      emit('session:cancel');
      forceReset();
    }, [emit, forceReset]),
    pinDoubtToCanvas,
    jumpToDoubt,
  };
}

export default useTeachingMachine;
