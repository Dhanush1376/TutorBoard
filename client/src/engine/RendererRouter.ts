import MatterRenderer from '../components/renderers/MatterRenderer';
import NarrativeRenderer from '../components/renderers/NarrativeRenderer';
import KaTeXRenderer from '../renderers/KaTeXRenderer';
import AlgorithmRenderer from '../renderers/AlgorithmRenderer.jsx';
import DesmosRenderer from '../components/renderers/DesmosRenderer';

export const RENDERER_MAP: Record<string, any> = {
  'cinematic':  null,
  'matter':     MatterRenderer,
  'physics':    MatterRenderer,
  'narrative':  NarrativeRenderer,
  'history':    NarrativeRenderer,
  'biology':    NarrativeRenderer,
  'math':       KaTeXRenderer,
  'equation':   KaTeXRenderer,
  'katex':      KaTeXRenderer,
  'desmos':     DesmosRenderer,
  'graph':      DesmosRenderer,
  'algorithm':  AlgorithmRenderer,
  'dsa':        AlgorithmRenderer,
  'sorting':    AlgorithmRenderer,
  'searching':  AlgorithmRenderer,
  'd3':         null, // handled specially in AgentCanvasRenderer
};

const DSA_KEYWORDS = [
  'algorithm','dsa','sorting','searching','sort','search',
  'binary','linear','bubble','merge','quick','insertion','selection',
  'array','tree','graph','stack','queue','linked','heap','bfs','dfs','traversal',
];

export function isDSAContent(timeline: any) {
  if (!timeline) return false;
  const rendererType = (timeline.renderer || '').toLowerCase();
  
  // If it specifically asks for D3, it is NOT legacy DSA AlgorithmRenderer
  if (rendererType === 'd3') return false; 

  if (DSA_KEYWORDS.some(k => rendererType.includes(k))) return true;
  const title = (timeline.title || timeline.topic || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => title.includes(k))) return true;
  const elements = timeline.elements || timeline.objects || [];
  if (elements.some((e: any) => (e.type || '').toLowerCase() === 'array' && Array.isArray(e.values))) return true;
  return false;
}

export function getRenderer(type: string) {
  return RENDERER_MAP[type] || null;
}