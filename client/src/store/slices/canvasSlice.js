import { capManifest } from './sessionSlice.js';

export const CANVAS_MODE = {
  CLOSED:     'CLOSED',
  FULLSCREEN: 'FULLSCREEN',
  MINIMIZED:  'MINIMIZED',
};

const MAX_HISTORY = 50;

export const createCanvasSlice = (set, get) => ({
  timeline:       null,
  learningNodes:  [],
  currentStepIndex: 0,
  totalSteps:     0,
  mode:           'explain',
  difficulty:     'beginner',
  professorNote:  '',
  memoryAnchor:   '',
  keyFormula:     '',
  renderer:       'cinematic',

  canvasMode:        CANVAS_MODE.CLOSED,
  canvasObjects:     [],
  pinnedNotes:       [],
  canvasConnections: [],
  canvasSteps:       [],
  canvasTransform:   { x: 0, y: 0, scale: 1 },
  deltaState:        null, // Stores temporary doubt-driven visual interventions
  canvasVersion:     0,
  isCanvasLocked:    false,
  isInteracting:     false,
  
  selectedElementIds: [],
  history: { past: [], future: [] },

  setCanvasMode: (mode) => set({ canvasMode: mode }),
  openCanvas:    ()     => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),
  minimizeCanvas:()     => set({ canvasMode: CANVAS_MODE.MINIMIZED }),
  closeCanvas:   ()     => set({ canvasMode: CANVAS_MODE.CLOSED, activeTool: 'select' }),
  expandCanvas:  ()     => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),
  setCanvasTransform: (transform) => set({ canvasTransform: transform }),
  setCanvasLocked:    (locked) => set({ isCanvasLocked: locked }),
  setInteracting:     (active) => set({ isInteracting: active }),
  setCurrentStep: (index)      => set({ currentStepIndex: index, deltaState: null }),
  setDeltaState:  (delta)      => set({ deltaState: delta }),

  _syncManifest: (canvasObjects) => {
    const { sessionId, sessionManifest, pinnedNotes, canvasTransform } = get();
    if (!sessionId) return;
    
    const existing = sessionManifest[sessionId] || {};
    
    const updatedManifest = {
      ...sessionManifest,
      [sessionId]: {
        ...existing,
        canvasObjects: [...(canvasObjects || [])],
        canvasTransform: canvasTransform || { x: 0, y: 0, scale: 1 },
        pinnedNotes: existing.pinnedNotes || pinnedNotes || [],
        lastActive: Date.now()
      }
    };

    set({ sessionManifest: capManifest(updatedManifest, 20) });
  },

  setTimeline: (data) => {
    const serverObjects     = data.elements     || data.objects      || [];
    const canvasConnections = data.connections  || [];
    const canvasSteps       = data.timeline     || data.steps        || [];
    const totalSteps        = canvasSteps.length;
    
    const currentObjects = get().canvasObjects || [];
    const manualObjects = currentObjects.filter(obj => obj.id?.startsWith('manual-'));
    const canvasObjects = [...manualObjects, ...serverObjects];

    const { sessionId, sessionManifest, pinnedNotes, timeline: oldTimeline, canvasTransform: currentTransform } = get();
    
    // BUG FIX: Only reset transform if it's a DIFFERENT lesson title.
    // This preserves zoom/pan during doubt-triggered regens of the same lesson.
    const isNewTopic = !oldTimeline || oldTimeline.title !== data.title;
    const finalTransform = isNewTopic ? { x: 0, y: 0, scale: 1 } : currentTransform;

    set({
      timeline: {
        ...data,
        elements:    canvasObjects,
        objects:     canvasObjects,
        connections: canvasConnections,
        timeline:    canvasSteps,
        steps:       canvasSteps,
        renderer:    data.renderer || 'cinematic',
        totalSteps,
      },
      renderer:          data.renderer || 'cinematic',
      learningNodes:     data.learningNodes || [],
      mode:              data.mode       || 'explain',
      difficulty:        data.difficulty || 'beginner',
      professorNote:     data.professorNote  || '',
      memoryAnchor:      data.memoryAnchor   || '',
      keyFormula:        data.keyFormula     || '',

      canvasObjects,
      canvasConnections,
      canvasSteps,
      totalSteps,

      currentStepIndex:  typeof data.currentStepIndex === 'number' 
        ? data.currentStepIndex 
        : (isNewTopic ? 0 : get().currentStepIndex),
      doubtResponse:     null,
      greetingMessage:   null,
      generationProgress: null,
      isTimelineReady:    true,
      canvasTransform:   finalTransform,
    });

    if (sessionId) {
      const existing = sessionManifest[sessionId] || {};
      
      const updatedManifest = {
        ...sessionManifest,
        [sessionId]: {
          ...existing,
          canvasObjects: [...(canvasObjects || [])],
          // Exclude connections and steps from local manifest; 
          // these are large and should be fetched from cloud on switch.
          canvasConnections: [], 
          canvasSteps: [],
          canvasTransform: finalTransform,
          pinnedNotes: existing.pinnedNotes || pinnedNotes || [],
          lastActive: Date.now()
        }
      };

      set({
        sessionManifest: capManifest(updatedManifest, 20),
        pinnedNotes: existing.pinnedNotes || pinnedNotes || [],
      });
    }
  },

  setCanvasSnapshot: ({ canvasObjects, canvasSteps, totalSteps, currentStepIndex }) => {
    const steps = canvasSteps || [];
    const count = totalSteps  || steps.length;

    set({
      canvasObjects: canvasObjects || [],
      canvasSteps:   steps,
      totalSteps:    count,
      currentStepIndex: typeof currentStepIndex === 'number'
        ? Math.min(currentStepIndex, steps.length - 1)
        : 0,
      canvasMode: get().canvasMode === CANVAS_MODE.CLOSED ? CANVAS_MODE.FULLSCREEN : get().canvasMode,
      timeline: {
        title:       'Lesson Snapshot',
        domain:      'general',
        objects:     canvasObjects || [],
        elements:    canvasObjects || [],
        steps,
        timeline:    steps,
        totalSteps:  count,
        render_mode: 'svg_canvas',
      },
    });
  },

  getCurrentStep: () => {
    const { canvasSteps, currentStepIndex } = get();
    return canvasSteps[currentStepIndex] || null;
  },

  setCanvasObjectsWithHistory: (newObjects) => {
    const { canvasObjects, history, canvasSteps, currentStepIndex } = get();
    let newSteps = [...canvasSteps];
    if (currentStepIndex >= 0 && newSteps[currentStepIndex]) {
      const existingIds = new Set(canvasObjects.map(o => o.id));
      const addedIds = newObjects.filter(o => !existingIds.has(o.id)).map(o => o.id);
      
      if (addedIds.length > 0) {
        const step = { ...newSteps[currentStepIndex] };
        step.objectIds = [...(step.objectIds || []), ...addedIds];
        newSteps[currentStepIndex] = step;
      }
    }

    set({
      canvasObjects: newObjects,
      canvasSteps: newSteps,
      history: {
        past: [...history.past, canvasObjects].slice(-MAX_HISTORY),
        future: [],
      },
      canvasVersion: get().canvasVersion + 1,
    });
  },

  undo: () => {
    const { history, canvasObjects } = get();
    if (history.past.length === 0) return;
    const previousState = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    set({
      canvasObjects: previousState,
      selectedElementIds: [],
      history: {
        past: newPast,
        future: [canvasObjects, ...history.future]
      }
    });
  },

  redo: () => {
    const { history, canvasObjects } = get();
    if (history.future.length === 0) return;
    const nextState = history.future[0];
    const newFuture = history.future.slice(1);
    set({
      canvasObjects: nextState,
      selectedElementIds: [],
      history: {
        past: [...history.past, canvasObjects],
        future: newFuture
      }
    });
  },

  addCanvasObjects: (objects) => {
    const { canvasObjects, history, canvasSteps, currentStepIndex } = get();
    const existingIds = new Set(canvasObjects.map(o => o.id));
    const newOnes = objects.filter(o => o && o.id && !existingIds.has(o.id));
    if (newOnes.length === 0) return;

    const addedIds = newOnes.map(o => o.id);
    let newSteps = [...canvasSteps];
    if (currentStepIndex >= 0 && newSteps[currentStepIndex] && addedIds.length > 0) {
      const step = { ...newSteps[currentStepIndex] };
      step.objectIds = Array.from(new Set([...(step.objectIds || []), ...addedIds]));
      newSteps[currentStepIndex] = step;
    }

    set({
      canvasObjects: [...canvasObjects, ...newOnes],
      canvasSteps: newSteps,
      history: {
        past: [...history.past, canvasObjects].slice(-MAX_HISTORY),
        future: []
      },
      canvasVersion: get().canvasVersion + 1,
    });
    get()._syncManifest([...canvasObjects, ...newOnes]);
  },

  addCanvasConnections: (connections) => {
    const { canvasConnections } = get();
    set({
      canvasConnections: [...canvasConnections, ...connections]
    });
  },

  mutateCanvasObjects: (mutationsOrPatches) => {
    const { canvasObjects, canvasSteps } = get();
    let newObjects = [...canvasObjects];
    let newSteps   = [...canvasSteps];
    let lastAddedIndex = -1;

    const items = Array.isArray(mutationsOrPatches) ? mutationsOrPatches : [];

    for (const item of items) {
      if (item.op === 'add' && item.frame) {
        const newStepIndex = item.afterStepIndex !== undefined ? item.afterStepIndex + 1 : newSteps.length;
        const newStep = {
          index:        newStepIndex,
          id:           item.frame.id || `doubt-step-${Date.now()}`,
          title:        item.frame.label || 'Explanation',
          narration:    item.frame.label || item.frame.explanation || '',
          explanation:  item.frame.explanation || '',
          highlightIds: item.frame.shapes?.map(s => s.id) || [],
          objectIds:    item.frame.shapes?.map(s => s.id) || [],
          cameraFocus:  item.frame.cameraFocus || { x: 0.5, y: 0.5, zoom: 0.8 },
          animation:    item.frame.animation   || { type: 'draw', duration: 0.8 },
        };

        newSteps.splice(newStepIndex, 0, newStep);
        for (let i = newStepIndex + 1; i < newSteps.length; i++) newSteps[i].index = i;
        lastAddedIndex = newStepIndex;

        if (item.frame.shapes) {
          item.frame.shapes.forEach(shape => {
            if (!newObjects.find(o => o.id === shape.id)) {
              newObjects.push({ ...shape, doubtDriven: true });
            }
          });
        }
      } else if (item.op === 'modify' && item.shapeId) {
        newObjects = newObjects.map(obj =>
          obj.id === item.shapeId ? { ...obj, ...item.props } : obj
        );
      }
    }

    set({
      canvasObjects: newObjects,
      canvasSteps:   newSteps,
      totalSteps:    newSteps.length,
      ...(lastAddedIndex !== -1 ? { 
        currentStepIndex: lastAddedIndex, 
        canvasMode: get().canvasMode === CANVAS_MODE.CLOSED ? CANVAS_MODE.FULLSCREEN : get().canvasMode 
      } : {}),
      canvasVersion: get().canvasVersion + 1,
    });

    return lastAddedIndex;
  },

  updateCanvasObjectSilently: (id, updates) => set(state => ({
    canvasObjects: state.canvasObjects.map(o =>
      o.id === id ? { ...o, ...updates, styles: { ...(o.styles || {}), ...(updates?.styles || {}) } } : o
    )
  })),

  updateCanvasObject: (id, updates) => {
    const { canvasObjects } = get();
    const newObjects = canvasObjects.map(o =>
      o.id === id ? { ...o, ...updates, styles: { ...(o.styles || {}), ...(updates?.styles || {}) } } : o
    );
    get().setCanvasObjectsWithHistory(newObjects);
    get()._syncManifest(newObjects);
  },

  deleteCanvasObject: (id) => set(state => ({
    canvasObjects: state.canvasObjects.filter(o => o.id !== id)
  })),

  toggleNotePin: (id) => set(state => ({
    canvasObjects: state.canvasObjects.map(o =>
      o.id === id ? { ...o, isPinned: !o.isPinned } : o
    )
  })),

  commitHistory: () => {
    const { canvasObjects, history } = get();
    // Prevent duplicate history entries
    const lastState = history.past[history.past.length - 1];
    if (lastState && JSON.stringify(lastState) === JSON.stringify(canvasObjects)) return;

    set({
      history: {
        past: [...history.past, canvasObjects].slice(-MAX_HISTORY),
        future: []
      },
      canvasVersion: get().canvasVersion + 1,
    });
  },
});
