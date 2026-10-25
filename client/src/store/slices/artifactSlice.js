/**
 * ArtifactSlice — Zustand state management for the Artifact System
 *
 * Implements conversation-scoped artifact persistence and isolation.
 * Prevents cross-session contamination and preserves artifacts when switching chats.
 */

const generateArtifactId = () =>
  `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createArtifactSlice = (set, get) => ({
  // ─── State ───
  artifacts: [],                  // All artifacts in current active session
  artifactsBySession: {},         // Session-scoped cache: { [sessionId]: Artifact[] }
  activeArtifactId: null,         // Currently viewed artifact tab
  streamingArtifact: null,        // Artifact being streamed in (temp)
  isArtifactPanelOpen: false,     // Panel visibility
  artifactPanelFullscreen: false, // Fullscreen mode

  // ─── Actions ───

  /** Add a completed artifact and open the panel */
  addArtifact: (artifact, targetSessionId = null) => {
    const id = artifact.id || generateArtifactId();
    const currentSid = targetSessionId || artifact.sessionId || get().chatSessionId || get().sessionId || 'default';
    const newArtifact = {
      id,
      sessionId: currentSid,
      type: artifact.type || 'code',
      artifactClass: artifact.artifactClass || null,
      title: artifact.title || 'Untitled',
      content: artifact.content || '',
      sceneGraph: artifact.sceneGraph || null,
      language: artifact.language || null,
      metadata: artifact.metadata || {},
      version: artifact.version || 1,
      versions: artifact.versions || [{
        content: artifact.content || '',
        sceneGraph: artifact.sceneGraph || null,
        version: 1,
        createdAt: new Date().toISOString(),
      }],
      dbId: artifact.dbId || null,
      createdAt: artifact.createdAt || new Date().toISOString(),
    };

    set((state) => {
      // 1. Scoped cache update
      if (!state.artifactsBySession) state.artifactsBySession = {};
      if (!state.artifactsBySession[currentSid]) state.artifactsBySession[currentSid] = [];
      const sessionList = state.artifactsBySession[currentSid];
      const existingIdx = sessionList.findIndex(a => a.id === id || (a.dbId && a.dbId === newArtifact.dbId));
      if (existingIdx !== -1) {
        sessionList[existingIdx] = newArtifact;
      } else {
        sessionList.push(newArtifact);
      }

      // 2. Only update active view if this artifact belongs to the current conversation
      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (currentSid === activeSid || !state.artifacts.length) {
        const activeIdx = state.artifacts.findIndex(a => a.id === id || (a.dbId && a.dbId === newArtifact.dbId));
        if (activeIdx !== -1) {
          state.artifacts[activeIdx] = newArtifact;
        } else {
          state.artifacts.push(newArtifact);
        }
        state.activeArtifactId = id;
        state.isArtifactPanelOpen = true;
        state.streamingArtifact = null;
      }
    });

    return id;
  },

  /** Add multiple artifacts at once (for multi-artifact responses) */
  addMultipleArtifacts: (artifactArray, targetSessionId = null) => {
    if (!Array.isArray(artifactArray) || artifactArray.length === 0) return null;
    const currentSid = targetSessionId || get().chatSessionId || get().sessionId || 'default';

    const newArtifacts = artifactArray.map((artifact) => {
      const id = artifact.id || generateArtifactId();
      return {
        id,
        sessionId: currentSid,
        type: artifact.type || 'code',
        artifactClass: artifact.artifactClass || null,
        title: artifact.title || 'Untitled',
        content: artifact.content || '',
        sceneGraph: artifact.sceneGraph || null,
        language: artifact.language || null,
        metadata: artifact.metadata || {},
        version: artifact.version || 1,
        versions: artifact.versions || [{
          content: artifact.content || '',
          sceneGraph: artifact.sceneGraph || null,
          version: 1,
          createdAt: new Date().toISOString(),
        }],
        dbId: artifact.dbId || null,
        createdAt: artifact.createdAt || new Date().toISOString(),
      };
    });

    const firstId = newArtifacts[0].id;

    set((state) => {
      if (!state.artifactsBySession) state.artifactsBySession = {};
      if (!state.artifactsBySession[currentSid]) state.artifactsBySession[currentSid] = [];
      const sessionList = state.artifactsBySession[currentSid];
      newArtifacts.forEach(a => {
        const idx = sessionList.findIndex(existing => existing.id === a.id);
        if (idx !== -1) sessionList[idx] = a;
        else sessionList.push(a);
      });

      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (currentSid === activeSid) {
        newArtifacts.forEach(a => {
          const idx = state.artifacts.findIndex(existing => existing.id === a.id);
          if (idx !== -1) state.artifacts[idx] = a;
          else state.artifacts.push(a);
        });
        state.activeArtifactId = firstId;
        state.isArtifactPanelOpen = true;
        state.streamingArtifact = null;
      }
    });

    return firstId;
  },

  /** Switch active artifact view to another conversation's artifacts */
  switchSessionArtifacts: (sessionId) => {
    if (!sessionId) return;
    set((state) => {
      if (!state.artifactsBySession) state.artifactsBySession = {};
      const sessionArtifacts = state.artifactsBySession[sessionId] || [];
      state.artifacts = [...sessionArtifacts];
      state.activeArtifactId = sessionArtifacts.length > 0 ? sessionArtifacts[0].id : null;
      if (sessionArtifacts.length === 0) {
        state.isArtifactPanelOpen = false;
      }
    });
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

      // Also update in session cache
      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (state.artifactsBySession?.[activeSid]) {
        const cached = state.artifactsBySession[activeSid].find(a => a.id === id);
        if (cached) cached.content = content;
      }
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
        sceneGraph: artifact.sceneGraph,
        version: newVersion,
        createdAt: new Date().toISOString(),
      });
      artifact.version = newVersion;

      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (state.artifactsBySession?.[activeSid]) {
        const cached = state.artifactsBySession[activeSid].find(a => a.id === id);
        if (cached) {
          cached.version = newVersion;
          cached.versions = [...artifact.versions];
        }
      }
    });
  },

  /** Revert artifact to a specific version */
  revertArtifact: (id, versionIndex) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === id);
      if (!artifact || !artifact.versions[versionIndex]) return;
      const targetVersion = artifact.versions[versionIndex];
      artifact.content = targetVersion.content;
      artifact.sceneGraph = targetVersion.sceneGraph || null;
      artifact.version = targetVersion.version;

      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (state.artifactsBySession?.[activeSid]) {
        const cached = state.artifactsBySession[activeSid].find(a => a.id === id);
        if (cached) {
          cached.content = targetVersion.content;
          cached.sceneGraph = targetVersion.sceneGraph || null;
          cached.version = targetVersion.version;
        }
      }
    });
  },

  /** Remove an artifact */
  removeArtifact: (id) => {
    set((state) => {
      const index = state.artifacts.findIndex(a => a.id === id);
      if (index !== -1) {
        state.artifacts.splice(index, 1);
      }

      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (state.artifactsBySession?.[activeSid]) {
        const cIdx = state.artifactsBySession[activeSid].findIndex(a => a.id === id);
        if (cIdx !== -1) state.artifactsBySession[activeSid].splice(cIdx, 1);
      }

      if (state.activeArtifactId === id) {
        state.activeArtifactId = state.artifacts.length > 0 ? state.artifacts[0].id : null;
      }
      if (state.artifacts.length === 0) {
        state.isArtifactPanelOpen = false;
      }
    });
  },

  /** Link a persisted MongoDB ID to a local artifact */
  setArtifactDbId: (localId, dbId, targetSessionId = null) => {
    set((state) => {
      const artifact = state.artifacts.find(a => a.id === localId);
      if (artifact) artifact.dbId = dbId;

      const sid = targetSessionId || state.chatSessionId || state.sessionId || 'default';
      if (state.artifactsBySession?.[sid]) {
        const cached = state.artifactsBySession[sid].find(a => a.id === localId);
        if (cached) cached.dbId = dbId;
      }
    });
  },

  /** Clear artifacts */
  clearArtifacts: (sessionId = null) => {
    set((state) => {
      if (sessionId && state.artifactsBySession) {
        delete state.artifactsBySession[sessionId];
      }
      state.artifacts = [];
      state.activeArtifactId = null;
      state.isArtifactPanelOpen = false;
      state.artifactPanelFullscreen = false;
      state.streamingArtifact = null;
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
      }
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
  finalizeStreamingArtifact: (finalArtifact = null, targetSessionId = null) => {
    const { streamingArtifact, addArtifact } = get();
    const artToFinalize = finalArtifact || streamingArtifact;
    if (artToFinalize) {
      addArtifact(artToFinalize, targetSessionId);
    }
    set({ streamingArtifact: null });
  },

  /** Load artifacts from API for a session */
  loadSessionArtifacts: (artifacts, sessionId = null) => {
    const currentSid = sessionId || get().chatSessionId || get().sessionId || 'default';
    const list = Array.isArray(artifacts) ? artifacts : (artifacts?.artifacts || []);
    const mapped = list.map(a => {
      const rawId = (a.id || a._id)?.toString();
      let sceneV2 = a.sceneV2 || a.sceneGraph?.sceneV2 || a.metadata?.sceneV2;
      if (!sceneV2 && typeof a.content === 'string' && a.content.startsWith('{')) {
        try {
          const parsed = JSON.parse(a.content);
          if (parsed.sceneV2) sceneV2 = parsed.sceneV2;
        } catch (_) {}
      }
      return {
        id: `art-${rawId || Date.now()}`,
        dbId: rawId,
        _id: rawId,
        sessionId: currentSid,
        type: a.type,
        artifactClass: a.artifactClass,
        title: a.title,
        content: a.content,
        sceneGraph: a.sceneGraph,
        sceneV2,
        language: a.language,
        metadata: a.metadata || {},
        version: a.version || 1,
        versions: a.versions || [{ content: a.content, sceneGraph: a.sceneGraph, version: 1, createdAt: a.createdAt }],
        createdAt: a.createdAt,
      };
    });

    set((state) => {
      if (!state.artifactsBySession) state.artifactsBySession = {};
      state.artifactsBySession[currentSid] = mapped;

      const activeSid = state.chatSessionId || state.sessionId || 'default';
      if (currentSid === activeSid) {
        state.artifacts = mapped;
        state.activeArtifactId = mapped.length > 0 ? mapped[0].id : null;
      }
    });
  },
});
