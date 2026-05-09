import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow'; // State sync refactored for parallel generation
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

import API, { BASE_URL as API_URL, getCookie } from '../services/api';

// Canvas & Teaching Overlays
import AgentCanvasRenderer from '../components/canvas/AgentCanvasRenderer';
import FixedTeachingStage from '../components/canvas/FixedTeachingStage';
import CodeVisualizerModal from '../components/canvas/CodeVisualizerModal';
import ParticleWaves from '../components/canvas/ParticleWaves';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';
import QuickAskOverlay from '../components/chat/QuickAskOverlay';
import { useAuth } from '../context/AuthContext';
import { useSessionSync } from '../hooks/useSessionSync';
import VisaiLogo from '../components/layout/VisaiLogo';
import SelectionPopover from '../components/chat/SelectionPopover';

import { 
  Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, Wifi, WifiOff, Key
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
    canvasMode, playbackSpeed,
    setCanvasMode,
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
    setCodeEditorData,
    conversationMessages, isStreaming, isWaitingForAI,
    addUserMessage, finishStreaming, abortStreaming,
    setConversationMessages, clearConversation,
    applyEdit, removeLastAssistantMessage, prepareRegeneration,
    deleteMessageById, setMessageFeedback,
    setWaitingForAI, setLastAIError, conversationTopic,
    switchMessageVersion, setSources, clearSources, startStreaming: storeStartStreaming,
    appendStreamChunk, appendStreamThought, updateStreamingContent, lastStreamSources,
    setCurrentCanvasType,
    syncMessageIds,
    setActiveConversationSession,
    // Artifact system
    addArtifact, setArtifactDbId, setActiveArtifact, openArtifactPanel,
    startStreamingArtifact, finalizeStreamingArtifact,
    // Unread tracking
    addUnreadSession, markSessionRead,
    // CanvasSession architecture
    canvasLayout,
    activeArtifactId,
    openedArtifacts,
    activeTeachingMode,
    canvasSessionVersion,
  } = useTutorStore(useShallow(s => ({
    canvasMode: s.canvasMode, playbackSpeed: s.playbackSpeed,
    setCanvasMode: s.setCanvasMode,
    setPlaybackSpeed: s.setPlaybackSpeed,
    openFloatingSidebar: s.openFloatingSidebar, toggleDoubtThread: s.toggleDoubtThread, showDoubtThread: s.showDoubtThread,
    selectedAgent: s.selectedAgent, setSelectedAgent: s.setSelectedAgent, isSidebarOpen: s.isSidebarOpen, setSidebarOpen: s.setSidebarOpen,
    setCanvasSnapshot: s.setCanvasSnapshot, greetingMessage: s.greetingMessage, layoutView: s.layoutView, addNoteToCanvas: s.addNoteToCanvas,
    chatInputText: s.chatInputText, setChatInputText: s.setChatInputText, pinnedNotes: s.pinnedNotes, toggleSidebarPosition: s.toggleSidebarPosition, showAlert: s.showAlert,
    activeSnapshotId: s.activeSnapshotId, setActiveSnapshotId: s.setActiveSnapshotId, setTimeline: s.setTimeline,
    activeTool: s.activeTool, setActiveTool: s.setActiveTool, addCanvasObjects: s.addCanvasObjects,
    drawColor: s.drawColor, noteColor: s.noteColor, noteSize: s.noteSize, notePinned: s.notePinned, noteToolSize: s.noteToolSize,
    textToolSize: s.textToolSize, shapeStrokeStyle: s.shapeStrokeStyle,
    drawWidth: s.drawWidth, gridType: s.gridType, gridSize: s.gridSize, showGrid: s.showGrid,
    setCodeEditorData: s.setCodeEditorData,
    conversationMessages: s.conversationMessages, isStreaming: s.isStreaming, isWaitingForAI: s.isWaitingForAI,
    addUserMessage: s.addUserMessage, finishStreaming: s.finishStreaming, abortStreaming: s.abortStreaming,
    setConversationMessages: s.setConversationMessages, clearConversation: s.clearConversation,
    applyEdit: s.applyEdit, removeLastAssistantMessage: s.removeLastAssistantMessage,
    deleteMessageById: s.deleteMessageById, setMessageFeedback: s.setMessageFeedback,
    setWaitingForAI: s.setWaitingForAI, setLastAIError: s.setLastAIError, conversationTopic: s.conversationTopic,
    switchMessageVersion: s.switchMessageVersion, setSources: s.setSources, clearSources: s.clearSources, startStreaming: s.startStreaming,
    appendStreamChunk: s.appendStreamChunk, appendStreamThought: s.appendStreamThought, updateStreamingContent: s.updateStreamingContent, lastStreamSources: s.lastStreamSources,
    setCurrentCanvasType: s.setCurrentCanvasType, syncMessageIds: s.syncMessageIds,
    setActiveConversationSession: s.setActiveConversationSession,
    prepareRegeneration: s.prepareRegeneration,
    addArtifact: s.addArtifact, setArtifactDbId: s.setArtifactDbId, setActiveArtifact: s.setActiveArtifact, openArtifactPanel: s.openArtifactPanel,
    startStreamingArtifact: s.startStreamingArtifact, finalizeStreamingArtifact: s.finalizeStreamingArtifact,
    addUnreadSession: s.addUnreadSession, markSessionRead: s.markSessionRead,
    // CanvasSession architecture
    canvasLayout: s.canvasLayout,
    activeArtifactId: s.activeArtifactId,
    openedArtifacts: s.openedArtifacts,
    activeTeachingMode: s.activeTeachingMode,
    canvasSessionVersion: s.canvasSessionVersion,
    forceReset: s.forceReset,
  })));




  const isGuest = !!user?.isGuest;

  useEffect(() => {
    if (import.meta.env.DEV) {
      import.meta.env.DEV && console.log('[Home] Dashboard mounted. user:', user?.email, 'isGuest:', isGuest);
    }
  }, [user?.email, isGuest]);
  
  // Use global prefs but map to local variable for easier refactor
  const activeApiPrefs = globalApiPrefs;

  const { 
    chatHistory, 
    setChatHistory: storeSetChatHistory,
    promoteChatHistoryId
  } = useTutorStore(useShallow(s => ({
    chatHistory: s.chatHistory,
    setChatHistory: s.setChatHistory,
    promoteChatHistoryId: s.promoteChatHistoryId
  })));

  // Compatibility wrapper for functional updates in Home.jsx
  const setChatHistory = useCallback((updater) => {
    if (typeof updater === 'function') {
      const current = useTutorStore.getState().chatHistory;
      storeSetChatHistory(updater(current));
    } else {
      storeSetChatHistory(updater);
    }
  }, [storeSetChatHistory]);
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

        setChatHistory(prev => {
          let merged;
          if (pageNum === 1) {
            // MongoDB is the source of truth on fresh login/refresh.
            // Only preserve truly local in-progress sessions that have not yet been persisted.
            const cloudIds = new Set(cloudSessions.map(s => s.id));
            const localOnlySessions = prev.filter(
              s => s.id && !cloudIds.has(s.id) && (s.id.startsWith('temp-') || s.id.startsWith('local-') || s.id.startsWith('session-'))
            );
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
          import.meta.env.DEV && console.log('[Home] 🏠 Loaded guest local history:', parsed.length);
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

  const { sessionId: machineSessionId, setSessionId: storeSetSessionId } = useTutorStore(useShallow(s => ({
    sessionId: s.sessionId,
    setSessionId: s.setSessionId
  })));
  
  // Use machine.sessionId as the single source of truth for the local chat pointer
  const activeChatId = machineSessionId;
  const setActiveChatId = storeSetSessionId;

  const activeChatIdRef = useRef(activeChatId);
  const submittingSessionsRef = useRef(new Set()); // Track sessions currently initiating a request
  const abortControllersRef = useRef(new Map());

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    if (activeChatId) {
      setActiveConversationSession(activeChatId);
    }
  }, [activeChatId, setActiveConversationSession]);
  
  // ── ID SYNC: Promote temp ID to real Mongo ID in sidebar ──
  const lastIdRef = useRef(activeChatId);
  useEffect(() => {
    const oldId = lastIdRef.current;
    const newId = activeChatId;
    
    if (oldId && newId && oldId !== newId && (oldId.startsWith('temp-') || oldId.startsWith('local-') || oldId.startsWith('session-'))) {
      import.meta.env.DEV && console.log(`[Home:Sync] Promoting sidebar session via store: ${oldId} -> ${newId}`);
      promoteChatHistoryId(oldId, newId);
    }
    lastIdRef.current = newId;
  }, [activeChatId, promoteChatHistoryId]);

  // ─── Leave Chat / Close Snapshot Logic ───
  useEffect(() => {
    // If sidebar is closed and we were viewing a snapshot, return to main lesson
    if (!isSidebarOpen && activeSnapshotId) {
      import.meta.env.DEV && console.log('[Home] Leaving chat, closing snapshot animation...');
      setActiveSnapshotId(null);
      
      // Restore main lesson state from history if available
      const session = chatHistory.find(s => s.id === activeChatId);
      if (session && session.canvasState) {
        // SEC-UX: Only sync if we aren't already at the correct step to prevent loops
        const storeState = useTutorStore.getState();
        if (storeState.currentStepIndex !== (session.currentStepIndex || 0)) {
          setCanvasSnapshot({
            canvasObjects: session.canvasState,
            canvasSteps: session.canvasSteps || [],
            totalSteps: session.canvasSteps?.length || 0,
            currentStepIndex: session.currentStepIndex || 0
          });
        }
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
        import.meta.env.DEV && console.log('[Home] Hydrating active chat:', savedActiveId);
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
      import.meta.env.DEV && console.log('[Home] Auto-start detected for prompt:', urlPrompt);
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
    // Strip "Question: " prefix if standalone (legacy)
    clean = clean.replace(/^Question: /i, '');
    
    // Take first 50 chars or first sentence
    const firstSentence = clean.split(/[.!?\n]/)[0].trim();
    if (firstSentence.length > 50) {
      clean = firstSentence.substring(0, 47) + '...';
    } else {
      clean = firstSentence;
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
    import.meta.env.DEV && console.log('[Home] 🎨 Auto-created Canvas Session for standalone drawing.');
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
      import.meta.env.DEV && console.log(`[Persistence:Guest] 🏠 Updating local history: ${targetSessionId}`);
      setChatHistory(prev => {
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
        const cleaned = next.filter(s => {
          if (!s.id || finalIds.has(s.id)) return false;
          finalIds.add(s.id);
          return true;
        });
        
        const pruned = cleaned.slice(0, 10);
        localStorage.setItem('tutorboard-guest-history', JSON.stringify(pruned));
        return cleaned;
      });
      // Continue to API call if we have a valid session ID or just started one
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
          useTutorStore.getState().setChatSessionId(saved._id);
        }

        // ── SYNC LOCAL CACHE: Update the chatHistory entry with full state ──
        setChatHistory(prev => {
          // Promotion-aware index finding
          const idx = prev.findIndex(s => 
            s.id === targetSessionId || 
            s.id === saved._id || 
            (s.id?.startsWith('temp-') && (saved._id || targetSessionId) && !(saved._id || targetSessionId).startsWith('temp-'))
          );
          
          let next;
          if (idx !== -1) {
            next = [...prev];
            // If the ID changed (e.g. from temp- to real MongoDB ID), update it
            next[idx] = { ...next[idx], ...payload, id: saved._id || targetSessionId, chatSessionId: saved._id };
          } else {
            next = [{ ...payload, id: saved._id || targetSessionId, chatSessionId: saved._id }, ...prev];
          }

          // Final de-duplication safety
          const finalIds = new Set();
          return next.filter(s => {
            if (!s.id || finalIds.has(s.id)) return false;
            finalIds.add(s.id);
            return true;
          });
        });

        // If we were using a local UUID, swap it for the permanent Mongo ID everywhere.
        if (saved._id && saved._id !== targetSessionId) {
          import.meta.env.DEV && console.log(`[Persistence] 🔗 Adopting permanent Mongo ID: ${saved._id}`);
          setActiveChatId(saved._id);
          return saved._id;
        }
        return saved._id || targetSessionId;
      } else {
        const errData = res.data || {};
        if (errData.code === 'DB_OFFLINE') setIsDbOffline(true);
      }
    } catch (err) {
      console.error('[Persistence] ❌ Immediate save failed:', err);
    }
    return null;
  }, [activeChatId, activeSession, timeline, canvasObjects, canvasSteps, pinnedNotes, isAuthenticated, user, token, messages]);


  // ── Passive Sync (Canvas/Prefs Debounce) ──
  useSessionSync(conversationMessages);




  // ─── Logic ───
  const { toggleSidebar } = useTutorStore(useShallow(s => ({
    toggleSidebar: s.toggleSidebar
  })));



  const safeNum = (v, f) => { const n = parseFloat(v); return isNaN(n) ? f : n; };

  // Sidebar shortcut removed per user request

  const handleNewChat = () => { 
    // FIX: Clear any in-progress submission tracking so the new chat isn't blocked
    // by a stale "already submitting" entry from the previous session
    submittingSessionsRef.current.clear();
    // Cancel any in-flight requests from the previous session
    abortControllersRef.current.forEach(ctrl => { try { ctrl.abort(); } catch(_) {} });
    abortControllersRef.current.clear();

    useTutorStore.getState().triggerSync();
    useTutorStore.getState().setChatSessionId(null);
    // FIX: Also reset sessionId in the store so addUserMessage doesn't key to the old session
    useTutorStore.getState().setSessionId(null);
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
      import.meta.env.DEV && console.log(`[Home] Restoring local session: ${id} (${localSession.messages?.length || 0} messages)`);
      
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

      // ── Bug A Fix: Don't overwrite doubtHistory with regular messages ──
      if (localSession.doubtHistory) {
        useTutorStore.setState({ doubtHistory: localSession.doubtHistory });
      }
      
      // Update store's session mapping
      if (localSession.chatSessionId) {
        useTutorStore.getState().setChatSessionId(localSession.chatSessionId);
      }
    }

    // 2. Full pedagogical restoration from Cloud (SEC-20)
    if (isAuthenticated && !user?.isGuest && id && !id.startsWith('session-')) {
      try {
        import.meta.env.DEV && console.log(`[Home] 🔄 Fetching full pedagogical state for session ${id}...`);
        const response = await API.get(`/api/sessions/${id}`);
        
        if (response.status === 200) {
          const fullData = response.data;
          if (fullData) {
            const steps = fullData.canvasSteps || fullData.steps || [];
            import.meta.env.DEV && console.log(`[Home] ✅ Full state fetched. Restoring timeline (${steps.length} steps)...`);
            
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
              setConversationMessages(fullData.messages);
            }

            // ── Bug A Fix: Restore actual doubts if they exist ──
            if (fullData.doubtHistory) {
              useTutorStore.setState({ doubtHistory: fullData.doubtHistory });
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
            const res = await API.delete(`/api/sessions/${dbId}`);
            if (res.status === 200) {
              import.meta.env.DEV && console.log(`[Home] ✅ Session ${id} permanently deleted from cloud.`);
            } else {
              const errData = res.data || {};
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
          import.meta.env.DEV && console.log(`[Home] ↩️ Deletion undone for ${id}`);
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
        await API.post('/api/sessions', { sessionId: id, title: newTitle });
        import.meta.env.DEV && console.log(`[Home] ✅ Session ${id} renamed to "${newTitle}" in cloud.`);
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
          renderer: store.activeScene?.renderer || 'cinematic',
          title: store.activeScene?.title || 'Visual Lesson',
        };
        import.meta.env.DEV && console.log('[Home] Using live store state as canvas snapshot fallback');
      }
    }

    if (snapshot) {
      const store = useTutorStore.getState();
      const isCurrentlyActive = store.activeSnapshotId === messageId;
      
      if (isCurrentlyActive && store.canvasLayout !== 'inline') {
        // Toggle CLOSE: If already active and visible, hide it
        store.setCanvasLayout('inline');
        store.setActiveSnapshotId(null);
        import.meta.env.DEV && console.log('[Home] Canvas closed for message:', messageId);
      } else {
        // OPEN / SWITCH: Show canvas and set snapshot
        setCanvasSnapshot({
          ...snapshot,
          currentStepIndex: snapshot.currentStepIndex || 0,
        });
        store.setActiveSnapshotId(messageId);
        store.setCanvasLayout('split');
        import.meta.env.DEV && console.log('[Home] Canvas snapshot opened for message:', messageId);
      }
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

  const handleSubmit = async (textOverride, fileData = null, modeOverride = null, isRegeneration = false, targetAssistantId = null) => {
    // ── 0. Capture State before potential resets ──
    const isTeachingActive = machine.isTeaching || machine.isGenerating || machine.isDoubtTriggered;
    const currentActiveChatId = activeChatId;

    machine.cancelSession();
    const { selectedTextContext, setSelectedTextContext, getPlatformMemorySummary } = useTutorStore.getState();
    const finalContext = selectedTextContext;
    const platformMemory = getPlatformMemorySummary ? getPlatformMemorySummary() : null;

    // FIX: Generate the working session ID FIRST, before any store reads
    // This ensures addUserMessage, startStreaming, and appendStreamChunk all key to the same session
    let workingSessionId = currentActiveChatId || `session-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

    // FIX: Guard against double-submission but DON'T block if it's a genuinely new session
    // Old bug: on new chat, activeChatId was null so workingSessionId was always unique and guard never fired,
    // but on repeat submit activeChatId was stale from previous session causing false-block.
    const alreadySubmitting = submittingSessionsRef.current.has(workingSessionId);
    if (alreadySubmitting) {
      console.warn('[Home] Submission already in progress for session:', workingSessionId);
      return;
    }

    let userPrompt = textOverride || prompt.trim();
    
    // If we have context but NO user prompt, we might want a default question
    if (!userPrompt && finalContext) {
      userPrompt = `Explain this: "${finalContext}"`;
    } else if (finalContext) {
      // Prepend context to the prompt or send as separate field if API supports it
      // For now, we'll prepend it in a clean way for the AI to see
      userPrompt = `Context: "${finalContext}"\n\nQuestion: ${userPrompt}`;
    }

    if (!userPrompt && !fileData && !finalContext) {
      console.warn('[Home] Empty submission blocked');
      return;
    }

    // FIX: Set the active session ID in the store BEFORE addUserMessage is called
    // addUserMessage reads chatSessionId||sessionId from the store to key messages.
    // If these are null it falls back to 'temp', meaning stream chunks go to 'temp' 
    // but startStreaming is called with workingSessionId — they never match and no response appears.
    if (!activeChatId) {
      setActiveChatId(workingSessionId);
      // Also sync the store's session IDs so addUserMessage and useSessionSync pick them up immediately.
      // We set BOTH to ensure the background sync hook doesn't generate a separate local ID.
      useTutorStore.getState().setSessionId(workingSessionId);
      useTutorStore.getState().setChatSessionId(workingSessionId);
    }

    submittingSessionsRef.current.add(workingSessionId);
    activeChatIdRef.current = workingSessionId; // SYNC IMMEDIATELY to catch first stream chunks
    const streamToken = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPrompt('');  // Clear input immediately
    setSelectedTextContext(null); // Clear context immediately
    setActiveView('chat');

    // Guest Trial: Increment usage and block if exhausted
    if (isGuest) {
      const store = useTutorStore.getState();
      if (store.guestTrialStatus.isLimitReached) {
        submittingSessionsRef.current.delete(workingSessionId);
        return;
      }
      store.incrementGuestUsage();
    }

    let activityMonitor;
    try {
      let userId;
      let sessionTitle = activeSession?.title;

      // ── 1. Add user message ONLY if not regenerating ──
      if (!isRegeneration) {
        const result = addUserMessage(userPrompt);
        userId = result.userId;

        // ── Smart Title Generation: Only if session is currently generic ──
        const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session';
        const currentTitle = activeSession?.title;
        sessionTitle = isGeneric(currentTitle) ? generateCleanTitle(userPrompt) : currentTitle;
        
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
      }

      // ── 2. Determine if this is a teaching-related query ──
      // If a teaching session is active, route all chat input to the doubt pipeline
      // We use the captured isTeachingActive from the start of the function
      if ((activeMode === 'deep' || isTeachingActive) && !isRegeneration) {
        const store = useTutorStore.getState();
        const history = store.conversationMessages;
        const isFollowUp = (activeChatId && history.length > 0) || isTeachingActive;
        
        // FIX: Show thinking indicator before the socket event fires (previously spinner never appeared)
        setWaitingForAI(true, workingSessionId);

        if (isFollowUp) {
          import.meta.env.DEV && console.log('[Home] Routing chat query to doubt pipeline...');
          askDoubt(userPrompt, modeOverride || activeMode, fileData);
        } else {
          startSession(userPrompt, userPrompt, modeOverride || activeMode, fileData);
        }
        submittingSessionsRef.current.delete(workingSessionId);
        return;
      }

      const requestStartTime = Date.now();
      const clientRequestId = `chat-${requestStartTime}-${Math.random().toString(36).slice(2, 8)}`;

      // ── 3. Call the SSE Streaming Chat API ──
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCookie('tb-csrf-token') || '',
          'X-Request-Id': clientRequestId
        },
        body: JSON.stringify({
          sessionId: /^[0-9a-fA-F]{24}$/.test(workingSessionId) ? workingSessionId : undefined,
          requestId: clientRequestId,
          userMessage: userPrompt,
          mode: modeOverride || activeMode || 'quick',
          modelId: selectedAgent,
          teachingContext: {
            currentTopic: conversationTopic || undefined,
            explanationMode: 'basic',
            learnerLevel: 'intermediate',
          },
          platformMemory,
        }),
        credentials: 'include'
      };
      isArtifactExpectedRef.current = false;
      // ── 2. Handle Abort Signals ──
      if (abortControllersRef.current.has(workingSessionId)) {
        abortControllersRef.current.get(workingSessionId).abort();
      }
      const controller = new AbortController();
      abortControllersRef.current.set(workingSessionId, controller);
      const { signal } = controller;
      fetchOptions.signal = signal;

      const res = await fetch(`${API_URL}/api/chat/stream`, fetchOptions).catch(e => {
        console.error('[Chat:Stream] Network/Proxy error:', e);
        throw new Error(`Connection failed: ${e.message}`);
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.fallbackMessage || 'AI request failed');
      }

      // ── 4. Real SSE Streaming ──
      clearSources();
      const assistantMsgId = targetAssistantId || getMsgId('assistant');
      storeStartStreaming(assistantMsgId, workingSessionId, streamToken);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let bufferedContent = ''; // Buffer for JSON artifact responses
      let thoughtContent = '';
      let receivedSessionId = null;
      let lastArtifactLocalId = null;
      let lastEventType = 'message';

      // ── STREAM THROTTLING ──
      // Throttle UI updates to 10Hz (every 100ms) to prevent React render-flooding
      let chunkBuffer = '';
      let thoughtBuffer = '';
      let lastUpdateTs = Date.now();

      const flushBuffers = () => {
        const now = Date.now();
        const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
        
        if (chunkBuffer) {
          appendStreamChunk(chunkBuffer, currentSessionId, streamToken);
          chunkBuffer = '';
        }
        if (thoughtBuffer) {
          appendStreamThought(thoughtBuffer, currentSessionId, streamToken);
          thoughtBuffer = '';
        }
        lastUpdateTs = now;
      };

      let lastActivityTime = Date.now();
      activityMonitor = setInterval(() => {
        if (Date.now() - lastActivityTime > 45000) {
          console.error('[Home] Stream stalled (45s silence)');
          controller.abort();
        }
      }, 5000);

      while (true) {
          const { done, value } = await reader.read();
          lastActivityTime = Date.now();
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
            import.meta.env.DEV && console.log(`[SSE] Received event: ${eventType}`, eventData);

            if (eventType === 'meta') {
              receivedSessionId = eventData.sessionId || receivedSessionId;
              useTutorStore.getState().handleProgressiveStreamEvent(eventData);
            } else if (eventType === 'canvas_skeleton' || eventType === 'scene_nodes') {
              useTutorStore.getState().handleProgressiveStreamEvent(eventData);
            } else if (eventType === 'chunk' || eventType === 'message') {
              const text = eventData.chunk || eventData.content || (typeof eventData === 'string' ? eventData : '');
              
              if (text) {
                fullContent += text;
                const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
                if (currentSessionId === activeChatIdRef.current) {
                  if (isArtifactExpectedRef.current) {
                    appendStreamChunk(text, currentSessionId, streamToken);
                  } else {
                    chunkBuffer += text;
                    if (Date.now() - lastUpdateTs > 100) flushBuffers();
                  }
                } else {
                  addUnreadSession(currentSessionId);
                }
              }
            } else if (eventType === 'thought' || eventType === 'status') {
              const thought = eventData.thought || eventData.message || eventData.content || '';
              const thoughtStr = thought + (eventType === 'status' ? '\n' : '');
              thoughtContent += thoughtStr;
              const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
              if (currentSessionId === activeChatIdRef.current) {
                thoughtBuffer += thoughtStr;
                if (Date.now() - lastUpdateTs > 100) flushBuffers();
              } else {
                addUnreadSession(currentSessionId);
              }
            } else if (eventType === 'sources') {
              setSources(eventData.sources || [], workingSessionId);
            } else if (eventType === 'message_ids') {
              // Sync local ephemeral IDs with real MongoDB IDs (Fixed: Bug 2)
              const { userMessageId, assistantMessageId } = eventData;
              const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
              
              if (currentSessionId === activeChatIdRef.current) {
                syncMessageIds(userMessageId, assistantMessageId);
              }
              
              setChatHistory(prev => prev.map(s => {
                if (s.id === currentSessionId || s.id === receivedSessionId) {
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
                startStreamingArtifact({
                  type: plan.artifact_type || 'code',
                  title: plan.artifact_title || 'New Model'
                });
              }
              if (plan.suggest_canvas && plan.canvas_type) {
                currentCanvasTypeRef.current = plan.canvas_type;
                setCurrentCanvasType(plan.canvas_type);
              }
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
                
                finalizeStreamingArtifact();

                // Only open the panel for the FIRST artifact in a multi-artifact response
                if (!lastArtifactLocalId) {
                  setActiveArtifact(localId);
                  openArtifactPanel();
                }

                lastArtifactLocalId = localId;

                // Store artifact ID for later linkage to the assistant message
                lastArtifactIdRef.current = localId;

                // Attach this artifact ID to the CURRENT assistant message metadata if it exists
                const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
                setChatHistory(prev => prev.map(s => {
                  if (s.id === currentSessionId || s.id === receivedSessionId) {
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
                
                // Update message metadata to reflect the real ID
                setChatHistory(prev => prev.map(s => {
                  if (s.id === (receivedSessionId || workingSessionId)) {
                    const msgs = s.messages.map(m => {
                      if (m.metadata?.artifactId === savedLocalId) {
                        return { ...m, metadata: { ...m.metadata, artifactId: eventData.artifactId } };
                      }
                      return m;
                    });
                    return { ...s, messages: msgs };
                  }
                  return s;
                }));
              }
            } else if (eventType === 'chat_override') {
              const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
              if (currentSessionId === activeChatIdRef.current) {
                updateStreamingContent(eventData.content, currentSessionId, streamToken);
              } else {
                addUnreadSession(currentSessionId);
              }
              fullContent = eventData.content;
              setChatHistory(prev => prev.map(s => {
                if (s.id === (receivedSessionId || currentSessionId)) {
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
              const errorMessage = eventData.error || 'Streaming error';
              const fullError = eventData.details ? `${errorMessage} (${eventData.details})` : errorMessage;
              throw new Error(fullError);
            }
          } catch (parseErr) {
            // Re-throw our explicit errors and AbortError, only swallow JSON parse errors
            if (parseErr.name === 'Error' || parseErr.name === 'AbortError') {
              throw parseErr;
            }
            
            // Not JSON data, could be raw string
            if (lastEventType === 'message' && !dataStr.startsWith('{')) {
              fullContent += dataStr;
              const currentSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
              if (currentSessionId === activeChatIdRef.current) {
                chunkBuffer += dataStr;
                if (Date.now() - lastUpdateTs > 100) flushBuffers();
              } else {
                addUnreadSession(currentSessionId);
              }
            }
          }
        }
      }

    flushBuffers(); // FINAL FLUSH of any remaining tokens
      import.meta.env.DEV && console.log("FULL RESPONSE (Client):", fullContent);

      // ── 5. Finalize streaming ──
      const finalSessionId = useTutorStore.getState().chatSessionId || workingSessionId;
      finishStreaming(fullContent, finalSessionId, thoughtContent, lastStreamSources, lastArtifactIdRef.current, currentCanvasTypeRef.current, Date.now() - requestStartTime, streamToken, isRegeneration);
      lastArtifactIdRef.current = null; // Reset for next turn
      currentCanvasTypeRef.current = null;

      // Background persist for sidebar sync (Supports guests)
      if (isAuthenticated) {
        saveCurrentSession(
          useTutorStore.getState().conversationMessages,
          useTutorStore.getState().chatSessionId || receivedSessionId || workingSessionId,
          sessionTitle
        ).catch(err => console.error('[Home] Background persistence failed:', err));
      }

      // ── 6. Update sidebar history with session ID ──
      if (receivedSessionId && receivedSessionId !== workingSessionId) {
        // CRITICAL: Migrate streaming/waiting state to the new MongoDB ID before swapping active ID
        const { migrateSessionState } = useTutorStore.getState();
        migrateSessionState(workingSessionId, receivedSessionId);
        
        // SEC-UX: Migrate AbortController so "Stop" continues to work after ID swap
        const existingController = abortControllersRef.current.get(workingSessionId);
        if (existingController) {
          abortControllersRef.current.set(receivedSessionId, existingController);
          abortControllersRef.current.delete(workingSessionId);
        }

        const finalMessages = useTutorStore.getState().conversationMessages;
        setActiveChatId(receivedSessionId);
        setChatHistory(prev => prev.map(s => 
          s.id === workingSessionId ? { ...s, id: receivedSessionId, chatSessionId: receivedSessionId, messages: finalMessages } : s
        ));
        useTutorStore.getState().setChatSessionId(receivedSessionId);
        
        // Update local working reference so remaining chunks use the correct ID
        workingSessionId = receivedSessionId;
      } else {
        // Just sync messages if ID didn't change
        const finalMessages = useTutorStore.getState().conversationMessages;
        setChatHistory(prev => prev.map(s => 
          s.id === workingSessionId ? { ...s, messages: finalMessages } : s
        ));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        import.meta.env.DEV && console.log('[Home] AI request aborted by user.');
        useTutorStore.getState().setWaitingForAI(false, workingSessionId);
        // Nuclear cleanup for UI state
        forceReset();
        return;
      }
      console.error('[Home] handleSubmit failed:', err);
      setLastAIError(err.message, workingSessionId);
      const store = useTutorStore.getState();
      
      // Nuclear cleanup for UI state on 503 or other fatal errors
      forceReset();

      store.finishStreaming(err.message.includes('unavailable') || err.message.includes('503')
        ? "I'm having trouble connecting right now. Please try again in a moment. Our primary AI providers are currently rate-limited."
        : `⚠️ ${err.message}`, workingSessionId);
      
      // Sync error message to sidebar
      const errorMessages = store.conversationMessages;
      setChatHistory(prev => prev.map(s => 
        s.id === workingSessionId ? { ...s, messages: errorMessages } : s
      ));
    } finally {
      if (activityMonitor) clearInterval(activityMonitor);
      submittingSessionsRef.current.delete(workingSessionId);
      abortControllersRef.current.delete(workingSessionId);
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
      if (isMongoId) {
        const response = await API.post('/api/chat/edit', { 
          sessionId: dbSessionId, 
          messageId, 
          newContent 
        });
        
        if (response.status === 200) {
          const data = response.data;
          // ── SYNC STATE: If edit truncated the conversation (branching), update store ──
          if (data.messagesAfterEdit) {
            useTutorStore.getState().setConversationMessages(data.messagesAfterEdit);
          }

          const assistantMsgId = data.assistantMessageId || getMsgId('assistant');
          streamResponse(data.response, assistantMsgId, dbSessionId);
          return;
        }
      }

      // Fallback: call the regular chat API
      const response = await API.post('/api/chat', {
        sessionId: isMongoId ? dbSessionId : undefined,
        userMessage: newContent,
        mode: activeMode || 'quick',
      });

      if (response.status === 200) {
        const data = response.data;
        streamResponse(data.response, data.assistantMessageId || getMsgId('assistant'), dbSessionId);
      }
    } catch (err) {
      console.error('[Home] Edit failed:', err);
      useTutorStore.getState().setLastAIError(err.message);
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

    if (!isMongoId) {
      const lastUserMsg = [...conversationMessages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        handleSubmit(lastUserMsg.content, null, null, true, finalTargetId || null);
        return;
      }
    }

    if (!finalTargetId) {
      // If we are here and have no target ID, but it's a Mongo session,
      // it means there's no assistant message yet to regenerate.
      // We should probably just trigger a new handleSubmit.
      const lastUserMsg = [...conversationMessages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        handleSubmit(lastUserMsg.content, null, null, true, null);
        return;
      }
      return;
    }

    useTutorStore.getState().setWaitingForAI(true, dbSessionId);
    useTutorStore.getState().setLastAIError(null, dbSessionId);

    // 1. Prepare UI for regeneration (adds a new empty version slot)
    prepareRegeneration(finalTargetId);
    
    try {
      if (isMongoId) {
        const clientRequestId = `regen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        
        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCookie('tb-csrf-token') || '',
            'X-Request-Id': clientRequestId
          },
          body: JSON.stringify({
            sessionId: dbSessionId,
            messageId: finalTargetId,
            requestId: clientRequestId,
            modelId: selectedAgent
          }),
          credentials: 'include'
        };

        const controller = new AbortController();
        const streamToken = `regen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        abortControllersRef.current.set(dbSessionId, controller);
        fetchOptions.signal = controller.signal;

        // Set a safety timeout for the initial connection (60s)
        const initialTimeout = setTimeout(() => {
          if (useTutorStore.getState().isWaitingForAI) {
            console.warn('[Home:Regen] Initial connection timeout (60s)');
            controller.abort();
          }
        }, 60000);

        const res = await fetch(`${API_URL}/api/chat/regenerate/stream`, fetchOptions).catch(e => {
          clearTimeout(initialTimeout);
          console.error('[Home:Regen] Fetch failed:', e);
          if (e.name === 'AbortError') throw new Error('Regeneration request timed out or was cancelled.');
          throw new Error(`Network error: ${e.message}. Please check your connection and try again.`);
        });

        clearTimeout(initialTimeout);
        import.meta.env.DEV && console.log('[Home:Regen] Response status:', res.status);
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Regeneration failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let thoughtContent = '';
        let lastEventType = 'message';
        let lastActivityTime = Date.now();
        const requestStartTime = Date.now();

        // Start UI streaming state
        storeStartStreaming(finalTargetId, dbSessionId, streamToken);

        let lastStreamSources = [];

        // Activity monitor to detect stalled streams (45s silence)
        const activityMonitor = setInterval(() => {
          if (Date.now() - lastActivityTime > 45000) {
            console.error('[Home:Regen] Stream stalled (45s silence)');
            controller.abort();
            clearInterval(activityMonitor);
          }
        }, 5000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            lastActivityTime = Date.now(); // Reset on any activity (including heartbeats)
            
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

                if (eventType === 'meta' || eventType === 'canvas_skeleton' || eventType === 'scene_nodes') {
                  useTutorStore.getState().handleProgressiveStreamEvent(eventData);
                } else if (eventType === 'chunk' || eventType === 'message') {
                  const text = eventData.chunk || eventData.content || (typeof eventData === 'string' ? eventData : '');
                  if (text) {
                    fullContent += text;
                    appendStreamChunk(text, dbSessionId, streamToken);
                  }
                } else if (eventType === 'thought' || eventType === 'status') {
                  const thought = eventData.thought || eventData.message || eventData.content || '';
                  thoughtContent += thought + (eventType === 'status' ? '\n' : '');
                  appendStreamThought(thought + (eventType === 'status' ? '\n' : ''), dbSessionId, streamToken);
                } else if (eventType === 'sources') {
                  lastStreamSources = eventData.sources || [];
                  setSources(lastStreamSources, dbSessionId);
                } else if (eventType === 'plan') {
                  if (eventData.plan?.suggest_canvas) setCurrentCanvasType(eventData.plan.canvas_type);
                } else if (eventType === 'done') {
                  if (eventData.messagesAfterRegen) {
                    import.meta.env.DEV && console.log('[Home:Regen] Syncing conversation state from server');
                    useTutorStore.getState().setConversationMessages(eventData.messagesAfterRegen);
                    
                    setChatHistory(prev => prev.map(s => 
                      s.id === dbSessionId ? { ...s, messages: eventData.messagesAfterRegen } : s
                    ));
                  }
                } else if (eventType === 'error') {
                  throw new Error(eventData.error || 'Regeneration error');
                }
              } catch (e) {
                if (e.name === 'Error') throw e;
              }
            }
          }
        } finally {
          clearInterval(activityMonitor);
        }

        import.meta.env.DEV && console.log('[Home:Regen] Finalizing stream, length:', fullContent.length);
        finishStreaming(fullContent, dbSessionId, thoughtContent, lastStreamSources, null, null, Date.now() - requestStartTime, streamToken, true);
        return;
      }

      // Fallback: re-send last user message (for guests/non-persisted)
      // (This could also be updated to stream, but let's keep it simple for now)
      const lastUserMsg = useTutorStore.getState().conversationMessages
        .filter(m => m.role === 'user').pop();
        
      if (lastUserMsg) {
        handleSubmit(lastUserMsg.content, null, null, true, finalTargetId);
      } else {
        useTutorStore.getState().setWaitingForAI(false, dbSessionId);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[Home] Regenerate failed:', err);
      // Ensure we clear the streaming state so the UI doesn't stay hidden
      useTutorStore.getState().finishStreaming('⚠️ Regeneration failed. Please try again.', dbSessionId);
      setLastAIError(err.message, dbSessionId);
    }
  };

  // ── Delete Message Handler ──
  const handleDeleteMessage = async (messageId) => {
    deleteMessageById(messageId);
    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');
    if (isMongoId) {
      API.delete(`/api/chat/${dbSessionId}/messages/${messageId}`)
        .catch(err => console.error('[Home] Delete sync failed:', err));
    }
  };

  // ── Feedback Handler ──
    const handleFeedback = async (messageId, feedback) => {
      setMessageFeedback(messageId, feedback);

      const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');

      if (isMongoId && isAuthenticated) {
        try {
          await API.post('/api/chat/feedback', { sessionId: dbSessionId, messageId, feedback });
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
  const handleStopGeneration = (sessionId) => {
    const targetId = sessionId || useTutorStore.getState().chatSessionId || activeChatId;
    
    // 1. Abort HTTP streaming requests
    const controller = abortControllersRef.current.get(targetId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(targetId);
    }
    
    // 2. Abort visual generation in teaching machine
    machine.cancelSession();
    
    // 3. Clear store states
    abortStreaming(targetId);
    useTutorStore.getState().setWaitingForAI(false, targetId);
  };

  // ── Session Export Handler ──
  const handleExport = (type) => {
    const session = chatHistory.find(s => s.id === activeChatId) || activeSession;
    if (!session || !messages.length) return;

    const title = session.title || 'TutorBoard_Conversation';
    
    if (type === 'docx') {
      const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .msg { margin-bottom: 20pt; }
          .role { font-weight: bold; font-size: 10pt; color: #555; text-transform: uppercase; }
          .content { font-size: 11pt; }
          pre { background: #f4f4f4; padding: 10pt; font-family: 'Courier New', monospace; }
        </style>
        </head><body>
        <h1>${title}</h1>
        <hr/>
      `;
      let content = "";
      messages.forEach(m => {
        content += `
          <div class="msg">
            <div class="role">${m.role === 'user' ? 'Student' : 'TutorBoard AI'} - ${new Date(m.timestamp).toLocaleString()}</div>
            <div class="content">${m.content.replace(/\n/g, '<br/>')}</div>
            ${m.metadata?.thought ? `<div style="color: #666; font-style: italic; margin-top: 5pt; padding-left: 10pt; border-left: 2px solid #ddd;">Thought: ${m.metadata.thought}</div>` : ''}
          </div>
          <hr style="border: 0; border-top: 1px solid #eee;"/>
        `;
      });
      const footer = "</body></html>";
      
      const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'pdf') {
      const printWindow = window.open('', '_blank');
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap');
              body { 
                font-family: 'Inter', sans-serif; 
                padding: 40px; 
                line-height: 1.6; 
                color: #1a1a1a; 
                max-width: 850px; 
                margin: 0 auto; 
                background: #fff;
              }
              header { border-bottom: 2px solid #f0f0f0; margin-bottom: 30px; padding-bottom: 15px; }
              h1 { font-weight: 700; font-size: 24px; margin: 0; color: #000; }
              .date { font-size: 12px; color: #666; margin-top: 4px; }
              .msg { margin-bottom: 30px; page-break-inside: avoid; }
              .role { 
                display: inline-block;
                font-weight: 600; 
                font-size: 10px; 
                text-transform: uppercase; 
                letter-spacing: 0.05em;
                color: #666; 
                margin-bottom: 8px; 
              }
              .content { font-size: 14px; white-space: pre-wrap; color: #333; }
              pre { 
                background: #f8f9fa; 
                color: #1a1a1a; 
                padding: 15px; 
                border: 1px solid #e9ecef;
                border-radius: 6px; 
                font-family: 'JetBrains Mono', monospace; 
                font-size: 12px; 
                overflow-x: auto;
                margin: 15px 0;
              }
              .thought { font-size: 12px; color: #777; font-style: italic; margin-top: 10px; border-left: 2px solid #eee; padding-left: 10px; }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <header>
              <h1>${title}</h1>
              <div class="date">Exported on ${new Date().toLocaleString()} from TutorBoard AI</div>
            </header>
            <main>
              ${messages.map(m => `
                <div class="msg">
                  <div class="role">${m.role === 'user' ? 'Student' : 'TutorBoard AI'}</div>
                  <div class="content">${m.content}</div>
                  ${m.metadata?.thought ? `<div class="thought">Thought: ${m.metadata.thought}</div>` : ''}
                </div>
              `).join('')}
            </main>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };
  // ── Keyboard Shortcuts (UPGRADE-05) ──
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 1. Ctrl+K Focus Input (Always allow)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-input-bar'));
      }

      // 2. Escape Stop Generation (Always allow while generating)
      if (e.key === 'Escape' && (isStreaming || isWaitingForAI)) {
        e.preventDefault();
        handleStopGeneration();
      }

      // 3. Ctrl+/ Open Agent Selector
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-agent-menu'));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isStreaming, isWaitingForAI]);

  // Selection cleanup
  const setSelectedElements = useTutorStore(state => state.setSelectedElements);
  const setHasTextSelection = useTutorStore(state => state.setHasTextSelection);

  const isCanvasVisible = canvasLayout !== 'inline' || machineState !== STATES.IDLE;
  const isTeachingActive = isCanvasVisible;
  const isSplitView = canvasLayout === 'split' || (isCanvasVisible && canvasLayout !== 'fullscreen');
  const isFullscreen = canvasLayout === 'fullscreen';

  const leftPanel = (
    <ErrorBoundary reloadOnRetry={true}>
      <LeftPanel
        activeView={activeView} setActiveView={setActiveView}
      chatHistory={chatHistory} activeChatId={activeChatId}
      onNewChat={handleNewChat} onSelectChat={handleSelectChat}
      onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat}
      messages={messages} isGenerating={(() => {
        const sid = activeChatId || 'temp';
        const sessionState = useTutorStore.getState().sessionStates[sid] || {};
        return machineState === STATES.GENERATING || 
               machineState === STATES.RESPONDING || 
               isDoubtProcessing || 
               sessionState.isWaitingForAI || 
               sessionState.isStreaming;
      })()}
      onOpenCanvas={handleOpenCanvas} onDeleteMessage={handleDeleteMessage} onEditMessage={handleEditMessage}
      onRegenerateMessage={handleRegenerateMessage} onFeedback={handleFeedback} onStopGeneration={handleStopGeneration}
      onSwitchVersion={handleSwitchVersion}
      onExport={handleExport}
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
      isSplitView={isSplitView}
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
        isSplitView={isSplitView}
        forceCollapse={isFullscreen}
      >
        {/* 2. Main Background Canvas */}
        {!isTeachingActive && (
          <div className="absolute inset-0 z-0 bg-[var(--bg-primary)] overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[10%] left-[5%] w-[30%] h-[30%] bg-[var(--text-primary)] opacity-[0.02] blur-[120px] rounded-full" />
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
              <div className="w-full h-full relative overflow-hidden">
                {/* ── Ambient Background Animation ── */}
                <ParticleWaves opacity={0.6} />

                {/* ── Branding Watermarks ── */}
                <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden">
                  {/* Top Left Watermark */}
                  <motion.div 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-5 left-5 flex flex-col gap-1"
                  >
                    <h1 
                      className="text-5xl font-light tracking-[0.4em] text-[var(--text-primary)] opacity-[0.25] dark:opacity-[0.12]"
                      style={{ fontFamily: '"Outfit", sans-serif' }}
                    >
                      TUTORBOARD
                    </h1>
                    <p 
                      className="text-[13px] font-medium tracking-wide text-[var(--text-primary)] opacity-[0.18] dark:opacity-[0.08] max-w-lg leading-relaxed italic"
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      Where AI meets understanding — turns complex concepts into visual intelligence.
                    </p>
                  </motion.div>
                </div>
              </div>
            )}
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
              className="absolute inset-0 z-[100] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-2xl"
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
