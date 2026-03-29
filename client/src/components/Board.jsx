import React, { useMemo } from 'react';
import { Stage, Layer, Text, Line, Circle } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

// Reusable Array Node Component
const AnimatedArray = ({ stepData }) => {
  const BOX_SIZE = 60;
  const SPACING = 20;

  // Defensive parsing
  const rawArray = stepData.data?.array || [];
  const type = stepData.type;
  
  // Extract specific meta-data based on the schema
  const highlightIndices = stepData.data?.highlight_indices || [];
  
  // For 'compare' type
  const ptrA = stepData.data?.index_a;
  const ptrB = stepData.data?.index_b;
  const condition = stepData.data?.condition;

  // For 'swap' type
  const swapI = stepData.data?.swap_i;
  const swapJ = stepData.data?.swap_j;
  
  const totalWidth = rawArray.length * BOX_SIZE + (rawArray.length - 1) * SPACING;
  const startX = -totalWidth / 2 + BOX_SIZE / 2;

  const springs = useSprings(
    rawArray.length,
    rawArray.map((item, i) => {
      // Determine if this box is actively doing something
      const isHighlighted = highlightIndices.includes(i) || type === 'highlight';
      const isComparing = type === 'compare' && (i === ptrA || i === ptrB);
      const isSwapping = type === 'swap' && (i === swapI || i === swapJ);

      let fill = '#1f2937'; // default neutal
      let stroke = '#4b5563';
      
      if (isHighlighted) {
        fill = '#22c55e'; // green-500
        stroke = '#86efac';
      } else if (isComparing) {
        fill = '#eab308'; // yellow-500
        stroke = '#fdf08a';
      } else if (isSwapping) {
        fill = '#ef4444'; // red-500
        stroke = '#fca5a5';
      }

      // If we are swapping, we physically swap the X positions visually
      // To strictly follow logic, the API swaps the rawArray in the next step, 
      // but we lift it slightly on the Y axis during the swap step.
      let yPos = 0;
      if (isSwapping) { yPos = -20; }
      else if (isComparing) { yPos = -5; }

      return {
        to: {
          x: startX + i * (BOX_SIZE + SPACING),
          y: yPos,
          scaleX: (isHighlighted || isComparing || isSwapping) ? 1.12 : 1,
          scaleY: (isHighlighted || isComparing || isSwapping) ? 1.12 : 1,
          fill,
          strokeColor: stroke,
          textFill: '#ffffff',
        },
        config: { mass: 1, tension: 350, friction: 22 }, // High tension, moderate friction for snappy "Framer-like" bounce
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
            strokeWidth={2}
            scaleX={props.scaleX}
            scaleY={props.scaleY}
            shadowColor="rgba(0,0,0,0.3)"
            shadowBlur={props.scaleX.to(s => (s > 1 ? 15 : 5))}
          />
          <animated.Text
            text={String(rawArray[i])}
            fontSize={22}
            fontStyle="bold"
            fontFamily="Inter, sans-serif"
            fill={props.textFill}
            align="center"
            verticalAlign="middle"
            x={-BOX_SIZE / 2}
            y={-BOX_SIZE / 2}
            width={BOX_SIZE}
            height={BOX_SIZE}
            scaleX={props.scaleX}
            scaleY={props.scaleY}
          />
          {/* Index Label */}
          <Text
            text={String(i)}
            fontSize={12}
            fill="#9ca3af" // neutral-400
            align="center"
            x={-BOX_SIZE / 2}
            y={BOX_SIZE / 2 + 10}
            width={BOX_SIZE}
          />
          
          {/* Compare Condition Floating Text above elements */}
          {type === 'compare' && i === ptrA && ptrA !== undefined && ptrB !== undefined && (
            <Text
               text={'Ptr A'}
               fontSize={12}
               fontStyle="bold"
               fill="#eab308"
               x={-BOX_SIZE / 2}
               y={-BOX_SIZE / 2 - 25}
               width={BOX_SIZE}
               align="center"
            />
          )}
          {type === 'compare' && i === ptrB && ptrA !== undefined && ptrB !== undefined && (
            <Text
               text={'Ptr B'}
               fontSize={12}
               fontStyle="bold"
               fill="#eab308"
               x={-BOX_SIZE / 2}
               y={-BOX_SIZE / 2 - 25}
               width={BOX_SIZE}
               align="center"
            />
          )}
        </animated.Group>
      ))}

      {/* Global Condition Render for Compare */}
      {type === 'compare' && condition && (
        <Text
          text={`Comparing A ${condition} B`}
          fontSize={16}
          fontStyle="bold"
          fill="#eab308"
          x={startX}
          y={-80}
        />
      )}
    </>
  );
};

// Reusable Graph Component
const AnimatedGraph = ({ stepData }) => {
  const points = stepData.data?.points || [];
  const equation = stepData.data?.equation || "";
  
  const GRID_SIZE = 30;
  const AXIS_LENGTH = 300;

  // Flatten points for Konva Line: [x1, y1, x2, y2, ...]
  // We need to map standard mathematical coordinates to canvas coordinates
  // Canvas: (0,0) is top left. Mathematical: (0,0) is center.
  // We apply a scale to make it visible
  const mapCoord = (val, isY) => {
    return isY ? -(val * GRID_SIZE) : (val * GRID_SIZE);
  };

  const linePoints = points.map(pt => [mapCoord(pt[0], false), mapCoord(pt[1], true)]).flat();

  // Animation for the graphed line drawing in
  const props = useSpring({
    from: { opacity: 0, dashOffset: 1000 },
    to: { opacity: 1, dashOffset: 0 },
    config: { tension: 120, friction: 30, clamp: true }
  });

  return (
    <animated.Group>
      {/* Equation Text */}
      <Text 
        text={equation}
        fontSize={20}
        fontStyle="bold"
        fill="#a855f7" // purple-500
        x={-AXIS_LENGTH/2}
        y={-AXIS_LENGTH/2 - 40}
      />
      
      {/* X Axis */}
      <Line
        points={[-AXIS_LENGTH/2, 0, AXIS_LENGTH/2, 0]}
        stroke="#4b5563"
        strokeWidth={2}
      />
      {/* Y Axis */}
      <Line
        points={[0, -AXIS_LENGTH/2, 0, AXIS_LENGTH/2]}
        stroke="#4b5563"
        strokeWidth={2}
      />

      {/* Points */}
      {points.map((pt, i) => (
        <Circle
          key={`pt-${i}`}
          x={mapCoord(pt[0], false)}
          y={mapCoord(pt[1], true)}
          radius={6}
          fill="#a855f7"
        />
      ))}

      {/* The Line connecting points */}
      {points.length > 1 && (
        <animated.Line
          points={linePoints}
          stroke="#a855f7"
          strokeWidth={4}
          tension={0.2}
          opacity={props.opacity}
          dash={[1000, 1000]}
          dashOffset={props.dashOffset} // SVG style stroke animation hack
        />
      )}
    </animated.Group>
  );
};


const Board = ({ isGenerating, stepData, currentStep, totalSteps }) => {
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 380; // slightly smaller so UI text fits perfectly

  return (
    <div className={cn(
      "w-full h-full min-h-[550px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl overflow-hidden relative",
      "flex flex-col items-center justify-center transition-all duration-300"
    )}>
      
      {/* Minimal Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(var(--text-primary) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center text-center w-full h-full">
        {!stepData && !isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 p-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Start Learning
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-md">
              Ask a question like "Explain Binary Search on [1, 3, 5, 7, 9]" to generate an interactive visual explanation.
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <Loader2 size={24} className="text-[var(--text-primary)] animate-spin" />
            <span className="text-[15px] font-medium text-[var(--text-secondary)]">
              Formulating Algorithm Steps...
            </span>
          </div>
        )}

        {stepData && !isGenerating && (
          <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500 p-4 pt-6">
            
            {/* Step info, description, and animation instructions */}
            <div className="w-full max-w-3xl mb-4 text-center">
              <div className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 px-3 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full inline-block">
                Step {currentStep + 1} / {totalSteps}
              </div>
              <p className="text-[17px] text-[var(--text-primary)] font-medium leading-relaxed max-w-2xl mx-auto">
                {stepData.description}
              </p>
              
              {/* Animation Intent (from AI) */}
              {stepData.animation_instructions && (
                <p className="text-[13px] text-[var(--text-secondary)] font-mono mt-3 opacity-80 max-w-lg mx-auto bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]">
                  ⚡ {stepData.animation_instructions}
                </p>
              )}
            </div>
            
            {/* Konva Semantic Stage */}
            <div className="flex-1 w-full max-w-4xl max-h-[380px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden flex items-center justify-center relative">
              <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <Layer>
                  {/* Center origin helper via Group translation */}
                  <animated.Group x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2}>
                    
                    {/* Render standard array, compare, swap, layout types via Array Component */}
                    {['array', 'compare', 'swap', 'highlight'].includes(stepData.type) && (
                      <AnimatedArray stepData={stepData} />
                    )}

                    {/* Render Graph Type */}
                    {stepData.type === 'graph' && (
                      <AnimatedGraph stepData={stepData} />
                    )}

                  </animated.Group>
                </Layer>
              </Stage>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Board;
