import { useEffect, useRef, useMemo } from 'react';
import useTutorStore from '../store/tutorStore';
import { useAuth } from '../context/AuthContext';
import useSocket from './useSocket';
import { getCanvasFingerprint } from '../lib/utils';

import { BASE_URL as API_URL } from '../services/api';

// Generate a stable local UUID for sessions that haven't been assigned a server ID yet.
// This ensures toolbar drawings are saved immediately without waiting for the socket handshake.
const generateLocalId = () => `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    activeSnapshotId,
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
      pinnedNotes,
      activeSnapshotId
    };
  });

  const localSessionIdRef = useRef(null);

  const performSync = async (isBeacon = false) => {
    const state = latestRef.current;
    
    // ONLY sync for real users, skipping guests
    if (!state.user || state.user.isGuest || !state.token) {
      if (isBeacon) console.log('[Sync] Beacon skipped: Guest or No Token');
      return;
    }

    // Guard: Don't sync if no user content (avoid empty session spam)
    // We only consider a session "meaningful" if it has at least one user message 
    // OR at least one manual drawing (ignoring agent-generated objects).
    const hasUserMessages = state.chatMessages && state.chatMessages.some(m => m.role === 'user');
    const hasManualDrawings = state.canvasObjects && state.canvasObjects.some(o => o.id?.startsWith('manual-'));
    const hasUserContent = hasUserMessages || hasManualDrawings;
    
    if (!hasUserContent) {
      if (isBeacon) console.log('[Sync] Beacon skipped: No user content');
      return;
    }

    // FIX: If we have no chatSessionId yet (session not started or socket handshake pending),
    // use a stable local UUID so manual toolbar drawings are immediately persisted.
    // When the server later assigns a real MongoDB _id, we adopt it (see below).
    if (!state.chatSessionId && !localSessionIdRef.current) {
      localSessionIdRef.current = generateLocalId();
      console.log(`[Sync] No chatSessionId yet — using local fallback ID: ${localSessionIdRef.current}`);
    }
    const effectiveSessionId = state.chatSessionId || localSessionIdRef.current;

    const payload = {
      sessionId: effectiveSessionId,
      activeSnapshotId: state.activeSnapshotId,
      ...(state.topic ? { title: state.topic } : {}),
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
      // Beacon doesn't support headers, so we include the token in the payload body
      const url = `${API_URL}/api/sessions/beacon`;
      const blob = new Blob([JSON.stringify({ ...payload, token: state.token })], { type: 'application/json' });
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
          // Clear the local fallback ID — from now on, use the real server ID
          localSessionIdRef.current = null;
        }

        console.log('[Sync] Session flushed to cloud successfully.');
        lastSyncedRef.current = Date.now();
      }
    } catch (err) {
      console.error('[Sync] Flush failed:', err);
    }
  };

  // 1. Debounced Auto-Sync
  const fingerprint = useMemo(() => getCanvasFingerprint(canvasObjects), [canvasObjects]);

  useEffect(() => {
    if (!user || user.isGuest || !token) return;

    const hasMessages = (doubtHistory && doubtHistory.length > 0) || (chatMessages && chatMessages.length > 0);
    const hasCanvas = canvasObjects && canvasObjects.length > 0;

    // Guard: Only auto-sync if we have actual content (canvas OR messages)
    if (!hasCanvas && !hasMessages) return;

    // Throttle saves
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(performSync, (parseInt(localStorage.getItem('tb-auto-save')) || 5) * 1000);

    return () => clearTimeout(syncTimerRef.current);
  }, [
    chatSessionId, topic, 
    canvasObjects?.length, 
    fingerprint,
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
        if (!chatSessionId) {
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