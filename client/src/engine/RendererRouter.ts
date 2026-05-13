import React from 'react';
const KaTeXRenderer = React.lazy(() => import('../renderers/KaTeXRenderer'));

// ── Types ────────────────────────────────────────────────────────────────────

export type RendererType = 
  | 'd3' | 'katex' | 'desmos' | 'matter' | 'three' 
  | 'monaco' | 'simulator' | 'narrative';

export type RoutedRenderer = string | React.LazyExoticComponent<React.ComponentType<any>>;

// ── Heavy renderers are lazy-loaded ──────────────────────────────────────────

const MatterRenderer     = React.lazy(() => import('../components/renderers/MatterRenderer'));
const NarrativeRenderer  = React.lazy(() => import('../components/renderers/NarrativeRenderer'));
const DesmosRenderer     = React.lazy(() => import('../components/renderers/DesmosRenderer'));
const ThreeRenderer      = React.lazy(() => import('../components/renderers/ThreeRenderer'));
const MonacoRenderer     = React.lazy(() => import('../components/renderers/MonacoRenderer'));
const SimulatorRenderer  = React.lazy(() => import('../components/renderers/SimulatorRenderer'));

export const RENDERER_MAP: Record<string, RoutedRenderer> = {
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
  'math':       KaTeXRenderer as any, // Typed specifically in component
  'equation':   KaTeXRenderer as any,
  'katex':      KaTeXRenderer as any,
  'calculus':   KaTeXRenderer as any,
  'desmos':     DesmosRenderer,
  'plot':       DesmosRenderer,
  'graph':      'd3', // Typically implies a node/edge graph; use D3
  'diagram':    'd3', // Alias for node maps
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

export function isDSAContent(timeline: any): boolean {
  if (!timeline) return false;
  const rendererType = (timeline.renderer || '').toLowerCase();
  
  // D3 is used for both cinematic and algorithm sessions. 
  // We only treat it as DSA if it has explicit indicators.
  if (rendererType === 'd3' && (timeline.type === 'algorithm' || timeline.isDSA)) return true;

  if (DSA_KEYWORDS.some(k => rendererType.includes(k))) return true;
  const title = (timeline.title || timeline.topic || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => title.includes(k))) return true;
  
  const elements = timeline.elements || timeline.objects || [];
  if (Array.isArray(elements)) {
    if (elements.some((e: any) => (e.type || '').toLowerCase() === 'array' && Array.isArray(e.values))) return true;
  }
  
  return false;
}

export function getRenderer(type: string): RoutedRenderer {
  const routed = RENDERER_MAP[type.toLowerCase()];
  if (routed) return routed;

  // Safe fallback for physics topics
  if (['matter', 'physics', 'mechanics'].includes(type.toLowerCase())) {
    return RENDERER_MAP['physics'] || 'd3';
  }

  console.warn(`[RendererRouter] ⚠️ Unknown renderer type: "${type}". Falling back to cinematic D3 engine.`);
  return 'd3';
}