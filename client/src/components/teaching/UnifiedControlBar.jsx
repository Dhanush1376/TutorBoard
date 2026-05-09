import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward,
  Gauge, MessageSquare, ChevronUp, ChevronDown,
  Keyboard, ChevronRight, Send
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
        gap: 10,
        padding: '8px 16px',
        borderRadius: 24,
        maxWidth: isDoubtExpanded ? 640 : 480,
        transition: 'max-width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 32px -4px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Transport Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
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
            width: 38,
            height: 38,
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
                <Pause size={15} fill="currentColor" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse ring when playing */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                style={{
                  position: 'absolute',
                  inset: -1,
                  borderRadius: '50%',
                  border: '1.5px solid var(--text-primary)',
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
          size={13}
          fill
          title="Next Step"
        />
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', opacity: 0.6, flexShrink: 0 }} />

      {/* ── Step Progress ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 auto', minWidth: 80 }}>
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
            max={Math.max(totalSteps - 1, 0)}
            step={1}
            value={currentStepIndex}
            onChange={(e) => onGoToStep?.(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: 3,
              appearance: 'none',
              background: 'var(--bg-tertiary)',
              borderRadius: 2,
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
            top: 'calc(50% - 1.5px)',
            height: 3,
            background: 'var(--text-primary)',
            width: `${progress}%`,
            pointerEvents: 'none',
            zIndex: 1,
            borderRadius: 2,
            transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>

        {/* Step counter */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9.5,
            color: 'var(--text-tertiary)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}>
            {currentStepIndex + 1} <span style={{ opacity: 0.5 }}>/</span> {totalSteps}
          </span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', opacity: 0.6, flexShrink: 0 }} />

      {/* ── Speed Control ── */}
      <div style={{ position: 'relative' }} ref={speedMenuRef}>
        <ControlButton
          icon={Gauge}
          onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
          label={SPEED_LABELS[currentSpeed]}
          keyHint={showKeyHints ? 'S' : null}
          size={12}
          title="Playback Speed"
          extra={<ChevronUp size={9} style={{ opacity: 0.4, marginLeft: -2, transform: isSpeedMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
        />
        <AnimatePresence>
          {isSpeedMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="liquid-glass"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 10,
                borderRadius: 14,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 100,
                minWidth: 80,
                boxShadow: '0 12px 40px -8px rgba(0,0,0,0.2)',
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

      {/* ── Doubt Input ── */}
      {showDoubtInput && (
        <AnimatePresence mode="wait">
          {isDoubtExpanded ? (
            <motion.div
              key="doubt-input"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', flexShrink: 0, position: 'relative' }}
            >
              <input
                ref={doubtInputRef}
                value={doubtText}
                onChange={(e) => setDoubtText(e.target.value)}
                onKeyDown={handleDoubtKeyDown}
                onBlur={() => { if (!doubtText) setIsDoubtExpanded(false); }}
                placeholder="Ask a doubt..."
                style={{
                  width: '100%',
                  padding: '7px 36px 7px 14px',
                  borderRadius: 18,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                className="placeholder:text-[var(--text-tertiary)] focus:border-[var(--text-tertiary)]"
              />
              {doubtText.trim() && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={handleDoubtSubmit}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Send size={10} />
                </motion.button>
              )}
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
    whileHover={disabled ? {} : { scale: 1.08 }}
    whileTap={disabled ? {} : { scale: 0.92 }}
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: label ? '5px 10px' : 7,
      borderRadius: label ? 10 : 8,
      background: isActive ? 'rgba(var(--bg-primary-rgb), 0.15)' : 'transparent',
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
      opacity: disabled ? 0.25 : 0.75,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 150ms ease, opacity 150ms ease',
    }}
  >
    <Icon size={size} fill={fill ? 'currentColor' : 'none'} />
    {label && (
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
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
