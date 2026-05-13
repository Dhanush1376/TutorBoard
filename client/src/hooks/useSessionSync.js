import { useEffect, useRef, useMemo, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';
import { useAuth } from '../hooks/useAuth';
import useSocket from './useSocket';
import { getCanvasFingerprint } from '../lib/utils';

import API, { BASE_URL as API_URL } from '../services/api';

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
    setSyncError,
    pinnedNotes,
    activeSnapshotId,
    isVersionSwitching,
    promoteChatHistoryId,
    updateChatHistoryEntry,
  } = useTutorStore();

  const syncTimerRef = useRef(null);
  const lastSyncedRef = useRef(0);
  const fallbackTimerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const lastPayloadRef = useRef('');

  const latestRef = useRef({});
  useEffect(() => {
    latestRef.current = {
      user, token, chatSessionId, topic, chatMessages,
      canvasObjects, canvasSteps, canvasVersion,
      drawColor, drawWidth, textToolSize, noteToolSize,
      noteColor, noteSize, layoutView, gridType, gridSize, showGrid,
      setChatSessionId, 
      setSyncError,
      pinnedNotes,
      doubtHistory, // FIXED: Now captured in snapshot
      activeSnapshotId,
      promoteChatHistoryId,
      updateChatHistoryEntry
    };
  });

  const localSessionIdRef = useRef(null);

  const performSync = useCallback(async (isBeacon = false) => {
    const state = latestRef.current;
    
    // Concurrency Lock: Don't start a new sync if one is in flight
    if (isSyncingRef.current) {
      import.meta.env.DEV && console.log('[Sync] Skip: Sync already in flight');
      return;
    }

    // ONLY sync for real users, skipping guests
    if (!state.user || state.user.isGuest || !state.token) {
      if (isBeacon) import.meta.env.DEV && console.log('[Sync] Beacon skipped: Guest or No Token');
      return;
    }

    // Guard: Don't sync if no user content (avoid empty session spam)
    const hasUserMessages = state.chatMessages && state.chatMessages.some(m => m.role === 'user');
    const hasManualDrawings = state.canvasObjects && state.canvasObjects.some(o => o.id?.startsWith('manual-'));
    const hasUserContent = hasUserMessages || hasManualDrawings;
    
    if (!hasUserContent) {
      if (isBeacon) import.meta.env.DEV && console.log('[Sync] Beacon skipped: No user content');
      return;
    }

    if (!state.chatSessionId && !localSessionIdRef.current) {
      localSessionIdRef.current = generateLocalId();
      import.meta.env.DEV && console.log(`[Sync] No chatSessionId yet — using local fallback ID: ${localSessionIdRef.current}`);
    }
    const effectiveSessionId = state.chatSessionId || localSessionIdRef.current;

    // SEC-34: Send only a subset of messages to avoid massive payloads.
    // The server performs an upsert, so we only need to send the most recent ones.
    const allMessages = state.chatMessages || useTutorStore.getState().conversationMessages || [];
    const syncMessages = allMessages.slice(-20);

    const payload = {
      sessionId: effectiveSessionId,
      activeSnapshotId: state.activeSnapshotId,
      ...(state.topic ? { title: state.topic } : {}),
      messages: syncMessages,
      canvasState: state.canvasObjects || [],
      canvasSteps: state.canvasSteps || [],
      canvasVersion: state.canvasVersion || 0,
      doubtHistory: state.doubtHistory || [],
      preferences: {
        drawColor: state.drawColor, drawWidth: state.drawWidth,
        textToolSize: state.textToolSize, noteToolSize: state.noteToolSize,
        noteColor: state.noteColor, noteSize: state.noteSize,
        layoutView: state.layoutView, gridType: state.gridType, gridSize: state.gridSize, showGrid: state.showGrid
      },
      pinnedNotes: state.pinnedNotes || []
    };

    // Redundancy Check
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastPayloadRef.current && !isBeacon) {
      import.meta.env.DEV && console.log('[Sync] Skip: Payload identical to last successful sync');
      return;
    }

    // Use keepalive fetch for unload
    if (isBeacon && typeof window !== 'undefined') {
      const url = `${API_URL}/api/sessions/beacon`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'include'
      }).catch(err => console.warn('[Sync] Unload flush failed:', err));
      import.meta.env.DEV && console.log(`[Sync] Unload flush queued`);
      return;
    }

    isSyncingRef.current = true;
    try {
      if (useTutorStore.getState().isVersionSwitching) {
        console.warn('[Sync] 🛑 Sync blocked: Version lock is active');
        return;
      }
      
      console.log('[Sync] 🚀 Performing sync for session:', effectiveSessionId);
      const response = await API.post('/api/sessions', payload);

      if (response.status === 200) {
        const savedSession = response.data;
        
        if (savedSession._id && savedSession._id !== state.chatSessionId) {
          import.meta.env.DEV && console.log(`[Sync] Adopted MongoDB ID: ${savedSession._id}`);
          const oldId = state.chatSessionId || localSessionIdRef.current;
          state.promoteChatHistoryId(oldId, savedSession._id);
          state.setChatSessionId(savedSession._id);
          localSessionIdRef.current = null;
        }
        
        state.updateChatHistoryEntry(savedSession._id || state.chatSessionId || localSessionIdRef.current, {
          messages: savedSession.messages || allMessages,
          canvasState: savedSession.canvasState || payload.canvasState,
          updatedAt: Date.now()
        });

        import.meta.env.DEV && console.log('[Sync] Session flushed to cloud successfully.');
        lastSyncedRef.current = Date.now();
        lastPayloadRef.current = payloadStr;
        state.setSyncError(null);
      }
    } catch (err) {
      console.error('[Sync] Flush failed:', err);
      state.setSyncError(err.response?.data?.error || err.message || 'Background sync failed');
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // 1. Debounced Auto-Sync
  const fingerprint = useMemo(() => getCanvasFingerprint(canvasObjects), [canvasObjects]);

  useEffect(() => {
    if (!user || user.isGuest || !token) return;

    const hasMessages = (doubtHistory && doubtHistory.length > 0) || (chatMessages && chatMessages.length > 0);
    const hasCanvas = canvasObjects && canvasObjects.length > 0;

    // Guard: Only auto-sync if we have actual content (canvas OR messages)
    if (!hasCanvas && !hasMessages) return;

    // Guard: Prevent sync loops during version navigation
    if (isVersionSwitching) {
      import.meta.env.DEV && console.log('[Sync] Postponing sync: Version lock active');
      return;
    }

    // Throttle saves
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    // SEC-35: Clamp auto-save interval to 3s-60s
    const rawSecs = parseInt(localStorage.getItem('tb-auto-save')) || 5;
    const safeSecs = Math.max(3, Math.min(60, rawSecs));
    
    syncTimerRef.current = setTimeout(performSync, safeSecs * 1000);

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
    layoutView, gridType, gridSize, showGrid,               // UI prefs
    isVersionSwitching
  ]);

  // 2. Immediate Flush Trigger (e.g. on Logout)
  useEffect(() => {
    if (syncTrigger > 0 && !isVersionSwitching) {
      import.meta.env.DEV && console.log('[Sync] Force flush triggered...');
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
          import.meta.env.DEV && console.log('[Sync] ⏳ chatSessionId still missing after 10s, re-requesting...');
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
      // SEC-29: latestRef.current ensures we use fresh data even if this closure is stale
      performSync(true);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [performSync]); // SEC-29: Added performSync to deps

  // 6. PERSISTENCE FIX: Restore conversation messages from server when session ID exists but messages are empty
  const messagesRestoredRef = useRef(false);

  // SEC-40: Reset restoration guard when the session ID changes
  useEffect(() => {
    messagesRestoredRef.current = false;
  }, [chatSessionId]);

  useEffect(() => {
    // ALLOW GUESTS to restore their active session messages
    if (!user || messagesRestoredRef.current) return;
    
    const currentChatSessionId = useTutorStore.getState().chatSessionId;
    const currentMessages = useTutorStore.getState().conversationMessages;
    
    if (currentChatSessionId && (!currentMessages || currentMessages.length === 0)) {
      messagesRestoredRef.current = true;
      import.meta.env.DEV && console.log(`[Sync] ♻️ Restoring messages for session ${currentChatSessionId}...`);
      useTutorStore.getState().restoreSessionFromServer(currentChatSessionId);
    }
  }, [user, chatSessionId]); // Added chatSessionId to deps
};
