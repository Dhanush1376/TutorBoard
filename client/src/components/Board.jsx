import React, { useState, useEffect, useRef, Component } from 'react';
import { motion, useMotionValue, useSpring as useFramerSpring, AnimatePresence } from 'framer-motion';

// Legacy Visual Engine Renderers Removed

// ─── ERROR BOUNDARY ─── Catches rendering crashes and shows fallback UI
class BoardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[TutorBoard] Board renderer crashed:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full mx-6 shadow-2xl text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Renderer Error</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">The visualization encountered an issue. Try a different query.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Domain color map for visual identity
const DOMAIN_COLORS = {
  dsa: { bg: '#059669', text: '#ecfdf5', label: 'DSA' },
  mathematics: { bg: '#7c3aed', text: '#f5f3ff', label: 'Mathematics' },
  physics: { bg: '#2563eb', text: '#eff6ff', label: 'Physics' },
  chemistry: { bg: '#dc2626', text: '#fef2f2', label: 'Chemistry' },
  biology: { bg: '#16a34a', text: '#f0fdf4', label: 'Biology' },
  mechanical: { bg: '#d97706', text: '#fffbeb', label: 'Mechanical' },
  general: { bg: '#6b7280', text: '#f9fafb', label: 'General' },
};

// Array-based visualization (obsolete, handled by SceneRenderer)

const isArrayStep = (stepData) => {
  const arrayTypes = ['array', 'compare', 'swap', 'highlight'];
  return arrayTypes.includes(stepData?.type) && Array.isArray(stepData?.data?.array);
};



const getIcon = (icon) => {
  switch (icon?.toLowerCase()) {
    case "sun": return "☀️";
    case "plant": return "🌿";
    case "leaf": return "🌿";
    case "drop": return "💧";
    case "water": return "💧";
    case "gas": return "💨";
    case "co2": return "💨";
    case "energy": return "⚡";
    case "quiz": return "❓";
    default: return "🔹";
  }
};

const QuizRenderer = ({ stepData }) => {
  const { question, options, correctAnswer, explanation } = stepData.quizData || {};
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    setSelectedOption(null);
    setShowFeedback(false);
  }, [question]);

  if (!question) return null;

  const handleOptionClick = (option) => {
    if (showFeedback) return;
    setSelectedOption(option);
    setShowFeedback(true);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[var(--bg-secondary)]/90 backdrop-blur-3xl border border-[var(--border-color)] rounded-[2.5rem] p-10 max-w-xl w-[500px] shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing"
      >
        <div className="flex justify-center mb-6 drag-handle">
           <span className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-pulse" />
             Knowledge Check
           </span>
        </div>
        <h3 className="text-2xl font-serif text-[var(--text-primary)] mb-8 text-center leading-snug">
          {question}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {options?.map((option, i) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === correctAnswer;
            const isIncorrect = isSelected && !isCorrect;
            return (
              <motion.button
                key={i}
                whileTap={!showFeedback ? { scale: 0.98 } : {}}
                onClick={() => handleOptionClick(option)}
                disabled={showFeedback}
                className={`
                  group w-full p-5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between
                  ${!showFeedback ? 'hover:bg-[var(--bg-tertiary)] border-[var(--border-color)] bg-[var(--bg-primary)]/40 cursor-pointer' : 'cursor-default'}
                  ${showFeedback && isCorrect ? 'border-green-500/50 bg-green-500/10' : ''}
                  ${showFeedback && isIncorrect ? 'border-red-500/50 bg-red-500/10' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                   <div className={`w-9 h-9 flex items-center justify-center rounded-xl text-[12px] font-bold ${showFeedback && isCorrect ? 'bg-green-500 text-white' : (showFeedback && isIncorrect ? 'bg-red-500 text-white' : 'bg-[var(--bg-tertiary)]')}`}>
                     {String.fromCharCode(65 + i)}
                   </div>
                   <span className="text-[15px] font-medium">{option}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
        {showFeedback && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)]">
            <p className="text-[14px] text-[var(--text-secondary)] italic opacity-90">{explanation}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

const ProcessRenderer = ({ steps, currentStep }) => {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12 overflow-y-auto no-scrollbar">
      <div className="flex flex-col items-center gap-4 w-full max-w-2xl py-20">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isPast = i < currentStep;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isPast || isActive ? 1 : 0.25, y: 0, scale: isActive ? 1.05 : 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center w-full"
            >
              <div className={`relative flex flex-col items-center gap-2 px-8 py-5 rounded-[24px] border border-[var(--border-color)] transition-all duration-500 max-w-[400px] text-center ${isActive ? 'bg-[var(--bg-secondary)]/90 shadow-[0_30px_60px_rgba(0,0,0,0.15)] scale-105 z-20 border-[var(--text-tertiary)]' : 'bg-[var(--bg-secondary)]/40 text-[var(--text-secondary)] backdrop-blur-xl z-10 opacity-70 scale-95'}`}>
                
                <div className="flex items-center justify-center gap-3 w-full">
                  <span className={`text-2xl transition-transform duration-500 ${isActive ? 'scale-110 text-[var(--text-primary)]' : 'opacity-60'}`}>{getIcon(step.icon || step.type)}</span>
                  <span className={`text-[12px] font-black tracking-[0.15em] uppercase px-3 py-1 rounded-full ${isActive ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-tertiary)]'}`}>
                    {step.label || step.type}
                  </span>
                </div>

                {step.description && (
                   <p className={`text-[14px] mt-2 font-medium leading-[1.6] transition-colors duration-500 ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                     {step.description}
                   </p>
                )}

                {isActive && <motion.div layoutId="active-glow-process" className="absolute inset-0 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] pointer-events-none" />}
                {isActive && <motion.div className="absolute -inset-[2px] rounded-[26px] border border-[var(--text-tertiary)]/30 pointer-events-none" />}
              </div>
              
              {i < steps.length - 1 && (
                <div className="flex flex-col items-center h-12 my-2">
                  <div className={`w-[2px] h-full ${i < currentStep ? 'bg-[var(--text-tertiary)] opacity-80' : 'bg-[var(--border-color)]'} transition-all duration-500`} />
                  <div className={`w-2 h-2 rounded-full mt-[-4px] ${i < currentStep ? 'bg-[var(--text-tertiary)]' : 'bg-[var(--border-color)]'} transition-colors duration-500`} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── SCENE DISPATCHER ─── Handles renderer routing and fallback
const SceneDispatcher = ({ stepData, steps, currentStep, domain, vizType, dsl, style, elements, motionData, sequence, connections, objects, dimensions, stageRef, handleWheel, stagePos, isDragging, setIsDragging, setStagePos, stageScale }) => {
  const hasObjects = Array.isArray(objects) && objects.length > 0;
  const hasElements = Array.isArray(elements) && elements.length > 0;
  const hasSequence = Array.isArray(sequence) && sequence.length > 0;
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  // ═══ PRIORITY 1: SceneRenderer removed (Obsolete) ═══

  // ═══ PRIORITY 2: DSL-based renderers removed ═══

  // ═══ PRIORITY 3: ProcessRenderer for step-based flow ═══
  if (hasSteps) {
    return <ProcessRenderer steps={steps} currentStep={currentStep} />;
  }

  // ═══ PRIORITY 4: AnimationRenderer removed ═══

  // ═══ PRIORITY 5: Legacy renderers ═══
  if (stepData) {
    switch (vizType) {
      case "quiz":
        return <QuizRenderer stepData={stepData} />;
      default:
        return null;
    }
  }

  return null;
};

const Board = ({ stepData, steps, currentStep, domain, visualizationType: propVisualizationType, dsl, style, elements, motionData, sequence, connections, objects }) => {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  let vizType = propVisualizationType;
  if (domain !== "dsa" && (vizType === "array" || vizType === "array_visualization" || stepData?.type === "array")) {
    vizType = "process";
  }
  if (!vizType && domain === "dsa") vizType = "array_visualization";
  if (!vizType && domain !== "dsa" && isArrayStep(stepData)) vizType = "process";
  if (!vizType && Array.isArray(steps) && steps.length > 0) vizType = "process";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-transparent overflow-hidden">
      <BoardErrorBoundary>
        <SceneDispatcher 
          stepData={stepData}
          steps={steps}
          currentStep={currentStep}
          domain={domain}
          vizType={vizType}
          dsl={dsl}
          style={style}
          elements={elements}
          motionData={motionData}
          sequence={sequence}
          connections={connections}
          objects={objects}
          dimensions={dimensions}
          stageRef={stageRef}
          handleWheel={() => {}} // Home handles this now
          stagePos={stagePos}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          setStagePos={setStagePos}
          stageScale={stageScale}
        />
      </BoardErrorBoundary>
    </div>
  );
};

export default Board;
