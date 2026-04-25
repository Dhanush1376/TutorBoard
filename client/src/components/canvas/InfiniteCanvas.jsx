import React, { useState, useRef, useCallback, useEffect, memo, useImperativeHandle } from 'react';
import useTutorStore from '../../store/tutorStore';
import { getToolCursor } from '../../utils/cursors';
import CanvasOverlay from './CanvasOverlay';
import { CanvasContext } from './CanvasContext';
import CodeVisualizerModal from './CodeVisualizerModal';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const ZOOM_SENSITIVITY = 0.002;
const INERTIA_FRICTION = 0.92;
const INERTIA_THRESHOLD = 0.5;


const InfiniteCanvas = memo(React.forwardRef(({ 
  children, 
  overlay,
  onZoomChange, 
  onViewportChange,
  onInteractionStart,
  onInteractionEnd,
  onDoubleClick,
  onClick,
  deselectAll,
  className = '',
  initialTransform = null,
}, ref) => {
  // Transform state
  const [transform, setTransform] = useState(initialTransform || { x: 0, y: 0, scale: 1 });
  const [transitionStyle, setTransitionStyle] = useState('transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)');
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringContent, setIsHoveringContent] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const transformRef = useRef(transform);

  const activeTool = useTutorStore(state => state.activeTool);
  const showGrid   = useTutorStore(state => state.showGrid);
  const gridType   = useTutorStore(state => state.gridType);
  const gridSize   = useTutorStore(state => state.gridSize);
  const isSidebarOpen = useTutorStore(state => state.isSidebarOpen);
  const layoutView = useTutorStore(state => state.layoutView);
  const isRightHand = layoutView === 'right';
  const isCanvasLocked = useTutorStore(state => state.isCanvasLocked);
  const isInteracting  = useTutorStore(state => state.isInteracting);
  const { user } = useAuth();

  // Refs for performance (no re-renders during interaction)
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const gridRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const inertiaFrame = useRef(null);
  const lastPinchDist = useRef(0);
  const lastPinchCenter = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false);
  
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  
  // Refs for settings to prevent stale closures in requestAnimationFrame (Bug 42 Fix)
  const gridSizeRef = useRef(gridSize);
  const gridTypeRef = useRef(gridType);
  const showGridRef = useRef(showGrid);

  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
  useEffect(() => { gridTypeRef.current = gridType; }, [gridType]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);

  // Keep ref in sync
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Handle Spacebar for panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && 
          !document.activeElement.isContentEditable) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space' && !document.activeElement.isContentEditable) setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // BUG FIX #55: Clean up inertia animation frame on unmount
  useEffect(() => {
    return () => {
      if (inertiaFrame.current) {
        cancelAnimationFrame(inertiaFrame.current);
        inertiaFrame.current = null;
      }
    };
  }, []);

  // AUTO-CENTER ON MOUNT
  useEffect(() => {
    if (initialTransform) return;
    
    const center = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Layout hasn't settled, try again next frame
        requestAnimationFrame(center);
        return;
      }

      const newTransform = {
        x: Math.round(rect.width / 2 - 400),
        y: Math.round(rect.height / 2 - 300),
        scale: 1,
      };
      setTransform(newTransform);
      transformRef.current = newTransform;
      applyTransform(newTransform);
    };

    // Delay slightly to ensure layout settle (especially with sidebars)
    const timer = setTimeout(center, 80);
    return () => clearTimeout(timer);
  }, [initialTransform, isSidebarOpen, isRightHand]); // Re-run if layout changes during mount

  // Apply transform via CSS (no React re-render)
  const applyTransform = useCallback((t) => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
    // High-performance Grid synchronization
    if (gridRef.current && showGridRef.current && gridTypeRef.current !== 'none') {
      const s = t.scale;
      const gs = gridSizeRef.current;
      const mSize = gs * s;
      const MSize = gs * 5 * s;
      
      if (gridTypeRef.current === 'dots') {
        gridRef.current.style.backgroundSize = `${mSize}px ${mSize}px, ${MSize}px ${MSize}px`;
        gridRef.current.style.backgroundPosition = `${t.x % mSize}px ${t.y % mSize}px, ${t.x % MSize}px ${t.y % MSize}px`;
      } else {
        // Explicitly define 4 layers to match the 4 gradients (Minor V, Minor H, Major V, Major H)
        gridRef.current.style.backgroundSize = `${mSize}px ${mSize}px, ${mSize}px ${mSize}px, ${MSize}px ${MSize}px, ${MSize}px ${MSize}px`;
        gridRef.current.style.backgroundPosition = `${t.x % mSize}px ${t.y % mSize}px, ${t.x % mSize}px ${t.y % mSize}px, ${t.x % MSize}px ${t.y % MSize}px, ${t.x % MSize}px ${t.y % MSize}px`;
      }
    }
  }, []);

  // BUG FIX #36: Reapply transform when gridSize changes to update grid CSS immediately
  useEffect(() => {
    if (transformRef.current) {
      applyTransform(transformRef.current);
    }
  }, [gridSize, applyTransform]);

  // Update transform state (batched)
  const commitTransform = useCallback((t) => {
    setTransform(t);
    transformRef.current = t;
    onZoomChange?.(t.scale);
    onViewportChange?.(t);
  }, [onZoomChange, onViewportChange]);

  // ─── ZOOM ───
  const zoomAtPoint = useCallback((delta, clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;

    const t = transformRef.current;
    const factor = Math.exp(-delta * ZOOM_SENSITIVITY);
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.scale * factor));

    const newX = cx - (cx - t.x) * (newScale / t.scale);
    const newY = cy - (cy - t.y) * (newScale / t.scale);

    const newTransform = { x: newX, y: newY, scale: newScale };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform]);

  // ─── MOUSE WHEEL ───
  const handleWheel = useCallback((e) => {
    if (isCanvasLocked) return;
    e.preventDefault();
    zoomAtPoint(e.deltaY, e.clientX, e.clientY);
    onInteractionStart?.();
  }, [zoomAtPoint, onInteractionStart, isCanvasLocked, isInteracting, isSpacePressed]);

  // ─── INERTIA ───
  const startInertia = useCallback(() => {
    const tick = () => {
      const vx = velocity.current.x;
      const vy = velocity.current.y;

      if (Math.abs(vx) < INERTIA_THRESHOLD && Math.abs(vy) < INERTIA_THRESHOLD) {
        velocity.current = { x: 0, y: 0 };
        commitTransform(transformRef.current);
        return;
      }

      velocity.current.x *= INERTIA_FRICTION;
      velocity.current.y *= INERTIA_FRICTION;

      const t = transformRef.current;
      const newTransform = {
        ...t,
        x: t.x + velocity.current.x,
        y: t.y + velocity.current.y,
      };
      transformRef.current = newTransform;
      applyTransform(newTransform);
      inertiaFrame.current = requestAnimationFrame(tick);
    };
    inertiaFrame.current = requestAnimationFrame(tick);
  }, [applyTransform, commitTransform]);

  // ─── MOUSE PAN ───
  const handleMouseDown = useCallback((e) => {
    // Only lock if the global lock is active; allow panning during interaction
    if (isCanvasLocked) return;

    const safeTool = String(activeTool || 'select');
    const isInteractiveTool = safeTool !== 'select' && safeTool !== 'hand';
    
    // Middle button and Space-panning are always allowed
    const isMiddleButton = e.button === 1;
    const isSpacePan = (isSpacePressed && e.button === 0);
    
    // SMART PAN: Allow panning if the Hand tool is active OR if the Select tool is active 
    // AND we are clicking on empty background.
    const isHandActive = safeTool === 'hand';
    const isSelectPan = safeTool === 'select' && !isHoveringContent;
    const isDirectPan = e.button === 0 && (isHandActive || isSelectPan);
    
    // If we are using an interactive tool (draw, shape, note, text), do NOT pan
    if (isInteractiveTool && !isMiddleButton && !isSpacePan) return;

    if (!isMiddleButton && !isSpacePan && !isDirectPan) return;
    
    // PREVENT browser from starting text selection or drag-drop operations
    e.preventDefault();

    if (contentRef.current) contentRef.current.style.transition = 'none';
    if (gridRef.current) gridRef.current.style.transition = 'none';

    if (inertiaFrame.current) cancelAnimationFrame(inertiaFrame.current);

    setIsDragging(true);
    isDraggingRef.current = true;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    lastMouse.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };

    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    onInteractionStart?.();
  }, [isHoveringContent, activeTool, onInteractionStart, isCanvasLocked, isInteracting, isSpacePressed]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;

    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;

    velocity.current = {
      x: e.clientX - lastMouse.current.x,
      y: e.clientY - lastMouse.current.y,
    };
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const newTransform = { ...transformRef.current, x: newX, y: newY };
    transformRef.current = newTransform;
    applyTransform(newTransform);
  }, [applyTransform]);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    setIsDragging(false);
    isDraggingRef.current = false;

    if (contentRef.current) contentRef.current.style.transition = transitionStyle;
    if (gridRef.current) gridRef.current.style.transition = 'none';

    if (containerRef.current) {
      containerRef.current.style.cursor = getCursor();
    }

    if (Math.abs(velocity.current.x) > 1 || Math.abs(velocity.current.y) > 1) {
      startInertia();
    } else {
      commitTransform(transformRef.current);
    }
    onInteractionEnd?.();
  }, [startInertia, commitTransform, isHoveringContent, onInteractionEnd, transitionStyle]);

  // ─── DOUBLE-CLICK: Center on point ───
  const handleDoubleClick = useCallback((e) => {
    const safeTool = String(activeTool || 'select');
    if (isCanvasLocked || isInteracting || safeTool !== 'hand') return;
    // If a custom handler is provided and it returns true, we skip the default zoom behavior
    if (onDoubleClick?.(e)) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const t = transformRef.current;
    const newTransform = {
      x: t.x + (cx - clickX),
      y: t.y + (cy - clickY),
      scale: Math.min(MAX_ZOOM, t.scale * 1.5),
    };
    commitTransform(newTransform);
  }, [commitTransform, isCanvasLocked, isInteracting, activeTool, onDoubleClick]);

  // ─── TOUCH ───
  const handleTouchStart = useCallback((e) => {
    const safeTool = String(activeTool || 'select');
    const isInteractiveTool = safeTool !== 'select' && safeTool !== 'hand';

    if (isCanvasLocked || isInteracting || isInteractiveTool) return;
    
    if (e.touches.length === 2) {
      isPinching.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      lastPinchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX - transformRef.current.x,
        y: e.touches[0].clientY - transformRef.current.y,
      };
    }
  }, [activeTool, isCanvasLocked, isInteracting]);

  const handleTouchMove = useCallback((e) => {
    if (isPinching.current && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = (lastPinchDist.current - dist) * 3;
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      zoomAtPoint(delta, center.x, center.y);
      lastPinchDist.current = dist;
      lastPinchCenter.current = center;
    } else if (isDraggingRef.current && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      const newTransform = { ...transformRef.current, x: newX, y: newY };
      transformRef.current = newTransform;
      applyTransform(newTransform);
    }
  }, [zoomAtPoint, applyTransform]);

  const handleTouchEnd = useCallback(() => {
    isPinching.current = false;
    isDraggingRef.current = false;
    setIsDragging(false);
    commitTransform(transformRef.current);
    onInteractionEnd?.();
  }, [commitTransform, onInteractionEnd]);


  // ─── Global mouse events for drag ───
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Public methods via ref ───
  const zoomIn = useCallback(() => {
    if (isCanvasLocked) return;
    const t = transformRef.current;
    const newScale = Math.min(MAX_ZOOM, t.scale * 1.3);
    const container = containerRef.current;
    if (!container) {
      const newTransform = { ...t, scale: newScale };
      applyTransform(newTransform);
      commitTransform(newTransform);
      return;
    }
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newX = cx - (cx - t.x) * (newScale / t.scale);
    const newY = cy - (cy - t.y) * (newScale / t.scale);
    const newTransform = { x: newX, y: newY, scale: newScale };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform]);

  const zoomOut = useCallback(() => {
    if (isCanvasLocked) return;
    const t = transformRef.current;
    const newScale = Math.max(MIN_ZOOM, t.scale / 1.3);
    const container = containerRef.current;
    if (!container) {
      const newTransform = { ...t, scale: newScale };
      applyTransform(newTransform);
      commitTransform(newTransform);
      return;
    }
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newX = cx - (cx - t.x) * (newScale / t.scale);
    const newY = cy - (cy - t.y) * (newScale / t.scale);
    const newTransform = { x: newX, y: newY, scale: newScale };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform]);

  const resetView = useCallback(() => {
    if (isCanvasLocked) return;
    const doReset = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        requestAnimationFrame(doReset);
        return;
      }

      if (contentRef.current) contentRef.current.style.transition = transitionStyle;

      const newTransform = {
        x: Math.round(rect.width / 2 - 400),
        y: Math.round(rect.height / 2 - 300),
        scale: 1,
      };
      applyTransform(newTransform);
      commitTransform(newTransform);
    };
    // Use rAF so the browser has a chance to settle any layout changes
    requestAnimationFrame(doReset);
  }, [applyTransform, commitTransform, transitionStyle]);

  const fitToContent = useCallback((cw = 800, ch = 600) => {
    if (isCanvasLocked) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    if (contentRef.current) contentRef.current.style.transition = transitionStyle;

    const padding = 60;
    const sx = (rect.width - padding * 2) / cw;
    const sy = (rect.height - padding * 2) / ch;
    const s = Math.min(sx, sy, 1.1); 
    const newTransform = {
      x: Math.round(rect.width / 2 - 400 * s),
      y: Math.round(rect.height / 2 - 300 * s),
      scale: s,
    };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform, transitionStyle]);

  const centerOn = useCallback((wx, wy, zoom = null) => {
    if (isCanvasLocked) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    if (contentRef.current) contentRef.current.style.transition = transitionStyle;

    const t = transformRef.current;
    const newScale = zoom || t.scale;
    const newTransform = {
      x: Math.round(rect.width / 2 - wx * newScale),
      y: Math.round(rect.height / 2 - wy * newScale),
      scale: newScale,
    };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform, transitionStyle]);

  // ─── Attach wheel listener (non-passive for preventDefault) ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => { el.removeEventListener('wheel', handleWheel); };
  }, [handleWheel]);

  // ─── Public methods via ref ───
  useImperativeHandle(ref, () => ({
    zoomIn, zoomOut, resetView, fitToContent, centerOn,
    getTransform: () => transformRef.current,
    setTransform: (newT) => {
      applyTransform(newT);
      commitTransform(newT);
    },
    setTransition: (duration, easing = 'cubic-bezier(0.16, 1, 0.3, 1)') => {
      setTransitionStyle(`transform ${duration}ms ${easing}`);
    },
    applyTransform,
  }), [zoomIn, zoomOut, resetView, fitToContent, centerOn, applyTransform, commitTransform]);

  const getCursor = () => {
    return getToolCursor(activeTool, isDragging, isSpacePressed, isHoveringContent);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden transition-colors duration-500 select-none ${className}`}
      style={{ 
        cursor: getCursor(), 
        touchAction: 'none',
        background: 'rgba(255,255,255,0.001)'
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 400) {
          clickCountRef.current += 1;
        } else {
          clickCountRef.current = 1;
        }
        lastClickTimeRef.current = now;

        if (clickCountRef.current === 3) {
          console.log('[Canvas] Triple tap detected → Deselect All');
          deselectAll?.();
          clickCountRef.current = 0; // Reset
        }
        
        onClick?.(e);
      }}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CanvasContext.Provider value={{ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }}>
        {/* ── Infinite Structural Grid Background ── */}
        <div
          ref={gridRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            display: (showGrid && gridType !== 'none') ? 'block' : 'none',
            opacity: 0.2,
            backgroundImage: gridType === 'dots' 
              ? `radial-gradient(circle, var(--text-tertiary) 0.8px, transparent 0.8px),
                 radial-gradient(circle, var(--text-tertiary) 1.5px, transparent 1.5px)`
              : gridType === 'lines' 
                ? `linear-gradient(to right, var(--border-color) 1px, transparent 1px),
                   linear-gradient(to bottom, var(--border-color) 1px, transparent 1px),
                   linear-gradient(to right, var(--text-tertiary) 1px, transparent 1px),
                   linear-gradient(to bottom, var(--text-tertiary) 1px, transparent 1px)`
                : 'none',
            // SEC-21: Grid size and position are managed exclusively via gridRef in applyTransform()
            // to prevent React-state synchronization flickers during high-frequency panning.
          }}
        />

        {/* Content layers */}
        <div
          ref={contentRef}
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{
            // CRITICAL: Must be exactly 800x600 so SVG viewBox="0 0 800 600" maps 1 unit = 1px.
            // Without explicit dimensions, this div collapses to 0x0, and all SVG user-unit
            // coordinates (paths, shapes) collapse to invisible points at the origin.
            width: 800,
            height: 600,
            // Transform is applied via DOM ref in applyTransform, but we keep 
            // the initial inline style for SSR/initial-mount consistency.
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transition: isDragging ? 'none' : transitionStyle,
          }}
          onMouseEnter={() => setIsHoveringContent(true)}
          onMouseLeave={() => setIsHoveringContent(false)}
        >
          {typeof children === 'function' 
            ? children({ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }) 
            : children
          }
        </div>

        {/* Overlays (Interaction layers, etc) */}
        {overlay}
        <CanvasOverlay />
        <CodeVisualizerModal />

        {/* ── Guest Mode Watermark ── */}
        {user?.isGuest && (
          <div style={{
            position: 'absolute', top: '24px', right: '24px',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            padding: '8px 14px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
            zIndex: 50, pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            opacity: 0.8
          }}>
            <div style={{ 
              width: '20px', height: '20px', borderRadius: '6px', background: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-primary)'
            }}>
              <ShieldAlert size={12} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>Guest Session</span>
          </div>
        )}
      </CanvasContext.Provider>
    </div>
  );
}));

InfiniteCanvas.displayName = 'InfiniteCanvas';

export default InfiniteCanvas;