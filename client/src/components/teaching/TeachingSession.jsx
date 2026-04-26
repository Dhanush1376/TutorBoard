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
import { DOMAIN_STYLES, DOUBT_PLACEHOLDERS, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR } from '../../lib/teaching';

// States where StepPanel should be visible
const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

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

              {/* Header Controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={toggleDoubtThread}
                  className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-2xl border transition-all relative group ${
                    showDoubtThread ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  <MessageCircleQuestion size={18} strokeWidth={2.2} />
                </button>

                <button
                  onClick={toggleVoice}
                  className={`hidden sm:flex w-11 h-11 items-center justify-center rounded-2xl border transition-all ${
                    voiceEnabled ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  {voiceEnabled ? <Volume2 size={18} strokeWidth={2.2} /> : <VolumeX size={18} strokeWidth={2.2} />}
                </button>

                <div className="h-6 w-px bg-[var(--border-color)] mx-0.5 sm:mx-1" />

                <button
                  onClick={handleClose}
                  className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
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
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="hidden lg:block"
          >
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
              <div className="hidden sm:block">
                <StepFilmstrip steps={canvasSteps} currentStepIndex={currentStepIndex} goToStep={goToStep} />
              </div>
            )}

            <motion.footer
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-3xl sm:rounded-[32px] bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] pointer-events-auto max-w-[95vw]"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1.5">
                <button onClick={prevStep} disabled={currentStepIndex <= 0} className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all disabled:opacity-20">
                  <SkipBack size={16} sm:size={18} strokeWidth={2.2} />
                </button>

                <button
                  onClick={isPlaying ? pause : play}
                  className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-xl transition-all"
                >
                  {isPlaying ? <Pause size={20} sm:size={24} fill="currentColor" /> : <Play size={20} sm:size={24} fill="currentColor" className="ml-1" />}
                </button>

                <button onClick={nextStep} className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all">
                  <SkipForward size={16} sm:size={18} strokeWidth={2.2} />
                </button>
              </div>

              <div className="hidden sm:block h-8 w-px bg-[var(--border-color)]" />

              {/* Doubt Input Command Bar */}
              <div className="flex items-center gap-2 sm:gap-3 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1 sm:py-1.5 min-w-0 sm:min-w-[300px] flex-1 sm:flex-initial">
                <MessageCircleQuestion size={14} className="hidden xs:block text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={doubtInput}
                  onChange={(e) => setDoubtInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDoubtSubmit();
                  }}
                  placeholder="Doubt?"
                  className="flex-1 bg-transparent text-[var(--text-primary)] text-[12px] sm:text-[13px] outline-none min-w-[60px]"
                />
                <button onClick={handleDoubtSubmit} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg sm:rounded-xl">
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>

              {/* Speed & Stats - Hidden on very small screens */}
              <div className="hidden sm:flex items-center gap-2 pr-1 sm:pr-3">
                <div className="h-8 w-px bg-[var(--border-color)] mr-2" />
                <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-1">
                  {[1, 1.5, 2].map(spd => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold ${playbackSpeed === spd ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-tertiary)]'}`}
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