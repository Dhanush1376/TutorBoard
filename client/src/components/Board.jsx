import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Text, Rect, Group } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';
import { motion, useMotionValue, useSpring as useFramerSpring } from 'framer-motion';

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

// Array-based visualization for DSA domain (existing renderer)
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

      // Default theme-aware colors
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

// Check if a step can be rendered by AnimatedArray
const isArrayStep = (stepData) => {
  const arrayTypes = ['array', 'compare', 'swap', 'highlight'];
  return arrayTypes.includes(stepData?.type) && Array.isArray(stepData?.data?.array);
};

// Styled placeholder for non-array domains (renders as HTML overlay)
const StepPlaceholder = ({ stepData }) => {
  const type = stepData?.type || 'unknown';
  const description = stepData?.description || '';
  const animation = stepData?.animation || stepData?.animation_instructions || '';
  const data = stepData?.data || {};

  // Extract meaningful display data based on step type
  const getDisplayContent = () => {
    // New preferred explicit output
    if (stepData?.visualContent) return stepData.visualContent;

    // Legacy standard mappings
    if (data.equation) return data.equation;
    if (data.expression) return data.expression;
    if (data.stages) return data.stages.map(s => s.name).join(' → ');
    if (data.reactants && data.products) return `${data.reactants.join(' + ')} → ${data.products.join(' + ')}`;
    if (data.vectors) return data.vectors.map(v => `${v.label} = ${v.magnitude}${v.unit || ''}`).join(', ');
    if (data.organism) return data.organism;
    if (data.components) return data.components.map(c => c.name).join(', ');
    if (data.nodes) return `${data.nodes.length} nodes, ${(data.edges || []).length} connections`;
    if (data.content) return data.content;

    // Random AI keys mapping fallback
    if (stepData?.value) return stepData.value;
    
    // Fallback: render the entire object (excluding base keys) as pretty strings
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

    // Ultimate fallback if absolutely empty
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
        {/* Type Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
            {type}
          </span>
        </div>

        {/* Visual Diagram Data Area */}
        <div className="w-full min-h-[160px] flex items-center justify-center bg-[var(--bg-primary)]/40 border border-dashed border-[var(--border-color)] rounded-2xl p-8">
           <span className="text-3xl font-bold font-mono tracking-wider text-[var(--text-primary)] text-center break-words max-w-full">
             {displayContent}
           </span>
        </div>

        {/* Animation Intent */}
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
    case "glucose": return "🔋";
    case "oxygen": return "🌬️";
    case "input": return "📥";
    case "output": return "📤";
    case "process": return "⚙️";
    default: return "🔹";
  }
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
              animate={{ 
                opacity: isPast || isActive ? 1 : 0.25,
                y: 0,
                scale: isActive ? 1.05 : 1
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center w-full"
            >
              {/* Node */}
              <div 
                className={`
                  relative flex items-center gap-4 px-7 py-4 rounded-2xl border transition-all duration-500
                  ${isActive 
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent shadow-[0_20px_50px_rgba(0,0,0,0.2)] scale-110 z-20' 
                    : 'bg-[var(--bg-secondary)]/40 text-[var(--text-secondary)] border-[var(--border-color)] backdrop-blur-md z-10'}
                `}
              >
                <span className="text-2xl">{getIcon(step.icon || step.type)}</span>
                <span className="text-base font-bold tracking-tight uppercase">{step.label || step.type}</span>
                
                {isActive && (
                   <motion.div 
                     layoutId="active-glow"
                     className="absolute inset-0 rounded-2xl bg-[var(--text-primary)]/20 blur-2xl -z-10"
                   />
                )}
              </div>

              {/* Arrow */}
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

const Board = ({ stepData, steps, currentStep, domain, visualizationType: propVisualizationType }) => {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  // ... existing refs and effects ...
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Quick fix: AI sometimes defaults to "array" when it shouldn't
  let vizType = propVisualizationType;
  if (domain !== "dsa" && (vizType === "array" || vizType === "array_visualization" || stepData?.type === "array")) {
    vizType = "process";
  }

  // Also catch cases where vizType wasn't explicitly set, but it shouldn't be an array
  if (!vizType && domain === "dsa") vizType = "array_visualization";
  if (!vizType && domain !== "dsa" && isArrayStep(stepData)) vizType = "process";

  // Custom Cursor Position
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

  // Global mouse listener for the custom cursor (smoother than standard React events)
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isHovering || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };

    if (isHovering) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }
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

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Zoom limits
    if (newScale > 5 || newScale < 0.1) return;

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.scale({ x: newScale, y: newScale });
    // Sync back to React state for persistence (throttled/batched by React)
    setStageScale(newScale);
    setStagePos(newPos);
  };

  const renderContent = () => {
    if (!stepData) return null;

    // Use the unified switch-case approach as requested for future extensibility
    switch (vizType) {
      case "array":
      case "array_visualization":
        return (
          <Stage 
            ref={stageRef}
            width={dimensions.width} 
            height={dimensions.height}
            onWheel={handleWheel}
            draggable
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e) => {
              setIsDragging(false);
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }}
            className="transition-colors duration-500"
          >
            <Layer>
              <Group x={dimensions.width / 2} y={dimensions.height / 2}>
                 <AnimatedArray stepData={stepData} />
              </Group>
            </Layer>
          </Stage>
        );

      // Future dedicated renderers can be hooked up here:
      case "process":
      case "biological_diagram":
        // return <FlowDiagram steps={steps} />
        return <ProcessRenderer steps={steps} currentStep={currentStep} />;

      case "motion":
      case "physics_simulation":
        // return <PhysicsEngine steps={steps} />
        return <StepPlaceholder stepData={stepData} />;

      case "graph":
      case "graph_visualization":
        // return <GraphPlotter steps={steps} />
        return <StepPlaceholder stepData={stepData} />;

      case "molecule":
      case "molecular_visualization":
        // return <ChemistryViewer steps={steps} />
        return <StepPlaceholder stepData={stepData} />;

      default:
        // Generic fallback for any unhandled type
        return <StepPlaceholder stepData={stepData} />;
    }
  };

  return (
    <div 
      ref={containerRef} 
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="absolute inset-0 w-full h-full bg-[var(--bg-primary)] overflow-hidden transition-colors duration-500"
      style={{ 
        cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='4' fill='%231c1711' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 8 8, auto` 
      }}
    >
      {/* Custom Cursor Ring (Reactive) */}
      {isHovering && (
        <motion.div
          style={{ x: smoothX, y: smoothY, willChange: 'transform' }}
          className="pointer-events-none absolute z-[9999] flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div 
            animate={{ 
              scale: isDragging ? 0.6 : 1,
              opacity: isHovering ? 0.35 : 0,
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="w-11 h-11 rounded-full border-2 border-[var(--text-tertiary)]" 
          />
        </motion.div>
      )}
      
      {/* 1. Immersive Grid Layer */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.4] transition-all duration-500"
        style={{
          perspective: '1500px',
          backgroundImage: 'radial-gradient(circle at center, var(--text-tertiary) 0.5px, transparent 0.5px)',
          backgroundSize: '40px 40px',
          transform: 'rotateX(5deg) scale(1.05)'
        }}
      />

      {/* 2. Board Content Renderer (Switch Case based on Domain/VisualizationType) */}
      {renderContent()}
    </div>
  );
};

export default Board;
