import { useEffect, useRef } from 'react';
import useTutorStore from '../store/tutorStore';
import { useAuth } from '../context/AuthContext';
import useSocket from './useSocket';
import { getCanvasFingerprint } from '../lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * useSessionSync
 * 
 * Synchronizes the active session (canvas + preferences + messages) with MongoDB for authenticated users.
 * Uses the real MongoDB chatSessionId received from the socket for accurate document targeting.
 * 
 * @param {Array} chatMessages - The client-side chat messages for the active session (optional).
 */
export const useSessionSync = (chatMessages) => {
  const { user, token } = useAuth();
  const { emit, isConnected } = useSocket();
  const { 
    chatSessionId,
    topic, 
    canvasObjects, 
    canvasSteps,
    doubtHistory,
    machineState,
    // Tool settings
    drawColor, drawWidth,
    textToolSize, noteToolSize,
    noteColor, noteSize,
    layoutView, gridType, gridSize, showGrid,
    canvasVersion,
    syncTrigger,
    setChatSessionId,
    pinnedNotes,
  } = useTutorStore();

  const syncTimerRef = useRef(null);
  const lastSyncedRef = useRef(0);
  const fallbackTimerRef = useRef(null);

  const latestRef = useRef({});
  useEffect(() => {
    latestRef.current = {
      user, token, chatSessionId, topic, chatMessages,
      canvasObjects, canvasSteps, canvasVersion,
      drawColor, drawWidth, textToolSize, noteToolSize,
      noteColor, noteSize, layoutView, gridType, gridSize, showGrid,
      setChatSessionId, 
      pinnedNotes
    };
  });

  const performSync = async (isBeacon = false) => {
    const state = latestRef.current;
    
    // ONLY sync for real users, skipping guests
    if (!state.user || state.user.isGuest || !state.token || !state.chatSessionId) {
      if (isBeacon) console.log('[Sync] Beacon skipped: Guest or No ID');
      return;
    }

    const payload = {
      sessionId: state.chatSessionId,
      title: state.topic || 'New Learning Session',
      messages: state.chatMessages || [],
      canvasState: state.canvasObjects || [],
      canvasSteps: state.canvasSteps || [],
      canvasVersion: state.canvasVersion || 0,
      preferences: {
        drawColor: state.drawColor, drawWidth: state.drawWidth,
        textToolSize: state.textToolSize, noteToolSize: state.noteToolSize,
        noteColor: state.noteColor, noteSize: state.noteSize,
        layoutView: state.layoutView, gridType: state.gridType, gridSize: state.gridSize, showGrid: state.showGrid
      },
      pinnedNotes: state.pinnedNotes || []
    };

    // Use Beacon for unload if supported
    if (isBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // Beacon doesn't support headers, so we append the token as a query param
      // The server's 'protect' middleware will be updated to handle this.
      const url = `${API_URL}/api/sessions/beacon?_auth=${encodeURIComponent(state.token)}`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const success = navigator.sendBeacon(url, blob);
      console.log(`[Sync] Beacon flush ${success ? 'queued' : 'failed'}`);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedSession = await response.json();
        
        // CRITICAL FOR SYNC: If we sent a local UUID and MongoDB created a real _id,
        // we MUST update our local tracking ID so future saves update the same document!
        if (savedSession._id && savedSession._id !== state.chatSessionId) {
          console.log(`[Sync] Adopted MongoDB ID: ${savedSession._id}`);
          state.setChatSessionId(savedSession._id);
        }

        console.log('[Sync] Session flushed to cloud successfully.');
        lastSyncedRef.current = Date.now();
      }
    } catch (err) {
      console.error('[Sync] Flush failed:', err);
    }
  };

  // 1. Debounced Auto-Sync
  useEffect(() => {
    if (!user || user.isGuest || !token || !chatSessionId) return;

    // Throttle saves
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    const hasMessages = (doubtHistory && doubtHistory.length > 0) || (chatMessages && chatMessages.length > 0);
    const hasCanvas = canvasObjects && canvasObjects.length > 0;
    if (!hasMessages && !hasCanvas) return;

    syncTimerRef.current = setTimeout(performSync, (parseInt(localStorage.getItem('tb-auto-save')) || 5) * 1000);

    return () => clearTimeout(syncTimerRef.current);
  }, [
    chatSessionId, topic, 
    canvasObjects?.length, 
    getCanvasFingerprint(canvasObjects),
    pinnedNotes?.length,
    canvasVersion, 
    doubtHistory?.length, 
    chatMessages?.length, 
    user, token,
    drawColor, drawWidth, textToolSize, noteToolSize, noteColor, noteSize,  // Toolbar prefs
    layoutView, gridType, gridSize, showGrid                // UI prefs
  ]);

  // 2. Immediate Flush Trigger (e.g. on Logout)
  useEffect(() => {
    if (syncTrigger > 0) {
      console.log('[Sync] Force flush triggered...');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      performSync();
    }
  }, [syncTrigger]);

  // 3. SEC-17: ID Recovery Fallback
  useEffect(() => {
    if (!user || user.isGuest || !isConnected) return;
    
    // If we have an active session but NO chatSessionId after 10s, re-request it
    const isActive = machineState !== 'IDLE' && topic;
    if (isActive && !chatSessionId) {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = setTimeout(() => {
        if (!useTutorStore.getState().chatSessionId) {
          console.log('[Sync] ⏳ chatSessionId still missing after 10s, re-requesting...');
          emit('session:request-db-id');
        }
      }, 10000);
    }

    return () => clearTimeout(fallbackTimerRef.current);
  }, [chatSessionId, machineState, topic, user, isConnected, emit]);

  // 4. SEC-18: Final Unload Flush
  useEffect(() => {
    const handleUnload = () => {
      // Emergency flush via Beacon API
      performSync(true);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);
};
