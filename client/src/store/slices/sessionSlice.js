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

const capManifest = (manifest, limit = 20) => {
  const keys = Object.keys(manifest);
  if (keys.length <= limit) return manifest;
  
  const sorted = keys.sort((a, b) => (manifest[a]?.lastActive || 0) - (manifest[b]?.lastActive || 0));
  const evictedKey = sorted[0];
  const { [evictedKey]: _, ...rest } = manifest;
  return rest;
};

export const createSessionSlice = (set, get) => ({
  machineState:       STATES.IDLE,
  sessionId:          null,
  topic:              '',
  isConnected:        false,
  connectionError:    null,
  error:              null,
  greetingMessage:    null,
  generationProgress: null,
  isTimelineReady:    false,
  sessionManifest:    {},

  setMachineState:  (state) => set({ machineState: state, error: null }),
  setTopic:         (topic) => set({ topic }),
  setConnected:     (connected) => set({ isConnected: connected, connectionError: null }),
  setConnectionError: (err)     => set({ connectionError: err, isConnected: false }),
  setError:         (err)       => set({ error: err }),
  setGreeting:      (msg)       => set({ greetingMessage: msg, machineState: STATES.IDLE }),
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
      updatedManifest[oldId] = {
        canvasObjects: [...(state.canvasObjects || [])],
        pinnedNotes:   [...(state.pinnedNotes || [])],
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
        }
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
      tools: {}
    };

    if (updatedManifest[newId]) {
      updatedManifest[newId].lastActive = Date.now();
    }

    const cappedManifest = capManifest(updatedManifest, 20);

    set({ 
      sessionId: newId, 
      sessionManifest: cappedManifest,
      canvasObjects:   loadedState.canvasObjects,
      pinnedNotes:     loadedState.pinnedNotes,
      canvasTransform: loadedState.canvasTransform,
      ...(loadedState.tools || {})
    });
  },

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
  }),

  endSession: () => set({
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
    topic:              '',
    activeDoubtId:      null,
    showDoubtThread:    false,
    isTimelineReady:    false,
  }),

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
});

