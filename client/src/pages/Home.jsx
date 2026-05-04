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
import AgentCanvasRenderer from '../components/canvas/AgentCanvasRenderer';
import FixedTeachingStage from '../components/canvas/FixedTeachingStage';
import CodeVisualizerModal from '../components/canvas/CodeVisualizerModal';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';
import QuickAskOverlay from '../components/chat/QuickAskOverlay';
import { useAuth } from '../context/AuthContext';
import { useSessionSync } from '../hooks/useSessionSync';
import VisaiLogo from '../components/layout/VisaiLogo';
import SelectionPopover from '../components/chat/SelectionPopover';

import { 
  Volume2, VolumeX, Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, Wifi, WifiOff, Loader, Key
} from 'lucide-react';





const Home = ({ isDark }) => {
  const { isAuthenticated, token, user, loading: authLoading, apiPrefs: globalApiPrefs, logout, isAuthResolved } = useAuth();
  const machine = useTeachingMachine(isAuthResolved);
  const {
    machineState, isConnected,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStep, currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory,
    error,
    isPlaying,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, finish, setSpeed, endSession,
  } = machine;

  const {
    canvasMode, voiceEnabled, playbackSpeed,
    setCanvasMode, toggleVoice,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, toggleDoubtThread, showDoubtThread,
    selectedAgent, setSelectedAgent, isSidebarOpen, setSidebarOpen,
    setCanvasSnapshot, greetingMessage, layoutView, addNoteToCanvas,
    chatInputText, setChatInputText, pinnedNotes, toggleSidebarPosition, showAlert,
    activeSnapshotId, setActiveSnapshotId, setTimeline,
    // Manual interaction states
    activeTool, setActiveTool, addCanvasObjects,
    drawColor, noteColor, noteSize, notePinned, noteToolSize,
    textToolSize, shapeStrokeStyle,
    drawWidth, gridType, gridSize, showGrid,
    setCodeEditorData
  } = useTutorStore();

  const {
    conversationMessages, isStreaming, isWaitingForAI,
    addUserMessage, finishStreaming, abortStreaming,
    setConversationMessages, clearConversation,
    applyEdit, removeLastAssistantMessage,
    deleteMessageById, setMessageFeedback,
    setWaitingForAI, setLastAIError, conversationTopic,
    switchMessageVersion, setSources, clearSources, startStreaming: storeStartStreaming,
    appendStreamChunk, appendStreamThought, updateStreamingContent, lastStreamSources,
    setCurrentCanvasType,
    // Artifact system
    addArtifact, setArtifactDbId, setActiveArtifact, openArtifactPanel,
    // Unread tracking
    addUnreadSession, markSessionRead
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    setPagination(prev => ({ ...prev, loading: true }));
    try {
      const fetchOptions = {
        signal: controller.signal,
        credentials: 'include'
      };
      if (token && token !== 'verified' && token !== 'guest') {
        fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
      }

      const res = await fetch(`${API_URL}/api/sessions?page=${pageNum}&limit=15`, fetchOptions);
      clearTimeout(timeoutId);
      
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
      } else {
        console.warn(`[Home] Cloud fetch failed with status: ${res.status}`);
        setPagination(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[Home] Cloud fetch timed out after 10s');
      } else {
        console.error('Failed to restore cloud sessions:', err);
      }
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

  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

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
  const lastArtifactIdRef = useRef(null);
  const isArtifactExpectedRef = useRef(false);
  const currentCanvasTypeRef = useRef(null);
  useEffect(() => {
    // Wait for auth to finish deciding if we are guest or user
    if (authLoading) return;
    if (hasHydratedActive.current) return;
    
    // If we already have an active chat (e.g. from store sync), we are done with hydration
    if (activeChatId) {
      hasHydratedActive.current = true;
      return;
    }

    const savedActiveId = user?.lastActiveSessionId || localStorage.getItem('tutorboard-active-chat');
    
    // Only attempt hydration if we actually have history loaded (from local or cloud)
    if (!activeChatId && savedActiveId && chatHistory.length > 0) {
      const session = chatHistory.find(s => s.id === savedActiveId);
      if (session) {
        console.log('[Home] Hydrating active chat:', savedActiveId);
        hasHydratedActive.current = true;
        // Restore active chat ID
        setActiveChatId(savedActiveId);
        
        // Optimistic hydration: Populate chat and canvas from local history BEFORE cloud fetch
        if (session.messages && session.messages.length > 0) {
          setConversationMessages(session.messages);
        }

        // Restore canvas snapshot if we have one
        if (session.canvasState && session.canvasState.length > 0) {
          useTutorStore.getState().setCanvasSnapshot({ 
            canvasObjects: session.canvasState, 
            canvasSteps: session.canvasSteps || session.steps || [], 
            totalSteps: (session.canvasSteps || session.steps)?.length || 0 
          });
        }
      }
    }
  }, [activeChatId, chatHistory, setActiveChatId, setConversationMessages, authLoading]);

  // ── Sync Doubt Responses to Chat ──
  const lastDoubtId = useRef(null);
  useEffect(() => {
    if (doubtHistory.length === 0) return;
    const latest = doubtHistory[doubtHistory.length - 1];
    
    // Only append if it's a new doubt response we haven't logged yet
    if (latest.answer && latest.id !== lastDoubtId.current) {
      lastDoubtId.current = latest.id;
      
      const store = useTutorStore.getState();
      const assistantMessage = { 
        id: getMsgId('doubt-ans'), 
        role: 'assistant', 
        content: latest.answer,
        timestamp: new Date().toISOString(),
        hasCanvas: latest.hasVisuals,
        canvasSnapshot: latest.hasVisuals ? { 
          canvasObjects: store.canvasObjects, 
          canvasSteps: store.canvasSteps, 
          totalSteps: store.canvasSteps?.length || 0,
          currentStepIndex: store.currentStepIndex || 0,
          renderer: store.renderer,
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
      
      const store = useTutorStore.getState();
      const assistantMessage = { 
         id: getMsgId('session-ans'), 
         role: 'assistant', 
         content: `I've prepared a visual learning canvas for you on **${timeline.title}**. Dive in whenever you're ready!`,
         timestamp: new Date().toISOString(),
         hasCanvas: true,
         canvasSnapshot: { 
           canvasObjects: store.canvasObjects, 
           canvasSteps: store.canvasSteps, 
           totalSteps: store.canvasSteps?.length || 0, 
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


  const isSubmittingRef = useRef(false);
  const fetchAbortControllerRef = useRef(null);
  const msgIdCounter = useRef(0);
  const getMsgId = (suffix = '') => `msg-${Date.now()}-${++msgIdCounter.current}${suffix ? `-${suffix}` : ''}`;



  const { startStreaming: streamResponse, stopStreaming } = useStreamingResponse();

  // ── Smart Title Summarization Helper ──
  const generateCleanTitle = useCallback((text) => {
    if (!text) return 'Untitled Session';
    let clean = text;
    // Strip Context block if it exists (handles context prepended in handleSubmit)
    const contextMatch = text.match(/Context: ".*?"\n\nQuestion: (.*)/is);
    if (contextMatch && contextMatch[1]) {
      clean = contextMatch[1];
    }
    // Strip "Question: " prefix if standalone
    clean = clean.replace(/^Question: /i, '');
    
    // Take first sentence or first 45 chars
    clean = clean.split(/[.!?\n]/)[0].trim();
    if (clean.length > 45) {
      clean = clean.substring(0, 42) + '...';
    }
    
    if (!clean) return 'Untitled Session';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }, []);

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

    const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session';
    const existingTitle = activeSession?.title || timeline?.title;
    
    const derivedTitle = isGeneric(existingTitle) 
      ? (updatedMessages && updatedMessages.find(m => m.role === 'user')?.content) 
      : existingTitle;

    const payload = {
      sessionId: targetSessionId,
      title: overrideTitle || (isGeneric(derivedTitle) ? generateCleanTitle(derivedTitle) : derivedTitle) || 'Untitled Session',
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

    // ── GUEST PERSISTENCE (LocalStorage fallback + MongoDB) ──
    if (user?.isGuest) {
      console.log(`[Persistence:Guest] 🏠 Updating local history: ${targetSessionId}`);
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === targetSessionId);
        let next;
        if (idx === -1) {
          next = [payload, ...prev];
        } else {
          next = [...prev];
          next[idx] = { ...next[idx], ...payload };
        }
        const pruned = next.slice(0, 10);
        localStorage.setItem('tutorboard-guest-history', JSON.stringify(pruned));
        return next;
      });
      // Continue to API call if we have a valid session ID or just started one
    }

    if (!isAuthenticated) return null;
    
    console.log(`[Persistence] 💾 Saving session to cloud: ${targetSessionId}`);
    
    try {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      };
      if (token && token !== 'verified' && token !== 'guest') {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/sessions`, fetchOptions);
      
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
    markSessionRead(id);
    
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
          canvasSteps: localSession.canvasSteps || localSession.steps || [], 
          totalSteps: (localSession.canvasSteps || localSession.steps)?.length || 0 
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
        const fetchOptions = { credentials: 'include' };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
        }
        const res = await fetch(`${API_URL}/api/sessions/${id}`, fetchOptions);
        
        if (res.ok) {
          const fullData = await res.json();
          if (fullData) {
            const steps = fullData.canvasSteps || fullData.steps || [];
            console.log(`[Home] ✅ Full state fetched. Restoring timeline (${steps.length} steps)...`);
            
            // Restore actual pedagogical timeline
            if (steps.length > 0) {
              useTutorStore.getState().setTimeline({
                ...fullData,
                title: fullData.title || localSession?.title || 'Saved Session',
                timeline: steps,
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
              canvasSteps: fullData.canvasSteps || fullData.steps || [],
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
            const fetchOptions = { 
              method: 'DELETE',
              credentials: 'include'
            };
            if (token && token !== 'verified' && token !== 'guest') {
              fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
            }
            const res = await fetch(`${API_URL}/api/sessions/${dbId}`, fetchOptions);
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
        const fetchOptions = {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId: id, title: newTitle }),
          credentials: 'include'
        };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        await fetch(`${API_URL}/api/sessions`, fetchOptions);
        console.log(`[Home] ✅ Session ${id} renamed to "${newTitle}" in cloud.`);
      } catch (err) {
        console.error('[Home] Failed to rename session in cloud:', err);
      }
    }
  };

  const handleOpenCanvas = (messageId) => {
    // 1. Try to find snapshot from chatHistory
    const session = chatHistory.find(s => s.id === activeChatId);
    let snapshot = null;

    if (session) {
      const msg = session.messages?.find(m => m.id === messageId || m._id === messageId);
      if (msg?.canvasSnapshot) {
        snapshot = msg.canvasSnapshot;
      }
    }

    // 2. Fallback: Try conversationMessages from the store
    if (!snapshot) {
      const storeMsg = conversationMessages.find(m => m.id === messageId || m._id === messageId);
      if (storeMsg?.canvasSnapshot) {
        snapshot = storeMsg.canvasSnapshot;
      }
    }

    // 3. Final fallback: Use the current live canvas state from the store
    if (!snapshot) {
      const store = useTutorStore.getState();
      if (store.canvasObjects?.length > 0 || store.canvasSteps?.length > 0) {
        snapshot = {
          canvasObjects: store.canvasObjects || [],
          canvasSteps: store.canvasSteps || [],
          totalSteps: store.totalSteps || store.canvasSteps?.length || 0,
          currentStepIndex: store.currentStepIndex || 0,
          renderer: store.renderer || 'cinematic',
          title: store.timeline?.title || 'Visual Lesson',
        };
        console.log('[Home] Using live store state as canvas snapshot fallback');
      }
    }

    if (snapshot) {
      setCanvasSnapshot({
        ...snapshot,
        currentStepIndex: snapshot.currentStepIndex || 0,
      });
      useTutorStore.getState().setActiveSnapshotId(messageId);
      console.log('[Home] Canvas snapshot opened for message:', messageId);
    } else {
      console.warn('[Home] No canvas data found for message:', messageId);
    }
  };

  const handleOpenArtifactFromCode = useCallback((code, lang) => {
    // Normalize language for the visualizer
    const langMap = { 
      'js': 'javascript', 'javascript': 'javascript',
      'ts': 'typescript', 'typescript': 'typescript',
      'py': 'python', 'python': 'python', 
      'rb': 'ruby', 'ruby': 'ruby',
      'go': 'go', 'golang': 'go',
      'rs': 'rust', 'rust': 'rust',
      'sql': 'sql', 
      'html': 'html', 
      'css': 'css',
      'cpp': 'cpp', 'c++': 'cpp',
      'c': 'c' 
    };
    const normalizedLang = langMap[lang?.toLowerCase()] || lang || 'javascript';

    // 1. Open in the Code Visualizer (IDE-like toolbar modal)
    setCodeEditorData(code, normalizedLang);
  }, [setCodeEditorData]);

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
    const { selectedTextContext, setSelectedTextContext } = useTutorStore.getState();
    const finalContext = selectedTextContext;

    if ((!prompt.trim() && !textOverride && !fileData && !finalContext) || isSubmittingRef.current) return;
    
    let userPrompt = textOverride || prompt.trim();
    
    // If we have context but NO user prompt, we might want a default question
    if (!userPrompt && finalContext) {
      userPrompt = `Explain this: "${finalContext}"`;
    } else if (finalContext) {
      // Prepend context to the prompt or send as separate field if API supports it
      // For now, we'll prepend it in a clean way for the AI to see
      userPrompt = `Context: "${finalContext}"\n\nQuestion: ${userPrompt}`;
    }

    setPrompt('');  // Clear input immediately
    setSelectedTextContext(null); // Clear context immediately
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
      const { userId, assistantId } = addUserMessage(userPrompt);

      // ── Smart Title Generation: Only if session is currently generic ──
      const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session';
      const currentTitle = activeSession?.title;
      const sessionTitle = isGeneric(currentTitle) ? generateCleanTitle(userPrompt) : currentTitle;
      
      // Update local chat history for sidebar display
      const userMessage = { 
        id: userId, role: 'user', content: userPrompt, 
        timestamp: new Date().toISOString(), file: fileData,
        metadata: { edited: false, regenerated: false, feedback: null },
      };
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === workingSessionId);
        if (idx === -1) return [{ id: workingSessionId, title: sessionTitle, messages: [userMessage] }, ...prev];
        const next = [...prev]; 
        next[idx] = { ...next[idx], title: sessionTitle, messages: [...next[idx].messages, userMessage] }; 
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

      // ── 3. Call the SSE Streaming Chat API ──
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: /^[0-9a-fA-F]{24}$/.test(workingSessionId) ? workingSessionId : undefined,
          userMessage: userPrompt,
          mode: activeMode || 'quick',
          teachingContext: {
            currentTopic: conversationTopic || undefined,
            explanationMode: 'basic',
            learnerLevel: 'intermediate',
          },
        }),
        credentials: 'include'
      };
      if (token && token !== 'verified' && token !== 'guest') {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      isArtifactExpectedRef.current = false;
      fetchAbortControllerRef.current = new AbortController();
      fetchOptions.signal = fetchAbortControllerRef.current.signal;

      const res = await fetch(`${API_URL}/api/chat/stream`, fetchOptions);

      fetchAbortControllerRef.current = null;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.fallbackMessage || 'AI request failed');
      }

      // ── 4. Real SSE Streaming ──
      clearSources();
      const assistantMsgId = getMsgId('assistant');
      storeStartStreaming(assistantMsgId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let thoughtContent = '';
      let receivedSessionId = null;
      let lastArtifactLocalId = null;
      let lastEventType = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            lastEventType = trimmed.slice(7).trim();
            continue;
          }

          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);

          try {
            const eventData = JSON.parse(dataStr);
            const eventType = eventData.type || lastEventType;

            if (eventType === 'chunk' || eventType === 'message') {
              const text = eventData.chunk || eventData.content || (typeof eventData === 'string' ? eventData : '');
              
              if (text) {
                fullContent += text;
                // Isolation check: Only stream to UI if this is the active chat
                if (workingSessionId === activeChatIdRef.current) {
                  appendStreamChunk(text);
                } else {
                  addUnreadSession(workingSessionId);
                }
              }
            } else if (eventType === 'thought' || eventType === 'status') {
              const thought = eventData.thought || eventData.message || eventData.content || '';
              thoughtContent += thought + (eventType === 'status' ? '\n' : '');
              if (workingSessionId === activeChatIdRef.current) {
                appendStreamThought(thought + (eventType === 'status' ? '\n' : ''));
              } else {
                addUnreadSession(workingSessionId);
              }
            } else if (eventType === 'sources') {
              setSources(eventData.sources || []);
            } else if (eventType === 'message_ids') {
              // Sync local ephemeral IDs with real MongoDB IDs (Fixed: Bug 2)
              const { userMessageId, assistantMessageId } = eventData;
              setChatHistory(prev => prev.map(s => {
                if (s.id === workingSessionId || s.id === receivedSessionId) {
                  const msgs = [...s.messages];
                  // Update last two messages (user and assistant)
                  if (msgs.length >= 2) {
                    msgs[msgs.length - 2] = { ...msgs[msgs.length - 2], id: userMessageId };
                    msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: assistantMessageId };
                  }
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            } else if (eventType === 'plan') {
              const plan = eventData.plan || {};
              if (plan.generate_artifact) {
                isArtifactExpectedRef.current = true;
              }
              if (plan.suggest_canvas && plan.canvas_type) {
                currentCanvasTypeRef.current = plan.canvas_type;
                setCurrentCanvasType(plan.canvas_type);
              }
            } else if (eventType === 'status') {
              console.log('[Home] AI Status:', eventData.message);
              appendStreamThought(`*${eventData.message}* `);
            } else if (eventType === 'meta' || eventType === 'message_ids') {
              receivedSessionId = eventData.sessionId || eventData.receivedSessionId;
            } else if (eventType === 'artifact') {
              const art = eventData.artifact || eventData;
              if (art.type && art.content) {
                const localId = addArtifact({
                  id: art.id || `art-${Date.now()}`,
                  type: art.type,
                  title: art.title,
                  content: art.content,
                  language: art.language,
                  metadata: art.metadata || {},
                });

                // Only open the panel for the FIRST artifact in a multi-artifact response
                if (!lastArtifactLocalId) {
                  setActiveArtifact(localId);
                  openArtifactPanel();
                }

                lastArtifactLocalId = localId;

                // Store artifact ID for later linkage to the assistant message
                lastArtifactIdRef.current = localId;

                // Attach this artifact ID to the CURRENT assistant message metadata if it exists
                setChatHistory(prev => prev.map(s => {
                  if (s.id === workingSessionId || s.id === receivedSessionId) {
                    const msgs = [...s.messages];
                    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                      msgs[msgs.length - 1] = { 
                        ...msgs[msgs.length - 1], 
                        metadata: { ...msgs[msgs.length - 1].metadata, artifactId: localId } 
                      };
                    }
                    return { ...s, messages: msgs };
                  }
                  return s;
                }));
              }
            } else if (eventType === 'artifact_saved') {
              // Link the local artifact to its DB ID
              const savedLocalId = eventData.localId || lastArtifactLocalId;
              if (savedLocalId && eventData.artifactId) {
                setArtifactDbId(savedLocalId, eventData.artifactId);
              }
            } else if (eventType === 'chat_override') {
              if (workingSessionId === activeChatIdRef.current) {
                updateStreamingContent(eventData.content);
              } else {
                addUnreadSession(workingSessionId);
              }
              fullContent = eventData.content;
              setChatHistory(prev => prev.map(s => {
                if (s.id === (receivedSessionId || workingSessionId)) {
                  const msgs = [...s.messages];
                  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                    msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: eventData.content };
                  }
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            } else if (eventType === 'done') {
              // Streaming complete
            } else if (eventType === 'error') {
              throw new Error(eventData.error || 'Streaming error');
            }
          } catch (parseErr) {
            // Not JSON data, could be raw string
            if (lastEventType === 'message' && !dataStr.startsWith('{')) {
              fullContent += dataStr;
              if (workingSessionId === activeChatIdRef.current) {
                appendStreamChunk(dataStr);
              } else {
                addUnreadSession(workingSessionId);
              }
            }
          }
        }
      }

      console.log("FULL RESPONSE (Client):", fullContent);

      // ── 5. Finalize streaming ──
      finishStreaming(fullContent, workingSessionId, thoughtContent, lastStreamSources, lastArtifactIdRef.current, currentCanvasTypeRef.current);
      lastArtifactIdRef.current = null; // Reset for next turn
      currentCanvasTypeRef.current = null;

      // Background persist for sidebar sync (Supports guests)
      if (isAuthenticated) {
        saveCurrentSession(
          useTutorStore.getState().conversationMessages,
          receivedSessionId || workingSessionId,
          sessionTitle
        ).catch(err => console.error('[Home] Background persistence failed:', err));
      }

      // ── 6. Update sidebar history with session ID ──
      if (receivedSessionId && receivedSessionId !== workingSessionId) {
        setActiveChatId(receivedSessionId);
        setChatHistory(prev => prev.map(s => 
          s.id === workingSessionId ? { ...s, id: receivedSessionId, chatSessionId: receivedSessionId } : s
        ));
        useTutorStore.getState().setChatSessionId(receivedSessionId);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[Home] AI request aborted by user.');
        useTutorStore.getState().setWaitingForAI(false);
        return;
      }
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
      if (isMongoId && isAuthenticated && token) {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: dbSessionId, messageId, newContent }),
          credentials: 'include'
        };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}/api/chat/edit`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          const assistantMsgId = data.assistantMessageId || getMsgId('assistant');
          streamResponse(data.response, assistantMsgId);
          return;
        }
      }

      // Fallback: call the regular chat API with truncated context
      const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: isMongoId ? dbSessionId : undefined,
          userMessage: newContent,
          mode: activeMode || 'quick',
        }),
        credentials: 'include'
      };
      if (token && token !== 'verified' && token !== 'guest') {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/chat`, fetchOptions);

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
  const handleRegenerateMessage = async (targetMsgId = null) => {
    // If no target provided, use the last assistant message ID
    let finalTargetId = targetMsgId;
    if (!finalTargetId) {
      const lastAssistant = [...conversationMessages].reverse().find(m => m.role === 'assistant');
      finalTargetId = lastAssistant?.id;
    }

    if (!finalTargetId) return;

    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

    try {
      if (isMongoId && isAuthenticated && token) {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId: dbSessionId,
            messageId: finalTargetId 
          }),
          credentials: 'include'
        };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}/api/chat/regenerate`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          
          // Determine the actual message ID to stream into. 
          // 1. Prioritize real ID from backend
          // 2. Fallback to heuristic (find assistant response to the user message)
          let streamTargetId = data.assistantMessageId || finalTargetId;
          
          if (!data.assistantMessageId) {
            const messages = useTutorStore.getState().conversationMessages;
            const targetIdx = messages.findIndex(m => m.id === finalTargetId);
            if (targetIdx !== -1 && messages[targetIdx].role === 'user') {
              const nextMsg = messages[targetIdx + 1];
              if (nextMsg && nextMsg.role === 'assistant') {
                streamTargetId = nextMsg.id;
              }
            }
          }

          // ── OPTIMISTIC UPDATE: Add a new version placeholder immediately ──
          useTutorStore.getState().addMessageVersion(streamTargetId, '', { regenerated: true });
          
          streamResponse(data.response, streamTargetId);
          return;
        }
      }

      // Fallback: re-send last user message (destructive fallback)
      removeLastAssistantMessage();
      const lastUserMsg = useTutorStore.getState().conversationMessages
        .filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: lastUserMsg.content, mode: activeMode || 'quick' }),
          credentials: 'include'
        };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}/api/chat`, fetchOptions);
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
    if (isMongoId && isAuthenticated && token) {
      const fetchOptions = {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: dbSessionId, messageId }),
        credentials: 'include'
      };
      if (token && token !== 'verified' && token !== 'guest') {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }
      fetch(`${API_URL}/api/chat/message`, fetchOptions).catch(err => console.error('[Home] Delete sync failed:', err));
    }
  };

  // ── Feedback Handler ──
    const handleFeedback = async (messageId, feedback) => {
      setMessageFeedback(messageId, feedback);

      const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

      if (isMongoId && isAuthenticated && token) {
        try {
          const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: dbSessionId, messageId, feedback }),
            credentials: 'include'
          };
          if (token && token !== 'verified' && token !== 'guest') {
            fetchOptions.headers['Authorization'] = `Bearer ${token}`;
          }
          await fetch(`${API_URL}/api/chat/feedback`, fetchOptions);
        } catch (err) {
          console.error('[Home] Feedback sync failed:', err);
        }
      }
    };

  // ── Version Switch Handler ──
  const handleSwitchVersion = async (messageId, versionIndex) => {
    switchMessageVersion(messageId, versionIndex);

    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

    if (isMongoId && isAuthenticated && token) {
      try {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: dbSessionId, messageId, versionIndex }),
          credentials: 'include'
        };
        if (token && token !== 'verified' && token !== 'guest') {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        await fetch(`${API_URL}/api/chat/switch-version`, fetchOptions);
      } catch (err) {
        console.error('[Home] Version switch sync failed:', err);
      }
    }
  };

  // ── Stop Generation Handler ──
  const handleStopGeneration = () => {
    stopStreaming();
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
      fetchAbortControllerRef.current = null;
    }
    useTutorStore.getState().setWaitingForAI(false);
  };

  // ── Manual Canvas Interaction ──


  // Selection cleanup
  const setSelectedElements = useTutorStore(state => state.setSelectedElements);
  const setHasTextSelection = useTutorStore(state => state.setHasTextSelection);

  const isTeachingActive = machineState !== STATES.IDLE;

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
      onSwitchVersion={handleSwitchVersion}
      getMsgId={getMsgId}
      prompt={prompt} setPrompt={setPrompt} onSubmit={handleSubmit}
      onOpenArtifact={handleOpenArtifactFromCode}
      activeMode={activeMode} setActiveMode={setActiveMode}
      selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
      isDark={isDark}
      isLoadingHistory={isAuthenticated && !isGuest && pagination.loading && chatHistory.length === 0}
      hasMore={pagination.hasMore}
      isLoadingMore={pagination.loading && chatHistory.length > 0}
      onLoadMore={() => fetchCloudSessions(pagination.page + 1)}
      onQuickAsk={() => setIsQuickAskOpen(true)}
      isSplitView={isTeachingActive}
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
        isSplitView={isTeachingActive}
      >
        {/* 2. Main Background Canvas */}
        <div className="absolute inset-0 z-0 bg-[var(--bg-secondary)] overflow-hidden">
          {/* Global Ambient Light Decorations (Subtle) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] bg-[var(--info)] opacity-[0.03] blur-[100px] rounded-full" />
            <div className="absolute -bottom-[10%] -right-[5%] w-[40%] h-[40%] bg-[var(--success)] opacity-[0.03] blur-[100px] rounded-full" />
          </div>

          {(timeline || (canvasObjects && canvasObjects.length > 0)) ? (
            <div className="w-full h-full relative overflow-hidden">
              <FixedTeachingStage 
                topic={timeline?.title || "History Session"}
                currentStepIndex={currentStepIndex}
                totalSteps={canvasSteps.length}
                hideControls={true}
              >
                <AgentCanvasRenderer
                  width={800} height={600}
                  timeline={timeline}
                  currentStepIndex={currentStepIndex}
                  elements={canvasObjects}
                  objects={canvasObjects}
                  connections={canvasConnections}
                  steps={canvasSteps}
                  onGoToStep={goToStep}
                />
              </FixedTeachingStage>
            </div>
          ) : !pagination.loading && (
            <div className="w-full h-full flex items-center justify-center relative p-4 md:p-6">
              {/* The "Empty" Stage Frame (3D Glassy) */}
              <div 
                className="absolute inset-4 md:inset-6 rounded-[2.5rem] bg-[var(--bg-secondary)] opacity-20 pointer-events-none"
                style={{
                  boxShadow: `
                    0 0 0 1px var(--border-color),
                    inset 0 1px 2px rgba(255,255,255,0.05)
                  `
                }}
              />

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative z-10 flex flex-col items-center"
              >
                {/* Minimalist 3D Glass Hub */}
                <div className="relative w-16 h-16 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-[var(--info)] opacity-10 blur-2xl rounded-full scale-150" />
                  <div 
                    className="relative w-full h-full rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden border border-[var(--border-color)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <VisaiLogo size="sm" />
                  </div>
                </div>

                <div className="text-center space-y-3">
                  <h3 className="text-3xl font-light text-[var(--text-primary)] tracking-tight opacity-80">
                    Tutor<span className="font-semibold">Board</span>
                  </h3>
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px w-6 bg-[var(--border-color)]" />
                    <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.3em] font-medium opacity-40">
                      AI Visual Learning Ready
                    </p>
                    <div className="h-px w-6 bg-[var(--border-color)]" />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          
          {/* Initial Load Skeleton Overlay */}
          <AnimatePresence>
            {pagination.loading && chatHistory.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[5] bg-[var(--bg-secondary)] flex flex-col items-center justify-center gap-4"
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

        {/* ─── 3. TEACHING OVERLAYS (Split View Container) ─── */}
        <AnimatePresence>
          {isTeachingActive && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 z-[40] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-2xl"
            >
              <TeachingSession 
                deselectAll={() => {
                  setSelectedElements([]);
                  setHasTextSelection(false);
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>



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
        <SelectionPopover />
        <CodeVisualizerModal />
      </Layout>
    </div>
  );
};



export default Home;
