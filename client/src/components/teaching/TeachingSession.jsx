/**
 * TeachingSession v3.0 — FULL-SCREEN IMMERSIVE VISUAL LEARNING ENGINE
 *
* v3.0 — Cinematic Animation Engine Integration:
 *   - All 24 subject domains supported with styled badges
 *   - Close button onClick fixed
 *   - StepPanel visible in TEACHING + RESPONDING + RESUMING states
 *   - Domain badge shown even for unknown domains (graceful fallback)
 *   - Doubt input shows domain-appropriate placeholder
 *   - Progress bar segment limit (max 50 segments) prevents UI overflow
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Minimize2, Maximize2, Menu, MessageCircleQuestion,
  ArrowUp, Loader, Check, WifiOff
} from 'lucide-react';

import InfiniteCanvas from '../canvas/InfiniteCanvas';
import AgentCanvasRenderer from '../canvas/AgentCanvasRenderer';
import InteractiveCanvasLayer from '../canvas/InteractiveCanvasLayer';
import CanvasControls from '../canvas/CanvasControls';
import FloatingSidebar from './FloatingSidebar';
import DoubtThread from './DoubtThread';
import DoubtTimeline from './DoubtTimeline';
import SessionOverlay from './SessionOverlay';
import StepPanel from './StepPanel';
import NarrationBar from './NarrationBar';
import StepFilmstrip from './StepFilmstrip';
import MasteryHUD from './MasteryHUD';
import ShortcutsHUD from './ShortcutsHUD';
import ProgressArc from './ProgressArc';
import SessionResumeOverlay from './SessionResumeOverlay';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';

// ─── All 24 domain styles ─────────────────────────────────────────────────────
const DOMAIN_STYLES = {
  dsa:                  { bg: 'rgba(5,150,105,0.15)',   border: 'rgba(5,150,105,0.3)',   text: '#10b981', label: 'DSA' },
  mathematics:          { bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)',  text: '#8b5cf6', label: 'Math' },
  physics:              { bg: 'rgba(37,99,235,0.15)',   border: 'rgba(37,99,235,0.3)',   text: '#3b82f6', label: 'Physics' },
  chemistry:            { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#ef4444', label: 'Chemistry' },
  biology:              { bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#22c55e', label: 'Biology' },
  medicine:             { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)',  text: '#ec4899', label: 'Medicine' },
  computer_science:     { bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.3)',   text: '#06b6d4', label: 'CS' },
  engineering:          { bg: 'rgba(217,119,6,0.15)',   border: 'rgba(217,119,6,0.3)',   text: '#f59e0b', label: 'Engineering' },
  business:             { bg: 'rgba(20,184,166,0.15)',  border: 'rgba(20,184,166,0.3)',  text: '#14b8a6', label: 'Business' },
  law:                  { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  text: '#fbbf24', label: 'Law' },
  history:              { bg: 'rgba(161,98,7,0.15)',    border: 'rgba(161,98,7,0.3)',    text: '#ca8a04', label: 'History' },
  geography:            { bg: 'rgba(21,128,61,0.15)',   border: 'rgba(21,128,61,0.3)',   text: '#16a34a', label: 'Geography' },
  psychology:           { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.3)',  text: '#a855f7', label: 'Psychology' },
  arts:                 { bg: 'rgba(244,63,94,0.15)',   border: 'rgba(244,63,94,0.3)',   text: '#f43f5e', label: 'Arts' },
  economics:            { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80', label: 'Economics' },
  aviation_maritime:    { bg: 'rgba(56,189,248,0.15)',  border: 'rgba(56,189,248,0.3)',  text: '#38bdf8', label: 'Aviation' },
  data_science:         { bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)',  text: '#7c3aed', label: 'Data Science' },
  cybersecurity:        { bg: 'rgba(30,41,59,0.25)',    border: 'rgba(71,85,105,0.3)',   text: '#94a3b8', label: 'Cybersecurity' },
  linguistics:          { bg: 'rgba(147,51,234,0.15)',  border: 'rgba(147,51,234,0.3)',  text: '#9333ea', label: 'Linguistics' },
  philosophy:           { bg: 'rgba(87,83,78,0.15)',    border: 'rgba(87,83,78,0.3)',    text: '#a8a29e', label: 'Philosophy' },
  environmental_science:{ bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#16a34a', label: 'Environment' },
  music:                { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#dc2626', label: 'Music' },
  space_astronomy:      { bg: 'rgba(30,27,75,0.25)',    border: 'rgba(129,140,248,0.3)', text: '#818cf8', label: 'Astronomy' },
  general:              { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af', label: 'General' },
};

// Domain-aware doubt placeholders
const DOUBT_PLACEHOLDERS = {
  dsa:              'Trace through this step with me... (?)',
  mathematics:      'Why does this equation work? (?)',
  physics:          'I don\'t understand this force... (?)',
  chemistry:        'How do these atoms bond here? (?)',
  biology:          'Which organelle does this? (?)',
  medicine:         'What would this mean clinically? (?)',
  computer_science: 'What happens in memory here? (?)',
  engineering:      'Where does this force go? (?)',
  business:         'How does this apply to real cases? (?)',
  law:              'What\'s the legal principle here? (?)',
  history:          'Why did this happen at this moment? (?)',
  psychology:       'Is this behavior always true? (?)',
  economics:        'What causes this market shift? (?)',
  general:          'Ask a doubt or give a command... (?)',
};

// States where StepPanel should be visible
const PANEL_VISIBLE_STATES = new Set([STATES.TEACHING, STATES.RESPONDING, STATES.RESUMING]);

const TeachingSession = ({ initialTopic }) => {
  const machine = useTeachingMachine();
  const {
    machineState, isConnected,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStep, currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory,
    error,
    topic,
    isPlaying,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, finish, setSpeed, endSession,
  } = machine;

  const {
    canvasMode, canvasTransform, voiceEnabled, playbackSpeed,
    showFloatingSidebar,
    setCanvasMode, setCanvasTransform, toggleVoice,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, toggleDoubtThread,
    showDoubtThread,
    showNotes, 
    deselectAll,
  } = useTutorStore();

  const isOpen = machineState !== STATES.IDLE;
  const isTeachingActive = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING;

  const handleClose = useCallback(() => {
    endSession(); // CLEANUP server session on close!
  }, [endSession]);

  const [doubtInput, setDoubtInput] = useState('');
  const canvasRef = useRef(null);
  const doubtInputRef = useRef(null);


  const handleSpeedChange = useCallback((spd) => {
    storeSetSpeed(spd);
    setSpeed(spd);
  }, [setSpeed, storeSetSpeed]);

  const handleMinimize = useCallback(() => setCanvasMode(CANVAS_MODE.MINIMIZED), [setCanvasMode]);
  const handleExpand   = useCallback(() => setCanvasMode(CANVAS_MODE.FULLSCREEN), [setCanvasMode]);

  const handleDoubtSubmit = useCallback(() => {
    if (!doubtInput.trim() || isDoubtProcessing) return;
    askDoubt(doubtInput.trim());
    setDoubtInput('');
  }, [doubtInput, isDoubtProcessing, askDoubt]);

  const handleRetry = useCallback(() => {
    if (initialTopic) startSession(initialTopic);
  }, [initialTopic, startSession]);

  // Start or Resume session on open
  useEffect(() => {
    if (isOpen && initialTopic) {
      // CASE 1: No session started yet
      if (machineState === STATES.IDLE && !timeline) {
        startSession(initialTopic, initialTopic);
        return;
      }

      // CASE 2: Topic has changed while session was IDLE or exist
      // We check if the current topic (from machine) matches initialTopic
      const isSameTopic = topic?.toLowerCase() === initialTopic.toLowerCase();
      
      if (!isSameTopic && machineState !== STATES.GENERATING) {
        console.log(`[Session] Topic changed from "${topic}" to "${initialTopic}". Resetting.`);
        endSession(); // Clear previous topic state
        // The next tick will trigger Case 1
      }
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline, topic, endSession]);



  // Voice narration
  useEffect(() => {
    // BUG FIX #58: Feature detection for speechSynthesis (not available in all browsers)
    if (!window.speechSynthesis) return;
    
    // Force immediate cancel on any change (Bug 41 Fix)
    window.speechSynthesis.cancel();

    if (voiceEnabled && currentStep?.narration && PANEL_VISIBLE_STATES.has(machineState)) {
      const text = currentStep.narration || currentStep.description;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = playbackSpeed;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      // We wrap it in a small timeout to ensure internal state of synth is ready
      const t = setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);

      return () => {
        clearTimeout(t);
        window.speechSynthesis.cancel();
      };
    }
  }, [currentStepIndex, voiceEnabled, currentStep, machineState, playbackSpeed]);

  // Auto-fit on doubt response visuals
  useEffect(() => {
    if (doubtResponse?.hasVisuals && canvasRef.current) {
      const timer = setTimeout(() => {
        canvasRef.current.fitToContent?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [doubtResponse]);

  // Keyboard shortcuts removed per user request
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      // Standard accessibility Escape-to-close preserved, all others stripped
      if (e.key === 'Escape') { handleClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

// Redundant callback placement removed. Still using memoized versions.

  // Memoized canvas callbacks to stabilize render cycle
  const handleZoomChange = useCallback((scale) => {
    setCanvasTransform(prev => (prev.scale === scale ? prev : { ...prev, scale }));
  }, [setCanvasTransform]);

  const handleViewportChange = useCallback((transform) => {
    setCanvasTransform(transform);
  }, [setCanvasTransform]);

  const handleZoomIn = useCallback(() => {
    setCanvasTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.3) }));
  }, [setCanvasTransform]);

  const handleZoomOut = useCallback(() => {
    setCanvasTransform(prev => ({ ...prev, scale: Math.max(0.15, prev.scale / 1.3) }));
  }, [setCanvasTransform]);

  const handleResetView = useCallback(() => {
    setCanvasTransform({ x: 0, y: 0, scale: 1 });
  }, [setCanvasTransform]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const domain = timeline?.domain?.toLowerCase() || 'general';
  const domainStyle = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const isGenerating = machineState === STATES.GENERATING;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      {/* ─── 1. LOADING OVERLAY (Doubt Generation) ─── */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-24 h-24">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-t-2 border-r-2 border-white/20 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4 border-b-2 border-l-2 border-white/40 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
              >
                Synthesizing Knowledge...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 2. TOP COMMAND HEADER ─── */}
      <AnimatePresence>
        {isTeachingActive && (
          <div className="absolute top-6 inset-x-0 z-[1000] flex justify-center px-6 pointer-events-none">
            <motion.header
              initial={{ y: -40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
              className="flex items-center gap-1.5 p-1.5 rounded-[28px] bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] pointer-events-auto"
            >
              <button
                onClick={openFloatingSidebar}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95 group"
                title="Workspace (Alt + S)"
              >
                <Menu size={18} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>

              <div className="h-6 w-px bg-[var(--border-color)] mx-1" />

              <div className="flex items-center gap-4 pl-3 pr-5 py-1.5 min-w-[200px] max-w-[500px]">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.12em] border shadow-sm"
                      style={{
                        backgroundColor: domainStyle.bg,
                        borderColor: domainStyle.border,
                        color: domainStyle.text,
                      }}
                    >
                      {domainStyle.label}
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                  <h1 className="text-[13px] font-medium text-[var(--text-primary)] truncate max-w-full">
                    {timeline?.title || "Session"}
                  </h1>
                </div>
              </div>

              <div className="h-6 w-px bg-[var(--border-color)] mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleDoubtThread}
                  className={`w-11 h-11 flex items-center justify-center rounded-2xl border transition-all relative group ${
                    showDoubtThread ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  <MessageCircleQuestion size={18} strokeWidth={2.2} />
                </button>

                <button
                  onClick={toggleVoice}
                  className={`w-11 h-11 flex items-center justify-center rounded-2xl border transition-all ${
                    voiceEnabled ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  {voiceEnabled ? <Volume2 size={18} strokeWidth={2.2} /> : <VolumeX size={18} strokeWidth={2.2} />}
                </button>

                <div className="h-6 w-px bg-[var(--border-color)] mx-1" />

                <button
                  onClick={handleClose}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </motion.header>
          </div>
        )}
      </AnimatePresence>

      {/* ─── HUDs & NARRATION ─── */}
      <NarrationBar 
        text={currentStep?.narration || currentStep?.explanation} 
        isGenerating={machineState === STATES.GENERATING}
      />

      <AnimatePresence>
        {isTeachingActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MasteryHUD />
            <ProgressArc />
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingSidebar />
      <DoubtThread />

      {/* ─── NAVIGATION DOCK (Bottom) ─── */}
      <AnimatePresence>
        {isTeachingActive && (
          <div className="absolute bottom-8 inset-x-0 z-[1000] flex flex-col items-center gap-6 pointer-events-none">
            {canvasObjects.length > 0 && (
              <StepFilmstrip steps={canvasSteps} currentStepIndex={currentStepIndex} goToStep={goToStep} />
            )}

            <motion.footer
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="flex items-center gap-3 p-2 rounded-[32px] bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] pointer-events-auto"
            >
              <div className="flex items-center gap-1.5 px-1.5">
                <button onClick={prevStep} disabled={currentStepIndex <= 0} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all disabled:opacity-20">
                  <SkipBack size={18} strokeWidth={2.2} />
                </button>

                <button
                  onClick={isPlaying ? pause : play}
                  className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-xl transition-all"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                <button onClick={nextStep} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all">
                  <SkipForward size={18} strokeWidth={2.2} />
                </button>
              </div>

              <div className="h-8 w-px bg-[var(--border-color)]" />

              {/* Doubt Input Command Bar */}
              <div className="flex items-center gap-3 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl px-4 py-1.5 min-w-[300px]">
                <MessageCircleQuestion size={16} className="text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={doubtInput}
                  onChange={(e) => setDoubtInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDoubtSubmit();
                  }}
                  placeholder="Ask a doubt..."
                  className="flex-1 bg-transparent text-[var(--text-primary)] text-[13px] outline-none"
                />
                <button onClick={handleDoubtSubmit} className="w-8 h-8 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl">
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="h-8 w-px bg-[var(--border-color)]" />

              {/* Speed & Stats */}
              <div className="flex items-center gap-2 pr-3">
                <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-1">
                  {[1, 1.5, 2].map(spd => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${playbackSpeed === spd ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-tertiary)]'}`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>
            </motion.footer>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingSession;