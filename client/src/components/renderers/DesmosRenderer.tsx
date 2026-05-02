import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';

interface DesmosRendererProps {
  timeline: {
    title?: string;
    topic?: string;
    elements?: any[];
    timeline?: any[];
    steps?: any[];
  };
  currentStepIndex: number;
}

declare global {
  interface Window {
    Desmos: any;
  }
}

const DesmosRenderer = forwardRef((props: DesmosRendererProps, ref) => {
  const { timeline, currentStepIndex } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const [expressionOverride, setExpressionOverride] = useState<any[] | null>(null);

  useImperativeHandle(ref, () => ({
    setExpression: (latex: string, color?: string) => {
      setExpressionOverride([{ id: 'vs-override', latex, color: color || '#3b82f6' }]);
    },
    reset: () => setExpressionOverride(null)
  }));

  // Reset override when step changes
  useEffect(() => {
    setExpressionOverride(null);
  }, [currentStepIndex]);

  useEffect(() => {
    // Load Desmos API script if not present
    if (!window.Desmos) {
      const script = document.createElement('script');
      script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=d3d389b710b741e59546255b9f56363c';
      script.async = true;
      script.onload = () => initCalculator();
      document.head.appendChild(script);
    } else {
      initCalculator();
    }

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, []);

  const initCalculator = () => {
    if (!containerRef.current || calculatorRef.current) return;
    
    calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
      keypad: false,
      expressions: false,
      settingsMenu: false,
      zoomButtons: true,
      expressionsCollapsed: true,
      autosize: true
    });

    syncExpressions();
  };

  const syncExpressions = () => {
    if (!calculatorRef.current) return;

    // If an override is active, use it instead of step data
    const allExpressions = expressionOverride || steps.slice(0, currentStepIndex + 1).flatMap(s => {
      const legacy = s.expressions || [];
      const fromActions = (s.actions || [])
        .filter((a: any) => a.cmd === 'graph' || a.action === 'graph' || a.cmd === 'expression')
        .map((a: any) => ({
          latex: a.latex || a.content || a.formula,
          color: a.color || '#3b82f6'
        }));
      return [...legacy, ...fromActions];
    });
    
    calculatorRef.current.setExpressions(allExpressions.map((exp: any, i: number) => ({
      id: exp.id || `exp-${i}`,
      latex: exp.latex,
      color: exp.color || '#3b82f6'
    })));

    // Viewport support from actions
    const viewportAction = (currentStep.actions || []).find((a: any) => a.cmd === 'camera' || a.action === 'viewport');
    if (viewportAction?.viewport) {
      calculatorRef.current.setMathBounds(viewportAction.viewport);
    } else if (currentStep.viewport) {
      calculatorRef.current.setMathBounds(currentStep.viewport);
    }
  };

  useEffect(() => {
    syncExpressions();
  }, [currentStepIndex, steps, expressionOverride]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[var(--bg-primary)] p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {timeline.title || "Functional Analysis"}
          </h2>
          <p className="text-blue-400/80 text-xs font-mono uppercase tracking-widest mt-1">
            Desmos Interactive Graphing Engine
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-white/20">RENDERER_ID: DESMOS_V1</span>
        </div>
      </div>

      {/* Desmos Container */}
      <div className="flex-1 w-full bg-white rounded-2xl overflow-hidden shadow-inner border border-white/5 relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Narrative Footer */}
      <motion.div
        key={currentStepIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
      >
        <p className="text-lg text-white/90 leading-relaxed font-light">
          {currentStep.narration || currentStep.explanation}
        </p>
      </motion.div>
    </div>
  );
});

export default DesmosRenderer;
