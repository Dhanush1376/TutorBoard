import React, { useEffect, useRef, useMemo } from 'react';
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

  // ─── Phase 4 Final Fix: Use new VisualScript format (step.actions) ───
  const visibleElements = useMemo(() => {
    const arr = currentStep.actions?.length ? currentStep.actions : timeline?.elements;
    return (arr || [])
      .filter((a: any) => a.cmd === 'equation' || a.type === 'equation')
      .map((a: any, i: number) => ({
        id: a.id || `eq-${currentStepIndex}-${i}`,
        content: a.formula || a.tex || a.content || a.label || '',
        highlight: !!a.highlight,
        highlightTerms: a.highlightTerms || [],
        annotation: a.annotation || a.text
      }));
  }, [currentStep.actions, currentStepIndex, timeline?.elements]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[var(--bg-primary)] p-8 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-12 z-10">
        <AnimatePresence mode="popLayout">
          {visibleElements.map((el: any, index: number) => {
            const key = el.id || `eq-fallback-${currentStepIndex}-${index}`;
            return (
              <motion.div
                layout="position"
                key={key}
                initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], layout: { type: "spring", stiffness: 100, damping: 20 } }}
                className={`p-8 rounded-3xl backdrop-blur-md relative overflow-hidden ${el.highlight ? 'bg-blue-500/10 border border-blue-400/40 shadow-[0_0_50px_rgba(59,130,246,0.3)]' : 'bg-white/5 border border-white/10 shadow-2xl'}`}
              >
                {el.highlight && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-[shimmer_2s_infinite]" />
                )}
                <Equation
                  tex={el.content || el.label || ''}
                  displayMode={true}
                  highlightTerms={el.highlightTerms}
                />
                {el.annotation && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-sm text-blue-300/90 font-mono mt-4 text-center tracking-widest uppercase drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]"
                  >
                    // {el.annotation}
                  </motion.p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Narrative Context (Premium Overlay) */}
      <motion.div
        key={currentStepIndex}
        initial={{ opacity: 0, x: -30, filter: 'blur(5px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        className="w-full max-w-3xl p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
        <div className="flex items-center space-y-1 mb-4">
          <div className="w-1.5 h-5 bg-blue-500 rounded-full mr-4 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-[0.25em]">Step {currentStepIndex + 1}: Derivation Logic</h3>
        </div>
        <p className="text-xl text-white/95 leading-relaxed font-light tracking-wide">
          {currentStep.narration || currentStep.explanation || "Analyzing mathematical relationships..."}
        </p>
      </motion.div>
    </div>
  );
}

interface EquationProps {
  tex: string;
  displayMode?: boolean;
  highlightTerms?: string[];
}

function Equation({ tex, displayMode = false, highlightTerms = [] }: EquationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const processedTex = useMemo(() => {
    let finalTex = tex;
    if (highlightTerms && highlightTerms.length > 0) {
      // Dynamic highlighting: wrap matched terms in KaTeX \textcolor
      // Note: This is a simple string replacement. Complex overlapping LaTeX might need AST parsing, 
      // but this handles 95% of standard visual interventions (e.g. highlighting an 'x' or 'dx').
      highlightTerms.forEach(term => {
        // Escape special regex chars
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\\\text{.*)(${escapedTerm})(?!.*})`, 'g');
        finalTex = finalTex.replace(regex, `\\textcolor{#60a5fa}{$1}`); // Brighter blue/neon
      });
    }
    return finalTex;
  }, [tex, highlightTerms]);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(processedTex, containerRef.current, {
          displayMode: displayMode,
          throwOnError: false,
          strict: false,
          macros: {
            '\\RR': '\\mathbb{R}',
            '\\NN': '\\mathbb{N}',
            '\\ZZ': '\\mathbb{Z}',
          }
        });
      } catch (error) {
        console.error("KaTeX rendering error:", error);
        containerRef.current.innerText = processedTex;
      }
    }
  }, [processedTex, displayMode]);

  return <div ref={containerRef} className="text-2xl sm:text-3xl lg:text-4xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-500" />;
}
