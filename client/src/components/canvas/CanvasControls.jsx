/**
 * CanvasControls — Floating zoom/navigation controls for the infinite canvas
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Map } from 'lucide-react';

const CanvasControls = ({ 
  transform, 
  onZoomIn, 
  onZoomOut, 
  onFitToContent, 
  onResetView,
  onToggleMinimap,
  showMinimap = false,
}) => {
  const zoomPercent = Math.round(transform.scale * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-6 right-6 z-50 flex items-center gap-1 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl p-1.5 shadow-2xl"
    >
      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-90"
        title="Zoom out (−)"
      >
        <ZoomOut size={16} />
      </button>

      {/* Zoom Level Display */}
      <div className="px-2 py-1 min-w-[52px] text-center">
        <span className="text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums tracking-tight">
          {zoomPercent}%
        </span>
      </div>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-90"
        title="Zoom in (+)"
      >
        <ZoomIn size={16} />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--border-color)] mx-0.5" />

      {/* Fit to Content */}
      <button
        onClick={onFitToContent}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-90"
        title="Fit to content"
      >
        <Maximize2 size={16} />
      </button>

      {/* Reset View */}
      <button
        onClick={onResetView}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-90"
        title="Reset view (0)"
      >
        <RotateCcw size={16} />
      </button>

      {/* Minimap Toggle */}
      <button
        onClick={onToggleMinimap}
        className={`p-2 rounded-xl transition-all active:scale-90 ${
          showMinimap 
            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }`}
        title="Toggle minimap"
      >
        <Map size={16} />
      </button>
    </motion.div>
  );
};

export default CanvasControls;
