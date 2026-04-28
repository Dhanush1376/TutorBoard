/**
 * TeachingSession v3.1 — OVERLAY-BASED IMMERSIVE VISUAL LEARNING ENGINE
 *
 * Renders as an overlay on top of the existing InfiniteCanvas.
 * All elements are dynamically generated from machine state.
 * Nothing extends outside the canvas frame.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Minimize2, Maximize2, Menu,
  Loader, Check, WifiOff
} from 'lucide-react';

import InfiniteCanvas from '../canvas/InfiniteCanvas';
import AgentCanvasRenderer from '../canvas/AgentCanvasRenderer';
import InteractiveCanvasLayer from '../canvas/InteractiveCanvasLayer';
import CanvasControls from '../canvas/CanvasControls';
import FloatingSidebar from './FloatingSidebar';
import SessionOverlay from './SessionOverlay';
import StepPanel from './StepPanel';
import NarrationBar from './NarrationBar';
import StepFilmstrip from './StepFilmstrip';
import MasteryHUD from './MasteryHUD';
import ShortcutsHUD from './ShortcutsHUD';
import ProgressArc from './ProgressArc';
import SessionResumeOverlay from './SessionResumeOverlay';
import DoubtThread from './DoubtThread';
import DoubtTimeline from './DoubtTimeline';
import DoubtPanel from './DoubtPanel';
import { isDSAContent } from '../../engine/RendererRouter';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';
import { DOMAIN_STYLES, DOUBT_PLACEHOLDERS, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR } from '../../lib/teaching';

// States where StepPanel should be visible
const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

const TeachingSession = ({ initialTopic }) => {
  const machine = useTeachingMachine(true, false);
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
    openFloatingSidebar,
    showNotes,
    deselectAll,
  } = useTutorStore();

  const isOpen = machineState !== STATES.IDLE;
  const isTeachingActive = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING;

  const handleClose = useCallback(() => {
    endSession();
  }, [endSession]);

  const canvasRef = useRef(null);

  const handleSpeedChange = useCallback((spd) => {
    storeSetSpeed(spd);
    setSpeed(spd);
  }, [setSpeed, storeSetSpeed]);

  const handleMinimize = useCallback(() => setCanvasMode(CANVAS_MODE.MINIMIZED), [setCanvasMode]);
  const handleExpand = useCallback(() => setCanvasMode(CANVAS_MODE.FULLSCREEN), [setCanvasMode]);

  const handleRetry = useCallback(() => {
    if (initialTopic) startSession(initialTopic);
  }, [initialTopic, startSession]);

  // Start or Resume session on open
  useEffect(() => {
    if (isOpen && initialTopic) {
      if (machineState === STATES.IDLE && !timeline) {
        startSession(initialTopic, initialTopic);
        return;
      }

      const isSameTopic = topic?.toLowerCase() === initialTopic.toLowerCase();

      if (!isSameTopic && machineState !== STATES.GENERATING) {
        console.log(`[Session] Topic changed from "${topic}" to "${initialTopic}". Resetting.`);
        endSession();
      }
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline, topic, endSession]);

  // Voice narration
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    if (voiceEnabled && currentStep?.narration && PANEL_VISIBLE_STATES.has(machineState)) {
      const text = currentStep.narration || currentStep.description;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = playbackSpeed;
      utterance.pitch = 1;
      utterance.volume = 0.8;

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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { handleClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  // Memoized canvas callbacks
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
  const isAlgorithm = isDSAContent(timeline);
  const isD3 = (timeline?.renderer || '').toLowerCase() === 'd3';
  const hideHUDs = isAlgorithm || isD3;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      {/* ─── 1. LOADING OVERLAY (Generation Phase) ─── */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md pointer-events-auto"
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
      {isTeachingActive && (
        <div className={`fixed top-12 z-[9999] pointer-events-none ${hideHUDs ? 'left-12' : 'inset-x-0 flex justify-center px-8'}`}>
          {hideHUDs ? (
            /* Minimalist Algorithm Title (Top Left) */
            <div
              key={`hud-header-${topic}-${timeline?.title}`}
              className="flex items-start gap-6 pointer-events-auto"
            >
              <button
                onClick={openFloatingSidebar}
                className="mt-2 w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm"
              >
                <Menu size={18} strokeWidth={2.5} />
              </button>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border"
                    style={{
                      backgroundColor: `${domainStyle.bg}22`,
                      borderColor: `${domainStyle.border}44`,
                      color: domainStyle.text,
                    }}
                  >
                    {domainStyle.label}
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-tertiary)]/50 backdrop-blur-md border border-[var(--border-color)]/30 rounded-full text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
                <h1 className="text-4xl font-serif text-[var(--text-primary)] tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                  {timeline?.title || topic || "Session"}
                </h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-2 opacity-50">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">
                      Step {currentStepIndex + 1} of {canvasSteps.length || 1}
                    </span>
                    <div className="h-px w-8 bg-[var(--text-primary)]/30" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] truncate max-w-[200px]">
                      {canvasSteps[currentStepIndex]?.title || ""}
                    </span>
                  </div>

                  {/* Quick Next Step Button */}
                  {currentStepIndex < totalSteps - 1 && (
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={nextStep}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-110 active:scale-90 transition-all pointer-events-auto"
                    >
                      <SkipForward size={12} fill="currentColor" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Standard Pill Header (Top Center) */
            <motion.header
              key="pill-header"
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
                  <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight truncate">
                    {timeline?.title || topic || "Session"}
                  </h2>
                </div>
              </div>

              <div className="h-6 w-px bg-[var(--border-color)] mx-1" />

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={toggleVoice}
                  className={`hidden sm:flex w-11 h-11 items-center justify-center rounded-2xl border transition-all ${voiceEnabled ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
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
          )}
        </div>
      )}

      {/* ─── 2b. FLOATING CLOSE BUTTON (Algorithm Mode) ─── */}
      <AnimatePresence>
        {isTeachingActive && hideHUDs && (
          <div className="absolute top-8 right-8 z-[1000] pointer-events-none">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleClose}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] text-red-400 hover:bg-red-500 hover:text-white transition-all pointer-events-auto shadow-lg"
            >
              <X size={20} strokeWidth={2.5} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 3. NARRATION BAR (Suppressed for algorithms) ─── */}
      {!isAlgorithm && (
        <NarrationBar
          text={currentStep?.narration || currentStep?.explanation}
          isGenerating={machineState === STATES.GENERATING}
        />
      )}

      {/* ─── 4. HUDs (Suppressed for algorithms) ─── */}
      <AnimatePresence>
        {isTeachingActive && !hideHUDs && (
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

      {/* ─── 5. FLOATING PANELS (Sidebar) ─── */}
      <FloatingSidebar />

      {/* ─── 5b. DOUBT UX (Non-Algorithm only) ─── */}
      {!isAlgorithm && (
        <>
          <DoubtTimeline />
          <DoubtThread />
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[1000] w-full px-8 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto">
              <DoubtPanel
                onAskDoubt={askDoubt}
                isProcessing={isDoubtProcessing}
                doubtHistory={doubtHistory}
                currentStepTitle={currentStep?.title}
              />
            </div>
          </div>
        </>
      )}

      {/* ─── 6. NAVIGATION DOCK (Bottom, within canvas bounds) ─── */}
      <AnimatePresence>
        {isTeachingActive && (
          <div className="absolute bottom-8 inset-x-0 z-[1000] flex flex-col items-center gap-6 pointer-events-none">
            {canvasObjects.length > 0 && !hideHUDs && (
              <div className="hidden sm:block">
                <StepFilmstrip steps={canvasSteps} currentStepIndex={currentStepIndex} goToStep={goToStep} />
              </div>
            )}

            <motion.footer
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="flex items-center gap-4 p-2 rounded-[32px] bg-[var(--glass-bg)] backdrop-blur-3xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] pointer-events-auto max-w-[95vw]"
            >
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={prevStep}
                  disabled={currentStepIndex <= 0}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-20 active:scale-95"
                >
                  <SkipBack size={18} strokeWidth={2.5} />
                </button>

                <button
                  onClick={isPlaying ? pause : play}
                  className="w-16 h-16 flex items-center justify-center rounded-[22px] bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                <button
                  onClick={nextStep}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                >
                  <SkipForward size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="h-10 w-px bg-[var(--border-color)]/50 mx-1" />

              {/* Speed Segmented Control */}
              <div className="hidden sm:flex items-center bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)]/30 rounded-2xl p-1.5 gap-1">
                {[1, 1.5, 2].map(spd => (
                  <button
                    key={spd}
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight transition-all ${playbackSpeed === spd
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    {spd}×
                  </button>
                ))}
              </div>
            </motion.footer>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingSession;