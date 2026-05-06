import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';

export const createChatSlice = (set, get) => ({
  doubtHistory:      [],
  deltaHistory:      [],
  activeDoubtId:     null,
  isDoubtProcessing: false,
  isDeltaRunning:    false,
  doubtResponse:     null,
  showDoubtThread:   false,

  setDeltaRunning:   (running) => set({ isDeltaRunning: running }),
  addDelta:          (delta) => set(s => ({ deltaHistory: [...s.deltaHistory, delta].slice(-50) })),


  setDoubtProcessing: (processing) => set({ isDoubtProcessing: processing }),
  setDoubtResponse:  (response) => set({ doubtResponse: response }),
  setActiveDoubt:    (id)       => set({ activeDoubtId: id }),
  toggleDoubtThread: () => set(s => ({ showDoubtThread: !s.showDoubtThread })),
  openDoubtThread:   () => set({ showDoubtThread: true }),
  closeDoubtThread:  () => set({ showDoubtThread: false }),

  addDoubt: (question, answer, hasVisuals = false, visualUpdate = null, followUp = null) => {
    const { takeSnapshot, setDeltaState } = get();
    const snapshotId = takeSnapshot();

    const doubtNode = {
      id:          `doubt-${Date.now()}`,
      question,
      answer,
      followUp,
      hasVisuals,
      visualUpdate,
      snapshotId,
      timestamp:   Date.now(),
    };

    // ─── Phase 3 Bridge: Delta Wiring ───
    if (visualUpdate?.isDelta && visualUpdate?.actions) {
      setDeltaState({
        actions:   visualUpdate.actions,
        timestamp: Date.now()
      });
      set({ isDeltaRunning: true });
    }

    set(state => ({
      doubtHistory:      [...state.doubtHistory, doubtNode],
      doubtResponse:     { answer, followUp, hasVisuals, visualUpdate, _question: question },
      isDoubtProcessing: false,
      activeDoubtId:     doubtNode.id,
    }));

    // ─── Phase 4 Integration: Chat Bar Doubt Bridge ───
    const { addAssistantMessage } = get();
    if (addAssistantMessage) {
      addAssistantMessage(answer, null, {
        hasCanvas: hasVisuals,
        canvasSnapshot: hasVisuals ? {
          objects: get().canvasObjects,
          connections: get().canvasConnections,
          stepIndex: get().currentStepIndex
        } : null,
        isDoubtResponse: true
      });
    }

    return doubtNode;
  },

  pinDoubtToCanvas: (doubtId) => {
    const { doubtHistory, canvasTransform, addCanvasObjects, canvasSteps, currentStepIndex } = get();
    const doubt = doubtHistory.find(d => d.id === doubtId);
    if (!doubt || !doubt.answer) return;

    // ─── Smart Positioning ───
    // If we are in the fixed-stage (no pan/zoom), use the current step's camera focus
    // as the "where the user is looking" coordinate.
    const currentStep = canvasSteps[currentStepIndex];
    const focus = currentStep?.cameraFocus || { x: 0.5, y: 0.5 };
    
    // Default pinning logic (fallback to center or current transform)
    const centerX = focus.x * CANVAS_WIDTH;
    const centerY = focus.y * CANVAS_HEIGHT;

    const x = canvasTransform.scale === 1 && canvasTransform.x === 0 
      ? centerX 
      : -canvasTransform.x / canvasTransform.scale + ((CANVAS_WIDTH / 2) / canvasTransform.scale);
      
    const y = canvasTransform.scale === 1 && canvasTransform.y === 0 
      ? centerY 
      : -canvasTransform.y / canvasTransform.scale + ((CANVAS_HEIGHT / 2) / canvasTransform.scale);

    const note = {
      id:           `pinned-${doubt.id}`,
      shape:        'doubt_note',
      type:         'doubt_note',
      x,
      y,
      text:         doubt.answer,
      question:     doubt.question,
      color:        '#fbbf24',
      appearsAtStep: currentStepIndex,
      pinned:       true,
    };

    addCanvasObjects([note]);
  },

  unpinDoubtFromCanvas: (objectId) => {
    set(state => ({ canvasObjects: state.canvasObjects.filter(o => o.id !== objectId) }));
  },

  jumpToDoubt: (doubtId) => {
    const { doubtHistory, restoreSnapshot } = get();
    const doubt = doubtHistory.find(d => d.id === doubtId);
    if (doubt?.snapshotId) {
      restoreSnapshot(doubt.snapshotId);
      set({ activeDoubtId: doubtId });
    }
  },
});
