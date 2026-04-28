import React from 'react';
import MatterRenderer from '../components/renderers/MatterRenderer';
import NarrativeRenderer from '../components/renderers/NarrativeRenderer';
import D3Renderer from '../renderers/D3Renderer.jsx';
import KaTeXRenderer from '../renderers/KaTeXRenderer.jsx';
import AlgorithmRenderer from '../renderers/AlgorithmRenderer.jsx';

/**
 * RendererRouter v2.0
 *
 * Maps timeline 'renderer' type to the corresponding component.
 * Includes fuzzy DSA detection so AlgorithmRenderer mounts even when
 * the server returns "cinematic" for algorithmic topics.
 */
export const RENDERER_MAP = {
  'cinematic':  null,
  'matter':     MatterRenderer,
  'physics':    MatterRenderer,
  'narrative':  NarrativeRenderer,
  'd3':         D3Renderer,
  'math':       KaTeXRenderer,
  'equation':   KaTeXRenderer,
  'katex':      KaTeXRenderer,
  'algorithm':  AlgorithmRenderer,
  'dsa':        AlgorithmRenderer,
  'sorting':    AlgorithmRenderer,
  'searching':  AlgorithmRenderer,
};

// Keywords that signal algorithm/DSA content
const DSA_KEYWORDS = [
  'algorithm','dsa','sorting','searching','sort','search',
  'binary','linear','bubble','merge','quick','insertion','selection',
  'array','tree','graph','stack','queue','linked','heap','bfs','dfs','traversal',
];

export function isDSAContent(timeline) {
  if (!timeline) return false;
  const rendererType = (timeline.renderer || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => rendererType.includes(k))) return true;
  const title = (timeline.title || timeline.topic || '').toLowerCase();
  if (DSA_KEYWORDS.some(k => title.includes(k))) return true;
  const elements = timeline.elements || timeline.objects || [];
  if (elements.some(e => (e.type || '').toLowerCase() === 'array' && Array.isArray(e.values))) return true;
  return false;
}

export function getRenderer(type) {
  return RENDERER_MAP[type] || null;
}