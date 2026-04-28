import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'framer-motion';

interface KaTeXRendererProps {
  timeline: {
    title?: string;
    topic?: string;
    elements?: any[];
    timeline?: any[];
    steps?: any[];
  };
  currentStepIndex: number;
}

export default function KaTeXRenderer({ timeline, currentStepIndex }: KaTeXRendererProps) {
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const elements = timeline?.elements || [];

  // Filter elements that should be displayed in the current step
  const visibleElements = elements.filter(el => {
    if (!el.type || (el.type !== 'equation' && el.type !== 'math')) return false;
    if (el.stepIndex !== undefined && el.stepIndex > currentStepIndex) return false;
    return true;
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[var(--bg-primary)] p-8 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-12 z-10">
        <AnimatePresence mode="popLayout">
          {visibleElements.map((el, idx) => (
            <motion.div
              key={el.id || idx}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={`p-6 rounded-2xl ${el.highlight ? 'bg-blue-500/10 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : ''}`}
            >
              <Equation tex={el.content || el.label || ''} displayMode={true} />
              {el.annotation && (
                <p className="text-xs text-blue-400/80 font-mono mt-3 text-center tracking-wider">
                  // {el.annotation}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Narrative Context (Premium Overlay) */}
      <motion.div 
        key={currentStepIndex}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-2xl p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl z-20"
      >
        <div className="flex items-center space-y-1 mb-3">
          <div className="w-1 h-4 bg-blue-500 rounded-full mr-3" />
          <h3 className="text-[10px] font-semibold text-blue-400 uppercase tracking-[0.2em]">Step {currentStepIndex + 1}: Derivation Logic</h3>
        </div>
        <p className="text-lg text-white/90 leading-relaxed font-light">
          {currentStep.narration || currentStep.explanation || "Analyzing mathematical relationships..."}
        </p>
      </motion.div>
    </div>
  );
}

interface EquationProps {
  tex: string;
  displayMode?: boolean;
}

function Equation({ tex, displayMode = false }: EquationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(tex, containerRef.current, {
          throwOnError: false,
          displayMode: displayMode,
          trust: true,
          strict: false
        });
      } catch (err) {
        console.error("KaTeX Error:", err);
      }
    }
  }, [tex, displayMode]);

  return <div ref={containerRef} className="text-white select-all cursor-text text-3xl md:text-4xl" />;
}
