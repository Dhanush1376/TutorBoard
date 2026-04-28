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
    <div className="algo-legend">
      {states.map((s) => {
        const c = getStateColor(s);
        return (
          <motion.div
            key={s}
            className="algo-legend__item"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="algo-legend__dot" style={{ background: c.border }} />
            <span>{LABELS[s] || s}</span>
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
    <div className="algo-info">
      {/* ── Tabs ── */}
      <div className="algo-tabs">
        <button 
          onClick={() => setActiveTab('info')}
          className={`algo-tab ${activeTab === 'info' ? 'algo-tab--active' : ''}`}
        >
          Lesson
        </button>
        <button 
          onClick={() => setActiveTab('doubts')}
          className={`algo-tab ${activeTab === 'doubts' ? 'algo-tab--active' : ''}`}
        >
          Doubts {doubtHistory.length > 0 && `(${doubtHistory.length})`}
        </button>

        {activeTab === 'doubts' && onResume && (
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="algo-resume-tab-action active:scale-95"
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
            className="flex flex-col gap-8"
          >
            {/* ── Concept ── */}
            <div className="algo-info__section">
              <span className="algo-info__section-title">
                <Lightbulb size={13} className="text-amber-400" />
                Concept
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`narr-${stepIndex}`}
                  className="algo-info__narration"
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
                        height: 11,
                        background: 'var(--text-primary)',
                        marginLeft: 2,
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
              <div className="algo-info__section">
                <span className="algo-info__section-title">
                  <List size={13} className="text-blue-400" />
                  Steps
                </span>
                <div className="algo-info__steps">
                  {stepTitles.slice(0, 12).map((title, i) => (
                    <motion.button
                      key={i}
                      onClick={() => {
                        if (i === stepIndex) {
                          // If clicking the current step, go to next step
                          if (onGoToStep && i < totalSteps - 1) onGoToStep(i + 1);
                        } else {
                          onGoToStep?.(i);
                        }
                      }}
                      className={`algo-info__step group ${
                        i === stepIndex ? 'algo-info__step--active' : i < stepIndex ? 'algo-info__step--done' : ''
                      }`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                    >
                      <div
                        className={`algo-info__step-num ${
                          i === stepIndex
                            ? 'algo-info__step-num--active'
                            : i < stepIndex
                            ? 'algo-info__step-num--done'
                            : ''
                        }`}
                      >
                        {i < stepIndex ? <Check size={10} strokeWidth={4} /> : i + 1}
                      </div>
                      <span className="algo-info__step-label">{title}</span>
                      {i === stepIndex && (
                        <motion.div
                          layoutId="active-step-indicator"
                          className="ml-auto"
                        >
                          <ChevronRight size={12} className="text-[var(--text-primary)] opacity-50" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Variables ── */}
            {variables && Object.keys(variables).length > 0 && (
              <div className="algo-info__section">
                <span className="algo-info__section-title">
                  <Settings size={13} className="text-emerald-400" />
                  Variables
                </span>
                <div className="algo-info__variables">
                  {Object.entries(variables).map(([k, v]) => (
                    <motion.div
                      key={k}
                      className="algo-info__var"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="algo-info__var-name">{k}</span>
                      <motion.span
                        className="algo-info__var-value"
                        key={`${k}-${v}`}
                        initial={{ scale: 1.2, color: 'var(--text-primary)' }}
                        animate={{ scale: 1, color: 'var(--text-primary)' }}
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
            <div className="algo-info__section">
              <span className="algo-info__section-title">
                <Activity size={13} className="text-purple-400" />
                Progress
              </span>
              <div className="algo-info__progress-row">
                <button 
                  className="algo-info__progress-track group/track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const pct = x / rect.width;
                    const target = Math.floor(pct * totalSteps);
                    onGoToStep?.(Math.max(0, Math.min(target, totalSteps - 1)));
                  }}
                >
                  <motion.div
                    className="algo-info__progress-fill"
                    animate={{ width: `${((stepIndex + 1) / Math.max(totalSteps, 1)) * 100}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </button>
                <span className="algo-info__progress-label">
                  {stepIndex + 1}/{totalSteps}
                </span>
              </div>
            </div>

            {/* ── Legend ── */}
            <div className="algo-info__section">
              <span className="algo-info__section-title">
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
            className="flex flex-col gap-6"
          >
            <div 
              ref={scrollRef}
              className="algo-doubt-list custom-scrollbar"
              style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}
            >
              {doubtHistory.length === 0 && !isDoubtProcessing ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-4 opacity-30">
                    <Lightbulb size={24} className="text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] opacity-60 mb-2">
                    No doubts asked yet
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                    Ask anything about the algorithm or current state.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {doubtHistory.map((doubt, i) => (
                    <motion.div
                      key={doubt.id || i}
                      className={`algo-doubt-item ${activeDoubtId === doubt.id ? 'algo-doubt-item--active' : ''}`}
                      onClick={() => onJumpToDoubt?.(doubt.id)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="algo-doubt-item__q-bubble group/q">
                        <span className="algo-doubt-item__q-label">YOU</span>
                        {doubt.question}
                        <div className="absolute right-2 top-2 opacity-0 group-hover/q:opacity-100 transition-opacity flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onJumpToDoubt?.(doubt.id); }}
                            className="p-1 rounded-md bg-black/20 hover:bg-black/40 text-[var(--bg-primary)] transition-all"
                            title="Jump to Context"
                          >
                            <Maximize2 size={10} />
                          </button>
                        </div>
                      </div>

                      <div className="algo-doubt-item__a-bubble group/a">
                        <div className="algo-doubt-item__icon">
                          <Brain size={10} className="text-[var(--text-primary)]" />
                        </div>
                        <div className="flex-1 relative space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="algo-doubt-item__a-label">TUTOR</span>
                            <div className="flex gap-1 opacity-0 group-hover/a:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); onPinDoubt?.(doubt.id); }}
                                className="p-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-amber-400 transition-all"
                                title="Pin to Canvas"
                              >
                                <Zap size={10} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(doubt.answer); }}
                                className="p-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                title="Copy Answer"
                              >
                                <Copy size={10} />
                              </button>
                            </div>
                          </div>

                          <div className="text-[13px] leading-relaxed">
                            {doubt.answer || "Processing..."}
                          </div>

                          {doubt.followUp && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 p-2 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 italic text-[11px] text-[var(--text-secondary)]"
                            >
                              <span className="not-italic font-bold text-[8px] uppercase tracking-wider opacity-50 block mb-1">Deep Dive:</span>
                              "{doubt.followUp}"
                              <button 
                                onClick={() => onAskDoubt?.(doubt.followUp)}
                                className="mt-1 block text-[9px] text-[var(--text-primary)] hover:underline not-italic font-bold uppercase tracking-wider"
                              >
                                Ask this →
                              </button>
                            </motion.div>
                          )}

                          {activeDoubtId === doubt.id && (
                            <motion.div 
                              layoutId="active-doubt-highlight"
                              className="absolute -left-2 top-0 bottom-0 w-0.5 bg-[var(--text-primary)] rounded-full shadow-[0_0_8px_var(--text-primary)]"
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isDoubtProcessing && (
                    <motion.div
                      className="algo-doubt-item opacity-60"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <div className="algo-doubt-item__a-bubble">
                        <div className="algo-doubt-item__icon animate-spin">
                          <Activity size={10} />
                        </div>
                        <div className="italic">Analyzing algorithm state...</div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-[var(--border-color)]/20 flex flex-col gap-3">
              <form 
                onSubmit={handleSubmit}
                className="algo-doubt-input-wrapper"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this step..."
                  className="algo-doubt-input"
                  disabled={isDoubtProcessing}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isDoubtProcessing}
                  className="algo-doubt-send"
                >
                  <ArrowUp size={14} />
                </button>
              </form>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
