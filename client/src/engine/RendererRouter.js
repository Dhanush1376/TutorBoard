import React from 'react';
import MatterRenderer from '../components/renderers/MatterRenderer';
import NarrativeRenderer from '../components/renderers/NarrativeRenderer';
import D3Renderer from '../renderers/D3Renderer.jsx';
import KaTeXRenderer from '../renderers/KaTeXRenderer.jsx';
import AlgorithmRenderer from '../renderers/AlgorithmRenderer.jsx';

/**
 * RendererRouter v1.1
 * 
 * Maps timeline 'renderer' type to the corresponding high-fidelity component.
 */
export const RENDERER_MAP = {
  'cinematic': 'SVGCanvasRenderer', // Default handled by AgentCanvasRenderer
  'matter':    MatterRenderer,
  'physics':   MatterRenderer,
  'narrative': NarrativeRenderer,
  'd3':        D3Renderer,
  'math':      KaTeXRenderer,
  'equation':  KaTeXRenderer,
  'algorithm': AlgorithmRenderer,
  'dsa':       AlgorithmRenderer,
  'sorting':   AlgorithmRenderer,
  'searching': AlgorithmRenderer,
};

export function getRenderer(type) {
  return RENDERER_MAP[type] || null;
}
