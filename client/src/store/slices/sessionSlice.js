import { TRIAL_LIMITS } from '../../constants/trialConfig';

export const STATES = {
  IDLE:            'IDLE',
  GENERATING:      'GENERATING',
  TEACHING:        'TEACHING',
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING:      'RESPONDING',
  RESUMING:        'RESUMING',
  COMPLETED:       'COMPLETED',
  ERROR:           'ERROR',
};

export const capManifest = (manifest, limit = 20, getStore) => {
  const keys = Object.keys(manifest);
  if (keys.length <= limit) return manifest;
  
  const sorted = keys.sort((a, b) => (manifest[a]?.lastActive || 0) - (manifest[b]?.lastActive || 0));
  const evictedKey = sorted[0];
  const { [evictedKey]: _, ...rest } = manifest;
  if (getStore && getStore().showToast) {
    getStore().showToast({ message: 'Oldest canvas session archived to save space', type: 'info' });
  }
  return rest;
};

export const createSessionSlice = (set, get) => ({
  machineState:       STATES.IDLE,
  sessionId:          null,
  chatSessionId:      null,  // MongoDB ObjectId for REST sync
  narrationTokens:    '',    // Real-time streaming tokens for the generation phase
  syncTrigger:        0,     // Timestamp to force immediate cloud sync
  topic:              '',
  isConnected:        false,
  connectionError:    null,
  syncError:          null,
  error:              null,
  greetingMessage:    null,
  generationProgress: null,
  isTimelineReady:    false,
  sessionManifest:    {},
  learnerProfile:     { level: 'beginner', pace: 'normal', confusionIndex: 0, topicsMastery: {} },
  guestTrialStatus:   { 
    messageCount: 0, 
    sessionCount: 0, 
    lastMessageAt: 0, 
    isLimitReached: false, 
    warning: false,
    // Server-reported values (kept for backward compat)
    count: 0, 
    limit: 10 
  },
  resumeContext:      null, // { topic, stepIndex }
  activeSnapshotId:   null, // ID of message whose snapshot we are currently viewing/editing
  levelUpEvent:       null, // { message, newLevel, ts }
  takeaways:          [],   // AI-extracted or user-pinned key insights

  addTakeaway: (text) => set(state => {
    if (!text || state.takeaways.some(t => t.text === text)) return;
    state.takeaways.push({ id: Date.now(), text, timestamp: Date.now() });
  }),
  removeTakeaway: (id) => set(state => {
    state.takeaways = state.takeaways.filter(t => t.id !== id);
  }),
  clearTakeaways: () => set({ takeaways: [] }),

  setLearnerProfile: (profile) => set({ learnerProfile: { ...get().learnerProfile, ...profile } }),
  setResumeContext: (ctx) => set({ resumeContext: ctx }),
  setActiveSnapshotId: (id) => set({ activeSnapshotId: id }),
  setLevelUpEvent: (evt) => set({ levelUpEvent: evt }),


  setMachineState:  (state) => set({ machineState: state, error: null }),
  setTopic:         (topic) => set({ topic }),
  setConnected:     (connected) => set({ isConnected: connected }),
  setConnectionError: (err)     => set({ connectionError: err }),
  setSyncError:      (err)     => set({ syncError: err }),
  syncConnection:   (connected, error) => set({ isConnected: connected, connectionError: error }),
  setError:         (err)       => set({ error: err, machineState: STATES.IDLE }),
  setGreeting:      (msg)       => set({ greetingMessage: msg, machineState: STATES.IDLE }),
  setChatSessionId: (id)        => set({ chatSessionId: id }),
  setNarrationTokens: (tokens)  => set({ narrationTokens: tokens }),
  triggerSync:      ()          => set({ syncTrigger: Date.now() }),
  setGuestTrialStatus: (status) => set({ guestTrialStatus: { ...get().guestTrialStatus, ...status } }),

  /** Increment guest message usage and check limits. Returns true if allowed. */
  incrementGuestUsage: () => {
    const { guestTrialStatus } = get();
    const now = Date.now();
    const newCount = guestTrialStatus.messageCount + 1;
    const isLimitReached = newCount >= TRIAL_LIMITS.MAX_MESSAGES;
    const warning = newCount >= TRIAL_LIMITS.WARNING_THRESHOLD;
    
    set({ 
      guestTrialStatus: { 
        ...guestTrialStatus, 
        messageCount: newCount, 
        lastMessageAt: now,
        isLimitReached,
        warning,
        count: newCount,
        limit: TRIAL_LIMITS.MAX_MESSAGES 
      } 
    });
    return !isLimitReached;
  },

  /** Increment guest session count. Returns true if allowed. */
  incrementGuestSession: () => {
    const { guestTrialStatus } = get();
    const newCount = guestTrialStatus.sessionCount + 1;
    set({ 
      guestTrialStatus: { 
        ...guestTrialStatus, 
        sessionCount: newCount 
      } 
    });
    return newCount <= TRIAL_LIMITS.MAX_SESSIONS;
  },

  /** Reset guest trial state (used on logout/fresh guest) */
  resetGuestTrial: () => set({ 
    guestTrialStatus: { 
      messageCount: 0, sessionCount: 0, lastMessageAt: 0, 
      isLimitReached: false, warning: false, count: 0, limit: 10 
    } 
  }),



  setGenerationProgress: (progress)  => set({ 

    generationProgress: typeof progress === 'string' 
      ? { label: progress, stage: 0, totalStages: 6 } 
      : progress 
  }),

  setSessionId: (newId) => {
    const { sessionId: oldId, canvasObjects, pinnedNotes, canvasTransform, sessionManifest } = get();
    if (newId === oldId) return;

    const updatedManifest = { ...sessionManifest };
    if (oldId) {
      const state = get();
      
      // PERSISTENCE HARDENING (SEC-21): Capture the MongoDB ID in the manifest
      const currentChatSessionId = state.chatSessionId;
      
      updatedManifest[oldId] = {
        canvasObjects: [...(state.canvasObjects || [])],
        pinnedNotes:   [...(state.pinnedNotes || [])].slice(0, 20),
        canvasTransform: { ...(state.canvasTransform || { x: 0, y: 0, scale: 1 }) },
        lastActive: Date.now(),
        tools: {
          drawColor: state.drawColor,
          drawWidth: state.drawWidth,
          textToolSize: state.textToolSize,
          noteToolSize: state.noteToolSize,
          noteColor: state.noteColor,
          noteSize: state.noteSize,
          notePinned: state.notePinned
        },
        chatSessionId: currentChatSessionId // NEW: Persist cloud mapping
      };
    }

    const isTempId = (id) => id?.startsWith('msg-') || id?.startsWith('api-');
    if (isTempId(oldId) && !isTempId(newId)) {
      const oldData = updatedManifest[oldId];
      if (oldData) {
        updatedManifest[newId] = {
          ...(updatedManifest[newId] || {}),
          ...oldData,
          lastActive: Date.now()
        };
        delete updatedManifest[oldId];
      }
    }

    const loadedState = updatedManifest[newId] || {
      canvasObjects:   [],
      pinnedNotes:     [],
      canvasTransform: { x: 0, y: 0, scale: 1 },
      tools: {},
      chatSessionId: null
    };

    if (updatedManifest[newId]) {
      updatedManifest[newId].lastActive = Date.now();
    }

    const cappedManifest = capManifest(updatedManifest, 20, get);

    set({ 
      sessionId: newId, 
      chatSessionId: loadedState.chatSessionId || null, // Restore cloud link
      sessionManifest: cappedManifest,
      canvasObjects:   loadedState.canvasObjects,
      pinnedNotes:     loadedState.pinnedNotes,
      canvasTransform: loadedState.canvasTransform,
      ...(loadedState.tools || {})
    });
  },

  startSession: (topic) => set({
    topic,
    machineState:       STATES.GENERATING,
    timeline:           null,
    canvasObjects:      [],
    canvasConnections:  [],
    canvasSteps:        [],
    currentStepIndex:   0,
    totalSteps:         0,
    isPlaying:          false,
    isPaused:           false,
    doubtResponse:      null,
    doubtHistory:       [],
    snapshots:          {},
    error:              null,
    greetingMessage:    null,
    generationProgress: null,
    isTimelineReady:    false,
    d3Narration:        '',
  }),

  resetTeaching: () => set({
    machineState:       STATES.IDLE,
    timeline:           null,
    canvasObjects:      [],
    canvasConnections:  [],
    canvasSteps:        [],
    currentStepIndex:   0,
    totalSteps:         0,
    isPlaying:          false,
    isPaused:           false,
    doubtResponse:      null,
    doubtHistory:       [],
    snapshots:          {},
    error:              null,
    generationProgress: null,
    d3Narration:        '',
  }),

  endSession: () => {
    // MED-11: Save current canvas to manifest before clearing to prevent data loss
    const { sessionId, canvasObjects, pinnedNotes, canvasTransform, sessionManifest, chatSessionId } = get();
    const updatedManifest = { ...sessionManifest };
    if (sessionId && (canvasObjects?.length > 0 || pinnedNotes?.length > 0)) {
      updatedManifest[sessionId] = {
        canvasObjects: [...(canvasObjects || [])],
        pinnedNotes: [...(pinnedNotes || [])].slice(0, 20),
        canvasTransform: { ...(canvasTransform || { x: 0, y: 0, scale: 1 }) },
        chatSessionId,
        lastActive: Date.now()
      };
    }

    set({
      sessionManifest:    capManifest(updatedManifest, 20, get),
      isPlaying:          false,
      isPaused:           false,
      canvasMode:         'CLOSED',
      timeline:           null,
      canvasObjects:      [],
      canvasConnections:  [],
      canvasSteps:        [],
      currentStepIndex:   0,
      totalSteps:         0,
      doubtResponse:      null,
      doubtHistory:       [],
      snapshots:          {},
      error:              null,
      greetingMessage:    null,
      generationProgress: null,
      machineState:       STATES.IDLE,
      sessionId:          null,
      chatSessionId:      null,
      topic:              '',
      d3Narration:        '',
      activeDoubtId:      null,
      showDoubtThread:    false,
      isTimelineReady:    false,
    });
  },

  startDoubtTransition: (initialDoubt = []) => {
    set({
      timeline:           null,
      canvasObjects:      [],
      canvasConnections:  [],
      canvasSteps:        [],
      doubtResponse:      null,
      doubtHistory:       initialDoubt,
      snapshots:          {},
      greetingMessage:    null,
      generationProgress: null,
      currentStepIndex:   0,
      totalSteps:         0,
      isPlaying:          false,
      isPaused:           false,
      activeDoubtId:      null,
      showDoubtThread:    false,
      canvasMode:         'FULLSCREEN',
      canvasTransform:    { x: 0, y: 0, scale: 1 },
      machineState:       STATES.GENERATING,
    });
  },

  forceReset: () => set({
    machineState:       STATES.IDLE,
    topic:              '',
    sessionId:          null,
    chatSessionId:      null,
    timeline:           null,
    canvasObjects:      [],
    canvasConnections:  [],
    canvasSteps:        [],
    currentStepIndex:   0,
    totalSteps:         0,
    isPlaying:          false,
    isPaused:           false,
    error:              null,
    generationProgress: null,
    isTimelineReady:    false,
    narrationTokens:    '',
    doubtResponse:      null,
    doubtHistory:       [],
  }),
});

