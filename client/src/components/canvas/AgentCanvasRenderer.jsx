import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import ErrorBoundary from '../common/ErrorBoundary';
import SVGCanvasRenderer from './SVGCanvasRenderer';
import KaTeXRenderer from '../../renderers/KaTeXRenderer';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';

import { D3Renderer } from '../../renderers/D3Renderer';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';

import { SceneOrchestrator } from '../../engine/SceneOrchestrator';
import { rendererPool } from '../../engine/RendererPool';

export default function AgentCanvasRenderer({
  timeline: propTimeline, currentStepIndex: propStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep,
  hideAlgoPanel = false,
  width, height, // Explicit dimensions to bypass DOM measurement
  ...doubtProps
}) {
  const { activeScene, currentStoreStepIndex, isPlaying, isPaused, playbackSpeed, setDeltaRunning, setDeltaState, deltaState } = useTutorStore(useShallow(s => ({
    activeScene: s.activeScene,
    currentStoreStepIndex: s.currentStepIndex,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    playbackSpeed: s.playbackSpeed,
    setDeltaRunning: s.setDeltaRunning,
    setDeltaState: s.setDeltaState,
    deltaState: s.deltaState,
  })));

  // Use activeScene if available, otherwise fallback to propTimeline
  const timeline = activeScene || propTimeline;
  const currentStepIndex = activeScene ? currentStoreStepIndex : propStepIndex;

  const { rendererType, routed, isDSA } = useMemo(() => {
    const type = (timeline?.renderer || 'cinematic').toLowerCase();
    return {
      rendererType: type,
      routed: getRenderer(type),
      isDSA: isDSAContent(timeline)
    };
  }, [timeline?.renderer, timeline?.title, timeline?.topic]);

  const isD3 = useMemo(() => routed === 'd3' || rendererType === 'd3' || isDSA, [routed, rendererType, isDSA]);
  const isKaTeX = useMemo(() => !isD3 && (routed === KaTeXRenderer || ['math', 'katex', 'equation', 'calculus'].includes(rendererType)), [isD3, routed, rendererType]);
  
  const SpecializedRenderer = useMemo(() => 
    routed && (typeof routed === 'function' || (typeof routed === 'object' && routed.$$typeof)) ? routed : null
  , [routed]);

  const d3ContainerRef = useRef(null);
  const physicsRef = useRef(null);
  const equationRef = useRef(null);
  const graphRef = useRef(null);
  const codeRef = useRef(null);
  const orchestratorRef = useRef(null);
  const [layoutReady, setLayoutReady] = useState(false);

  // Wait for layout
  useEffect(() => {
    const node = d3ContainerRef.current;
    if (!node) return;
    if (node.clientWidth > 0 && node.clientHeight > 0) setLayoutReady(true);
    if (typeof ResizeObserver === 'undefined') {
      setLayoutReady(true);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0 && entries[0].contentRect.height > 0) setLayoutReady(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onDeltaComplete = useCallback(() => {
    console.log('[AgentCanvasRenderer] ✅ Delta complete — resuming lesson step.');
    setDeltaRunning(false);
    setDeltaState(null);
    if (doubtProps.onResume) doubtProps.onResume();
  }, [setDeltaRunning, setDeltaState, doubtProps.onResume]);

  // 1. Orchestrator Initialization
  useEffect(() => {
    const canInitialize = d3ContainerRef.current && (layoutReady || (width && height));
    
    if (canInitialize) {
      if (orchestratorRef.current) orchestratorRef.current.destroy();

      console.log('[AgentCanvasRenderer] 🏗️ Initializing SceneOrchestrator');
      orchestratorRef.current = new SceneOrchestrator(d3ContainerRef.current, {
        onNarrate: (text) => {
          // If we have a NarrationBar listener, we could pass it here
        },
        onStepChange: (idx) => {
          // Sync back to store if needed
        }
      });

      // Register D3 renderer immediately
      const d3Renderer = rendererPool.getD3Renderer(d3ContainerRef.current, width, height);
      orchestratorRef.current.setRenderers({ d3: d3Renderer });
      
      if (timeline) {
        orchestratorRef.current.loadScene(timeline);
      }
    }

    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.destroy();
        orchestratorRef.current = null;
      }
    };
  }, [layoutReady, width, height, timeline]); // Re-load if scene object changes (identity based)

  // 2. Renderer Registration
  useEffect(() => {
    const interval = setInterval(() => {
      const orch = orchestratorRef.current;
      if (!orch) return;

      if (['physics', 'matter', 'mechanics'].includes(rendererType) && physicsRef.current) {
        orch.registerRenderer('physics', physicsRef.current);
      }
      if (['math', 'katex', 'equation', 'calculus'].includes(rendererType) && equationRef.current) {
        orch.registerRenderer('equation', equationRef.current);
      }
      if (['graph', 'desmos'].includes(rendererType) && graphRef.current) {
        orch.registerRenderer('graph', graphRef.current);
      }
      if (['code', 'monaco', 'algorithm'].includes(rendererType) && codeRef.current) {
        orch.registerRenderer('code', codeRef.current);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [rendererType, layoutReady]);

  // 3. Playback Orchestration
  const lastPlayedStepRef = useRef(-1);
  const lastPlayedDeltaRef = useRef(null);

  useEffect(() => {
    const orch = orchestratorRef.current;
    if (!orch || !layoutReady) return;

    const hasDelta = deltaState?.actions?.length > 0;

    if (hasDelta) {
      if (lastPlayedDeltaRef.current === deltaState.timestamp) return;
      lastPlayedDeltaRef.current = deltaState.timestamp;
      orch.playDelta(deltaState.actions, onDeltaComplete);
    } else {
      if (lastPlayedStepRef.current === currentStepIndex) return;
      lastPlayedStepRef.current = currentStepIndex;
      lastPlayedDeltaRef.current = null;
      orch.playStep(currentStepIndex);
    }
  }, [currentStepIndex, timeline?.steps, deltaState?.timestamp, layoutReady]);

  // Sync Playback State
  useEffect(() => {
    if (!orchestratorRef.current) return;
    if (isPlaying && !isPaused) orchestratorRef.current.resume();
    else orchestratorRef.current.pause();
  }, [isPlaying, isPaused]);

  // Sync Playback Speed
  useEffect(() => {
    if (orchestratorRef.current && playbackSpeed) orchestratorRef.current.setSpeed(playbackSpeed);
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