import { useEffect, useRef } from 'react';
import useTutorStore from '../store/tutorStore';
import { useAuth } from '../context/AuthContext';

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
  const { 
    chatSessionId,
    topic, 
    canvasObjects, 
    doubtHistory,
    // Tool settings
    drawColor, drawWidth,
    textToolSize, noteToolSize,
    noteColor, noteSize,
    layoutView, gridType, gridSize, showGrid
  } = useTutorStore();

  const syncTimerRef = useRef(null);

  useEffect(() => {
    // ONLY sync for real users, skipping guests
    if (!user || user.isGuest || !token) return;

    // CRITICAL: Only sync if we have the real MongoDB ID from the socket
    if (!chatSessionId) return;

    // Throttle saves to every 5 seconds to reduce DB load
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    // Only sync if there is actual content to save
    const hasMessages = (doubtHistory && doubtHistory.length > 0) || (chatMessages && chatMessages.length > 0);
    const hasCanvas = canvasObjects && canvasObjects.length > 0;

    if (!hasMessages && !hasCanvas) return;

    syncTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          sessionId: chatSessionId,  // Use real MongoDB _id
          title: topic || 'New Learning Session',
          canvasState: canvasObjects || [],
          preferences: {
            drawColor, drawWidth,
            textToolSize, noteToolSize,
            noteColor, noteSize,
            layoutView, gridType, gridSize, showGrid
          }
        };

        // Include client-side display messages if available
        if (chatMessages && chatMessages.length > 0) {
          payload.messages = chatMessages;
        }

        const response = await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.warn('[Sync] Failed to sync session to cloud.');
        } else {
          console.log('[Sync] Session synced to MongoDB via chatSessionId:', chatSessionId);
        }
      } catch (err) {
        console.error('[Sync] Network error during session sync:', err);
      }
    }, (parseInt(localStorage.getItem('tb-auto-save')) || 5) * 1000);

    return () => clearTimeout(syncTimerRef.current);
  }, [chatSessionId, topic, canvasObjects?.length, doubtHistory?.length, chatMessages?.length, user, token]);
};
