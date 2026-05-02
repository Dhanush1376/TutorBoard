/**
 * CanvasControls — Floating zoom/navigation controls for the infinite canvas
 * Premium minimalist design
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Lock, LockOpen, Map } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import useWindowSize from '../../hooks/useWindowSize';

const CtrlBtn = ({ onClick, disabled, title, children, active, danger }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={title}
        style={{
          padding: '6px',
          borderRadius: '8px',
          border: 'none',
          background: active
            ? danger ? 'rgba(245,158,11,0.1)' : 'rgba(var(--text-primary-rgb,0,0,0),0.06)'
            : hovered && !disabled ? 'rgba(var(--text-primary-rgb,0,0,0),0.04)' : 'transparent',
          color: disabled
            ? 'var(--text-tertiary)'
            : danger && active
              ? '#f59e0b'
              : active
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.25 : hovered ? 1 : 0.7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.12s ease',
        }}
      >
        {children}
      </button>
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
  const { isMobile } = useWindowSize();

  // Hide controls on mobile if sidebar is open to avoid overlap/clutter
  if (isMobile && isSidebarOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`tb-canvas-controls absolute ${isMobile ? 'bottom-24' : 'bottom-5'} ${isLeftHand ? 'right-5' : 'left-5'} z-50 flex items-center gap-0.5 pointer-events-auto`}
      style={{
        borderRadius: '12px',
        padding: '4px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
    >
      {/* Zoom Out */}
      <CtrlBtn onClick={onZoomOut} disabled={isCanvasLocked} title="Zoom out">
        <ZoomOut size={13} strokeWidth={1.8} />
      </CtrlBtn>

      {/* Zoom Level */}
      <button
        onClick={() => !isCanvasLocked && onResetView?.()}
        disabled={isCanvasLocked}
        title="Reset zoom"
        style={{
          padding: '3px 4px',
          minWidth: '38px',
          textAlign: 'center',
          fontSize: '10px',
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          fontFamily: '"Geist Mono", "SF Mono", monospace',
          letterSpacing: '0.01em',
          background: 'transparent',
          border: 'none',
          cursor: isCanvasLocked ? 'not-allowed' : 'pointer',
          borderRadius: '6px',
          transition: 'all 0.12s',
          opacity: isCanvasLocked ? 0.3 : 0.6,
        }}
      >
        {zoomPercent}%
      </button>

      {/* Zoom In */}
      <CtrlBtn onClick={onZoomIn} disabled={isCanvasLocked} title="Zoom in">
        <ZoomIn size={13} strokeWidth={1.8} />
      </CtrlBtn>

      {/* Divider */}
      <div style={{ width: '1px', height: '12px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Fit / Maximize */}
      <CtrlBtn onClick={onFitToContent} disabled={isCanvasLocked} title="Fit to content">
        {isSidebarOpen ? <Maximize2 size={13} strokeWidth={1.8} /> : <Minimize2 size={13} strokeWidth={1.8} />}
      </CtrlBtn>

      {/* Reset View */}
      <CtrlBtn onClick={onResetView} disabled={isCanvasLocked} title="Reset view">
        <RotateCcw size={13} strokeWidth={1.8} />
      </CtrlBtn>

      {/* Minimap Toggle */}
      <CtrlBtn onClick={onToggleMinimap} title={showMinimap ? "Hide minimap" : "Show minimap"} active={showMinimap}>
        <Map size={13} strokeWidth={1.8} />
      </CtrlBtn>

      {/* Divider */}
      <div style={{ width: '1px', height: '12px', background: 'var(--border-color)', margin: '0 2px' }} />

      {/* Lock Toggle */}
      <CtrlBtn
        onClick={() => setCanvasLocked(!isCanvasLocked)}
        title={isCanvasLocked ? "Unlock canvas" : "Lock canvas"}
        active={isCanvasLocked}
        danger
      >
        {isCanvasLocked ? <Lock size={13} strokeWidth={1.8} /> : <LockOpen size={13} strokeWidth={1.8} />}
      </CtrlBtn>
    </motion.div>
  );
};

export default CanvasControls;
