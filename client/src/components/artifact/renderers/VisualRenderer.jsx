import React from 'react';
import FlowRenderer from './engines/FlowRenderer';

// Classification mapping for different rendering engines
const FLOW_CLASSES = [
  'flowchart', 'system_architecture', 'network',
  'erd', 'uml', 'tree', 'pipeline'
];

const CANVAS_CLASSES = [
  'whiteboard', 'wireframe', 'ui_mockup', 'infographic', 'mindmap'
];

const CHART_CLASSES = [
  'chart', 'dashboard', 'timeline', 'roadmap', 'kanban'
];

export default function VisualRenderer({ sceneGraph, artifactClass, onElementClick, onElementMove }) {
  if (!sceneGraph) return null;

  // Route to the appropriate engine
  if (FLOW_CLASSES.includes(artifactClass)) {
    return (
      <FlowRenderer 
        sceneGraph={sceneGraph} 
        onElementClick={onElementClick} 
        onElementMove={onElementMove} 
      />
    );
  }

  if (CANVAS_CLASSES.includes(artifactClass)) {
    // Placeholder for KonvaRenderer
    return (
      <FlowRenderer 
        sceneGraph={sceneGraph} 
        onElementClick={onElementClick} 
        onElementMove={onElementMove} 
      />
    );
  }

  if (CHART_CLASSES.includes(artifactClass)) {
    // Placeholder for ChartRenderer
    return (
      <FlowRenderer 
        sceneGraph={sceneGraph} 
        onElementClick={onElementClick} 
        onElementMove={onElementMove} 
      />
    );
  }

  // Default to FlowRenderer as it's the most versatile
  return (
    <FlowRenderer 
      sceneGraph={sceneGraph} 
      onElementClick={onElementClick} 
      onElementMove={onElementMove} 
    />
  );
}
