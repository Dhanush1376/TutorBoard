import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

// Below this a segment is too small to hit, so the strip scrolls and shows ‹ › instead
const MIN_SEGMENT = 22;

const clean = (text) => (text || '').replace(/\s+/g, ' ').replace(/\.+$/g, '').trim();

/**
 * StepNavigator — a slim segmented strip that sits just above the playback bar.
 * One segment per step: done steps are filled, the current one is the accent,
 * upcoming ones are a faint line. Click to jump; hover/focus shows the step's
 * title and a one-line summary. The chat explains the lesson, so nothing here
 * is shown unless the learner goes looking. When there are more steps than
 * room (`fill` packs it into a row on narrow screens), it scrolls with ‹ ›.
 */
export function StepNavigator({ steps = [], totalSteps = 0, currentStepIndex = 0, onGoToStep, fill = false }) {
  const [peekIndex, setPeekIndex] = useState(null);
  const [peekX, setPeekX] = useState(0);
  const [scroll, setScroll] = useState({ left: false, right: false });
  const navRef = useRef(null);
  const scrollerRef = useRef(null);

  const items = useMemo(() => {
    const count = Math.max(steps.length, totalSteps || 0);
    return Array.from({ length: count }, (_, i) => {
      const s = steps[i] || {};
      return {
        title: clean(s.title) || `Step ${i + 1}`,
        summary: clean(s.narration || s.explanation || s.description),
      };
    });
  }, [steps, totalSteps]);

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setScroll({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useLayoutEffect(() => {
    syncArrows();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncArrows, items.length]);

  // Keep the current step in view as the lesson plays
  useEffect(() => {
    const el = scrollerRef.current;
    const seg = el?.children[0]?.children[currentStepIndex];
    if (!el || !seg || el.scrollWidth <= el.clientWidth) return;
    const target = seg.offsetLeft - (el.clientWidth - seg.offsetWidth) / 2;
    el.scrollTo?.({ left: Math.max(0, target), behavior: 'smooth' });
  }, [currentStepIndex]);

  const page = (dir) => {
    const el = scrollerRef.current;
    el?.scrollBy?.({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  const peekAt = (i, target) => {
    const nav = navRef.current?.getBoundingClientRect();
    const seg = target.getBoundingClientRect();
    setPeekX(nav ? (seg.left + seg.width / 2 - nav.left) / nav.width : 0.5);
    setPeekIndex(i);
  };

  if (items.length < 2) return null;

  const peek = peekIndex !== null ? items[peekIndex] : null;
  // Anchor the tooltip over the segment; near either end it hugs that edge so it never runs off-screen
  const peekAnchor = peekX < 0.3
    ? { left: 0 }
    : peekX > 0.7
      ? { right: 0 }
      : { left: `${peekX * 100}%`, transform: 'translateX(-50%)' };

  const arrow = 'grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]';

  return (
    <nav
      ref={navRef}
      aria-label="Lesson steps"
      className="relative flex items-center gap-1 rounded-full px-1 py-1"
      style={{ width: fill ? '100%' : `min(calc(100vw - 48px), ${Math.max(200, items.length * 44)}px, 420px)`, maxWidth: 420 }}
      onMouseLeave={() => setPeekIndex(null)}
    >
      {(scroll.left || scroll.right) && (
        <button type="button" aria-label="Earlier steps" onClick={() => page(-1)} disabled={!scroll.left} className={`${arrow} disabled:cursor-default disabled:opacity-30`}>
          <ChevronLeft size={14} strokeWidth={2.2} />
        </button>
      )}
      <div ref={scrollerRef} onScroll={syncArrows} className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
      <ol className="m-0 flex list-none items-center gap-[4px] p-0" style={{ minWidth: items.length * (MIN_SEGMENT + 4) }}>
        {items.map((s, i) => {
          const isActive = i === currentStepIndex;
          const isDone = i < currentStepIndex;
          return (
            <li key={i} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onGoToStep?.(i)}
                onMouseEnter={(e) => peekAt(i, e.currentTarget)}
                onFocus={(e) => peekAt(i, e.currentTarget)}
                onBlur={() => setPeekIndex(null)}
                aria-label={`Step ${i + 1}: ${s.title}${isDone ? ' (done)' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                className="group flex h-[18px] w-full cursor-pointer items-center rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/50"
              >
                <span
                  className={`block w-full rounded-full transition-all duration-200 ${
                    isActive
                      ? 'h-[5.5px] bg-[#ea580c] shadow-[0_0_10px_rgba(234,88,12,0.65)]'
                      : isDone
                        ? 'h-[4px] bg-white/85 group-hover:bg-white group-hover:shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                        : 'h-[4px] bg-white/35 group-hover:bg-white/75 group-hover:shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      </div>
      {(scroll.left || scroll.right) && (
        <button type="button" aria-label="Later steps" onClick={() => page(1)} disabled={!scroll.right} className={`${arrow} disabled:cursor-default disabled:opacity-30`}>
          <ChevronRight size={14} strokeWidth={2.2} />
        </button>
      )}

      <div className="pointer-events-none absolute bottom-full mb-2" style={peekAnchor}>
      <AnimatePresence>
        {peek && (
          <motion.div
            key="step-peek"
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="w-max max-w-[260px] rounded-xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] px-2.5 py-1.5 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-baseline gap-1.5 text-[11.5px] leading-snug">
              <span className={`shrink-0 font-semibold tabular-nums ${peekIndex === currentStepIndex ? 'text-[#ea580c]' : 'text-[var(--text-tertiary)]'}`}>
                {peekIndex + 1}
              </span>
              <span className="truncate font-semibold text-[var(--text-primary)]">{peek.title}</span>
            </div>
            {peek.summary && (
              <p className="m-0 mt-0.5 truncate text-[10.5px] leading-snug text-[var(--text-secondary)]">
                {peek.summary}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </nav>
  );
}

export default StepNavigator;
