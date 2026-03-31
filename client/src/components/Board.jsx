import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Text, Rect, Group } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';
import { motion, useMotionValue, useSpring as useFramerSpring } from 'framer-motion';

// ... AnimatedArray remains the same ...
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

const Board = ({ stepData }) => {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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

    const scaleBy = 1.12; // Slightly more responsive zoom factor
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

    // PERFORMANCE: Manipulate the Konva Stage directly for zero-latency feedback
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();

    // Sync back to React state for persistence (throttled/batched by React)
    setStageScale(newScale);
    setStagePos(newPos);
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
          {stepData && (
            <Group x={dimensions.width / 2} y={dimensions.height / 2}>
               <AnimatedArray stepData={stepData} />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
};


export default Board;
