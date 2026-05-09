import React, { useEffect, useRef, useMemo, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import ErrorBoundary from '../common/ErrorBoundary';
import SVGCanvasRenderer from './SVGCanvasRenderer';
import KaTeXRenderer from '../../renderers/KaTeXRenderer';
import { isDSAContent, getRenderer } from '../../engine/RendererRouter';

import { D3Renderer } from '../../renderers/D3Renderer';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';

import { SceneOrchestrator } from '../../engine/SceneOrchestrator';
import { rendererPool } from '../../engine/RendererPool';

const AgentCanvasRenderer = forwardRef(({
  timeline: propTimeline, currentStepIndex: propStepIndex,
  elements: extElements = [], objects: extObjects = [],
  connections: extConnections, steps: extSteps,
  showNotes, onGoToStep,
  hideAlgoPanel = false,
  width, height, // Explicit dimensions to bypass DOM measurement
  ...doubtProps
}, ref) => {
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.resetCamera();
      }
    }
  }));

  // Wait for layout
  useEffect(() => {
    const node = d3ContainerRef.current;
    if (!node) return;

    const check = () => {
      if (node.clientWidth > 0 && node.clientHeight > 0) {
        requestAnimationFrame(() => setLayoutReady(true));
        return true;
      }
      return false;
    };

    if (check()) return;

    if (typeof ResizeObserver === 'undefined') {
      setLayoutReady(true);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
        requestAnimationFrame(() => setLayoutReady(true));
      }
    });
    observer.observe(node);

    // Fallback if ResizeObserver never fires with positive dimensions
    const fallback = setTimeout(() => {
      setLayoutReady(true);
    }, 150);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  const onDeltaComplete = useCallback(() => {
    console.log('[AgentCanvasRenderer] ✅ Delta complete — resuming lesson step.');
    setDeltaRunning(false);
    setDeltaState(null);
    if (doubtProps.onResume) doubtProps.onResume();
  }, [setDeltaRunning, setDeltaState, doubtProps.onResume]);

  const lastSceneIdRef = useRef(null);

  // 1. Orchestrator Initialization
  useEffect(() => {
    const canInitialize = d3ContainerRef.current && (layoutReady || (width && height));
    if (!canInitialize) return;

    // Only re-initialize if the scene actually changed (by ID or title)
    const sceneId = timeline?.id || timeline?.title || 'default';
    const isNewScene = lastSceneIdRef.current !== sceneId;

    if (isNewScene) {
      if (orchestratorRef.current) orchestratorRef.current.destroy();

      console.log('[AgentCanvasRenderer] 🏗️ Initializing SceneOrchestrator for scene:', sceneId);
      orchestratorRef.current = new SceneOrchestrator(d3ContainerRef.current, {
        onNarrate: (text) => {},
        onStepChange: (idx) => {}
      });

      // Register D3 renderer immediately
      const d3Renderer = rendererPool.getD3Renderer(d3ContainerRef.current, width, height);
      orchestratorRef.current.setRenderers({ d3: d3Renderer });
      
      if (timeline) {
        orchestratorRef.current.loadScene(timeline);
      }
      lastSceneIdRef.current = sceneId;
    }

    return () => {
      // Don't destroy on every effect run unless it's a genuine unmount
      // or we have a new scene (handled above)
    };
  }, [layoutReady, width, height, timeline?.id, timeline?.title]); // Use primitive properties for stability

  // 2. Renderer Registration via Ref Callbacks
  const registerSpecialized = useCallback((type, node) => {
    const orch = orchestratorRef.current;
    if (!orch || !node) return;
    
    console.log(`[AgentCanvasRenderer] 🛰️ Registering specialized renderer: ${type}`);
    orch.registerRenderer(type, node);
  }, []);


  // 3. Playback Orchestration
  const lastPlayedStepRef = useRef(-1);
  const lastPlayedDeltaRef = useRef(null);
  const lastWidthRef = useRef(0);

  useEffect(() => {
    const orch = orchestratorRef.current;
    if (!orch || (!layoutReady && !(width && height))) return;

    const hasDelta = deltaState?.actions?.length > 0;
    const dimensionsChanged = lastWidthRef.current !== dimensions.width;
    lastWidthRef.current = dimensions.width;

    if (hasDelta) {
      if (lastPlayedDeltaRef.current === deltaState.timestamp) return;
      lastPlayedDeltaRef.current = deltaState.timestamp;
      orch.playDelta(deltaState.actions, onDeltaComplete);
    } else {
      if (lastPlayedStepRef.current === currentStepIndex && !dimensionsChanged) return;
      
      // If dimensions changed, sync the renderer's logical coordinate system first
      if (dimensions.width > 0 && dimensions.height > 0) {
        const d3Renderer = orch.getRenderer('d3');
        if (d3Renderer && typeof d3Renderer.resize === 'function') {
          d3Renderer.resize(dimensions.width, dimensions.height);
        }
      }

      lastPlayedStepRef.current = currentStepIndex;
      lastPlayedDeltaRef.current = null;
      orch.playStep(currentStepIndex);
    }
  }, [currentStepIndex, timeline?.steps, deltaState?.timestamp, layoutReady, dimensions.width]);

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
          style={{ 
            pointerEvents: (isD3 || !!deltaState) ? 'auto' : 'none',
            minHeight: '400px' // Ensure ResizeObserver always fires
          }} 
        />

        {/* KaTeX Content */}
        {isKaTeX && (
          <div className="absolute inset-0 z-0 flex items-center justify-center p-8">
            <KaTeXRenderer 
              ref={(node) => {
                equationRef.current = node;
                if (node) registerSpecialized('equation', node);
              }}
              timeline={timeline} 
              currentStepIndex={currentStepIndex} 
            />
          </div>
        )}

        {/* Other Specialized Renderers (Matter, Three, Desmos) — lazy loaded */}
        {!isKaTeX && !isD3 && SpecializedRenderer && (
          <div className="absolute inset-0 z-0">
            <ErrorBoundary 
              key={rendererType} 
              fallback={(error) => (
                <div className="flex flex-col items-center justify-center w-full h-full bg-black/40 backdrop-blur-sm rounded-3xl border border-red-500/20 text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                    <AlertTriangle size={24} className="text-red-500" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Animation failed</h3>
                  <p className="text-zinc-400 text-xs max-w-xs">{error.message}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 text-xs text-white/60 hover:text-white underline underline-offset-4"
                  >
                    Reload interface
                  </button>
                </div>
              )}
            >
              <React.Suspense fallback={
                <div className="flex items-center justify-center w-full h-full text-white/30 text-sm">
                  Loading renderer...
                </div>
              }>
                <SpecializedRenderer
                  ref={(node) => {
                    if (!node) return;
                    if (['physics', 'matter', 'mechanics'].includes(rendererType)) {
                      physicsRef.current = node;
                      registerSpecialized('physics', node);
                    }
                    if (['graph', 'desmos'].includes(rendererType)) {
                      graphRef.current = node;
                      registerSpecialized('graph', node);
                    }
                    if (['code', 'monaco', 'algorithm'].includes(rendererType)) {
                      codeRef.current = node;
                      registerSpecialized('code', node);
                    }
                    if (['math', 'equation'].includes(rendererType)) {
                      equationRef.current = node;
                      registerSpecialized('equation', node);
                    }
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
            </ErrorBoundary>
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
});

export default AgentCanvasRenderer;