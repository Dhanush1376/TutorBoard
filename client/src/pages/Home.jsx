import React, { useState, useEffect, useRef, useCallback } from 'react';
import { learnerLevelFrom } from '../lib/teaching';
import { useShallow } from 'zustand/react/shallow'; // State sync refactored for parallel generation
import Layout from '../components/layout/Layout';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';
import LeftPanel from '../components/layout/LeftPanel';
import useTutorStore, { STATES as STORE_STATES, CANVAS_MODE } from '../store/tutorStore';
import useTeachingMachine, { STATES } from '../hooks/useTeachingMachine';
import useSceneAutoplay from '../hooks/useSceneAutoplay';
const TeachingSession = React.lazy(() => import('../components/teaching/TeachingSession'));

import API, { BASE_URL as API_URL, getCookie, getAuthHeaders, acquireIdentitySlot, storeGuestToken } from '../services/api';

// Canvas & Teaching Overlays
const AgentCanvasRenderer = React.lazy(() => import('../components/canvas/AgentCanvasRenderer'));
import FixedTeachingStage from '../components/canvas/FixedTeachingStage';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';

import QuickAskOverlay from '../components/chat/QuickAskOverlay';
import { useAuth } from '../hooks/useAuth';
import { useSessionSync } from '../hooks/useSessionSync';
import { useSessionHistory } from '../hooks/useSessionHistory';
import { useSessionPersistence } from '../hooks/useSessionPersistence';
import VisaiLogo from '../components/layout/VisaiLogo';
import SelectionPopover from '../components/chat/SelectionPopover';
import AnnotationLayer from '../components/canvas/AnnotationLayer';
import useAnnotationStore from '../store/annotationStore';
import ArtifactPanel from '../components/chat/ArtifactPanel';
import { useArtifactSocket } from '../hooks/useArtifactSocket';
import { processSSEStream } from '../utils/sseStreamParser';
import { ChatRequestError, fromServerError } from '../lib/chatErrors';
import { createStreamPacer } from '../lib/streamPacer';
import { chatTimings } from '../lib/chatTimings';
import { resolveStartStep } from '../lib/lessonProgress';

import { 
  Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, Wifi, WifiOff, Key, RotateCcw, X, CornerDownLeft, FileCode, Bot, User, ArrowRight, Undo2
} from 'lucide-react';

const ChatColumnWrapper = React.memo((props) => {
  const { activeChatId, machineState, isDoubtProcessing, activeSession, ...restProps } = props;
  const {
    conversationMessages, isStreaming, isWaitingForAI, isMessagesLoading
  } = useTutorStore(useShallow(s => ({
    conversationMessages: s.conversationMessages,
    isStreaming: s.isStreaming,
    isWaitingForAI: s.isWaitingForAI,
    isMessagesLoading: s.isMessagesLoading,
  })));

  const messages = conversationMessages.length > 0 ? conversationMessages : (activeSession?.messages || []);

  // Doubts are answered in the lesson's session panel, so neither a doubt in
  // flight nor the post-answer RESPONDING state is chat activity (a doubt typed
  // into the chat box is still covered by isWaitingForAI).
  const isGenerating = machineState === STORE_STATES.GENERATING ||
                       isWaitingForAI ||
                       isStreaming;

  return (
    <LeftPanel
      {...restProps}
      activeChatId={activeChatId}
      messages={messages}
      isGenerating={isGenerating}
      isLoadingHistory={restProps.isLoadingHistory || isMessagesLoading}
    />
  );
});



const Home = ({ isDark }) => {
  const { isAuthenticated, token, user, loading: authLoading, apiPrefs: globalApiPrefs, logout, isAuthResolved } = useAuth();
  const machine = useTeachingMachine(isAuthResolved);
  // Phase 3: auto-advance step-by-step playback for SSE-rendered scenes.
  useSceneAutoplay();
  
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
    activeTool, setActiveTool, addCanvasObjects,
    drawColor, noteColor, noteSize, notePinned, noteToolSize,
    textToolSize, shapeStrokeStyle,
    drawWidth, gridType, gridSize, showGrid,
    setCodeEditorData,
    isStreaming, isWaitingForAI, conversationMessages,
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
    addArtifact, setArtifactDbId, setActiveArtifact, openArtifactPanel,
    startStreamingArtifact, finalizeStreamingArtifact,
    addUnreadSession, markSessionRead,
    canvasLayout,
    activeArtifactId,
    openedArtifacts,
    activeTeachingMode,
    canvasSessionVersion,
    forceReset,
    hydrateSession,
    chatHistory,
    setChatHistory: storeSetChatHistory,
    promoteChatHistoryId,
    sessionId: machineSessionId,
    setSessionId: storeSetSessionId,
    toggleSidebar,
    setSelectedElements,
    setHasTextSelection,
    showToast,
    isExplainMinimized,
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
    isStreaming: s.isStreaming,
    isWaitingForAI: s.isWaitingForAI,
    isMessagesLoading: s.isMessagesLoading,
    conversationMessages: s.conversationMessages,
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
    canvasLayout: s.canvasLayout,
    activeArtifactId: s.activeArtifactId,
    openedArtifacts: s.openedArtifacts,
    activeTeachingMode: s.activeTeachingMode,
    canvasSessionVersion: s.canvasSessionVersion,
    forceReset: s.forceReset,
    hydrateSession: s.hydrateSession,
    chatHistory: s.chatHistory,
    setChatHistory: s.setChatHistory,
    promoteChatHistoryId: s.promoteChatHistoryId,
    sessionId: s.sessionId,
    setSessionId: s.setSessionId,
    toggleSidebar: s.toggleSidebar,
    setSelectedElements: s.setSelectedElements,
    setHasTextSelection: s.setHasTextSelection,
    showToast: s.showToast,
    isExplainMinimized: s.isExplainMinimized,
  })));

  // ─── COMPONENT STATE ───
  const [isQuickAskOpen, setIsQuickAskOpen] = useState(false);
  const [activeView, setActiveView] = useState('history');
  const [prompt, setPrompt] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState(null);
  const [undoConfirmModal, setUndoConfirmModal] = useState(null);

  // ─── COMPONENT REFS ───
  const selectFetchLockRef = useRef(false);
  const selectFetchAbortControllerRef = useRef(null);
  const lastArtifactIdRef = useRef(null);
  const isArtifactExpectedRef = useRef(false);
  const currentCanvasTypeRef = useRef(null);
  const hasAutoStarted = useRef(false);
  const msgIdCounter = useRef(0);
  const canvasSessionCreatedRef = useRef(false);
  const submittingSessionsRef = useRef(new Set());
  const abortControllersRef = useRef(new Map());

  // Real-time Visual Artifact listener
  useArtifactSocket();






  const isGuest = !!user?.isGuest;

  useEffect(() => {
    if (import.meta.env.DEV) {
      import.meta.env.DEV && console.log('[Home] Dashboard mounted. user:', user?.email, 'isGuest:', isGuest);
    }
  }, [user?.email, isGuest]);

  // Guest Mode: Cloud session persistence is active; no data loss on refresh.
  
  // Use global prefs but map to local variable for easier refactor
  const activeApiPrefs = globalApiPrefs;

  // Functional updates for chatHistory directly in React render cycle should use storeSetChatHistory
  const syncChatHistory = useCallback((updater) => {
    storeSetChatHistory(updater);
  }, [storeSetChatHistory]);


  const { historyFetched, pagination, fetchCloudSessions } = useSessionHistory({
    isAuthenticated,
    isGuest,
    token,
    user,
    authLoading
  });

  // Use machine.sessionId as the single source of truth for the local chat pointer
  const activeChatId = machineSessionId;
  const hasMarks = useAnnotationStore((st) => st.data.strokes.length + st.data.shapes.length + st.data.notes.length > 0);
  const setActiveChatId = storeSetSessionId;

  const activeChatIdRef = useRef(activeChatId);


  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    if (activeChatId) {
      setActiveConversationSession(activeChatId);
    }
  }, [activeChatId, setActiveConversationSession]);

  // Abort in-flight requests only on unmount. Keying this on activeChatId
  // killed every stream the moment the session ID changed (e.g. the temp→Mongo
  // ID promotion mid-stream), which dropped late events like scene_nodes.
  // Background sessions are designed to keep streaming (addUnreadSession),
  // and per-session aborts are handled in handleSubmit/handleStopGeneration.
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach(c => {
        try { c.abort(); } catch(e) {}
      });
      controllers.clear();
    };
  }, []);
  


  // ─── Leave Chat / Close Canvas Logic ───
  // Whenever the user leaves the chat (navigating back to sessions history),
  // automatically close the canvas overlay, pause/end active teaching, and clean canvas state.
  useEffect(() => {
    if (activeView === 'history') {
      import.meta.env.DEV && console.log('[Home] User in sessions list - closing canvas overlay.');
      // 1. Reset teaching state machine so isTeachingActive becomes false
      endSession();
      // 2. Reset canvas layout and artifact state in the store
      const store = useTutorStore.getState();
      store.setCanvasLayout('inline');
      store.closeCanvasLayout();
      store.setActiveSnapshotId(null);
      store.clearArtifacts();
      store.setTimeline(null);
      store.setCanvasSnapshot({
        canvasObjects: [],
        canvasSteps: [],
        totalSteps: 0,
        currentStepIndex: 0
      });
      // Clear session-level annotations and canvas selections
      useAnnotationStore.getState().clear();
      if (typeof setSelectedElements === 'function') {
        setSelectedElements([]);
      } else {
        useTutorStore.getState().clearSelection?.();
      }
      setHasTextSelection?.(false);
    }
  }, [activeView, endSession, setSelectedElements, setHasTextSelection]);

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

  // Persist active chat ID for both authenticated users and guests
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('tutorboard-active-chat', activeChatId);
    }
  }, [activeChatId]);


  // Safety: If stuck in isWaitingForAI for more than 30s without a stream, force reset.
  useEffect(() => {
    if (!isWaitingForAI || isStreaming) return;
    const timer = setTimeout(() => {
      if (isWaitingForAI && !isStreaming) {
        import.meta.env.DEV && console.warn('[Home] Stuck detected in isWaitingForAI. Forcing reset.');
        setWaitingForAI(false, activeChatId || useTutorStore.getState().getSid());
        if (submittingSessionsRef.current) submittingSessionsRef.current.clear();
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [isWaitingForAI, isStreaming, activeChatId, setWaitingForAI]);









  // ── AI Automation: Handle 'prompt' URL param ──
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
        startSession(urlPrompt, urlPrompt, 'explain');
        // Clear param so it doesn't re-start on refresh if navigating back
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [startSession]);

  const getMsgId = (suffix = '') => `msg-${Date.now()}-${++msgIdCounter.current}${suffix ? `-${suffix}` : ''}`;


  // ── Smart Title Summarization Helper (Clear, grammatically correct and natural title) ──
  const generateCleanTitle = useCallback((text) => {
    if (!text) return 'New Chat';
    let clean = String(text).trim();

    // Strip thought tags or context blocks if present
    clean = clean.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    const contextMatch = clean.match(/Context: ".*?"\s*\n\nQuestion:\s*(.*)/is);
    if (contextMatch && contextMatch[1]) {
      clean = contextMatch[1].trim();
    }
    clean = clean.replace(/^Question:\s*/i, '').trim();

    // Strip conversational openers iteratively
    let prev;
    do {
      prev = clean;
      clean = clean.replace(/^(?:can you|could you|would you|please|i want to learn|i want to know|teach me|tell me|show me|explain to me|help me with|help me|explain|describe)\s+(?:about\s+)?/i, '').trim();
    } while (clean !== prev);

    // Convert questions like "how do i find..." or telegraphic "how find" into "how to find..."
    clean = clean.replace(/^how\s+(?:do\s+i|can\s+i|can\s+we|to)\s+/i, 'how to ');
    clean = clean.replace(/^how\s+(find|calculate|derive|solve|compute|get|make|draw|integrate|differentiate|prove)\b/i, 'how to $1');

    // Clean edge markdown and punctuation
    clean = clean.replace(/[`*#_~[\]{}()$"']/g, ' ');
    clean = clean.replace(/[?.,!;:]+$/g, '').trim();
    clean = clean.replace(/\s+/g, ' ').trim();

    if (!clean) return 'New Chat';

    // Limit to the first 6-7 meaningful words so it fits well on a single line
    const words = clean.split(/\s+/).filter(Boolean);
    const cappedWords = words.length > 7 ? words.slice(0, 7) : words;

    const minorWords = new Set([
      'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
      'by', 'of', 'in', 'with', 'as', 'into', 'over'
    ]);

    const title = cappedWords
      .map((w, idx) => {
        const lower = w.toLowerCase();
        // Preserve acronyms like AI, DNA, HTML, etc.
        if (w.length > 1 && w === w.toUpperCase() && /^[A-Z0-9]+$/.test(w)) {
          return w;
        }
        if (idx > 0 && minorWords.has(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ')
      .trim();

    return title || 'New Chat';
  }, []);

  const activeSession = chatHistory.find(c => c.id === activeChatId) || null;

  // ── Canvas-First Session Creation ──
  // If the user draws on the canvas without starting a chat, we create a "Canvas Session"
  // so that toolbar drawings are always persisted.
  useEffect(() => {
    if ((!isAuthenticated && !user?.isGuest) || !historyFetched) return; 
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
    syncChatHistory(prev => [newSession, ...prev]);
    setActiveChatId(localId);
    import.meta.env.DEV && console.log('[Home] 🎨 Auto-created Canvas Session for standalone drawing.');
  }, [canvasObjects?.length, activeChatId, isAuthenticated, user]);

  const { saveCurrentSession, isDbOffline, setIsDbOffline } = useSessionPersistence({
    activeChatId,
    activeSession,
    isAuthenticated,
    user,
    token,
    generateCleanTitle
  });


  // ── Passive Sync (Canvas/Prefs Debounce) ──
  useSessionSync();




  // ─── Logic ───

  // Automatic cleanup timer for the floating confirmation Undo overlay
  useEffect(() => {
    if (!lastSubmittedPrompt) return;
    const timer = setTimeout(() => {
      setLastSubmittedPrompt(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [lastSubmittedPrompt]);

  /** Ask the server to stop the answer this controller's request is generating (fire and forget). */
  const stopServerGeneration = (controller, sessionKey) => {
    if (!controller?.requestId) return;
    fetch(`${API_URL}/api/chat/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ requestId: controller.requestId, ...(sessionKey ? { sessionId: sessionKey } : {}) }),
    }).catch(() => { /* best effort: the answer then finishes and is saved */ });
  };

  const executeConfirmedUndo = useCallback(async () => {
    if (!undoConfirmModal) return;
    const { messageId, content, doUndo } = undoConfirmModal;
    if (typeof doUndo === 'function') {
      doUndo();
      return;
    }
    const sid = activeChatId || useTutorStore.getState().getSid();

    // 1. Abort any active streaming loops
    if (abortControllersRef.current.has(sid)) {
      stopServerGeneration(abortControllersRef.current.get(sid), sid);
      abortControllersRef.current.get(sid).abort();
    }
    useTutorStore.getState().abortStreaming(sid);

    // 2. Execute slice pruning starting from targeted checkpoint ID
    if (messageId) {
      useTutorStore.getState().deleteMessagesStartingFromId(messageId);

      // Sync deletion with MongoDB database
      const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');
      const isMongoMsgId = /^[0-9a-fA-F]{24}$/.test(messageId || '');
      const pruned = isMongoId && isMongoMsgId
        ? API.delete('/api/chat/message', { data: { sessionId: dbSessionId, messageId, startingFrom: true } })
          .catch(err => console.error('[Home] Restore delete sync failed:', err))
        : Promise.resolve();

      const updatedMessages = useTutorStore.getState().conversationMessages;
      const isThisChat = (s) => s.id === dbSessionId || s._id === dbSessionId || s.id === sid;
      if (updatedMessages.length === 0) {
        // Every message was undone: the conversation has nothing left in it, so it
        // goes too (sidebar and server) — the question waits in the composer, and
        // sending it starts a fresh conversation.
        syncChatHistory(prev => prev.filter(s => !isThisChat(s)));
        if (isMongoId) {
          pruned.then(() => API.delete(`/api/sessions/${dbSessionId}`))
            .catch(err => console.error('[Home] Removing the emptied conversation failed:', err));
        }
        submittingSessionsRef.current.delete(sid);
        abortControllersRef.current.delete(sid);
        useTutorStore.getState().setChatSessionId(null);
        useTutorStore.getState().setSessionId(null);
        clearConversation();
        useTutorStore.getState().clearArtifacts();
        setActiveChatId(null);
        endSession();
        localStorage.removeItem('tutorboard-active-chat');
      } else {
        // Update sidebar history
        syncChatHistory(prev => prev.map(s => isThisChat(s) ? { ...s, messages: updatedMessages } : s));
      }
    }

    // 3. Restore the targeted user prompt text directly back into the InputBar
    if (content) {
      setPrompt(content);
      setTimeout(() => {
        const el = document.querySelector('textarea[placeholder*="Ask anything"]') || document.querySelector('textarea');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 60);
    }

    // 4. Close both the modal and floating banner
    setUndoConfirmModal(null);
    setLastSubmittedPrompt(null);

    useTutorStore.getState().showToast({
      message: 'Message restored to chat box',
      type: 'info',
      duration: 3000
    });
  }, [undoConfirmModal, activeChatId, syncChatHistory, clearConversation, endSession]);

  const handleUndoMessage = useCallback((targetMsgId = null, targetContent = null) => {
    // Resolve from parameters or lastSubmittedPrompt state
    const msgId = typeof targetMsgId === 'string' ? targetMsgId : (lastSubmittedPrompt?.messageId || targetMsgId);
    let textToRestore = typeof targetContent === 'string' ? targetContent : lastSubmittedPrompt?.text;

    const msgs = useTutorStore.getState().conversationMessages || [];
    const idx = msgs.findIndex(m => m.id?.toString() === msgId?.toString() || m._id?.toString() === msgId?.toString());
    
    // Fallback lookup if string missing
    if (idx !== -1 && !textToRestore) {
      textToRestore = msgs[idx].content;
    }

    if (idx === -1 && !msgId) {
      return;
    }

    // Determine affected sub-array starting from target index to the end
    const affectedMessages = idx !== -1 ? msgs.slice(idx) : (lastSubmittedPrompt ? [{ role: 'user', content: textToRestore }] : []);
    const sid = activeChatId || useTutorStore.getState().getSid();

    // Open clean restore confirmation on the left panel
    setUndoConfirmModal({
      messageId: msgId,
      content: textToRestore,
      affectedCount: affectedMessages.length,
    });
  }, [lastSubmittedPrompt]);

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
    useTutorStore.getState().clearArtifacts();
    setActiveChatId(null);
    setPrompt(''); 
    endSession(); 
    localStorage.removeItem('tutorboard-active-chat');
  };
  const handleSelectChat = async (id) => {
    activeChatIdRef.current = id; // late responses for other chats check this
    setActiveChatId(id);
    setActiveView('chat');
    markSessionRead(id);
    
    // Switch active artifacts to the selected session
    useTutorStore.getState().switchSessionArtifacts(id);
    
    // 1. Immediate local restore (minimal snapshot)
    const localSession = chatHistory.find(s => s.id === id);
    if (localSession) {
      import.meta.env.DEV && console.log(`[Home] Restoring local session: ${id} (${localSession.messages?.length || 0} messages)`);
      
      // Populate conversation slice with session messages
      if (localSession.messages?.length > 0) {
        setConversationMessages(localSession.messages, id);
      } else {
        clearConversation();
        useTutorStore.getState().setActiveConversationSession(id);
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
      if (localSession.annotations) {
        useAnnotationStore.getState().setSessionAnnotations(id, localSession.annotations);
      } else {
        useAnnotationStore.getState().setSession(id);
      }
    } else {
      useAnnotationStore.getState().setSession(id);
    }

    // Both authenticated users and guests restore full state from cloud
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id || '');
    if (id && isMongoId && !id.startsWith('session-')) {
      // Latest selection wins: cancel the previous chat's load instead of
      // skipping this one (skipping left the wrong chat's history on screen).
      if (selectFetchAbortControllerRef.current) {
        selectFetchAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      selectFetchAbortControllerRef.current = controller;
      selectFetchLockRef.current = true;

      useTutorStore.setState({ isMessagesLoading: true, lastAIError: null });
      try {
        import.meta.env.DEV && console.log(`[Home] 🔄 Fetching full pedagogical state for session ${id}...`);
        const response = await API.get(`/api/sessions/${id}`, { signal: controller.signal });
        
        // The learner moved on while this was loading: don't paint it over the new chat.
        if (activeChatIdRef.current !== id) return;

        if (response.status === 200) {
          const fullData = response.data;
          if (fullData) {
            let steps = fullData.canvasSteps || fullData.steps || [];
            
            // Check for latest assistant message with visual artifact / canvas snapshot if direct steps are empty
            let latestVisualMsg = null;
            if (Array.isArray(fullData.messages)) {
              for (let i = fullData.messages.length - 1; i >= 0; i--) {
                const m = fullData.messages[i];
                if (m.role === 'assistant' && (m.canvasSnapshot || m.metadata?.visuals || m.hasCanvas)) {
                  latestVisualMsg = m;
                  break;
                }
              }
            }

            const visualSnapshot = fullData.canvasSnapshot || latestVisualMsg?.canvasSnapshot || latestVisualMsg?.metadata?.visuals;
            if (steps.length === 0 && visualSnapshot) {
              steps = visualSnapshot.canvasSteps || visualSnapshot.steps || [];
            }

            import.meta.env.DEV && console.log(`[Home] ✅ Full state fetched. Restoring timeline (${steps.length} steps)...`);

            // Where the learner was in each of this conversation's lessons (step and sliders)
            if (Array.isArray(fullData.artifacts)) {
              for (const a of fullData.artifacts) {
                if (a?.lessonProgress && (a.id || a._id)) useTutorStore.getState().rememberLessonPosition(String(a.id || a._id), a.lessonProgress);
              }
            }

            // Restore actual pedagogical timeline or direct canvas drawings
            if (visualSnapshot?.sceneV2 || visualSnapshot?.renderer === 'scene-v2' || visualSnapshot?.rendererType === 'scene-v2') {
              const lessonId = latestVisualMsg?.metadata?.artifactId || null;
              // reopened where the learner left it, paused (never replayed from the top)
              const start = resolveStartStep(lessonId ? useTutorStore.getState().lessonPositions[lessonId] : null, steps.length > 0 ? steps.length : 1);
              useTutorStore.getState().setTimeline({
                ...fullData,
                title: visualSnapshot.title || fullData.title || localSession?.title || 'Saved Session',
                domain: visualSnapshot.domain || 'general',
                renderer: 'scene-v2',
                sceneV2: visualSnapshot.sceneV2,
                steps: steps.length > 0 ? steps : [{}],
                timeline: steps.length > 0 ? steps : [{}],
                objects: fullData.canvasState || [],
                artifactId: lessonId,
                currentStepIndex: start.step,
              });
              if (latestVisualMsg?.id) {
                useTutorStore.getState().setActiveSnapshotId(latestVisualMsg.id);
              }
            } else if (steps.length > 0) {
              useTutorStore.getState().setTimeline({
                ...fullData,
                title: visualSnapshot?.title || fullData.title || localSession?.title || 'Saved Session',
                timeline: steps,
                objects: fullData.canvasState || []
              });
              if (latestVisualMsg?.id) {
                useTutorStore.getState().setActiveSnapshotId(latestVisualMsg.id);
              }
            } else if (fullData.canvasState && Array.isArray(fullData.canvasState) && fullData.canvasState.length > 0) {
              useTutorStore.getState().setCanvasSnapshot({
                canvasObjects: fullData.canvasState,
                canvasSteps: [],
                totalSteps: 0,
                title: fullData.title || localSession?.title || 'Saved Session'
              });
            }

            if (fullData.pinnedNotes && Array.isArray(fullData.pinnedNotes)) {
              useTutorStore.setState({ pinnedNotes: fullData.pinnedNotes });
            }

            if (fullData.preferences && typeof fullData.preferences === 'object') {
              const p = fullData.preferences;
              useTutorStore.setState(state => ({
                drawColor: p.drawColor || state.drawColor,
                drawWidth: p.drawWidth || state.drawWidth,
                layoutView: p.layoutView || state.layoutView,
                gridType: p.gridType || state.gridType,
                gridSize: p.gridSize || state.gridSize,
                showGrid: typeof p.showGrid === 'boolean' ? p.showGrid : state.showGrid
              }));
            }

            // Restore complete chat history
            if (fullData.messages) {
              setConversationMessages(fullData.messages, id);
              // still being answered on the server (left mid-answer): follow it
              if (fullData.pendingRequest) useTutorStore.getState().followPendingGeneration(id);
            }

            // Restore artifacts associated with session
            if (fullData.artifacts && Array.isArray(fullData.artifacts)) {
              useTutorStore.getState().loadSessionArtifacts(fullData.artifacts, id);
            } else {
              API.get(`/api/artifact/session/${id}`, { signal: controller.signal })
                .then(artRes => {
                  if (activeChatIdRef.current === id && artRes.data) {
                    useTutorStore.getState().loadSessionArtifacts(artRes.data, id);
                  }
                })
                .catch(() => {});
            }

            // ── Bug A Fix: Restore actual doubts if they exist ──
            if (fullData.doubtHistory) {
              useTutorStore.setState({ doubtHistory: fullData.doubtHistory });
            }

            // Restore annotations (strokes, notes, highlights) from cloud
            if (fullData.annotations) {
              useAnnotationStore.getState().setSessionAnnotations(id, fullData.annotations);
            }

            // Sync with local history so the sidebar/main preview is also updated
            syncChatHistory(prev => prev.map(s => s.id === id ? {
              ...s,
              title: fullData.title,
              messages: fullData.messages,
              canvasState: fullData.canvasState,
              canvasSteps: fullData.canvasSteps || fullData.steps || [],
              chatSessionId: fullData._id,
              annotations: fullData.annotations || s.annotations,
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
        if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        if (activeChatIdRef.current !== id) return;
        console.error('[Home] Failed to fetch full session details:', err);
        // If session was not found on the remote server (e.g. guest or local-only session), don't alarm with a harsh error if local messages exist
        const hasLocalMessages = localSession?.messages && localSession.messages.length > 0;
        if (err.response?.status === 404 && hasLocalMessages) {
          // Local session exists and is fine; silently keep local messages
          useTutorStore.setState({ lastAIError: null });
        } else {
          useTutorStore.setState({
            lastAIError: {
              message: err.response?.status === 404
                ? 'Conversation not found on the server. Continuing with local copy.'
                : 'Some messages in this conversation could not be loaded.',
              code: err.response?.status === 404 ? 'SESSION_NOT_FOUND' : 'FETCH_ERROR',
              sessionId: id,
            }
          });
        }
      } finally {
        selectFetchLockRef.current = false;
        if (selectFetchAbortControllerRef.current === controller) {
          selectFetchAbortControllerRef.current = null;
        }
        if (selectFetchAbortControllerRef.current === null || activeChatIdRef.current === id) {
          useTutorStore.setState({ isMessagesLoading: false });
        }
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
      syncChatHistory(prev => prev.filter(c => c.id !== id));
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
        if ((isAuthenticated || isGuest) && dbId && !dbId.startsWith('session-') && !dbId.startsWith('msg-')) {
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
          syncChatHistory(prev => {
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
    syncChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    
    // Persistent cloud update
    if ((isAuthenticated || isGuest) && id && !id.startsWith('msg-')) {
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
      const msg = session.messages?.find(m => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
      if (msg?.canvasSnapshot) {
        snapshot = msg.canvasSnapshot;
      } else if (msg?.metadata?.visuals) {
        snapshot = msg.metadata.visuals;
      } else if (msg?.metadata?.artifactData) {
        snapshot = msg.metadata.artifactData;
      }
    }

    // 2. Fallback: Try conversationMessages from the store
    if (!snapshot) {
      const storeMsg = useTutorStore.getState().conversationMessages.find(m => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
      if (storeMsg?.canvasSnapshot) {
        snapshot = storeMsg.canvasSnapshot;
      } else if (storeMsg?.metadata?.visuals) {
        snapshot = storeMsg.metadata.visuals;
      } else if (storeMsg?.metadata?.artifactData) {
        snapshot = storeMsg.metadata.artifactData;
      }
    }

    // 3. Fallback: Try artifacts list from the store
    if (!snapshot) {
      const art = useTutorStore.getState().artifacts?.find(a => a.id === messageId || a.dbId === messageId || a.messageId === messageId);
      if (art) {
        snapshot = art.sceneV2 ? { ...art, renderer: 'scene-v2' } : (art.sceneGraph || art);
      }
    }

    // 4. Final fallback: Use the current live canvas state from the store
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
          ...(store.activeScene?.sceneV2 ? { sceneV2: store.activeScene.sceneV2, domain: store.activeScene.domain } : {}),
        };
        import.meta.env.DEV && console.log('[Home] Using live store state as canvas snapshot fallback');
      }
    }

    if (snapshot) {
      const store = useTutorStore.getState();
      const isCurrentlyActive = store.activeSnapshotId === messageId;
      // The lesson's saved id: the learner's place in it is kept against it
      const sameMsg = (m) => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString();
      const lessonMsg = store.conversationMessages.find(sameMsg) || session?.messages?.find(sameMsg);
      const artifactId = lessonMsg?.metadata?.artifactId || null;
      const lessonSteps = snapshot.steps || snapshot.canvasSteps || snapshot.timeline || [];
      // Reopen where the learner left off (paused there — never replayed from the top)
      const start = resolveStartStep(artifactId ? store.lessonPositions[artifactId] : null, lessonSteps.length);
      if (start.changed) {
        store.showToast?.({ message: 'This lesson was updated, so it starts from the first step.', type: 'info', duration: 3500 });
      }
      
      if (isCurrentlyActive && store.canvasLayout !== 'inline') {
        // Toggle CLOSE: If already active and visible, hide it
        store.setCanvasLayout('inline');
        store.setActiveSnapshotId(null);
        import.meta.env.DEV && console.log('[Home] Canvas closed for message:', messageId);
      } else {
        // OPEN / SWITCH: Show canvas and set snapshot
        if (snapshot.sceneV2 || snapshot.renderer === 'scene-v2' || snapshot.rendererType === 'scene-v2') {
          store.setTimeline({
            ...snapshot,
            renderer: 'scene-v2',
            sceneV2: snapshot.sceneV2,
            steps: snapshot.steps || snapshot.canvasSteps || [{}],
            timeline: snapshot.steps || snapshot.canvasSteps || [{}],
            artifactId,
            currentStepIndex: start.step,
          });
        } else {
          setCanvasSnapshot({
            ...snapshot,
            artifactId,
            currentStepIndex: start.step,
          });
        }
        store.setActiveSnapshotId(messageId);
        store.setCanvasLayout('split');
        import.meta.env.DEV && console.log('[Home] Canvas snapshot opened for message:', messageId);
      }
    } else {
      console.warn('[Home] No canvas data found for message:', messageId);
    }
  };

  const handleOpenArtifactFromCode = useCallback((code, lang, opts = {}) => {
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
      'cpp': 'cpp', 'c++': 'cpp', 'cc': 'cpp',
      'c': 'c', 'h': 'c',
      'java': 'java',
    };
    const normalizedLang = langMap[lang?.toLowerCase()] || lang || 'javascript';

    // Open in the code editor; `visualize` starts the step-through straight away.
    setCodeEditorData(code, normalizedLang, {
      sessionId: activeChatIdRef.current || null,
      messageId: opts.messageId || null,
      autoVisualize: !!opts.visualize,
    });
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

  /**
   * The single submission path for chat messages.
   *
   * `retry` re-sends a failed request: { requestId, userMessageId, text }. The
   * same requestId lets the server reuse the user message it already saved (and
   * a stored answer, if only saving failed) instead of creating duplicates.
   */
  const handleSubmit = async (textOverride, fileData = null, modeOverride = null, isRegeneration = false, targetAssistantId = null, editMessageId = null, retry = null) => {
    // ── 0. Capture State before potential resets ──
    // A lesson is "live" in any state where its canvas is on screen and the
    // server can accept a doubt about it (including PAUSED — pause-then-ask is
    // the natural doubt flow).
    const isTeachingActive = machine.isTeaching || machine.isGenerating || machine.isDoubtTriggered
      || machine.isResponding || machine.isResuming || machine.machineState === 'PAUSED';
    const currentActiveChatId = activeChatId;
    const routesToDoubt = isTeachingActive && !isRegeneration && !editMessageId && !retry;

    // ── Duplicate-submission guard ──
    // One chat generation per conversation at a time. The ref is synchronous, so
    // a double click / repeated Enter in the same tick is caught before any
    // state or network work happens (the draft stays in the composer).
    if (!routesToDoubt) {
      const st = useTutorStore.getState();
      const inFlightKey = currentActiveChatId || st.chatSessionId || st.sessionId;
      if (inFlightKey && submittingSessionsRef.current.has(inFlightKey)) {
        import.meta.env.DEV && console.warn('[Home] Submission ignored: a response is already being generated for', inFlightKey);
        st.showToast?.({ message: 'Wait for the current answer to finish, or press Stop.', type: 'info', duration: 2500 });
        return;
      }
    }

    // An Engine v2 lesson on screen: the question is answered on its board (a
    // branch of the lesson), so it travels with the request and the lesson
    // stays exactly where it is.
    const tutor = useTutorStore.getState();
    const lessonOnScreen = !routesToDoubt && !isRegeneration && !editMessageId && !fileData
      && tutor.activeScene?.renderer === 'scene-v2' && !!tutor.activeScene?.sceneV2
      && !tutor.activeScene?.streaming && tutor.canvasLayout !== 'inline';
    const lessonContext = lessonOnScreen
      ? (tutor.sceneBranch
        ? { scene: tutor.sceneBranch.scene, beatIndex: tutor.sceneBranch.at }
        : { scene: tutor.activeScene.sceneV2, beatIndex: tutor.currentStepIndex })
      : undefined;
    if (lessonContext) tutor.holdLessonForQuestion();

    // Only reset the teaching machine when this submission is NOT a doubt about
    // the live lesson — cancelling first wiped the canvas the doubt refers to.
    if (!routesToDoubt && !lessonContext) machine.cancelSession();
    const { selectedTextContext, setSelectedTextContext, getPlatformMemorySummary } = useTutorStore.getState();
    const finalContext = selectedTextContext;
    const platformMemory = getPlatformMemorySummary ? getPlatformMemorySummary() : null;

    // FIX: Generate the working session ID and set it in the store immediately.
    // This prevents useSessionSync from generating a conflicting 'local-xxx' ID.
    const store = useTutorStore.getState();
    const storeSessionId = store.chatSessionId || store.sessionId;
    let workingSessionId = currentActiveChatId || storeSessionId;
    
    if (!workingSessionId && !isRegeneration) {
      workingSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      store.setChatSessionId(workingSessionId);
      store.setSessionId(workingSessionId);
    } else if (!workingSessionId && isRegeneration) {
       // Should not happen, but safety fallback
       workingSessionId = `session-regen-${Date.now()}`;
    }
    
    import.meta.env.DEV && console.log('[Home] SUBMIT TRIGGERED', { textOverride, workingSessionId });

    const originalRawPrompt = retry?.text || textOverride || prompt.trim();
    let userPrompt = originalRawPrompt;
    
    // If we have context but NO user prompt, we might want a default question
    if (!userPrompt && finalContext) {
      userPrompt = `Explain this: "${finalContext}"`;
    } else if (finalContext) {
      // Prepend context to the prompt or send as separate field if API supports it
      // For now, we'll prepend it in a clean way for the AI to see
      userPrompt = `Context: "${finalContext}"\n\nQuestion: ${userPrompt}`;
    }

    if (!userPrompt && !fileData && !finalContext) {
      import.meta.env.DEV && console.warn('[Home] Empty submission blocked');
      return;
    }

    import.meta.env.DEV && console.log('[Home] 🚀 Starting submission for session:', workingSessionId, 'Prompt:', userPrompt);

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
      useTutorStore.getState().setTopic('New Chat');
    }

    // Every key this submission is known by (temp key, then the server id) so the
    // duplicate guard holds across the id promotion and is fully released after.
    const inFlightKeys = new Set([workingSessionId]);
    submittingSessionsRef.current.add(workingSessionId);
    activeChatIdRef.current = workingSessionId; // SYNC IMMEDIATELY to catch first stream chunks
    const streamToken = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Idempotency key: new for every intentional submission, the same for a retry of it.
    const clientRequestId = retry?.requestId || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    chatTimings.start(clientRequestId);

    setPrompt('');  // Clear input immediately
    setSelectedTextContext(null); // Clear context immediately
    setActiveView('chat');

    let activityMonitor;
    let pacer = null;           // paces streamed answer text (created once the stream opens)
    let assistantMsgId = null;
    let clientRequestIdRef = null;   // set once the request is built (for retry)
    let localUserMessageIdRef = null;
    try {
      let userId;
      let sessionTitle = activeSession?.title;

      // ── 1. Add user message ONLY if not regenerating ──
      // Note: If we are editing (editMessageId is set), applyEdit has already mutated the store
      // so we should treat it as a regeneration flow and NOT append a duplicate user message!
      // A retry re-uses the user message that is already on screen.
      if (retry) {
        userId = retry.userMessageId;
        useTutorStore.getState().prepareRetry?.(retry.requestId, workingSessionId);
      } else if (!isRegeneration && !editMessageId) {
        const result = addUserMessage(userPrompt, workingSessionId);
        userId = result.messageId || result.userId;
        chatTimings.markAfterPaint(clientRequestId, 'user_message_rendered');

        setLastSubmittedPrompt({
          text: originalRawPrompt,
          messageId: userId,
          sessionId: workingSessionId,
          timestamp: Date.now()
        });

        // ── Provisional Title: Keep as 'New Chat' until the assistant's first response completes ──
        const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session' || t === 'New Chat';
        const currentTitle = activeSession?.title;
        sessionTitle = isGeneric(currentTitle) ? 'New Chat' : currentTitle;
        
        // Update local chat history for sidebar display
        syncChatHistory(prev => {
          // One sidebar entry per conversation: update it in place (keeping its
          // earlier messages) and move it to the top.
          const existing = prev.find(s => s.id === workingSessionId);
          const otherSessions = prev.filter(s => s.id !== workingSessionId);
          const userMessage = { 
            id: userId, role: 'user', content: userPrompt, 
            timestamp: new Date().toISOString(), file: fileData,
            metadata: { edited: false, regenerated: false, feedback: null },
          };
          const updated = {
            ...(existing || {}),
            id: workingSessionId,
            title: sessionTitle,
            messages: [...(existing?.messages || []), userMessage],
            updatedAt: Date.now(),
          };
          return [updated, ...otherSessions];
        });
      }

      // ── 2. Determine if this is a teaching-related query ──
      // If a teaching session is active, route all chat input to the doubt pipeline
      // We use the captured isTeachingActive from the start of the function
      if ((activeMode === 'deep' || isTeachingActive) && !isRegeneration && !editMessageId && !retry) {
        // A doubt needs a live lesson to refer to. (activeChatId is always set
        // once the socket connects, and history already contains the message
        // just added, so those can't distinguish a first question from a doubt.)
        const isFollowUp = routesToDoubt;

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
      clientRequestIdRef = clientRequestId;
      localUserMessageIdRef = userId;

      // ── 3. Call the SSE Streaming Chat API ──
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'X-Request-Id': clientRequestId
        },
        body: JSON.stringify({
          // The conversation key: a server id, or the client key of a conversation
          // the server hasn't confirmed yet. The server resolves the same key to the
          // same conversation, so a first message (or its retry) can't fork a second one.
          sessionId: workingSessionId,
          title: sessionTitle || 'New Chat',
          requestId: clientRequestId,
          userMessage: userPrompt,
          mode: modeOverride || activeMode || 'quick',
          modelId: selectedAgent,
          teachingContext: {
            currentTopic: conversationTopic || undefined,
            explanationMode: 'basic',
            // from their "predict the next step" answers this session (5.2)
            learnerLevel: learnerLevelFrom(useTutorStore.getState().checkStats),
          },
          platformMemory,
          isRegeneration,
          isRegenerate: !!isRegeneration, // the server's field name (without it a regenerate saved a duplicate user message)
          messageId: editMessageId,
          newContent: editMessageId ? userPrompt : undefined,
          ...(lessonContext ? { lessonContext } : {}),
        }),
        credentials: 'include'
      };
      
      const streamEndpoint = editMessageId ? '/api/chat/edit/stream' : '/api/chat/stream';
      
      isArtifactExpectedRef.current = false;
      // ── 2. Handle Abort Signals ──
      if (abortControllersRef.current.has(workingSessionId)) {
        stopServerGeneration(abortControllersRef.current.get(workingSessionId), workingSessionId);
        abortControllersRef.current.get(workingSessionId).abort();
      }
      const controller = new AbortController();
      controller.requestId = clientRequestId; // lets Stop name this answer to the server
      abortControllersRef.current.set(workingSessionId, controller);
      const { signal } = controller;
      fetchOptions.signal = signal;

      chatTimings.mark(clientRequestId, 'assistant_request_started');
      // A guest's first question may create their identity: never alongside another one
      const releaseIdentity = await acquireIdentitySlot(streamEndpoint);
      fetchOptions.headers = { ...fetchOptions.headers, ...getAuthHeaders() };
      const res = await fetch(`${API_URL}${streamEndpoint}`, fetchOptions)
        .then((r) => { storeGuestToken(r.headers); return r; }) // stored before the next request's turn
        .finally(releaseIdentity)
        .catch(e => {
        if (e.name === 'AbortError' || e.message?.includes('aborted')) {
          // Skip setting name to avoid read-only property error
          throw e; 
        }
        console.error('[Chat:Stream] Network/Proxy error:', e);
        throw new ChatRequestError('NETWORK', undefined, { retryable: true });
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw fromServerError(errData, res.status);
      }

      // Capture guest token issued by backend into localStorage as fallback
      storeGuestToken(res.headers);

      // ── 4. Real SSE Streaming ──
      clearSources();
      // One stable id for this answer: the placeholder, every chunk and the final
      // message all use it until the server's id replaces it (message_ids).
      assistantMsgId = targetAssistantId || getMsgId('assistant');
      storeStartStreaming(assistantMsgId, workingSessionId, streamToken, clientRequestId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let bufferedContent = ''; // Buffer for JSON artifact responses
      let thoughtContent = '';
      let receivedSessionId = null;
      let streamEnded = false;
      let serverAssistantId = null; // the server's `end` event — without it the answer is incomplete
      let lastArtifactLocalId = null;
      let lastEventType = 'message';

      // ── STREAM PACING ──
      // Answer text is revealed a little every frame (see lib/streamPacer) so
      // provider-sized bursts read as a steady flow; it always goes to this
      // stream's own conversation, not whichever one is on screen.
      pacer = createStreamPacer((text) => {
        appendStreamChunk(text, workingSessionId, streamToken);
        if (!chatTimings.has(clientRequestId, 'first_assistant_token_rendered')) {
          chatTimings.markAfterPaint(clientRequestId, 'first_assistant_token_rendered');
        }
      });
      const flushBuffers = () => pacer.flush();

      let lastActivityTime = Date.now();
      activityMonitor = setInterval(() => {
        if (Date.now() - lastActivityTime > 45000) {
          console.error('[Home] Stream stalled (45s silence)');
          controller.abort();
        }
      }, 5000);

        await processSSEStream(reader, (eventType, eventData, dataStr, isRawString) => {
          if (isRawString) {
            // Not JSON data, could be raw string
            if (eventType === 'message' && !dataStr.startsWith('{')) {
              fullContent += dataStr;
              pacer.push(dataStr);
              if (workingSessionId !== activeChatIdRef.current) addUnreadSession(workingSessionId);
            }
            return;
          }

          // Any event proves the server is alive and still working — reset the
          // stall watchdog. Heartbeats (sent every 15s) exist precisely to keep
          // the connection alive during long operations like scene orchestration;
          // ignoring them here made a busy-but-alive server look stalled, so the
          // client aborted mid-generation and the visual scene (delivered at the
          // very end of the stream) was lost. The 45s watchdog now only fires when
          // the server genuinely goes silent (dead process / dropped connection).
          lastActivityTime = Date.now();
          import.meta.env.DEV && console.log(`[SSE] Received event: ${eventType}`, eventData);

          if (eventType === 'end') {
            streamEnded = true;
            return;
          }

          if (eventType === 'meta') {
            const newDbId = eventData.sessionId;
            if (newDbId && newDbId !== workingSessionId && newDbId !== receivedSessionId) {
              receivedSessionId = newDbId;
              inFlightKeys.add(newDbId);
              submittingSessionsRef.current.add(newDbId);
              
              // CRITICAL HOTFIX: Promote session immediately to prevent DB duplication if stream crashes
              const { migrateSessionState } = useTutorStore.getState();
              migrateSessionState(workingSessionId, receivedSessionId);
              
              const existingController = abortControllersRef.current.get(workingSessionId);
              if (existingController) {
                abortControllersRef.current.set(receivedSessionId, existingController);
                abortControllersRef.current.delete(workingSessionId);
              }
              
              if (activeChatIdRef.current === workingSessionId) {
                setActiveChatId(receivedSessionId);
                useTutorStore.getState().setChatSessionId(receivedSessionId);
                activeChatIdRef.current = receivedSessionId;
              }
              
              syncChatHistory(prev => {
                const otherSessions = prev.filter(s => s.id !== workingSessionId && s.id !== receivedSessionId);
                const s = prev.find(s => s.id === workingSessionId) || { messages: [], title: sessionTitle };
                return [{ ...s, id: receivedSessionId, chatSessionId: receivedSessionId }, ...otherSessions];
              });
              
              workingSessionId = receivedSessionId; // update local pointer for subsequent chunks
            }
            useTutorStore.getState().handleProgressiveStreamEvent(eventData);
          } else if (eventType === 'progress') {
            // What the server is doing for this request (chat status line), and
            // for the lesson stage, the canvas lifecycle
            useTutorStore.getState().applyRequestProgress(eventData, workingSessionId, streamToken);
            useTutorStore.getState().handleProgressiveStreamEvent(eventData);
          } else if (eventType === 'canvas_skeleton' || eventType === 'scene_nodes' || eventType === 'scene_v2' || eventType === 'scene_branch' || eventType === 'scene_failed') {
            // the message's card shows what was actually drawn, not the planner's guess
            if (eventType === 'scene_v2' || eventType === 'scene_branch') currentCanvasTypeRef.current = 'scene-v2';
            if (eventType === 'scene_failed') currentCanvasTypeRef.current = null;
            useTutorStore.getState().handleProgressiveStreamEvent(eventData);
            if (eventType === 'scene_v2' || eventType === 'scene_nodes' || eventType === 'scene_branch') {
              chatTimings.mark(clientRequestId, eventType === 'scene_v2' && eventData.partial ? 'artifact_specification_received' : 'artifact_ready');
              chatTimings.markAfterPaint(clientRequestId, 'first_artifact_frame_rendered');
            }
          } else if (eventType === 'chunk' || eventType === 'message') {
            const text = eventData.chunk || eventData.content || (typeof eventData === 'string' ? eventData : '');
            
            if (text) {
              fullContent += text;
              chatTimings.mark(clientRequestId, 'first_assistant_token_received');
              // Chunks always go to this stream's own conversation (keyed store), so
              // switching chats mid-answer neither leaks them into the chat on screen
              // nor loses them for when the learner comes back.
              if (isArtifactExpectedRef.current) {
                flushBuffers();
                appendStreamChunk(text, workingSessionId, streamToken);
              } else {
                pacer.push(text);
              }
              if (workingSessionId !== activeChatIdRef.current) addUnreadSession(workingSessionId);
            }
          } else if (eventType === 'thought' || eventType === 'status') {
            const thought = eventData.thought || eventData.message || eventData.content || '';
            const thoughtStr = thought + (eventType === 'status' ? '\n' : '');
            thoughtContent += thoughtStr;
            appendStreamThought(thoughtStr, workingSessionId, streamToken);
          } else if (eventType === 'sources') {
            setSources(eventData.sources || [], workingSessionId);
          } else if (eventType === 'message_ids') {
            // Sync local ephemeral IDs with real MongoDB IDs (Fixed: Bug 2)
            const userMessageId = eventData.userMessageId || eventData.data?.userMessageId;
            const assistantMessageId = eventData.assistantMessageId || eventData.data?.assistantMessageId;
            const currentSessionId = workingSessionId; // the stream's own conversation, not the one on screen
            
            if (currentSessionId === activeChatIdRef.current) {
              syncMessageIds(userMessageId, assistantMessageId, userId, assistantMsgId);
            }
            if (assistantMessageId) serverAssistantId = assistantMessageId;
            
            syncChatHistory(prev => prev.map(s => {
              if (s.id === currentSessionId || s.id === receivedSessionId) {
                const msgs = [...s.messages];
                let changed = false;
                
                // Update exactly the messages that match the ephemeral IDs we sent
                const uIdx = userId ? msgs.findIndex(m => m.id === userId) : -1;
                if (uIdx !== -1 && userMessageId) {
                  msgs[uIdx] = { ...msgs[uIdx], id: userMessageId };
                  changed = true;
                } else if (!userId && userMessageId && msgs.length >= 2) {
                  // Fallback for older code that didn't pass userId
                  msgs[msgs.length - 2] = { ...msgs[msgs.length - 2], id: userMessageId };
                  changed = true;
                }
                
                const aIdx = assistantMsgId ? msgs.findIndex(m => m.id === assistantMsgId) : -1;
                if (aIdx !== -1 && assistantMessageId) {
                  msgs[aIdx] = { ...msgs[aIdx], id: assistantMessageId };
                  changed = true;
                } else if (!assistantMsgId && assistantMessageId && msgs.length >= 1) {
                   // Fallback
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: assistantMessageId };
                  changed = true;
                }
                
                return changed ? { ...s, messages: msgs } : s;
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
              }, workingSessionId);
              
              finalizeStreamingArtifact(null, workingSessionId);

              // Only open the panel for the FIRST artifact in a multi-artifact response, and only if user is actively viewing this session
              if (!lastArtifactLocalId && activeChatIdRef.current === workingSessionId) {
                setActiveArtifact(localId);
                
                // Do not open the side panel for visual/canvas artifacts
                const visualTypes = ['diagram', 'graph', 'cinematic', 'plot', 'desmos', 'algorithm', 'dsa', 'node_map', 'canvas', 'scene'];
                if (!visualTypes.includes(art.type?.toLowerCase())) {
                  openArtifactPanel();
                }
              }

              lastArtifactLocalId = localId;

              // Store artifact ID for later linkage to the assistant message
              lastArtifactIdRef.current = localId;

              // Attach this artifact ID to the CURRENT assistant message metadata if it exists
              const currentSessionId = workingSessionId; // the stream's own conversation, not the one on screen
              syncChatHistory(prev => prev.map(s => {
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
            if (eventData.artifactId) {
              lastArtifactIdRef.current = eventData.artifactId;
              if (savedLocalId) {
                setArtifactDbId(savedLocalId, eventData.artifactId, workingSessionId);
              }
              
              // Update message metadata to reflect the real ID
              syncChatHistory(prev => prev.map(s => {
                if (s.id === (receivedSessionId || workingSessionId)) {
                  const msgs = [...s.messages];
                  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                    msgs[msgs.length - 1] = {
                      ...msgs[msgs.length - 1],
                      hasCanvas: true,
                      canvasType: eventData.rendererType || msgs[msgs.length - 1].canvasType,
                      metadata: {
                        ...msgs[msgs.length - 1].metadata,
                        artifactId: eventData.artifactId,
                        hasVisualArtifact: true,
                        rendererType: eventData.rendererType || msgs[msgs.length - 1].metadata?.rendererType
                      }
                    };
                  }
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            }
          } else if (eventType === 'metadata') {
            const meta = eventData.data || eventData;
            const artifactId = meta.artifactId || meta.metadata?.artifactId || lastArtifactIdRef.current;
            if (artifactId) {
              lastArtifactIdRef.current = artifactId;
            }
            const visuals = meta.visuals || meta.metadata?.visuals;
            const rendererType = meta.rendererType || meta.metadata?.rendererType;
            
            syncChatHistory(prev => prev.map(s => {
              if (s.id === (receivedSessionId || workingSessionId)) {
                const msgs = [...s.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = {
                    ...msgs[msgs.length - 1],
                    hasCanvas: !!(visuals || rendererType || msgs[msgs.length - 1].hasCanvas),
                    canvasType: rendererType || msgs[msgs.length - 1].canvasType,
                    metadata: {
                      ...msgs[msgs.length - 1].metadata,
                      ...(artifactId ? { artifactId } : {}),
                      ...(visuals ? { visuals, hasVisualArtifact: true } : {}),
                      ...(rendererType ? { rendererType } : {})
                    }
                  };
                }
                return { ...s, messages: msgs };
              }
              return s;
            }));
          } else if (eventType === 'chat_override') {
            const currentSessionId = workingSessionId; // the stream's own conversation, not the one on screen
            if (currentSessionId === activeChatIdRef.current) {
              updateStreamingContent(eventData.content, currentSessionId, streamToken);
            } else {
              addUnreadSession(currentSessionId);
            }
            fullContent = eventData.content;
            syncChatHistory(prev => prev.map(s => {
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
            throw fromServerError(eventData);
          }
        });

      // A stream that closes without the server's `end` event was cut off
      // (proxy timeout, server crash, network drop): never show it as complete.
      if (!streamEnded) {
        throw new ChatRequestError('STREAM_INTERRUPTED', undefined, { retryable: true });
      }

    flushBuffers(); // FINAL FLUSH of any remaining tokens
      chatTimings.finish(clientRequestId, 'completed');
      import.meta.env.DEV && console.log("FULL RESPONSE (Client):", fullContent);

      // ── 5. Finalize streaming ──
      const finalSessionId = workingSessionId;
      const isOnScreen = activeChatIdRef.current === finalSessionId;
      finishStreaming(fullContent, finalSessionId, thoughtContent, lastStreamSources, lastArtifactIdRef.current, currentCanvasTypeRef.current, Date.now() - requestStartTime, streamToken, isRegeneration);
      lastArtifactIdRef.current = null; // Reset for next turn
      currentCanvasTypeRef.current = null;

      // ── Smart Title Finalization: Generate after first agent response ──
      const isGeneric = (t) => !t || t === 'Untitled Session' || t === 'New Session' || t === 'Canvas Session' || t === 'Saved Session' || t === 'New Chat';
      const existingSession = chatHistory.find(s => s.id === finalSessionId || s.id === receivedSessionId || s.chatSessionId === finalSessionId);
      let finalizedTitle = existingSession?.title;
      if (isGeneric(finalizedTitle) || !finalizedTitle) {
        finalizedTitle = generateCleanTitle(userPrompt);
      }
      useTutorStore.getState().setTopic(finalizedTitle);

      // ── 6. Sidebar copy of THIS conversation ──
      if (isOnScreen) {
        const finalMessages = useTutorStore.getState().conversationMessages;
        syncChatHistory(prev => prev.map(s =>
          (s.id === finalSessionId || s.id === receivedSessionId || s.chatSessionId === finalSessionId) 
            ? { ...s, id: finalSessionId, title: finalizedTitle, chatSessionId: receivedSessionId || s.chatSessionId || finalSessionId, messages: finalMessages, updatedAt: Date.now() } 
            : s
        ));
        // Title / canvas / guest local history (messages are already saved server side)
        saveCurrentSession(finalMessages, finalSessionId, finalizedTitle)
          .catch(err => console.error('[Home] Background persistence failed:', err));
      } else if (!isRegeneration && !editMessageId) {
        // Answered in the background: append to that conversation only.
        const answer = { id: serverAssistantId || assistantMsgId, role: 'assistant', content: fullContent, timestamp: new Date().toISOString(), metadata: { sources: lastStreamSources || [] } };
        syncChatHistory(prev => prev.map(s =>
          (s.id === finalSessionId || s.id === receivedSessionId || s.chatSessionId === finalSessionId) 
            ? { ...s, title: finalizedTitle, messages: [...(s.messages || []).filter(m => m.id !== answer.id), answer], updatedAt: Date.now() } 
            : s
        ));
        saveCurrentSession(null, finalSessionId, finalizedTitle)
          .catch(err => console.error('[Home] Background persistence failed:', err));
      }
    } catch (err) {
      const failedSessionId = workingSessionId;
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        // Stop was pressed: handleStopGeneration already kept the partial answer
        // (marked as stopped). Nothing else to undo — the canvas stays as it is.
        pacer?.cancel();
        chatTimings.finish(clientRequestId, 'cancelled');
        import.meta.env.DEV && console.log('[Home] AI request aborted by user.');
        useTutorStore.getState().setWaitingForAI(false, failedSessionId);
        return;
      }
      pacer?.flush();
      chatTimings.finish(clientRequestId, 'failed');
      console.error('[Home] handleSubmit failed:', err);
      // A TypeError from fetch/reader is the network: before the stream opened it
      // is "connection lost", after it the answer was cut off mid-way.
      const chatErr = err instanceof ChatRequestError ? err
        : err instanceof TypeError ? new ChatRequestError(assistantMsgId ? 'STREAM_INTERRUPTED' : 'NETWORK', undefined, { retryable: true })
        : new ChatRequestError('INTERNAL', undefined, { retryable: true });

      // Keep whatever streamed (marked failed) next to the error, and record what
      // a retry needs: the same requestId re-uses the saved user message.
      useTutorStore.getState().failStreaming?.({
        sessionId: failedSessionId,
        streamToken,
        assistantMessageId: assistantMsgId,
        error: {
          message: chatErr.message,
          code: chatErr.code,
          retryable: chatErr.retryable,
          retry: chatErr.retryable && clientRequestIdRef ? {
            requestId: clientRequestIdRef,
            userMessageId: localUserMessageIdRef,
            text: userPrompt,
          } : null,
        },
      });

      // Sync the sidebar copy with what is on screen
      const errorMessages = useTutorStore.getState().conversationMessages;
      syncChatHistory(prev => prev.map(s => 
        (s.id === workingSessionId || s.id === failedSessionId) ? { ...s, messages: errorMessages } : s
      ));
    } finally {
      if (activityMonitor) clearInterval(activityMonitor);
      inFlightKeys.add(workingSessionId);
      inFlightKeys.forEach(k => {
        submittingSessionsRef.current.delete(k);
        abortControllersRef.current.delete(k);
      });
    }
  };

  // ── Questions queued from the board ("ask about this") go out like typed ones ──
  const queuedQuestion = useTutorStore((s) => s.queuedQuestion);
  useEffect(() => {
    if (!queuedQuestion) return;
    useTutorStore.getState().queueQuestion(null);
    handleSubmit(queuedQuestion);
    // handleSubmit is a fresh closure each render; the question is what triggers this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedQuestion]);

  // ── Edit Message Handler (ChatGPT-style) ──
  const handleEditMessage = async (messageId, newContent) => {
    const updatedMessages = applyEdit(messageId, newContent);
    if (!updatedMessages) return;

    // After applyEdit(), always mark the message as edited locally
    useTutorStore.getState().setMessageMetadata(messageId, { edited: true });

    // Ensure the stream is triggered using the standard pipeline
    // Pass messageId as the 6th parameter (editMessageId) to route to /api/chat/edit/stream
    await handleSubmit(newContent, null, null, false, null, messageId);
  };

  // ── Regenerate Handler ──
  const handleRegenerateMessage = async (targetMsgId = null) => {
    // If no target provided, use the last assistant message ID
    let finalTargetId = targetMsgId;
    if (!finalTargetId) {
      const lastAssistant = [...conversationMessages].reverse().find(m => m.role === 'assistant');
      finalTargetId = (lastAssistant?.id || lastAssistant?._id)?.toString();
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

    if (submittingSessionsRef.current.has(dbSessionId)) {
      useTutorStore.getState().showToast?.({ message: 'Wait for the current answer to finish, or press Stop.', type: 'info', duration: 2500 });
      return;
    }
    submittingSessionsRef.current.add(dbSessionId);

    useTutorStore.getState().setWaitingForAI(true, dbSessionId);
    useTutorStore.setState({ lastAIError: null });

    // 1. Prepare UI for regeneration (adds a new empty version slot)
    const original = conversationMessages.find(m => m.id === finalTargetId)?.content;
    const clientRequestId = `regen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const streamToken = clientRequestId;
    prepareRegeneration(finalTargetId, clientRequestId);
    let regenPacer = null;
    
    try {
      if (isMongoId) {
        
        // Find the user message that triggered this assistant response
        let userMessageContent = '';
        const targetIdx = conversationMessages.findIndex(m => m.id === finalTargetId);
        if (targetIdx > 0) {
          // Search backwards from the assistant message to find the first user message
          for (let i = targetIdx - 1; i >= 0; i--) {
            if (conversationMessages[i].role === 'user') {
              userMessageContent = conversationMessages[i].content;
              break;
            }
          }
        }
        
        // Fallback to the latest user message if not found in context (safety)
        if (!userMessageContent) {
          const lastUser = [...conversationMessages].reverse().find(m => m.role === 'user');
          userMessageContent = lastUser?.content || '';
        }

        const body = {
          sessionId: dbSessionId,
          messageId: finalTargetId,
          // the server reads originalMessageId; without it, it re-answered the LAST message instead of this one
          ...(/^[0-9a-fA-F]{24}$/.test(finalTargetId || '') ? { originalMessageId: finalTargetId } : {}),
          requestId: clientRequestId,
          userMessage: userMessageContent, // FIX: Pass required userMessage
          modelId: selectedAgent,
          teachingContext: {
            currentTopic: conversationTopic || undefined,
            explanationMode: 'basic',
            learnerLevel: 'intermediate',
          }
        };

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            'X-Request-Id': clientRequestId
          },
          body: JSON.stringify(body),
          credentials: 'include'
        };

        const controller = new AbortController();
        controller.requestId = clientRequestId;
        abortControllersRef.current.set(dbSessionId, controller);
        fetchOptions.signal = controller.signal;

        const initialTimeout = setTimeout(() => {
          if (useTutorStore.getState().isWaitingForAI) {
            console.warn('[Home:Regen] Initial connection timeout (60s)');
            controller.abort();
          }
        }, 60000);

        const res = await fetch(`${API_URL}/api/chat/regenerate/stream`, fetchOptions).catch(e => {
          clearTimeout(initialTimeout);
          if (e.name === 'AbortError' || e.message?.includes('aborted')) {
            throw e; // Propagate aborts to outer catch
          }
          console.error('[Home:Regen] Fetch failed:', e);
          throw new ChatRequestError('NETWORK', undefined, { retryable: true });
        });

        clearTimeout(initialTimeout);
        import.meta.env.DEV && console.log('[Home:Regen] Response status:', res.status);
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw fromServerError(errData, res.status);
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
        storeStartStreaming(finalTargetId, dbSessionId, streamToken, clientRequestId);
        regenPacer = createStreamPacer((t) => appendStreamChunk(t, dbSessionId, streamToken));

        let lastStreamSources = [];
        let streamEnded = false;

        // Activity monitor to detect stalled streams (45s silence)
        const activityMonitor = setInterval(() => {
          if (Date.now() - lastActivityTime > 45000) {
            console.error('[Home:Regen] Stream stalled (45s silence)');
            controller.abort();
            clearInterval(activityMonitor);
          }
        }, 5000);

        try {
          await processSSEStream(reader, (eventType, eventData, dataStr, isRawString) => {
            if (isRawString) return;

            // Any event (heartbeats included) proves the server is alive — the
            // watchdog only fires when it goes genuinely silent.
            lastActivityTime = Date.now();
            if (eventType === 'end') { streamEnded = true; return; }

            if (eventType === 'progress') {
              useTutorStore.getState().applyRequestProgress(eventData, dbSessionId, streamToken);
              useTutorStore.getState().handleProgressiveStreamEvent(eventData);
            } else if (eventType === 'meta' || eventType === 'canvas_skeleton' || eventType === 'scene_nodes' || eventType === 'scene_v2' || eventType === 'scene_branch' || eventType === 'scene_failed') {
              useTutorStore.getState().handleProgressiveStreamEvent(eventData);
            } else if (eventType === 'chunk' || eventType === 'message') {
              const text = eventData.chunk || eventData.content || (typeof eventData === 'string' ? eventData : '');
              if (text) {
                fullContent += text;
                regenPacer.push(text);
              }
            } else if (eventType === 'thought' || eventType === 'status') {
              const thought = eventData.thought || eventData.message || eventData.content || '';
              thoughtContent += thought + (eventType === 'status' ? '\n' : '');
              appendStreamThought(thought + (eventType === 'status' ? '\n' : ''), dbSessionId, streamToken);
            } else if (eventType === 'sources') {
              lastStreamSources = eventData.sources || [];
              setSources(lastStreamSources, dbSessionId);
            } else if (eventType === 'message_ids') {
              const userMessageId = eventData.userMessageId || eventData.data?.userMessageId;
              const assistantMessageId = eventData.assistantMessageId || eventData.data?.assistantMessageId;
              if (useTutorStore.getState().chatSessionId === activeChatIdRef.current) {
                useTutorStore.getState().syncMessageIds(userMessageId, assistantMessageId, null, finalTargetId);
              }
              syncChatHistory(prev => prev.map(s => {
                if (s.id === dbSessionId) {
                  const msgs = [...s.messages];
                  let changed = false;
                  const aIdx = msgs.findIndex(m => m.id === finalTargetId);
                  if (aIdx !== -1 && assistantMessageId) {
                    msgs[aIdx] = { ...msgs[aIdx], id: assistantMessageId };
                    changed = true;
                  }
                  return changed ? { ...s, messages: msgs } : s;
                }
                return s;
              }));
            } else if (eventType === 'plan') {
              if (eventData.plan?.suggest_canvas) setCurrentCanvasType(eventData.plan.canvas_type);
            } else if (eventType === 'done') {
              if (eventData.messagesAfterRegen) {
                import.meta.env.DEV && console.log('[Home:Regen] Syncing conversation state from server');
                useTutorStore.getState().setConversationMessages(eventData.messagesAfterRegen, dbSessionId);
                
                syncChatHistory(prev => prev.map(s => 
                  s.id === dbSessionId ? { ...s, messages: eventData.messagesAfterRegen } : s
                ));
              }
            } else if (eventType === 'error') {
              throw fromServerError(eventData);
            }
          });
        } finally {
          clearInterval(activityMonitor);
        }
        regenPacer.flush();
        if (!streamEnded) throw new ChatRequestError('STREAM_INTERRUPTED', undefined, { retryable: true });

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
      if (err.name === 'AbortError' || err.message?.includes('aborted')) { regenPacer?.cancel(); return; }
      regenPacer?.flush();
      console.error('[Home] Regenerate failed:', err);
      const chatErr = err instanceof ChatRequestError ? err : new ChatRequestError('INTERNAL', undefined, { retryable: true });

      // End the stream without touching the answer: the previous version stays
      // exactly as it was (no error text is ever written into its content).
      useTutorStore.getState().failStreaming({
        sessionId: dbSessionId,
        streamToken,
        assistantMessageId: null,
        error: { message: chatErr.message, code: chatErr.code, retryable: chatErr.retryable, messageId: chatErr.retryable ? finalTargetId : null },
      });
      if (original) {
        useTutorStore.getState().restoreMessageContent(finalTargetId, original);
      }
    } finally {
      submittingSessionsRef.current.delete(dbSessionId);
    }
  };

  // ── Delete Message Handler ──
  // ── "Try again" on a visual that failed (canvas status view) ──
  useEffect(() => {
    const onRetryLesson = (e) => {
      const messageId = e.detail?.messageId;
      if (messageId) handleRegenerateMessage(messageId);
    };
    window.addEventListener('tb:retry-lesson', onRetryLesson);
    return () => window.removeEventListener('tb:retry-lesson', onRetryLesson);
    // handleRegenerateMessage is a fresh closure each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const handleDeleteMessage = useCallback(async (messageId) => {
    deleteMessageById(messageId);
    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');
    if (isMongoId) {
      API.delete('/api/chat/message', { data: { sessionId: dbSessionId, messageId } })
        .catch(err => console.error('[Home] Delete sync failed:', err));
    }
  }, [deleteMessageById, activeChatId]);

  // ── Feedback Handler ──
  const handleFeedback = useCallback(async (messageId, feedback) => {
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
  }, [setMessageFeedback, activeChatId, isAuthenticated]);

  // ── Version Switch Handler ──
  const handleSwitchVersion = useCallback(async (messageId, versionIndex) => {
    const prev = conversationMessages.find(m => (m.id || m._id)?.toString() === messageId?.toString())?.metadata?.activeVersionIndex;
    
    // 1. Optimistic Update (Store handles isVersionSwitching lock)
    switchMessageVersion(messageId, versionIndex);

    const dbSessionId = useTutorStore.getState().chatSessionId || activeChatId;
    const isMongoSessionId = /^[0-9a-fA-F]{24}$/.test(dbSessionId || '');
    const isMongoMessageId = /^[0-9a-fA-F]{24}$/.test(messageId || '');

    // 2. Persistent Sync (Only if both Session and Message are persisted in DB)
    if (isMongoSessionId && isMongoMessageId && isAuthenticated) {
      try {
        await API.post('/api/chat/switch-version', { 
          sessionId: dbSessionId, 
          messageId, 
          versionIndex 
        });
        
        showToast({
          message: 'Switched to version ' + (versionIndex + 1),
          type: 'success',
          duration: 2500
        });
      } catch (err) {
        console.error('[Home] Version switch sync failed:', err);
        if (err.response?.status && err.response.status !== 404 && typeof prev === 'number') {
          switchMessageVersion(messageId, prev);
          showToast({ message: 'Sync failed. Reverting...', type: 'error' });
        }
      }
    } else {
      useTutorStore.getState().triggerSync();
    }
  }, [conversationMessages, switchMessageVersion, activeChatId, isAuthenticated, showToast]);



  // ── Stop Generation Handler ──
  const handleStopGeneration = (sessionId) => {
    const targetId = sessionId || useTutorStore.getState().chatSessionId || activeChatId;
    
    // 1. Stop the answer on the server (closing the stream alone no longer
    //    cancels it — a refresh must not lose an answer), then end the stream.
    const controller = abortControllersRef.current.get(targetId);
    if (controller) {
      stopServerGeneration(controller, targetId);
      controller.abort();
      abortControllersRef.current.delete(targetId);
    }

    // A visual lesson still being prepared for this answer is cancelled, not
    // finished (before the stores below forget which message it belongs to).
    useTutorStore.getState().handleProgressiveStreamEvent({ type: 'lesson_cancelled' });

    // 2. Abort visual generation in teaching machine
    machine.cancelSession();
    
    // 3. Clear store states
    abortStreaming(targetId);
    useTutorStore.getState().setWaitingForAI(false, targetId);
  };

  // ── Session Export Handler ──
  const handleExport = async (type) => {
    const session = chatHistory.find(s => s.id === activeChatId) || activeSession;
    const storeMessages = useTutorStore.getState().conversationMessages || [];
    const messages = storeMessages.length > 0 ? storeMessages : (session?.messages || []);
    if (!session || !messages.length) return;

    // Lazy-loaded: the DOCX/PDF HTML templating only ships when the user exports.
    const { exportSession } = await import('../utils/sessionExport');
    exportSession(type, session, messages);
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

  const isCanvasVisible = canvasLayout !== 'inline' || machineState !== STATES.IDLE;
  const isTeachingActive = isCanvasVisible;
  const isSplitView = canvasLayout === 'split' || (isCanvasVisible && canvasLayout !== 'fullscreen');
  const isFullscreen = canvasLayout === 'fullscreen';

  const leftPanel = (
    <ErrorBoundary reloadOnRetry={true}>
      <ChatColumnWrapper
        activeSession={activeSession}
        machineState={machineState}
        isDoubtProcessing={isDoubtProcessing}
        activeView={activeView} setActiveView={setActiveView}
      chatHistory={chatHistory} activeChatId={activeChatId}
      onNewChat={handleNewChat} onSelectChat={handleSelectChat}
      onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat}
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
      isLoadingHistory={pagination.loading && chatHistory.length === 0}
      hasMore={pagination.hasMore}
      isLoadingMore={pagination.loading && chatHistory.length > 0}
      onLoadMore={() => fetchCloudSessions(pagination.page + 1)}
      onQuickAsk={() => setIsQuickAskOpen(true)}
      isSplitView={isSplitView}
      onUndoMessage={handleUndoMessage}
      undoConfirmModal={undoConfirmModal}
      setUndoConfirmModal={setUndoConfirmModal}
      executeConfirmedUndo={executeConfirmedUndo}
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
        isCanvasOpen={isCanvasVisible}
      >
        {/* 2. Main Background Canvas */}
        {!isTeachingActive && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* The canvas surface: dots or a grid (Settings → Appearance), fading toward the edges */}
            {gridType !== 'none' && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-45"
                style={{
                  backgroundImage:
                    gridType === 'lines'
                      ? 'linear-gradient(var(--st-line) 1px, transparent 1px), linear-gradient(90deg, var(--st-line) 1px, transparent 1px)'
                      : 'radial-gradient(circle, var(--st-line) 0.85px, transparent 1px)',
                  backgroundSize: gridType === 'lines' ? '32px 32px' : '24px 24px',
                  backgroundPosition: 'center center',
                  maskImage: 'radial-gradient(ellipse 85% 80% at 50% 45%, #000 45%, transparent 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 50% 45%, #000 45%, transparent 100%)',
                }}
              />
            )}

            {(timeline || (canvasObjects && canvasObjects.length > 0)) ? (
              <div className="w-full h-full relative overflow-hidden">
                <FixedTeachingStage 
                  topic={timeline?.title || "History Session"}
                  currentStepIndex={currentStepIndex}
                  totalSteps={canvasSteps.length}
                >
                  <React.Suspense fallback={null}>
                    <AgentCanvasRenderer
                      key={`canvas-${canvasSessionVersion}`}
                      width={800} height={600}
                      timeline={timeline}
                      currentStepIndex={currentStepIndex}
                      elements={canvasObjects}
                      objects={canvasObjects}
                      connections={canvasConnections}
                      steps={canvasSteps}
                      onGoToStep={goToStep}
                    />
                  </React.Suspense>
                </FixedTeachingStage>
              </div>
            ) : !pagination.loading && (
              <div className="w-full h-full relative overflow-hidden">

                {/* ── Branding Watermarks ── */}
                <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden">
                  {/* One quiet line, bottom left; it steps aside once anything is on the canvas */}
                  <AnimatePresence>
                  {!hasMarks && (
                  <motion.div
                    key="empty-hint"
                    exit={{ opacity: 0, y: 6, transition: { duration: 0.2 } }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute bottom-[max(env(safe-area-inset-bottom),28px)] left-5 right-5 flex flex-wrap items-center gap-x-4 gap-y-3 font-sans sm:left-8 lg:left-10"
                  >
                    <div className="flex items-center gap-2.5 text-[14px] text-[var(--text-secondary)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mk-accent)]" />
                      Ask a question, and your lesson is drawn here.
                    </div>
                  </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
          
          {/* Initial Load Skeleton Overlay */}
          <AnimatePresence>
            {pagination.loading && chatHistory.length === 0 && (
              <motion.div
                key="loading-skeleton"
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
                  <span className="text-[12px] font-medium text-[var(--text-primary)]">Restoring workspace</span>
                  <span className="text-[11px] font-normal text-[var(--text-tertiary)]">Fetching your visual history...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Connection Alert Banner */}
        <AnimatePresence>
          {isDbOffline && (
            <motion.div
              key="db-offline"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="absolute top-0 left-0 right-0 z-[60] overflow-hidden"
            >
              <div className="bg-red-500 text-white px-6 py-2.5 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3">
                  <WifiOff size={16} className="animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold">Database connection failed</span>
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
              key="teaching-overlay"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ 
                opacity: isExplainMinimized ? 0 : 1, 
                scale: isExplainMinimized ? 0.98 : 1,
              }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute inset-0 z-[100] ${isExplainMinimized ? 'pointer-events-none' : 'bg-[var(--bg-primary)] shadow-2xl overflow-hidden'}`}
              style={{
                borderTopLeftRadius: 32,
                borderBottomLeftRadius: 32,
                borderLeft: '1px solid var(--border-color)',
                marginTop: -1,
                height: 'calc(100% + 2px)',
              }}
            >
              <React.Suspense fallback={
                <div className="flex items-center justify-center w-full h-full bg-[var(--bg-primary)]">
                  <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                </div>
              }>
                <TeachingSession 
                  deselectAll={() => {
                    if (typeof setSelectedElements === 'function') setSelectedElements([]);
                    else useTutorStore.getState().clearSelection?.();
                    setHasTextSelection?.(false);
                  }} 
                />
              </React.Suspense>
            </motion.div>
          )}
        </AnimatePresence>



        {/* ── G. Doubt Resume Pill (Contextual) ── */}
        <AnimatePresence>
          {(machine.activeDoubtId || isDoubtProcessing) && !isDoubtProcessing && (
            <motion.div
              key="doubt-resume"
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
        <AnnotationLayer sessionKey={activeChatId} />
        <SelectionPopover />
        <ArtifactPanel />


      </Layout>
    </div>
  );
};



export default Home;

