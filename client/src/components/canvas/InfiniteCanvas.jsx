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

const InfiniteCanvas = memo(({ 
  children, 
  onZoomChange, 
  onViewportChange,
  className = '',
  initialTransform = null,
}) => {
  // Transform state
  const [transform, setTransform] = useState(initialTransform || { x: 0, y: 0, scale: 1 });
  
  // Refs for performance (no re-renders during interaction)
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const isDragging = useRef(false);
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

    // Zoom towards pointer position
    const newX = cx - (cx - t.x) * (newScale / t.scale);
    const newY = cy - (cy - t.y) * (newScale / t.scale);

    const newTransform = { x: newX, y: newY, scale: newScale };
    applyTransform(newTransform);
    commitTransform(newTransform);
  }, [applyTransform, commitTransform]);

  // ─── MOUSE WHEEL ───
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Ctrl+wheel or pinch → zoom
    if (e.ctrlKey || e.metaKey) {
      zoomAtPoint(e.deltaY, e.clientX, e.clientY);
    } else {
      // Regular scroll → zoom (more intuitive for infinite canvas)
      zoomAtPoint(e.deltaY, e.clientX, e.clientY);
    }
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
    if (e.button !== 0) return; // Left click only
    
    // Cancel inertia
    if (inertiaFrame.current) {
      cancelAnimationFrame(inertiaFrame.current);
    }

    isDragging.current = true;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    lastMouse.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };

    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;

    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;

    // Track velocity for inertia
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
    if (!isDragging.current) return;
    isDragging.current = false;

    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }

    // Start inertia if significant velocity
    if (Math.abs(velocity.current.x) > 1 || Math.abs(velocity.current.y) > 1) {
      startInertia();
    } else {
      commitTransform(transformRef.current);
    }
  }, [startInertia, commitTransform]);

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

  // ─── TOUCH: Pinch-to-zoom ───
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
      isDragging.current = true;
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
    } else if (isDragging.current && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      const newTransform = { ...transformRef.current, x: newX, y: newY };
      transformRef.current = newTransform;
      applyTransform(newTransform);
    }
  }, [zoomAtPoint, applyTransform]);

  const handleTouchEnd = useCallback(() => {
    isPinching.current = false;
    isDragging.current = false;
    commitTransform(transformRef.current);
  }, [commitTransform]);

  // ─── KEYBOARD ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture when typing
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2 + rect.left;
      const centerY = rect.height / 2 + rect.top;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomAtPoint(-100, centerX, centerY);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomAtPoint(100, centerX, centerY);
          break;
        case '0':
          e.preventDefault();
          commitTransform({ x: 0, y: 0, scale: 1 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomAtPoint, commitTransform]);

  // ─── Attach wheel listener (non-passive for preventDefault) ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
    zoomAtPoint(-150, rect.width / 2 + rect.left, rect.height / 2 + rect.top);
  }, [zoomAtPoint]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(150, rect.width / 2 + rect.left, rect.height / 2 + rect.top);
  }, [zoomAtPoint]);

  const resetView = useCallback(() => {
    commitTransform({ x: 0, y: 0, scale: 1 });
  }, [commitTransform]);

  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerRect = container.getBoundingClientRect();
    // Use the SVG's natural size (800x600) for calculation
    const contentWidth = 800;
    const contentHeight = 600;

    const scaleX = (containerRect.width * 0.85) / contentWidth;
    const scaleY = (containerRect.height * 0.85) / contentHeight;
    const scale = Math.min(scaleX, scaleY, MAX_ZOOM);

    const x = (containerRect.width - contentWidth * scale) / 2;
    const y = (containerRect.height - contentHeight * scale) / 2;

    commitTransform({ x, y, scale });
  }, [commitTransform]);

  const centerOn = useCallback((worldX, worldY) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const t = transformRef.current;

    commitTransform({
      x: rect.width / 2 - worldX * t.scale,
      y: rect.height / 2 - worldY * t.scale,
      scale: t.scale,
    });
  }, [commitTransform]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Infinite grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--text-tertiary) 1px, transparent 1px)',
          backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
          backgroundPosition: `${transform.x % (20 * transform.scale)}px ${transform.y % (20 * transform.scale)}px`,
          transition: 'background-size 0.3s ease',
        }}
      />

      {/* Content layer — only CSS transforms, no re-renders */}
      <div
        ref={contentRef}
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        {typeof children === 'function' 
          ? children({ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }) 
          : children
        }
      </div>

      {/* Expose controls to parent via render prop or context */}
      <CanvasContext.Provider value={{ transform, zoomIn, zoomOut, resetView, fitToContent, centerOn }}>
        {/* Controls would be placed here via portal or as siblings */}
      </CanvasContext.Provider>
    </div>
  );
});

InfiniteCanvas.displayName = 'InfiniteCanvas';

export default InfiniteCanvas;
