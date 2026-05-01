import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, List, Settings, Activity, Info, ChevronRight, Check, Brain, ArrowUp, Zap, Copy, Maximize2 } from 'lucide-react';
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
 * Legend component for algorithm states.
 */
export function AlgoLegend({ activeStates = [] }) {
  const LABELS = {
    active: 'Current / Active',
    comparing: 'Comparing',
    eliminated: 'Eliminated',
    sorted: 'Sorted',
    pivot: 'Pivot',
    found: 'Found',
    visiting: 'Visiting',
    visited: 'Visited',
    swapping: 'Swapping',
    default: 'Unvisited',
  };

  const states = activeStates.length > 0 ? activeStates : ['default', 'active'];

  return (
    <div className="flex flex-wrap gap-3 mt-1">
      {states.map((s) => {
        const c = getStateColor(s);
        return (
          <motion.div
            key={s}
            className="flex items-center gap-2 text-[10px] text-white/70"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: c.border }} />
            <span className="uppercase tracking-wider">{LABELS[s] || s}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * AlgoRightPanel - Immersive information panel for algorithms.
 * Now translucent and theme-aligned.
 */
export function AlgoRightPanel({
  step,
  stepIndex,
  totalSteps,
  variables,
  activeStates,
  algorithmName,
  timeline,
  onGoToStep, 
  // Doubt Integration Props
  doubtHistory = [],
  isDoubtProcessing = false,
  activeDoubtId = null,
  onJumpToDoubt = null,
  onPinDoubt = null,
  onResume = null,
  onAskDoubt = null,
}) {
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'doubts'
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  
  const narration = step?.narration || step?.explanation || step?.description || '';
  const { displayed, done } = useTypewriter(narration, 22, stepIndex);

  // Extract steps list from timeline
  const stepTitles = useMemo(() => {
    const t = timeline?.timeline || timeline?.steps || [];
    return t.map((s, i) => s.title || `Step ${i + 1}`);
  }, [timeline]);

  // Auto-switch to doubts tab when a new doubt is processing or exists
  useEffect(() => {
    if (isDoubtProcessing || (activeDoubtId && doubtHistory.length > 0)) {
      setActiveTab('doubts');
    }
  }, [isDoubtProcessing, activeDoubtId, doubtHistory.length]);

  // Auto-scroll on new doubts
  useEffect(() => {
    if (scrollRef.current && activeTab === 'doubts') {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [doubtHistory.length, isDoubtProcessing, activeTab]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isDoubtProcessing || !onAskDoubt) return;
    onAskDoubt(input.trim());
    setInput('');
  };

  return (
    <div className="fixed top-24 right-6 bottom-32 w-[340px] flex flex-col bg-[#0d0d14]/80 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto overflow-hidden z-[80]">
      {/* ── Tabs ── */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10 shrink-0 bg-white/5">
        <button 
          onClick={() => setActiveTab('info')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'info' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          Lesson
        </button>
        <button 
          onClick={() => setActiveTab('doubts')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'doubts' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          Doubts {doubtHistory.length > 0 && `(${doubtHistory.length})`}
        </button>

        {activeTab === 'doubts' && onResume && (
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
            onClick={onResume}
            title="Resume Lesson"
          >
            <ChevronRight size={12} strokeWidth={3} />
            <span>Resume</span>
          </motion.button>
        )}
      </div>

      {/* ── Mini Timeline (Integrated DoubtTimeline) ── */}
      {activeTab === 'doubts' && doubtHistory.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] opacity-60">
            Timeline
          </span>
          <div className="h-px flex-1 bg-[var(--border-color)]/20" />
          <div className="flex items-center gap-1.5">
            {doubtHistory.map((d, i) => (
              <motion.button
                key={d.id || i}
                onClick={() => onJumpToDoubt?.(d.id)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  activeDoubtId === d.id ? 'bg-[var(--text-primary)] scale-125' : 'bg-[var(--text-tertiary)] opacity-30 hover:opacity-60'
                }`}
                whileHover={{ scale: 1.4 }}
              />
            ))}
          </div>
        </div>
      )}


      <AnimatePresence mode="wait">
        {activeTab === 'info' ? (
          <motion.div
            key="info-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-5 gap-8"
          >
            {/* ── Concept ── */}
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">
                <Lightbulb size={13} className="text-amber-400" />
                Concept
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`narr-${stepIndex}`}
                  className="text-sm leading-relaxed text-white/95 font-light"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {displayed}
                  {!done && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 14,
                        background: 'var(--text-primary)',
                        marginLeft: 4,
                        verticalAlign: 'middle',
                        borderRadius: 1,
                      }}
                    />
                  )}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* ── Steps list ── */}
            {stepTitles.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">
                  <List size={13} className="text-blue-400" />
                  Steps
                </span>
                <div className="flex flex-col gap-1.5">
                  {stepTitles.slice(0, 12).map((title, i) => (
                    <motion.button
                      key={i}
                      onClick={() => {
                        if (i === stepIndex) {
                          if (onGoToStep && i < totalSteps - 1) onGoToStep(i + 1);
                        } else {
                          onGoToStep?.(i);
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all text-[11px] border border-transparent group ${
                        i === stepIndex ? 'bg-white/10 border-white/10 text-white shadow-sm' : i < stepIndex ? 'text-white/60 hover:bg-white/5' : 'text-white/40 hover:bg-white/5'
                      }`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 text-[10px] transition-colors ${
                          i === stepIndex
                            ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                            : i < stepIndex
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-white/40'
                        }`}
                      >
                        {i < stepIndex ? <Check size={10} strokeWidth={4} /> : i + 1}
                      </div>
                      <span className="truncate">{title}</span>
                      {i === stepIndex && (
                        <motion.div
                          layoutId="active-step-indicator"
                          className="ml-auto"
                        >
                          <ChevronRight size={12} className="text-white/50" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Variables ── */}
            {variables && Object.keys(variables).length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">
                  <Settings size={13} className="text-emerald-400" />
                  Variables
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(variables).map(([k, v]) => (
                    <motion.div
                      key={k}
                      className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl border border-white/5"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">{k}</span>
                      <motion.span
                        className="text-xs font-mono text-white bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10"
                        key={`${k}-${v}`}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.35 }}
                      >
                        {String(v)}
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Progress ── */}
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">
                <Activity size={13} className="text-purple-400" />
                Progress
              </span>
              <div className="flex items-center gap-3">
                <button 
                  className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group/track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const pct = x / rect.width;
                    const target = Math.floor(pct * totalSteps);
                    onGoToStep?.(Math.max(0, Math.min(target, totalSteps - 1)));
                  }}
                >
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-purple-500 rounded-full"
                    animate={{ width: `${((stepIndex + 1) / Math.max(totalSteps, 1)) * 100}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </button>
                <span className="text-[10px] text-white/50 font-mono font-bold">
                  {stepIndex + 1}/{totalSteps}
                </span>
              </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex flex-col gap-2 mt-auto">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">
                <Info size={13} className="text-slate-400" />
                Legend
              </span>
              <AlgoLegend activeStates={activeStates} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="doubts-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4"
            >
              {doubtHistory.length === 0 && !isDoubtProcessing ? (
                <div className="text-center py-12 px-4 m-auto">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 opacity-50">
                    <Lightbulb size={24} className="text-white/50" />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">
                    No doubts asked yet
                  </p>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Ask anything about the algorithm or current state.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {doubtHistory.map((doubt, i) => (
                    <motion.div
                      key={doubt.id || i}
                      className={`flex flex-col gap-2 p-3 bg-white/5 rounded-2xl border border-white/5 transition-all ${activeDoubtId === doubt.id ? 'ring-1 ring-purple-500/50 bg-white/10' : ''}`}
                      onClick={() => onJumpToDoubt?.(doubt.id)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="text-xs text-white/90 bg-black/40 p-3 rounded-xl border border-white/10 relative group/q">
                        <span className="absolute -top-2 left-2 text-[8px] font-bold uppercase tracking-widest text-purple-400 bg-[#161622] px-1">YOU</span>
                        {doubt.question}
                        <div className="absolute right-2 top-2 opacity-0 group-hover/q:opacity-100 transition-opacity flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onJumpToDoubt?.(doubt.id); }}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all"
                            title="Jump to Context"
                          >
                            <Maximize2 size={10} />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2 group/a">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
                          <Brain size={12} className="text-blue-400" />
                        </div>
                        <div className="flex-1 relative space-y-2 pt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">TUTOR</span>
                            <div className="flex gap-1 opacity-0 group-hover/a:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); onPinDoubt?.(doubt.id); }}
                                className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-amber-400 transition-all"
                                title="Pin to Canvas"
                              >
                                <Zap size={10} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(doubt.answer); }}
                                className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                                title="Copy Answer"
                              >
                                <Copy size={10} />
                              </button>
                            </div>
                          </div>

                          <div className="text-[12px] leading-relaxed text-white/80">
                            {doubt.answer || "Processing..."}
                          </div>

                          {doubt.followUp && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 italic text-[11px] text-blue-200/80"
                            >
                              <span className="not-italic font-bold text-[8px] uppercase tracking-wider opacity-60 block mb-1">Deep Dive:</span>
                              "{doubt.followUp}"
                              <button 
                                onClick={() => onAskDoubt?.(doubt.followUp)}
                                className="mt-1.5 block text-[9px] text-blue-400 hover:text-blue-300 not-italic font-bold uppercase tracking-wider"
                              >
                                Ask this →
                              </button>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isDoubtProcessing && (
                    <motion.div
                      className="p-3 bg-white/5 rounded-2xl border border-white/5 opacity-60"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 animate-spin">
                          <Activity size={12} className="text-blue-400" />
                        </div>
                        <div className="italic text-xs text-white/60 pt-1">Analyzing algorithm state...</div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 shrink-0">
              <form 
                onSubmit={handleSubmit}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this step..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-white/30"
                  disabled={isDoubtProcessing}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isDoubtProcessing}
                  className="w-9 h-9 flex shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white disabled:opacity-50 disabled:bg-white/10 transition-all hover:bg-purple-400"
                >
                  <ArrowUp size={16} strokeWidth={3} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
