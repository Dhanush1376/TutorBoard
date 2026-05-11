import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';

interface MonacoRendererProps {
  timeline: {
    title?: string;
    topic?: string;
    language?: string;
    elements?: any[];
    timeline?: any[];
    steps?: any[];
  };
  currentStepIndex: number;
}

const MonacoRenderer = forwardRef((props: MonacoRendererProps, ref) => {
  const { timeline, currentStepIndex } = props;
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const language = timeline.language || currentStep.language || 'javascript';
  const [codeOverride, setCodeOverride] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    setCode: (code: string) => setCodeOverride(code),
    reset: () => setCodeOverride(null)
  }));

  // Reset override when step changes
  useEffect(() => {
    setCodeOverride(null);
  }, [currentStepIndex]);
  
  // Extract code from step actions (VisualScript) or legacy fields
  const codeAction = (currentStep.actions || []).find((a: any) => a.cmd === 'code' || a.action === 'code');
  const displayCode = codeOverride || codeAction?.code || codeAction?.content || currentStep.code || timeline.elements?.[0]?.code || '';

  // Extract variables from actions
  const actionVariables = (currentStep.actions || [])
    .filter((a: any) => a.cmd === 'variable' || a.action === 'variable')
    .reduce((acc: any, a: any) => ({ ...acc, [a.name || a.id]: a.value }), {});
  
  const displayVariables = { ...(currentStep.variables || {}), ...actionVariables };

  const highlightedLines = currentStep.highlightLines || codeAction?.highlightLines || [];
  const terminalOutput = currentStep.terminalOutput || codeAction?.terminalOutput || [];

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e] p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {timeline.title || "Algorithm Execution"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-yellow-400/80 text-xs font-mono uppercase tracking-widest">
              Live Code Trace: {language}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Editor Side */}
        <div className="flex-[2] rounded-2xl overflow-hidden border border-white/5 bg-[#1e1e1e] shadow-inner relative">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={displayCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 20 },
              fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
              fontLigatures: true,
              renderLineHighlight: 'all',
              selectionHighlight: true,
            }}
          />
        </div>

        {/* Console / Variables Side */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Variable Watch */}
          <div className="flex-[2] bg-black/40 rounded-2xl border border-white/5 p-5 overflow-y-auto">
            <h3 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-4">Variable Watch</h3>
            <div className="space-y-3">
              {Object.entries(displayVariables).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                  <span className="text-blue-400 font-mono text-sm">{key}</span>
                  <span className="text-orange-400 font-mono text-sm">{JSON.stringify(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Output */}
          <div className="flex-1 bg-black/60 rounded-2xl border border-white/5 p-5 font-mono text-xs text-green-400 overflow-y-auto">
            <h3 className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Terminal</h3>
            <div className="space-y-1">
              {terminalOutput.map((line: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-white/20 select-none">$</span>
                  <span>{line}</span>
                </div>
              ))}
              <div className="w-2 h-4 bg-green-400 animate-blink" />
            </div>
          </div>
        </div>
      </div>

      {/* Narrative Footer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-4">
             <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/40 shrink-0">
               <span className="text-yellow-500 text-xs font-bold">AI</span>
             </div>
             <p className="text-lg text-white/90 leading-relaxed font-light">
               {currentStep.narration || currentStep.explanation || "Tracing code execution..."}
             </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s step-end infinite; }
      `}</style>
    </div>
  );
});

export default MonacoRenderer;
