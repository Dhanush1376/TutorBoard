/**
 * CanvasMinimap — Bird's-eye overview of the entire canvas
 * 
 * Shows a miniature version of the scene with a viewport rectangle.
 * Click on the minimap to navigate.
 */

import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 135;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CanvasMinimap = ({ 
  visible, 
  objects = [], 
  transform, 
  containerWidth = 1200,
  containerHeight = 800,
  onNavigate,
  layoutView = 'right',
}) => {
  const minimapRef = useRef(null);
  const isDragging = useRef(false);
  const isLeftHand = layoutView === 'left';
  
  // Guard against null transform (Bug 52 Fix)
  if (!transform) return null;

  const scaleX = MINIMAP_WIDTH / CANVAS_WIDTH;
  const scaleY = MINIMAP_HEIGHT / CANVAS_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  // Viewport rectangle in minimap coordinates
  // world viewport = containerSize / transform.scale
  // minimap viewport = world viewport * scale
  const vpWidth = (containerWidth / transform.scale) * scale;
  const vpHeight = (containerHeight / transform.scale) * scale;
  const vpX = (-transform.x / transform.scale) * scale;
  const vpY = (-transform.y / transform.scale) * scale;

  const navigateTo = useCallback((clientX, clientY) => {
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    // Convert minimap coords to canvas coords
    // We want the CLICK position to be the CENTER of the new viewport
    const canvasX = clickX / scale;
    const canvasY = clickY / scale;

    if (onNavigate) {
      onNavigate(canvasX, canvasY);
    }
  }, [scale, onNavigate]);

  const handlePointerDown = (e) => {
    isDragging.current = true;
    navigateTo(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    navigateTo(e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute bottom-24 ${isLeftHand ? 'right-6' : 'left-6'} z-50`}
        >
          <div
            ref={minimapRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xl cursor-crosshair touch-none select-none"
            style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
          >
            {/* Mini scene */}
            <svg 
              width={MINIMAP_WIDTH} 
              height={MINIMAP_HEIGHT} 
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="w-full h-full pointer-events-none"
            >
              {/* Background */}
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="transparent" />
              
              {/* Objects as dots/shapes */}
              {objects.map((obj, i) => {
                const rawX = obj.x || obj.cx || obj.x1 || 400;
                const rawY = obj.y || obj.cy || obj.y1 || 300;
                const x = rawX <= 1 ? rawX * CANVAS_WIDTH : rawX;
                const y = rawY <= 1 ? rawY * CANVAS_HEIGHT : rawY;
                const color = obj.color || 'gray';
                const PALETTE = {
                  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
                  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4',
                  white: '#f8fafc', gray: '#94a3b8', gold: '#fbbf24', teal: '#14b8a6',
                };
                const fill = PALETTE[color] || color;

                return (
                  <circle
                    key={obj.id || i}
                    cx={x}
                    cy={y}
                    r={6}
                    fill={fill}
                    opacity={0.6}
                  />
                );
              })}

              {/* Viewport rectangle with glow and high contrast border */}
              <rect
                x={vpX}
                y={vpY}
                width={Math.max(vpWidth, 10)}
                height={Math.max(vpHeight, 8)}
                fill="rgba(255,255,255,0.04)"
                stroke="var(--text-primary)"
                strokeWidth={1.5}
                rx={2}
                style={{ 
                  filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))',
                  transition: isDragging.current ? 'none' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </svg>

            {/* Label */}
            <div className="absolute bottom-1 left-2 text-[8px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest opacity-60">
              Minimap
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CanvasMinimap;
