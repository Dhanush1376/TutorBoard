import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsapManager } from '../../utils/gsap-manager';

gsap.registerPlugin(ScrollTrigger);

/**
 * TimelineRenderer — Dual-mode teaching timeline.
 *
 * MODE 1 — Step timeline (primary):
 *   Driven by the teaching FSM's step sequence.
 *   Each step is a rich card: step type badge + narration + key objects summary.
 *   Cards animate in as the teaching advances.
 *   Active step pulses. Completed steps show a check ring.
 *   Clicking a past card seeks back to that step.
 *
 * MODE 2 — Historical timeline (legacy DSL mode):
 *   Renders dsl.timeline[] with GSAP ScrollTrigger scroll-in.
 *   Preserved exactly from the original TimelineRenderer.
 *
 * Props:
 *   steps[]           — teaching step objects from AI response
 *   learningNodes[]   — learningNode objects from AI response
 *   currentStepIndex  — controlled externally
 *   totalSteps        — total step count
 *   onSeekStep(i)     — seek callback (from TeachingSession / useTeachingMachine)
 *   isPlaying         — playback state (for animated current-step indicator)
 *   dsl               — legacy DSL object ({ timeline: [] })
 *   style             — legacy GSAP style key
 */

// ─── Step type visual config ──────────────────────────────────────────────────
// ─── Complete Node Config — All 17 domains ────────────────────────────────────
const NODE_CFG = {
  // ── Universal ──────────────────────────────────────────────────────────────
  hook: { 
    label: 'Hook', accent: '#8b5cf6', 
    bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)',
    icon: '?' 
  },
  prior_knowledge_bridge: { 
    label: 'Connecting', accent: '#0ea5e9', 
    bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)',
    icon: '↗' 
  },
  concept: { 
    label: 'Core Concept', accent: '#6366f1', 
    bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)',
    icon: '◈' 
  },
  intuition: { 
    label: 'Intuition', accent: '#f59e0b', 
    bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)',
    icon: '◉' 
  },
  socratic_moment: { 
    label: 'Predict First', accent: '#ec4899', 
    bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)',
    icon: '→' 
  },
  step_by_step: { 
    label: 'Step by Step', accent: '#10b981', 
    bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)',
    icon: '≡' 
  },
  worked_example: { 
    label: 'Worked Example', accent: '#14b8a6', 
    bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)',
    icon: '✓' 
  },
  visual: { 
    label: 'Watch Canvas', accent: '#a78bfa', 
    bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)',
    icon: '◎' 
  },
  common_mistake: { 
    label: 'Watch Out', accent: '#ef4444', 
    bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)',
    icon: '!' 
  },
  real_world_application: { 
    label: 'Real World', accent: '#22c55e', 
    bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)',
    icon: '◆' 
  },
  result: { 
    label: 'Key Insight', accent: '#fbbf24', 
    bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
    icon: '★' 
  },

  // ── DSA / CS ───────────────────────────────────────────────────────────────
  complexity_analysis: {
    label: 'Complexity', accent: '#f97316',
    bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)',
    icon: 'O'
  },
  edge_case: {
    label: 'Edge Case', accent: '#e11d48',
    bg: 'rgba(225,29,72,0.1)', border: 'rgba(225,29,72,0.2)',
    icon: '⚠'
  },
  code_walkthrough: {
    label: 'Code Walk', accent: '#06b6d4',
    bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)',
    icon: '{ }'
  },
  architecture_overview: {
    label: 'Architecture', accent: '#0891b2',
    bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.2)',
    icon: '⬡'
  },
  best_practice: {
    label: 'Best Practice', accent: '#059669',
    bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.2)',
    icon: '✦'
  },

  // ── Mathematics ────────────────────────────────────────────────────────────
  geometric_intuition: {
    label: 'Geometry First', accent: '#7c3aed',
    bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)',
    icon: '△'
  },
  proof_sketch: {
    label: 'Proof', accent: '#4f46e5',
    bg: 'rgba(79,70,229,0.1)', border: 'rgba(79,70,229,0.2)',
    icon: '∴'
  },

  // ── Physics ────────────────────────────────────────────────────────────────
  phenomenon: {
    label: 'Phenomenon', accent: '#2563eb',
    bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.2)',
    icon: '⚡'
  },
  mathematical_model: {
    label: 'The Math', accent: '#1d4ed8',
    bg: 'rgba(29,78,216,0.1)', border: 'rgba(29,78,216,0.2)',
    icon: 'f(x)'
  },
  experiment: {
    label: 'Experiment', accent: '#0284c7',
    bg: 'rgba(2,132,199,0.1)', border: 'rgba(2,132,199,0.2)',
    icon: '🔬'
  },

  // ── Chemistry ─────────────────────────────────────────────────────────────
  molecular_intuition: {
    label: 'Molecular View', accent: '#dc2626',
    bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.2)',
    icon: '⬡'
  },
  reaction_mechanism: {
    label: 'Mechanism', accent: '#b91c1c',
    bg: 'rgba(185,28,28,0.1)', border: 'rgba(185,28,28,0.2)',
    icon: '⇌'
  },
  safety_note: {
    label: 'Safety', accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)',
    icon: '⚠'
  },

  // ── Biology ────────────────────────────────────────────────────────────────
  analogy: {
    label: 'Analogy', accent: '#16a34a',
    bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.2)',
    icon: '≈'
  },
  process_breakdown: {
    label: 'Process', accent: '#15803d',
    bg: 'rgba(21,128,61,0.1)', border: 'rgba(21,128,61,0.2)',
    icon: '↻'
  },
  case_study: {
    label: 'Case Study', accent: '#166534',
    bg: 'rgba(22,101,52,0.1)', border: 'rgba(22,101,52,0.2)',
    icon: '📋'
  },

  // ── Medicine ───────────────────────────────────────────────────────────────
  clinical_hook: {
    label: 'Clinical Case', accent: '#ec4899',
    bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)',
    icon: '🏥'
  },
  anatomy_context: {
    label: 'Anatomy', accent: '#db2777',
    bg: 'rgba(219,39,119,0.1)', border: 'rgba(219,39,119,0.2)',
    icon: '⬡'
  },
  pathophysiology: {
    label: 'Pathophysiology', accent: '#be185d',
    bg: 'rgba(190,24,93,0.1)', border: 'rgba(190,24,93,0.2)',
    icon: '⟳'
  },
  diagnosis_walkthrough: {
    label: 'Diagnosis', accent: '#9d174d',
    bg: 'rgba(157,23,77,0.1)', border: 'rgba(157,23,77,0.2)',
    icon: 'Dx'
  },
  treatment_protocol: {
    label: 'Treatment', accent: '#831843',
    bg: 'rgba(131,24,67,0.1)', border: 'rgba(131,24,67,0.2)',
    icon: 'Rx'
  },
  clinical_pearl: {
    label: 'Clinical Pearl', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
    icon: '💎'
  },

  // ── Business ───────────────────────────────────────────────────────────────
  scenario_hook: {
    label: 'Scenario', accent: '#14b8a6',
    bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)',
    icon: '🏢'
  },
  framework: {
    label: 'Framework', accent: '#0d9488',
    bg: 'rgba(13,148,136,0.1)', border: 'rgba(13,148,136,0.2)',
    icon: '□'
  },
  common_pitfall: {
    label: 'Pitfall', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)',
    icon: '⚠'
  },

  // ── Law ────────────────────────────────────────────────────────────────────
  case_hook: {
    label: 'The Case', accent: '#ca8a04',
    bg: 'rgba(202,138,4,0.1)', border: 'rgba(202,138,4,0.2)',
    icon: '⚖'
  },
  legal_concept: {
    label: 'Legal Concept', accent: '#b45309',
    bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.2)',
    icon: '§'
  },
  principle: {
    label: 'Principle', accent: '#92400e',
    bg: 'rgba(146,64,14,0.1)', border: 'rgba(146,64,14,0.2)',
    icon: '⊕'
  },
  case_analysis: {
    label: 'Case Analysis', accent: '#78350f',
    bg: 'rgba(120,53,15,0.1)', border: 'rgba(120,53,15,0.2)',
    icon: '⊷'
  },
  argument_structure: {
    label: 'Arguments', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
    icon: '↔'
  },
  common_confusion: {
    label: 'Common Confusion', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)',
    icon: '?!'
  },

  // ── History ────────────────────────────────────────────────────────────────
  narrative_hook: {
    label: 'The Moment', accent: '#d97706',
    bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)',
    icon: '📜'
  },
  context: {
    label: 'Context', accent: '#b45309',
    bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.2)',
    icon: '◫'
  },
  key_event: {
    label: 'Key Event', accent: '#92400e',
    bg: 'rgba(146,64,14,0.1)', border: 'rgba(146,64,14,0.2)',
    icon: '⚑'
  },
  cause_effect: {
    label: 'Cause & Effect', accent: '#78350f',
    bg: 'rgba(120,53,15,0.1)', border: 'rgba(120,53,15,0.2)',
    icon: '→'
  },
  timeline_walk: {
    label: 'Timeline', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
    icon: '⟶'
  },
  multiple_perspectives: {
    label: 'Perspectives', accent: '#a16207',
    bg: 'rgba(161,98,7,0.1)', border: 'rgba(161,98,7,0.2)',
    icon: '⊗'
  },
  significance: {
    label: 'Significance', accent: '#ca8a04',
    bg: 'rgba(202,138,4,0.1)', border: 'rgba(202,138,4,0.2)',
    icon: '★'
  },

  // ── Engineering ────────────────────────────────────────────────────────────
  problem_statement: {
    label: 'Problem', accent: '#f97316',
    bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)',
    icon: '⊡'
  },
  physical_intuition: {
    label: 'Physical Intuition', accent: '#ea580c',
    bg: 'rgba(234,88,12,0.1)', border: 'rgba(234,88,12,0.2)',
    icon: '⚙'
  },
  formula_derivation: {
    label: 'Derivation', accent: '#c2410c',
    bg: 'rgba(194,65,12,0.1)', border: 'rgba(194,65,12,0.2)',
    icon: '∫'
  },
  design_consideration: {
    label: 'Design Note', accent: '#9a3412',
    bg: 'rgba(154,52,18,0.1)', border: 'rgba(154,52,18,0.2)',
    icon: '✦'
  },

  // ── Psychology ─────────────────────────────────────────────────────────────
  behavior_hook: {
    label: 'Behavior', accent: '#a855f7',
    bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)',
    icon: '👁'
  },
  theory: {
    label: 'Theory', accent: '#9333ea',
    bg: 'rgba(147,51,234,0.1)', border: 'rgba(147,51,234,0.2)',
    icon: 'T'
  },

  // ── Economics ──────────────────────────────────────────────────────────────
  model: {
    label: 'Model', accent: '#4ade80',
    bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)',
    icon: '⊞'
  },
  graph_intuition: {
    label: 'The Graph', accent: '#22c55e',
    bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)',
    icon: '📈'
  },
  policy_implication: {
    label: 'Policy', accent: '#16a34a',
    bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.2)',
    icon: '⊕'
  },

  // ── Arts ───────────────────────────────────────────────────────────────────
  aesthetic_hook: {
    label: 'Aesthetic', accent: '#f43f5e',
    bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)',
    icon: '✦'
  },
  technique_breakdown: {
    label: 'Technique', accent: '#e11d48',
    bg: 'rgba(225,29,72,0.1)', border: 'rgba(225,29,72,0.2)',
    icon: '◎'
  },
  style_analysis: {
    label: 'Style Analysis', accent: '#be123c',
    bg: 'rgba(190,18,60,0.1)', border: 'rgba(190,18,60,0.2)',
    icon: '⊛'
  },

  // ── Aviation / Maritime ────────────────────────────────────────────────────
  procedure_walkthrough: {
    label: 'Procedure', accent: '#38bdf8',
    bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)',
    icon: '✈'
  },
  safety_critical: {
    label: 'Safety Critical', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)',
    icon: '⚠'
  },
};

const getNodeCfg = (type) =>
  NODE_CFG[type?.toLowerCase?.()] || {
    label: type?.replace(/_/g, ' ') || 'Step',
    accent: '#64748b',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    icon: '·',
  };

// ─── Animated step indicator dot ──────────────────────────────────────────────
const StepDot = ({ state, color }) => {
  // state: 'done' | 'active' | 'upcoming'
  return (
    <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
      {/* Done ring */}
      {state === 'done' && (
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: 'absolute', inset: 0 }}>
          <circle cx={7} cy={7} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
          <path d="M 4 7 L 6 9 L 10 5" stroke={color} strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}

      {/* Active pulsing dot */}
      {state === 'active' && (
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 0 0 ${color}55`,
          }}
          animate={{ boxShadow: [`0 0 0 0 ${color}55`, `0 0 0 8px ${color}00`] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Upcoming hollow dot */}
      {state === 'upcoming' && (
        <div style={{
          position: 'absolute', inset: 2,
          borderRadius: '50%',
          border: `1.5px solid rgba(100,116,139,0.35)`,
        }} />
      )}
    </div>
  );
};

// ─── Single step card ─────────────────────────────────────────────────────────
const StepCard = ({
  step, node, stepIndex, currentStepIndex, totalSteps, onSeekStep,
}) => {
  const cfg = getNodeCfg(node?.type);
  const state =
    stepIndex < currentStepIndex ? 'done' :
    stepIndex === currentStepIndex ? 'active' : 'upcoming';
  const isActive = state === 'active';
  const isDone   = state === 'done';
  const isClickable = stepIndex <= currentStepIndex;

  const cardVariants = {
    hidden:  { opacity: 0, x: -22, scale: 0.97 },
    visible: { opacity: 1, x: 0,   scale: 1     },
    done:    { opacity: 0.62                     },
  };

  return (
    <motion.div
      initial="hidden"
      animate={isDone ? ['visible', 'done'] : 'visible'}
      variants={cardVariants}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: Math.min(stepIndex * 0.06, 0.8) }}
      onClick={() => isClickable && onSeekStep?.(stepIndex)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${isActive ? (cfg.accent || cfg.color) + '45' : 'rgba(51,65,85,0.45)'}`,
        background: isActive ? (cfg.bg || 'rgba(15,23,42,0.45)') : 'rgba(15,23,42,0.45)',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        scale: isActive ? 1.02 : 1,
        boxShadow: isActive ? `0 8px 32px ${(cfg.accent || cfg.color)}20` : 'none',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Active left bar */}
      {isActive && (
        <motion.div
          layoutId="active-bar"
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 3, borderRadius: '0 2px 2px 0',
            background: cfg.accent || cfg.color,
          }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {/* Connector line + dot column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
        <StepDot state={state} color={cfg.accent || cfg.color} />
        {stepIndex < totalSteps - 1 && (
          <div style={{
            width: 1, flexGrow: 1, marginTop: 6,
            background: isDone
              ? (cfg.accent || cfg.color) + '40'
              : 'rgba(51,65,85,0.3)',
            minHeight: 24,
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Type badge + step number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: 'rgba(100,116,139,0.7)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {stepIndex + 1}
          </span>

          {node?.type && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              padding: '2px 8px', borderRadius: 999,
              color: cfg.accent || cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.accent || cfg.color}30`,
            }}>
              {cfg.icon} {cfg.label}
            </span>
          )}
        </div>

        {/* Step title */}
        <p style={{
          fontSize: 12.5, fontWeight: isActive ? 700 : 500,
          color: isActive ? '#f8fafc' : '#94a3b8',
          margin: 0, lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {step?.title || node?.title || `Step ${stepIndex + 1}`}
        </p>
      </div>
    </motion.div>
  );
};

// ─── Progress summary bar ──────────────────────────────────────────────────────
const ProgressBar = ({ currentStepIndex, totalSteps, keyFormula, memoryAnchor }) => {
  const pct = totalSteps > 0 ? Math.round(((currentStepIndex + 1) / totalSteps) * 100) : 0;

  return (
    <div style={{ padding: '12px 16px 0' }}>
      {/* % label + formula pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
          {pct}% COMPLETE
        </span>
        {keyFormula && (
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            color: '#a5b4fc', background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.22)',
            padding: '2px 8px', borderRadius: 6,
            maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {keyFormula}
          </span>
        )}
      </div>

      {/* Track */}
      <div style={{
        height: 3, background: 'rgba(51,65,85,0.5)',
        borderRadius: 99, overflow: 'hidden', marginBottom: 14,
      }}>
        <motion.div
          style={{ height: '100%', background: '#6366f1', borderRadius: 99 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Memory anchor at 100% */}
      <AnimatePresence>
        {pct === 100 && memoryAnchor && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '10px 12px', marginBottom: 12,
              background: 'rgba(251,191,36,0.07)',
              border: '1px solid rgba(251,191,36,0.22)',
              borderRadius: 10,
            }}
          >
            <p style={{ fontSize: 8, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              Memory anchor ★
            </p>
            <p style={{ fontSize: 11, fontStyle: 'italic', color: '#fcd34d', lineHeight: 1.5, margin: 0 }}>
              {memoryAnchor}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// LEGACY GSAP TIMELINE (DSL mode — original behaviour preserved exactly)
// ════════════════════════════════════════════════════════════════════════════

const LegacyTimelineRenderer = ({ dsl, style = 'educational' }) => {
  const containerRef = useRef(null);
  const itemsRef = useRef([]);
  const lineRef = useRef(null);
  const dotRefs = useRef([]);

  const { timeline = [] } = dsl || {};
  const currentStyle = gsapManager.styles[style] || gsapManager.styles.educational;

  useEffect(() => {
    if (!timeline.length) return;
    gsap.set(itemsRef.current, { opacity: 0, x: (i) => i % 2 === 0 ? -50 : 50 });
    gsap.set(dotRefs.current, { scale: 0, opacity: 0 });
    const tl = gsap.timeline();
    tl.from(lineRef.current, { scaleY: 0, transformOrigin: 'top', duration: 1.5, ease: 'power4.inOut' });
    timeline.forEach((_, i) => {
      ScrollTrigger.create({
        trigger: itemsRef.current[i],
        start: 'top 85%',
        onEnter: () => {
          gsap.to(itemsRef.current[i], { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' });
          gsap.to(dotRefs.current[i], { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
        },
        once: true,
      });
    });
    return () => ScrollTrigger.getAll().forEach(st => st.kill());
  }, [timeline]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col items-center pointer-events-none p-10 overflow-y-auto no-scrollbar opacity-80">
      <div className="relative flex flex-col items-center w-full max-w-3xl py-32 min-h-screen">
        <div
          ref={lineRef}
          className="absolute h-full w-[1.5px] opacity-10"
          style={{ backgroundColor: currentStyle.colors.primary, left: '50%' }}
        />
        {timeline.map((item, i) => (
          <div
            key={`tl-${i}`}
            className={`relative flex items-center w-full mb-24 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
          >
            <div
              ref={el => dotRefs.current[i] = el}
              className="absolute w-6 h-6 rounded-full shadow-2xl z-20 flex items-center justify-center"
              style={{
                backgroundColor: currentStyle.colors.primary,
                left: '50%', transform: 'translateX(-50%)',
                boxShadow: `0 0 20px ${currentStyle.colors.primary}40`,
              }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
            <div
              ref={el => itemsRef.current[i] = el}
              className={`w-[44%] pointer-events-auto group cursor-pointer ${i % 2 === 0 ? 'text-right pr-12' : 'text-left pl-12'}`}
            >
              <div className="bg-[var(--bg-secondary)]/60 backdrop-blur-3xl border border-[var(--border-color)] p-8 rounded-[2rem] shadow-xl transition-all duration-500 group-hover:bg-[var(--bg-tertiary)] group-hover:scale-[1.02] group-hover:shadow-2xl">
                <div className={`flex items-center gap-3 mb-4 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full border border-[var(--border-color)] text-[var(--text-tertiary)]">
                    {item.time}
                  </span>
                </div>
                <h4 className="text-2xl font-serif italic text-[var(--text-primary)] mb-3 leading-tight tracking-tight">
                  {item.event}
                </h4>
                <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed font-medium opacity-85">
                  {item.description}
                </p>
                <div
                  className="h-0.5 mt-6 w-0 group-hover:w-full transition-all duration-700 rounded-full"
                  style={{ backgroundColor: currentStyle.colors.primary }}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="h-20 w-full" />
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const TimelineRenderer = ({
  // Teaching mode props
  steps,
  learningNodes,
  currentStepIndex = 0,
  totalSteps = 0,
  onSeekStep,
  isPlaying = false,
  keyFormula,
  memoryAnchor,

  // Legacy DSL mode props
  dsl,
  style = 'educational',
}) => {
  const scrollRef = useRef(null);
  const activeCardRef = useRef(null);

  // Auto-scroll active step into view
  useEffect(() => {
    if (activeCardRef.current && scrollRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentStepIndex]);

  // ── Legacy DSL mode ──
  if (dsl?.timeline?.length && (!steps || !steps.length)) {
    return <LegacyTimelineRenderer dsl={dsl} style={style} />;
  }

  // ── Teaching step mode ──
  const safeSteps = Array.isArray(steps) ? steps : [];
  const safeNodes = Array.isArray(learningNodes) ? learningNodes : [];
  const n = totalSteps || safeSteps.length;

  if (n === 0) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      pointerEvents: 'none',
    }}>
      {/* Progress bar header */}
      <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
        <ProgressBar
          currentStepIndex={currentStepIndex}
          totalSteps={n}
          keyFormula={keyFormula}
          memoryAnchor={memoryAnchor}
        />
      </div>

      {/* Scrollable step list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '0 12px 16px',
          pointerEvents: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {safeSteps.map((step, i) => (
          <div
            key={`step-card-${i}`}
            ref={i === currentStepIndex ? activeCardRef : null}
          >
            <StepCard
              step={step}
              node={safeNodes[i]}
              stepIndex={i}
              currentStepIndex={currentStepIndex}
              totalSteps={n}
              onSeekStep={onSeekStep}
            />
          </div>
        ))}
      </div>

      {/* Hide scrollbar cross-browser */}
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default TimelineRenderer;