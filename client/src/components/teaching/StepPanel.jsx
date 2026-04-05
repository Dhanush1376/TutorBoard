/**
 * StepPanel v2.0 — Rich narration card for teaching session
 *
 * Enhancements:
 * 1. Covers ALL 17 domain-specific learning node types
 * 2. Clinical nodes (medicine): pathophysiology, diagnosis_walkthrough, clinical_pearl
 * 3. Law nodes: case_hook, legal_concept, case_analysis, argument_structure
 * 4. History nodes: narrative_hook, cause_effect, multiple_perspectives
 * 5. Engineering: formula_derivation, design_consideration
 * 6. Business: scenario_hook, framework, common_pitfall
 * 7. All original features preserved (typewriter, socratic gate, micro-steps, memory anchor)
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Complete Node Config — All 17 domains ────────────────────────────────────
const NODE_CFG = {
  // ── Universal ──────────────────────────────────────────────────────────────
  hook: {
    label: 'Hook', accent: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)',
    icon: '?', hint: 'A question to make you need the answer.',
  },
  prior_knowledge_bridge: {
    label: 'Connecting', accent: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)',
    icon: '↗', hint: null,
  },
  concept: {
    label: 'Core Concept', accent: '#6366f1',
    bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)',
    icon: '◈', hint: null,
  },
  intuition: {
    label: 'Intuition', accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
    icon: '◉', hint: null,
  },
  socratic_moment: {
    label: 'Predict First', accent: '#ec4899',
    bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.2)',
    icon: '→', hint: 'Make a prediction, then reveal.',
  },
  step_by_step: {
    label: 'Step by Step', accent: '#10b981',
    bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)',
    icon: '≡', hint: null,
  },
  worked_example: {
    label: 'Worked Example', accent: '#14b8a6',
    bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)',
    icon: '✓', hint: 'Think out loud with the professor.',
  },
  visual: {
    label: 'Watch Canvas', accent: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)',
    icon: '◎', hint: 'Look at the animation carefully.',
  },
  common_mistake: {
    label: 'Watch Out', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
    icon: '!', hint: 'Most students get this wrong.',
  },
  real_world_application: {
    label: 'Real World', accent: '#22c55e',
    bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',
    icon: '◆', hint: null,
  },
  result: {
    label: 'Key Insight', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
    icon: '★', hint: 'The one thing to remember.',
  },

  // ── DSA / CS ───────────────────────────────────────────────────────────────
  complexity_analysis: {
    label: 'Complexity', accent: '#f97316',
    bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)',
    icon: 'O', hint: 'Big-O runtime and space analysis.',
  },
  edge_case: {
    label: 'Edge Case', accent: '#e11d48',
    bg: 'rgba(225,29,72,0.08)', border: 'rgba(225,29,72,0.2)',
    icon: '⚠', hint: 'What breaks this algorithm?',
  },
  code_walkthrough: {
    label: 'Code Walk', accent: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)',
    icon: '{ }', hint: 'Follow the code execution.',
  },
  architecture_overview: {
    label: 'Architecture', accent: '#0891b2',
    bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.2)',
    icon: '⬡', hint: 'How the system is structured.',
  },
  best_practice: {
    label: 'Best Practice', accent: '#059669',
    bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)',
    icon: '✦', hint: 'What professionals actually do.',
  },

  // ── Mathematics ────────────────────────────────────────────────────────────
  geometric_intuition: {
    label: 'Geometry First', accent: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)',
    icon: '△', hint: 'See the shape before the equation.',
  },
  proof_sketch: {
    label: 'Proof', accent: '#4f46e5',
    bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)',
    icon: '∴', hint: 'Why this is necessarily true.',
  },

  // ── Physics ────────────────────────────────────────────────────────────────
  phenomenon: {
    label: 'Phenomenon', accent: '#2563eb',
    bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.2)',
    icon: '⚡', hint: 'Observe this in the real world.',
  },
  mathematical_model: {
    label: 'The Math', accent: '#1d4ed8',
    bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.2)',
    icon: 'f(x)', hint: 'The equation that captures reality.',
  },
  experiment: {
    label: 'Experiment', accent: '#0284c7',
    bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.2)',
    icon: '🔬', hint: 'How we verified this.',
  },

  // ── Chemistry ─────────────────────────────────────────────────────────────
  molecular_intuition: {
    label: 'Molecular View', accent: '#dc2626',
    bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)',
    icon: '⬡', hint: 'See what\'s happening at the atomic scale.',
  },
  reaction_mechanism: {
    label: 'Mechanism', accent: '#b91c1c',
    bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.2)',
    icon: '⇌', hint: 'How electrons move in this reaction.',
  },
  safety_note: {
    label: 'Safety', accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
    icon: '⚠', hint: 'Critical safety information.',
  },

  // ── Biology ────────────────────────────────────────────────────────────────
  analogy: {
    label: 'Analogy', accent: '#16a34a',
    bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)',
    icon: '≈', hint: 'Think of it like this...',
  },
  process_breakdown: {
    label: 'Process', accent: '#15803d',
    bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.2)',
    icon: '↻', hint: 'Each phase of the biological process.',
  },
  case_study: {
    label: 'Case Study', accent: '#166534',
    bg: 'rgba(22,101,52,0.08)', border: 'rgba(22,101,52,0.2)',
    icon: '📋', hint: 'A real biological example.',
  },

  // ── Medicine ───────────────────────────────────────────────────────────────
  clinical_hook: {
    label: 'Clinical Case', accent: '#ec4899',
    bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.2)',
    icon: '🏥', hint: 'A real patient scenario to ground the theory.',
  },
  anatomy_context: {
    label: 'Anatomy', accent: '#db2777',
    bg: 'rgba(219,39,119,0.08)', border: 'rgba(219,39,119,0.2)',
    icon: '⬡', hint: 'The structural context for this concept.',
  },
  pathophysiology: {
    label: 'Pathophysiology', accent: '#be185d',
    bg: 'rgba(190,24,93,0.08)', border: 'rgba(190,24,93,0.2)',
    icon: '⟳', hint: 'What goes wrong, and why.',
  },
  diagnosis_walkthrough: {
    label: 'Diagnosis', accent: '#9d174d',
    bg: 'rgba(157,23,77,0.08)', border: 'rgba(157,23,77,0.2)',
    icon: 'Dx', hint: 'How a clinician would reason through this.',
  },
  treatment_protocol: {
    label: 'Treatment', accent: '#831843',
    bg: 'rgba(131,24,67,0.08)', border: 'rgba(131,24,67,0.2)',
    icon: 'Rx', hint: 'The evidence-based management approach.',
  },
  clinical_pearl: {
    label: 'Clinical Pearl', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
    icon: '💎', hint: 'The senior clinician\'s key insight.',
  },

  // ── Business ───────────────────────────────────────────────────────────────
  scenario_hook: {
    label: 'Scenario', accent: '#14b8a6',
    bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)',
    icon: '🏢', hint: 'A real business situation.',
  },
  framework: {
    label: 'Framework', accent: '#0d9488',
    bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.2)',
    icon: '□', hint: 'The analytical tool to structure thinking.',
  },
  common_pitfall: {
    label: 'Pitfall', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
    icon: '⚠', hint: 'Where most businesses get this wrong.',
  },

  // ── Law ────────────────────────────────────────────────────────────────────
  case_hook: {
    label: 'The Case', accent: '#ca8a04',
    bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.2)',
    icon: '⚖', hint: 'The landmark case that defined this principle.',
  },
  legal_concept: {
    label: 'Legal Concept', accent: '#b45309',
    bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.2)',
    icon: '§', hint: 'The black-letter law.',
  },
  principle: {
    label: 'Principle', accent: '#92400e',
    bg: 'rgba(146,64,14,0.08)', border: 'rgba(146,64,14,0.2)',
    icon: '⊕', hint: 'The underlying legal principle.',
  },
  case_analysis: {
    label: 'Case Analysis', accent: '#78350f',
    bg: 'rgba(120,53,15,0.08)', border: 'rgba(120,53,15,0.2)',
    icon: '⊷', hint: 'Applying the law to the facts.',
  },
  argument_structure: {
    label: 'Arguments', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
    icon: '↔', hint: 'Both sides of the argument.',
  },
  common_confusion: {
    label: 'Common Confusion', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
    icon: '?!', hint: 'Where students confuse the law.',
  },

  // ── History ────────────────────────────────────────────────────────────────
  narrative_hook: {
    label: 'The Moment', accent: '#d97706',
    bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)',
    icon: '📜', hint: 'You are there. This is what you see.',
  },
  context: {
    label: 'Context', accent: '#b45309',
    bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.2)',
    icon: '◫', hint: 'The world that made this event possible.',
  },
  key_event: {
    label: 'Key Event', accent: '#92400e',
    bg: 'rgba(146,64,14,0.08)', border: 'rgba(146,64,14,0.2)',
    icon: '⚑', hint: 'The turning point.',
  },
  cause_effect: {
    label: 'Cause & Effect', accent: '#78350f',
    bg: 'rgba(120,53,15,0.08)', border: 'rgba(120,53,15,0.2)',
    icon: '→', hint: 'Why this led to that.',
  },
  timeline_walk: {
    label: 'Timeline', accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
    icon: '⟶', hint: 'Events in sequence.',
  },
  multiple_perspectives: {
    label: 'Perspectives', accent: '#a16207',
    bg: 'rgba(161,98,7,0.08)', border: 'rgba(161,98,7,0.2)',
    icon: '⊗', hint: 'Different groups saw this very differently.',
  },
  significance: {
    label: 'Significance', accent: '#ca8a04',
    bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.2)',
    icon: '★', hint: 'Why this still matters today.',
  },

  // ── Engineering ────────────────────────────────────────────────────────────
  problem_statement: {
    label: 'Problem', accent: '#f97316',
    bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)',
    icon: '⊡', hint: 'The engineering challenge we\'re solving.',
  },
  physical_intuition: {
    label: 'Physical Intuition', accent: '#ea580c',
    bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)',
    icon: '⚙', hint: 'What physically happens here.',
  },
  formula_derivation: {
    label: 'Derivation', accent: '#c2410c',
    bg: 'rgba(194,65,12,0.08)', border: 'rgba(194,65,12,0.2)',
    icon: '∫', hint: 'Where this equation comes from.',
  },
  design_consideration: {
    label: 'Design Note', accent: '#9a3412',
    bg: 'rgba(154,52,18,0.08)', border: 'rgba(154,52,18,0.2)',
    icon: '✦', hint: 'What an engineer must consider.',
  },

  // ── Psychology ─────────────────────────────────────────────────────────────
  behavior_hook: {
    label: 'Behavior', accent: '#a855f7',
    bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)',
    icon: '👁', hint: 'Observe this behavior in yourself.',
  },
  theory: {
    label: 'Theory', accent: '#9333ea',
    bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.2)',
    icon: 'T', hint: 'The psychological framework.',
  },

  // ── Economics ──────────────────────────────────────────────────────────────
  model: {
    label: 'Model', accent: '#4ade80',
    bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)',
    icon: '⊞', hint: 'The simplified representation of reality.',
  },
  graph_intuition: {
    label: 'The Graph', accent: '#22c55e',
    bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',
    icon: '📈', hint: 'What the curves are telling you.',
  },
  policy_implication: {
    label: 'Policy', accent: '#16a34a',
    bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)',
    icon: '⊕', hint: 'What governments do with this insight.',
  },

  // ── Arts ───────────────────────────────────────────────────────────────────
  aesthetic_hook: {
    label: 'Aesthetic', accent: '#f43f5e',
    bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)',
    icon: '✦', hint: 'Feel the design before analyzing it.',
  },
  technique_breakdown: {
    label: 'Technique', accent: '#e11d48',
    bg: 'rgba(225,29,72,0.08)', border: 'rgba(225,29,72,0.2)',
    icon: '◎', hint: 'How this is actually made.',
  },
  style_analysis: {
    label: 'Style Analysis', accent: '#be123c',
    bg: 'rgba(190,18,60,0.08)', border: 'rgba(190,18,60,0.2)',
    icon: '⊛', hint: 'The defining characteristics of this style.',
  },

  // ── Aviation / Maritime ────────────────────────────────────────────────────
  procedure_walkthrough: {
    label: 'Procedure', accent: '#38bdf8',
    bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)',
    icon: '✈', hint: 'The standard operating procedure.',
  },
  safety_critical: {
    label: 'Safety Critical', accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
    icon: '⚠', hint: 'This has direct safety implications.',
  },
};

const getCfg = (t) =>
  NODE_CFG[t?.toLowerCase?.()] || {
    label: t?.replace(/_/g, ' ') || 'Step',
    accent: '#64748b',
    bg: 'rgba(100,116,139,0.06)',
    border: 'rgba(100,116,139,0.15)',
    icon: '·',
    hint: null,
  };

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text = '', durationMs = 3500) {
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);
  const allWords = text.split(' ').filter(Boolean);

  useEffect(() => {
    clearTimeout(timerRef.current);
    setCount(0);
    if (!allWords.length) return;
    const msPerWord = Math.min(110, Math.max(38, durationMs / (allWords.length + 2)));
    let i = 0;
    const tick = () => {
      i++;
      setCount(i);
      if (i < allWords.length) timerRef.current = setTimeout(tick, msPerWord);
    };
    timerRef.current = setTimeout(tick, 55);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, durationMs]);

  return {
    displayedText: allWords.slice(0, count).join(' '),
    done: count >= allWords.length,
  };
}

// ─── Parse numbered micro-steps ───────────────────────────────────────────────
function parseMicroSteps(content = '') {
  const numbered = content.match(/\d+\.\s[^0-9\n]+/g);
  if (numbered && numbered.length >= 2) return numbered.map(s => s.replace(/^\d+\.\s/, '').trim());
  const lines = content.split('\n').map(l => l.replace(/^[-•·]\s*/, '').trim()).filter(l => l.length > 12);
  if (lines.length >= 2) return lines;
  return null;
}

// ─── Wrong → Right mistake flow ───────────────────────────────────────────────
const MistakeFlow = ({ content, cfg }) => {
  const wrongMatch = content.match(/wrong[:\s]+([^.]+\.)/i);
  const rightMatch = content.match(/(right|correct)[:\s]+([^.]+\.)/i);
  if (!wrongMatch && !rightMatch) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
      {wrongMatch && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800, marginRight: 6, opacity: 0.7 }}>✗ WRONG</span>
          {wrongMatch[1]}
        </div>
      )}
      {rightMatch && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', fontSize: 11, color: '#86efac', lineHeight: 1.5 }}
        >
          <span style={{ fontWeight: 800, marginRight: 6, opacity: 0.7 }}>✓ RIGHT</span>
          {rightMatch[2]}
        </motion.div>
      )}
    </div>
  );
};

// ─── Micro-steps list ──────────────────────────────────────────────────────────
const MicroSteps = ({ steps: ms, cfg }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
    {ms.map((s, i) => (
      <motion.div
        key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1 }}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', background: cfg.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {i + 1}
        </span>
        <span style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>{s}</span>
      </motion.div>
    ))}
  </div>
);

// ─── Socratic reveal gate ──────────────────────────────────────────────────────
const SocraticGate = ({ content, cfg }) => {
  const [revealed, setRevealed] = useState(false);
  const dot = content.indexOf('. ');
  const question = dot > 0 ? content.slice(0, dot + 1) : content;
  const answer   = dot > 0 ? content.slice(dot + 2) : '';
  return (
    <div>
      <p style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6, margin: '0 0 10px', fontStyle: 'italic' }}>{question}</p>
      {answer && (
        <AnimatePresence>
          {revealed ? (
            <motion.div key="answer"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{ padding: '10px 13px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.6 }}
            >
              {answer}
            </motion.div>
          ) : (
            <motion.button key="gate"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setRevealed(true)}
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '7px 16px', borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.accent, cursor: 'pointer', display: 'block' }}
            >
              Reveal answer →
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

// ─── Cursor blink ──────────────────────────────────────────────────────────────
const Cursor = ({ accent }) => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.65, repeat: Infinity }}
    style={{ display: 'inline-block', width: 2, height: 12, background: accent, opacity: 0.75, marginLeft: 2, verticalAlign: 'middle', borderRadius: 1 }}
  />
);

// ─── Main StepPanel ───────────────────────────────────────────────────────────
const StepPanel = ({
  currentStep,
  currentStepIndex = 0,
  totalSteps = 0,
  learningNodes = [],
  memoryAnchor,
  keyFormula,
}) => {
  const node = learningNodes[currentStepIndex];
  const nodeType = node?.type;
  const cfg = getCfg(nodeType);
  const isLast = currentStepIndex === totalSteps - 1;

  const narrationText = currentStep?.narration || node?.content || currentStep?.description || '';
  const stepTitle = currentStep?.title || node?.title || `Step ${currentStepIndex + 1}`;
  const duration = currentStep?.duration || 3500;

  const { displayedText, done } = useTypewriter(narrationText, duration);

  const isMicroStep = nodeType === 'step_by_step' || nodeType === 'process_breakdown' || nodeType === 'timeline_walk';
  const isMistake   = nodeType === 'common_mistake' || nodeType === 'common_confusion' || nodeType === 'common_pitfall';
  const isSocratic  = nodeType === 'socratic_moment';
  const microSteps  = isMicroStep ? parseMicroSteps(narrationText) : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`sp-${currentStepIndex}`}
        initial={{ opacity: 0, x: -22, scale: 0.97 }}
        animate={{ opacity: 1, x: 0,   scale: 1 }}
        exit={{   opacity: 0, x: -16,  scale: 0.97 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${cfg.border}`,
          borderRadius: 18,
          padding: '16px 18px',
          maxWidth: 310,
          width: '100%',
          boxShadow: `var(--glass-shadow), 0 0 80px ${cfg.accent}09`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <motion.div
          layoutId="sp-accent"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 2.5, borderRadius: '18px 18px 0 0',
            background: cfg.accent, opacity: 0.72,
          }}
          transition={{ duration: 0.32 }}
        />

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(100,116,139,0.75)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            {currentStepIndex + 1} / {totalSteps}
          </span>

          {nodeType && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 9px', borderRadius: 999,
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.accent,
              }}
            >
              <span style={{ fontSize: 10 }}>{cfg.icon}</span>
              {cfg.label}
            </motion.span>
          )}
        </div>

        {/* Hint */}
        {cfg.hint && (
          <p style={{ fontSize: 9.5, color: 'rgba(100,116,139,0.55)', fontStyle: 'italic', margin: '0 0 8px' }}>
            {cfg.hint}
          </p>
        )}

        {/* Step title */}
        <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', margin: '0 0 11px', lineHeight: 1.4 }}>
          {stepTitle}
        </h4>

        {/* Content — mode-specific */}
        {isSocratic ? (
          <SocraticGate content={narrationText} cfg={cfg} />
        ) : isMistake ? (
          <>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65, margin: '0 0 2px' }}>
              {displayedText}{!done && <Cursor accent={cfg.accent} />}
            </p>
            <MistakeFlow content={narrationText} cfg={cfg} />
          </>
        ) : isMicroStep && microSteps ? (
          <MicroSteps steps={microSteps} cfg={cfg} />
        ) : (
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65, margin: 0, minHeight: 46 }}>
            {displayedText}{!done && <Cursor accent={cfg.accent} />}
          </p>
        )}

        {/* Key formula */}
        <AnimatePresence>
          {(currentStep?.keyFormula || (isLast && keyFormula)) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: done ? 0.05 : 0.55 }}
              style={{
                marginTop: 12, padding: '9px 14px',
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)',
                borderRadius: 10, fontSize: 12.5,
                fontFamily: "'JetBrains Mono','Fira Code',monospace",
                color: '#a5b4fc', textAlign: 'center', letterSpacing: '0.02em', wordBreak: 'break-all',
              }}
            >
              {currentStep?.keyFormula || keyFormula}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Memory anchor — final step only */}
        <AnimatePresence>
          {isLast && memoryAnchor && done && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.45, duration: 0.48 }}
              style={{
                marginTop: 14, padding: '11px 14px',
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)',
                borderRadius: 12,
              }}
            >
              <span style={{ display: 'block', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#fbbf24', marginBottom: 5 }}>
                Memory Anchor ★
              </span>
              <p style={{ fontSize: 11, fontStyle: 'italic', color: '#fcd34d', lineHeight: 1.55, margin: 0 }}>
                {memoryAnchor}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default StepPanel;