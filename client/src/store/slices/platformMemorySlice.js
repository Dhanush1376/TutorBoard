/**
 * platformMemorySlice v1.0 — Client-Side Platform Memory
 *
 * Mirrors the server's PlatformMemoryService on the client.
 * Tracks what the student is currently viewing and learning
 * for local UI decisions (context continuity, smart suggestions).
 */

export const createPlatformMemorySlice = (set, get) => ({
  // ── Platform Memory State ──────────────────────────────────────────────
  platformMemory: {
    activeTopic: null,
    openedArtifactIds: [],
    activeRenderer: null,
    teachingHistory: [],       // [{ topic, mode, timestamp }]
    learningDepth: 'surface',  // surface | core | advanced
    previousVisualContext: null,
    sessionGoals: [],
    conceptGraph: {},          // { topic: visitCount }
  },

  // ── Actions ────────────────────────────────────────────────────────────

  updatePlatformMemory: (updates) => set((state) => {
    state.platformMemory = { ...state.platformMemory, ...updates };
  }),

  setActiveTopic: (topic) => set((state) => {
    state.platformMemory.activeTopic = topic;
    if (topic) {
      state.platformMemory.conceptGraph[topic] =
        (state.platformMemory.conceptGraph[topic] || 0) + 1;
    }
  }),

  setActiveRendererMemory: (renderer) => set((state) => {
    state.platformMemory.activeRenderer = renderer;
  }),

  setActiveTeachingModeMemory: (mode) => set((state) => {
    state.activeTeachingMode = mode;
  }),

  recordTeachingEvent: (topic, mode) => set((state) => {
    const entry = { topic, mode: mode || 'explain', timestamp: Date.now() };
    state.platformMemory.teachingHistory.push(entry);

    // Keep last 20
    if (state.platformMemory.teachingHistory.length > 20) {
      state.platformMemory.teachingHistory =
        state.platformMemory.teachingHistory.slice(-20);
    }

    // Auto-detect depth
    const topicCount = state.platformMemory.teachingHistory
      .filter(h => h.topic === topic).length;
    if (topicCount >= 5) {
      state.platformMemory.learningDepth = 'advanced';
    } else if (topicCount >= 2) {
      state.platformMemory.learningDepth = 'core';
    } else {
      state.platformMemory.learningDepth = 'surface';
    }

    state.platformMemory.activeTopic = topic;
  }),

  trackOpenedArtifact: (artifactId) => set((state) => {
    if (!state.platformMemory.openedArtifactIds.includes(artifactId)) {
      state.platformMemory.openedArtifactIds.push(artifactId);
    }
  }),

  untrackArtifact: (artifactId) => set((state) => {
    state.platformMemory.openedArtifactIds =
      state.platformMemory.openedArtifactIds.filter(id => id !== artifactId);
  }),

  savePreviousVisualContext: (context) => set((state) => {
    state.platformMemory.previousVisualContext = context;
  }),

  addSessionGoal: (goal) => set((state) => {
    if (!state.platformMemory.sessionGoals.includes(goal)) {
      state.platformMemory.sessionGoals.push(goal);
    }
  }),

  clearPlatformMemory: () => set((state) => {
    state.platformMemory = {
      activeTopic: null,
      openedArtifactIds: [],
      activeRenderer: null,
      teachingHistory: [],
      learningDepth: 'surface',
      previousVisualContext: null,
      sessionGoals: [],
      conceptGraph: {},
    };
  }),

  /**
   * Build a summary object to send to the server with each request.
   * The server's PlatformMemoryService uses this to enrich the system prompt.
   */
  getPlatformMemorySummary: () => {
    const mem = get().platformMemory;
    return {
      activeTopic: mem.activeTopic,
      openedArtifactIds: mem.openedArtifactIds,
      activeRenderer: mem.activeRenderer,
      activeTeachingMode: get().activeTeachingMode || 'explain',
      learningDepth: mem.learningDepth,
      recentTopics: [...new Set(mem.teachingHistory.slice(-5).map(h => h.topic))].filter(Boolean),
      hasVisualContext: !!mem.previousVisualContext,
    };
  },
});
