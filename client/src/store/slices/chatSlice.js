export const createChatSlice = (set, get) => ({
  doubtHistory:      [],
  activeDoubtId:     null,
  isDoubtProcessing: false,
  doubtResponse:     null,
  showDoubtThread:   false,

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
    }

    set(state => ({
      doubtHistory:      [...state.doubtHistory, doubtNode],
      doubtResponse:     { answer, followUp, hasVisuals, visualUpdate, _question: question },
      isDoubtProcessing: false,
      activeDoubtId:     doubtNode.id,
    }));

    return doubtNode;
  },

  pinDoubtToCanvas: (doubtId) => {
    const { doubtHistory, canvasTransform, addCanvasObjects } = get();
    const doubt = doubtHistory.find(d => d.id === doubtId);
    if (!doubt || !doubt.answer) return;

    const note = {
      id:           `pinned-${doubt.id}`,
      shape:        'doubt_note',
      type:         'doubt_note',
      x:            -canvasTransform.x / canvasTransform.scale + (400 / canvasTransform.scale),
      y:            -canvasTransform.y / canvasTransform.scale + (300 / canvasTransform.scale),
      text:         doubt.answer,
      question:     doubt.question,
      color:        '#fbbf24',
      appearsAtStep: 0,
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
