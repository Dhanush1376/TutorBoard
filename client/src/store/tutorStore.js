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
        // If manifest is the problem, clear it (worst case) or just ignore the save
        // In a real app we might try to evict more aggressively here
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

      // Global Actions / Hydration
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
              console.log('[Store] 🕒 Guest trial reset: >24h elapsed since last activity.');
              state.resetGuestTrial();
            }
          }
        });
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
              // Adopt the real MongoDB ID immediately to prevent duplicate session creation
              // during background auto-syncs.
              state.setSessionId(eventData.sessionId);
              state.setChatSessionId(eventData.sessionId);
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
            if (eventData.nodes) {
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
        // Explicitly exclude conversation state from persistence
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