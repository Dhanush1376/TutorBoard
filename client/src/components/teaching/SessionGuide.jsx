import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb, List, Settings, Activity, Info, ChevronRight, Check, Brain,
  ArrowUp, Zap, Copy, Maximize2, BookOpen, Code2, Eye, Sparkles, Trash2,
  RotateCcw, Play, MessageSquare, Target, BookMarked, X
} from 'lucide-react';
import { ALGO_COLORS } from '../../constants/canvas';

const EASE = [0.16, 1, 0.3, 1];

export function getStateColor(state) {
  return ALGO_COLORS[state] || ALGO_COLORS.default;
}

/**
 * Typewriter hook for smooth concept narration.
 */
export function useTypewriter(text = '', speed = 25, resetKey = 0) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    let i = 0;
    const tick = () => {
      i++;
      setCount(i);
      if (i < text.length) ref.current = setTimeout(tick, speed);
    };
    ref.current = setTimeout(tick, speed);
    return () => clearTimeout(ref.current);
  }, [text, speed, resetKey]);
  return { displayed: text.slice(0, count), done: count >= text.length };
}

/**
 * SessionGuide — Universal pedagogical sidebar. Redesigned with Liquid Glass.
 */
export function SessionGuide({
  step, stepIndex, totalSteps, variables, activeStates,
  algorithmName, timeline, professorNote, onGoToStep,
  doubtHistory = [], isDoubtProcessing = false, activeDoubtId = null,
  onJumpToDoubt = null, onPinDoubt = null, onResume = null, onAskDoubt = null,
  isAlgo = false, onReplay = null, onClose = null
}) {
  const [activeTab, setActiveTab] = useState('guide');
  const scrollRef = useRef(null);

  const narration = step?.narration || step?.explanation || step?.description || '';
  const { displayed, done } = useTypewriter(narration, 18, stepIndex);

  const stepTitles = useMemo(() => {
    const t = timeline?.timeline || timeline?.steps || [];
    return t.map((s, i) => s.title || `Step ${i + 1}`);
  }, [timeline]);

  const progressPercent = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  const isEmpty = !narration && !stepTitles.length && !professorNote;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden select-none">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="px-5 py-1.5 flex items-center justify-between border-b border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Target size={11} />
          </div>
          <div className="flex flex-col gap-0.5">
             <h2 
               className="uppercase tracking-[0.25em] text-[var(--text-primary)] leading-none"
               style={{ fontSize: '13px', fontWeight: 600 }}
             >
               Session
             </h2>
             <span 
               className="font-bold text-indigo-400/90 tracking-[0.15em] leading-none"
               style={{ fontSize: '7px' }}
             >
               {isAlgo ? 'ALGORITHM GUIDE' : 'CONCEPT GUIDE'}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-mono font-bold text-[var(--text-tertiary)]">
            {stepIndex + 1}/{totalSteps || 1}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-[var(--text-tertiary)] hover:text-red-400 border border-transparent hover:border-red-400/20"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col p-5 pb-8 gap-6 custom-scrollbar"
      >
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--text-tertiary)] mb-4 animate-spin-slow" />
            <p className="text-[11px] font-medium uppercase tracking-widest">Analyzing Context</p>
            <p className="text-[9px] mt-2 leading-relaxed max-w-[140px]">The tutor is orchestrating your visual session...</p>
          </div>
        ) : (
          <>
            {/* Professor's Note */}
            {professorNote && (
              <Section icon={<Brain size={12} />} label="Professor's Note" color="#6366f1">
                <div className="p-4 rounded-2xl text-[9.5px] leading-relaxed relative overflow-hidden bg-indigo-500/[0.03] border border-indigo-500/10 shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-indigo-500/50" />
                  <p className="italic text-[var(--text-secondary)]">{professorNote}</p>
                </div>
              </Section>
            )}


            {/* Concept Card */}
            {narration && (
              <Section icon={<Lightbulb size={12} />} label="Explanation" color="#f59e0b">
                <div className="p-4 rounded-2xl bg-amber-500/[0.02] border border-white/5 relative shadow-inner">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-amber-500/40 to-transparent" />
                  <p className="text-[11.5px] leading-[1.7] text-[var(--text-primary)] font-light">
                    {displayed}
                    {!done && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="inline-block w-[1.5px] h-3.5 bg-amber-500 ml-1 align-middle rounded-full"
                      />
                    )}
                  </p>
                </div>
              </Section>
            )}

            {/* Complexity (Algo Only) */}
            {isAlgo && (step?.timeComplexity || step?.spaceComplexity) && (
              <Section icon={<Zap size={12} />} label="Complexity" color="#f43f5e">
                <div className="grid grid-cols-2 gap-2.5">
                  {step.timeComplexity && (
                    <div className="p-3 rounded-2xl bg-rose-500/[0.03] border border-rose-500/10">
                      <span className="text-[8px] uppercase tracking-widest text-rose-500/60 font-bold block mb-1">Time</span>
                      <span className="text-[12px] font-mono font-bold text-rose-500">{step.timeComplexity}</span>
                    </div>
                  )}
                  {step.spaceComplexity && (
                    <div className="p-3 rounded-2xl bg-blue-500/[0.03] border border-blue-500/10">
                      <span className="text-[8px] uppercase tracking-widest text-blue-500/60 font-bold block mb-1">Space</span>
                      <span className="text-[12px] font-mono font-bold text-blue-500">{step.spaceComplexity}</span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Variables (Algo Only) */}
            {isAlgo && variables && Object.keys(variables).length > 0 && (
              <Section icon={<Settings size={12} />} label="State" color="#10b981">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(variables).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[8.5px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold">{k}</span>
                      <span className="text-[10px] font-mono font-bold text-[#10b981]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Step Progress */}
            {stepTitles.length > 0 && (
              <Section icon={<List size={12} />} label="Navigation">
                <div className="flex flex-col gap-1.5">
                  {stepTitles.map((title, i) => {
                    const isActive = i === stepIndex;
                    const isPast = i < stepIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => onGoToStep?.(i)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${isActive ? 'bg-white/5 border-white/10 ring-1 ring-white/5' : 'hover:bg-white/[0.02]'
                          }`}
                        style={{ border: '1px solid transparent' }}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors ${isActive ? 'bg-indigo-500 text-white shadow-lg' : isPast ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-[var(--text-tertiary)]'
                          }`}>
                          {isPast ? <Check size={10} strokeWidth={3} /> : i + 1}
                        </div>
                        <span className={`text-[10.5px] truncate flex-1 ${isActive ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                          {title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      {/* ── Footer Actions ────────────────────────────────────────── */}
      <div className="px-6 py-5 border-t border-white/5 flex items-center gap-3 sf-glass" style={{ background: 'rgba(var(--bg-primary-rgb), 0.5)' }}>
        <button
          onClick={onReplay}
          className="flex-1 apple-pill bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] shadow-sm"
        >
          <RotateCcw size={12} />
          Replay
        </button>
        <button
          onClick={onResume}
          className="flex-1 apple-pill bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] uppercase tracking-widest hover:opacity-90 shadow-premium"
        >
          <Play size={12} fill="currentColor" />
          Resume
        </button>
      </div>
    </div>
  );
}

function Section({ label, icon, children, color = 'var(--text-primary)' }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 opacity-50">
        <div style={{ color }}>{icon}</div>
        <span className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-[var(--text-primary)]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

export function AlgoLegend({ activeStates = [] }) {
  const LABELS = {
    active: 'Current', comparing: 'Comparing', eliminated: 'Eliminated',
    sorted: 'Sorted', pivot: 'Pivot', found: 'Found',
    visiting: 'Visiting', visited: 'Visited', swapping: 'Swapping', default: 'Unvisited',
  };
  const states = activeStates.length > 0 ? activeStates : ['default', 'active'];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {states.map((s) => {
        const color = getStateColor(s).border;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-50" style={{ color: 'var(--text-primary)' }}>
              {LABELS[s] || s}
            </span>
          </div>
        );
      })}
    </div>
  );
}
