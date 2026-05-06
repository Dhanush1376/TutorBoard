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
  const { rendererType, routed, isDSA } = useMemo(() => {
    const type = (timeline?.renderer || 'cinematic').toLowerCase();
    return {
      rendererType: type,
      routed: getRenderer(type),
      isDSA: isDSAContent(timeline)
    };
  }, [timeline?.renderer, timeline?.title, timeline?.topic]); // Stable dependencies

  const isD3 = useMemo(() => routed === 'd3' || rendererType === 'd3' || isDSA, [routed, rendererType, isDSA]);
  const isKaTeX = useMemo(() => !isD3 && (routed === KaTeXRenderer || ['math', 'katex', 'equation', 'calculus'].includes(rendererType)), [isD3, routed, rendererType]);
  
  const SpecializedRenderer = useMemo(() => 
    routed && (typeof routed === 'function' || (typeof routed === 'object' && routed.$$typeof)) ? routed : null
  , [routed]);

  const { 
    deltaState, d3Narration, setD3Narration, setDeltaState, 
    isPlaying, isPaused, isDeltaRunning, setDeltaRunning, playbackSpeed
  } = useTutorStore(useShallow(s => ({
    deltaState: s.deltaState, 
    d3Narration: s.d3Narration, 
    setD3Narration: s.setD3Narration,
    setDeltaState: s.setDeltaState,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    isDeltaRunning: s.isDeltaRunning,
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

  // Stable refs to avoid re-initializing interpreter on state updates
  const setDeltaStateRef = useRef(setDeltaState);
  useEffect(() => { setDeltaStateRef.current = setDeltaState; }, [setDeltaState]);

  const setD3NarrationRef = useRef(setD3Narration);
  useEffect(() => { setD3NarrationRef.current = setD3Narration; }, [setD3Narration]);

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
    // The interpreter and its D3 layer are now required for ALL lesson types to handle
    // global commands (camera, narrate) and AI doubt-deltas.
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
      interpreterRef.current = new VisualScriptInterpreter(setD3NarrationRef.current, d3ContainerRef.current);
      interpreterRef.current.setRenderers({ d3: d3Renderer });
    }

    return () => {
      if (interpreterRef.current) {
        interpreterRef.current.kill();
        interpreterRef.current = null;
      }
    };
  }, [isD3, isKaTeX, SpecializedRenderer, layoutReady, width, height]);

  // 2. Specialized Renderer Registration (Physics/Equation/Graph/Code)
  useEffect(() => {
    if (!SpecializedRenderer) return;

    // Poll for specialized renderers that may mount later (especially Suspense components)
    const interval = setInterval(() => {
      const interpreter = interpreterRef.current;
      // Guard: Stop polling if interpreter was killed/nullified during cleanup
      if (!interpreter) {
        clearInterval(interval);
        return;
      }

      let allRegistered = true;
      if (['physics', 'matter', 'mechanics'].includes(rendererType)) {
        if (physicsRef.current) interpreter.registerSpecializedRenderer('physics', physicsRef.current);
        else allRegistered = false;
      }
      if (['math', 'katex', 'equation', 'calculus'].includes(rendererType)) {
        if (equationRef.current) interpreter.registerSpecializedRenderer('equation', equationRef.current);
        else allRegistered = false;
      }
      if (['graph', 'desmos'].includes(rendererType)) {
        if (graphRef.current) interpreter.registerSpecializedRenderer('graph', graphRef.current);
        else allRegistered = false;
      }
      if (['code', 'monaco', 'algorithm'].includes(rendererType)) {
        if (codeRef.current) interpreter.registerSpecializedRenderer('code', codeRef.current);
        else allRegistered = false;
      }

      // Optimization: Clear interval if we've successfully registered what was expected
      if (allRegistered) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [SpecializedRenderer, layoutReady, rendererType]);

  // ─── Playback Orchestration ───
  const lastPlayedStepRef = useRef(-1);
  const lastPlayedDeltaRef = useRef(null);

  useEffect(() => {
    if (!interpreterRef.current || !layoutReady) return;

    const hasDelta = deltaState?.actions?.length > 0;
    const step = timeline?.steps?.[currentStepIndex];

    if (hasDelta) {
      // SEC-UX: Only play delta if it's a new one to prevent loops
      if (lastPlayedDeltaRef.current === deltaState.timestamp) return;
      lastPlayedDeltaRef.current = deltaState.timestamp;

      console.log('[AgentCanvasRenderer] 🚀 Playing Doubt Delta');
      if (!isDeltaRunning) setDeltaRunning(true);
      interpreterRef.current.playDelta(deltaState.actions, onDeltaComplete);
    } else {
      // SEC-UX: Only play step if index changed or we are recovering from a delta
      if (lastPlayedStepRef.current === currentStepIndex && !isDeltaRunning) return;
      lastPlayedStepRef.current = currentStepIndex;
      lastPlayedDeltaRef.current = null; // Reset delta ref when returning to standard flow

      console.log('[AgentCanvasRenderer] 📖 Standard Step Playback');
      if (isDeltaRunning) setDeltaRunning(false);
      interpreterRef.current.playStep(step?.actions || [], () => {});
    }
  }, [currentStepIndex, timeline?.steps, deltaState?.timestamp, onDeltaComplete, setDeltaRunning, layoutReady, isDeltaRunning]);


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

        {/* D3 Layer (Required for ALL subjects for animations, camera, and doubt-deltas) */}
        <div 
          ref={d3ContainerRef} 
          className="absolute inset-0 z-10 w-full h-full overflow-visible" 
          style={{ pointerEvents: (isD3 || !!deltaState) ? 'auto' : 'none' }} 
        />

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


        {/* ─── Annotation & Legacy SVG Layer ─── */}
        {/* 
            This layer handles two things:
            1. Static scene rendering for legacy topics (forceManualOnly = false)
            2. Real-time manual annotations and notes on top of any active renderer (forceManualOnly = true)
        */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <SVGCanvasRenderer 
            timeline={timeline} 
            currentStepIndex={currentStepIndex} 
            elements={combinedElements} 
            connections={extConnections} 
            steps={extSteps} 
            showNotes={showNotes} 
            forceManualOnly={isD3 || isKaTeX || !!SpecializedRenderer} 
            isD3={isD3} 
          />
        </div>
        

      </div>
    </ErrorBoundary>
  );
}