/**
 * InfiniteCanvas — Figma/Excalidraw-level canvas with pan, zoom, and interaction
 * 
 * Features:
 *   - Mouse wheel zoom (pointer-anchored)
 *   - Click+drag to pan with momentum/inertia  
 *   - Double-click to center on element
 *   - Keyboard shortcuts (+ / - / 0 / space)
 *   - Touch: pinch-to-zoom, two-finger pan
 *   - Smooth CSS transitions
 *   - Performance: CSS transform only, no re-renders during interaction
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const ZOOM_SENSITIVITY = 0.002;
const INERTIA_FRICTION = 0.92;
const INERTIA_THRESHOLD = 0.5;

// Context for child components to access canvas controls
export const CanvasContext = React.createContext({
  transform: { x: 0, y: 0, scale: 1 },
  zoomIn: () => {},
  zoomOut: () => {},
  resetView: () => {},
  fitToContent: () => {},
  centerOn: () => {},
});

const InfiniteCanvas = memo(React.forwardRef(({ 
  children, 
  onZoomChange, 
  onViewportChange,
  className = '',
  initialTransform = null,
}, ref) => {
  // Transform state
  const [transform, setTransform] = useState(initialTransform || { x: 0, y: 0, scale: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isHoveringContent, setIsHoveringContent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for performance (no re-renders during interaction)
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const gridRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const inertiaFrame = useRef(null);
  const transformRef = useRef(transform);
  const isPinching = useRef(false);
  const lastPinchDist = useRef(0);
  const lastPinchCenter = useRef({ x: 0, y: 0 });

  // Keep ref in sync
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Apply transform via CSS (no React re-render)
  const applyTransform = useCallback((t) => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
    // High-performance Grid synchronization (Syncing the dots via DOM)
    if (gridRef.current) {
      const s = t.scale;
      gridRef.current.style.backgroundSize = `${20 * s}px ${20 * s}px, ${100 * s}px ${100 * s}px`;
      gridRef.current.style.backgroundPosition = `
        ${t.x % (20 * s)}px ${t.y % (20 * s)}px, 
        ${t.x % (100 * s)}px ${t.y % (100 * s)}px
      `;
    }
  }, []);

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
    e.preventDefault();
    zoomAtPoint(e.deltaY, e.clientX, e.clientY);
  }, [zoomAtPoint]);

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
    const isMiddleButton = e.button === 1;
    const isSpacePan = (isSpacePressed && e.button === 0);
    const isDirectPan = e.button === 0 && !isHoveringContent;
    
    if (!isMiddleButton && !isSpacePan && !isDirectPan) return;

    if (contentRef.current) contentRef.current.style.transition = 'none';
    if (gridRef.current) gridRef.current.style.transition = 'none';

    if (inertiaFrame.current) cancelAnimationFrame(inertiaFrame.current);

    setIsDragging(true);
    isDraggingRef.current = true;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    lastMouse.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };

    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  }, [isSpacePressed, isHoveringContent]);

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

    if (contentRef.current) contentRef.current.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    if (gridRef.current) gridRef.current.style.transition = 'none';

    if (containerRef.current) {
      containerRef.current.style.cursor = isSpacePressed ? 'grab' : (isHoveringContent ? 'default' : 'crosshair');
    }

    if (Math.abs(velocity.current.x) > 1 || Math.abs(velocity.current.y) > 1) {
      startInertia();
    } else {
      commitTransform(transformRef.current);
    }
  }, [startInertia, commitTransform, isSpacePressed, isHoveringContent]);

  // ─── DOUBLE-CLICK: Center on point ───
  const handleDoubleClick = useCallback((e) => {
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
  }, [commitTransform]);

  // ─── TOUCH ───
  const handleTouchStart = useCallback((e) => {
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
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
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
  }, [commitTransform]);

  // ─── KEYBOARD ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2 + rect.left;
      const cy = rect.height / 2 + rect.top;
      switch (e.key) {
        case '+': case '=': e.preventDefault(); zoomAtPoint(-150, cx, cy); break;
        case '-': case '_': e.preventDefault(); zoomAtPoint(150, cx, cy); break;
        case '0': e.preventDefault(); commitTransform({ x: 0, y: 0, scale: 1 }); break;
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (containerRef.current) containerRef.current.style.cursor = isHoveringContent ? 'default' : 'crosshair';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoomAtPoint, commitTransform, isSpacePressed, isHoveringContent]);

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
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(-200, rect.width / 2 + rect.left, rect.height / 2 + rect.top);
  }, [zoomAtPoint]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(200, rect.width / 2 + rect.left, rect.height / 2 + rect.top);
  }, [zoomAtPoint]);

  const resetView = useCallback(() => {
    commitTransform({ x: 0, y: 0, scale: 1 });
  }, [commitTransform]);

  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cw = 800; const ch = 600;
    const sx = (rect.width * 0.8) / cw;
    const sy = (rect.height * 0.8) / ch;
    const s = Math.min(sx, sy, 1.2);
    const x = (rect.width - cw * s) / 2;
    const y = (rect.height - ch * s) / 2;
    commitTransform({ x, y, scale: s });
  }, [commitTransform]);

  const centerOn = useCallback((wx, wy) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const t = transformRef.current;
    commitTransform({
      x: rect.width / 2 - (wx * t.scale),
      y: rect.height / 2 - (wy * t.scale),
      scale: t.scale,
    });
  }, [commitTransform]);

  // ─── Attach wheel listener (non-passive for preventDefault) ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    setTimeout(fitToContent, 500);
    return () => { el.removeEventListener('wheel', handleWheel); };
  }, [handleWheel, fitToContent]);

  // ─── Public methods via ref ───
  React.useImperativeHandle(ref, () => ({
    zoomIn, zoomOut, resetView, fitToContent, centerOn,
    getTransform: () => transformRef.current
  }), [zoomIn, zoomOut, resetView, fitToContent, centerOn]);

  const getCursor = () => {
    if (isDragging) return 'grabbing';
    if (isSpacePressed) return 'grab';
    if (isHoveringContent) return 'default';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[var(--bg-primary)] ${className}`}
      style={{ cursor: getCursor(), touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CanvasContext.Provider value={{ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }}>
        {/* ── Infinite Structural Grid Background ── (DOM Ref Added) */}
        <div
          ref={gridRef}
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: `
              radial-gradient(circle, var(--text-tertiary) 0.8px, transparent 0.8px),
              radial-gradient(circle, var(--text-tertiary) 1.5px, transparent 1.5px)
            `,
            backgroundSize: `
              ${20 * transform.scale}px ${20 * transform.scale}px,
              ${100 * transform.scale}px ${100 * transform.scale}px
            `,
            backgroundPosition: `
              ${transform.x % (20 * transform.scale)}px ${transform.y % (20 * transform.scale)}px,
              ${transform.x % (100 * transform.scale)}px ${transform.y % (100 * transform.scale)}px
            `,
          }}
        />

        {/* Content layers */}
        <div
          ref={contentRef}
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={() => setIsHoveringContent(true)}
          onMouseLeave={() => setIsHoveringContent(false)}
        >
          {typeof children === 'function' 
            ? children({ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }) 
            : children
          }
        </div>
      </CanvasContext.Provider>
    </div>
  );
}));

InfiniteCanvas.displayName = 'InfiniteCanvas';

export default InfiniteCanvas;
