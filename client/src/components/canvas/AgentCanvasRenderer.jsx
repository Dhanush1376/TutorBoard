import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import SVGCanvasRenderer from './SVGCanvasRenderer.jsx';
import KaTeXRenderer from '../../renderers/KaTeXRenderer';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';
import { VisualScriptInterpreter } from '../../engine/VisualScriptInterpreter';
import { D3Renderer } from '../../renderers/D3Renderer';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';

export default function AgentCanvasRenderer({
  timeline, currentStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep,
  hideAlgoPanel = false,
  width, height, // Explicit dimensions to bypass DOM measurement
  ...doubtProps
}) {
  const rendererType = (timeline?.renderer || 'cinematic').toLowerCase();
  const routed = getRenderer(rendererType);
  
  const isDSA = isDSAContent(timeline);
  const isD3 = routed === 'd3' || rendererType === 'd3' || isDSA;
  const isKaTeX = !isD3 && (routed === KaTeXRenderer || ['math', 'katex', 'equation', 'calculus'].includes(rendererType));
  
  // A specialized component renderer (Matter, Three, Desmos, etc.)
  // React.lazy components are objects with a $$typeof property, not functions.
  const SpecializedRenderer = routed && (typeof routed === 'function' || (typeof routed === 'object' && routed.$$typeof)) ? routed : null;

  const { 
    deltaState, d3Narration, setD3Narration, setDeltaState, 
    isPlaying, isPaused, setDeltaRunning, playbackSpeed
  } = useTutorStore(useShallow(s => ({
    deltaState: s.deltaState, 
    d3Narration: s.d3Narration, 
    setD3Narration: s.setD3Narration,
    setDeltaState: s.setDeltaState,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    setDeltaRunning: s.setDeltaRunning,
    playbackSpeed: s.playbackSpeed
  })));

  const d3ContainerRef = useRef(null);
  const physicsRef = useRef(null);
  const equationRef = useRef(null);
  const graphRef = useRef(null);
  const codeRef = useRef(null);
  const interpreterRef = useRef(null);
  const [layoutReady, setLayoutReady] = useState(false);

  // Wait for layout to prevent zero-dimension rendering
  useEffect(() => {
    const node = d3ContainerRef.current;
    if (!node) return;
    
    if (node.clientWidth > 0 && node.clientHeight > 0) {
      setLayoutReady(true);
    }
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0 && entries[0].contentRect.height > 0) {
        setLayoutReady(true);
      }
    });
    observer.observe(node);
    
    return () => observer.disconnect();
  }, [isD3, isKaTeX, deltaState]);

  // Stable ref to avoid stale closures inside GSAP onComplete
  const setDeltaStateRef = useRef(setDeltaState);
  useEffect(() => { setDeltaStateRef.current = setDeltaState; }, [setDeltaState]);

  // Called when the delta animation sequence fully completes.
  const onDeltaComplete = useCallback(() => {
    console.log('[AgentCanvasRenderer] ✅ Delta complete — resuming lesson step.');
    setDeltaRunning(false);
    setDeltaStateRef.current(null);
    // CRITICAL FIX: Signal the server to resume the lesson FSM
    if (doubtProps.onResume) {
      doubtProps.onResume();
    }
  }, [setDeltaRunning, doubtProps.onResume]);

  // 1. Core Interpreter & Renderer Initialization
  useEffect(() => {
    // If explicit width/height are provided, we don't need to wait for ResizeObserver (layoutReady)
    const canInitialize = d3ContainerRef.current && (layoutReady || (width && height));
    
    if (canInitialize) {
      // Bug Fix: If we were already initialized but layout was 0, or if we transition to a ready state,
      // we must re-initialize to ensure the SVG viewport and D3 coordinate system match the real dimensions.
      if (interpreterRef.current) {
        console.log('[AgentCanvasRenderer] 🔄 Re-initializing VisualScriptInterpreter for new dimensions');
        interpreterRef.current.kill();
        interpreterRef.current = null;
      }

      console.log('[AgentCanvasRenderer] 🏗️ Initializing VisualScriptInterpreter');
      const d3Renderer = new D3Renderer(d3ContainerRef.current, width, height);
      interpreterRef.current = new VisualScriptInterpreter(setD3Narration, d3ContainerRef.current);
      interpreterRef.current.setRenderers({ d3: d3Renderer });
    }

    return () => {
      if (interpreterRef.current) {
        interpreterRef.current.kill();
        interpreterRef.current = null;
      }
    };
  }, [isD3, isKaTeX, SpecializedRenderer, layoutReady, width, height, setD3Narration]);

  // 2. Specialized Renderer Registration (Physics/Equation/Graph/Code)
  useEffect(() => {
    // Poll for specialized renderers that may mount later (especially Suspense components)
    const interval = setInterval(() => {
      const interpreter = interpreterRef.current;
      if (!interpreter) return;

      if (physicsRef.current) interpreter.registerSpecializedRenderer('physics', physicsRef.current);
      if (equationRef.current) interpreter.registerSpecializedRenderer('equation', equationRef.current);
      if (graphRef.current) interpreter.registerSpecializedRenderer('graph', graphRef.current);
      if (codeRef.current) interpreter.registerSpecializedRenderer('code', codeRef.current);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 3. Playback Orchestration (Step/Delta)
  useEffect(() => {
    if (!interpreterRef.current || !layoutReady) return;

    const hasDelta = deltaState?.actions?.length > 0;
    const step = timeline?.steps?.[currentStepIndex];

    if (hasDelta) {
      console.log('[AgentCanvasRenderer] 🚀 Playing Doubt Delta');
      setDeltaRunning(true);
      interpreterRef.current.playDelta(deltaState.actions, onDeltaComplete);
    } else {
      const actions = step?.actions || step?.animation?.actions;
      if (actions) {
        console.log(`[AgentCanvasRenderer] 🎬 Playing Step ${currentStepIndex}`);
        interpreterRef.current.playStep(actions);
      }
    }
  }, [currentStepIndex, timeline?.steps, deltaState?.timestamp, onDeltaComplete, setDeltaRunning, layoutReady]);


  // Sync Playback State (Pause/Resume)
  useEffect(() => {
    if (!interpreterRef.current) return;
    if (isPlaying && !isPaused) {
      interpreterRef.current.resume();
    } else {
      interpreterRef.current.pause();
    }
  }, [isPlaying, isPaused]);

  // Sync Playback Speed
  useEffect(() => {
    if (interpreterRef.current && playbackSpeed) {
      interpreterRef.current.setPlaybackSpeed(playbackSpeed);
    }
  }, [playbackSpeed]);



  const combinedElements = useMemo(() => {
    const map = new Map();
    (timeline?.elements || []).forEach(o => map.set(String(o.id), o));
    [...extElements, ...extObjects].forEach(o => map.set(String(o.id), o));
    return Array.from(map.values());
  }, [timeline?.elements, extElements, extObjects]);

  return (
    <ErrorBoundary key={rendererType} onClose={() => {}}>
      <div className={`relative w-full h-full ${rendererType === 'simulator' ? 'min-h-[600px]' : 'min-h-[480px]'}`}>

        {/* D3 Layer (Primary for D3 subjects, Overlay for KaTeX/Doubt Deltas/Cinematic) */}
        {(isD3 || isKaTeX || !!deltaState || rendererType === 'cinematic') && (
          <div 
            ref={d3ContainerRef} 
            className="absolute inset-0 z-10 w-full h-full overflow-visible" 
            style={{ pointerEvents: (isD3 || !!deltaState) ? 'auto' : 'none' }} 
          />
        )}

        {/* KaTeX Content */}
        {isKaTeX && (
          <div className="absolute inset-0 z-0 flex items-center justify-center p-8">
            <KaTeXRenderer 
              ref={equationRef}
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
                ref={(node) => {
                  if (!node) return;
                  if (['physics', 'matter', 'mechanics'].includes(rendererType)) physicsRef.current = node;
                  if (['graph', 'desmos'].includes(rendererType)) graphRef.current = node;
                  if (['code', 'monaco', 'algorithm'].includes(rendererType)) codeRef.current = node;
                  if (['math', 'equation'].includes(rendererType)) equationRef.current = node;
                }}
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


        {/* ─── Legacy/Cinematic SVG Layer ─── */}
        {/* Only mount if no high-performance renderer (D3/KaTeX/Specialized) is handling the scene. */}
        {!isD3 && !isKaTeX && !SpecializedRenderer && (
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
        

      </div>
    </ErrorBoundary>
  );
}