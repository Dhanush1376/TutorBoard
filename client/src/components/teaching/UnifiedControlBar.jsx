import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward,
  Gauge, MessageSquare, ChevronUp, ChevronDown,
  Keyboard, ChevronRight, Send, Volume2, VolumeX, X
} from 'lucide-react';


/**
 * UnifiedControlBar v2.0 — Premium Cinematic Playback Surface
 *
 * Refined glass morphism, premium micro-animations, and
 * a polished transport + interaction surface.
 */

// ── Speed Presets ────────────────────────────────────────────────────────────
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_LABELS = { 0.5: '0.5×', 0.75: '0.75×', 1: '1×', 1.25: '1.25×', 1.5: '1.5×', 2: '2×' };

// ── Main Component ──────────────────────────────────────────────────────────

const UnifiedControlBar = ({
  currentStepIndex = 0,
  totalSteps = 0,
  isPlaying = false,
  onPlay,
  onPause,
  onPrevStep,
  onNextStep,
  onGoToStep,
  onSpeedChange,
  onAskDoubt,
  isVoiceEnabled = true,
  onToggleVoice,
  elapsedTime = '0:00',
  totalTime = '0:00',
  elapsedSeconds = 0,
  totalDurationSeconds = 0,
  playbackSpeed = 1,
  showDoubtInput = true,
  className = '',
  isDoubtExpanded: externalIsDoubtExpanded,
  onDoubtExpandedChange,
}) => {
  const [internalIsDoubtExpanded, setInternalIsDoubtExpanded] = useState(false);
  const isDoubtExpanded = externalIsDoubtExpanded !== undefined ? externalIsDoubtExpanded : internalIsDoubtExpanded;
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setIsDoubtExpanded = useCallback((val) => {
    setInternalIsDoubtExpanded((prev) => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      onDoubtExpandedChange?.(nextVal);
      return nextVal;
    });
  }, [onDoubtExpandedChange]);

  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [doubtText, setDoubtText] = useState('');
  const [showKeyHints, setShowKeyHints] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(null);
  const doubtInputRef = useRef(null);
  const speedMenuRef = useRef(null);
  const doubtContainerRef = useRef(null);

  const currentSpeed = playbackSpeed;
  const maxStep = Math.max(totalSteps - 1, 1);
  const stepPercent = totalSteps > 1 ? (currentStepIndex / maxStep) * 100 : 0;

  // Continuous progress calculation based on elapsed seconds vs total duration
  let calculatedPercent = stepPercent;
  if (totalDurationSeconds > 0) {
    calculatedPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100));
  }
  const progressPercent = isDragging && dragPercent !== null ? dragPercent : calculatedPercent;

  // ── Speed Cycling ──────────────────────────────────────────────────────
  const handleSpeedSelect = useCallback((speed) => {
    onSpeedChange?.(speed);
    setIsSpeedMenuOpen(false);
  }, [onSpeedChange]);

  // ── Doubt Submission & Close ───────────────────────────────────────────
  const handleCloseDoubt = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDoubtText('');
    setInternalIsDoubtExpanded(false);
    onDoubtExpandedChange?.(false);
  }, [onDoubtExpandedChange]);

  const handleDoubtSubmit = useCallback(() => {
    if (!doubtText.trim()) return;
    onAskDoubt?.(doubtText.trim());
    handleCloseDoubt();
  }, [doubtText, onAskDoubt, handleCloseDoubt]);

  const handleDoubtKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDoubtSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCloseDoubt(e);
    }
  }, [handleDoubtSubmit, handleCloseDoubt]);

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = ['INPUT', 'TEXTAREA'].includes(activeTag) || document.activeElement?.isContentEditable;
      if (isInput) return;

      if (e.key === '?' && !isDoubtExpanded) {
        e.preventDefault();
        setShowKeyHints(prev => !prev);
      }
      if ((e.key === 'd' || e.key === 'D') && !isDoubtExpanded && showDoubtInput) {
        e.preventDefault();
        setIsDoubtExpanded(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDoubtExpanded, showDoubtInput]);

  // Support external trigger (e.g. clicking canvas element) to populate doubt input without auto-submitting
  useEffect(() => {
    const handleSetDoubt = (e) => {
      const text = typeof e.detail === 'string' ? e.detail : e.detail?.text;
      if (text) {
        setDoubtText(text);
        setIsDoubtExpanded(true);
        setTimeout(() => {
          if (doubtInputRef.current) {
            doubtInputRef.current.focus();
            doubtInputRef.current.selectionStart = doubtInputRef.current.selectionEnd = doubtInputRef.current.value.length;
          }
        }, 60);
      }
    };
    window.addEventListener('set-doubt-input', handleSetDoubt);
    return () => window.removeEventListener('set-doubt-input', handleSetDoubt);
  }, []);

  useEffect(() => {
    if (isDoubtExpanded) {
      const timer = setTimeout(() => {
        doubtInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDoubtExpanded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target)) {
        setIsSpeedMenuOpen(false);
      }
      if (isDoubtExpanded && doubtContainerRef.current && !doubtContainerRef.current.contains(e.target)) {
        if (!doubtText.trim()) {
          setIsDoubtExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSpeedMenuOpen, isDoubtExpanded, doubtText]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`unified-control-bar ${className} rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)]/90 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-18px_rgba(0,0,0,0.4)] backdrop-blur-xl`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 5 : 7,
        padding: isMobile ? '6px 10px' : '6px 12px',
        borderRadius: 9999,
        maxWidth: isDoubtExpanded ? 'min(calc(100vw - 24px), 860px)' : (isMobile ? 'calc(100vw - 24px)' : 600),
        width: 'max-content',
        transition: 'max-width 380ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Transport Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <ControlButton
          icon={SkipBack}
          onClick={onPrevStep}
          disabled={currentStepIndex <= 0}
          keyHint={showKeyHints ? '←' : null}
          size={13}
          fill
          title="Previous Step"
        />

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
          onClick={isPlaying ? onPause : onPlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          style={{
            position: 'relative',
            width: isMobile ? 32 : 38,
            height: isMobile ? 32 : 38,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            transition: 'box-shadow 200ms ease',
          }}
        >
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Pause size={isMobile ? 13 : 15} fill="currentColor" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Play size={isMobile ? 13 : 15} fill="currentColor" style={{ marginLeft: 2 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <ControlButton
          icon={SkipForward}
          onClick={onNextStep}
          disabled={currentStepIndex >= totalSteps - 1}
          keyHint={showKeyHints ? '→' : null}
          size={isMobile ? 12 : 13}
          fill
          title="Next Step"
        />
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: isMobile ? 16 : 20, background: 'var(--border-color)', opacity: 0.6, flexShrink: 0 }} />

      {/* ── Step Progress ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        flex: isMobile ? '0 1 110px' : '0 0 220px',
        width: isMobile ? 'clamp(80px, 26vw, 130px)' : 220,
        minWidth: isMobile ? 80 : 220,
        maxWidth: 220,
      }}>
        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: 14,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent}
            onPointerDown={() => {
              setIsDragging(true);
            }}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDragPercent(val);
              if (totalSteps > 0) {
                const targetStep = Math.min(totalSteps - 1, Math.max(0, Math.round((val / 100) * (totalSteps - 1))));
                onGoToStep?.(targetStep);
              }
            }}
            onPointerUp={() => {
              setIsDragging(false);
              setDragPercent(null);
            }}
            style={{
              width: '100%',
              height: 4,
              appearance: 'none',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 9999,
              cursor: 'pointer',
              outline: 'none',
              zIndex: 2,
              position: 'relative',
            }}
            className="playback-scrubber"
          />
          {/* Active Fill Layer */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 'calc(50% - 2px)',
            height: 4,
            background: 'var(--text-primary)',
            width: `calc(6px + (100% - 12px) * ${progressPercent / 100})`,
            pointerEvents: 'none',
            zIndex: 1,
            borderRadius: 9999,
            transition: isDragging ? 'none' : 'width 150ms linear',
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.3)',
          }} />
        </div>

        {/* Step & Time counter */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          padding: '0 2px',
          whiteSpace: 'nowrap',
          userSelect: 'none'
        }}>
          <span style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}>
            Step {currentStepIndex + 1} <span style={{ opacity: 0.4 }}>/</span> {totalSteps}
          </span>
          <span style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            opacity: 0.8,
            flexShrink: 0,
          }}>
            {elapsedTime} <span style={{ opacity: 0.4 }}>/</span> {totalTime}
          </span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="w-px h-4 bg-[var(--st-line-strong)] opacity-60 shrink-0" />

      {/* ── Speed Control ── */}
      <div style={{ position: 'relative' }} ref={speedMenuRef}>
        <ControlButton
          icon={Gauge}
          onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
          label={SPEED_LABELS[Number(currentSpeed)] || `${currentSpeed || 1}×`}
          keyHint={showKeyHints ? 'S' : null}
          size={13}
          title="Playback Speed"
          extra={<ChevronUp size={11} className="text-[var(--text-tertiary)] -ml-0.5 shrink-0" style={{ transform: isSpeedMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
        />
        <AnimatePresence>
          {isSpeedMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="sf-glass shadow-premium"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 14,
                borderRadius: 18,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                zIndex: 100,
                minWidth: 90,
              }}
            >
              {SPEEDS.map((s) => (
                <motion.button
                  key={s}
                  whileHover={{ background: currentSpeed === s ? undefined : 'var(--bg-tertiary)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSpeedSelect(s)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 10,
                    background: currentSpeed === s ? 'var(--text-primary)' : 'transparent',
                    color: currentSpeed === s ? 'var(--bg-primary)' : 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'color 0.15s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {SPEED_LABELS[s]}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-px h-4 bg-[var(--st-line-strong)] opacity-60 shrink-0" />

        {/* ── Voice Narration Toggle ── */}
        <ControlButton
          icon={isVoiceEnabled ? Volume2 : VolumeX}
          onClick={onToggleVoice}
          isActive={isVoiceEnabled}
          size={13}
          title={isVoiceEnabled ? "Mute Narration" : "Enable Narration"}
        />

        <div className="w-px h-4 bg-[var(--st-line-strong)] opacity-60 shrink-0" />
      </div>

      {/* ── Doubt Input ── */}
      {showDoubtInput && (
        <AnimatePresence mode="wait">
          {isDoubtExpanded ? (
            <motion.div
              key="doubt-input"
              ref={doubtContainerRef}
              initial={{ width: 0, opacity: 0, scale: 0.96 }}
              animate={{ width: isMobile ? 180 : 260, opacity: 1, scale: 1 }}
              exit={{ width: 0, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 9999,
              }}
            >
              <div
                className="w-full flex items-center gap-2 pl-3 pr-1.5 rounded-full bg-[var(--bg-secondary)]/80 hover:bg-[var(--bg-secondary)] border border-[var(--st-line-strong)] focus-within:border-[var(--text-tertiary)] focus-within:bg-[var(--bg-secondary)] transition-all"
                style={{
                  height: isMobile ? 32 : 36,
                  boxSizing: 'border-box',
                }}
              >
                <MessageSquare size={13} className="text-[var(--text-tertiary)] shrink-0 pointer-events-none" />

                <input
                  ref={doubtInputRef}
                  value={doubtText}
                  onChange={(e) => setDoubtText(e.target.value)}
                  onKeyDown={handleDoubtKeyDown}
                  placeholder="Ask a doubt..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: 0,
                  }}
                  className="placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 select-text"
                />

                {doubtText.trim() ? (
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={handleDoubtSubmit}
                    title="Send doubt (Enter)"
                    className="w-6 h-6 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center shrink-0 cursor-pointer border-0 shadow-sm"
                  >
                    <Send size={11} className="ml-0.5" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    whileHover={{ opacity: 1, scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={handleCloseDoubt}
                    title="Cancel (Esc)"
                    className="w-6 h-6 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 cursor-pointer border-0 transition-colors"
                  >
                    <X size={13} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          ) : (
            <ControlButton
              key="doubt-trigger"
              icon={MessageSquare}
              onClick={() => setIsDoubtExpanded(true)}
              keyHint={showKeyHints ? 'D' : null}
              size={13}
              title="Ask a Doubt"
            />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

// ── Shared Button ────────────────────────────────────────────────────────────

const ControlButton = ({ icon: Icon, onClick, disabled, keyHint, label, size = 14, fill = false, extra, title, isActive }) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.05 }}
    whileTap={disabled ? {} : { scale: 0.95 }}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center justify-center cursor-pointer transition-all ${
      label ? 'px-2.5 h-8 gap-1.5 rounded-full' : 'h-8 w-8 rounded-full'
    } ${
      disabled
        ? 'opacity-30 cursor-not-allowed'
        : isActive
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
    }`}
    style={{
      border: 'none',
    }}
  >
    <Icon size={size} fill={fill ? 'currentColor' : 'none'} className="shrink-0" />
    {label && (
      <span className="text-[11px] font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] leading-none select-none">
        {label}
      </span>
    )}
    {extra}

    {/* Keyboard shortcut hint */}
    <AnimatePresence>
      {keyHint && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            bottom: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 7,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            opacity: 0.5,
          }}
        >
          {keyHint}
        </motion.span>
      )}
    </AnimatePresence>
  </motion.button>
);

export default UnifiedControlBar;
