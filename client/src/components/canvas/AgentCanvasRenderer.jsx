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
  elements: extElements, objects: extObjects, 
  connections: extConnections, steps: extSteps,
  showNotes,
}) {
  const elements = extElements || extObjects || [];
  const rendererType = timeline?.renderer || 'cinematic';
  
  // 1. Resolve normalized data for renderers
  const normalizedTimeline = {
    ...timeline,
    elements: elements.length ? elements : (timeline?.elements || timeline?.objects || []),
    connections: extConnections || timeline?.connections || [],
    timeline:    extSteps || timeline?.timeline || timeline?.steps || [],
  };

  // 2. Resolve specialized renderer (Matter, D3, KaTeX)
  const SpecializedRenderer = getRenderer(rendererType);

  if (SpecializedRenderer && rendererType !== 'cinematic') {
    return (
      <ErrorBoundary key={`${rendererType}-${currentStepIndex}`} onClose={() => {}}>
        <SpecializedRenderer
          timeline={normalizedTimeline}
          currentStepIndex={currentStepIndex}
          elements={elements}
          connections={extConnections}
          steps={extSteps}
        />
      </ErrorBoundary>
    );
  }

  // 3. Fallback to default high-fidelity SVG renderer
  return (
    <ErrorBoundary key={`svg-${currentStepIndex}`} onClose={() => {}}>
      <SVGCanvasRenderer
        timeline={normalizedTimeline}
        currentStepIndex={currentStepIndex}
        elements={elements}
        objects={extObjects}
        connections={extConnections}
        steps={extSteps}
        showNotes={showNotes}
      />
    </ErrorBoundary>
  );
}