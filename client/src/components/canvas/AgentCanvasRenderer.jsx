import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import KaTeXRenderer from '../../renderers/KaTeXRenderer';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';
import { VisualScriptInterpreter } from '../../engine/VisualScriptInterpreter';
import { D3Renderer } from '../../renderers/D3Renderer';
import { AlgoRightPanel } from '../teaching/AlgoRightPanel';
import { createPortal } from 'react-dom';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep, 
  ...doubtProps
}) {
  const rendererType = (timeline?.renderer || 'cinematic').toLowerCase();
  const routed = getRenderer(rendererType);
  
  const isD3 = routed === 'd3' || rendererType === 'd3';
  const isKaTeX = routed === KaTeXRenderer || ['math', 'katex', 'equation', 'calculus'].includes(rendererType);
  const isDSA = isDSAContent(timeline);
  
  // A specialized component renderer (Matter, Three, Desmos, etc.)
  // React.lazy components are objects with a $$typeof property, not functions.
  const SpecializedRenderer = routed && (typeof routed === 'function' || (typeof routed === 'object' && routed.$$typeof)) ? routed : null;

  const { deltaState, d3Narration, setD3Narration, setDeltaState, isPlaying, isPaused } = useTutorStore(useShallow(s => ({
    deltaState: s.deltaState, 
    d3Narration: s.d3Narration, 
    setD3Narration: s.setD3Narration,
    setDeltaState: s.setDeltaState,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused
  })));

  const d3ContainerRef = useRef(null);
  const physicsRef = useRef(null);
  const interpreterRef = useRef(null);

  // Stable ref to avoid stale closures inside GSAP onComplete
  const setDeltaStateRef = useRef(setDeltaState);
  useEffect(() => { setDeltaStateRef.current = setDeltaState; }, [setDeltaState]);

  // Called when the delta animation sequence fully completes.
  // Clears deltaState → triggers re-render → plays the current step normally,
  // resuming the lesson from the exact position the student paused at.
  const onDeltaComplete = useCallback(() => {
    console.log('[AgentCanvasRenderer] ✅ Delta complete — resuming lesson step.');
    setDeltaStateRef.current(null);
  }, []);

  // Initialize and update D3 pipeline
  useEffect(() => {
    if ((isD3 || isKaTeX) && d3ContainerRef.current) {
      if (!interpreterRef.current) {
        const d3Renderer = new D3Renderer(d3ContainerRef.current);
        interpreterRef.current = new VisualScriptInterpreter(setD3Narration);
        interpreterRef.current.setRenderers({ d3: d3Renderer });
      }
      
      // Register physics if available
      if (physicsRef.current) {
        interpreterRef.current.registerSpecializedRenderer('physics', physicsRef.current);
      }

      const step = timeline?.steps?.[currentStepIndex];
      if (deltaState?.actions?.length > 0) {
        // Play delta with auto-resume callback
        interpreterRef.current.playDelta(deltaState.actions, onDeltaComplete);
      } else if (step?.actions) {
        interpreterRef.current.playStep(step.actions);
      }
    }
  }, [isD3, isKaTeX, currentStepIndex, timeline?.steps, deltaState?.timestamp, physicsRef.current]);

  // Sync Playback State (Pause/Resume)
  useEffect(() => {
    if (!interpreterRef.current) return;
    if (isPlaying && !isPaused) {
      interpreterRef.current.resume();
    } else {
      interpreterRef.current.pause();
    }
  }, [isPlaying, isPaused]);



  const combinedElements = useMemo(() => {
    const map = new Map();
    (timeline?.elements || []).forEach(o => map.set(String(o.id), o));
    [...extElements, ...extObjects].forEach(o => map.set(String(o.id), o));
    return Array.from(map.values());
  }, [timeline?.elements, extElements, extObjects]);

  return (
    <ErrorBoundary key={rendererType} onClose={() => {}}>
      <div className="relative w-full h-full min-h-[480px]">
        {/* D3 Layer (Primary for D3 subjects, Overlay for KaTeX) */}
        {(isD3 || isKaTeX) && (
          <>
            <div ref={d3ContainerRef} className="absolute inset-0 z-10 w-full h-full overflow-visible pointer-events-none" style={{ pointerEvents: isD3 ? 'auto' : 'none' }} />
            {isD3 && createPortal(
              <AlgoRightPanel 
                step={{ narration: d3Narration }} 
                stepIndex={currentStepIndex} 
                totalSteps={timeline?.steps?.length || 0}
                timeline={timeline}
                onGoToStep={onGoToStep}
                {...doubtProps}
              />,
              document.getElementById('algo-sidebar-portal') || document.body
            )}
          </>
        )}

        {/* KaTeX Content */}
        {isKaTeX && (
          <div className="absolute inset-0 z-0 flex items-center justify-center p-8">
            <KaTeXRenderer 
              timeline={timeline} 
              currentStepIndex={currentStepIndex} 
            />
          </div>
        )}

        {/* Other Specialized Renderers (Matter, Three, Desmos) — lazy loaded */}
        {!isKaTeX && !isD3 && SpecializedRenderer && (
          <div className="absolute inset-0 z-0">
            <React.Suspense fallback={
              <div className="flex items-center justify-center w-full h-full text-white/30 text-sm">
                Loading renderer...
              </div>
            }>
              <SpecializedRenderer
                ref={['physics', 'matter', 'mechanics'].includes(rendererType) ? physicsRef : null}
                timeline={timeline}
                currentStepIndex={currentStepIndex}
                elements={combinedElements}
                connections={extConnections}
                steps={extSteps}
                onGoToStep={onGoToStep}
                {...doubtProps}
              />
            </React.Suspense>
          </div>
        )}


        {/* Legacy/Cinematic SVG Layer */}
        {!isD3 && !SpecializedRenderer && !isKaTeX && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <SVGCanvasRenderer 
              timeline={timeline} 
              currentStepIndex={currentStepIndex} 
              elements={combinedElements} 
              connections={extConnections} 
              steps={extSteps} 
              showNotes={showNotes} 
              forceManualOnly={rendererType !== 'cinematic'} 
              isD3={isD3} 
            />
          </div>
        )}
        
        {/* Universal Annotation Layer (Force on for D3/DSA) */}
        {(isDSA || isD3) && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <SVGCanvasRenderer 
              timeline={timeline} 
              currentStepIndex={currentStepIndex} 
              elements={combinedElements} 
              connections={extConnections} 
              steps={extSteps} 
              showNotes={showNotes} 
              forceManualOnly={true} 
              isD3={isD3} 
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}