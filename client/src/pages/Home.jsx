import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';
import LeftPanel from '../components/layout/LeftPanel';
import useTutorStore, { STATES as STORE_STATES, CANVAS_MODE } from '../store/tutorStore';
import useTeachingMachine, { STATES } from '../hooks/useTeachingMachine';
import TeachingSession from '../components/teaching/TeachingSession';
import useStreamingResponse from '../hooks/useStreamingResponse';

import { BASE_URL as API_URL } from '../services/api';

// Canvas & Teaching Overlays
import InfiniteCanvas from '../components/canvas/InfiniteCanvas';
import AgentCanvasRenderer from '../components/canvas/AgentCanvasRenderer';
import InteractiveCanvasLayer from '../components/canvas/InteractiveCanvasLayer';
import CanvasControls from '../components/canvas/CanvasControls';
import CanvasMinimap from '../components/canvas/CanvasMinimap';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';
import QuickAskOverlay from '../components/chat/QuickAskOverlay';
import { useAuth } from '../context/AuthContext';
import { useSessionSync } from '../hooks/useSessionSync';

import { 
  Volume2, VolumeX, Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, Wifi, WifiOff, Loader, Key, Cpu
} from 'lucide-react';





const Home = ({ isDark }) => {
  const { isAuthenticated, token, user, loading: authLoading, apiPrefs: globalApiPrefs, logout, isAuthResolved } = useAuth();
  const machine = useTeachingMachine(isAuthResolved);
  const {
    machineState, isConnected,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStep, currentStepIndex, totalSteps,
    canvasObjects, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory,
    error,
    isPlaying,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, finish, setSpeed, endSession,
  } = machine;

  const {
    canvasMode, canvasTransform, showMinimap, voiceEnabled, playbackSpeed,
    setCanvasMode, setCanvasTransform, toggleMinimap, toggleVoice,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, toggleDoubtThread, showDoubtThread,
    selectedAgent, setSelectedAgent, isSidebarOpen, setSidebarOpen,
    setCanvasSnapshot, greetingMessage, layoutView, addNoteToCanvas,
    chatInputText, setChatInputText, pinnedNotes, toggleSidebarPosition, showAlert,
    activeSnapshotId, setActiveSnapshotId, setTimeline,
    // Manual interaction states
    activeTool, setActiveTool, addCanvasObjects,
    drawColor, noteColor, noteSize, notePinned, noteToolSize,
    textToolSize, shapeStrokeStyle
  } = useTutorStore();


  const isGuest = !!user?.isGuest;
  if (import.meta.env.DEV) {
    console.log('[Home] Dashboard mounted. user:', user?.email, 'isGuest:', isGuest);
  }
  
  // Use global prefs but map to local variable for easier refactor
  const activeApiPrefs = globalApiPrefs;

  const [chatHistory, setChatHistory] = useState([]);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false, loading: false });
  const [isDbOffline, setIsDbOffline] = useState(false);
  const [isQuickAskOpen, setIsQuickAskOpen] = useState(false);

  const fetchCloudSessions = useCallback(async (pageNum = 1) => {
    if (!isAuthenticated || user?.isGuest || !token) return;
    
    setPagination(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_URL}/api/sessions?page=${pageNum}&limit=15`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
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

        setChatHistory(prev => {
          if (pageNum === 1) {
            // MongoDB is the source of truth on fresh login/refresh.
            // Only preserve truly local in-progress sessions that have not yet been persisted.
            const cloudIds = new Set(cloudSessions.map(s => s.id));
            const localOnlySessions = prev.filter(
              s => s.id && s.id.startsWith('session-') && !cloudIds.has(s.id)
            );
            return [...localOnlySessions, ...cloudSessions];
          }
          // For subsequent pages, append without duplicates.
          const existingIds = new Set(prev.map(s => s.id));
          return [...prev, ...cloudSessions.filter(s => !existingIds.has(s.id))];
        });

        setPagination({
          page: pg.page,
          hasMore: pg.hasMore,
          loading: false
        });
      }
    } catch (err) {
      console.error('Failed to restore cloud sessions:', err);
      setPagination(prev => ({ ...prev, loading: false }));
    } finally {
      setHistoryFetched(true);
    }
  }, [isAuthenticated, token, user?.isGuest]);

  const loadLocalGuestHistory = useCallback(() => {
    try {
      const local = localStorage.getItem('tutorboard-guest-history');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          setChatHistory(parsed);
          console.log('[Home] 🏠 Loaded guest local history:', parsed.length);
        }
      }
    } catch (e) {
      console.warn('[Home] Failed to load guest history:', e);
    } finally {
      setHistoryFetched(true);
    }
  }, []);

  // Initial load — fetch all sessions from MongoDB (for users) or LocalStorage (for guests)
  useEffect(() => {
    if (user?.isGuest) {
      loadLocalGuestHistory();
    } else {
      fetchCloudSessions(1);
    }
  }, [fetchCloudSessions, loadLocalGuestHistory, isAuthenticated, user]);

  const { sessionId: machineSessionId, setSessionId: storeSetSessionId } = useTutorStore();
  
  // Use machine.sessionId as the single source of truth for the local chat pointer
  const activeChatId = machineSessionId;
  const setActiveChatId = storeSetSessionId;

  // ─── Leave Chat / Close Snapshot Logic ───
  useEffect(() => {
    // If sidebar is closed and we were viewing a snapshot, return to main lesson
    if (!isSidebarOpen && activeSnapshotId) {
      console.log('[Home] Leaving chat, closing snapshot animation...');
      setActiveSnapshotId(null);
      
      // Restore main lesson state from history if available
      const session = chatHistory.find(s => s.id === activeChatId);
      if (session && session.canvasState) {
        setCanvasSnapshot({
          canvasObjects: session.canvasState,
          canvasSteps: session.canvasSteps || [],
          totalSteps: session.canvasSteps?.length || 0,
          currentStepIndex: session.currentStepIndex || 0
        });
      }
    }
  }, [isSidebarOpen, activeSnapshotId, chatHistory, activeChatId, setActiveSnapshotId, setCanvasSnapshot]);
  
  // Session persistence hardening: Remove local history mirror
  // We now rely strictly on cloud fetch and sync.

  // Persist active chat ID
  useEffect(() => {
    if (activeChatId && isAuthenticated && !user?.isGuest) {
      localStorage.setItem('tutorboard-active-chat', activeChatId);
    }
  }, [activeChatId, isAuthenticated, user]);

  // Restore Active Chat on Mount (fixes "chat disappearing on refresh")
  const hasHydratedActive = useRef(false);
  useEffect(() => {
    // Wait for auth to finish deciding if we are guest or user
    if (authLoading) return;
    if (hasHydratedActive.current) return;
    
    // If we already have an active chat (e.g. from store sync), we are done with hydration
    if (activeChatId) {
      hasHydratedActive.current = true;
      return;
    }

    const savedActiveId = localStorage.getItem('tutorboard-active-chat');
    
    // Only attempt hydration if we actually have history loaded (from local or cloud)
    if (!activeChatId && savedActiveId && chatHistory.length > 0) {
      const session = chatHistory.find(s => s.id === savedActiveId);
      if (session) {
        console.log('[Home] Hydrating active chat:', savedActiveId);
        hasHydratedActive.current = true;
        setActiveChatId(savedActiveId);
        
        // Restore canvas snapshot if we have one
        if (session.canvasState && session.canvasState.length > 0) {
          useTutorStore.getState().setCanvasSnapshot({ 
            canvasObjects: session.canvasState, 
            canvasSteps: [], 
            totalSteps: 0 
          });
        }
      }
    }
  }, [activeChatId, chatHistory, setActiveChatId, authLoading]);

  // ── Sync Doubt Responses to Chat ──
  const lastDoubtId = useRef(null);
  useEffect(() => {
    if (doubtHistory.length === 0) return;
    const latest = doubtHistory[doubtHistory.length - 1];
    
    // Only append if it's a new doubt response we haven't logged yet
    if (latest.answer && latest.id !== lastDoubtId.current) {
      lastDoubtId.current = latest.id;
      
      const assistantMessage = { 
        id: getMsgId('doubt-ans'), 
        role: 'assistant', 
        content: latest.answer,
        timestamp: new Date().toISOString(),
        hasCanvas: latest.hasVisuals,
        canvasSnapshot: latest.hasVisuals ? { 
          canvasObjects, 
          canvasSteps, 
          totalSteps, 
          renderer: useTutorStore.getState().renderer,
          title: timeline?.title || 'Doubt Response'
        } : null
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        // Avoid duplicates by content and role
        if (next[idx].messages.some(m => m.role === 'assistant' && m.content === assistantMessage.content)) return prev;
        next[idx] = { ...next[idx], messages: [...next[idx].messages, assistantMessage] }; 
        
        // ── PERSISTENCE: Save AI response IMMEDIATELY ──
        saveCurrentSession(next[idx].messages);
        
        return next;
      });
    }
  }, [doubtHistory, activeChatId]);

  // ── Sync New Session Start to Chat ──
  const lastTimelineId = useRef(null);
  useEffect(() => {
    // When a timeline is fully received for a new session, drop an introductory message into the chat
    if (timeline && timeline.title && timeline.title !== lastTimelineId.current && timeline.title !== 'Lesson Snapshot') {
      lastTimelineId.current = timeline.title;
      
      const assistantMessage = { 
         id: getMsgId('session-ans'), 
         role: 'assistant', 
         content: `I've prepared a visual learning canvas for you on **${timeline.title}**. Dive in whenever you're ready!`,
         timestamp: new Date().toISOString(),
         hasCanvas: true,
         canvasSnapshot: { 
           canvasObjects, 
           canvasSteps, 
           totalSteps, 
           renderer: timeline.renderer,
           title: timeline.title 
         } 
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        // Only append if it doesn't already exist (deduplicate by content)
        if (next[idx].messages.some(m => m.role === 'assistant' && m.content === assistantMessage.content)) return prev;
        next[idx] = { ...next[idx], messages: [...next[idx].messages, assistantMessage] }; 
        
        // ── PERSISTENCE: Save AI timeline response IMMEDIATELY ──
        saveCurrentSession(next[idx].messages);
        
        return next;
      });
    }
  }, [timeline, activeChatId]);

  // ── Sync Greeting (Text-Only Default) to Chat ──
  const lastGreetingId = useRef(null);
  useEffect(() => {
    if (greetingMessage && greetingMessage !== lastGreetingId.current) {
      lastGreetingId.current = greetingMessage;
      
      const assistantMessage = { 
         id: getMsgId('greeting-ans'), 
         role: 'assistant', 
         content: greetingMessage,
         timestamp: new Date().toISOString(),
         hasCanvas: false 
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        if (next[idx].messages.some(m => m.role === 'assistant' && m.content === assistantMessage.content)) return prev;
        next[idx] = { ...next[idx], messages: [...next[idx].messages, assistantMessage] }; 
        
        // ── PERSISTENCE: Save greeting persistence IMMEDIATELY ──
        saveCurrentSession(next[idx].messages);

        return next;
      });

      // Enforce Canvas-Only UX: Do not pull focus to chat
      // setSidebarOpen(true);
    }
  }, [greetingMessage, activeChatId]);

  // ── AI Automation: Handle 'prompt' URL param ──
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (hasAutoStarted.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const urlPrompt = params.get('prompt');
    
    if (urlPrompt) {
      console.log('[Home] Auto-start detected for prompt:', urlPrompt);
      hasAutoStarted.current = true;
      
      // Give the machine a moment to connect if it hasn't yet
      const timer = setTimeout(() => {
        setPrompt(urlPrompt);
        // We can't call handleSubmit directly because it's defined after many state variables,
        // so we'll just replicate the startup logic here or wait for prompt state to settle.
        // Better: trigger startSession directly since we are already in Home.
        startSession(urlPrompt, urlPrompt, 'explain');
        // Clear param so it doesn't re-start on refresh if navigating back
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [startSession]);

  // ── Sync Errors to Chat ──
  const lastErrorRef = useRef(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      
      const errorMessage = { 
         id: getMsgId('error-msg'), 
         role: 'assistant', 
         content: `⚠️ ${error}`,
         timestamp: new Date().toISOString(),
         hasCanvas: false 
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        if (next[idx].messages.some(m => m.id === errorMessage.id)) return prev;
        next[idx] = { ...next[idx], messages: [...next[idx].messages, errorMessage] };
        return next;
      });
    }
  }, [error, activeChatId]);

  const [activeView, setActiveView] = useState('history');
  const [prompt, setPrompt] = useState('');
  const [activeMode, setActiveMode] = useState(null);

  const canvasRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const msgIdCounter = useRef(0);
  const getMsgId = (suffix = '') => `msg-${Date.now()}-${++msgIdCounter.current}${suffix ? `-${suffix}` : ''}`;

  // ── Conversation Store Bindings ──
  const {
    conversationMessages, isStreaming, isWaitingForAI,
    addUserMessage, finishStreaming, abortStreaming,
    setConversationMessages, clearConversation,
    applyEdit, removeLastAssistantMessage,
    deleteMessageById, setMessageFeedback,
    setWaitingForAI, setLastAIError, conversationTopic,
  } = useTutorStore();
  const { startStreaming: streamResponse, stopStreaming } = useStreamingResponse();

  const activeSession = chatHistory.find(c => c.id === activeChatId) || null;
  // Use conversationMessages as the primary source for the chat UI
  const messages = conversationMessages.length > 0 ? conversationMessages : (activeSession?.messages || []);

  // ── Canvas-First Session Creation ──
  // If the user draws on the canvas without starting a chat, we create a "Canvas Session"
  // so that toolbar drawings are always persisted.
  const canvasSessionCreatedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || user?.isGuest || !historyFetched) return; 
    if (canvasObjects?.length === 0) return;
    if (activeChatId) return; // Already in a session
    if (canvasSessionCreatedRef.current) return; // Already created one

    canvasSessionCreatedRef.current = true;
    const localId = `session-${Date.now()}`;
    const newSession = {
      id: localId,
      title: 'Canvas Session',
      date: new Date().toLocaleDateString(),
      updatedAt: Date.now(),
      agent: 'TutorBoard AI',
      messages: [],
      canvasState: [],
      canvasSteps: [],
      pinnedNotes: [],
    };
    setChatHistory(prev => [newSession, ...prev]);
    setActiveChatId(localId);
    console.log('[Home] 🎨 Auto-created Canvas Session for standalone drawing.');
  }, [canvasObjects?.length, activeChatId, isAuthenticated, user]);

  // ── Persistent Cloud Sync (Immediate Actions) ──
  // Returns the canonical MongoDB session ID after save (may differ from activeChatId if it was a local temp ID).
  const saveCurrentSession = useCallback(async (updatedMessages = messages, overrideSessionId = null, overrideTitle = null) => {
    const targetSessionId = overrideSessionId || activeChatId;
    
    // Guard: Don't save empty sessions (no user messages and no manual drawings)
    const hasUserMessages = updatedMessages && updatedMessages.some(m => m.role === 'user');
    const hasManualDrawings = canvasObjects && canvasObjects.some(o => o.id?.startsWith('manual-'));
    const hasUserContent = hasUserMessages || hasManualDrawings;
    
    if (!hasUserContent) return null;

    const payload = {
      id: targetSessionId,
      title: overrideTitle || activeSession?.title || timeline?.title || (updatedMessages && updatedMessages.find(m => m.role === 'user')?.content?.substring(0, 40)) || 'Untitled Session',
      messages: updatedMessages,
      canvasState: canvasObjects || [],
      canvasSteps: canvasSteps || [],
      pinnedNotes: pinnedNotes || [],
      preferences: {
        drawColor, drawWidth,
        textToolSize, noteToolSize,
        noteColor, noteSize,
        layoutView, gridType, gridSize, showGrid
      },
      updatedAt: Date.now()
    };

    // ── GUEST PERSISTENCE (LocalStorage) ──
    if (user?.isGuest) {
      console.log(`[Persistence:Guest] 🏠 Saving to local storage: ${targetSessionId}`);
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === targetSessionId);
        let next;
        if (idx === -1) {
          next = [payload, ...prev];
        } else {
          next = [...prev];
          next[idx] = { ...next[idx], ...payload };
        }
        // Prune to 10 sessions to prevent storage bloating
        const pruned = next.slice(0, 10);
        localStorage.setItem('tutorboard-guest-history', JSON.stringify(pruned));
        return next;
      });
      return targetSessionId;
    }

    if (!isAuthenticated || !token) return null;
    
    console.log(`[Persistence] 💾 Saving session to cloud: ${targetSessionId}`);
    
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const saved = await res.json();
        setIsDbOffline(false);
        // Always keep the store's chatSessionId in sync with the real Mongo ID.
        // This is the key link that lets useSessionSync and startSession target
        // the correct document on subsequent saves and socket events.
        if (saved._id) {
          useTutorStore.getState().setChatSessionId(saved._id);
        }

        // ── SYNC LOCAL CACHE: Update the chatHistory entry with full state ──
        setChatHistory(prev => prev.map(s => {
          if (s.id === targetSessionId || s.id === saved._id) {
            return {
              ...s,
              id: saved._id || s.id,
              chatSessionId: saved._id || s.id,
              canvasState: canvasObjects || [],
              messages: updatedMessages,
              pinnedNotes: pinnedNotes || [],
              updatedAt: Date.now()
            };
          }
          return s;
        }));

        // If we were using a local UUID, swap it for the permanent Mongo ID everywhere.
        if (saved._id && saved._id !== targetSessionId) {
          console.log(`[Persistence] 🔗 Adopting permanent Mongo ID: ${saved._id}`);
          setActiveChatId(saved._id);
          return saved._id;
        }
        return saved._id || targetSessionId;
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.code === 'DB_OFFLINE') setIsDbOffline(true);
      }
    } catch (err) {
      console.error('[Persistence] ❌ Immediate save failed:', err);
    }
    return null;
  }, [activeChatId, activeSession, timeline, canvasObjects, canvasSteps, pinnedNotes, isAuthenticated, user, token, messages]);


  // ── Passive Sync (Canvas/Prefs Debounce) ──
  useSessionSync(messages);

  // ── Active Canvas Persistence: Save immediately after manual drawing ──
  const canvasSyncTimer = useRef(null);
  useEffect(() => {
    const hasManualObjects = canvasObjects?.some(o => o.id?.startsWith('manual-'));
    if (!hasManualObjects) return;
    if (!isAuthenticated || user?.isGuest) return;

    // Debounce 2s after last stroke
    if (canvasSyncTimer.current) clearTimeout(canvasSyncTimer.current);
    canvasSyncTimer.current = setTimeout(() => {
      console.log('[Home] 🖊️ Manual drawing detected — syncing canvas to DB...');
      saveCurrentSession(messages);
    }, 2000);

    return () => clearTimeout(canvasSyncTimer.current);
  }, [canvasObjects, isAuthenticated, user]);

  // ─── Logic ───
  const { toggleSidebar } = useTutorStore();

  // ── Auto-Centering Logic ──
  const isAutoFollow = useRef(true); 
  const lastCenteredStep = useRef(-1);
  useEffect(() => {
    if (!canvasObjects || canvasObjects.length === 0) return;
    if (currentStepIndex === lastCenteredStep.current) return;
    if (!isAutoFollow.current) return; // User manually panned - pause auto-center
    
    const step = canvasSteps[currentStepIndex];
    if (!step) return;

    const ids = new Set(step.objectIds || []);
    const objs = canvasObjects.filter(o => ids.has(o.id));
    
    // Canvas dimensions for coordinate conversion (elements use 0-1 normalized coords)
    const CW = 800, CH = 600;
    
    if (objs.length > 0) {
      // Calculate Bounding Box — convert normalized (0-1) coords to pixel coords
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objs.forEach(o => {
        // Elements store x/y as normalized 0-1 values, convert to pixel space
        const rawX = safeNum(o.x || o.cx || o.x1, 0.5);
        const rawY = safeNum(o.y || o.cy || o.y1, 0.5);
        const x = (rawX <= 1 ? rawX * CW : rawX);
        const y = (rawY <= 1 ? rawY * CH : rawY);
        const w = safeNum(o.w || o.r || (o.x2 ? Math.abs(o.x2 - o.x1) : 0), 100);
        const h = safeNum(o.h || o.r || (o.y2 ? Math.abs(o.y2 - o.y1) : 0), 100);
        
        minX = Math.min(minX, x - w/2);
        maxX = Math.max(maxX, x + w/2);
        minY = Math.min(minY, y - h/2);
        maxY = Math.max(maxY, y + h/2);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Smoothly center
      setTimeout(() => {
        canvasRef.current?.centerOn(centerX, centerY, 0.85);
      }, 100);
    } else {
      // Fallback: center on default point
      canvasRef.current?.centerOn(400, 300, 1);
    }
    
    lastCenteredStep.current = currentStepIndex;
  }, [currentStepIndex, canvasObjects, canvasSteps]);

  const safeNum = (v, f) => { const n = parseFloat(v); return isNaN(n) ? f : n; };

  // Sidebar shortcut removed per user request

  const handleNewChat = () => { 
    useTutorStore.getState().triggerSync();
    useTutorStore.getState().setChatSessionId(null);
    clearConversation();
    setActiveChatId(null);
    setPrompt(''); 
    endSession(); 
    localStorage.removeItem('tutorboard-active-chat');
  };
  const handleSelectChat = async (id) => {
    setActiveChatId(id);
    setActiveView('chat');
    
    // 1. Immediate local restore (minimal snapshot)
    const localSession = chatHistory.find(s => s.id === id);
    if (localSession) {
      console.log(`[Home] Restoring local session: ${id} (${localSession.messages?.length || 0} messages)`);
      
      // Populate conversation slice with session messages
      if (localSession.messages?.length > 0) {
        setConversationMessages(localSession.messages);
      } else {
        clearConversation();
      }

      // Restore canvas state
      if (localSession.canvasState) {
        useTutorStore.getState().setCanvasSnapshot({ 
          canvasObjects: localSession.canvasState, 
          canvasSteps: localSession.steps || [], 
          totalSteps: localSession.steps?.length || 0 
        });
        useTutorStore.setState({ pinnedNotes: localSession.pinnedNotes || [] });
      }
      if (localSession.messages) {
        useTutorStore.setState({ doubtHistory: localSession.messages });
      }
      
      // Update store's session mapping
      if (localSession.chatSessionId) {
        useTutorStore.getState().setChatSessionId(localSession.chatSessionId);
      }
    }

    // 2. Full pedagogical restoration from Cloud (SEC-20)
    if (isAuthenticated && !user?.isGuest && id && !id.startsWith('session-')) {
      try {
        console.log(`[Home] 🔄 Fetching full pedagogical state for session ${id}...`);
        const res = await fetch(`${API_URL}/api/sessions/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const fullData = await res.json();
          if (fullData) {
            console.log(`[Home] ✅ Full state fetched. Restoring timeline (${fullData.steps?.length || 0} steps)...`);
            
            // Restore actual pedagogical timeline
            if (fullData.steps?.length > 0) {
              useTutorStore.getState().setTimeline({
                ...fullData,
                title: fullData.title || localSession?.title || 'Saved Session',
                timeline: fullData.steps,
                objects: fullData.canvasState
              });
            }

            // Restore complete chat history
            if (fullData.messages) {
              useTutorStore.setState({ doubtHistory: fullData.messages });
            }

            // Sync with local history so the sidebar/main preview is also updated
            setChatHistory(prev => prev.map(s => s.id === id ? {
              ...s,
              title: fullData.title,
              messages: fullData.messages,
              canvasState: fullData.canvasState,
              steps: fullData.steps,
              chatSessionId: fullData._id,
              updatedAt: new Date(fullData.updatedAt || fullData.lastUpdated || Date.now()).getTime()
            } : s));
            
            // Also ensure the manifest has the link
            const currentManifest = useTutorStore.getState().sessionManifest;
            if (currentManifest[id] && !currentManifest[id].chatSessionId) {
              useTutorStore.setState({
                 sessionManifest: {
                   ...currentManifest,
                   [id]: { ...currentManifest[id], chatSessionId: fullData._id }
                 }
              });
            }
          }
        }
      } catch (err) {
        console.error('[Home] Failed to fetch full session details:', err);
      }
    }
    
    // Restore preferences from local regardless
    if (localSession?.preferences) {
      const p = localSession.preferences;
      if (p.drawColor) useTutorStore.setState({ drawColor: p.drawColor });
      if (p.drawWidth) useTutorStore.setState({ drawWidth: p.drawWidth });
      if (p.textToolSize) useTutorStore.setState({ textToolSize: p.textToolSize });
      if (p.noteToolSize) useTutorStore.setState({ noteToolSize: p.noteToolSize });
      if (p.noteColor) useTutorStore.setState({ noteColor: p.noteColor });
      if (p.noteSize) useTutorStore.setState({ noteSize: p.noteSize });
      if (p.layoutView) useTutorStore.setState({ layoutView: p.layoutView });
      if (p.gridType) useTutorStore.setState({ gridType: p.gridType });
      if (typeof p.showGrid !== 'undefined') useTutorStore.setState({ showGrid: p.showGrid });
    }
  };
  const handleDeleteChat = (id) => {
    const { alertPrefs, showToast } = useTutorStore.getState();
    
    const executeDeletionChain = () => {
      const sessionToRestore = chatHistory.find(c => c.id === id);
      if (!sessionToRestore) return;

      // Optimistic local update
      setChatHistory(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        useTutorStore.getState().endSession();
      }

      let isUndone = false;
      
      // PERSISTENCE HARDENING: Immediate background flush for cloud sessions
      // We don't wait for the toast to finish before STARTING the request if it's a real cloud ID.
      // However, we'll use a shorter window for the Undo to be effective.
      const deleteTimer = setTimeout(async () => {
        if (isUndone) return;
        
        const dbId = sessionToRestore.chatSessionId || id;
        if (isAuthenticated && !isGuest && dbId && !dbId.startsWith('session-') && !dbId.startsWith('msg-')) {
          try {
            const res = await fetch(`${API_URL}/api/sessions/${dbId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              console.log(`[Home] ✅ Session ${id} permanently deleted from cloud.`);
            } else {
              const errData = await res.json().catch(() => ({}));
              console.error(`[Home] ❌ Cloud deletion failed: ${res.status}`, errData);
            }
          } catch (err) {
            console.error('[Home] Failed to finalize cloud deletion:', err);
          }
        }
      }, 4000); // 4s instead of 5.5s to be more responsive

      showToast({
        message: 'Learning session deleted',
        type: 'info',
        duration: 4000,
        onUndo: () => {
          isUndone = true;
          clearTimeout(deleteTimer);
          // Restore the session to the list
          setChatHistory(prev => {
            if (prev.some(s => s.id === id)) return prev;
            return [sessionToRestore, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          });
          console.log(`[Home] ↩️ Deletion undone for ${id}`);
        }
      });
    };

    if (alertPrefs['delete-session']) {
      executeDeletionChain();
      return;
    }

    showAlert({
      type: 'warning',
      title: 'Delete Session',
      message: 'Are you sure you want to permanently delete this learning session? This action cannot be undone.',
      confirmLabel: 'Delete Permanently',
      prefKey: 'delete-session',
      onConfirm: executeDeletionChain
    });
  };
  const handleRenameChat = async (id, newTitle) => {
    // Optimistic local update
    setChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    
    // Persistent cloud update
    if (isAuthenticated && !isGuest && id && !id.startsWith('msg-')) {
      try {
        await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId: id, title: newTitle })
        });
        console.log(`[Home] ✅ Session ${id} renamed to "${newTitle}" in cloud.`);
      } catch (err) {
        console.error('[Home] Failed to rename session in cloud:', err);
      }
    }
  };

  const handleOpenCanvas = (messageId) => {
    const session = chatHistory.find(s => s.id === activeChatId);
    if (session) {
      const msg = session.messages.find(m => m.id === messageId);
      if (msg && msg.canvasSnapshot) {
        // Restore full pedagogical context including renderer type and original title
        setCanvasSnapshot({
          ...msg.canvasSnapshot,
          currentStepIndex: 0 // Always start snapshot at first step
        });
        useTutorStore.getState().setActiveSnapshotId(messageId);
      }
    }
    // Reveal the canvas by collapsing the sidebar
    // setSidebarOpen(false); // USER_REQUEST: Do not close while generating/visualizing
  };

  // ── AI Chat Injection from Notes ──
  useEffect(() => {
    if (chatInputText) {
      setPrompt(chatInputText);
      setSidebarOpen(true);
      setActiveView('chat');
      setChatInputText('');
    }
  }, [chatInputText, setPrompt, setSidebarOpen, setActiveView, setChatInputText]);

  const handleSubmit = async (textOverride, fileData = null) => {
    if ((!prompt.trim() && !textOverride && !fileData) || isSubmittingRef.current) return;
    
    const userPrompt = textOverride || prompt.trim();
    setPrompt('');  // Clear input immediately
    setActiveView('chat');
    isSubmittingRef.current = true;

    // Guest Trial: Increment usage and block if exhausted
    if (isGuest) {
      const store = useTutorStore.getState();
      if (store.guestTrialStatus.isLimitReached) {
        isSubmittingRef.current = false;
        return;
      }
      store.incrementGuestUsage();
    }

    try {
      const workingSessionId = activeChatId || `session-${Date.now()}`;
      if (!activeChatId) setActiveChatId(workingSessionId);

      // ── 1. Add user message to conversation slice ──
      const userMsgId = addUserMessage(userPrompt);

      const sessionTitle = userPrompt.substring(0, 40) || 'Untitled Session';
      
      // Update local chat history for sidebar display
      const userMessage = { 
        id: userMsgId, role: 'user', content: userPrompt, 
        timestamp: new Date().toISOString(), file: fileData,
        metadata: { edited: false, regenerated: false, feedback: null },
      };
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === workingSessionId);
        if (idx === -1) return [{ id: workingSessionId, title: sessionTitle, messages: [userMessage] }, ...prev];
        const next = [...prev]; 
        next[idx] = { ...next[idx], messages: [...next[idx].messages, userMessage] }; 
        return next;
      });

      // ── 2. Determine if this is a "Deep Visual Dive" (uses existing teaching pipeline) ──
      if (activeMode === 'deep') {
        const history = chatHistory.find(s => s.id === workingSessionId)?.messages || [];
        const isFollowUp = activeChatId && history.length > 0;
        if (isFollowUp) {
          askDoubt(userPrompt, activeMode, fileData);
        } else {
          startSession(userPrompt, userPrompt, activeMode, fileData);
        }
        return;
      }

      // ── 3. Call the new Chat API for conversational responses ──
      const headers = { 'Content-Type': 'application/json' };
      if (token && token !== 'guest') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const chatPayload = {
        sessionId: /^[0-9a-fA-F]{24}$/.test(workingSessionId) ? workingSessionId : undefined,
        userMessage: userPrompt,
        mode: activeMode || 'quick',
        teachingContext: {
          currentTopic: conversationTopic || undefined,
          explanationMode: 'basic',
          learnerLevel: 'intermediate',
        },
      };

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(chatPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.fallbackMessage || 'AI request failed');
      }

      const data = await res.json();

      // ── 4. Stream the response with typing effect ──
      const assistantMsgId = data.assistantMessageId || getMsgId('assistant');
      streamResponse(data.response, assistantMsgId);

      // ── 5. Update sidebar history + persist to cloud ──
      if (data.sessionId && data.sessionId !== workingSessionId) {
        // Adopt the MongoDB session ID
        setActiveChatId(data.sessionId);
        setChatHistory(prev => prev.map(s => 
          s.id === workingSessionId ? { ...s, id: data.sessionId, chatSessionId: data.sessionId } : s
        ));
        useTutorStore.getState().setChatSessionId(data.sessionId);
      }

      // Background persist for sidebar sync
      if (isAuthenticated && !user?.isGuest && token) {
        saveCurrentSession(
          [...(useTutorStore.getState().conversationMessages), { id: assistantMsgId, role: 'assistant', content: data.response, timestamp: new Date().toISOString() }],
          data.sessionId || workingSessionId,
          sessionTitle
        ).catch(err => console.error('[Home] Background persistence failed:', err));
      }
    } catch (err) {
      console.error('[Home] handleSubmit failed:', err);
      setLastAIError(err.message);
      const store = useTutorStore.getState();
      store.finishStreaming(err.message.includes('unavailable') 
        ? "I'm having trouble connecting right now. Please try again in a moment."
        : `⚠️ ${err.message}`);
    } finally {
      setTimeout(() => { isSubmittingRef.current = false; }, 500);
    }
  };

  // ── Edit Message Handler (ChatGPT-style) ──
  const handleEditMessage = async (messageId, newContent) => {
    const updatedMessages = applyEdit(messageId, newContent);
    if (!updatedMessages) return;

    // If we have a persisted session, call the edit API
    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

    try {
      if (isMongoId && isAuthenticated && !user?.isGuest && token) {
        const res = await fetch(`${API_URL}/api/chat/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ sessionId: dbSessionId, messageId, newContent }),
        });
        if (res.ok) {
          const data = await res.json();
          const assistantMsgId = data.assistantMessageId || getMsgId('assistant');
          streamResponse(data.response, assistantMsgId);
          return;
        }
      }

      // Fallback: call the regular chat API with truncated context
      const headers = { 'Content-Type': 'application/json' };
      if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: isMongoId ? dbSessionId : undefined,
          userMessage: newContent,
          mode: activeMode || 'quick',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        streamResponse(data.response, data.assistantMessageId || getMsgId('assistant'));
      }
    } catch (err) {
      console.error('[Home] Edit failed:', err);
      setLastAIError(err.message);
    }
  };

  // ── Regenerate Handler ──
  const handleRegenerateMessage = async () => {
    removeLastAssistantMessage();

    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

    try {
      if (isMongoId && isAuthenticated && !user?.isGuest && token) {
        const res = await fetch(`${API_URL}/api/chat/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ sessionId: dbSessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          streamResponse(data.response, data.assistantMessageId || getMsgId('assistant'));
          return;
        }
      }

      // Fallback: re-send last user message
      const lastUserMsg = useTutorStore.getState().conversationMessages
        .filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        const headers = { 'Content-Type': 'application/json' };
        if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/api/chat`, {
          method: 'POST', headers,
          body: JSON.stringify({ userMessage: lastUserMsg.content, mode: activeMode || 'quick' }),
        });
        if (res.ok) {
          const data = await res.json();
          streamResponse(data.response, data.assistantMessageId || getMsgId('assistant'));
        }
      }
    } catch (err) {
      console.error('[Home] Regenerate failed:', err);
      setLastAIError(err.message);
    }
  };

  // ── Delete Message Handler ──
  const handleDeleteMessage = async (messageId) => {
    deleteMessageById(messageId);
    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');
    if (isMongoId && isAuthenticated && !user?.isGuest && token) {
      fetch(`${API_URL}/api/chat/message`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sessionId: dbSessionId, messageId }),
      }).catch(err => console.error('[Home] Delete sync failed:', err));
    }
  };

  // ── Feedback Handler ──
  const handleFeedback = (messageId, feedback) => {
    setMessageFeedback(messageId, feedback);
  };

  // ── Stop Generation Handler ──
  const handleStopGeneration = () => {
    stopStreaming();
  };

  // ── Manual Canvas Interaction ──


  // Selection cleanup
  const setSelectedElements = useTutorStore(state => state.setSelectedElements);
  const setHasTextSelection = useTutorStore(state => state.setHasTextSelection);

  const leftPanel = (
    <ErrorBoundary reloadOnRetry={true}>
      <LeftPanel
        activeView={activeView} setActiveView={setActiveView}
      chatHistory={chatHistory} activeChatId={activeChatId}
      onNewChat={handleNewChat} onSelectChat={handleSelectChat}
      onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat}
      messages={messages} isGenerating={machineState === STATES.GENERATING || machineState === STATES.RESPONDING || isDoubtProcessing || isStreaming || isWaitingForAI}
      onOpenCanvas={handleOpenCanvas} onDeleteMessage={handleDeleteMessage} onEditMessage={handleEditMessage}
      onRegenerateMessage={handleRegenerateMessage} onFeedback={handleFeedback} onStopGeneration={handleStopGeneration}
      getMsgId={getMsgId}
      prompt={prompt} setPrompt={setPrompt} onSubmit={handleSubmit}
      activeMode={activeMode} setActiveMode={setActiveMode}
      selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
      isDark={isDark}
      isLoadingHistory={isAuthenticated && !isGuest && pagination.loading && chatHistory.length === 0}
      hasMore={pagination.hasMore}
      isLoadingMore={pagination.loading && chatHistory.length > 0}
      onLoadMore={() => fetchCloudSessions(pagination.page + 1)}
      onQuickAsk={() => setIsQuickAskOpen(true)}
    />
    </ErrorBoundary>
  );

  return (
    <div className="h-screen w-screen bg-[var(--bg-primary)] overflow-hidden relative">
      {/* 1. Global Layout (contains the interactive glass panel) */}
      <Layout
        title={activeSession?.title || "TutorBoard AI"}
        onBack={handleNewChat}
        sidebar={leftPanel}
      >
        {/* 2. Main Background Canvas */}
        <div className="absolute inset-0 z-0">
          <InfiniteCanvas
            ref={canvasRef}
            onViewportChange={setCanvasTransform}
            onInteractionStart={() => { isAutoFollow.current = false; }}
            onClick={() => {
              setSelectedElements([]);
              setHasTextSelection(false);
            }}
            overlay={<InteractiveCanvasLayer />}
          >
            <AgentCanvasRenderer
              timeline={timeline}
              objects={[...(canvasObjects || []), ...(pinnedNotes || [])]}
              steps={canvasSteps}
              currentStepIndex={currentStepIndex}
              onGoToStep={goToStep}
              doubtHistory={doubtHistory}
              isDoubtProcessing={isDoubtProcessing}
              activeDoubtId={machine.activeDoubtId}
              onJumpToDoubt={machine.jumpToDoubt}
              onPinDoubt={machine.pinDoubtToCanvas}
              onResume={resume}
              onAskDoubt={askDoubt}
            />
          </InfiniteCanvas>
          
          {/* Initial Load Skeleton Overlay */}
          <AnimatePresence>
            {pagination.loading && chatHistory.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[5] bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-4"
              >
                <div className="relative">
                  <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-[var(--text-primary)] rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-normal uppercase tracking-[0.25em] text-[var(--text-primary)]">Restoring Workspace</span>
                  <span className="text-[9px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest">Fetching your visual history...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Connection Alert Banner */}
        <AnimatePresence>
          {isDbOffline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="absolute top-0 left-0 right-0 z-[60] overflow-hidden"
            >
              <div className="bg-red-500 text-white px-6 py-2.5 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3">
                  <WifiOff size={16} className="animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-normal uppercase tracking-wider">Database Connection Failed</span>
                    <span className="text-[10px] opacity-90 leading-tight">Your backend is unable to talk to MongoDB Atlas. Please ensure your IP is whitelisted in your Atlas Dashboard.</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDbOffline(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <SkipBack size={14} className="rotate-90" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── 3. TEACHING OVERLAYS ─── */}
        <TeachingSession 
          deselectAll={() => {
            setSelectedElements([]);
            setHasTextSelection(false);
          }} 
        />

        {/* ─── 4. GLOBAL CANVAS TOOLS ─── */}
        <CanvasMinimap
          visible={showMinimap}
          objects={[...(canvasObjects || []), ...(pinnedNotes || [])]}
          transform={canvasTransform}
          onNavigate={(wx, wy) => canvasRef.current?.centerOn(wx, wy)}
          layoutView={layoutView}
        />

        <CanvasControls
          transform={canvasTransform}
          onZoomIn={() => canvasRef.current?.zoomIn?.()}
          onZoomOut={() => canvasRef.current?.zoomOut?.()}
          onFitToContent={() => { 
            if (isSidebarOpen) {
              canvasRef.current?.fitToContent?.(); 
              setSidebarOpen(false); 
            } else {
              setSidebarOpen(true);
            }
          }}
          onResetView={() => {
            isAutoFollow.current = true;
            canvasRef.current?.resetView?.();
          }}
          onToggleMinimap={toggleMinimap}
          showMinimap={showMinimap}
          layoutView={layoutView}
          isSidebarOpen={isSidebarOpen}
        />

        {/* ── G. Doubt Resume Pill (Contextual) ── */}
        <AnimatePresence>
          {(machine.activeDoubtId || isDoubtProcessing) && !isDoubtProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
            >
              <button
                onClick={resume}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-xs font-normal shadow-2xl hover:scale-105 transition-all active:scale-95"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--bg-primary)] animate-pulse" />
                Resume Lesson Flow
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <QuickAskOverlay 
          isOpen={isQuickAskOpen} 
          onClose={() => setIsQuickAskOpen(false)} 
        />
      </Layout>
    </div>
  );
};



export default Home;
