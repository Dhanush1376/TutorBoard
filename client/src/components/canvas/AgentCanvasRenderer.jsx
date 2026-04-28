/**
 * AgentCanvasRenderer v6.0 — Universal Scene Graph Router
 *
 * Routes to AlgorithmRenderer for DSA content (8+4 grid),
 * or to the cinematic SVG stack for everything else.
 */
import React from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import { getRenderer, isDSAContent } from '../../engine/RendererRouter';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes,
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

  // ── DSA / Algorithm detection (fuzzy — works even if server returns "cinematic") ──
  const isDSA = isDSAContent(normalizedTimeline);
  const SpecializedRenderer = isDSA ? getRenderer('algorithm') : getRenderer(rendererType);
  const isAlgorithm = isDSA || rendererType === 'algorithm' || rendererType === 'dsa';

  return (
    <ErrorBoundary key={`${rendererType}-${currentStepIndex}`} onClose={() => {}}>
      <div className="relative w-full h-full" style={{ minHeight: '100%' }}>

        {/* ── ALGORITHM RENDERER: full-size, no SVG overlay on top ── */}
        {isAlgorithm && SpecializedRenderer && (
          <div className="absolute inset-0 z-10" style={{ minHeight: '480px' }}>
            <SpecializedRenderer
              timeline={normalizedTimeline}
              currentStepIndex={currentStepIndex}
              elements={timelineObjects}
              connections={extConnections}
              steps={extSteps}
            />
          </div>
        )}

        {/* ── NON-ALGORITHM: background specialized engine + SVG overlay ── */}
        {!isAlgorithm && (
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
        {isAlgorithm && (
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