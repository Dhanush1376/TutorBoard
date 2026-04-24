/**
 * TutorStore v3.0 — Modularized Zustand state management
 * SEC-02 & FO-03: Refactored into feature slices for better maintainability.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Slices
import { createSessionSlice } from './slices/sessionSlice.js';
import { createCanvasSlice } from './slices/canvasSlice.js';
import { createChatSlice } from './slices/chatSlice.js';
import { createUiSlice } from './slices/uiSlice.js';
import { createControlSlice } from './slices/controlSlice.js';

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
    (set, get) => ({
      // Merge all slices into one store
      ...createSessionSlice(set, get),
      ...createCanvasSlice(set, get),
      ...createChatSlice(set, get),
      ...createUiSlice(set, get),
      ...createControlSlice(set, get),

      // Global Actions / Hydration
      hydrate: () => {
        if (typeof window === 'undefined') return;
        set({
          isSidebarOpen: window.innerWidth >= 768,
          selectedAgent: localStorage.getItem('tutorboard-agent') || 'Universal',
        });
      },
    }),
    {
      name: 'tutorboard-session',
      storage: safeStorage,
      // Only persist UI preferences and global context — never large session data (objects, steps, history)
      partialize: (state) => ({
        playbackSpeed: state.playbackSpeed,
        voiceEnabled: state.voiceEnabled,
        layoutView: state.layoutView,
        recentColors: state.recentColors,
        laserWidth: state.laserWidth,
        textToolSize: state.textToolSize,
        noteToolSize: state.noteToolSize,
        alertPrefs: state.alertPrefs,
        sessionManifest: typeof state.sessionManifest === 'object' && state.sessionManifest !== null
          ? Object.fromEntries(
              Object.entries(state.sessionManifest)
                .sort(([, a], [, b]) => (b.lastActive || 0) - (a.lastActive || 0))
                .slice(0, 10)
            )
          : state.sessionManifest,
        chatSessionId: state.chatSessionId,
        sessionId: state.sessionId,
        // Explicitly exclude history {past, future} and snapshots to save space/performance
        history: { past: [], future: [] },
      }),
    }
  )
);

export default useTutorStore;
export { STATES } from './slices/sessionSlice.js';
export { CANVAS_MODE } from './slices/canvasSlice.js';