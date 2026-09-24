import { useState, useRef, useCallback, useEffect } from 'react';
import API from '../services/api';
import useTutorStore from '../store/tutorStore';

export function useSessionHistory({ isAuthenticated, isGuest, token, user, authLoading }) {
  const [historyFetched, setHistoryFetched] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false, loading: false });
  
  const fetchLockRef = useRef(false);
  const fetchAbortControllerRef = useRef(null);
  const hasHydratedActive = useRef(false);

  const fetchCloudSessions = useCallback(async (pageNum = 1) => {
    const effectiveToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('tb-token') : null);
    if (!isAuthenticated || isGuest || !effectiveToken) return;
    
    // Prevent overlapping requests for the same page
    if (fetchLockRef.current && pageNum === 1) {
      import.meta.env.DEV && console.log('[useSessionHistory] Session fetch already in progress, skipping duplicate call.');
      return;
    }

    // Abort any existing request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;
    fetchLockRef.current = true;
    
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    setPagination(prev => ({ ...prev, loading: true }));
    try {
      const response = await API.get(`/api/sessions?page=${pageNum}&limit=15`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = response.data;
        const { sessions, pagination: pg } = data;
        
        if (!sessions) return;

        const cloudSessions = sessions
          .filter(s => (s.messages?.some(m => m.role === 'user') || s.canvasState?.length > 0))
          .map(s => ({
            id: s._id,
            title: s.title || 'Saved Session',
            date: new Date(s.updatedAt || s.lastUpdated || s.createdAt).toLocaleDateString(),
            updatedAt: new Date(s.updatedAt || s.lastUpdated || s.createdAt).getTime(),
            agent: 'TutorBoard AI',
            messages: s.messages || [],
            canvasState: s.canvasState || [],
            canvasSteps: s.canvasSteps || [],
            pinnedNotes: s.pinnedNotes || [],
            preferences: s.preferences || {},
            chatSessionId: s._id
          }));

        useTutorStore.getState().setChatHistory(prev => {
          let merged;
          if (pageNum === 1) {
            // MongoDB is the source of truth on fresh login/refresh.
            // Only preserve truly local in-progress sessions that are CURRENTLY active.
            // Old ghost 'temp-' sessions in localStorage cause permanent UI duplicates.
            const cloudIds = new Set(cloudSessions.map(s => s.id));
            
            const localOnlySessions = prev.filter(s => {
              if (!s.id || cloudIds.has(s.id)) return false;
              const isTemp = s.id.startsWith('temp-') || s.id.startsWith('local-') || s.id.startsWith('session-');
              if (!isTemp) return false;
              
              // Keep temporary sessions unless explicitly deleted. Don't aggressively prune after 30s.
              return true;
            });
            
            merged = [...localOnlySessions, ...cloudSessions];
          } else {
            // For subsequent pages, append without duplicates.
            const existingIds = new Set(prev.map(s => s.id));
            merged = [...prev, ...cloudSessions.filter(s => !existingIds.has(s.id))];
          }

          // FINAL DE-DUPLICATION: Ensure no session ID appears twice
          const finalIds = new Set();
          return merged.filter(s => {
            const sid = s.id || s.chatSessionId;
            if (!sid || finalIds.has(sid)) return false;
            finalIds.add(sid);
            return true;
          });
        });

        setPagination({
          page: pg.page,
          hasMore: pg.hasMore,
          loading: false
        });
      } else {
        console.warn(`[useSessionHistory] Cloud fetch failed with status: ${response.status}`);
        setPagination(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        import.meta.env.DEV && console.log('[useSessionHistory] Session fetch aborted or timed out.');
      } else {
        console.error('Failed to restore cloud sessions:', err);
      }
      setPagination(prev => ({ ...prev, loading: false }));
    } finally {
      fetchLockRef.current = false;
      if (fetchAbortControllerRef.current === controller) {
        fetchAbortControllerRef.current = null;
      }
      setHistoryFetched(true);
    }
  }, [isAuthenticated, token, isGuest]);

  // Initial load — fetch all sessions from MongoDB (for users)
  useEffect(() => {
    if (user && !isGuest) {
      fetchCloudSessions(1);
    } else {
      setHistoryFetched(true);
    }
  }, [fetchCloudSessions, user, isGuest]);

  // Centralized Hydration (SEC-22): Restore active chat on mount/auth-resolution
  useEffect(() => {
    if (authLoading) return;
    if (hasHydratedActive.current) return;
    
    // We check the store directly for the activeChatId since we don't pass it in to avoid unnecessary re-renders.
    const activeChatId = useTutorStore.getState().sessionId || useTutorStore.getState().chatSessionId;
    
    if (activeChatId) {
      hasHydratedActive.current = true;
      return;
    }

    useTutorStore.getState().hydrateSession(user).then(() => {
      hasHydratedActive.current = true;
    });
  }, [authLoading, user]);

  return {
    historyFetched,
    pagination,
    fetchCloudSessions
  };
}
