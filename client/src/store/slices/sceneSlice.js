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
  }),

  setSceneReady: (ready) => set({ sceneReady: ready }),

  setTimeline: (data) => {
    const serverObjects     = data.elements     || data.objects      || [];
    const canvasConnections = data.connections  || [];
    const canvasSteps       = data.timeline     || data.steps        || [];
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
      state.canvasObjects = canvasObjects;
      state.canvasConnections = canvasConnections;
      state.canvasSteps = canvasSteps;
      state.totalSteps = totalSteps;
      state.currentStepIndex = typeof data.currentStepIndex === 'number' 
        ? data.currentStepIndex 
        : (isNewTopic ? 0 : get().currentStepIndex);
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
    sceneReady: false,
    sceneDomain: 'general',
    canvasMode: CANVAS_MODE.CLOSED,
    canvasObjects: [],
    canvasSteps: [],
    currentStepIndex: 0,
    totalSteps: 0,
    isPlaying: false,
    isPaused: false,
    history: { past: [], future: [] },
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Navigation & Playback
  // ═══════════════════════════════════════════════════════════════════════════

  play:  () => set({ isPlaying: true,  isPaused: false }),
  pause: () => set({ isPlaying: false, isPaused: true }),
  
  nextStep: () => {
    const { currentStepIndex, totalSteps } = get();
    if (currentStepIndex < totalSteps - 1) set({ currentStepIndex: currentStepIndex + 1 });
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 });
  },

  goToStep: (index) => set({ currentStepIndex: index, isPlaying: false, isPaused: true }),

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
      state.canvasObjects = canvasObjects;
      state.canvasSteps = canvasSteps;
      state.canvasConnections = canvasConnections;
      state.totalSteps = totalSteps;
      state.currentStepIndex = currentStepIndex;
      state.sceneReady = true;
      state.isPlaying = false;
      state.isPaused = false;

      // Build an activeScene from the snapshot so renderers can access it
      if (!state.activeScene || snapshot.title) {
        state.activeScene = {
          title: snapshot.title || state.activeScene?.title || 'Visual Lesson',
          domain: snapshot.domain || state.activeScene?.domain || 'general',
          renderer: snapshot.renderer || state.activeScene?.renderer || 'cinematic',
          timeline: canvasSteps,
          objects: canvasObjects,
          steps: canvasSteps,
        };
      }
    });
  },

  
  setCurrentStep: (index) => set({ currentStepIndex: index }),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Canvas Manipulation
  // ═══════════════════════════════════════════════════════════════════════════

  setCanvasMode: (mode) => set({ canvasMode: mode }),
  
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
