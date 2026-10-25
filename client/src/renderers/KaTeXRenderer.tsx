import React, { useEffect, useRef, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../store/tutorStore';

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

const KaTeXRenderer = forwardRef((props: KaTeXRendererProps, ref) => {
  const { timeline, currentStepIndex } = props;
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const interactiveValues = useTutorStore(state => state.interactiveValues);
  const [formulaOverride, setFormulaOverride] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    setFormula: (tex: string) => setFormulaOverride(tex),
    reset: () => setFormulaOverride(null)
  }));

  // Reset override when step changes
  useEffect(() => {
    setFormulaOverride(null);
  }, [currentStepIndex]);

  // ─── Phase 4 Final Fix: Use new VisualScript format (step.actions) ───
  const visibleElements = useMemo(() => {
    // If an override is active, we render ONLY the override
    if (formulaOverride) {
      return [{
        id: 'vs-override',
        content: formulaOverride,
        highlight: true
      }];
    }

    const arr = currentStep.actions?.length 
      ? currentStep.actions 
      : (currentStep.commands?.length ? currentStep.commands : timeline?.elements);
    return (arr || [])
      .filter((a: any) => a.cmd === 'equation' || a.type === 'equation')
      .map((a: any, i: number) => ({
        id: a.id || `eq-${currentStepIndex}-${i}`,
        content: a.formula || a.tex || a.content || a.label || '',
        highlight: !!a.highlight,
        highlightTerms: a.highlightTerms || [],
        annotation: a.annotation || a.text
      }));
  }, [currentStep.actions, currentStepIndex, timeline?.elements, formulaOverride]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0B0D0C] p-8 overflow-hidden rounded-3xl border border-[#383E38] shadow-2xl">
      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-12 z-10">
        <AnimatePresence mode="popLayout">
          {visibleElements.map((el: any, index: number) => {
            const key = el.id || `eq-fallback-${currentStepIndex}-${index}`;
            return (
              <motion.div
                layout="position"
                key={key}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], layout: { type: "spring", stiffness: 120, damping: 22 } }}
                className="flex flex-col items-center gap-3"
              >
                {(el.label || el.title || el.annotation) && (
                  <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#A0A5A8]">
                    {el.label || el.title || el.annotation}
                  </span>
                )}
                <div
                  className={`px-12 py-5 rounded-full relative overflow-hidden transition-all duration-300 ${
                    el.highlight 
                      ? 'bg-[#17150F] border border-[#744210] shadow-[0_4px_24px_rgba(0,0,0,0.6)]' 
                      : 'bg-[#0F1012] border border-[#22252A] shadow-[0_4px_24px_rgba(0,0,0,0.6)]'
                  }`}
                >
                  <Equation
                    tex={el.content || el.formula || el.label || ''}
                    displayMode={true}
                    highlightTerms={el.highlightTerms}
                    overrides={interactiveValues}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Narrative Context (Level 2 Operational Explanation) */}
      <motion.div
        key={currentStepIndex}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
        className="w-full max-w-3xl p-6 bg-[#171A18] border border-[#383E38] rounded-2xl shadow-xl z-20 relative overflow-hidden"
      >
        <div className="flex items-center space-y-1 mb-2.5">
          <div className="w-1.5 h-4 bg-[#F4C95D] rounded-full mr-3" />
          <h3 className="text-xs font-mono font-semibold text-[#F4C95D] uppercase tracking-wider">Step {currentStepIndex + 1}: Derivation Logic</h3>
        </div>
        <p className="text-lg text-[#F5F5F0] leading-relaxed font-normal">
          {currentStep.narration || currentStep.explanation || "Analyzing mathematical relationships..."}
        </p>
      </motion.div>
    </div>
  );
});

export default KaTeXRenderer;

interface EquationProps {
  tex: string;
  displayMode?: boolean;
  highlightTerms?: string[];
  overrides?: Record<string, number>;
}

function Equation({ tex, displayMode = false, highlightTerms = [], overrides = {} }: EquationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const processedTex = useMemo(() => {
    let finalTex = tex;

    // 1. Apply Interactive Overrides
    // If tex contains variables (e.g. "a", "b", "x"), replace them with current slider values
    const sortedKeys = Object.keys(overrides).sort((a, b) => b.length - a.length);
    sortedKeys.forEach(k => {
      const val = overrides[k];
      // Regex to match variable NOT inside a LaTeX command or { }
      // This is a heuristic: match \bvar\b but avoid things like \frac or \sqrt
      const regex = new RegExp(`\\b${k}\\b`, 'g');
      finalTex = finalTex.replace(regex, val.toFixed(val % 1 === 0 ? 0 : 2));
    });

    // 2. Apply Dynamic Highlighting
    if (highlightTerms && highlightTerms.length > 0) {
      highlightTerms.forEach(term => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\\\text{.*)(${escapedTerm})(?!.*})`, 'g');
        finalTex = finalTex.replace(regex, `\\textcolor{#F4C95D}{$1}`);
      });
    }
    return finalTex;
  }, [tex, highlightTerms, overrides]);

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

  return <div ref={containerRef} className="text-2xl sm:text-3xl lg:text-4xl text-[#F5F5F0] transition-all duration-300" />;
}
