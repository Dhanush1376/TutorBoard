import { useState, useCallback, useEffect, useRef } from 'react';
import API from '../services/api';
import useTutorStore from '../store/tutorStore';

export function useSessionPersistence({ 
  activeChatId, 
  activeSession, 
  isAuthenticated, 
  user, 
  token,
  generateCleanTitle
}) {
  const [isDbOffline, setIsDbOffline] = useState(false);
  const lastIdRef = useRef(activeChatId);

  // ── ID SYNC: Promote temp ID to real Mongo ID in sidebar ──
  useEffect(() => {
    const oldId = lastIdRef.current;
    const newId = activeChatId;
    
    if (oldId && newId && oldId !== newId && (oldId.startsWith('temp-') || oldId.startsWith('local-') || oldId.startsWith('session-'))) {
      import.meta.env.DEV && console.log(`[useSessionPersistence:Sync] Promoting sidebar session via store: ${oldId} -> ${newId}`);
      useTutorStore.getState().promoteChatHistoryId(oldId, newId);
    }
    lastIdRef.current = newId;
  }, [activeChatId]);

  // ── Persistent Cloud Sync (Immediate Actions) ──
  const saveCurrentSession = useCallback(async (updatedMessages = null, overrideSessionId = null, overrideTitle = null) => {
    const targetSessionId = overrideSessionId || activeChatId;
    const storeState = useTutorStore.getState();
    
    // RC-2 FIX: Don't save while streaming — messages are being mutated in real-time
    if (storeState.isStreaming || storeState.streamingMessageId) {
      import.meta.env.DEV && console.log('[Persistence] ⏸ Deferred save — stream active');
      return null;
    }
    
    const resolvedMessages = updatedMessages || (storeState.conversationMessages.length > 0 ? storeState.conversationMessages : activeSession?.messages) || [];

    // Guard: Don't save empty sessions (no user messages and no manual drawings)
    const hasUserMessages = resolvedMessages && resolvedMessages.some(m => m.role === 'user');
    const hasManualDrawings = storeState.canvasObjects && storeState.canvasObjects.some(o => o.id?.startsWith('manual-'));
    const hasUserContent = hasUserMessages || hasManualDrawings;
    
    if (!hasUserContent) return null;

    const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session';
    const existingTitle = activeSession?.title || storeState.timeline?.title;
    
    const derivedTitle = isGeneric(existingTitle) 
      ? (updatedMessages && updatedMessages.find(m => m.role === 'user')?.content) 
      : existingTitle;

    const payload = {
      sessionId: targetSessionId,
      title: overrideTitle || (isGeneric(derivedTitle) ? generateCleanTitle(derivedTitle) : derivedTitle) || 'Untitled Session',
      messages: resolvedMessages,
      canvasState: storeState.canvasObjects || [],
      canvasSteps: storeState.canvasSteps || [],
      pinnedNotes: storeState.pinnedNotes || [],
      preferences: {
        drawColor: storeState.drawColor, 
        drawWidth: storeState.drawWidth,
        textToolSize: storeState.textToolSize, 
        noteToolSize: storeState.noteToolSize,
        noteColor: storeState.noteColor, 
        noteSize: storeState.noteSize,
        layoutView: storeState.layoutView, 
        gridType: storeState.gridType, 
        gridSize: storeState.gridSize, 
        showGrid: storeState.showGrid
      },
      updatedAt: Date.now()
    };

    // ── GUEST PERSISTENCE (LocalStorage fallback + MongoDB) ──
    if (user?.isGuest) {
      import.meta.env.DEV && console.log(`[Persistence:Guest] 🏠 Updating local history: ${targetSessionId}`);
      storeState.setChatHistory(prev => {
        // Promotion-aware index finding: Match the ID, or find a temp ID that this real ID is replacing
        const idx = prev.findIndex(s => 
          s.id === targetSessionId || 
          (s.id?.startsWith('temp-') && targetSessionId && !targetSessionId.startsWith('temp-'))
        );
        
        let next;
        if (idx === -1) {
          next = [payload, ...prev];
        } else {
          next = [...prev];
          next[idx] = { ...next[idx], ...payload, id: targetSessionId }; // Ensure ID is updated if promoted
        }
        
        // Final de-duplication safety
        const finalIds = new Set();
        return next.filter(s => {
          if (!s.id || finalIds.has(s.id)) return false;
          finalIds.add(s.id);
          return true;
        });
      });
      // Guest Draft Mode: Never store guest sessions in the cloud database
      return targetSessionId;
    }

    if (!isAuthenticated) return null;
    
    import.meta.env.DEV && console.log(`[Persistence] 💾 Saving session to cloud: ${targetSessionId}`);
    
    try {
      const res = await API.post('/api/sessions', payload);
      
      if (res.status === 200 || res.status === 201) {
        const saved = res.data;
        setIsDbOffline(false);
        // Always keep the store's chatSessionId in sync with the real Mongo ID.
        // This is the key link that lets useSessionSync and startSession target
        // the correct document on subsequent saves and socket events.
        if (saved._id) {
          storeState.setChatSessionId(saved._id);
        }

        storeState.setChatHistory(prev => {
          // Robust promotion-aware deduplication
          // We only filter out the specific IDs we are promoting/saving. We do NOT blanket-delete other temp sessions!
          const otherSessions = prev.filter(s => 
            s.id !== targetSessionId && 
            s.id !== saved._id
          );
          
          const updatedSession = { ...payload, id: saved._id || targetSessionId, chatSessionId: saved._id };
          return [updatedSession, ...otherSessions];
        });

        // If we were using a local UUID, swap it for the permanent Mongo ID everywhere.
        if (saved._id && saved._id !== targetSessionId) {
          import.meta.env.DEV && console.log(`[Persistence] 🔗 Adopting permanent Mongo ID: ${saved._id}`);
          storeState.setSessionId(saved._id);
          return saved._id;
        }
        return saved._id || targetSessionId;
      } else {
        const errData = res.data || {};
        if (errData.code === 'DB_OFFLINE') setIsDbOffline(true);
        // SF-3 FIX: Notify user when save returns an unexpected status
        console.warn(`[Persistence] ⚠️ Cloud save returned status ${res.status}`);
        storeState.showToast({
          message: 'Your session could not be saved to the cloud. Changes are saved locally.',
          type: 'warning',
          duration: 5000
        });
      }
    } catch (err) {
      console.error('[Persistence] ❌ Immediate save failed:', err);
      // SF-3 FIX: Surface save failures to the user instead of silently swallowing
      setIsDbOffline(true);
      storeState.showToast({
        message: 'Cloud save failed — your work is preserved locally. We\'ll retry on your next action.',
        type: 'error',
        duration: 6000
      });
    }
    return null;
  }, [activeChatId, activeSession, isAuthenticated, user, token, generateCleanTitle]);

  return {
    saveCurrentSession,
    isDbOffline,
    setIsDbOffline
  };
}
