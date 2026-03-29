import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Text, Rect, Group } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';

// Reusable Array Node Component
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
            fill="inherit" /* Managed via CSS variables on root */
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
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale > 3 || newScale < 0.2) return;
    setStageScale(newScale);
    setStagePos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-[var(--bg-primary)] overflow-hidden transition-colors duration-500">
      
      {/* 1. Immersive Grid Layer (Dynamic CSS Variable Support) */}
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
        width={dimensions.width} 
        height={dimensions.height}
        onWheel={handleWheel}
        draggable
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        className="cursor-grab active:cursor-grabbing transition-colors duration-500"
      >
        <Layer>
          {/* Ensure Konva objects also respond to theme by using inherit or manual colors if needed */}
          {stepData && (
            <Group x={dimensions.width / 2} y={dimensions.height / 2 - 50}>
               <AnimatedArray stepData={stepData} />
            </Group>
          )}
        </Layer>
      </Stage>
      
    </div>
  );
};

export default Board;
