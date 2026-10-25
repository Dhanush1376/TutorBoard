/**
 * sceneSlice v3.0 — The Mother of All Slices
 *
 * Consolidates:
 * - canvasSlice (Objects, steps, history)
 * - sceneSlice (AI Scenes, snapshots, interaction)
 * - controlSlice (Playback, navigation, board cleanup)
 */

import { capManifest } from './sessionSlice.js';

export const CANVAS_MODE = {
  CLOSED:     'CLOSED',
  FULLSCREEN: 'FULLSCREEN',
  MINIMIZED:  'MINIMIZED',
};

const MAX_HISTORY = 50;

export const createSceneSlice = (set, get) => ({
  // ── Unified State ────────────────────────────────────────────────────────
  activeScene: null,
  sceneReady: false,
  sceneDomain: 'general',
  sceneTransitionType: 'crossfade',
  
  canvasMode:        CANVAS_MODE.CLOSED,
  canvasObjects:     [],
  pinnedNotes:       [],
  canvasConnections: [],
  canvasSteps:       [],
  canvasTransform:   { x: 0, y: 0, scale: 1 },
  
  currentStepIndex:  0,
  totalSteps:        0,
  
  deltaState:        null,
  d3Narration:       '',
  canvasVersion:     0,
  
  // ── Playback State ─────────────────────────────────────────────────────
  isPlaying:    false,
  isPaused:     false,
  playbackSpeed: 1,

  // Narration-gated step completion. A step may only auto-advance when BOTH
  // its animation timeline (animDone) and its narration (voiceDone) finish.
  stepPlayback: { index: -1, animDone: false, voiceDone: false },
  
  // ── History & snapshots ────────────────────────────────────────────────
  history: { past: [], future: [] },
  lastHistoryVersion: 0,
  stepSnapshots: {},

  // ── Interaction State ──────────────────────────────────────────────────
  sceneInteraction: {
    hoveredEntityId: null,
    selectedEntityId: null,
    tooltip: null,
  },

  // ── Chat ↔ Canvas Sync ─────────────────────────────────────────────────
  stepMessageMap: {},
  activeStepHighlight: null,
  canvasAnnotations: [],

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Scene Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  loadScene: (sceneDefinition) => set((state) => {
    const steps = sceneDefinition?.steps || [];
    state.activeScene = sceneDefinition;
    state.sceneReady = false;
    state.sceneDomain = (sceneDefinition?.domain || 'general').toLowerCase();
    state.sceneTransitionType = sceneDefinition?.defaultTransition || 'crossfade';
    state.canvasSteps = steps;
    state.totalSteps = steps.length;
    state.currentStepIndex = 0;
    state.stepSnapshots = {};
    state.isPlaying = false;
    state.isPaused = false;
    state.stepPlayback = { index: 0, animDone: false, voiceDone: false };
  }),

  setSceneReady: (ready) => set({ sceneReady: ready }),

  setTimeline: (data) => {
    if (!data) {
      set((state) => {
        state.activeScene = null;
        state.sceneBranch = null;
        state.canvasObjects = [];
        state.canvasConnections = [];
        state.canvasSteps = [];
        state.totalSteps = 0;
        state.currentStepIndex = 0;
        state.stepPlayback = { index: 0, animDone: false, voiceDone: false };
        state.sceneReady = false;
        state.isPlaying = false;
      });
      return;
    }

    const serverObjects     = data.elements     || data.objects      || [];
    const canvasConnections = data.connections  || [];
    const rawSteps          = data.timeline     || data.steps        || [];
    const canvasSteps       = rawSteps.length > 0 ? rawSteps : [{}];
    const totalSteps        = canvasSteps.length;
    
    const currentObjects = get().canvasObjects || [];
    const manualObjects = currentObjects.filter(obj => obj.id?.startsWith('manual-'));
    const canvasObjects = [...manualObjects, ...serverObjects];

    const { sessionId, sessionManifest, activeScene: oldScene } = get();
    const isNewTopic = !oldScene || oldScene.title !== data.title;
    const finalTransform = isNewTopic ? { x: 0, y: 0, scale: 1 } : get().canvasTransform;

    set((state) => {
      state.activeScene = {
        ...data,
        steps: canvasSteps,
        timeline: canvasSteps
      };
      state.sceneBranch = null;
      state.canvasObjects = canvasObjects;
      state.canvasConnections = canvasConnections;
      state.canvasSteps = canvasSteps;
      state.totalSteps = totalSteps;
      state.currentStepIndex = typeof data.currentStepIndex === 'number'
        ? data.currentStepIndex
        : (isNewTopic ? 0 : get().currentStepIndex);
      state.stepPlayback = { index: state.currentStepIndex, animDone: false, voiceDone: false };
      state.canvasTransform = finalTransform;
      state.sceneDomain = (data.domain || 'general').toLowerCase();
      state.sceneReady = false;
      state.isPlaying = false;
    });

    if (sessionId) {
      const existing = sessionManifest[sessionId] || {};
      const updatedManifest = {
        ...sessionManifest,
        [sessionId]: {
          ...existing,
          canvasObjects: [...(canvasObjects || [])],
          canvasTransform: finalTransform,
          lastActive: Date.now()
        }
      };
      set({ sessionManifest: capManifest(updatedManifest, 20) });
    }
  },

  clearScene: () => set({
    activeScene: null,
    sceneBranch: null,
    sceneReady: false,
    sceneDomain: 'general',
    canvasMode: CANVAS_MODE.CLOSED,
    canvasObjects: [],
    canvasSteps: [],
    currentStepIndex: 0,
    totalSteps: 0,
    isPlaying: false,
    isPaused: false,
    stepPlayback: { index: -1, animDone: false, voiceDone: false },
    history: { past: [], future: [] },
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Navigation & Playback
  // ═══════════════════════════════════════════════════════════════════════════

  play:  () => set({ isPlaying: true,  isPaused: false }),
  pause: () => set({ isPlaying: false, isPaused: true }),

  // ── Step completion signals (narration/animation sync) ─────────────────
  beginStepPlayback: (index) => set({
    stepPlayback: { index, animDone: false, voiceDone: false },
  }),

  markStepAnimDone: (index) => {
    const sp = get().stepPlayback;
    if (sp.index !== index) return;
    set({ stepPlayback: { ...sp, animDone: true } });
  },

  markStepVoiceDone: (index) => {
    const sp = get().stepPlayback;
    if (sp.index !== index) return;
    set({ stepPlayback: { ...sp, voiceDone: true } });
  },

  nextStep: () => {
    const { currentStepIndex, totalSteps } = get();
    if (currentStepIndex < totalSteps - 1) {
      const next = currentStepIndex + 1;
      set({
        currentStepIndex: next,
        stepPlayback: { index: next, animDone: false, voiceDone: false },
      });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      const prev = currentStepIndex - 1;
      set({
        currentStepIndex: prev,
        stepPlayback: { index: prev, animDone: false, voiceDone: false },
      });
    }
  },

  goToStep: (index) => set({
    currentStepIndex: index,
    isPlaying: false,
    isPaused: true,
    stepPlayback: { index, animDone: false, voiceDone: false },
  }),

  /**
   * setCanvasSnapshot — Restore a canvas snapshot from a chat message or session history.
   * This loads objects, steps, and timeline data back into the canvas for viewing.
   * Used by handleOpenCanvas and sidebar snapshot restoration.
   */
  setCanvasSnapshot: (snapshot) => {
    if (!snapshot) return;

    const canvasObjects = snapshot.canvasObjects || snapshot.objects || [];
    const canvasSteps = snapshot.canvasSteps || snapshot.steps || snapshot.timeline || [];
    const canvasConnections = snapshot.canvasConnections || snapshot.connections || [];
    const totalSteps = snapshot.totalSteps || canvasSteps.length;
    const currentStepIndex = snapshot.currentStepIndex || 0;

    set((state) => {
      state.sceneBranch = null;
      state.canvasObjects = canvasObjects;
      state.canvasSteps = canvasSteps;
      state.canvasConnections = canvasConnections;
      state.totalSteps = totalSteps;
      state.currentStepIndex = currentStepIndex;
      state.sceneReady = true;
      state.isPlaying = false;
      state.isPaused = false;

      // Build an activeScene from the snapshot so renderers can access it
      const effectiveRenderer = snapshot.renderer || snapshot.rendererType || (snapshot.sceneV2 ? 'scene-v2' : (state.activeScene?.renderer || 'cinematic'));
      state.activeScene = {
        title: snapshot.title || state.activeScene?.title || 'Visual Lesson',
        domain: snapshot.domain || state.activeScene?.domain || 'general',
        renderer: effectiveRenderer,
        timeline: canvasSteps,
        objects: canvasObjects,
        steps: canvasSteps,
        // an Engine v2 lesson replays from its scene
        ...(snapshot.sceneV2 ? { sceneV2: snapshot.sceneV2 } : {}),
      };
    });
  },

  
  setCurrentStep: (index) => set({
    currentStepIndex: index,
    stepPlayback: { index, animDone: false, voiceDone: false },
  }),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Canvas Manipulation
  // ═══════════════════════════════════════════════════════════════════════════

  setCanvasMode: (mode) => set({ canvasMode: mode }),
  
  setCanvasTransform: (transform) => set({ canvasTransform: transform }),

  // Doubt deltas: AgentCanvasRenderer plays `deltaState.actions` on top of the
  // live lesson, then clears it with setDeltaState(null).
  setDeltaState: (deltaState) => set({ deltaState }),

  // ── Engine v2 doubts ───────────────────────────────────────────────────
  // A question asked during a v2 lesson is answered on its board: a branch of
  // the lesson (its beats up to the current one + the answer's beats). The
  // lesson waits at its step; "back to the lesson" restores it exactly there.
  // sceneBranch: { title, scene, from, beats, answer, steps, at, resumePlaying }
  sceneBranch: null,
  _resumeAfterQuestion: false,

  /** The learner asked about the board: hold the lesson where it is until the answer plays. */
  holdLessonForQuestion: () => set((state) => {
    state._resumeAfterQuestion = state._resumeAfterQuestion || state.isPlaying;
    state.isPlaying = false;
  }),

  enterSceneBranch: (branch) => set((state) => {
    if (!branch?.scene || typeof branch.from !== 'number') return;
    const resumePlaying = state.sceneBranch?.resumePlaying ?? (state._resumeAfterQuestion || state.isPlaying);
    state.sceneBranch = { ...branch, at: branch.from + 1, resumePlaying };
    state._resumeAfterQuestion = false;
    state.isPlaying = false;
    state.isPaused = false;
  }),

  setBranchBeat: (at) => set((state) => {
    if (state.sceneBranch) state.sceneBranch.at = at;
  }),

  /** Back to the lesson at the step it was on (already seen: it carries on from there). */
  exitSceneBranch: () => set((state) => {
    if (!state.sceneBranch) return;
    const resume = state.sceneBranch.resumePlaying;
    state.sceneBranch = null;
    state.isPlaying = !!resume;
    state.isPaused = false;
    state.stepPlayback = { index: state.currentStepIndex, animDone: true, voiceDone: true };
  }),

  // ── Engine v2 checks: "predict the next step" (5.1) ─────────────────────
  // checkAnswers: `${lesson}:${step}` → the choice picked. A miss slows the
  // lesson a little, a right answer brings it back (adaptive pace, 5.2).
  checkAnswers: {},
  checkStats: { right: 0, wrong: 0 },
  answerCheck: (key, choice, correct) => set((state) => {
    state.checkAnswers[key] = choice;
    state.checkStats = { ...state.checkStats, [correct ? 'right' : 'wrong']: (state.checkStats?.[correct ? 'right' : 'wrong'] || 0) + 1 };
    const speed = state.playbackSpeed || 1;
    if (!correct) state.playbackSpeed = Math.max(0.8, Math.round((speed - 0.1) * 100) / 100);
    else if (speed < 1) state.playbackSpeed = Math.min(1, Math.round((speed + 0.1) * 100) / 100);
  }),

  // Replay the current step's animation (the canvas skips a step it has
  // already played, so re-selecting the same index did nothing).
  replayNonce: 0,
  replayStep: () => set((state) => { state.replayNonce = (state.replayNonce || 0) + 1; }),

  // Non-delta doubt responses carry the same command list as `mutations`;
  // route them through the delta player rather than rewriting objects.
  mutateCanvasObjects: (mutations) => {
    if (!Array.isArray(mutations) || mutations.length === 0) return;
    set({ deltaState: { actions: mutations, timestamp: Date.now() } });
  },

  setCanvasObjectsWithHistory: (objects) => set((state) => {
    state.history.past.push([...state.canvasObjects]);
    if (state.history.past.length > MAX_HISTORY) state.history.past.shift();
    state.canvasObjects = objects;
    state.history.future = [];
    state.canvasVersion += 1;
  }),
  
  addCanvasObjects: (objects) => set((state) => {
    const existingIds = new Set(state.canvasObjects.map(o => o.id));
    const newOnes = objects.filter(o => o && o.id && !existingIds.has(o.id));
    if (newOnes.length === 0) return;

    state.history.past.push([...state.canvasObjects]);
    state.canvasObjects.push(...newOnes);
    state.canvasVersion += 1;
  }),

  clearAll: () => set((state) => {
    if (state.canvasObjects.length > 0) {
      state.history.past.push([...state.canvasObjects]);
      state.canvasObjects = [];
      state.canvasVersion += 1;
    }
  }),

  undo: () => {
    const { history, canvasObjects } = get();
    if (history.past.length === 0) return;
    const previousState = history.past[history.past.length - 1];
    set((state) => {
      state.canvasObjects = previousState;
      state.history.past = history.past.slice(0, -1);
      state.history.future = [canvasObjects, ...history.future];
    });
  },

  redo: () => {
    const { history, canvasObjects } = get();
    if (history.future.length === 0) return;
    const nextState = history.future[0];
    set((state) => {
      state.canvasObjects = nextState;
      state.history.past = [...history.past, canvasObjects];
      state.history.future = history.future.slice(1);
    });
  },
});
