import React from 'react';
import { Stage, Layer, Text, Rect, Circle, Arrow } from 'react-konva';

const Whiteboard = ({ currentStepData }) => {
  // We define a fixed size for the canvas or responsive
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  if (!currentStepData) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[600px] bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center">
        <p className="text-gray-400 text-lg font-medium">Enter a prompt to generate a visual explanation</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
        <p className="text-blue-800 font-medium text-lg text-center">
          {currentStepData.description}
        </p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex justify-center">
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            {currentStepData.elements && currentStepData.elements.map((el, index) => {
              switch (el.type) {
                case 'text':
                  return (
                    <Text
                      key={index}
                      x={el.x}
                      y={el.y}
                      text={el.text}
                      fontSize={el.fontSize || 20}
                      fill={el.fill || 'black'}
                      fontFamily="Inter, sans-serif"
                    />
                  );
                case 'rect':
                  return (
                    <Rect
                      key={index}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      stroke={el.stroke || 'black'}
                      strokeWidth={2}
                      fill={el.fill || 'transparent'}
                      cornerRadius={4}
                    />
                  );
                case 'circle':
                  return (
                    <Circle
                      key={index}
                      x={el.x}
                      y={el.y}
                      radius={el.radius}
                      stroke={el.stroke || 'black'}
                      strokeWidth={2}
                      fill={el.fill || 'transparent'}
                    />
                  );
                case 'arrow':
                  return (
                    <Arrow
                      key={index}
                      points={el.points}
                      stroke={el.stroke || 'black'}
                      strokeWidth={2}
                      pointerLength={el.pointerLength || 10}
                      pointerWidth={el.pointerWidth || 10}
                      fill={el.stroke || 'black'}
                    />
                  );
                default:
                  return null;
              }
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default Whiteboard;
