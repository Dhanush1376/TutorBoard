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
import CanvasRenderer from '../components/canvas/CanvasRenderer';
import CanvasControls from '../components/canvas/CanvasControls';
import CanvasMinimap from '../components/canvas/CanvasMinimap';
import StepPanel from '../components/teaching/StepPanel';

import FloatingSidebar from '../components/teaching/FloatingSidebar';
import SessionOverlay from '../components/teaching/SessionOverlay';

import { 
  Volume2, VolumeX, Minimize2, Maximize2, Menu, 
  MessageCircleQuestion, Play, Pause, SkipBack, SkipForward, 
  Check, WifiOff, Loader
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

const DrawingOverlay = ({ isVisible, isRethinking }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phases = isRethinking ? RETHINK_PHASES : DRAWING_PHASES;

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

            {/* Phase text */}
            <div className="h-8 flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phaseIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm font-medium text-[var(--text-secondary)] tracking-wide"
                >
                  {phases[phaseIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Animated dots */}
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
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
  // ─── Machine & Store ───
  const machine = useTeachingMachine();
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
    setCanvasSnapshot, greetingMessage
  } = useTutorStore();

  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('tutorboard-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState(null);
  
  useEffect(() => {
    localStorage.setItem('tutorboard-history', JSON.stringify(chatHistory));
  }, [chatHistory]);

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
        return next;
      });
    }
  }, [greetingMessage, activeChatId]);

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

  const [activeView, setActiveView] = useState('chat');
  const [prompt, setPrompt] = useState('');
  const [activeMode, setActiveMode] = useState(null);

  const canvasRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const msgIdCounter = useRef(0);
  const getMsgId = (suffix = '') => `msg-${Date.now()}-${++msgIdCounter.current}${suffix ? `-${suffix}` : ''}`;

  const activeSession = chatHistory.find(c => c.id === activeChatId) || null;
  const messages = activeSession?.messages || [];

  // ─── Logic ───
  const { toggleSidebar } = useTutorStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleNewChat = () => { setActiveChatId(null); setPrompt(''); endSession(); };
  const handleSelectChat = (id) => { setActiveChatId(id); setActiveView('chat'); };
  const handleDeleteChat = (id) => { setChatHistory(prev => prev.filter(c => c.id !== id)); if (activeChatId === id) setActiveChatId(null); };
  const handleRenameChat = (id, newTitle) => setChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));

  const handleOpenCanvas = (messageId) => {
    const session = chatHistory.find(s => s.id === activeChatId);
    if (session) {
      const msg = session.messages.find(m => m.id === messageId);
      if (msg && msg.canvasSnapshot) {
        setCanvasSnapshot(msg.canvasSnapshot);
      }
    }
    // Reveal the canvas by collapsing the sidebar
    setSidebarOpen(false);
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmittingRef.current) return;
    
    const userPrompt = prompt.trim();
    setPrompt('');
    setActiveView('chat');

    const workingSessionId = activeChatId || `session-${Date.now()}`;
    if (!activeChatId) setActiveChatId(workingSessionId);

    setChatHistory(prev => {
      const idx = prev.findIndex(s => s.id === workingSessionId);
      const userMessage = { id: getMsgId('user'), role: 'user', content: userPrompt };
      if (idx === -1) return [{ id: workingSessionId, title: userPrompt.substring(0, 40), messages: [userMessage] }, ...prev];
      const next = [...prev]; next[idx] = { ...next[idx], messages: [...next[idx].messages, userMessage] }; return next;
    });

    if (machineState !== STATES.IDLE && machineState !== STATES.COMPLETED) {
      // ── Session Active: Register as Doubt ──
      askDoubt(userPrompt, activeMode);
    } else {
      // ── New Session ──
      startSession(userPrompt, userPrompt, activeMode);
    }
  };

  const domain = timeline?.domain?.toLowerCase() || 'general';
  const domainStyle = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const showStepPanel = currentStep && PANEL_VISIBLE_STATES.has(machineState);

  const leftPanel = (
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
    />
  );

  return (
    <div className="h-screen w-screen bg-[var(--bg-primary)] overflow-hidden relative">
      {/* 1. Main Background Canvas */}
      <div className="absolute inset-0 z-0">
        <InfiniteCanvas
          ref={canvasRef}
          onZoomChange={(scale) => setCanvasTransform(prev => ({ ...prev, scale }))}
          onViewportChange={setCanvasTransform}
        >
          <CanvasRenderer
            objects={canvasObjects}
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
        {/* All teaching controls are now floating overlays here */}
        
        {/* A. Top Bar Overlay (Domain + Title) */}
        {timeline && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] px-5 py-2 rounded-2xl shadow-xl pointer-events-auto"
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
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-bold text-red-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
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
                x: isSidebarOpen ? 340 : 0,
              }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-24 left-6 z-40 max-w-sm pointer-events-auto"
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
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-xl pointer-events-none">
            {/* Progress Bar */}
            <div className="w-full px-10 pointer-events-auto">
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(totalSteps, 50) }).map((_, i) => (
                  <button
                    key={i}
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
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-3 py-1.5 shadow-2xl">
                <button onClick={prevStep} disabled={currentStepIndex <= 0} className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><SkipBack size={16} /></button>
                <button onClick={isPlaying ? pause : play} className="p-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm active:scale-95 transition-transform">
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button onClick={nextStep} className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><SkipForward size={16} /></button>
              </div>

              {/* Step Counter */}
              <div className="px-3 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-xl shadow-2xl">
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
          onZoomIn={() => setCanvasTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.3) }))}
          onZoomOut={() => setCanvasTransform(prev => ({ ...prev, scale: Math.max(0.15, prev.scale / 1.3) }))}
          onFitToContent={() => canvasRef.current?.fitToContent?.()}
          onResetView={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}
          onToggleMinimap={toggleMinimap}
          showMinimap={showMinimap}
        />

        {/* E. Chat & Overlays (DoubtThread etc) */}

        
        {/* Unified Drawing Overlay */}
        <DrawingOverlay 
          isVisible={machineState === STATES.GENERATING || isDoubtProcessing} 
          isRethinking={isDoubtProcessing}
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
      </Layout>
    </div>
  );
};



export default Home;
