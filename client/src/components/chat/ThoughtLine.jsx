'use client';

import React, { useState } from 'react';
import { useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Check, X } from 'lucide-react';
import { STROKE_PATH } from '../layout/VisaiLogo';
import './ThoughtLine.css';

const EMPTY_STEPS = [];

/**
 * The TutorBoard mark's own stroke, drawing itself: the line runs along the
 * brand curve and lands on the amber point, then starts again — "drawn live".
 * Still (fully drawn) when nothing is running or motion is reduced.
 */
const StrokeGlyph = () => (
  <svg viewBox="12 18 38 28" width="1.35em" height="1em" aria-hidden="true" className="thought-line__stroke-svg">
    <path className="thought-line__stroke-track" d={STROKE_PATH} pathLength="1" />
    <path className="thought-line__stroke-ink" d={STROKE_PATH} pathLength="1" />
    <circle className="thought-line__stroke-dot" cx="46.5" cy="23" r="3.6" />
  </svg>
);

/**
 * ThoughtLine — the status of one request while it runs.
 *
 * Shows exactly what it is given: `label` (the current status) and `steps`
 * ([{ id, label, status: 'active' | 'done' | 'failed' }]) reported by the
 * server (see lib/requestProgress). It never advances on its own — no timer,
 * no default steps. Screen readers hear the status line when it changes, not
 * every update.
 */
export default function ThoughtLine({
  label = 'Getting started…',
  steps = EMPTY_STEPS,
  working = true,
  collapsible = true,
  color = 'currentColor',
  fontSize = 14,
  className = '',
  style,
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const hasTrace = steps.length > 0;
  const toggle = hasTrace && collapsible;
  const head = (
    <>
      <span className="thought-line__glyph" aria-hidden="true">
        <StrokeGlyph />
      </span>
      <span className="thought-line__label" aria-hidden="true">
        <span className="thought-line__text" data-active="">
          <span className="thought-line__breath" data-shimmer={working && !reduce ? '' : undefined}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'inline-block' }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </span>
      {collapsible ? (
        <span className="thought-line__chevron" data-on={hasTrace ? '' : undefined} aria-hidden="true">
          {/* › closed, ⌄ open */}
          <ChevronRight size="0.9em" strokeWidth={2.2} />
        </span>
      ) : null}
      <span className="thought-line__sr" role="status" aria-live="polite">
        {label}
      </span>
    </>
  );

  return (
    <div
      className={`thought-line${className ? ` ${className}` : ''}`}
      data-working={working ? '' : undefined}
      data-reduced={reduce ? '' : undefined}
      data-open={open && hasTrace ? '' : undefined}
      style={{
        '--tl-font': `${fontSize}px`,
        '--tl-color': color,
        ...style,
      }}
    >
      {collapsible ? (
        <button
          type="button"
          className="thought-line__head"
          data-toggle={toggle ? '' : undefined}
          aria-expanded={toggle ? open : undefined}
          aria-label={toggle ? `${label} — ${open ? 'hide' : 'show'} steps` : undefined}
          tabIndex={toggle ? 0 : -1}
          onClick={() => { if (toggle) setOpen((v) => !v); }}
        >
          {head}
        </button>
      ) : (
        <div className="thought-line__head">{head}</div>
      )}
      {hasTrace ? (
        <div className="thought-line__trace" data-open={open ? '' : undefined} aria-hidden={!open}>
          <div className="thought-line__fold">
            <ul className="thought-line__steps" data-testid="progress-steps">
              {steps.map(({ id, label: text, status }) => (
                <li
                  key={id}
                  className={`thought-line__step${status === 'active' ? ' thought-line__step--active' : ''}`}
                  data-status={status}
                  data-done={status === 'done' ? '' : undefined}
                >
                  <span className="thought-line__mark" aria-hidden="true">
                    {status === 'done' ? (
                      <Check size={12} strokeWidth={2.4} className="text-emerald-500 dark:text-emerald-400" />
                    ) : status === 'failed' ? (
                      <X size={12} strokeWidth={2.4} className="text-[var(--text-tertiary)]" />
                    ) : (
                      <span className="thought-line__pulse" />
                    )}
                  </span>
                  <span className="thought-line__step-text truncate" title={text}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
