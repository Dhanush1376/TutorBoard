/**
 * AgentCanvasRenderer v5.0 — Universal Scene Graph Router
 * 
 * Optimized router that delegates rendering to specialized engines 
 * (Matter.js, D3.js, KaTeX, or SVG) based on the timeline metadata.
 */
import React from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import { getRenderer } from '../../engine/RendererRouter';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [], 
  connections: extConnections, steps: extSteps,
  showNotes,
}) {
  // Use a Map to deduplicate objects by ID, favoring manual/external objects over timeline defaults
  const combinedElements = React.useMemo(() => {
    const elementMap = new Map();
    
    // 1. Add timeline objects first
    const timelineObjects = timeline?.elements || timeline?.objects || [];
    timelineObjects.forEach(obj => { if (obj?.id) elementMap.set(String(obj.id), obj); });
    
    // 2. Add manual/external objects (these should overwrite if IDs match)
    // Flatten and deduplicate the manual/external lists themselves first
    const manualList = [...extElements, ...extObjects];
    manualList.forEach(obj => { if (obj?.id) elementMap.set(String(obj.id), obj); });

    return Array.from(elementMap.values());
  }, [timeline?.elements, timeline?.objects, extElements, extObjects]);

  const rendererType = timeline?.renderer || 'cinematic';
  
  // 1. Resolve normalized data for renderers
  const normalizedTimeline = {
    ...timeline,
    elements: combinedElements,
    connections: extConnections || timeline?.connections || [],
    timeline:    extSteps || timeline?.timeline || timeline?.steps || [],
  };

  // 2. Resolve specialized renderer (Matter, D3, KaTeX)
  const SpecializedRenderer = getRenderer(rendererType);

  return (
    <ErrorBoundary key={`${rendererType}-${currentStepIndex}`} onClose={() => {}}>
      <div className="relative w-full h-full">
        {/* Background Layer: Specialized Engine (D3, Matter, KaTeX) */}
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

        {/* Foreground Layer: High-fidelity SVG Renderer for Manual Annotations & Cinematic elements */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <SVGCanvasRenderer
            timeline={normalizedTimeline}
            currentStepIndex={currentStepIndex}
            elements={combinedElements}
            connections={extConnections}
            steps={extSteps}
            showNotes={showNotes}
            // If background is specialized, SVG should only render manual/pinned stuff
            forceManualOnly={rendererType !== 'cinematic'}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
