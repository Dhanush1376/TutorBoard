/**
 * TeachingSession — FULL-SCREEN IMMERSIVE VISUAL LEARNING ENGINE
 * 
 * This is the primary experience. Canvas is ALWAYS on top.
 * 
 * Features:
 *   - Full-screen fixed canvas (z-index: 9999)
 *   - OS-level window controls (close, minimize, expand)
 *   - Floating glassmorphism sidebar (left)
 *   - Thread-based doubt system (right)
 *   - Hover doubt timeline (right edge)
 *   - Chat input drives canvas mutations
 *   - Center-focused animations
 *   - Keyboard navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Minimize2, Maximize2, Menu, MessageCircleQuestion,
  ArrowUp, Loader, Check, WifiOff
} from 'lucide-react';

import InfiniteCanvas from '../canvas/InfiniteCanvas';
import CanvasRenderer from '../canvas/CanvasRenderer';
import CanvasControls from '../canvas/CanvasControls';
import CanvasMinimap from '../canvas/CanvasMinimap';
import FloatingSidebar from './FloatingSidebar';
import DoubtThread from './DoubtThread';
import DoubtTimeline from './DoubtTimeline';
import SessionOverlay from './SessionOverlay';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';

// Domain badge styling
const DOMAIN_STYLES = {
  dsa: { bg: 'rgba(5, 150, 105, 0.15)', border: 'rgba(5, 150, 105, 0.3)', text: '#059669', label: 'DSA' },
  mathematics: { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(124, 58, 237, 0.3)', text: '#7c3aed', label: 'Math' },
  physics: { bg: 'rgba(37, 99, 235, 0.15)', border: 'rgba(37, 99, 235, 0.3)', text: '#2563eb', label: 'Physics' },
  chemistry: { bg: 'rgba(220, 38, 38, 0.15)', border: 'rgba(220, 38, 38, 0.3)', text: '#dc2626', label: 'Chemistry' },
  biology: { bg: 'rgba(22, 163, 74, 0.15)', border: 'rgba(22, 163, 74, 0.3)', text: '#16a34a', label: 'Biology' },
  general: { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280', label: 'General' },
};

const TeachingSession = ({ isOpen, onClose, initialTopic }) => {
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

  console.log('[TeachingSession] Render:', { machineState, isOpen, timeline: !!timeline });

  // Store state
  const {
    canvasMode, canvasTransform, showMinimap, voiceEnabled, playbackSpeed,
    showFloatingSidebar,
    setCanvasMode, setCanvasTransform, toggleMinimap, toggleVoice,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, toggleDoubtThread,
    showDoubtThread,
  } = useTutorStore();

  // Local UI state
  const [doubtInput, setDoubtInput] = useState('');
  const canvasRef = useRef(null);
  const doubtInputRef = useRef(null);

  // Start session when opened with a topic (unless pre-loaded)
  useEffect(() => {
    // Only call startSession if we are in IDLE state and don't have a timeline yet
    if (isOpen && initialTopic && machineState === STATES.IDLE && !timeline) {
      startSession(initialTopic);
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline]);

  // Auto-center and fit to content when timeline loads
  useEffect(() => {
    if (timeline && canvasRef.current) {
      // Delay slightly to ensure layout is ready
      const timer = setTimeout(() => {
        canvasRef.current.fitToContent?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [timeline]);

  // Voice narration
  useEffect(() => {
    if (voiceEnabled && currentStep?.narration && machineState === STATES.TEACHING) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentStep.narration || currentStep.description);
      utterance.rate = playbackSpeed;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }
    return () => window.speechSynthesis.cancel();
  }, [currentStepIndex, voiceEnabled, currentStep, machineState, playbackSpeed]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (isTyping) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          prevStep();
          break;
        case ' ':
          e.preventDefault();
          isPlaying ? pause() : play();
          break;
        case '?':
        case '/':
          e.preventDefault();
          doubtInputRef.current?.focus();
          break;
        case 's':
          e.preventDefault();
          openFloatingSidebar();
          break;
        case 'd':
          e.preventDefault();
          toggleDoubtThread();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isPlaying, nextStep, prevStep, play, pause, openFloatingSidebar, toggleDoubtThread]);

  // Handle speed change
  const handleSpeedChange = useCallback((speed) => {
    storeSetSpeed(speed);
    setSpeed(speed);
  }, [setSpeed, storeSetSpeed]);

  // Handle close
  const handleClose = useCallback(() => {
    endSession();
    onClose();
  }, [endSession, onClose]);

  // Handle minimize
  const handleMinimize = useCallback(() => {
    setCanvasMode(CANVAS_MODE.MINIMIZED);
  }, [setCanvasMode]);

  // Handle expand
  const handleExpand = useCallback(() => {
    setCanvasMode(CANVAS_MODE.FULLSCREEN);
  }, [setCanvasMode]);

  // Handle doubt submit
  const handleDoubtSubmit = useCallback(() => {
    if (!doubtInput.trim() || isDoubtProcessing) return;
    askDoubt(doubtInput.trim());
    setDoubtInput('');
  }, [doubtInput, isDoubtProcessing, askDoubt]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (initialTopic) {
      startSession(initialTopic);
    }
  }, [initialTopic, startSession]);

  if (!isOpen) return null;

  const domain = timeline?.domain?.toLowerCase();
  const domainStyle = domain ? DOMAIN_STYLES[domain] : null;
  const isMinimized = canvasMode === CANVAS_MODE.MINIMIZED;

  // ─── MINIMIZED VIEW ───
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: 100 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 right-6 z-[9999] cursor-pointer group"
        onClick={handleExpand}
      >
        <div className="w-[200px] h-[130px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative"
          style={{
            background: 'rgba(var(--bg-secondary-rgb, 22, 22, 20), 0.9)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Mini canvas preview */}
          <div className="absolute inset-0 opacity-60 pointer-events-none">
            <svg viewBox="0 0 800 600" className="w-full h-full">
              {canvasObjects.slice(0, 10).map((obj, i) => (
                <circle
                  key={obj.id || i}
                  cx={obj.x || obj.cx || 400}
                  cy={obj.y || obj.cy || 300}
                  r={4}
                  fill="var(--text-tertiary)"
                  opacity={0.5}
                />
              ))}
            </svg>
          </div>
          
          {/* Overlay info */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-[10px] font-bold text-white truncate">
              {timeline?.title || initialTopic}
            </p>
            <p className="text-[9px] text-white/60">
              Step {currentStepIndex + 1}/{totalSteps}
            </p>
          </div>

          {/* Expand icon on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1 rounded-lg bg-white/10 backdrop-blur-sm">
              <Maximize2 size={12} className="text-white" />
            </div>
          </div>

          {/* Live indicator */}
          <div className="absolute top-2 left-2">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-[7px] font-bold text-red-400 uppercase">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── FULL-SCREEN VIEW ───
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2147483647,
          }}
          className="flex flex-col bg-[var(--bg-primary)] overflow-hidden"
        >
          {/* ─── STATE OVERLAYS ─── */}
          <SessionOverlay
            machineState={machineState}
            error={error}
            topic={initialTopic}
            totalSteps={totalSteps}
            doubtHistory={doubtHistory}
            onRetry={handleRetry}
            onNewTopic={handleClose}
            onClose={handleClose}
            onReplay={() => goToStep(0)}
          />

          {/* ─── CANVAS LAYER (ALWAYS ON BOTTOM) ─── */}
          <motion.div 
            className="absolute inset-0 z-0"
            animate={{ 
              paddingLeft: showFloatingSidebar ? 320 : 0,
              paddingRight: showDoubtThread ? 380 : 0 
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <InfiniteCanvas
              ref={canvasRef}
              onZoomChange={(scale) => setCanvasTransform(prev => ({ ...prev, scale }))}
              onViewportChange={setCanvasTransform}
              className="bg-[var(--bg-primary)]"
            >
              <CanvasRenderer
                objects={canvasObjects}
                steps={canvasSteps}
                currentStepIndex={currentStepIndex}
              />
            </InfiniteCanvas>

            {/* Canvas Analytics & Navigation Controls (Higher Z-Layer) */}
            <div className="absolute inset-0 z-50 pointer-events-none">
              {timeline && (
                <div className="w-full h-full relative p-6">
                  {/* Zoom/Fit Controls */}
                  <div className="absolute bottom-24 right-6 pointer-events-auto">
                    <CanvasControls
                      transform={canvasTransform}
                      onZoomIn={() => setCanvasTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.3) }))}
                      onZoomOut={() => setCanvasTransform(prev => ({ ...prev, scale: Math.max(0.15, prev.scale / 1.3) }))}
                      onFitToContent={() => canvasRef.current?.fitToContent?.()}
                      onResetView={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}
                      onToggleMinimap={toggleMinimap}
                      showMinimap={showMinimap}
                    />
                  </div>

                  {/* Minimap */}
                  <div className="absolute bottom-48 right-6 pointer-events-auto">
                    <CanvasMinimap
                      visible={showMinimap}
                      objects={canvasObjects}
                      transform={canvasTransform}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* ─── TOP BAR ─── */}
          <motion.div 
            animate={{ paddingLeft: showFloatingSidebar ? 320 : 0, paddingRight: showDoubtThread ? 380 : 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex items-center justify-between px-5 pt-5"
          >
            {/* Left: Sidebar toggle + Title + Domain */}
            <div className="flex items-center gap-2">
              <button
                onClick={openFloatingSidebar}
                className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
                title="Open sidebar (S)"
              >
                <Menu size={16} />
              </button>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-3 bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] px-5 py-2.5 rounded-2xl shadow-xl"
              >
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                
                {domainStyle && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em]"
                    style={{
                      backgroundColor: domainStyle.bg,
                      borderWidth: '1px',
                      borderColor: domainStyle.border,
                      color: domainStyle.text,
                    }}
                  >
                    {domainStyle.label}
                  </span>
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.12em] max-w-[300px] truncate">
                    {timeline?.title || initialTopic || 'Teaching Session'}
                  </span>
                  {professorNote && (
                    <span className="text-[10px] text-[var(--text-tertiary)] italic truncate max-w-[400px]">
                      "{professorNote}"
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {mode && (
                    <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {mode}
                    </span>
                  )}
                  {difficulty && (
                    <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider ${
                      difficulty === 'beginner' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      difficulty === 'advanced' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {difficulty}
                    </span>
                  )}
                </div>
                
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-bold text-red-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Live
                </span>
              </motion.div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Connection status */}
              {!isConnected && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400">
                  <WifiOff size={12} />
                  Offline
                </div>
              )}

              {/* Doubt thread toggle (Available anytime) */}
              <button
                onClick={toggleDoubtThread}
                className={`p-2.5 rounded-xl border transition-all ${
                  showDoubtThread
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                    : 'bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Doubt thread history (D)"
              >
                <div className="relative">
                  <MessageCircleQuestion size={16} />
                  {doubtHistory.length > 0 && !showDoubtThread && (
                    <motion.div 
                      layoutId="doubtDot"
                      className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-[var(--bg-primary)]"
                    />
                  )}
                </div>
              </button>
              
              {/* Voice */}
              <button
                onClick={toggleVoice}
                className={`p-2.5 rounded-xl border transition-all ${
                  voiceEnabled
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                    : 'bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Minimize */}
              <button
                onClick={handleMinimize}
                className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
                title="Minimize"
              >
                <Minimize2 size={16} />
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>

          {/* ─── STEP EXPLANATION PANEL (LEFT SIDE) ─── */}
          <AnimatePresence mode="wait">
            {currentStep && machineState === STATES.TEACHING && (
              <motion.div
                key={`step-${currentStepIndex}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: showFloatingSidebar ? 320 : 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 ml-5 mt-5 max-w-sm"
              >
                <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                      Step {currentStepIndex + 1} of {totalSteps}
                    </span>
                    {learningNodes[currentStepIndex]?.type && (
                      <span className={`px-2 py-0.5 border rounded-full text-[8px] font-bold uppercase tracking-wider ${
                        ['hook', 'intuition', 'analogy'].includes(learningNodes[currentStepIndex].type.toLowerCase()) 
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      }`}>
                        {learningNodes[currentStepIndex].type}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    {currentStep.title || learningNodes[currentStepIndex]?.title || currentStep.label || `Step ${currentStepIndex + 1}`}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {currentStep.description || learningNodes[currentStepIndex]?.content || currentStep.narration || ''}
                  </p>
                  {memoryAnchor && currentStepIndex === totalSteps - 1 && (
                    <div className="mt-4 p-3 bg-gold-500/5 border border-gold-500/20 rounded-lg">
                      <span className="text-[9px] font-bold text-gold-500 uppercase tracking-widest block mb-1">Memory Anchor</span>
                      <p className="text-[11px] text-gold-200/80 italic">{memoryAnchor}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Doubt Processing Indicator ─── */}
          <AnimatePresence>
            {machineState === STATES.DOUBT_TRIGGERED && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
              >
                <div className="flex items-center gap-3 px-6 py-3 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[var(--text-tertiary)] border-t-[var(--text-primary)] rounded-full"
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Processing your doubt...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── DOUBT RESPONSE TOAST (appears briefly after doubt is answered) ─── */}
          <AnimatePresence>
            {doubtResponse?.answer && machineState === STATES.RESPONDING && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-24 left-1/2 -translate-x-1/2 z-30 max-w-md"
              >
                <div className="px-5 py-3 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl">
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {doubtResponse.answer}
                  </p>
                  {doubtResponse.hasVisuals && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                      ✨ Canvas updated
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── FLOATING SIDEBAR (LEFT) ─── */}
          <FloatingSidebar />

          {/* ─── DOUBT THREAD (RIGHT) ─── */}
          <DoubtThread />

          {/* ─── DOUBT TIMELINE HOVER INDICATOR (RIGHT EDGE) ─── */}
          <DoubtTimeline />

          {/* ─── BOTTOM CONTROL DOCK ─── */}
          <motion.div 
            animate={{ paddingLeft: showFloatingSidebar ? 320 : 0, paddingRight: showDoubtThread ? 380 : 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-auto w-full flex flex-col items-center gap-3 pb-5 pt-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/70 to-transparent"
          >
            
            {/* Doubt Input Bar (merged chat → canvas driver) */}
            <div className="w-full max-w-2xl px-5">
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl px-4 py-2 shadow-xl">
                <MessageCircleQuestion size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                <input
                  ref={doubtInputRef}
                  data-doubt-input
                  type="text"
                  value={doubtInput}
                  onChange={(e) => setDoubtInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleDoubtSubmit();
                    }
                  }}
                  placeholder={machineState === STATES.GENERATING ? 'Preparing lesson...' : 'Ask a doubt or give a command... (?)'}
                  disabled={machineState === STATES.GENERATING || machineState === STATES.IDLE}
                  className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-xs outline-none py-1.5 disabled:opacity-40"
                />
                <button
                  onClick={handleDoubtSubmit}
                  disabled={!doubtInput.trim() || isDoubtProcessing || machineState === STATES.GENERATING}
                  className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl disabled:opacity-20 hover:opacity-90 transition-all active:scale-90 flex-shrink-0"
                >
                  {isDoubtProcessing ? <Loader size={14} className="animate-spin" /> : <ArrowUp size={14} />}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {timeline && totalSteps > 0 && (
              <div className="w-full max-w-xl px-6">
                <div className="flex gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToStep(i)}
                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 hover:h-2.5 ${
                        i < currentStepIndex
                          ? 'bg-[var(--text-primary)]'
                          : i === currentStepIndex
                          ? 'bg-[var(--text-primary)] shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                          : 'bg-[var(--border-color)]'
                      }`}
                      title={`Step ${i + 1}: ${canvasSteps[i]?.title || ''}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Playback Controls */}
            {timeline && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2"
              >
                {/* Speed */}
                <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-xl px-2 py-1">
                  {[0.5, 1, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        playbackSpeed === speed
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>

                {/* Main controls */}
                <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-3 py-1.5">
                  <button
                    onClick={prevStep}
                    disabled={currentStepIndex <= 0}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-20"
                  >
                    <SkipBack size={16} />
                  </button>

                  <button
                    onClick={isPlaying ? pause : play}
                    className="p-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all active:scale-90 mx-1"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <button
                    onClick={nextStep}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-20"
                    title={currentStepIndex >= (totalSteps || 0) - 1 ? 'Finish Lesson' : 'Next Step'}
                  >
                    {currentStepIndex >= (totalSteps || 0) - 1 
                      ? <Check size={16} className="text-emerald-400" />
                      : <SkipForward size={16} />}
                  </button>
                </div>

                {/* Step counter */}
                <div className="px-3 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums">
                    {currentStepIndex + 1} / {totalSteps}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TeachingSession;
