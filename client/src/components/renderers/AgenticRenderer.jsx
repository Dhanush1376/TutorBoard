/**
 * AgenticRenderer — Fully AI-Driven Animation Engine
 *
 * Replaces TopicAnimationEngine.jsx completely.
 * Renders whatever the AI pipeline describes — no hardcoded topics.
 *
 * Props:
 *   objects     — array of shape objects from AI timeline
 *   steps       — array of animation steps from AI timeline
 *   currentStep — current step index (controlled by parent)
 *   onStepChange — callback when auto-advance triggers
 *   autoPlay    — boolean, whether to auto-advance steps
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimationRenderer from './AnimationRenderer';

// ── Transition timing map based on AI-specified pacing ────────────────────────
const PACING_DURATION = {
  slow:    5500,
  medium:  3500,
  fast:    2000,
  default: 3500,
};

// ── AI-specified transition → framer-motion config ────────────────────────────
const ANIM_CONFIG = {
  fadeIn:   { duration: 0.5,  ease: [0.16, 1, 0.3, 1] },
  slideUp:  { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  scaleIn:  { duration: 0.5,  ease: [0.34, 1.56, 0.64, 1] },
  popIn:    { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] },
  reveal:   { duration: 0.5,  ease: 'easeOut' },
  springIn: { duration: 0.6,  ease: [0.16, 1, 0.3, 1] },
  drawLine: { duration: 0.7,  ease: 'easeOut' },
  default:  { duration: 0.5,  ease: [0.16, 1, 0.3, 1] },
};

export default function AgenticRenderer({
  scene = {},
  elements = [],
  connections = [],
  timeline = [],
  currentStep = 0,
  onStepChange,
  autoPlay = true,

  // Legacy props support (mapping to new structure)
  objects = [],
  steps = []
}) {
  const activeElements = elements.length > 0 ? elements : objects;
  const activeTimeline = timeline.length > 0 ? timeline : steps;

  const [localStep, setLocalStep] = useState(currentStep);
  const timerRef = useRef(null);

  // Sync with parent-controlled step
  useEffect(() => { setLocalStep(currentStep); }, [currentStep]);

  // Auto-advance based on AI-specified durationMs for each step
  useEffect(() => {
    if (!autoPlay || activeTimeline.length === 0) return;
    clearTimeout(timerRef.current);

    const step = activeTimeline[localStep];
    if (!step) return;

    const duration = step.durationMs ||
      PACING_DURATION[step.pacing] ||
      PACING_DURATION.default;

    timerRef.current = setTimeout(() => {
      const next = localStep + 1;
      if (next < activeTimeline.length) {
        setLocalStep(next);
        onStepChange?.(next);
      }
    }, duration);

    return () => clearTimeout(timerRef.current);
  }, [localStep, autoPlay, activeTimeline, onStepChange]);

  // Current step narration for the overlay
  const currentStepData = activeTimeline[localStep] || {};

  if (!activeElements.length || !activeTimeline.length) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-[var(--text-tertiary)] text-sm">No animation data</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Canvas layer — fully AI-driven via AnimationRenderer */}
      <AnimationRenderer
        scene={scene}
        elements={activeElements}
        connections={connections}
        timeline={activeTimeline}
        currentStepIndex={localStep}
      />

      {/* Narration overlay — AI-generated narration per step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`narration-${localStep}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-2xl w-full px-6"
        >
          <div className="bg-[var(--bg-primary)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl px-6 py-4 shadow-2xl">
            {/* Step title */}
            {currentStepData.title && (
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
                {currentStepData.title}
              </div>
            )}
            {/* AI narration */}
            <div className="text-[14px] text-[var(--text-primary)] leading-relaxed font-medium">
              {currentStepData.narration || '...'}
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-3 justify-center">
              {steps.map((_, i) => (
                <motion.button
                  key={i}
                  onClick={() => { setLocalStep(i); onStepChange?.(i); }}
                  className="rounded-full transition-all"
                  animate={{
                    width: i === localStep ? 20 : 6,
                    height: 6,
                    backgroundColor: i === localStep
                      ? 'var(--text-primary)'
                      : i < localStep
                      ? 'var(--text-secondary)'
                      : 'var(--border-color)',
                  }}
                  transition={{ duration: 0.25 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
