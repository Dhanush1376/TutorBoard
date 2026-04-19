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
      // Only persist UI preferences and global context — never large session data (objects, steps, history)
      partialize: (state) => ({
        playbackSpeed: state.playbackSpeed,
        voiceEnabled:  state.voiceEnabled,
        layoutView:    state.layoutView,
        recentColors:  state.recentColors,
        laserWidth:    state.laserWidth,
        textToolSize:  state.textToolSize,
        noteToolSize:  state.noteToolSize,
        sessionManifest: state.sessionManifest,
        // Explicitly exclude history {past, future} and snapshots to save space/performance
        history: { past: [], future: [] },
      }),
    }
  )
);

export default useTutorStore;
export { STATES } from './slices/sessionSlice.js';
export { CANVAS_MODE } from './slices/canvasSlice.js';