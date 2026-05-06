export const createControlSlice = (set, get) => ({
  isPlaying:    false,
  isPaused:     false,
  playbackSpeed: 1,
  voiceEnabled: false,

  setPlaying:     (playing) => set({ isPlaying: playing, ...(playing ? { isPaused: false } : {}) }),
  setPaused:      (paused)  => set({ isPaused: paused,    isPlaying: !paused }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  toggleVoice:    ()        => {
    const newVal = !get().voiceEnabled;
    set({ voiceEnabled: newVal });
    
    // SEC-16: Provide immediate audible feedback and trigger toast
    if (newVal && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Voice narration enabled");
      u.rate = 1.2;
      window.speechSynthesis.speak(u);
    }
    
    // Trigger toast via the other slice (Zustand lets us call methods across slices if they are in the same store)
    if (get().showToast) {
      get().showToast({
        message: newVal ? 'Voice Narration: ON' : 'Voice Narration: OFF',
        type: newVal ? 'success' : 'info',
        duration: 2000
      });
    }
  },
  play:           ()        => set({ isPlaying: true,  isPaused: false }),
  pause:          ()        => set({ isPlaying: false, isPaused: true }),
  stop:           ()        => set({ isPlaying: false, isPaused: false }),

  nextStep: () => {
    const { currentStepIndex, totalSteps } = get();
    if (currentStepIndex < totalSteps - 1) set({ currentStepIndex: currentStepIndex + 1 });
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 });
  },

  goToStep: (index) => set({ currentStepIndex: index, isPlaying: false }),

  clearAll: () => {
    const { canvasObjects, history } = get();
    if (canvasObjects.length > 0) {
      set({
        canvasObjects: [],
        history: {
          past: [...(history.past || []), canvasObjects].slice(-50),
          future: []
        }
      });
    }
  },
  
  clearShapes: () => {
    const { canvasObjects, history } = get();
    const shapeTypes = ['rect', 'ellipse', 'triangle', 'line', 'arrow', 'diamond', 'star', 'hexagon', 'callout', 'cloud'];
    const remaining = canvasObjects.filter(o => !shapeTypes.includes(o.type));
    
    if (remaining.length !== canvasObjects.length) {
      set({
        canvasObjects: remaining,
        history: {
          past: [...(history.past || []), canvasObjects].slice(-50),
          future: []
        }
      });
    }
  },

  clearDrawings: () => {
    const { canvasObjects, history } = get();
    const remaining = canvasObjects.filter(o => o.type !== 'path');
    
    if (remaining.length !== canvasObjects.length) {
      set({
        canvasObjects: remaining,
        history: {
          past: [...(history.past || []), canvasObjects].slice(-50),
          future: []
        }
      });
    }
  },

  clearNotes: () => {
    const { canvasObjects, history } = get();
    const remaining = canvasObjects.filter(o => 
      o.type !== 'note' && o.type !== 'sticky' && o.type !== 'step_box' && o.type !== 'doubt_note'
    );
    
    if (remaining.length !== canvasObjects.length) {
      set({
        canvasObjects: remaining,
        history: {
          past: [...(history.past || []), canvasObjects].slice(-50),
          future: []
        }
      });
    }
  },
  
  clearVisualizations: () => {
    const { canvasObjects, history } = get();
    const remaining = canvasObjects.filter(o => 
      o.type !== 'flow_step' && o.type !== 'flow_connection' && !o.id?.startsWith('manual-flow-')
    );
    
    if (remaining.length !== canvasObjects.length) {
      set({
        canvasObjects: remaining,
        history: {
          past: [...(history.past || []), canvasObjects].slice(-50),
          future: []
        }
      });
    }
  },

  // --- INTERACTIVE SIMULATOR STATE (KaTeX/Physics) ---
  interactiveValues: {},
  setInteractiveValue: (id, val) => set((state) => {
    state.interactiveValues[id] = val;
  }),
  resetInteractiveValues: () => set({ interactiveValues: {} }),
});