import React, { useEffect, useRef, useMemo } from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';
import { VisualScriptInterpreter } from '../../engine/VisualScriptInterpreter';
import { D3Renderer } from '../../renderers/D3Renderer';
import { AlgoRightPanel } from '../teaching/AlgoRightPanel';
import { createPortal } from 'react-dom';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/shallow';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep, 
  ...doubtProps
}) {
  const rendererType = (timeline?.renderer || 'cinematic').toLowerCase();
  const isD3 = rendererType === 'd3';
  const isDSA = isDSAContent(timeline);
  const SpecializedRenderer = isDSA ? getRenderer('algorithm') : getRenderer(rendererType);

  const { deltaState, d3Narration, setD3Narration } = useTutorStore(useShallow(s => ({
    deltaState: s.deltaState, d3Narration: s.d3Narration, setD3Narration: s.setD3Narration
  })));

  const d3ContainerRef = useRef(null);
  const interpreterRef = useRef(null);

  useEffect(() => {
    if (isD3 && d3ContainerRef.current) {
      if (!interpreterRef.current) {
        const renderer = new D3Renderer(d3ContainerRef.current);
        interpreterRef.current = new VisualScriptInterpreter(setD3Narration);
        interpreterRef.current.setRenderer(renderer);
      }
      const step = timeline.steps?.[currentStepIndex];
      if (deltaState?.actions?.length > 0) interpreterRef.current.playDelta(deltaState.actions);
      else if (step?.actions) interpreterRef.current.playStep(step.actions);
    }
  }, [isD3, currentStepIndex, timeline.steps, deltaState?.timestamp]);

  const combinedElements = useMemo(() => {
    const map = new Map();
    (timeline?.elements || []).forEach(o => map.set(String(o.id), o));
    [...extElements, ...extObjects].forEach(o => map.set(String(o.id), o));
    return Array.from(map.values());
  }, [timeline?.elements, extElements, extObjects]);

  return (
    <ErrorBoundary key={rendererType} onClose={() => {}}>
      <div className="relative w-full h-full min-h-[480px]">
        {isD3 ? (
          <>
            <div ref={d3ContainerRef} className="absolute inset-0 z-10 w-full h-full overflow-visible" />
            {createPortal(
              <AlgoRightPanel 
                step={{ narration: d3Narration }} 
                stepIndex={currentStepIndex} 
                totalSteps={timeline.steps?.length || 0}
                timeline={timeline}
                onGoToStep={onGoToStep}
                {...doubtProps}
              />,
              document.getElementById('algo-sidebar-portal') || document.body
            )}
          </>
        ) : (
          <>
            {SpecializedRenderer && (
              <div className={rendererType === 'cinematic' ? 'absolute inset-0 z-10' : 'absolute inset-0 z-0'}>
                <SpecializedRenderer timeline={timeline} currentStepIndex={currentStepIndex} elements={combinedElements} connections={extConnections} steps={extSteps} onGoToStep={onGoToStep} {...doubtProps} />
              </div>
            )}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <SVGCanvasRenderer timeline={timeline} currentStepIndex={currentStepIndex} elements={combinedElements} connections={extConnections} steps={extSteps} showNotes={showNotes} forceManualOnly={rendererType !== 'cinematic'} isD3={isD3} />
            </div>
          </>
        )}
        
        {/* Universal Annotation Layer */}
        {(isDSA || isD3) && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <SVGCanvasRenderer timeline={timeline} currentStepIndex={currentStepIndex} elements={combinedElements} connections={extConnections} steps={extSteps} showNotes={showNotes} forceManualOnly={true} isD3={isD3} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}