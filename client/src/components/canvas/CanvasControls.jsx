/**
 * CanvasControls — Floating zoom/navigation controls for the infinite canvas
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Lock, LockOpen } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const CanvasControls = ({ 
  transform, 
  onZoomIn, 
  onZoomOut, 
  onFitToContent, 
  onResetView,
  layoutView = 'right',
  isSidebarOpen = true,
}) => {
  const { isCanvasLocked, setCanvasLocked } = useTutorStore();
  const zoomPercent = Math.round(transform.scale * 100);
  const isLeftHand = layoutView === 'left';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9, x: isLeftHand ? 20 : -20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`tb-canvas-controls absolute bottom-6 ${isLeftHand ? 'right-6' : 'left-6'} z-50 flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-1.5 shadow-lg pointer-events-auto`}
    >
      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        disabled={isCanvasLocked}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          isCanvasLocked 
            ? 'opacity-30 cursor-not-allowed text-[var(--text-tertiary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title="Zoom out (−)"
      >
        <ZoomOut size={15} />
      </button>

      {/* Zoom Level Display */}
      <div className="px-1 py-1 min-w-[48px] text-center">
        <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums tracking-tight">
          {zoomPercent}%
        </span>
      </div>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        disabled={isCanvasLocked}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          isCanvasLocked 
            ? 'opacity-30 cursor-not-allowed text-[var(--text-tertiary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title="Zoom in (+)"
      >
        <ZoomIn size={15} />
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border-color)] mx-1" />

      {/* Maximize / Fit to Content */}
      <button
        onClick={onFitToContent}
        disabled={isCanvasLocked}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          isCanvasLocked 
            ? 'opacity-30 cursor-not-allowed text-[var(--text-tertiary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title={isSidebarOpen ? "Maximize / Fit to content" : "Minimize / Restore view"}
      >
        {isSidebarOpen ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
      </button>

      {/* Reset View */}
      <button
        onClick={onResetView}
        disabled={isCanvasLocked}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          isCanvasLocked 
            ? 'opacity-30 cursor-not-allowed text-[var(--text-tertiary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title="Reset view (0)"
      >
        <RotateCcw size={15} />
      </button>



      {/* Lock Toggle */}
      <button
        onClick={() => setCanvasLocked(!isCanvasLocked)}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          isCanvasLocked 
            ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' 
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title={isCanvasLocked ? "Unlock Viewport" : "Lock Viewport"}
      >
        {isCanvasLocked ? <Lock size={15} /> : <LockOpen size={15} />}
      </button>
    </motion.div>
  );
};

export default CanvasControls;
