import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Check, X, Target, MessageSquare, Brain, Pin, PinOff
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { formatConciseTopic } from '../chat/message/MessageUtils';

const EASE = [0.16, 1, 0.3, 1];
const AUTO_DISMISS_SECONDS = 10;

/**
 * SessionGuide — Ultra-refined, distraction-free step navigator & narrative HUD.
 * - Interactive step numbers track (1, 2, 3...)
 * - Step content/narration previews on hover
 * - Auto-activates on step advance with subtle progress bar & pause-on-hover
 * - Top arrow toggle button unfolds all step titles (roadmap)
 * - Zero bulky static boxes, zero redundant replay/resume buttons
 * - Styled in warm orange & white matching TutorBoard design system
 */
export function SessionGuide({
  step, stepIndex, totalSteps,
  algorithmName, timeline, professorNote, onGoToStep,
  doubtHistory = [], isDoubtProcessing = false, activeDoubtId = null,
  onClose = null,
  checkCard = null
}) {
  const [showAllTitles, setShowAllTitles] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isExplainingActive, setIsExplainingActive] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [remainingSec, setRemainingSec] = useState(AUTO_DISMISS_SECONDS);

  const countdownIntervalRef = useRef(null);

  // Normalize all steps from timeline or props with strict dot removal
  const stepsList = useMemo(() => {
    const raw = timeline?.timeline || timeline?.steps || [];
    const count = Math.max(raw.length, totalSteps || 0, 1);
    
    return Array.from({ length: count }, (_, i) => {
      const s = raw[i] || {};
      const rawTitle = s.title || `Step ${i + 1}`;
      const narration = s.narration || s.explanation || s.description || (i === stepIndex ? (step?.narration || step?.explanation || '') : '');
      
      return {
        index: i,
        title: rawTitle.replace(/\.+/g, '').trim(),
        narration: narration ? narration.replace(/\.+$/g, '').trim() : '',
      };
    });
  }, [timeline, step, stepIndex, totalSteps]);

  // Handle auto-activation and timer on step change
  useEffect(() => {
    setIsExplainingActive(true);
    setRemainingSec(AUTO_DISMISS_SECONDS);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSec((prev) => {
        // If pinned or user is reading (hovering over card), freeze timer
        if (isPinned || isCardHovered) return prev;
        if (prev <= 1) {
          setIsExplainingActive(false);
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [stepIndex, isPinned, isCardHovered]);

  // Which step is currently previewed: user hover takes priority; otherwise active step if explaining or pinned
  const isFlyoutActive = hoveredIndex !== null || isPinned || isExplainingActive;
  const previewIndex = hoveredIndex !== null ? hoveredIndex : (isFlyoutActive ? stepIndex : null);
  const previewStep = previewIndex !== null && stepsList[previewIndex] ? stepsList[previewIndex] : null;

  // Active doubt handling
  const pendingDoubt = useTutorStore((s) => s.pendingDoubt);
  const activeDoubt = activeDoubtId ? doubtHistory.find((d) => d.id === activeDoubtId) : null;
  const showDoubt = (isDoubtProcessing && pendingDoubt) || activeDoubt;

  const currentTopic = formatConciseTopic(algorithmName || timeline?.title || 'Session').replace(/\.+/g, '');

  return (
    <div className="w-full flex flex-col overflow-hidden select-none text-white">
      {/* ── Compact Top Bar ─────────────────────────────────────────── */}
      <div 
        className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/10"
        style={{ background: 'rgba(255, 255, 255, 0.02)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#ea580c]/20 border border-[#fb923c]/40 flex items-center justify-center text-[#fb923c] shrink-0">
            <Target size={13} strokeWidth={2.2} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-[12.5px] font-semibold text-white leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
              {currentTopic}
            </h2>
            <span className="text-[10px] text-white/40 font-mono px-1.5 py-0.5 rounded bg-white/5 shrink-0">
              {stepIndex + 1}/{stepsList.length}
            </span>
          </div>
        </div>

        {/* Controls: Arrow Toggle for All Step Titles + Close button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowAllTitles((prev) => !prev)}
            title={showAllTitles ? 'Hide step titles' : 'Show all step titles'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all border ${
              showAllTitles 
                ? 'bg-[#ea580c]/20 border-[#fb923c]/40 text-[#fb923c]' 
                : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/70 hover:text-white'
            }`}
          >
            <span>Titles</span>
            <motion.div animate={{ rotate: showAllTitles ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={13} />
            </motion.div>
          </button>
          
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close guide"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-90"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Dropdown: All Step Titles (Opened by the top arrow button) ── */}
      <AnimatePresence>
        {showAllTitles && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden border-b border-white/10 bg-black/50"
          >
            <div className="p-2 max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#fb923c]">
                  All Step Titles
                </span>
                <span className="text-[9.5px] text-white/40">Click to jump</span>
              </div>
              {stepsList.map((s, i) => {
                const isActive = i === stepIndex;
                const isPast = i < stepIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onGoToStep?.(i);
                      setIsExplainingActive(true);
                      setShowAllTitles(false);
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition-all ${
                      isActive 
                        ? 'bg-[#ea580c]/20 border border-[#fb923c]/40 text-white font-medium' 
                        : 'hover:bg-white/5 text-white/70 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive 
                        ? 'bg-[#ea580c] text-white shadow-[0_0_8px_rgba(234,88,12,0.5)]' 
                        : isPast 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-white/10 text-white/50'
                    }`}>
                      {isPast ? <Check size={10} strokeWidth={3} /> : i + 1}
                    </div>
                    <span className="text-[11.5px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active Doubt Section (if learner asked a question) ────────── */}
      <AnimatePresence>
        {showDoubt && (
          <motion.div
            key={activeDoubt?.id || 'pending-doubt'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 border-b border-white/10 overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-white text-[11.5px] leading-relaxed">
              <div className="flex items-center gap-1.5 text-[#fb923c] text-[10.5px] font-semibold mb-1">
                <MessageSquare size={12} />
                <span>Question at Step {(activeDoubt?.stepIndex ?? stepIndex) + 1}</span>
              </div>
              <p className="italic text-white/80 mb-1.5">“{activeDoubt?.question || pendingDoubt}”</p>
              {activeDoubt ? (
                <p className="text-white font-normal">{activeDoubt.answer}</p>
              ) : (
                <p className="text-white/50 text-[10.5px]">Analyzing this step on canvas...</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Professor Note (if present) ───────────────────────────────── */}
      {professorNote && (
        <div className="px-3 pt-2.5">
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2 text-[10.5px] leading-relaxed text-white/80">
            <Brain size={12} className="text-[#fb923c] shrink-0 mt-0.5" />
            <p className="italic">{professorNote.replace(/\.+/g, '')}</p>
          </div>
        </div>
      )}

      {/* ── Step Numbers Track (The core requested feature) ──────────── */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10.5px] text-white/45 px-0.5">
          <span>Steps</span>
          <span className="text-[9.5px] text-white/35">Hover to peek • Click to jump</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {stepsList.map((s, i) => {
            const isActive = i === stepIndex;
            const isPast = i < stepIndex;
            const isHovered = i === hoveredIndex;

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onGoToStep?.(i);
                  setIsExplainingActive(true);
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative flex items-center justify-center min-w-[32px] h-[32px] px-2 rounded-xl font-semibold text-[12.5px] transition-all duration-200 select-none ${
                  isActive
                    ? 'bg-[#ea580c] text-white shadow-[0_0_12px_rgba(234,88,12,0.45)] ring-2 ring-[#fb923c]/40 scale-105'
                    : isHovered
                      ? 'bg-white/15 text-white scale-105 border border-white/20'
                      : isPast
                        ? 'bg-white/5 text-emerald-400 hover:bg-white/10 border border-emerald-500/20'
                        : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
                title={`Step ${i + 1}: ${s.title}`}
              >
                {isPast ? (
                  <span className="flex items-center gap-0.5">
                    <Check size={10} strokeWidth={3} />
                    <span className="text-[10.5px] opacity-80">{i + 1}</span>
                  </span>
                ) : (
                  <span>{i + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Predict the next step (CheckCard docked on the side, never on canvas) ── */}
      <AnimatePresence>
        {checkCard && (
          <motion.div
            key="side-check-card"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="px-3 pb-3"
          >
            {checkCard}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step Content Flyout (Visible on hover & auto-activated during explaining) ── */}
      <AnimatePresence initial={false}>
        {previewStep && (
          <motion.div
            key={previewStep.index}
            initial={{ opacity: 0, y: 10, scale: 0.98, height: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, y: 8, scale: 0.98, height: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="px-3 pb-3 overflow-hidden"
            onMouseEnter={() => setIsCardHovered(true)}
            onMouseLeave={() => setIsCardHovered(false)}
          >
            <div 
              className="relative p-3 rounded-2xl border transition-all duration-300 overflow-hidden"
              style={{
                background: previewStep.index === stepIndex ? 'rgba(234, 88, 12, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: previewStep.index === stepIndex ? 'rgba(251, 146, 60, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                boxShadow: previewStep.index === stepIndex ? '0 0 16px rgba(234, 88, 12, 0.12)' : 'none',
              }}
            >
              {/* Header inside flyout: step badge, title, pin toggle, close */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#fb923c] shrink-0">
                    STEP {previewStep.index + 1}
                  </span>
                  <span className="text-[12px] font-semibold text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {previewStep.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Pin button */}
                  {hoveredIndex === null && (
                    <button
                      type="button"
                      onClick={() => setIsPinned((prev) => !prev)}
                      title={isPinned ? 'Unpin explanation' : 'Keep visible'}
                      className={`p-1 rounded-lg transition-all active:scale-90 ${
                        isPinned ? 'text-[#fb923c] bg-white/10' : 'text-white/35 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                    </button>
                  )}

                  {/* Close / Minimize button */}
                  {hoveredIndex === null && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsExplainingActive(false);
                        setIsPinned(false);
                      }}
                      title="Minimize preview"
                      className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all active:scale-90"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Narration content */}
              {previewStep.narration ? (
                <p className="text-[11.5px] leading-relaxed text-white/85 font-light">
                  {previewStep.narration}
                </p>
              ) : (
                <p className="text-[10.5px] text-white/40 italic">
                  Interactive visual step loaded on canvas.
                </p>
              )}

              {/* Auto-dismiss subtle progress line (only on active step when not pinned and not hovered) */}
              {previewStep.index === stepIndex && isExplainingActive && !isPinned && !isCardHovered && remainingSec > 0 && (
                <div className="mt-2.5 h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#ea580c] to-[#fb923c]"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(remainingSec / AUTO_DISMISS_SECONDS) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized toggle button when flyout is closed */}
      <AnimatePresence>
        {!previewStep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="px-3 pb-2.5 flex justify-center"
          >
            <button
              type="button"
              onClick={() => setIsExplainingActive(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[11px] font-medium transition-all cursor-pointer active:scale-95 border border-white/5 hover:border-white/10"
            >
              <span>Show step explanation</span>
              <ChevronDown size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SessionGuide;

