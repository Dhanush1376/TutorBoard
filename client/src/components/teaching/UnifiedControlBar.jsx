import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward,
  Gauge, MessageSquare, ChevronUp, ChevronDown,
  Keyboard, Volume2, VolumeX, ChevronRight
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * UnifiedControlBar v1.0 — Cinematic Playback + Interaction Surface
 *
 * Merges the old transport bar + doubt input into a single elegant control:
 * - Left:   Transport (prev / play-pause / next)
 * - Center: Step timeline with mini progress indicator
 * - Right:  Speed + doubt input (expands on focus)
 *
 * Glass morphism styling, keyboard shortcut ghost hints,
 * and smooth expand/collapse animations.
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
  showDoubtInput = true,
  className = '',
}) => {
  const [speedIndex, setSpeedIndex] = useState(SPEEDS.indexOf(1));
  const [isDoubtExpanded, setIsDoubtExpanded] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [doubtText, setDoubtText] = useState('');
  const [showKeyHints, setShowKeyHints] = useState(false);
  const doubtInputRef = useRef(null);
  const speedMenuRef = useRef(null);

  const currentSpeed = SPEEDS[speedIndex] || 1;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  // ── Speed Cycling ──────────────────────────────────────────────────────

  const handleSpeedSelect = useCallback((speed) => {
    const index = SPEEDS.indexOf(speed);
    setSpeedIndex(index);
    onSpeedChange?.(speed);
    setIsSpeedMenuOpen(false);
  }, [onSpeedChange]);

  // ── Doubt Submission ───────────────────────────────────────────────────

  const handleDoubtSubmit = useCallback(() => {
    if (!doubtText.trim()) return;
    onAskDoubt?.(doubtText.trim());
    setDoubtText('');
    setIsDoubtExpanded(false);
  }, [doubtText, onAskDoubt]);

  const handleDoubtKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDoubtSubmit();
    }
    if (e.key === 'Escape') {
      setIsDoubtExpanded(false);
      setDoubtText('');
    }
  }, [handleDoubtSubmit]);

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle hints with '?' or Shift+'/'
      if (e.key === '?' && !isDoubtExpanded) {
        e.preventDefault();
        setShowKeyHints(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDoubtExpanded]);

  useEffect(() => {
    if (isDoubtExpanded && doubtInputRef.current) {
      doubtInputRef.current.focus();
    }
  }, [isDoubtExpanded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target)) {
        setIsSpeedMenuOpen(false);
      }
    };
    if (isSpeedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSpeedMenuOpen]);

  // ── Step Dots ──────────────────────────────────────────────────────────

  const stepDots = useMemo(() => {
    if (totalSteps <= 0) return null;

    // Show max 12 dots, compress if more
    const maxDots = Math.min(totalSteps, 12);
    const step = totalSteps <= maxDots ? 1 : totalSteps / maxDots;

    return Array.from({ length: maxDots }, (_, i) => {
      const stepIdx = Math.round(i * step);
      const isCurrent = stepIdx === currentStepIndex;
      const isPast = stepIdx < currentStepIndex;

      return (
        <motion.button
          key={i}
          onClick={() => onGoToStep?.(stepIdx)}
          whileHover={{ scale: 1.4 }}
          whileTap={{ scale: 0.9 }}
          style={{
            width: isCurrent ? 16 : 6,
            height: 6,
            borderRadius: 3,
            background: isCurrent
              ? 'var(--text-primary)'
              : isPast
                ? 'var(--text-secondary)'
                : 'var(--text-tertiary)',
            opacity: isCurrent ? 1 : 0.3,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            padding: 0,
          }}
          title={`Step ${stepIdx + 1}`}
        />
      );
    });
  }, [totalSteps, currentStepIndex, onGoToStep]);

  const { isVoiceEnabled, toggleVoice } = useTutorStore();

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`unified-control-bar ${className} liquid-glass`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 28,
        maxWidth: isDoubtExpanded ? 600 : 420,
        transition: 'max-width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-overlay)',
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      {/* ── Transport Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <ControlButton
          icon={SkipBack}
          onClick={onPrevStep}
          disabled={currentStepIndex <= 0}
          keyHint={showKeyHints ? '←' : null}
          size={14}
          fill
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
          onClick={isPlaying ? onPause : onPlay}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {isPlaying
            ? <Pause size={16} fill="currentColor" />
            : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
          }
          
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: '50%',
                  border: '2px solid var(--text-primary)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>
        </motion.button>

        <ControlButton
          icon={SkipForward}
          onClick={onNextStep}
          disabled={currentStepIndex >= totalSteps - 1}
          keyHint={showKeyHints ? '→' : null}
          size={14}
          fill
        />
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 24, background: 'var(--border-color)', flexShrink: 0 }} />

      {/* ── Step Progress ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
        {/* Step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          {stepDots}
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: 2,
          borderRadius: 1,
          background: 'var(--bg-tertiary)',
          overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%',
              background: 'var(--text-primary)',
              borderRadius: 1,
            }}
          />
        </div>

        {/* Step counter */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
          }}>
            Step {currentStepIndex + 1} / {totalSteps}
          </span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 24, background: 'var(--border-color)', flexShrink: 0 }} />

      {/* ── Speed Control ── */}
      <div style={{ position: 'relative' }} ref={speedMenuRef}>
        <ControlButton
          icon={Gauge}
          onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
          label={SPEED_LABELS[currentSpeed]}
          keyHint={showKeyHints ? 'S' : null}
          size={13}
          extra={<ChevronUp size={10} style={{ opacity: 0.5, marginLeft: -2, transform: isSpeedMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
        />
        <AnimatePresence>
          {isSpeedMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 12,
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: 4,
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                zIndex: 100,
                minWidth: 80,
                backdropFilter: 'blur(16px)',
              }}
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedSelect(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: currentSpeed === s ? 'var(--text-primary)' : 'transparent',
                    color: currentSpeed === s ? 'var(--bg-primary)' : 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (currentSpeed !== s) e.target.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    if (currentSpeed !== s) e.target.style.background = 'transparent';
                  }}
                >
                  {SPEED_LABELS[s]}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>



      {/* ── Volume Toggle ── */}
      <ControlButton
        icon={isVoiceEnabled ? Volume2 : VolumeX}
        onClick={toggleVoice}
        keyHint={showKeyHints ? 'V' : null}
        size={13}
      />

      {/* ── Doubt Input ── */}
      {showDoubtInput && (
        <AnimatePresence mode="wait">
          {isDoubtExpanded ? (
            <motion.div
              key="doubt-input"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <input
                ref={doubtInputRef}
                value={doubtText}
                onChange={(e) => setDoubtText(e.target.value)}
                onKeyDown={handleDoubtKeyDown}
                onBlur={() => { if (!doubtText) setIsDoubtExpanded(false); }}
                placeholder="Ask a doubt..."
                className="transition-all placeholder:text-[var(--text-tertiary)] focus:bg-[var(--bg-tertiary)]"
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  outline: 'none',
                }}
              />
            </motion.div>
          ) : (
            <ControlButton
              key="doubt-trigger"
              icon={MessageSquare}
              onClick={() => setIsDoubtExpanded(true)}
              keyHint={showKeyHints ? 'D' : null}
              size={13}
            />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

// ── Shared Button ────────────────────────────────────────────────────────────

const ControlButton = ({ icon: Icon, onClick, disabled, keyHint, label, size = 14, fill = false, extra }) => (
  <motion.button
    whileHover={{ scale: 1.08, background: 'var(--bg-tertiary)' }}
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    disabled={disabled}
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: label ? '5px 10px' : 8,
      borderRadius: label ? 10 : 8,
      background: 'transparent',
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
      opacity: disabled ? 0.3 : 0.8,
      border: 'none',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all 150ms ease',
    }}
  >
    <Icon size={size} fill={fill ? 'currentColor' : 'none'} />
    {label && (
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
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
            bottom: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
            pointerEvents: 'none',
          }}
        >
          {keyHint}
        </motion.span>
      )}
    </AnimatePresence>
  </motion.button>
);

export default UnifiedControlBar;
