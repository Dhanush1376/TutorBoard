/**
 * CanvasControls — Floating zoom/navigation controls for the infinite canvas
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Lock, LockOpen, Map } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

// Small tooltip helper
const Tip = ({ label }) => (
  <div style={{
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 400,
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    letterSpacing: '0.02em',
    zIndex: 9999,
  }}>
    {label}
  </div>
);

const CtrlBtn = ({ onClick, disabled, title, children, active, danger }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '7px',
          borderRadius: '10px',
          border: 'none',
          background: active
            ? danger ? 'rgba(245,158,11,0.12)' : 'rgba(var(--text-primary-rgb,0,0,0),0.06)'
            : 'transparent',
          color: disabled
            ? 'var(--text-tertiary)'
            : danger && active
            ? '#f59e0b'
            : active
            ? 'var(--text-primary)'
            : 'var(--text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.3 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          transform: hovered && !disabled ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {children}
      </button>
      {hovered && !disabled && <Tip label={title} />}
    </div>
  );
};

const CanvasControls = ({ 
  transform, 
  onZoomIn, 
  onZoomOut, 
  onFitToContent, 
  onResetView,
  onToggleMinimap,
  showMinimap = false,
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
      className={`tb-canvas-controls absolute bottom-6 ${isLeftHand ? 'right-6' : 'left-6'} z-50 flex items-center gap-1 pointer-events-auto`}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '5px',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      {/* Zoom Out */}
      <CtrlBtn onClick={onZoomOut} disabled={isCanvasLocked} title="Zoom out (−)">
        <ZoomOut size={14} />
      </CtrlBtn>

      {/* Zoom Level — clickable to reset to 100% */}
      <button
        onClick={() => !isCanvasLocked && onResetView?.()}
        disabled={isCanvasLocked}
        title="Reset zoom (0)"
        style={{
          padding: '4px 6px',
          minWidth: '42px',
          textAlign: 'center',
          fontSize: '10px',
          fontWeight: 400,
          color: 'var(--text-tertiary)',
          fontFamily: '"Geist Mono", monospace',
          letterSpacing: '0.02em',
          background: 'transparent',
          border: 'none',
          cursor: isCanvasLocked ? 'not-allowed' : 'pointer',
          borderRadius: '8px',
          transition: 'all 0.15s',
          opacity: isCanvasLocked ? 0.4 : 1,
        }}
        onMouseEnter={e => { if (!isCanvasLocked) e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        {zoomPercent}%
      </button>

      {/* Zoom In */}
      <CtrlBtn onClick={onZoomIn} disabled={isCanvasLocked} title="Zoom in (+)">
        <ZoomIn size={14} />
      </CtrlBtn>

      {/* Divider */}
      <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 2px', opacity: 0.6 }} />

      {/* Fit / Maximize */}
      <CtrlBtn
        onClick={onFitToContent}
        disabled={isCanvasLocked}
        title={isSidebarOpen ? "Fit to content" : "Restore sidebar"}
      >
        {isSidebarOpen ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
      </CtrlBtn>

      {/* Reset View */}
      <CtrlBtn onClick={onResetView} disabled={isCanvasLocked} title="Reset view (R)">
        <RotateCcw size={14} />
      </CtrlBtn>

      {/* Minimap Toggle */}
      <CtrlBtn
        onClick={onToggleMinimap}
        title={showMinimap ? "Hide minimap" : "Show minimap"}
        active={showMinimap}
      >
        <Map size={14} />
      </CtrlBtn>

      {/* Divider */}
      <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 2px', opacity: 0.6 }} />

      {/* Lock Toggle */}
      <CtrlBtn
        onClick={() => setCanvasLocked(!isCanvasLocked)}
        title={isCanvasLocked ? "Unlock canvas (L)" : "Lock canvas (L)"}
        active={isCanvasLocked}
        danger
      >
        {isCanvasLocked ? <Lock size={14} /> : <LockOpen size={14} />}
      </CtrlBtn>
    </motion.div>
  );
};

export default CanvasControls;
