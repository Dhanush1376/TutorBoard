'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { formatShortAction, DEFAULT_AGENT_STEPS } from './message/MessageUtils';
import './ThoughtLine.css';

const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const GLYPH_DONE = 0.55;
const EMPTY_STEPS = [];

const fmt = ds => (ds < 600 ? `${(ds / 10).toFixed(1)}s` : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`);
const spoken = ds =>
  ds < 600
    ? `${(ds / 10).toFixed(1)} seconds`
    : `${Math.floor(ds / 600)} minutes ${((ds % 600) / 10).toFixed(1)} seconds`;

// High-fidelity 3x3 dot matrix glyph (avoids sparkle per strict user request)
const MatrixGlyph = () => (
  <svg
    viewBox="0 0 16 16"
    width="1em"
    height="1em"
    fill="currentColor"
    aria-hidden="true"
    className="thought-line__matrix-svg"
  >
    <circle cx="3" cy="3" r="1.35" />
    <circle cx="8" cy="3" r="1.35" />
    <circle cx="13" cy="3" r="1.35" />
    <circle cx="3" cy="8" r="1.35" />
    <circle cx="8" cy="8" r="1.35" opacity="0.65" />
    <circle cx="13" cy="8" r="1.35" opacity="0.45" />
    <circle cx="3" cy="13" r="1.35" opacity="0.45" />
    <circle cx="8" cy="13" r="1.35" opacity="0.3" />
    <circle cx="13" cy="13" r="1.35" opacity="0.2" />
  </svg>
);

export default function ThoughtLine({
  label = 'Thinking…',
  doneLabel = '',
  renderLabel,
  glyph = 'matrix',
  steps = EMPTY_STEPS,
  collapsible = true,
  collapseOnSettle = true,
  color = 'currentColor',
  glyphColor = '',
  fontSize = 14,
  breathPeriod = 1.6,
  breathDepth = 0.45,
  shimmer = true,
  shimmerDuration = 1.8,
  settleDuration = 350,
  settleBlur = 2,
  working = true,
  settleAfter = 0,
  elapsed,
  showTimer = true,
  onSettle,
  className = '',
  style
}) {
  const reduce = useReducedMotion();
  const [autoSettled, setAutoSettled] = useState(false);
  const [open, setOpen] = useState(true);
  const isWorking = working && !autoSettled;
  const doneText = doneLabel || (showTimer ? 'Thought for' : 'Done thinking');
  const hasTrace = steps.length > 0;
  const depth = reduce ? Math.min(breathDepth, 0.2) : breathDepth;
  const period = reduce ? breathPeriod * 1.5 : breathPeriod;
  const trough = 1 - depth;
  const sheen = shimmer && !reduce;

  const glyphRef = useRef(null);
  const breathRef = useRef(null);
  const timerRef = useRef(null);
  const stackRef = useRef(null);
  const workRef = useRef(null);
  const doneRef = useRef(null);
  const dsRef = useRef(0);
  const prevWorking = useRef(isWorking);
  const latest = useRef({});
  useEffect(() => {
    latest.current = { onSettle };
  });
  const [announce, setAnnounce] = useState(label);

  useEffect(() => {
    if (working) setAutoSettled(false);
  }, [working]);

  useEffect(() => {
    if (isWorking) setOpen(true);
    else if (collapseOnSettle) setOpen(false);
  }, [isWorking, collapseOnSettle]);

  useEffect(() => {
    const glyphEl = glyphRef.current;
    const breathEl = breathRef.current;
    if (!breathEl) return undefined;
    const s = settleDuration / 1000;
    const loop = (el, delay) =>
      animate(el, { opacity: [trough, 1, trough] }, { duration: period, ease: EASE_IN_OUT, repeat: Infinity, delay });
    let cancelled = false;
    const running = [];
    if (isWorking) {
      if (depth > 0) {
        if (sheen) running.push(animate(breathEl, { opacity: 1 }, { duration: 0.2, ease: EASE_OUT }));
        if (glyphEl) {
          const lead = animate(glyphEl, { opacity: trough }, { duration: 0.2, ease: EASE_OUT });
          running.push(lead);
          lead.then(() => {
            if (cancelled) return;
            running.push(loop(glyphEl, 0));
            if (!sheen) running.push(loop(breathEl, 0.14));
          });
        } else if (!sheen) {
          running.push(loop(breathEl, 0.14));
        }
      } else {
        if (glyphEl) running.push(animate(glyphEl, { opacity: 1 }, { duration: 0.2, ease: EASE_OUT }));
        running.push(animate(breathEl, { opacity: 1 }, { duration: 0.2, ease: EASE_OUT }));
      }
    } else {
      if (glyphEl) running.push(animate(glyphEl, { opacity: GLYPH_DONE }, { duration: s, ease: EASE_OUT }));
      running.push(animate(breathEl, { opacity: 1 }, { duration: s, ease: EASE_OUT }));
    }
    return () => {
      cancelled = true;
      running.forEach(a => a.stop());
    };
  }, [isWorking, period, depth, trough, settleDuration, glyph, sheen]);

  const paint = ds => {
    dsRef.current = ds;
    if (timerRef.current) timerRef.current.textContent = fmt(ds);
  };

  useLayoutEffect(() => {
    if (elapsed != null) {
      paint(Math.round(elapsed * 10));
      return undefined;
    }
    if (!isWorking) return undefined;
    const startedAt = performance.now();
    paint(0);
    const id = setInterval(() => {
      const ds = Math.floor((performance.now() - startedAt) / 100);
      paint(ds);
      if (settleAfter > 0 && ds >= Math.round(settleAfter * 10)) setAutoSettled(true);
    }, 100);
    return () => clearInterval(id);
  }, [isWorking, elapsed, settleAfter]);

  // Progressive agent step tracking while working
  const [currentTick, setCurrentTick] = useState(0);

  useEffect(() => {
    if (!isWorking) return undefined;
    const interval = setInterval(() => {
      setCurrentTick(t => t + 1);
    }, 200);
    return () => clearInterval(interval);
  }, [isWorking]);

  // Process steps: strictly 1-2 words, with enough steps for continuous animation
  const allSteps = React.useMemo(() => {
    let list = steps && Array.isArray(steps) && steps.length > 0 ? steps : DEFAULT_AGENT_STEPS;
    list = list.map(formatShortAction);
    if (list.length < 9) {
      const needed = DEFAULT_AGENT_STEPS.filter(s => !list.includes(s));
      list = [...list, ...needed];
    }
    return list;
  }, [steps]);

  const STEP_INTERVAL = 1.4; // seconds per sequential step action
  const BATCH_SIZE = 3;       // strictly 3 actions visible at any time

  const globalActiveIndex = React.useMemo(() => {
    if (!isWorking) return allSteps.length;
    if (allSteps.length <= 1) return 0;
    const s = currentTick * 0.2;
    return Math.min(Math.floor(s / STEP_INTERVAL), allSteps.length - 1);
  }, [isWorking, allSteps.length, currentTick]);

  // Real-time dynamic header label:
  // If parent passed an informative context-specific action (e.g. 'Writing code…', 'Solving formulas…', 'Searching web…', 'Designing canvas…'), use it.
  // Otherwise, synchronize with the active stage from allSteps ('Analyzing problem…' -> 'Planning approach…' -> 'Designing visual…' -> etc.)
  const currentHeaderLabel = React.useMemo(() => {
    if (label && label !== 'Thinking…' && label !== 'Writing…') {
      return label;
    }
    const step = allSteps[globalActiveIndex];
    if (step) {
      return `${step}…`;
    }
    return label || 'Analyzing problem…';
  }, [label, allSteps, globalActiveIndex]);

  useLayoutEffect(() => {
    const t = timerRef.current;
    const stack = stackRef.current;
    if (!t || !stack) return undefined;
    const place = glide => {
      const active = isWorking ? workRef.current : doneRef.current;
      if (!active) return;
      const shift = active.offsetWidth - stack.offsetWidth;
      if (!glide) t.style.transition = 'none';
      t.style.transform = `translateX(${shift}px)`;
      if (!glide) {
        void t.offsetWidth;
        t.style.transition = '';
      }
    };
    place(prevWorking.current !== isWorking);
    prevWorking.current = isWorking;
    const ro = new ResizeObserver(() => place(false));
    if (workRef.current) ro.observe(workRef.current);
    if (doneRef.current) ro.observe(doneRef.current);
    return () => ro.disconnect();
  }, [isWorking, currentHeaderLabel, doneText, fontSize, showTimer]);

  useEffect(() => {
    if (isWorking) {
      setAnnounce(currentHeaderLabel);
      return;
    }
    setAnnounce(showTimer ? `${doneText} ${spoken(dsRef.current)}` : doneText);
    latest.current.onSettle?.(dsRef.current / 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorking, currentHeaderLabel]);

  const toggle = hasTrace && collapsible;

  // Strict avoidance of sparkle: sparkle is redirected to MatrixGlyph or dot
  const renderGlyphElement = () => {
    if (glyph === 'none') return null;
    if (glyph === 'matrix' || glyph === 'sparkle') {
      return <MatrixGlyph />;
    }
    if (glyph === 'dot') {
      return <span className="thought-line__dot" />;
    }
    if (React.isValidElement(glyph)) {
      return glyph;
    }
    return <MatrixGlyph />;
  };

  const head = (
    <>
      {glyph !== 'none' ? (
        <span ref={glyphRef} className="thought-line__glyph" aria-hidden="true">
          {renderGlyphElement()}
        </span>
      ) : null}
      <span ref={stackRef} className="thought-line__label" aria-hidden="true">
        <span ref={workRef} className="thought-line__text" data-active={isWorking ? '' : undefined}>
          <span ref={breathRef} className="thought-line__breath" data-shimmer={sheen ? '' : undefined}>
            <AnimatePresence mode="wait">
              <motion.span
                key={currentHeaderLabel}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'inline-block' }}
              >
                {renderLabel ? renderLabel(currentHeaderLabel, true) : currentHeaderLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
        <span
          ref={doneRef}
          className="thought-line__text thought-line__text--done"
          data-active={isWorking ? undefined : ''}
        >
          {renderLabel ? renderLabel(doneText, false) : doneText}
        </span>
      </span>
      {showTimer ? (
        <span ref={timerRef} className="thought-line__timer" data-done={isWorking ? undefined : ''} aria-hidden="true">
          0.0s
        </span>
      ) : null}
      {collapsible ? (
        <span className="thought-line__chevron" data-on={hasTrace ? '' : undefined} aria-hidden="true">
          <ChevronDown size="1em" strokeWidth={2.2} />
        </span>
      ) : null}
      <span className="thought-line__sr" role="status">
        {announce}
      </span>
    </>
  );

  const totalBatches = Math.ceil(allSteps.length / BATCH_SIZE);
  const currentBatchIndex = Math.min(
    Math.floor(globalActiveIndex / BATCH_SIZE),
    Math.max(0, totalBatches - 1)
  );

  const batchItems = React.useMemo(() => {
    const start = currentBatchIndex * BATCH_SIZE;
    const slice = allSteps.slice(start, start + BATCH_SIZE);
    return slice.map((text, localIdx) => {
      const globalIdx = start + localIdx;
      const isDone = !isWorking || globalIdx < globalActiveIndex;
      const isActive = isWorking && globalIdx === globalActiveIndex;
      const isPending = isWorking && globalIdx > globalActiveIndex;
      return { text, globalIdx, isDone, isActive, isPending };
    });
  }, [allSteps, currentBatchIndex, globalActiveIndex, isWorking]);

  return (
    <div
      className={`thought-line${className ? ` ${className}` : ''}`}
      data-working={isWorking ? '' : undefined}
      data-open={open && hasTrace ? '' : undefined}
      style={{
        '--tl-font': `${fontSize}px`,
        '--tl-color': color,
        '--tl-glyph': glyphColor || color,
        '--tl-settle': `${settleDuration}ms`,
        '--tl-blur': `${settleBlur}px`,
        '--tl-shimmer': `${shimmerDuration}s`,
        ...style
      }}
    >
      {collapsible ? (
        <button
          type="button"
          className="thought-line__head"
          data-toggle={toggle ? '' : undefined}
          aria-expanded={toggle ? open : undefined}
          tabIndex={toggle ? 0 : -1}
          onClick={() => {
            if (toggle) setOpen(v => !v);
          }}
        >
          {head}
        </button>
      ) : (
        <div className="thought-line__head">{head}</div>
      )}
      {hasTrace ? (
        <div className="thought-line__trace" data-open={open ? '' : undefined} aria-hidden={!open}>
          <div className="thought-line__fold">
            <AnimatePresence mode="wait">
              <motion.div
                key={`batch-${currentBatchIndex}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="thought-line__steps"
              >
                {batchItems.map(({ text, globalIdx, isDone, isActive }) => (
                  <div 
                    key={`${globalIdx}-${text}`} 
                    className={`thought-line__step flex items-center justify-between gap-2.5 transition-all duration-200 ${
                      isActive ? 'thought-line__step--active' : ''
                    }`} 
                    data-done={isDone ? '' : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="thought-line__mark flex items-center justify-center shrink-0 w-4 h-4" aria-hidden="true">
                        {isDone ? (
                          <Check size={13} strokeWidth={2.4} className="text-emerald-500 dark:text-emerald-400" />
                        ) : isActive ? (
                          <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ea580c]/15 dark:bg-[#ea580c]/20">
                            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#ea580c] opacity-60" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ea580c]" />
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 opacity-60 ml-1" />
                        )}
                      </span>
                      <span 
                        className={`thought-line__step-text truncate text-[12.5px] transition-colors ${
                          isDone 
                            ? 'text-zinc-500 dark:text-zinc-400' 
                            : isActive 
                              ? 'text-zinc-900 dark:text-zinc-100 font-semibold' 
                              : 'text-zinc-400 dark:text-zinc-600'
                        }`}
                        title={text}
                      >
                        {text}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : null}
    </div>
  );
}
