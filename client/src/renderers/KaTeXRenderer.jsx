import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function KaTeXRenderer({ timeline, currentStepIndex }) {
  const steps = timeline?.timeline || [];
  const currentStep = steps[currentStepIndex] || {};
  const elements = timeline?.elements || [];

  return (
    <div className="relative w-[800px] h-[600px] flex flex-col items-center justify-center bg-[var(--bg-primary)] p-12 text-white">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {elements.filter(el => el.type === 'equation' || el.type === 'math').map((el, idx) => (
          <Equation key={el.id || idx} tex={el.content || el.label || ''} />
        ))}
      </div>

      {/* Narrative Context */}
      <div className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Equation Derivation</h3>
        <p className="text-lg leading-relaxed">{currentStep.narration || currentStep.explanation}</p>
      </div>
    </div>
  );
}

function Equation({ tex }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (containerRef.current) {
      katex.render(tex, containerRef.current, { throwOnError: false, displayMode: true });
    }
  }, [tex]);
  return <div ref={containerRef} className="text-4xl" />;
}
