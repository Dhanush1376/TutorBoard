/**
 * TeachingSession — Structured teaching canvas.
 *
 * Layout (absolute inside Layout content area):
 *   ┌────────────────────────────────────────┐
 *   │  Header (48px)                         │
 *   ├───────────────────────┬────────────────┤
 *   │                       │  Right Panel   │
 *   │  Canvas Area          │  (320px)       │
 *   │                       │                │
 *   ├───────────────────────┴────────────────┤
 *   │  Timeline (52px)                       │
 *   └────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Minimize2, Maximize2, Menu, PanelRight, PanelRightClose, ChevronLeft, ArrowUp, Loader2
} from 'lucide-react';
import { useElapsedTime } from '../../hooks/useElapsedTime';

import InfiniteCanvas from '../canvas/InfiniteCanvas';
import AgentCanvasRenderer from '../canvas/AgentCanvasRenderer';
import FloatingSidebar from './FloatingSidebar';
import StepPanel from './StepPanel';
import NarrationBar from './NarrationBar';
import DoubtThread from './DoubtThread';
import DoubtPanel from './DoubtPanel';
import InteractiveControlPanel from './InteractiveControlPanel';
import { AlgoRightPanel } from './AlgoRightPanel';
import { isDSAContent } from '../../engine/RendererRouter';
import useTeachingMachine, { STATES } from '../../hooks/useTeachingMachine';
import useTutorStore, { CANVAS_MODE } from '../../store/tutorStore';
import { DOMAIN_STYLES, PANEL_VISIBLE_STATES as PANEL_VISIBLE_STATES_ARR, formatTopicTitle } from '../../lib/teaching';

const PANEL_VISIBLE_STATES = new Set(PANEL_VISIBLE_STATES_ARR);

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
    play, pause, resume, finish, setSpeed, endSession,
  } = machine;

  const {
    canvasMode, canvasTransform, voiceEnabled, playbackSpeed,
    setCanvasMode, setCanvasTransform, toggleVoice,
    setPlaybackSpeed: storeSetSpeed,
    openFloatingSidebar, showNotes, deselectAll,
    levelUpEvent, setLevelUpEvent, showToast,
    isExplainMinimized: isMinimized,
    setExplainMinimized: setIsMinimized,
  } = useTutorStore();

  const isOpen = machineState !== STATES.IDLE;
  const isTeaching = machineState === STATES.TEACHING || machineState === STATES.RESPONDING || machineState === STATES.RESUMING;
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWide, setPanelWide] = useState(false);
  const canvasRef = useRef(null);

  // ── Handlers ──────────────────────────────────────────────

  const handleClose = useCallback(() => endSession(), [endSession]);

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

  // Voice
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (voiceEnabled && currentStep?.narration && PANEL_VISIBLE_STATES.has(machineState)) {
      const u = new SpeechSynthesisUtterance(currentStep.narration || currentStep.description);
      u.rate = playbackSpeed; u.pitch = 1; u.volume = 0.8;
      const t = setTimeout(() => window.speechSynthesis.speak(u), 50);
      return () => { clearTimeout(t); window.speechSynthesis.cancel(); };
    }
  }, [currentStepIndex, voiceEnabled, currentStep, machineState, playbackSpeed]);

  // Auto-fit on doubt visuals
  useEffect(() => {
    if (doubtResponse?.hasVisuals && canvasRef.current) {
      const t = setTimeout(() => canvasRef.current.fitToContent?.(), 300);
      return () => clearTimeout(t);
    }
  }, [doubtResponse]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, handleClose]);

  // Level-up toast
  useEffect(() => {
    if (levelUpEvent) {
      showToast({ message: levelUpEvent.message, type: 'success', duration: 4000 });
      const t = setTimeout(() => setLevelUpEvent(null), 4000);
      return () => clearTimeout(t);
    }
  }, [levelUpEvent, showToast, setLevelUpEvent]);

  // Time
  const { formatted, formatTime } = useElapsedTime(isPlaying, machineState === STATES.GENERATING);
  const totalFormatted = formatTime(totalSteps * 8);

  // Canvas callbacks
  const handleViewport = useCallback((t) => setCanvasTransform(t), [setCanvasTransform]);
  const handleZoom = useCallback((s) => setCanvasTransform(p => p.scale === s ? p : { ...p, scale: s }), [setCanvasTransform]);

  // ── Bail ──────────────────────────────────────────────────
  if (!isOpen) return null;

  const domain = timeline?.domain?.toLowerCase() || 'general';
  const ds = DOMAIN_STYLES[domain] || DOMAIN_STYLES.general;
  const isGenerating = machineState === STATES.GENERATING;
  const isAlgo = isDSAContent(timeline);
  const isD3 = (timeline?.renderer || '').toLowerCase() === 'd3';
  const useAlgoPanel = isAlgo || isD3;

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
          <Maximize2 size={13} className="opacity-60" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="teaching-session">

      {/* ── Generating ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div
            key="gen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'var(--bg-primary)' }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-14 h-14">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--text-primary)' }} />
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-3 rounded-full" style={{ border: '2px solid var(--border-color)', borderBottomColor: 'var(--text-secondary)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--text-secondary)' }} className="text-xs mb-1">Building lesson</p>
                <p style={{ color: 'var(--text-tertiary)' }} className="text-[10px] truncate max-w-[200px]">"{topic}"</p>
              </div>
              <div className="w-32 h-px overflow-hidden" style={{ background: 'var(--border-color)' }}>
                <motion.div animate={{ x: [-128, 128] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-full" style={{ background: 'linear-gradient(90deg, transparent, var(--text-tertiary), transparent)' }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body ─────────────────────────────────────────── */}
      {isTeaching && (
        <div className="teaching-body">
          {/* Canvas */}
          <div className="teaching-canvas-area">
            {/* ── Floating Canvas Header (Replaces Navbar) ── */}
            <div className="absolute top-4 left-4 right-4 z-[50] flex justify-start pointer-events-none">

              {/* Unified Toolbar Pill */}
              <div
                className="flex items-center gap-3 pointer-events-auto px-3 py-2 rounded-full shadow-md max-w-full"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: 'var(--glass-shadow)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                {/* Left: Title & Menu */}
                <div className="flex items-center gap-3 shrink-0">
                  <Btn onClick={openFloatingSidebar} title="Menu" className="border-none shadow-none rounded-full"><Menu size={16} /></Btn>
                  <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />
                  <span style={{ color: 'var(--text-primary)' }} className="text-[14px] font-sans font-medium tracking-wide truncate max-w-[200px] md:max-w-[400px]">
                    {formatTopicTitle(timeline?.title || topic)}
                  </span>
                </div>

                <div className="w-px h-5 bg-[var(--border-color)] opacity-50 shrink-0" />

                {/* Right: Tools */}
                <div className="flex items-center gap-1 shrink-0">
                  <span style={{ color: 'var(--text-tertiary)' }} className="hidden md:block px-2 text-[12px] font-mono font-medium">
                    {currentStepIndex + 1}/{canvasSteps.length || 1}
                  </span>
                  <Btn onClick={toggleVoice} active={voiceEnabled} className="hidden sm:flex rounded-full border-none shadow-none">
                    {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </Btn>
                  <Btn onClick={() => setPanelOpen(!panelOpen)} title={panelOpen ? 'Hide panel' : 'Show panel'} className="rounded-full border-none shadow-none">
                    {panelOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
                  </Btn>
                  <Btn onClick={() => setIsMinimized(true)} title="Minimize" className="rounded-full border-none shadow-none"><Minimize2 size={14} /></Btn>
                  <Btn onClick={handleClose} danger title="Close" className="rounded-full border-none shadow-none"><X size={14} /></Btn>
                </div>
              </div>
            </div>

            {/* ── Bottom Floating Controls Stack ── */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center gap-3 w-full max-w-[90%] md:max-w-4xl px-5 pointer-events-none">

              {/* 1. Narration Subtitle (Top of Stack) */}
              {(!isAlgo || isD3) && (
                <div className="w-full flex justify-center pointer-events-auto">
                  <NarrationBar text={currentStep?.narration || currentStep?.explanation} isGenerating={isGenerating} />
                </div>
              )}

              {/* 2 & 3. Playback Bar & Doubt Panel (Side by Side on Desktop) */}
              <div className="flex flex-col xl:flex-row items-center xl:items-end justify-center gap-3 w-full">

                {/* Floating Playback Bar */}
                <AnimatePresence>
                  {isTeaching && (
                    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                      className="flex items-center justify-center gap-4 px-5 py-2.5 rounded-full pointer-events-auto shadow-2xl shrink-0"
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                      }}>
                      <div className="flex items-center gap-2">
                        <Btn onClick={prevStep} disabled={currentStepIndex <= 0} className="w-8 h-8 rounded-full border-none shadow-none bg-[var(--bg-tertiary)] bg-opacity-50"><SkipBack size={14} /></Btn>
                        <button onClick={isPlaying ? pause : play}
                          style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                          className="w-10 h-10 flex items-center justify-center rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all">
                          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <Btn onClick={nextStep} className="w-8 h-8 rounded-full border-none shadow-none bg-[var(--bg-tertiary)] bg-opacity-50"><SkipForward size={14} /></Btn>
                      </div>

                      <div className="h-6 w-px shrink-0 opacity-50" style={{ background: 'var(--border-color)' }} />

                      {/* Scrubber */}
                      <div className="flex flex-col gap-0.5 w-[160px]">
                        <div className="flex justify-between px-0.5">
                          <span style={{ color: 'var(--text-tertiary)' }} className="text-[10px] font-mono tracking-wide">{formatted}/{totalFormatted}</span>
                          <span style={{ color: 'var(--text-secondary)' }} className="text-[10px] font-medium tracking-wide">Step {currentStepIndex + 1}</span>
                        </div>
                        <input type="range" min="0" max={totalSteps - 1} step="1" value={currentStepIndex}
                          onChange={(e) => goToStep(parseInt(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: 'var(--bg-tertiary)', accentColor: 'var(--text-primary)' }} />
                      </div>

                      <div className="h-6 w-px shrink-0 hidden sm:block opacity-50" style={{ background: 'var(--border-color)' }} />

                      {/* Speed */}
                      <div className="hidden sm:flex items-center rounded-full p-0.5 gap-0.5 bg-[var(--bg-tertiary)] bg-opacity-50 border border-[var(--border-color)]">
                        {[1, 1.5, 2].map(s => (
                          <button key={s} onClick={() => handleSpeed(s)}
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                            style={playbackSpeed === s
                              ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' }
                              : { color: 'var(--text-tertiary)' }}>
                            {s}×
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <InfiniteCanvas ref={canvasRef} onViewportChange={handleViewport} onZoomChange={handleZoom}>
              <AgentCanvasRenderer
                timeline={timeline} objects={canvasObjects || []} steps={canvasSteps}
                currentStepIndex={currentStepIndex} onGoToStep={goToStep}
                doubtHistory={doubtHistory} isDoubtProcessing={isDoubtProcessing}
                activeDoubtId={machine.activeDoubtId} onJumpToDoubt={machine.jumpToDoubt}
                onPinDoubt={machine.pinDoubtToCanvas} onResume={resume} onAskDoubt={askDoubt}
                hideAlgoPanel={true}
              />
            </InfiniteCanvas>

            {/* Expand Panel Handle (Appears when panel is closed) */}
            <AnimatePresence>
              {!panelOpen && (
                <motion.button
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  onClick={() => setPanelOpen(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-[45] flex items-center justify-center w-6 h-16 pointer-events-auto shadow-md transition-colors"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRight: 'none',
                    backdropFilter: 'blur(8px)',
                    borderTopLeftRadius: '12px',
                    borderBottomLeftRadius: '12px',
                  }}
                  title="Open Session Guide"
                >
                  <ChevronLeft size={16} className="opacity-70 hover:opacity-100" style={{ color: 'var(--text-primary)' }} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel */}
          <div
            className={`teaching-right-panel ${panelOpen ? '' : 'collapsed'}`}
            style={{
              width: panelOpen ? (panelWide ? 420 : 320) : 0,
              marginTop: '84px',
              marginBottom: '84px',
              marginRight: panelOpen ? '16px' : '0px',
              borderRadius: panelOpen ? '16px' : '0px',
              border: panelOpen ? '1px solid var(--border-color)' : 'none',
              boxShadow: panelOpen ? 'var(--glass-shadow)' : 'none',
              height: 'calc(100% - 168px)',
              overflow: 'hidden', // Forces children to scroll
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header (Sticky) */}
            {panelOpen && (
              <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Session Guide
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPanelWide(!panelWide)} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-tertiary)' }} title={panelWide ? "Shrink" : "Expand"}>
                    {panelWide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  <button onClick={() => setPanelOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[#ff5f56]/20 hover:text-[#ff5f56]" style={{ color: 'var(--text-tertiary)' }} title="Close">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Content Wrapper */}
            <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
              {useAlgoPanel ? (
                <AlgoRightPanel
                  step={{ ...canvasSteps[currentStepIndex], narration: currentStep?.narration || canvasSteps[currentStepIndex]?.narration }}
                  stepIndex={currentStepIndex} totalSteps={timeline?.steps?.length || 0}
                  variables={canvasSteps[currentStepIndex]?.variables}
                  activeStates={canvasSteps[currentStepIndex]?.activeStates}
                  algorithmName={timeline?.title} timeline={timeline} onGoToStep={goToStep}
                  doubtHistory={doubtHistory} isDoubtProcessing={isDoubtProcessing}
                  activeDoubtId={machine.activeDoubtId} onJumpToDoubt={machine.jumpToDoubt}
                  onPinDoubt={machine.pinDoubtToCanvas} onResume={resume} onAskDoubt={askDoubt}
                />
              ) : (
                <>
                  <div className="teaching-panel-section shrink-0">
                    <StepPanel currentStep={currentStep} currentStepIndex={currentStepIndex}
                      totalSteps={totalSteps} learningNodes={learningNodes}
                      memoryAnchor={memoryAnchor} keyFormula={keyFormula} />
                  </div>
                  {currentStep?.interactiveControls && (
                    <div className="teaching-panel-section shrink-0">
                      <InteractiveControlPanel data={currentStep.interactiveControls} />
                    </div>
                  )}
                  {doubtHistory.length > 0 && (
                    <div className="teaching-panel-section shrink-0"><DoubtThread /></div>
                  )}
                </>
              )}
            </div>

            {/* Sticky Doubt Input for Standard Sessions */}
            {!useAlgoPanel && (
              <DoubtInputBar onAskDoubt={askDoubt} isProcessing={isDoubtProcessing} />
            )}

          </div>
        </div>
      )}

      {/* Removed old timeline since it's now a floating pill in the canvas area */}

      <FloatingSidebar />
    </div>
  );
};

/* ── Tiny helpers ─────────────────────────────────────────── */

function Btn({ onClick, children, disabled, active, danger, className = '', title }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-20 active:scale-95 ${className}`}
      style={{
        border: '1px solid var(--border-color)',
        color: danger ? 'var(--text-tertiary)' : active ? 'var(--bg-primary)' : 'var(--text-tertiary)',
        background: active ? 'var(--text-primary)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = danger ? '#ef4444' : 'var(--text-primary)';
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          if (danger) e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }
      }}>
      {children}
    </button>
  );
}

function Dot({ ok }) {
  return (
    <span className="flex items-center gap-1 text-[9px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {ok ? 'Live' : 'Offline'}
    </span>
  );
}

// ── Inline Doubt Input Bar ──────────────────────────────────────────────
const DoubtInputBar = ({ onAskDoubt, isProcessing }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;
    onAskDoubt(input.trim());
    setInput('');
  };

  return (
    <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a doubt about this step..."
          disabled={isProcessing}
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none transition-all shadow-sm"
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', '::placeholder': { color: 'var(--text-tertiary)' },
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="w-8 h-8 flex shrink-0 items-center justify-center rounded-xl disabled:opacity-30 transition-all active:scale-95 shadow-sm"
          style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
        >
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
        </button>
      </form>
    </div>
  );
};

export default TeachingSession;