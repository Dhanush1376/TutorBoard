import React, { useEffect, useRef } from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';
import { D3Executor } from '../../engine/D3Executor';
import { D3Renderer } from '../../renderers/D3Renderer';
import { AlgoRightPanel } from '../teaching/AlgoRightPanel';
import { createPortal } from 'react-dom';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep, 
  // Doubt Props
  doubtHistory, isDoubtProcessing, activeDoubtId, onJumpToDoubt, onResume, onAskDoubt, onPinDoubt,
}) {
  const timelineObjects = React.useMemo(() => {
    return timeline?.elements || timeline?.objects || [];
  }, [timeline?.elements, timeline?.objects]);

  const combinedElements = React.useMemo(() => {
    const elementMap = new Map();
    timelineObjects.forEach(obj => { if (obj?.id) elementMap.set(String(obj.id), obj); });
    [...extElements, ...extObjects].forEach(obj => { if (obj?.id) elementMap.set(String(obj.id), obj); });
    return Array.from(elementMap.values());
  }, [timelineObjects, extElements, extObjects]);

  const rendererType = (timeline?.renderer || 'cinematic').toLowerCase();

  const normalizedTimeline = {
    ...timeline,
    elements:    combinedElements,
    connections: extConnections || timeline?.connections || [],
    timeline:    extSteps || timeline?.timeline || timeline?.steps || [],
  };

  // ── DSA / Algorithm detection ──
  const isDSA = isDSAContent(normalizedTimeline);
  const SpecializedRenderer = isDSA ? getRenderer('algorithm') : getRenderer(rendererType);
  const isAlgorithm = isDSA || rendererType === 'algorithm' || rendererType === 'dsa';
  const isD3 = rendererType === 'd3';

  // D3 + GSAP refs
  const d3ContainerRef = useRef(null);
  const executorRef = useRef(null);
  const [d3Narration, setD3Narration] = React.useState('');

  useEffect(() => {
    if (isD3 && d3ContainerRef.current) {
      if (!executorRef.current) {
        // Initialize the D3Renderer and D3Executor once when container mounts
        const d3Renderer = new D3Renderer(d3ContainerRef.current);
        const executor = new D3Executor((text) => {
          setD3Narration(text);
        });
        executor.setRenderer(d3Renderer);
        executorRef.current = executor;
      }
      
      // Play the current step
      const stepData = normalizedTimeline.timeline[currentStepIndex];
      if (stepData && stepData.actions) {
        executorRef.current.playStep(stepData.actions);
      } else if (stepData && Array.isArray(stepData)) {
        // Fallback if the step is directly an array of commands
        executorRef.current.playStep(stepData);
      }
    }
  }, [isD3, currentStepIndex, normalizedTimeline.timeline]);

  // Clean up
  useEffect(() => {
    return () => {
      if (executorRef.current) {
        executorRef.current.kill();
      }
    };
  }, []);

  return (
    <ErrorBoundary key={`${rendererType}-${currentStepIndex}`} onClose={() => {}}>
      <div className="relative w-full h-full" style={{ minHeight: '100%' }}>

        {/* ── NEW D3/GSAP RENDERER ── */}
        {isD3 && (
          <>
            <div ref={d3ContainerRef} className="absolute inset-0 z-10 w-full h-full" style={{ minHeight: '480px' }} />
            {createPortal(
              <AlgoRightPanel
                step={{ narration: d3Narration }}
                stepIndex={currentStepIndex}
                totalSteps={normalizedTimeline.timeline.length}
                variables={normalizedTimeline.timeline[currentStepIndex]?.variables || {}}
                activeStates={['default', 'active', 'comparing', 'swapping']} // Standard D3 states
                timeline={normalizedTimeline}
                onGoToStep={onGoToStep}
                doubtHistory={doubtHistory}
                isDoubtProcessing={isDoubtProcessing}
                activeDoubtId={activeDoubtId}
                onJumpToDoubt={onJumpToDoubt}
                onPinDoubt={onPinDoubt}
                onResume={onResume}
                onAskDoubt={onAskDoubt}
              />,
              document.getElementById('algo-sidebar-portal') || document.body
            )}
          </>
        )}

        {/* ── ALGORITHM RENDERER: full-size, no SVG overlay on top ── */}
        {isAlgorithm && !isD3 && SpecializedRenderer && (
          <div className="absolute inset-0 z-10" style={{ minHeight: '480px' }}>
            <SpecializedRenderer
              timeline={normalizedTimeline}
              currentStepIndex={currentStepIndex}
              elements={timelineObjects}
              connections={extConnections}
              steps={extSteps}
              onGoToStep={onGoToStep}
              doubtHistory={doubtHistory}
              isDoubtProcessing={isDoubtProcessing}
              activeDoubtId={activeDoubtId}
              onJumpToDoubt={onJumpToDoubt}
              onPinDoubt={onPinDoubt}
              onResume={onResume}
              onAskDoubt={onAskDoubt}
            />
          </div>
        )}

        {/* ── NON-ALGORITHM: background specialized engine + SVG overlay ── */}
        {!isAlgorithm && !isD3 && (
          <>
            {SpecializedRenderer && rendererType !== 'cinematic' && (
              <div className="absolute inset-0 z-0">
                <SpecializedRenderer
                  timeline={normalizedTimeline}
                  currentStepIndex={currentStepIndex}
                  elements={timelineObjects}
                  connections={extConnections}
                  steps={extSteps}
                />
              </div>
            )}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <SVGCanvasRenderer
                timeline={normalizedTimeline}
                currentStepIndex={currentStepIndex}
                elements={combinedElements}
                connections={extConnections}
                steps={extSteps}
                showNotes={showNotes}
                forceManualOnly={rendererType !== 'cinematic'}
              />
            </div>
          </>
        )}

        {/* ── Manual annotations layer always on top (for both modes) ── */}
        {(isAlgorithm || isD3) && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <SVGCanvasRenderer
              timeline={normalizedTimeline}
              currentStepIndex={currentStepIndex}
              elements={combinedElements}
              connections={extConnections}
              steps={extSteps}
              showNotes={showNotes}
              forceManualOnly={true}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}