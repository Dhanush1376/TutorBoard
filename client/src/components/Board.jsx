import React, { useMemo } from 'react';
import { Stage, Layer, Text } from 'react-konva';
import { animated, useSpring, useSprings } from '@react-spring/konva';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

const AnimatedArray = ({ data, highlightIndices }) => {
  const BOX_SIZE = 60;
  const SPACING = 20;
  
  // Calculate total width to center it manually if needed, 
  // though we could rely on Konva container translation
  const totalWidth = data.length * BOX_SIZE + (data.length - 1) * SPACING;
  const startX = -totalWidth / 2 + BOX_SIZE / 2;

  // useSprings creates multiple animations for the array elements
  const springs = useSprings(
    data.length,
    data.map((item, i) => {
      const isHighlighted = highlightIndices?.includes(i);
      return {
        to: {
          x: startX + i * (BOX_SIZE + SPACING),
          y: 0,
          scaleX: isHighlighted ? 1.15 : 1,
          scaleY: isHighlighted ? 1.15 : 1,
          fill: isHighlighted ? '#3b82f6' : '#1f2937', // blue-500 vs neutral dark gray
          strokeColor: isHighlighted ? '#93c5fd' : '#4b5563', // border
          textFill: isHighlighted ? '#ffffff' : '#e5e7eb',
        },
        config: { mass: 1, tension: 280, friction: 25 },
      };
    })
  );

  return (
    <>
      {springs.map((props, i) => (
        <animated.Group key={i} x={props.x} y={props.y}>
          {/* Box Shadow / Glow pseudo if wanted, skipped for minimal */}
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
            shadowColor="rgba(0,0,0,0.2)"
            shadowBlur={props.scaleX.to(s => (s > 1 ? 15 : 5))}
            shadowOffsetY={props.scaleX.to(s => (s > 1 ? 8 : 2))}
          />
          <animated.Text
            text={String(data[i])}
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
          {/* Index Label below the box */}
          <Text
            text={String(i)}
            fontSize={12}
            fill="#9ca3af" // neutral-400
            align="center"
            x={-BOX_SIZE / 2}
            y={BOX_SIZE / 2 + 10}
            width={BOX_SIZE}
          />
        </animated.Group>
      ))}
    </>
  );
};


const Board = ({ isGenerating, stepData, currentStep, totalSteps }) => {
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 450;

  return (
    <div className={cn(
      "w-full h-full min-h-[500px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl overflow-hidden relative",
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
              Visualizing topic...
            </span>
          </div>
        )}

        {stepData && !isGenerating && (
          <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500 p-4 pt-8">
            {/* Step info and description */}
            <div className="w-full max-w-3xl mb-6 text-center">
              <div className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 px-3 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full inline-block">
                Step {currentStep + 1} / {totalSteps}
              </div>
              <p className="text-[17px] text-[var(--text-primary)] font-medium leading-relaxed max-w-2xl mx-auto">
                {stepData.description}
              </p>
            </div>
            
            {/* Konva Semantic Stage */}
            <div className="flex-1 w-full max-w-4xl max-h-[450px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden flex items-center justify-center relative">
              <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <Layer>
                  {/* Center origin helper via Group translation */}
                  <animated.Group x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2}>
                    {stepData.visuals && stepData.visuals.map((vis, i) => {
                       if (vis.type === 'array') {
                          return (
                            <AnimatedArray 
                              key={`array-${i}`} 
                              data={vis.data || []} 
                              highlightIndices={vis.highlight || []} 
                            />
                          );
                       }
                       return null;
                    })}
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
