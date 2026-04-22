import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import TeachingModal from '../components/teaching/TeachingModal';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';
import LeftPanel from '../components/layout/LeftPanel';
import useTutorStore, { STATES as STORE_STATES, CANVAS_MODE } from '../store/tutorStore';
import useTeachingMachine, { STATES } from '../hooks/useTeachingMachine';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Canvas & Teaching Overlays
import InfiniteCanvas from '../components/canvas/InfiniteCanvas';
import AgentCanvasRenderer from '../components/canvas/AgentCanvasRenderer';
import InteractiveCanvasLayer from '../components/canvas/InteractiveCanvasLayer';
import CanvasControls from '../components/canvas/CanvasControls';
import CanvasMinimap from '../components/canvas/CanvasMinimap';
import StepPanel from '../components/teaching/StepPanel';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';
import { useAuth } from '../context/AuthContext';
import { useSessionSync } from '../hooks/useSessionSync';

import { 
  Volume2, VolumeX, Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, Wifi, WifiOff, Loader, Key, Zap
} from 'lucide-react';

// ─── Drawing Overlay ─────────────────────────────────────────────────────────
const DRAWING_PHASES = [
  'Analyzing your question',
  'Generating visual layout',
  'Drawing diagrams',
  'Adding labels and annotations',
  'Rendering final visuals',
];

const RETHINK_PHASES = [
  'Agent is rethinking',
  'Tailoring canvas to your doubt',
  'Editing lesson context',
  'Finalizing clarification',
];

const DrawingOverlay = ({ isVisible, isRethinking, isSidebarOpen, layoutView }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phases = isRethinking ? RETHINK_PHASES : DRAWING_PHASES;
  
  // Calculate padding to center the overlay over the active canvas area
  // Assuming sidebar is roughly 340px wide when open
  const isRightHand = layoutView === 'right';
  const paddingStyle = isSidebarOpen ? (isRightHand ? { paddingRight: 340 } : { paddingLeft: 340 }) : {};

  useEffect(() => {
    if (!isVisible) { setPhaseIndex(0); return; }
    const timer = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % phases.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [isVisible, phases.length]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          style={paddingStyle}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-5"
          >
            {/* Animated drawing indicator */}
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-full h-full">
                <motion.circle
                  cx="40" cy="40" r="32"
                  fill="none"
                  stroke="var(--text-tertiary)"
                  strokeWidth="1.5"
                  strokeDasharray="200"
                  animate={{ strokeDashoffset: [200, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  opacity={0.3}
                />
                <motion.path
                  d="M 20 50 Q 30 20 40 40 Q 50 60 60 30"
                  fill="none"
                  stroke="var(--text-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: [0, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
                  opacity={0.6}
                />
              </svg>
            </div>

            <motion.span 
              key={phaseIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm font-medium text-[var(--text-secondary)]"
            >
              {phases[phaseIndex]}
            </motion.span>
            
            <div className="w-48 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[var(--accent-primary)]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Constants ───
const DOMAIN_STYLES = {
  dsa:              { bg: 'rgba(5,150,105,0.15)',   border: 'rgba(5,150,105,0.3)',   text: '#10b981', label: 'DSA' },
  mathematics:      { bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)',  text: '#8b5cf6', label: 'Math' },
  physics:          { bg: 'rgba(37,99,235,0.15)',   border: 'rgba(37,99,235,0.3)',   text: '#3b82f6', label: 'Physics' },
  chemistry:        { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#ef4444', label: 'Chemistry' },
  biology:          { bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#22c55e', label: 'Biology' },
  general:          { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af', label: 'General' },
};

const PANEL_VISIBLE_STATES = new Set([STATES.TEACHING, STATES.RESPONDING, STATES.RESUMING]);

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
    activeSnapshotId, setActiveSnapshotId, setTimeline
  } = useTutorStore();


  const isGuest = !!user?.isGuest;
  console.log('[Home] Dashboard mounted. user:', user?.email, 'isGuest:', isGuest);
  
  // Use global prefs but map to local variable for easier refactor
  const activeApiPrefs = globalApiPrefs;

  const [chatHistory, setChatHistory] = useState([]);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false, loading: false });
  const [isDbOffline, setIsDbOffline] = useState(false);

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

        const cloudSessions = sessions.map(s => ({
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

  // Initial load — fetch all sessions from MongoDB (source of truth)
  useEffect(() => {
    fetchCloudSessions(1);
  }, [fetchCloudSessions, isAuthenticated, user]);

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
        hasCanvas: latest.hasVisuals,
        canvasSnapshot: latest.hasVisuals ? { canvasObjects, canvasSteps, totalSteps } : null
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        // Avoid duplicates if somehow triggered twice
        if (next[idx].messages.some(m => m.id === assistantMessage.id)) return prev;
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
    if (timeline && timeline.title && timeline.title !== lastTimelineId.current) {
      lastTimelineId.current = timeline.title;
      
      const assistantMessage = { 
         id: getMsgId('session-ans'), 
         role: 'assistant', 
         content: `I've prepared a visual learning canvas for you on **${timeline.title}**. Dive in whenever you're ready!`,
         hasCanvas: true,
         canvasSnapshot: { canvasObjects, canvasSteps, totalSteps } 
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        // Only append if it doesn't already exist
        if (next[idx].messages.some(m => m.id === assistantMessage.id)) return prev;
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
         hasCanvas: false 
      };
      
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === activeChatId);
        if (idx === -1) return prev;
        const next = [...prev];
        if (next[idx].messages.some(m => m.id === assistantMessage.id)) return prev;
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

  const activeSession = chatHistory.find(c => c.id === activeChatId) || null;
  const messages = activeSession?.messages || [];

  // ── Persistent Cloud Sync (Immediate Actions) ──
  // Returns the canonical MongoDB session ID after save (may differ from activeChatId if it was a local temp ID).
  const saveCurrentSession = useCallback(async (updatedMessages = messages, overrideSessionId = null) => {
    if (!isAuthenticated || user?.isGuest || !token) return null;
    
    const targetSessionId = overrideSessionId || activeChatId;
    const payload = {
      sessionId: targetSessionId,
      title: activeSession?.title || timeline?.title || 'New Session',
      messages: updatedMessages,
      canvasState: canvasObjects || [],
      canvasSteps: canvasSteps || [],
      pinnedNotes: pinnedNotes || [],
      preferences: {
        drawColor, drawWidth,
        textToolSize, noteToolSize,
        noteColor, noteSize,
        layoutView, gridType, gridSize, showGrid
      }
    };

    console.log(`[Persistence] 💾 Saving session: ${targetSessionId}`);
    
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
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
        // If we were using a local UUID, swap it for the permanent Mongo ID everywhere.
        if (saved._id && saved._id !== targetSessionId) {
          console.log(`[Persistence] 🔗 Adopting permanent Mongo ID: ${saved._id}`);
          setActiveChatId(saved._id);
          setChatHistory(prev => prev.map(s => 
            s.id === targetSessionId ? { ...s, id: saved._id, chatSessionId: saved._id } : s
          ));
          return saved._id;
        }
        return saved._id || targetSessionId;
      }
    } catch (err) {
      console.error('[Persistence] ❌ Immediate save failed:', err);
    }
    return null;
  }, [activeChatId, activeSession, timeline, canvasObjects, canvasSteps, isAuthenticated, user, token, messages]);


  // ── Passive Sync (Canvas/Prefs Debounce) ──
  useSessionSync(messages);

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
    // Allow the sync effect a tick to read the current session ID before clearing it
    setTimeout(() => {
      useTutorStore.getState().setChatSessionId(null);
      setActiveChatId(null);
      setPrompt(''); 
      endSession(); 
    }, 50);
  };
  const handleSelectChat = async (id) => {
    setActiveChatId(id);
    setActiveView('chat');
    
    // 1. Immediate local restore (minimal snapshot)
    const localSession = chatHistory.find(s => s.id === id);
    if (localSession) {
      console.log(`[Home] Restoring local session: ${id} (${localSession.messages?.length || 0} messages)`);
      if (localSession.canvasState) {
        useTutorStore.getState().setCanvasSnapshot({ 
          canvasObjects: localSession.canvasState, 
          canvasSteps: localSession.steps || [], 
          totalSteps: localSession.steps?.length || 0 
        });
        useTutorStore.setState({ pinnedNotes: localSession.pinnedNotes || [] });
      }
      if (localSession.messages) {
        // Sync the store's doubtHistory so AI context is restored for sequels
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
    showAlert({
      type: 'warning',
      title: 'Delete Session',
      message: 'Are you sure you want to permanently delete this learning session? This action cannot be undone.',
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        // Optimistic local update
        setChatHistory(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) {
          setActiveChatId(null);
          // Reset store if we delete the active chat
          useTutorStore.getState().resetSession?.();
        }

        // Persistent cloud update
        if (isAuthenticated && !isGuest && id && !id.startsWith('msg-')) {
          try {
            await fetch(`${API_URL}/api/sessions/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[Home] ✅ Session ${id} deleted from cloud.`);
          } catch (err) {
            console.error('[Home] Failed to delete session from cloud:', err);
          }
        }
      }
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
        setCanvasSnapshot(msg.canvasSnapshot);
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

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmittingRef.current) return;
    
    const userPrompt = prompt.trim();
    setPrompt('');  // Clear input immediately
    setActiveView('chat');
    isSubmittingRef.current = true;

    try {
      const workingSessionId = activeChatId || `session-${Date.now()}`;
      if (!activeChatId) setActiveChatId(workingSessionId);

      // Trim and capitalize session title
      const sessionTitle = userPrompt.substring(0, 40).trim().replace(/^(.)/, (m) => m.toUpperCase());

      const userMessage = { id: getMsgId('user'), role: 'user', content: userPrompt };
      
      // Update local history immediately for UI responsiveness
      setChatHistory(prev => {
        const idx = prev.findIndex(s => s.id === workingSessionId);
        if (idx === -1) return [{ id: workingSessionId, title: sessionTitle, messages: [userMessage] }, ...prev];
        const next = [...prev]; 
        next[idx] = { ...next[idx], messages: [...next[idx].messages, userMessage] }; 
        return next;
      });

      // ── PERSISTENCE (Backgrounded): Save to MongoDB ──
      // We do NOT 'await' this so that the AI response can start immediately.
      // This solves the 'ignored AI' issue when DB latency is high.
      if (isAuthenticated && !user?.isGuest && token) {
        saveCurrentSession([userMessage], workingSessionId)
          .catch(err => console.error('[Home] Background persistence failed:', err));
      }

      // ── AI ENGINE: Trigger immediately ──
      const history = chatHistory.find(s => s.id === workingSessionId)?.messages || [];
      const isFollowUp = activeChatId && history.length > 0;
      
      if (isFollowUp) {
        askDoubt(userPrompt, activeMode);
      } else {
        startSession(userPrompt, userPrompt, activeMode);
      }
    } catch (err) {
      console.error('[Home] handleSubmit failed:', err);
      showAlert?.('Something went wrong. Please try again.');
    } finally {
      // Small delay to prevent double-submission if the user clicks rapidly
      setTimeout(() => { isSubmittingRef.current = false; }, 500);
    }
  };

  // ── Manual Note Creation ──
  const { activeTool } = useTutorStore();


  const handleCanvasClick = useCallback((e) => {
    // Standard click handling
    return false;
  }, []);

  // Selection cleanup
  const setSelectedElements = useTutorStore(state => state.setSelectedElements);
  const setHasTextSelection = useTutorStore(state => state.setHasTextSelection);

  const domain = (timeline?.domain || 'general').toLowerCase();
  const domainStyle = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general || DOMAIN_STYLES.dsa;
  const showStepPanel = currentStep && PANEL_VISIBLE_STATES.has(machineState);

  const leftPanel = (
    <ErrorBoundary reloadOnRetry={true}>
      <LeftPanel
        activeView={activeView} setActiveView={setActiveView}
      chatHistory={chatHistory} activeChatId={activeChatId}
      onNewChat={handleNewChat} onSelectChat={handleSelectChat}
      onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat}
      messages={messages} isGenerating={machineState === STATES.GENERATING}
      onOpenCanvas={handleOpenCanvas} onDeleteMessage={() => {}} onEditMessage={() => {}}
      getMsgId={getMsgId}
      prompt={prompt} setPrompt={setPrompt} onSubmit={handleSubmit}
      activeMode={activeMode} setActiveMode={setActiveMode}
      selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
      isDark={isDark}
      isLoadingHistory={isAuthenticated && !isGuest && pagination.loading && chatHistory.length === 0}
      hasMore={pagination.hasMore}
      isLoadingMore={pagination.loading && chatHistory.length > 0}
      onLoadMore={() => fetchCloudSessions(pagination.page + 1)}
    />
    </ErrorBoundary>
  );

  return (
    <div className="h-screen w-screen bg-[var(--bg-primary)] overflow-hidden relative">
      {/* 1. Main Background Canvas */}
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
          />
        </InfiniteCanvas>
      </div>

      {/* 2. Global Layout Overlay */}
      <Layout
        title={activeSession?.title || "TutorBoard"}
        onBack={handleNewChat}
        sidebar={leftPanel}
      >
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
                    <span className="text-[11px] font-bold uppercase tracking-wider">Database Connection Failed</span>
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

        {/* All teaching controls are now floating overlays here */}
        
        {/* A. Top Bar Overlay (Domain + Title) */}
        {timeline && (
          <div className="tb-top-bar absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] px-5 py-2 rounded-2xl shadow-xl pointer-events-auto"
            >
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] border"
                style={{
                  backgroundColor: domainStyle.bg,
                  borderColor: domainStyle.border,
                  color: domainStyle.text,
                }}
              >
                {domainStyle.label}
              </span>
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.12em] max-w-[200px] truncate">
                {timeline.title}
              </span>

              {/* API Source Badge */}
              {activeApiPrefs && (
                <div 
                  title={activeApiPrefs.useCustomApi ? `Using your personal ${activeApiPrefs.activeProvider} model` : "Using TutorBoard platform credits"}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all cursor-help
                    ${activeApiPrefs.useCustomApi 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
                >
                  {activeApiPrefs.useCustomApi ? <Key size={10} /> : <Zap size={10} />}
                  {activeApiPrefs.useCustomApi ? 'Personal' : 'Universal'}
                </div>
              )}

              {(() => {
                const isLive = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING;
                return isLive ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-bold text-red-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </span>
                );
              })()}

            </motion.div>
          </div>
        )}

        {/* B. Step Panel Overlay (Top Left) */}
        <AnimatePresence>
          {showStepPanel && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: (layoutView === 'left' && isSidebarOpen) ? 340 : 0,
              }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="tb-step-panel absolute top-24 left-6 z-40 max-w-sm pointer-events-auto"
            >
              <StepPanel
                currentStep={currentStep}
                currentStepIndex={currentStepIndex}
                totalSteps={totalSteps}
                learningNodes={learningNodes}
                memoryAnchor={memoryAnchor}
                keyFormula={keyFormula}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* C. Playback Dock (Bottom Center) */}
        {timeline && (
          <div className="tb-playback-dock absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-xl pointer-events-none">
            {/* Progress Bar */}
            <div className="w-full px-10 pointer-events-auto">
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(totalSteps, 50) }).map((_, i) => (
                  <button
                    key={`step-progress-${i}`}
                    onClick={() => goToStep(i)}
                    className={`flex-1 h-1 rounded-full transition-all ${
                      i <= currentStepIndex ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-color)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Playback Controls */}
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] rounded-2xl px-3 py-1.5 shadow-2xl">
                <button onClick={prevStep} disabled={currentStepIndex <= 0} className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><SkipBack size={16} /></button>
                <button onClick={isPlaying ? pause : play} className="p-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm active:scale-95 transition-transform">
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button onClick={nextStep} className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><SkipForward size={16} /></button>
              </div>

              {/* Step Counter */}
              <div className="px-3 py-2 bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] rounded-xl shadow-2xl">
                <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* D. Bottom Right Zoom / Minimap Tools */}
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

        {/* E. Chat & Overlays (DoubtThread etc) */}

        
        {/* Unified Drawing Overlay */}
        <DrawingOverlay 
          isVisible={machineState === STATES.GENERATING || isDoubtProcessing} 
          isRethinking={isDoubtProcessing}
          isSidebarOpen={isSidebarOpen}
          layoutView={layoutView}
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
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-xs font-bold shadow-2xl hover:scale-105 transition-all active:scale-95"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--bg-primary)] animate-pulse" />
                Resume Lesson Flow
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* F. Trial Watermark (Guests Only) */}
        {isGuest && (
          <div className="absolute bottom-10 left-10 z-[100] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex flex-col gap-4 p-6 bg-[rgba(var(--bg-secondary-rgb),0.85)] backdrop-blur-2xl border-2 border-amber-500/30 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] pointer-events-auto max-w-[280px] relative overflow-hidden"
              style={{
                background: 'var(--bg-secondary)',
                border: '2px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              {/* Amber Glow Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-500">
                  Trial Mode
                </span>
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
                  Not an original account
                </h3>
                <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)] font-medium">
                  Your work is <span className="text-[var(--text-primary)] font-bold">strictly temporary</span>. Refreshing the browser will <span className="text-amber-500 font-bold underline underline-offset-2 italic">delete all data</span>.
                </p>
              </div>

              <div className="pt-2">
                <button 
                  onClick={logout}
                  className="w-full py-3.5 bg-amber-500 text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)] hover:bg-amber-400 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300"
                >
                  Create Official Account
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </Layout>
    </div>
  );
};



export default Home;