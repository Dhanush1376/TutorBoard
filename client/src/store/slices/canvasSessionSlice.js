/**
 * canvasSessionSlice v1.0 — Canvas Session Orchestration
 *
 * Session-level orchestration for the canvas system.
 * Manages multi-artifact tabs, viewport state, renderer stacks,
 * and teaching mode lifecycle.
 *
 * NOT a replacement for canvasSlice (which handles timeline/steps/objects).
 * This is a HIGHER-LEVEL coordinator that manages the session context
 * around multiple canvas interactions.
 */

export const CANVAS_LAYOUT = {
  INLINE:     'inline',     // Chat only, artifact cards inline
  SPLIT:      'split',      // Chat left, canvas right
  FULLSCREEN: 'fullscreen', // Full immersive teaching session
};

export const createCanvasSessionSlice = (set, get) => ({
  // ── Canvas Session State ───────────────────────────────────────────────
  canvasSessionId: null,
  canvasLayout: CANVAS_LAYOUT.INLINE,
  activeArtifactId: null,
  openedArtifacts: [],           // [{ id, type, title, rendererType, openedAt, state }]
  viewportState: { x: 0, y: 0, zoom: 1, rotation: 0 },
  rendererStack: [],             // Active renderers in priority order
  activeTeachingMode: 'explain', // Current teaching mode
  interactionMode: 'view',      // 'view' | 'interact' | 'edit'
  focusedLayer: null,            // Which scene layer is active
  canvasSessionVersion: 0,

  // ── Layout Management ──────────────────────────────────────────────────

  setCanvasLayout: (layout) => set((state) => {
    state.canvasLayout = layout;
  }),

  openSplitCanvas: () => set((state) => {
    state.canvasLayout = CANVAS_LAYOUT.SPLIT;
  }),

  openFullscreenCanvas: () => set((state) => {
    state.canvasLayout = CANVAS_LAYOUT.FULLSCREEN;
  }),

  closeCanvasLayout: () => set((state) => {
    state.canvasLayout = CANVAS_LAYOUT.INLINE;
    state.activeArtifactId = null;
  }),

  // ── Artifact Orchestration ─────────────────────────────────────────────

  /**
   * Open an artifact on the canvas. Adds to the opened list and sets as active.
   * Does NOT affect other open artifacts (isolation guarantee).
   */
  openArtifactOnCanvas: (artifact) => set((state) => {
    const { id, type, title, rendererType } = artifact;

    // Don't duplicate
    const existing = state.openedArtifacts.find(a => a.id === id);
    if (!existing) {
      state.openedArtifacts.push({
        id,
        type: type || 'visual',
        title: title || 'Artifact',
        rendererType: rendererType || 'cinematic',
        openedAt: Date.now(),
        state: null, // Will be populated by the renderer
      });
    }

    state.activeArtifactId = id;
    state.canvasLayout = CANVAS_LAYOUT.SPLIT;
    state.canvasSessionVersion++;

    // Update renderer stack
    if (rendererType && !state.rendererStack.includes(rendererType)) {
      state.rendererStack.push(rendererType);
    }
  }),

  /**
   * Switch focus to a different artifact without closing others.
   */
  switchArtifact: (artifactId) => set((state) => {
    const exists = state.openedArtifacts.find(a => a.id === artifactId);
    if (exists) {
      state.activeArtifactId = artifactId;
      state.canvasSessionVersion++;
    }
  }),

  /**
   * Close an artifact, removing it from the opened list.
   * If it was the active one, switch to the most recent remaining.
   */
  closeArtifact: (artifactId) => set((state) => {
    state.openedArtifacts = state.openedArtifacts.filter(a => a.id !== artifactId);

    if (state.activeArtifactId === artifactId) {
      const last = state.openedArtifacts[state.openedArtifacts.length - 1];
      state.activeArtifactId = last?.id || null;
    }

    // If no artifacts remain, go back to inline
    if (state.openedArtifacts.length === 0) {
      state.canvasLayout = CANVAS_LAYOUT.INLINE;
      state.activeArtifactId = null;
    }

    state.canvasSessionVersion++;
  }),

  /**
   * Save state for a specific artifact (renderer captures its state).
   */
  saveArtifactState: (artifactId, artifactState) => set((state) => {
    const artifact = state.openedArtifacts.find(a => a.id === artifactId);
    if (artifact) {
      artifact.state = artifactState;
    }
  }),

  /**
   * Get the state for a specific artifact.
   */
  getArtifactState: (artifactId) => {
    const artifact = get().openedArtifacts.find(a => a.id === artifactId);
    return artifact?.state || null;
  },

  // ── Teaching Mode ──────────────────────────────────────────────────────

  setActiveTeachingMode: (mode) => set((state) => {
    state.activeTeachingMode = mode;
  }),

  setInteractionMode: (mode) => set((state) => {
    state.interactionMode = mode;
  }),

  // ── Viewport ───────────────────────────────────────────────────────────

  setViewportState: (viewport) => set((state) => {
    state.viewportState = { ...state.viewportState, ...viewport };
  }),

  resetViewport: () => set((state) => {
    state.viewportState = { x: 0, y: 0, zoom: 1, rotation: 0 };
  }),

  // ── Session Lifecycle ──────────────────────────────────────────────────

  initCanvasSession: (chatSessionId) => set((state) => {
    state.canvasSessionId = chatSessionId || `cs_${Date.now()}`;
    state.canvasSessionVersion++;
  }),

  clearCanvasSession: () => set((state) => {
    state.canvasSessionId = null;
    state.canvasLayout = CANVAS_LAYOUT.INLINE;
    state.activeArtifactId = null;
    state.openedArtifacts = [];
    state.viewportState = { x: 0, y: 0, zoom: 1, rotation: 0 };
    state.rendererStack = [];
    state.activeTeachingMode = 'explain';
    state.interactionMode = 'view';
    state.focusedLayer = null;
    state.canvasSessionVersion = 0;
  }),

  // ── Progressive Stream Handling ────────────────────────────────────────
  // Logic moved to central tutorStore.js

  /**
   * Get a serializable snapshot for persistence.
   */
  getCanvasSessionSnapshot: () => {
    const s = get();
    return {
      canvasSessionId: s.canvasSessionId,
      activeArtifactId: s.activeArtifactId,
      openedArtifacts: s.openedArtifacts.map(a => ({ id: a.id, type: a.type, title: a.title, rendererType: a.rendererType })),
      viewportState: s.viewportState,
      activeTeachingMode: s.activeTeachingMode,
      canvasLayout: s.canvasLayout,
    };
  },
});
