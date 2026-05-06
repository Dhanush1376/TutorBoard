import KaTeXRenderer from '../renderers/KaTeXRenderer';
import React from 'react';

// Heavy renderers are lazy-loaded to prevent crashing the initial bundle
// (Three.js / Matter.js module-level code can fail without WebGL context)
const MatterRenderer     = React.lazy(() => import('../components/renderers/MatterRenderer'));
const NarrativeRenderer  = React.lazy(() => import('../components/renderers/NarrativeRenderer'));
const DesmosRenderer     = React.lazy(() => import('../components/renderers/DesmosRenderer'));
const ThreeRenderer      = React.lazy(() => import('../components/renderers/ThreeRenderer'));
const MonacoRenderer     = React.lazy(() => import('../components/renderers/MonacoRenderer'));
const SimulatorRenderer  = React.lazy(() => import('../components/renderers/SimulatorRenderer'));

export const RENDERER_MAP: Record<string, any> = {
  'cinematic':  'd3',
  'simulator':  SimulatorRenderer,
  'matter':     MatterRenderer,
  'physics':    MatterRenderer,
  'mechanics':  MatterRenderer,
  'narrative':  NarrativeRenderer,
  'history':    'd3',
  'social':     'd3',
  'biology':    'd3',
  'chemistry':  'd3',
  'statistics': 'd3',
  'stats':      'd3',
  'data':       'd3',
  'math':       KaTeXRenderer,
  'equation':   KaTeXRenderer,
  'katex':      KaTeXRenderer,
  'calculus':   KaTeXRenderer,
  'desmos':     DesmosRenderer,
  'graph':      DesmosRenderer,
  'algorithm':  'd3',
  'dsa':        'd3',
  'sorting':    'd3',
  'searching':  'd3',
  'd3':         'd3',
  'three':      ThreeRenderer,
  '3d':         ThreeRenderer,
  'advanced':   ThreeRenderer,
  'programming': MonacoRenderer,
  'code':        MonacoRenderer,
  'software':    MonacoRenderer,
  'computer_science': MonacoRenderer,
};

const DSA_KEYWORDS = [
  'algorithm','dsa','sorting','searching','sort','search',
  'binary','linear','bubble','merge','quick','insertion','selection',
  'array','tree','graph','stack','queue','linked','heap','bfs','dfs','traversal',
];

export function isDSAContent(timeline: any) {
  if (!timeline) return false;
  const rendererType = (timeline.renderer || '').toLowerCase();
  
  if (rendererType === 'd3') return true; 

  if (DSA_KEYWORDS.some(k => rendererType.includes(k))) return true;
  const title = (timeline.title || timeline.topic || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => title.includes(k))) return true;
  const elements = timeline.elements || timeline.objects || [];
  if (elements.some((e: any) => (e.type || '').toLowerCase() === 'array' && Array.isArray(e.values))) return true;
  return false;
}

export function getRenderer(type: string) {
  const routed = RENDERER_MAP[type];
  if (routed) return routed;

  // Safe fallback for physics topics
  if (['matter', 'physics', 'mechanics'].includes(type)) {
    return RENDERER_MAP['physics'] || 'd3';
  }

  console.warn(`[RendererRouter] ⚠️ Unknown renderer type: "${type}". Falling back to cinematic D3 engine.`);
  return 'd3';
}