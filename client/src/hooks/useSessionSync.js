import { useEffect, useRef } from 'react';
import useTutorStore from '../store/tutorStore';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * useSessionSync
 * 
 * Synchronizes the active session (canvas + chat) with MongoDB for authenticated users.
 * Guest users continue to rely solely on localStorage persistence.
 */
export const useSessionSync = () => {
  const { user, token } = useAuth();
  const { 
    sessionId, 
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

    // Throttle saves to every 5 seconds to reduce DB load
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    // CRITICAL: Only sync if there is actual content to save.
    // This prevents cluttering the database with empty "New Learning Session" placeholder chats.
    const hasMessages = doubtHistory && doubtHistory.length > 0;
    const hasCanvas = canvasObjects && canvasObjects.length > 0;

    if (!hasMessages && !hasCanvas) {
      return;
    }

    syncTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId,
            title: topic || 'New Learning Session',
            messages: doubtHistory || [],
            canvasState: canvasObjects || [],
            preferences: {
              drawColor, drawWidth,
              textToolSize, noteToolSize,
              noteColor, noteSize,
              layoutView, gridType, gridSize, showGrid
            }
          })
        });

        if (!response.ok) {
          console.warn('[Sync] Failed to sync session to cloud.');
        } else {
          const data = await response.json();
          // If the server generated a real ID and we are using a temporary one, 
          // we could update the store here, but tutorStore.setSessionId already handles mapping.
          console.log('[Sync] Session saved to MongoDB');
        }
      } catch (err) {
        console.error('[Sync] Network error during session sync:', err);
      }
    }, 5000);

    return () => clearTimeout(syncTimerRef.current);
  }, [sessionId, topic, canvasObjects.length, doubtHistory.length, user, token]);
};
