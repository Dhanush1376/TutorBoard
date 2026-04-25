/**
 * CanvasMinimap — Bird's-eye overview of the entire canvas
 *
 * Supports click + drag to navigate the canvas viewport.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MINIMAP_WIDTH  = 180;
const MINIMAP_HEIGHT = 120;
const CANVAS_WIDTH   = 800;
const CANVAS_HEIGHT  = 600;

const PALETTE = {
  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4',
  white: '#f8fafc', gray: '#94a3b8', gold: '#fbbf24', teal: '#14b8a6',
};

const CanvasMinimap = ({
  visible,
  objects = [],
  transform,
  containerWidth,
  containerHeight,
  onNavigate,
  layoutView = 'right',
}) => {
  const minimapRef  = useRef(null);
  const isDragging  = useRef(false);
  const isLeftHand  = layoutView === 'left';
  const [dragging, setDragging] = useState(false);

  // Measure actual container size from the DOM if not provided
  const [cw, setCw] = useState(containerWidth || window.innerWidth);
  const [ch, setCh] = useState(containerHeight || window.innerHeight);

  useEffect(() => {
    const update = () => {
      setCw(containerWidth || window.innerWidth);
      setCh(containerHeight || window.innerHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [containerWidth, containerHeight]);

  if (!transform) return null;

  // How minimap maps to canvas-world coords
  const scaleX = MINIMAP_WIDTH  / CANVAS_WIDTH;
  const scaleY = MINIMAP_HEIGHT / CANVAS_HEIGHT;
  const mmScale = Math.min(scaleX, scaleY); // uniform scale

  // Viewport rect in minimap space
  const vpW = Math.min((cw  / transform.scale) * mmScale, MINIMAP_WIDTH);
  const vpH = Math.min((ch  / transform.scale) * mmScale, MINIMAP_HEIGHT);
  const vpX = (-transform.x / transform.scale) * mmScale;
  const vpY = (-transform.y / transform.scale) * mmScale;

  // Convert a minimap pointer position to canvas-world coords (center of click)
  const minimapToCanvas = useCallback((clientX, clientY) => {
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    // localX/localY are in minimap pixels; divide by mmScale to get canvas coords
    const canvasX = localX / mmScale;
    const canvasY = localY / mmScale;
    return { x: canvasX, y: canvasY };
  }, [mmScale]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = minimapToCanvas(e.clientX, e.clientY);
    if (pos) onNavigate?.(pos.x, pos.y);
  }, [minimapToCanvas, onNavigate]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const pos = minimapToCanvas(e.clientX, e.clientY);
    if (pos) onNavigate?.(pos.x, pos.y);
  }, [minimapToCanvas, onNavigate]);

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute bottom-24 ${isLeftHand ? 'right-6' : 'left-6'} z-50`}
        >
          <div
            ref={minimapRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              width: MINIMAP_WIDTH,
              height: MINIMAP_HEIGHT,
              cursor: dragging ? 'grabbing' : 'crosshair',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: 'var(--glass-shadow)',
              touchAction: 'none',
              userSelect: 'none',
              position: 'relative',
            }}
          >
            {/* Mini scene SVG */}
            <svg
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              style={{ display: 'block', pointerEvents: 'none' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Canvas background */}
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="transparent" />

              {/* Objects as colored dots */}
              {objects.map((obj, i) => {
                const rawX = obj.x ?? obj.cx ?? obj.x1 ?? 0.5;
                const rawY = obj.y ?? obj.cy ?? obj.y1 ?? 0.5;
                const x = rawX <= 1 ? rawX * CANVAS_WIDTH  : rawX;
                const y = rawY <= 1 ? rawY * CANVAS_HEIGHT : rawY;
                const fill = PALETTE[obj.color] || obj.color || '#94a3b8';
                return (
                  <circle key={obj.id || i} cx={x} cy={y} r={8} fill={fill} opacity={0.55} />
                );
              })}

              {/* Viewport rectangle */}
              <rect
                x={vpX}
                y={vpY}
                width={Math.max(vpW, 20)}
                height={Math.max(vpH, 16)}
                fill="rgba(255,255,255,0.06)"
                stroke="var(--text-primary)"
                strokeWidth={2.5}
                rx={3}
                style={{
                  filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.15))',
                  transition: dragging ? 'none' : 'x 0.2s ease, y 0.2s ease, width 0.2s ease, height 0.2s ease',
                }}
              />
            </svg>

            {/* Label */}
            <div style={{
              position: 'absolute', bottom: 4, left: 8,
              fontSize: '7px', fontWeight: 400, letterSpacing: '0.12em',
              color: 'var(--text-tertiary)', textTransform: 'uppercase', opacity: 0.5,
              pointerEvents: 'none',
            }}>
              Minimap
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CanvasMinimap;
