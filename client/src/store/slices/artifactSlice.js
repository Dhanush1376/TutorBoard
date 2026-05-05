/**
 * ArtifactSlice — Zustand state management for the Artifact System
 * 
 * Manages artifact lifecycle: creation from SSE events, editing,
 * version history, tab switching, and panel visibility.
 */

const generateArtifactId = () =>
  `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createArtifactSlice = (set, get) => ({
  // ─── State ───
  artifacts: [],                 // All artifacts in current session
  activeArtifactId: null,        // Currently viewed artifact tab
  streamingArtifact: null,       // Artifact being streamed in (temp)
  isArtifactPanelOpen: false,    // Panel visibility
  artifactPanelFullscreen: false, // Fullscreen mode

  // ─── Actions ───

  /** Add a completed artifact and open the panel */
  addArtifact: (artifact) => {
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
      dbId: artifact.dbId || null, // MongoDB _id after persistence
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      artifacts: [...state.artifacts, newArtifact],
      activeArtifactId: id,
      isArtifactPanelOpen: true,
      streamingArtifact: null,
    }));

    return id;
  },

  /** Add multiple artifacts at once (for multi-artifact responses) */
  addMultipleArtifacts: (artifactArray) => {
    if (!Array.isArray(artifactArray) || artifactArray.length === 0) return null;

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

    set((state) => ({
      artifacts: [...state.artifacts, ...newArtifacts],
      activeArtifactId: firstId,
      isArtifactPanelOpen: true,
      streamingArtifact: null,
    }));

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
    set((state) => ({
      isArtifactPanelOpen: !state.isArtifactPanelOpen,
      artifactPanelFullscreen: state.isArtifactPanelOpen ? false : state.artifactPanelFullscreen,
    }));
  },

  /** Toggle fullscreen mode */
  toggleArtifactFullscreen: () => {
    set((state) => ({
      artifactPanelFullscreen: !state.artifactPanelFullscreen,
    }));
  },

  /** Update content of an artifact (for editing) */
  updateArtifactContent: (id, content) => {
    set((state) => ({
      artifacts: state.artifacts.map(a =>
        a.id === id ? { ...a, content } : a
      ),
    }));
  },

  /** Save a new version of an artifact */
  saveArtifactVersion: (id) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (!artifact) return state;

      const newVersion = artifact.version + 1;
      const updatedVersions = [
        ...artifact.versions,
        {
          content: artifact.content,
          version: newVersion,
          createdAt: new Date().toISOString(),
        },
      ];

      return {
        artifacts: state.artifacts.map(a =>
          a.id === id
            ? { ...a, version: newVersion, versions: updatedVersions }
            : a
        ),
      };
    });
  },

  /** Revert artifact to a specific version */
  revertArtifact: (id, versionIndex) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (!artifact || !artifact.versions[versionIndex]) return state;

      const targetVersion = artifact.versions[versionIndex];

      return {
        artifacts: state.artifacts.map(a =>
          a.id === id
            ? { ...a, content: targetVersion.content, version: targetVersion.version }
            : a
        ),
      };
    });
  },

  /** Remove an artifact */
  removeArtifact: (id) => {
    set((state) => {
      const remaining = state.artifacts.filter(a => a.id !== id);
      return {
        artifacts: remaining,
        activeArtifactId: remaining.length > 0
          ? (state.activeArtifactId === id ? remaining[0].id : state.activeArtifactId)
          : null,
        isArtifactPanelOpen: remaining.length > 0 ? state.isArtifactPanelOpen : false,
      };
    });
  },

  /** Link a persisted MongoDB ID to a local artifact */
  setArtifactDbId: (localId, dbId) => {
    set((state) => ({
      artifacts: state.artifacts.map(a =>
        a.id === localId ? { ...a, dbId } : a
      ),
    }));
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
    set((state) => ({
      streamingArtifact: state.streamingArtifact 
        ? { ...state.streamingArtifact, content: state.streamingArtifact.content + content }
        : null
    }));
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
