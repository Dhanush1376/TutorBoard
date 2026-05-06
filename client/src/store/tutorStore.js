/**
 * TutorStore v3.0 — Modularized Zustand state management
 * SEC-02 & FO-03: Refactored into feature slices for better maintainability.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Slices
import { createSessionSlice } from './slices/sessionSlice.js';
import { createCanvasSlice } from './slices/canvasSlice.js';
import { createChatSlice } from './slices/chatSlice.js';
import { createUiSlice } from './slices/uiSlice.js';
import { createControlSlice } from './slices/controlSlice.js';
import { createConversationSlice } from './slices/conversationSlice.js';
import { createArtifactSlice } from './slices/artifactSlice.js';

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
      ...createCanvasSlice(set, get),
      ...createChatSlice(set, get),
      ...createUiSlice(set, get),
      ...createControlSlice(set, get),
      ...createConversationSlice(set, get),
      ...createArtifactSlice(set, get),

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
    })),
    {
      name: 'tutorboard-session',
      storage: safeStorage,
      // Only persist UI preferences and global context — never large session data (objects, steps, history)
      partialize: (state) => ({
        sessionId: state.sessionId,
        chatSessionId: state.chatSessionId,
        playbackSpeed: state.playbackSpeed,
        voiceEnabled: state.voiceEnabled,
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
        isArtifactPanelOpen: false,
        // Explicitly exclude conversation state from persistence
        conversationMessages: [],
        isStreaming: false,
        streamingContent: '',
        streamingMessageId: null,
        isWaitingForAI: false,
      }),
    }
  )
);

export default useTutorStore;
export { STATES } from './slices/sessionSlice.js';
export { CANVAS_MODE } from './slices/canvasSlice.js';