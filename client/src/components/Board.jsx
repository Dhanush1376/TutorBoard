import React, { useState, useEffect, useRef, Component } from 'react';
import { Stage, Layer, Text, Rect, Group } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';
import { motion, useMotionValue, useSpring as useFramerSpring, AnimatePresence } from 'framer-motion';

// Import New Visual Engine Renderers
import FlowRenderer from './renderers/FlowRenderer';
import TimelineRenderer from './renderers/TimelineRenderer';
import DiagramRenderer from './renderers/DiagramRenderer';
import AnimationRenderer from './renderers/AnimationRenderer';
import SceneRenderer from './renderers/SceneRenderer';

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

// Array-based visualization for DSA domain
const AnimatedArray = ({ stepData }) => {
  const BOX_SIZE = 60;
  const SPACING = 20;

  const rawArray = stepData.data?.array || [];
  const type = stepData.type;
  
  const highlightIndices = stepData.data?.highlight_indices || [];
  const ptrA = stepData.data?.index_a;
  const ptrB = stepData.data?.index_b;
  const swapI = stepData.data?.swap_i;
  const swapJ = stepData.data?.swap_j;
  
  const totalWidth = rawArray.length * BOX_SIZE + (rawArray.length - 1) * SPACING;
  const startX = -totalWidth / 2 + BOX_SIZE / 2;

  const springs = useSprings(
    rawArray.length,
    rawArray.map((item, i) => {
      const isHighlighted = highlightIndices.includes(i) || type === 'highlight';
      const isComparing = type === 'compare' && (i === ptrA || i === ptrB);
      const isSwapping = type === 'swap' && (i === swapI || i === swapJ);

      let fill = 'rgba(128, 128, 128, 0.1)'; 
      let stroke = 'rgba(128, 128, 128, 0.2)';
      
      if (isHighlighted) { fill = '#059669'; stroke = '#10b981'; } 
      else if (isComparing) { fill = '#d97706'; stroke = '#f59e0b'; } 
      else if (isSwapping) { fill = '#dc2626'; stroke = '#ef4444'; }

      let yPos = 0;
      if (isSwapping) { yPos = -30; }
      else if (isComparing) { yPos = -10; }

      return {
        to: {
          x: startX + i * (BOX_SIZE + SPACING),
          y: yPos,
          scaleX: (isHighlighted || isComparing || isSwapping) ? 1.15 : 1,
          scaleY: (isHighlighted || isComparing || isSwapping) ? 1.15 : 1,
          fill,
          strokeColor: stroke,
        },
        config: { mass: 1, tension: 350, friction: 22 },
      };
    })
  );

  return (
    <>
      {springs.map((props, i) => (
        <animated.Group key={i} x={props.x} y={props.y}>
          <animated.Rect
            x={-BOX_SIZE / 2}
            y={-BOX_SIZE / 2}
            width={BOX_SIZE}
            height={BOX_SIZE}
            cornerRadius={12}
            fill={props.fill}
            stroke={props.strokeColor}
            strokeWidth={1.5}
            scaleX={props.scaleX}
            scaleY={props.scaleY}
            shadowColor="rgba(0,0,0,0.05)"
            shadowBlur={props.scaleX.to(s => (s > 1 ? 25 : 5))}
          />
          <animated.Text
            text={String(rawArray[i])}
            fontSize={18}
            fontStyle="bold"
            fill="inherit"
            align="center"
            verticalAlign="middle"
            x={-BOX_SIZE / 2}
            y={-BOX_SIZE / 2}
            width={BOX_SIZE}
            height={BOX_SIZE}
          />
        </animated.Group>
      ))}
    </>
  );
};

const isArrayStep = (stepData) => {
  const arrayTypes = ['array', 'compare', 'swap', 'highlight'];
  return arrayTypes.includes(stepData?.type) && Array.isArray(stepData?.data?.array);
};

const StepPlaceholder = ({ stepData }) => {
  const type = stepData?.type || 'unknown';
  const animation = stepData?.animation || stepData?.animation_instructions || '';
  const data = stepData?.data || {};

  const getDisplayContent = () => {
    if (stepData?.visualContent) return stepData.visualContent;
    if (data.equation) return data.equation;
    if (data.expression) return data.expression;
    if (data.stages) return data.stages.map(s => s.name).join(' → ');
    if (data.reactants && data.products) return `${data.reactants.join(' + ')} → ${data.products.join(' + ')}`;
    if (data.vectors) return data.vectors.map(v => `${v.label} = ${v.magnitude}${v.unit || ''}`).join(', ');
    if (data.organism) return data.organism;
    if (data.components) return data.components.map(c => c.name).join(', ');
    if (data.nodes) return `${data.nodes.length} nodes, ${(data.edges || []).length} connections`;
    if (data.content) return data.content;
    if (stepData?.value) return stepData.value;
    
    const displayObj = { ...stepData, ...data };
    delete displayObj.type;
    delete displayObj.description;
    delete displayObj.label;
    delete displayObj.animation;
    delete displayObj.data;

    const remainingKeys = Object.entries(displayObj);
    if (remainingKeys.length > 0) {
      return remainingKeys.map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ');
    }
    return type !== 'unknown' ? type.replace(/_/g, ' ') : "Visual Diagram Element";
  };

  const displayContent = getDisplayContent();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
    >
      <div className="bg-[var(--bg-secondary)]/70 backdrop-blur-2xl border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full mx-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
            {type}
          </span>
        </div>
        <div className="w-full min-h-[160px] flex items-center justify-center bg-[var(--bg-primary)]/40 border border-dashed border-[var(--border-color)] rounded-2xl p-8">
           <span className="text-3xl font-bold font-mono tracking-wider text-[var(--text-primary)] text-center break-words max-w-full">
             {displayContent}
           </span>
        </div>
        {animation && (
          <p className="text-[var(--text-tertiary)] text-[11px] italic mt-2">
            ✨ {animation}
          </p>
        )}
      </div>
    </motion.div>
  );
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

  if (!question) return <StepPlaceholder stepData={stepData} />;

  const handleOptionClick = (option) => {
    if (showFeedback) return;
    setSelectedOption(option);
    setShowFeedback(true);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[var(--bg-secondary)]/80 backdrop-blur-3xl border border-[var(--border-color)] rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl pointer-events-auto"
      >
        <div className="flex justify-center mb-6">
           <span className="px-4 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
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
                  ${!showFeedback ? 'hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] border-[var(--border-color)] bg-[var(--bg-primary)]/40 cursor-pointer' : 'cursor-default'}
                  ${showFeedback && isCorrect ? 'border-green-500/50 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : ''}
                  ${showFeedback && isIncorrect ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}
                  ${showFeedback && !isSelected && !isCorrect ? 'opacity-40 grayscale-[0.5]' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                   <div className={`
                     w-9 h-9 flex items-center justify-center rounded-xl text-[12px] font-bold transition-colors
                     ${showFeedback && isCorrect ? 'bg-green-500 text-white' : (showFeedback && isIncorrect ? 'bg-red-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]')}
                   `}>
                     {String.fromCharCode(65 + i)}
                   </div>
                   <span className={`text-[15px] font-medium transition-colors ${showFeedback && (isCorrect || isIncorrect) ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                     {option}
                   </span>
                </div>
                {showFeedback && isCorrect && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
              className="overflow-hidden"
            >
              <div className="p-5 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-2 h-2 rounded-full ${selectedOption === correctAnswer ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                   <span className="font-bold uppercase tracking-[0.15em] text-[10px] text-[var(--text-tertiary)]">
                     {selectedOption === correctAnswer ? 'Excellent' : 'Analysis'}
                   </span>
                </div>
                <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed italic opacity-90">
                  {explanation}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              <div className={`relative flex items-center gap-4 px-7 py-4 rounded-2xl border transition-all duration-500 ${isActive ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent shadow-[0_20px_50px_rgba(0,0,0,0.2)] scale-110 z-20' : 'bg-[var(--bg-secondary)]/40 text-[var(--text-secondary)] border-[var(--border-color)] backdrop-blur-md z-10'}`}>
                <span className="text-2xl">{getIcon(step.icon || step.type)}</span>
                <span className="text-base font-bold tracking-tight uppercase">{step.label || step.type}</span>
                {isActive && <motion.div layoutId="active-glow" className="absolute inset-0 rounded-2xl bg-[var(--text-primary)]/20 blur-2xl -z-10" />}
              </div>
              {i < steps.length - 1 && (
                <div className="flex flex-col items-center h-10 my-1">
                  <div className={`w-0.5 h-full ${i < currentStep ? 'bg-[var(--text-tertiary)]' : 'bg-[var(--border-color)]'} transition-colors duration-500`} />
                  <span className={`text-lg mt-[-8px] font-bold ${i < currentStep ? 'text-[var(--text-tertiary)]' : 'text-[var(--border-color)]'}`}>↓</span>
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
const SceneDispatcher = ({ stepData, steps, currentStep, domain, vizType, dsl, style, elements, motion, sequence, connections, objects, dimensions, stageRef, handleWheel, stagePos, isDragging, setIsDragging, setStagePos, stageScale }) => {
  const hasObjects = Array.isArray(objects) && objects.length > 0;
  const hasElements = Array.isArray(elements) && elements.length > 0;
  const hasSequence = Array.isArray(sequence) && sequence.length > 0;
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  // ═══ PRIORITY 1: SceneRenderer — real SVG visual diagrams ═══
  if (hasObjects) {
    return <SceneRenderer objects={objects} steps={steps} currentStep={currentStep} />;
  }

  // ═══ PRIORITY 2: DSL-based renderers ═══
  const hasDSL = dsl && typeof dsl === 'object' && !Array.isArray(dsl) && Object.keys(dsl).length > 0;
  if (hasDSL) {
    switch (vizType) {
      case "flow":
      case "node_graph":
        return <FlowRenderer dsl={dsl} style={style} />;
      case "timeline":
        return <TimelineRenderer dsl={dsl} style={style} />;
      case "diagram":
        return <DiagramRenderer dsl={dsl} style={style} />;
      default:
        break;
    }
  }

  // ═══ PRIORITY 3: ProcessRenderer for step-based flow ═══
  if (hasSteps) {
    return <ProcessRenderer steps={steps} currentStep={currentStep} />;
  }

  // ═══ PRIORITY 4: AnimationRenderer for elements ═══
  if (hasElements || hasSequence) {
    return <AnimationRenderer data={{ elements, motion, sequence, connections, type: vizType }} />;
  }

  // ═══ PRIORITY 5: Legacy renderers ═══
  if (stepData) {
    switch (vizType) {
      case "array":
      case "array_visualization":
        return (
          <Stage ref={stageRef} width={dimensions.width} height={dimensions.height} onWheel={handleWheel} draggable x={stagePos.x} y={stagePos.y} scaleX={stageScale} scaleY={stageScale} onDragStart={() => setIsDragging(true)} onDragEnd={(e) => { setIsDragging(false); setStagePos({ x: e.target.x(), y: e.target.y() }); }} className="transition-colors duration-500">
            <Layer><Group x={dimensions.width / 2} y={dimensions.height / 2}><AnimatedArray stepData={stepData} /></Group></Layer>
          </Stage>
        );
      case "quiz":
        return <QuizRenderer stepData={stepData} />;
      default:
        return <StepPlaceholder stepData={stepData} />;
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--text-tertiary)] flex items-center justify-center"
        >
          <span className="text-2xl">✦</span>
        </motion.div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          Awaiting Visual Data
        </span>
      </div>
    </motion.div>
  );
};

const Board = ({ stepData, steps, currentStep, domain, visualizationType: propVisualizationType, dsl, style, elements, motion, sequence, connections, objects }) => {
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

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useFramerSpring(mouseX, { damping: 15, stiffness: 400 });
  const smoothY = useFramerSpring(mouseY, { damping: 15, stiffness: 400 });

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

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isHovering || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };
    if (isHovering) window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isHovering, mouseX, mouseY]);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.12;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale > 5 || newScale < 0.1) return;
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    stage.scale({ x: newScale, y: newScale });
    setStageScale(newScale);
    setStagePos(newPos);
  };

  return (
    <div ref={containerRef} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} className="absolute inset-0 w-full h-full bg-[var(--bg-primary)] overflow-hidden transition-colors duration-500" style={{ cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='4' fill='%231c1711' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 8 8, auto` }}>
      {isHovering && (
        <motion.div style={{ x: smoothX, y: smoothY, willChange: 'transform' }} className="pointer-events-none absolute z-[9999] flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <motion.div animate={{ scale: isDragging ? 0.6 : 1, opacity: isHovering ? 0.35 : 0 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="w-11 h-11 rounded-full border-2 border-[var(--text-tertiary)]" />
        </motion.div>
      )}
      <div className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.4] transition-all duration-500" style={{ perspective: '1500px', backgroundImage: 'radial-gradient(circle at center, var(--text-tertiary) 0.5px, transparent 0.5px)', backgroundSize: '40px 40px', transform: 'rotateX(5deg) scale(1.05)' }} />
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
          motion={motion}
          sequence={sequence}
          connections={connections}
          objects={objects}
          dimensions={dimensions}
          stageRef={stageRef}
          handleWheel={handleWheel}
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
