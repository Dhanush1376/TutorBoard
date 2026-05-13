/**
 * TutorStore v3.0 — Modularized Zustand state management
 * SEC-02 & FO-03: Refactored into feature slices for better maintainability.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Slices
import { createSessionSlice } from './slices/sessionSlice.js';
import { createChatSlice } from './slices/chatSlice.js';
import { createUiSlice } from './slices/uiSlice.js';
import { createConversationSlice } from './slices/conversationSlice.js';
import { createArtifactSlice } from './slices/artifactSlice.js';
import { createSceneSlice } from './slices/sceneSlice.js';
import { createCanvasSessionSlice } from './slices/canvasSessionSlice.js';
import { createPlatformMemorySlice } from './slices/platformMemorySlice.js';
import { createSceneGraphSlice } from './slices/sceneGraphSlice.js';

const safeStorage = {
  getItem: (name) => {
    try { return localStorage.getItem(name); } catch (e) { return null; }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('[Storage] Local storage limit reached. Pruning session manifest.');
        // SEC-41: Aggressive eviction
        try {
          const currentRaw = localStorage.getItem(name);
          if (currentRaw) {
            const current = JSON.parse(currentRaw);
            // If it's our tutorStore state, try pruning the chatHistory first
            if (current?.state?.chatHistory?.length > 5) {
              import.meta.env.DEV && console.log('[Storage] Pruning chatHistory from 30 to 5 entries...');
              current.state.chatHistory = current.state.chatHistory.slice(0, 5);
              localStorage.setItem(name, JSON.stringify(current));
              return;
            }
          }
        } catch (pruneErr) {
          // If pruning fails or isn't enough, clear the key entirely as last resort
          localStorage.removeItem(name);
        }
      }
    }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch (e) { }
  }
};

const useTutorStore = create(
  persist(
    immer((set, get) => ({
      // Merge all slices into one store
      ...createSessionSlice(set, get),
      ...createChatSlice(set, get),
      ...createUiSlice(set, get),
      ...createConversationSlice(set, get),
      ...createArtifactSlice(set, get),
      ...createSceneSlice(set, get),
      ...createCanvasSessionSlice(set, get),
      ...createPlatformMemorySlice(set, get),
      ...createSceneGraphSlice(set, get),

      /**
       * setTeachingTimeline — Atomic update for the whole session state.
       * Consolidates timeline data and machine state transition to prevent race conditions.
       */
      setTeachingTimeline: (timelineData) => {
        set((state) => {
          // 1. Update machine state
          state.machineState = 'TEACHING';
          state.error = null;
          
          // 2. Extract and Normalize Timeline (Logic from sceneSlice)
          const rawSteps = timelineData.timeline || timelineData.steps || [];
          const canvasSteps = rawSteps.length > 0 ? rawSteps : [{}];
          const totalSteps = canvasSteps.length;
          
          state.activeScene = {
            ...timelineData,
            steps: canvasSteps,
            timeline: canvasSteps
          };
          state.canvasObjects = timelineData.elements || timelineData.objects || [];
          state.canvasConnections = timelineData.connections || [];
          state.canvasSteps = canvasSteps;
          state.totalSteps = totalSteps;
          state.currentStepIndex = typeof timelineData.currentStepIndex === 'number' 
            ? timelineData.currentStepIndex 
            : 0;
          state.sceneReady = false;
          state.isPlaying = false;
        });
      },

      hydrate: () => {
        if (typeof window === 'undefined') return;
        set((state) => {
          state.selectedAgent = localStorage.getItem('tutorboard-agent') || 'Universal';
          
          // SEC-UX-05: Guest Trial Reset (Daily/Session Lifecycle)
          // If the last guest message was more than 24 hours ago, reset the count.
          const guestStatus = state.guestTrialStatus;
          if (guestStatus && guestStatus.lastMessageAt) {
            const oneDay = 24 * 60 * 60 * 1000;
            if (Date.now() - guestStatus.lastMessageAt > oneDay) {
              import.meta.env.DEV && console.log('[Store] 🕒 Guest trial reset: >24h elapsed since last activity.');
              state.resetGuestTrial();
            }
          }
        });
      },

      /**
       * hydrateSession — Centralized hydration of the active session.
       * Called by Home.jsx or AuthProvider once user data is available.
       */
      hydrateSession: async (user) => {
        const state = get();
        
        // 1. Determine which session ID to restore
        const savedActiveId = user?.lastActiveSessionId || localStorage.getItem('tutorboard-active-chat');
        if (!savedActiveId) return;

        // 2. If we already have an active session, skip hydration unless it's different
        if (state.chatSessionId === savedActiveId || state.sessionId === savedActiveId) {
          return;
        }
        if (state.isMessagesLoading) return;

        import.meta.env.DEV && console.log('[Store] Hydrating active session:', savedActiveId);

        // 3. Set the active IDs
        state.setSessionId(savedActiveId);
        state.setChatSessionId(savedActiveId);

        // 4. Restore pedagogical state (messages/canvas) from cloud if needed
        const isMongoId = /^[0-9a-fA-F]{24}$/.test(savedActiveId);
        if (isMongoId && (!state.conversationMessages || state.conversationMessages.length === 0)) {
           await state.restoreSessionFromServer(savedActiveId);
        } else {
          // Optimistic local restoration from chatHistory if cloud fetch isn't needed/available
          const localSession = state.chatHistory.find(s => s.id === savedActiveId);
          if (localSession) {
            if (localSession.messages && localSession.messages.length > 0) {
              state.setConversationMessages(localSession.messages);
            }
            if (localSession.canvasState && localSession.canvasState.length > 0) {
              state.setCanvasSnapshot({
                canvasObjects: localSession.canvasState,
                canvasSteps: localSession.canvasSteps || [],
                totalSteps: localSession.canvasSteps?.length || 0,
                title: localSession.title
              });
            }
          }
        }
      },

      /**
       * handleProgressiveStreamEvent — Central Orchestrator for SSE events.
       * Decouples SSE event arrival from UI implementation.
       */
      handleProgressiveStreamEvent: (eventData) => set((state) => {
        const { type } = eventData;

        switch (type) {
          case 'meta':
            if (eventData.sessionId) {
              const oldId = state.chatSessionId || state.sessionId;
              
              // Adopt the real MongoDB ID immediately
              state.promoteSessionId(oldId, eventData.sessionId);
              state.setSessionId(eventData.sessionId);
              state.setChatSessionId(eventData.sessionId);

              // CRITICAL DEDUPLICATION: Promote any local history entry to the new real DB ID
              if (oldId && oldId !== eventData.sessionId) {
                const hasExisting = state.chatHistory.some(s => s.id === eventData.sessionId);
                if (hasExisting) {
                  state.chatHistory = state.chatHistory.filter(s => s.id !== oldId);
                } else {
                  state.chatHistory = state.chatHistory.map(s => {
                    if (s.id === oldId) {
                      return { ...s, id: eventData.sessionId, chatSessionId: eventData.sessionId };
                    }
                    return s;
                  });
                }
              }
            }
            if (eventData.teachingMode) {
              state.activeTeachingMode = eventData.teachingMode;
            }
            if (eventData.activeArtifactId) {
              state.activeArtifactId = eventData.activeArtifactId;
            }
            break;

          case 'canvas_skeleton':
            // The router decided we need a canvas.
            // eventData: { layout: 'split'|'fullscreen', rendererType: 'd3'|... }
            state.canvasLayout = eventData.layout || 'split';
            if (eventData.rendererType && !state.rendererStack.includes(eventData.rendererType)) {
              state.rendererStack.push(eventData.rendererType);
            }
            state.canvasSessionVersion++;
            
            // Link to the active streaming message so the card appears
            if (state.streamingMessageId) {
              state.updateMessageMetadata(state.streamingMessageId, {
                hasVisualArtifact: true,
                artifactStatus: 'generating',
                rendererType: eventData.rendererType
              });
            }

            // If it's a skeleton, clear current nodes to prepare for new ones
            state.setTimeline({ timeline: [], objects: [] });
            break;

          case 'scene_nodes':
            // eventData: { nodes: [...], renderer: '...' }
            // Feed the nodes directly into the teaching engine (canvasSlice)
            if (eventData.nodes && Array.isArray(eventData.nodes) && eventData.nodes.length > 0) {
              const adaptedTimeline = { 
                steps: eventData.nodes, 
                timeline: eventData.nodes,
                objects: [], // Objects will be instantiated by the renderer
                renderer: eventData.renderer,
                title: state.conversationTopic || 'Visualization'
              };

              state.setTimeline(adaptedTimeline);
              state.loadScene(adaptedTimeline); // Wire to sceneSlice for CinematicStage

              if (state.streamingMessageId) {
                state.updateMessageMetadata(state.streamingMessageId, {
                  artifactStatus: 'completed',
                  artifactTitle: state.conversationTopic || 'Visualization'
                });
              }
            }
            
            // Auto-open canvas if it's currently hidden
            if (state.canvasLayout === 'inline') {
              state.canvasLayout = 'split';
            }
            state.canvasSessionVersion++;
            break;

          case 'artifact_saved':
            // eventData: { artifactId: '...', title: '...', rendererType: '...' }
            if (state.streamingMessageId) {
              state.updateMessageMetadata(state.streamingMessageId, {
                artifactId: eventData.artifactId,
                artifactStatus: 'completed'
              });
            }
            // Link the DB ID to any local artifact that matches (if applicable)
            state.artifacts.forEach(art => {
              const isMatch = (eventData.localId && art.id === eventData.localId) || 
                              (!eventData.localId && art.title === eventData.title);
              if (isMatch && !art.dbId) {
                state.setArtifactDbId(art.id, eventData.artifactId);
              }
            });
            break;

          default:
            break;
        }
      }),
    })),
    {
      name: 'tutorboard-session',
      storage: safeStorage,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      // Only persist UI preferences and global context — never large session data (objects, steps, history)
      partialize: (state) => ({
        sessionId: state.sessionId,
        chatSessionId: state.chatSessionId,
        playbackSpeed: state.playbackSpeed,
        layoutView: state.layoutView,
        isSidebarOpen: state.isSidebarOpen,
        recentColors: state.recentColors,
        laserWidth: state.laserWidth,
        textToolSize: state.textToolSize,
        noteToolSize: state.noteToolSize,
        alertPrefs: state.alertPrefs,
        globalFont: state.globalFont,
        glassIntensity: state.glassIntensity,
        canvasTone: state.canvasTone,
        motionMode: state.motionMode,
        sessionManifest: typeof state.sessionManifest === 'object' && state.sessionManifest !== null
          ? Object.fromEntries(
              Object.entries(state.sessionManifest)
                .sort(([, a], [, b]) => (b.lastActive || 0) - (a.lastActive || 0))
                .slice(0, 20)
            )
          : state.sessionManifest,
        // PERSISTENCE FIX: Persist chatHistory so sidebar sessions survive refresh
        // Capped to 30 entries to avoid localStorage quota issues
        chatHistory: Array.isArray(state.chatHistory) 
          ? state.chatHistory.slice(0, 30).map(s => ({
              id: s.id,
              chatSessionId: s.chatSessionId,
              title: s.title,
              topic: s.topic,
              updatedAt: s.updatedAt,
              createdAt: s.createdAt,
              // Exclude heavy fields (messages, canvasState) from persistence
            }))
          : [],
        // Explicitly exclude history {past, future} and snapshots to save space/performance
        history: { past: [], future: [] },
        guestTrialStatus: state.guestTrialStatus,
        // Scene state is ephemeral — never persist (Fix D-03)
        activeScene: null,
        canvasObjects: [],
        canvasSteps: [],
        currentStepIndex: 0,
        totalSteps: 0,
        stepSnapshots: {},
        stepMessageMap: {},
        rendererStack: [],
        sceneReady: false,
        sceneDomain: 'general',
        isPlaying: false,
        isPaused: false,
        sceneInteraction: { hoveredEntityId: null, selectedEntityId: null, tooltip: null },
        activeStepHighlight: null,
        canvasAnnotations: [],
        isArtifactPanelOpen: false,
        viewportState: { x: 0, y: 0, zoom: 1, rotation: 0 },
        interactionMode: 'view',
        focusedLayer: null,
        canvasSessionVersion: 0,
        // Explicitly exclude conversation state from persistence (fetched from server on restore)
        conversationMessages: [],
        isStreaming: false,
        streamingContent: '',
        streamingMessageId: null,
        isWaitingForAI: false,
        deltaState: null,
        d3Narration: '',
      }),
    }
  )
);

export default useTutorStore;
export { STATES } from './slices/sessionSlice.js';
export { CANVAS_MODE } from './slices/sceneSlice.js';
export { CANVAS_LAYOUT } from './slices/canvasSessionSlice.js';
