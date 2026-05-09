import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Menu, PanelRight, PanelRightClose, ChevronLeft, ArrowUp, Loader2, Sparkles,
  RotateCcw, RefreshCw, Dices, Crosshair
} from 'lucide-react';
import { useElapsedTime } from '../../hooks/useElapsedTime';

import AgentCanvasRenderer from '../canvas/AgentCanvasRenderer';
import FixedTeachingStage from '../canvas/FixedTeachingStage';
import CinematicStage from '../canvas/CinematicStage';
import FloatingSidebar from './FloatingSidebar';
import StepPanel from './StepPanel';
import NarrationBar from './NarrationBar';
import InteractiveControlPanel from './InteractiveControlPanel';
import UnifiedControlBar from './UnifiedControlBar';
import { AlgoRightPanel } from './AlgoRightPanel';
import StudyPanel from './StudyPanel';
import MasteryHUD from './MasteryHUD';
import StepFilmstrip from './StepFilmstrip';
import ParticleWaves from '../canvas/ParticleWaves';
import { isDSAContent } from '../../engine/RendererRouter';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';
import { DOMAIN_STYLES, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR, formatTopicTitle } from '../../lib/teaching';

const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

function Btn({ onClick, children, disabled, active, danger, className = '', title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 pointer-events-auto select-none ${className} ${
        disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
      } ${
        active 
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
          : 'bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
      style={{
        color: (danger && !active) ? '#ef4444' : undefined,
        border: 'none',
      }}>
      {children}
    </button>
  );
}

const TeachingSession = ({ initialTopic }) => {
  const machine = useTeachingMachine(true, false);
  const {
    machineState, isConnected,
    timeline, learningNodes, mode, difficulty, professorNote, memoryAnchor, keyFormula,
    currentStep, currentStepIndex, totalSteps,
    canvasObjects, canvasConnections, canvasSteps,
    doubtResponse, isDoubtProcessing, doubtHistory,
    error, topic, isPlaying,
    startSession, askDoubt, goToStep, nextStep, prevStep,
    play, pause, resume, finish, setSpeed, endSession, cancelSession,
  } = machine;

  const {
    canvasMode, playbackSpeed,
    setCanvasMode,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, showNotes, deselectAll,
    levelUpEvent, setLevelUpEvent, showToast,
    isExplainMinimized: isMinimized,
    setExplainMinimized: setIsMinimized,
    canvasLayout,
    activeArtifactId
  } = useTutorStore();

  const isOpen = machineState !== STATES.IDLE || canvasLayout !== 'inline';
  const isTeaching = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING || machineState === STATES.GENERATING || (machineState === STATES.IDLE && activeArtifactId);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWide, setPanelWide] = useState(false);
  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Handlers ──────────────────────────────────────────────

  const handleClose = useCallback(() => {
    endSession();
  }, [endSession]);

  const handleSpeed = useCallback((s) => {
    storeSetSpeed(s);
    setSpeed(s);
  }, [setSpeed, storeSetSpeed]);

  // ── Effects ───────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && initialTopic) {
      if (machineState === STATES.IDLE && !timeline) {
        startSession(initialTopic, initialTopic);
        setCanvasMode(CANVAS_MODE.FULLSCREEN);
        return;
      }
      const same = topic?.toLowerCase() === initialTopic.toLowerCase();
      if (!same && machineState !== STATES.GENERATING) endSession();
    }
  }, [isOpen, initialTopic, machineState, startSession, timeline, topic, endSession]);



  // ── Keyboard Navigation ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      } else if (e.key === ' ' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        isPlaying ? pause() : play();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, handleClose, nextStep, prevStep, isPlaying, play, pause]);

  // Level-up toast
  useEffect(() => {
    if (levelUpEvent) {
      showToast({ message: levelUpEvent.message, type: 'success', duration: 4000 });
      const t = setTimeout(() => setLevelUpEvent(null), 4000);
      return () => clearTimeout(t);
    }
  }, [levelUpEvent, showToast, setLevelUpEvent]);

  // ── Focus Trap & Accessibility ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;

    // Set initial focus to the close button or first interactive element
    const initialFocus = rootRef.current?.querySelector('button[title="Close"]');
    if (initialFocus) initialFocus.focus();

    const handleFocusTrap = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(rootRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || []);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else { // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => {
      window.removeEventListener('keydown', handleFocusTrap);
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  // Time
  const { formatted, formatTime } = useElapsedTime(isPlaying, machineState === STATES.GENERATING);
  const totalFormatted = formatTime(totalSteps * 8);

  // ── Bail ──────────────────────────────────────────────────
  if (!isOpen) return null;

  const domain = timeline?.domain?.toLowerCase() || 'general';
  const ds = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const domainColor = ds.accent || '#6366f1';
  const isGenerating = machineState === STATES.GENERATING;
  const isAlgo = isDSAContent(timeline);
  const isD3 = (timeline?.renderer || '').toLowerCase() === 'd3';
  const useAlgoPanel = true; // Consolidate to the richer panel for all sessions

  // ── Minimized pill ────────────────────────────────────────
  if (isMinimized && isTeaching) {
    return (
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-6 right-6 z-[60]"
      >
        <button
          onClick={() => setIsMinimized(false)}
          style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="text-[10px] font-medium truncate max-w-[120px]">{topic}</span>
          <ChevronLeft size={13} className="opacity-60 rotate-180" />
        </button>
      </motion.div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="teaching-session"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teaching-session-title"
      tabIndex="-1"
    >
      {/* ── 1. Floating Toolbar (Top Level for max interactivity) ── */}


      {/* ── 2. Body ─────────────────────────────────────────── */}
       {isTeaching && (
        <div 
          className="teaching-body"
          style={{
            '--theme-color': domainColor,
            '--theme-color-light': `${domainColor}20`,
            '--theme-color-glow': `${domainColor}40`,
          }}
        >
          {/* Global Ambient Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* ── Subtle Grid Pattern ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundSize: '40px 40px',
                backgroundImage: `
                  linear-gradient(to right, var(--border-color) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
                `,
                opacity: 0.15,
                maskImage: 'radial-gradient(ellipse 120% 120% at 50% 50%, black, transparent)',
                WebkitMaskImage: 'radial-gradient(ellipse 120% 120% at 50% 50%, black, transparent)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <ParticleWaves opacity={0.3} />
          </div>

          {/* Canvas Area (Flex sibling for dynamic adjustment) */}
          <motion.div layout className="teaching-canvas-area" style={{ background: 'transparent' }}>
            <div className="absolute inset-0 overflow-visible">
              <CinematicStage
                topic={topic}
                currentStepIndex={currentStepIndex}
                totalSteps={canvasSteps.length}
                domain={timeline?.domain || 'general'}
                isGenerating={isGenerating}
                hideControls={true}
                activeScene={timeline}
              >
                <AgentCanvasRenderer
                  ref={canvasRef}
                  width={800} height={600}
                  timeline={timeline} objects={canvasObjects || []} steps={canvasSteps}
                  currentStepIndex={currentStepIndex} onGoToStep={goToStep}
                  doubtHistory={doubtHistory} isDoubtProcessing={isDoubtProcessing}
                  activeDoubtId={machine.activeDoubtId} onJumpToDoubt={machine.jumpToDoubt}
                  onPinDoubt={machine.pinDoubtToCanvas} onResume={resume} onAskDoubt={askDoubt}
                  hideAlgoPanel={true}
                />
              </CinematicStage>
            </div>

            {/* ── Step Orientation Pill (Floating Context) ── */}
            <div className="absolute top-[68px] left-4 z-[45] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                key={`step-pill-${currentStepIndex}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] liquid-glass"
                style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.08)' }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    background: currentStep?.type === 'summary' ? '#ca8a04' :
                      currentStep?.type === 'example' ? '#16a34a' :
                        currentStep?.type === 'intro' ? '#2563eb' : 'var(--text-primary)'
                  }}
                />
                <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-secondary)' }}>
                  {currentStep?.type || 'Core'} · {currentStepIndex + 1}
                </span>
              </motion.div>
            </div>

            {/* ── Canvas Empty State Placeholder ── */}
            {(!isGenerating && !canvasSteps[currentStepIndex]?.objects?.length && !canvasObjects?.length) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[40]">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-3xl bg-[var(--text-primary)] opacity-[0.03] rounded-full" />
                    <div className="relative">
                      <Sparkles className="w-12 h-12 text-[var(--text-primary)] opacity-[0.07] animate-pulse" />
                      {/* Subtle loading ring when active but empty */}
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-[-12px] border border-[var(--text-primary)] opacity-[0.05] rounded-full border-t-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <h3 className="text-xl font-light tracking-[0.2em] text-[var(--text-primary)] opacity-[0.15] uppercase">
                      {topic ? `Visualizing ${topic}` : "Intelligent Visualizer"}
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--text-primary)] opacity-[0.1] tracking-[0.3em] uppercase">
                      Initializing Canvas...
                    </p>
                  </div>
                </motion.div>
              </div>
            )}

            {/* 1. Narration Subtitle (Fixed Position Above Controls) */}
            {!useAlgoPanel && (
              <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 z-[50] flex justify-center w-full max-w-[90%] md:max-w-3xl pointer-events-none">
                <div className="pointer-events-auto w-full flex justify-center">
                  <NarrationBar 
                    text={currentStep?.narration || currentStep?.explanation} 
                    isGenerating={isGenerating} 
                    onCancel={cancelSession}
                  />
                </div>
              </div>
            )}

            {/* ── Vertical Session Actions Pill (Bottom Left) ── */}
            <div className="absolute bottom-8 left-4 z-[50] pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-1 p-1.5 rounded-2xl liquid-glass pointer-events-auto"
                style={{ boxShadow: '0 8px 24px -4px rgba(0,0,0,0.1)' }}
              >
                <Btn onClick={() => goToStep(0)} title="Reset to Start" className="rounded-xl">
                  <RotateCcw size={14} />
                </Btn>
                <Btn onClick={() => goToStep(currentStepIndex)} title="Replay Step" className="rounded-xl">
                  <RefreshCw size={13} />
                </Btn>
                <Btn onClick={() => canvasRef.current?.resetCamera()} title="Reset View" className="rounded-xl">
                  <Crosshair size={14} />
                </Btn>
                <Btn onClick={() => startSession(topic, topic)} title="New Example" className="rounded-xl">
                  <Dices size={14} />
                </Btn>
              </motion.div>
            </div>

            {/* ── Unified Floating Controls (Bottom Center) ── */}
            <motion.div 
              className="absolute bottom-8 left-1/2 z-[50] flex flex-col items-center pointer-events-none w-full"
              animate={{ 
                x: panelOpen ? (panelWide ? -210 : -160) : 0 
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              style={{ translateX: '-50%' }}
            >
              {/* ── Visual Timeline (Filmstrip) ── */}
              {isAlgo && canvasSteps.length > 1 && (
                <div className="mb-3 pointer-events-auto">
                  <StepFilmstrip 
                    steps={canvasSteps} 
                    currentStepIndex={currentStepIndex} 
                    goToStep={goToStep} 
                  />
                </div>
              )}
              
              <div className="relative pointer-events-auto">
                <UnifiedControlBar
                  currentStepIndex={currentStepIndex}
                  totalSteps={totalSteps}
                  isPlaying={isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onPrevStep={prevStep}
                  onNextStep={nextStep}
                  onGoToStep={goToStep}
                  onSpeedChange={handleSpeed}
                  onAskDoubt={askDoubt}
                />
              </div>
            </motion.div>

            {/* Expand Panel Handle (Appears when panel is closed) */}
            <AnimatePresence>
              {!panelOpen && (
                <motion.button
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  onClick={() => setPanelOpen(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-[45] flex items-center justify-center w-6 h-16 pointer-events-auto transition-colors liquid-glass"
                  style={{
                    borderRight: 'none',
                    borderTopLeftRadius: '16px',
                    borderBottomLeftRadius: '16px',
                  }}
                  title="Open Session Guide"
                >
                  <ChevronLeft size={16} className="opacity-70 hover:opacity-100" style={{ color: 'var(--text-primary)' }} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right Panel (Flex Sibling for Dynamic Adjustment) */}
          <AnimatePresence>
            {panelOpen && (
               <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.98 }}
                transition={{ 
                  type: 'spring',
                  damping: 32,
                  stiffness: 280,
                  opacity: { duration: 0.2 }
                }}
                className="teaching-right-panel"
                style={{
                  position: 'absolute',
                  right: '24px',
                  top: '92px',
                  bottom: '72px',
                  width: panelWide ? '420px' : '320px',
                  borderRadius: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 100,
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 24px 64px -12px rgba(0,0,0,0.4)',
                  willChange: 'transform, opacity',
                  backfaceVisibility: 'hidden',
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Header (Sticky) */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg, #a78bfa, #6366f1)' }} />
                      <motion.div 
                        className="absolute inset-0 w-2 h-2 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #a78bfa, #6366f1)' }}
                        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                      Session Guide
                    </span>
                  </div>
                  <div className="flex items-center gap-1">

                    <button onClick={() => setPanelOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400 active:scale-90 cursor-pointer" style={{ color: 'var(--text-tertiary)' }} title="Close">
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Scrollable Content Wrapper */}
                <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
                  {/* Mastery & Stats */}
                  {isAlgo && (
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <MasteryHUD />
                    </div>
                  )}

                  <AlgoRightPanel
                    step={{ 
                      ...currentStep, 
                      narration: currentStepIndex === 0 ? (timeline?.professorNote || currentStep?.narration) : currentStep?.narration || canvasSteps[currentStepIndex]?.narration 
                    }}
                    stepIndex={currentStepIndex} 
                    totalSteps={totalSteps}
                    variables={canvasSteps[currentStepIndex]?.variables || currentStep?.variables}
                    activeStates={canvasSteps[currentStepIndex]?.activeStates || currentStep?.activeStates}
                    algorithmName={timeline?.title || topic} 
                    timeline={timeline} 
                    onGoToStep={goToStep}
                    doubtHistory={doubtHistory} 
                    isDoubtProcessing={isDoubtProcessing}
                    activeDoubtId={machine.activeDoubtId} 
                    onJumpToDoubt={machine.jumpToDoubt}
                    onPinDoubt={machine.pinDoubtToCanvas} 
                    onResume={resume} 
                    onAskDoubt={askDoubt}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <StudyPanel isOpen={studyPanelOpen} onClose={() => setStudyPanelOpen(false)} />
      {/* Removed old timeline since it's now a floating pill in the canvas area */}

      <FloatingSidebar />

      {/* ── 4. Top Toolbar (Last in DOM to stay on top) ── */}
      {isTeaching && (
        <div className="absolute top-4 left-4 z-[99999] pointer-events-auto">
          <div
            className="flex items-center gap-2.5 px-3.5 py-[6px] rounded-[22px] w-max liquid-glass"
            style={{ height: '48px', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-2.5 shrink-0">
              <Btn onClick={openFloatingSidebar} title="Menu" className="rounded-full"><Menu size={15} /></Btn>
              <div className="w-px h-4 bg-[var(--border-color)] opacity-40" />
              <span style={{ color: 'var(--text-primary)' }} className="text-[13px] font-sans font-medium tracking-wide truncate max-w-[180px] md:max-w-[350px]">
                {formatTopicTitle(timeline?.title || topic)}
              </span>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)] opacity-40 shrink-0" />

            <div className="flex items-center gap-0.5 shrink-0">
              <span style={{ color: 'var(--text-tertiary)' }} className="hidden md:block px-1.5 text-[11px] font-mono font-semibold tabular-nums">
                {currentStepIndex + 1}/{canvasSteps.length || 1}
              </span>

              <Btn onClick={() => setStudyPanelOpen(!studyPanelOpen)} active={studyPanelOpen} title="Study Insights" className="hidden sm:flex rounded-full">
                <Sparkles size={13} />
              </Btn>
              <Btn onClick={() => setPanelOpen(!panelOpen)} title={panelOpen ? 'Hide panel' : 'Show panel'} className="rounded-full">
                {panelOpen ? <PanelRightClose size={13} /> : <PanelRight size={13} />}
              </Btn>
              <Btn onClick={handleClose} danger title="Close" className="rounded-full"><X size={13} /></Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Tiny helpers ─────────────────────────────────────────── */

function Dot({ ok }) {
  return (
    <span className="flex items-center gap-1 text-[9px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {ok ? 'Live' : 'Offline'}
    </span>
  );
}

// BTN helper removed or moved if needed

export default TeachingSession;