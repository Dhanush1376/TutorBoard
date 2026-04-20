import React, { Component, useRef } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';

/**
 * Board — Legacy Visual Engine (v1.0)
 * 
 * [LEGACY] This component was used for early template-based visuals.
 * The application now uses the CINEMATIC AGENT RENDERER (v4.0) for all live sessions.
 * 
 * This file is preserved only for backward compatibility with components that 
 * still import it, but its internal rendering logic has been phased out.
 */

// ─── ERROR BOUNDARY ─── Catches rendering crashes
class BoardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[TutorBoard] Legacy Board renderer crashed:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const Board = ({ 
  stepData, 
  steps, 
  currentStep, 
  domain = 'general', 
  visualizationType = 'concept'
}) => {
  const containerRef = useRef(null);

  // Still provide the container for backward compatibility with TeachingModal if needed
  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-transparent overflow-hidden">
      <BoardErrorBoundary>
         {/* Renderers removed — logic phased into AgentCanvasRenderer */}
      </BoardErrorBoundary>
    </div>
  );
};

export default Board;
