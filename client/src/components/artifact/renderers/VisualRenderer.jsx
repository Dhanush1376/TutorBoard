import React from 'react';
import FlowRenderer from './engines/FlowRenderer';

/**
 * VisualRenderer — static preview of a saved visual artifact inside the
 * Artifact side panel. Every artifactClass we persist (whiteboard, mindmap,
 * flowchart, chart, timeline, …) stores a node/edge sceneGraph, so they all
 * render through the versatile ReactFlow-based FlowRenderer. (Live, animated
 * playback of the same scene happens on the main canvas via
 * openArtifactOnCanvas → SceneOrchestrator; this panel is the lightweight
 * preview/fallback.)
 *
 * The previous "Coming soon in Phase 3" placeholders for the whiteboard and
 * chart classes meant reopening any saved visualization showed a blank stub.
 */
export default function VisualRenderer({ sceneGraph, onElementClick, onElementMove }) {
  if (!sceneGraph) return null;

  return (
    <FlowRenderer
      sceneGraph={sceneGraph}
      onElementClick={onElementClick}
      onElementMove={onElementMove}
    />
  );
}
