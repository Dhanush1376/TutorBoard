import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, List, Settings, Activity, Info, ChevronRight, Check, Brain, ArrowUp, Zap, Copy, Maximize2, BookOpen, Code2 } from 'lucide-react';
import { ALGO_COLORS } from '../../constants/canvas';

const EASE = [0.16, 1, 0.3, 1];

export function getStateColor(state) {
  return ALGO_COLORS[state] || ALGO_COLORS.default;
}

/**
 * Typewriter hook for smooth concept narration.
 */
export function useTypewriter(text = '', speed = 28, resetKey = 0) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    let i = 0;
    const tick = () => { i++; setCount(i); if (i < text.length) ref.current = setTimeout(tick, speed); };
    ref.current = setTimeout(tick, speed);
    return () => clearTimeout(ref.current);
  }, [text, speed, resetKey]);
  return { displayed: text.slice(0, count), done: count >= text.length };
}

/**
 * Legend component for algorithm states.
 */
export function AlgoLegend({ activeStates = [] }) {
  const LABELS = {
    active: 'Current', comparing: 'Comparing', eliminated: 'Eliminated',
    sorted: 'Sorted', pivot: 'Pivot', found: 'Found',
    visiting: 'Visiting', visited: 'Visited', swapping: 'Swapping', default: 'Unvisited',
  };
  const states = activeStates.length > 0 ? activeStates : ['default', 'active'];
  return (
    <div className="flex flex-wrap gap-3 mt-1">
      {states.map((s) => (
        <motion.div key={s} className="flex items-center gap-1.5 text-[9px]"
          style={{ color: 'var(--text-tertiary)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="w-2 h-2 rounded-full" style={{ background: getStateColor(s).border }} />
          <span className="uppercase tracking-wider">{LABELS[s] || s}</span>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * AlgoRightPanel — Algorithm information panel. Theme-aware.
 */
export function AlgoRightPanel({
  step, stepIndex, totalSteps, variables, activeStates,
  algorithmName, timeline, onGoToStep,
  doubtHistory = [], isDoubtProcessing = false, activeDoubtId = null,
  onJumpToDoubt = null, onPinDoubt = null, onResume = null, onAskDoubt = null,
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const narration = step?.narration || step?.explanation || step?.description || '';
  const { displayed, done } = useTypewriter(narration, 22, stepIndex);

  const stepTitles = useMemo(() => {
    const t = timeline?.timeline || timeline?.steps || [];
    return t.map((s, i) => s.title || `Step ${i + 1}`);
  }, [timeline]);

  useEffect(() => {
    if (isDoubtProcessing || (activeDoubtId && doubtHistory.length > 0)) setActiveTab('doubts');
  }, [isDoubtProcessing, activeDoubtId, doubtHistory.length]);

  useEffect(() => {
    if (scrollRef.current && activeTab === 'doubts')
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [doubtHistory.length, isDoubtProcessing, activeTab]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isDoubtProcessing || !onAskDoubt) return;
    onAskDoubt(input.trim());
    setInput('');
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">

      <div className="flex-1 overflow-y-auto flex flex-col p-5 gap-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-color) transparent' }}>
        {/* Concept */}
        <Section icon={<Lightbulb size={12} />} label="Concept" iconColor="#f59e0b">
          <AnimatePresence mode="wait">
            <motion.p key={`n-${stepIndex}`} className="text-sm leading-relaxed font-light"
              style={{ color: 'var(--text-primary)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {displayed}
              {!done && <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-[2px] h-3 ml-1 align-middle rounded-full" style={{ background: 'var(--text-primary)' }} />}
            </motion.p>
          </AnimatePresence>
        </Section>

        {/* Steps */}
        {stepTitles.length > 0 && (
          <Section icon={<List size={12} />} label="Steps">
            <div className="flex flex-col gap-1">
              {stepTitles.map((title, i) => (
                <motion.button key={i}
                  onClick={() => onGoToStep?.(i)}
                  whileHover={{ x: 4, background: 'rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[11px] transition-all cursor-pointer"
                  style={{
                    background: i === stepIndex ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: i === stepIndex ? 'var(--text-primary)' : i < stepIndex ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    border: i === stepIndex ? '1px solid var(--border-color)' : '1px solid transparent',
                    boxShadow: i === stepIndex ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                  }}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0"
                    style={i === stepIndex ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' }
                      : i < stepIndex ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                        : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                    {i < stepIndex ? <Check size={9} /> : i + 1}
                  </div>
                  <span className="truncate">{title}</span>
                  {i === stepIndex && <ChevronRight size={11} className="ml-auto" style={{ color: 'var(--text-tertiary)' }} />}
                </motion.button>
              ))}
            </div>
          </Section>
        )}

        {/* How it Works */}
        {step?.howItWorks?.length > 0 && (
          <Section icon={<BookOpen size={12} />} label="How it Works" iconColor="#a78bfa">
            <div className="flex flex-col gap-1.5">
              {step.howItWorks.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                  className="flex gap-2.5 p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0"
                    style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{i + 1}</div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s}</p>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* Pseudocode */}
        {step?.pseudocode && (
          <Section icon={<Code2 size={12} />} label="Pseudocode" iconColor="#f59e0b">
            <div className="p-3 rounded-lg font-mono text-[10px] leading-relaxed whitespace-pre overflow-x-auto"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', scrollbarWidth: 'thin' }}>
              {step.pseudocode}
            </div>
          </Section>
        )}

        {/* Complexity */}
        {(step?.timeComplexity || step?.spaceComplexity) && (
          <Section icon={<Zap size={12} />} label="Complexity" iconColor="#f43f5e">
            <div className="grid grid-cols-2 gap-2">
              {step.timeComplexity && (
                  <div className="p-2.5 rounded-lg flex flex-col gap-0.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Time</span>
                  <span className="text-xs font-mono" style={{ color: '#f43f5e' }}>{step.timeComplexity}</span>
                </div>
              )}
              {step.spaceComplexity && (
                <div className="p-2.5 rounded-lg flex flex-col gap-0.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Space</span>
                  <span className="text-xs font-mono" style={{ color: '#3b82f6' }}>{step.spaceComplexity}</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Variables */}
        {variables && Object.keys(variables).length > 0 && (
          <Section icon={<Settings size={12} />} label="Variables" iconColor="#10b981">
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(variables).map(([k, v]) => (
                <motion.div key={k} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                  <motion.span key={`${k}-${v}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    {String(v)}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* Progress */}
        <Section icon={<Activity size={12} />} label="Progress" iconColor="#a78bfa">
          <div className="flex items-center gap-2.5">
            <button className="h-1 flex-1 rounded-full overflow-hidden relative cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                onGoToStep?.(Math.max(0, Math.min(Math.floor(pct * totalSteps), totalSteps - 1)));
              }}>
              <motion.div className="absolute top-0 left-0 h-full rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 10px rgba(167,139,240,0.4)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${((stepIndex + 1) / Math.max(totalSteps, 1)) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease: EASE }} />
            </button>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{stepIndex + 1}/{totalSteps}</span>
          </div>
        </Section>

        {/* Legend */}
        <Section icon={<Info size={12} />} label="Legend">
          <AlgoLegend activeStates={activeStates} />
        </Section>
      </div>
    </div>
  );
}

/* ── Section helper ──────────────────────────────────────── */
function Section({ icon, label, iconColor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}>
        <span style={iconColor ? { color: iconColor } : { color: 'var(--text-tertiary)' }}>{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}
