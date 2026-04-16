import React from 'react';

// Context for child components to access canvas controls 
// Moved to standalone file to prevent circular dependencies between InfiniteCanvas and CanvasOverlay
export const CanvasContext = React.createContext({
  transform: { x: 0, y: 0, scale: 1 },
  zoomIn: () => {},
  zoomOut: () => {},
  resetView: () => {},
  fitToContent: () => {},
  centerOn: () => {},
});
