import React from 'react';
import MatterRenderer from '../components/renderers/MatterRenderer';
import NarrativeRenderer from '../components/renderers/NarrativeRenderer';
import D3Renderer from '../renderers/D3Renderer.jsx';
import KaTeXRenderer from '../renderers/KaTeXRenderer.jsx';

/**
 * RendererRouter v1.0
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
  'equation':  KaTeXRenderer
};

export function getRenderer(type) {
  return RENDERER_MAP[type] || null;
}
