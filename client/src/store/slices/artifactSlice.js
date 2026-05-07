/**
 * ArtifactSlice — Zustand state management for the Artifact System
 *
 * FIX (Immer): addArtifact and addMultipleArtifacts previously called
 *   set(state => ({ ...newState }))   ← returns a NEW object (Immer "replacement" mode)
 * and then returned `id` from outside, which confused Immer when the store
 * is wrapped with the `immer()` middleware.
 *
 * The fix: pre-compute the id BEFORE calling set(), so set() can mutate the
 * draft directly (no return value inside the producer), while the outer function
 * still returns the id normally.
 */

const generateArtifactId = () =>
  `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createArtifactSlice = (set, get) => ({
  // ─── State ───
  artifacts: [],                  // All artifacts in current session
  activeArtifactId: null,         // Currently viewed artifact tab
  streamingArtifact: null,        // Artifact being streamed in (temp)
  isArtifactPanelOpen: false,     // Panel visibility
  artifactPanelFullscreen: false, // Fullscreen mode

  // ─── Actions ───

  /** Add a completed artifact and open the panel */
  addArtifact: (artifact) => {
    // ✅ FIX: pre-compute id outside set() so we can return it without
    //    touching the Immer draft inside the producer callback.
    const id = artifact.id || generateArtifactId();
    const newArtifact = {
      id,
      type: artifact.type || 'code',
      title: artifact.title || 'Untitled',
      content: artifact.content || '',
      language: artifact.language || null,
      metadata: artifact.metadata || {},
      version: artifact.version || 1,
      versions: [{
        content: artifact.content || '',
        version: 1,
        createdAt: new Date().toISOString(),
      }],
      dbId: artifact.dbId || null,
      createdAt: new Date().toISOString(),
    };

    // ✅ FIX: mutate the draft — do NOT return a new object from this callback
    set((state) => {
      state.artifacts.push(newArtifact);
      state.activeArtifactId = id;
      state.isArtifactPanelOpen = true;
      state.streamingArtifact = null;
    });

    return id; // Safe: returned from the outer function, not from inside set()
  },

  /** Add multiple artifacts at once (for multi-artifact responses) */
  addMultipleArtifacts: (artifactArray) => {
    if (!Array.isArray(artifactArray) || artifactArray.length === 0) return null;

    // ✅ FIX: pre-compute everything before set()
    const newArtifacts = artifactArray.map((artifact) => {
      const id = artifact.id || generateArtifactId();
      return {
        id,
        type: artifact.type || 'code',
        title: artifact.title || 'Untitled',
        content: artifact.content || '',
        language: artifact.language || null,
        metadata: artifact.metadata || {},
        version: artifact.version || 1,
        versions: [{
          content: artifact.content || '',
          version: 1,
          createdAt: new Date().toISOString(),
        }],
        dbId: artifact.dbId || null,
        createdAt: new Date().toISOString(),
      };
    });

    const firstId = newArtifacts[0].id;

    // ✅ FIX: mutate draft — do NOT return new object from producer
    set((state) => {
      newArtifacts.forEach(a => state.artifacts.push(a));
      state.activeArtifactId = firstId;
      state.isArtifactPanelOpen = true;
      state.streamingArtifact = null;
    });

    return firstId;
  },

  /** Set the active artifact tab */
  setActiveArtifact: (id) => {
    set({ activeArtifactId: id });
  },

  /** Open the artifact panel */
  openArtifactPanel: () => {
    set({ isArtifactPanelOpen: true });
  },

  /** Close the artifact panel */
  closeArtifactPanel: () => {
    set({ isArtifactPanelOpen: false, artifactPanelFullscreen: false });
  },

  /** Toggle the artifact panel */
  toggleArtifactPanel: () => {
    set((state) => {
      state.artifactPanelFullscreen = state.isArtifactPanelOpen ? false : state.artifactPanelFullscreen;
      state.isArtifactPanelOpen = !state.isArtifactPanelOpen;
    });
  },

  /** Toggle fullscreen mode */
  toggleArtifactFullscreen: () => {
    set((state) => {
      state.artifactPanelFullscreen = !state.artifactPanelFullscreen;
    });
  },

  /** Update content of an artifact (for editing) */
  updateArtifactContent: (id, content) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (artifact) artifact.content = content;
    });
  },

  /** Save a new version of an artifact */
  saveArtifactVersion: (id) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (!artifact) return;
      const newVersion = artifact.version + 1;
      artifact.versions.push({
        content: artifact.content,
        version: newVersion,
        createdAt: new Date().toISOString(),
      });
      artifact.version = newVersion;
    });
  },

  /** Revert artifact to a specific version */
  revertArtifact: (id, versionIndex) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (!artifact || !artifact.versions[versionIndex]) return;
      const targetVersion = artifact.versions[versionIndex];
      artifact.content = targetVersion.content;
      artifact.version = targetVersion.version;
    });
  },

  /** Remove an artifact */
  removeArtifact: (id) => {
    set((state) => {
      const index = state.artifacts.findIndex(a => a.id === id);
      if (index === -1) return;
      state.artifacts.splice(index, 1);
      if (state.activeArtifactId === id) {
        state.activeArtifactId = state.artifacts.length > 0 ? state.artifacts[0].id : null;
      }
      if (state.artifacts.length === 0) {
        state.isArtifactPanelOpen = false;
      }
    });
  },

  /** Link a persisted MongoDB ID to a local artifact */
  setArtifactDbId: (localId, dbId) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === localId);
      if (artifact) artifact.dbId = dbId;
    });
  },

  /** Clear all artifacts (e.g. on session change) */
  clearArtifacts: () => {
    set({
      artifacts: [],
      activeArtifactId: null,
      isArtifactPanelOpen: false,
      artifactPanelFullscreen: false,
      streamingArtifact: null,
    });
  },

  /** Start streaming a new artifact */
  startStreamingArtifact: (artifact) => {
    set({
      streamingArtifact: {
        id: artifact.id || 'streaming',
        type: artifact.type || 'code',
        title: artifact.title || 'Generating...',
        content: '',
        language: artifact.language || null,
        metadata: artifact.metadata || {},
      },
      isArtifactPanelOpen: true,
    });
  },

  /** Update streaming artifact content */
  updateStreamingArtifact: (content) => {
    set((state) => {
      if (state.streamingArtifact) {
        state.streamingArtifact.content += content;
      }
    });
  },

  /** Finalize streaming artifact and move to main list */
  finalizeStreamingArtifact: (finalArtifact = null) => {
    const { streamingArtifact, addArtifact } = get();
    const artToFinalize = finalArtifact || streamingArtifact;
    if (artToFinalize) {
      addArtifact(artToFinalize);
    }
    set({ streamingArtifact: null });
  },

  /** Load artifacts from API for a session */
  loadSessionArtifacts: (artifacts) => {
    const mapped = artifacts.map(a => ({
      id: `art-${a.id || a._id}`,
      dbId: a.id || a._id,
      type: a.type,
      title: a.title,
      content: a.content,
      language: a.language,
      metadata: a.metadata || {},
      version: a.version || 1,
      versions: a.versions || [{ content: a.content, version: 1, createdAt: a.createdAt }],
      createdAt: a.createdAt,
    }));

    set({
      artifacts: mapped,
      activeArtifactId: mapped.length > 0 ? mapped[0].id : null,
    });
  },
});