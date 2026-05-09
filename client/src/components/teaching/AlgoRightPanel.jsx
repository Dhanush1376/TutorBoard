import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, List, Settings, Activity, Info, ChevronRight, Check, Brain, ArrowUp, Zap, Copy, Maximize2, BookOpen, Code2, Eye } from 'lucide-react';
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
 * Legend component for algorithm states — redesigned as compact colored chips.
 */
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

/**
 * AlgoRightPanel — Algorithm information panel. Premium redesign.
 */
export function AlgoRightPanel({
  step, stepIndex, totalSteps, variables, activeStates,
  algorithmName, timeline, onGoToStep,
  doubtHistory = [], isDoubtProcessing = false, activeDoubtId = null,
  onJumpToDoubt = null, onPinDoubt = null, onResume = null, onAskDoubt = null,
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [input, setInput] = useState('');
  const [expandedStep, setExpandedStep] = useState(null);
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

  const progressPercent = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col p-5 pb-8 gap-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-color) transparent' }}>
        
        {/* ── Concept Card — Elevated with accent border ──────────────── */}
        <Section icon={<Lightbulb size={12} />} label="Concept" iconColor="#f59e0b">
          <motion.div 
            className="relative rounded-[24px] overflow-hidden"
            style={{ 
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Accent top edge */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
            <div className="px-4 py-3.5">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={`n-${stepIndex}`} 
                  className="text-[12.5px] leading-[1.7] font-light"
                  style={{ color: 'var(--text-primary)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  {displayed}
                  {!done && <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-[2px] h-3.5 ml-1 align-middle rounded-full" style={{ background: '#f59e0b' }} />}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        </Section>

        {/* ── Steps — Interactive stepper ────────────────────────────── */}
        {stepTitles.length > 0 && (
          <Section label="Steps">
            <div className="flex flex-col gap-1.5">
              {stepTitles.map((title, i) => {
                const isActive = i === stepIndex;
                const isCompleted = i < stepIndex;
                
                return (
                  <motion.button 
                    key={i}
                    onClick={() => onGoToStep?.(i)}
                    className="group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer overflow-hidden"
                    style={{
                      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                      border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                    }}
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                  >
                    {/* Active dynamic indicator bar */}
                    {isActive && (
                      <motion.div 
                        layoutId="step-active-indicator"
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: 'var(--text-primary)' }}
                      />
                    )}
                    
                    {/* Step badge */}
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors"
                      style={
                        isActive ? { 
                          background: 'var(--text-primary)', 
                          color: 'var(--bg-primary)',
                        }
                        : isCompleted ? { 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          color: '#10b981',
                        }
                        : { 
                          background: 'var(--bg-tertiary)', 
                          color: 'var(--text-tertiary)',
                        }
                      }
                    >
                      {isCompleted ? <Check size={11} strokeWidth={3} /> : i + 1}
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      <span 
                        className="block truncate text-[12px] font-medium transition-colors duration-300"
                        style={{ 
                          color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                          opacity: isActive ? 1 : 0.6
                        }}
                      >
                        {title}
                      </span>
                    </div>

                    {/* Simple chevron for active */}
                    {isActive && (
                      <ChevronRight size={14} className="opacity-40" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── How it Works — Numbered cards with connecting line ───── */}
        {step?.howItWorks?.length > 0 && (
          <Section icon={<BookOpen size={12} />} label="How it Works" iconColor="#a78bfa">
            <div className="flex flex-col gap-0 relative">
              {/* Connecting line */}
              <div 
                className="absolute left-[11px] top-4 bottom-4 w-[1.5px]"
                style={{ background: 'linear-gradient(180deg, #a78bfa40, #a78bfa10)' }}
              />
              {step.howItWorks.map((s, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 6 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-3 py-2 relative"
                >
                  <div 
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] shrink-0 relative z-10 font-medium"
                    style={{ background: 'var(--bg-secondary)', border: '2px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
                  >
                    {i + 1}
                  </div>
                  <p 
                    className="text-[11px] leading-relaxed pt-[3px]" 
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {s}
                  </p>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Pseudocode — Code block with header ────────────────────── */}
        {step?.pseudocode && (
          <Section icon={<Code2 size={12} />} label="Pseudocode" iconColor="#f59e0b">
            <div 
              className="rounded-[24px] overflow-hidden"
              style={{ border: '1px solid var(--border-color)' }}
            >
              <div 
                className="flex items-center justify-between px-3 py-1.5"
                style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444', opacity: 0.5 }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b', opacity: 0.5 }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#10b981', opacity: 0.5 }} />
                </div>
                <span className="text-[8px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>pseudo</span>
              </div>
              <div 
                className="p-3.5 font-mono text-[10px] leading-[1.7] whitespace-pre overflow-x-auto"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', scrollbarWidth: 'thin' }}
              >
                {step.pseudocode}
              </div>
            </div>
          </Section>
        )}

        {/* ── Complexity — Side-by-side metric cards ────────────────── */}
        {(step?.timeComplexity || step?.spaceComplexity) && (
          <Section icon={<Zap size={12} />} label="Complexity" iconColor="#f43f5e">
            <div className="grid grid-cols-2 gap-2">
              {step.timeComplexity && (
                <motion.div 
                  className="p-3 rounded-2xl relative overflow-hidden"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f43f5e, #f43f5e60)' }} />
                  <span className="text-[8px] uppercase tracking-widest font-medium block mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Time</span>
                  <span className="text-[13px] font-mono font-semibold" style={{ color: '#f43f5e' }}>{step.timeComplexity}</span>
                </motion.div>
              )}
              {step.spaceComplexity && (
                <motion.div 
                  className="p-3 rounded-2xl relative overflow-hidden"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #3b82f6, #3b82f660)' }} />
                  <span className="text-[8px] uppercase tracking-widest font-medium block mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Space</span>
                  <span className="text-[13px] font-mono font-semibold" style={{ color: '#3b82f6' }}>{step.spaceComplexity}</span>
                </motion.div>
              )}
            </div>
          </Section>
        )}

        {/* ── Variables — Redesigned as tag grid ────────────────────── */}
        {variables && Object.keys(variables).length > 0 && (
          <Section icon={<Settings size={12} />} label="Variables" iconColor="#10b981">
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(variables).map(([k, v]) => (
                <motion.div 
                  key={k} 
                  className="flex items-center justify-between px-3 py-2 rounded-2xl"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                >
                  <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                  <motion.span 
                    key={`${k}-${v}`} 
                    initial={{ scale: 1.2, color: '#10b981' }} 
                    animate={{ scale: 1, color: 'var(--text-primary)' }}
                    className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                  >
                    {String(v)}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Progress — Sleek gradient bar with interactive scrubbing ── */}
        <Section label="Progress">
          <div className="flex items-center gap-4">
            <div 
              className="h-1 flex-1 rounded-full overflow-hidden relative cursor-pointer group bg-white/5"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                onGoToStep?.(Math.max(0, Math.min(Math.floor(pct * totalSteps), totalSteps - 1)));
              }}
            >
              {/* Progress Bar */}
              <motion.div 
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ 
                  background: 'var(--text-primary)',
                  opacity: 0.6
                }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: EASE }} 
              />
            </div>
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
              {stepIndex + 1} <span className="opacity-40">/ {totalSteps}</span>
            </span>
          </div>
        </Section>

        {/* ── Legend — Styled chips ────────────────────────────────── */}
        <Section icon={<Eye size={12} />} label="Legend">
          <AlgoLegend activeStates={activeStates} />
        </Section>
      </div>
    </div>
  );
}

/* ── Section helper — Redesigned with subtle left accent ─────── */
function Section({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-50" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}
