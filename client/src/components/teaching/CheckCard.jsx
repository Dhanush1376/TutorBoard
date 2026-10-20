import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';

/**
 * "Predict the next step" (checklist 5.1). Shown after a beat that carries a
 * `check`; the lesson waits here until the learner answers and continues.
 * A wrong answer can ask for the explanation on the board (a Phase 4 branch).
 */
export default function CheckCard({ check, answered, onAnswer, onContinue, onExplain }) {
  const [picked, setPicked] = useState(answered ?? null);
  const done = picked !== null;
  // keyboard learners land on the first choice
  const firstChoice = useRef(null);
  useEffect(() => { if (!done) firstChoice.current?.focus({ preventScroll: true }); }, [done]);
  const right = done && picked === check.answer;

  const choose = (i) => {
    if (done) return;
    setPicked(i);
    onAnswer?.(i, i === check.answer);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className="w-[min(560px,92vw)] liquid-glass rounded-3xl p-5 shadow-premium pointer-events-auto"
      role="dialog"
      aria-label="Predict the next step"
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-[var(--text-tertiary)]">
        <Sparkles size={12} className="text-amber-400" />
        Predict the next step
      </div>
      <p className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug mb-4">{check.question}</p>

      <div className="flex flex-col gap-2">
        {check.choices.map((c, i) => {
          const isAnswer = i === check.answer;
          const isPicked = i === picked;
          const tone = !done ? 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
            : isAnswer ? 'border-emerald-500/60 bg-emerald-500/10'
              : isPicked ? 'border-red-500/60 bg-red-500/10' : 'border-[var(--border-color)] opacity-50';
          return (
            <button
              key={i}
              ref={i === 0 ? firstChoice : undefined}
              type="button"
              disabled={done}
              onClick={() => choose(i)}
              className={`flex items-center gap-3 text-left px-4 py-2.5 rounded-2xl border text-[13px] text-[var(--text-primary)] transition-all ${tone} ${done ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'}`}
            >
              <span className="w-5 h-5 shrink-0 rounded-full border border-[var(--border-color)] flex items-center justify-center text-[10px] font-bold">
                {done && isAnswer ? <Check size={12} className="text-emerald-400" /> : done && isPicked ? <X size={12} className="text-red-400" /> : String.fromCharCode(65 + i)}
              </span>
              {c}
            </button>
          );
        })}
      </div>

      {done && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <p className={`text-[13px] font-semibold ${right ? 'text-emerald-400' : 'text-red-400'}`}>
            {right ? 'Right!' : `Not quite — it's “${check.choices[check.answer]}”.`}
          </p>
          {check.explain && <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-relaxed">{check.explain}</p>}
          <div className="flex items-center justify-end gap-2 mt-4">
            {!right && onExplain && (
              <button
                type="button"
                onClick={onExplain}
                className="px-4 py-2 rounded-full border border-[var(--border-color)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all"
              >
                Show me on the board
              </button>
            )}
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[12px] font-semibold hover:opacity-90 active:scale-95 transition-all"
            >
              Continue <ArrowRight size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
