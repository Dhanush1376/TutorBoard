import React, { useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './CanvasContext';
import FloatingFormatBar from './FloatingFormatBar.jsx';
import { Handle, RotateHandle } from './ElementHandles.jsx';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';


/**
 * CanvasOverlay
 * 
 * Sits above the InfiniteCanvas to host global UI elements like the
 * Floating Format Bar, which need to be screen-fixed but track 
 * world-coordinate elements.
 */
export default function CanvasOverlay() {
  const {
    selectedElementIds,
    canvasObjects,
    editingObjectId,
    isInteracting,
    updateCanvasObjectSilently,
    hasTextSelection
  } = useTutorStore();

  const { transform } = useContext(CanvasContext);

  // Identify the single selected element for formatting
  const selectedElement = useMemo(() => {
    // Show formatting bar if text is selected OR if we are in active edit mode (even without selection)
    if (!hasTextSelection && !editingObjectId) return null;

    // We allow the bar during editing (isInteracting is true during edit)
    // but we might want to hide it if we are strictly dragging the element
    // For now, hasTextSelection is a strong enough indicator.

    const id = editingObjectId || (selectedElementIds.length === 1 ? selectedElementIds[0] : null);
    if (!id) return null;

    const obj = canvasObjects.find(o => o.id === id);

    // Only show formatting bar for intrinsic text types
    const textTypes = ['text', 'label', 'annotation', 'caption', 'equation', 'code', 'math', 'terminal', 'sticky', 'note'];
    if (obj && textTypes.includes(obj.type)) {
      return obj;
    }
    return null;
  }, [selectedElementIds, editingObjectId, canvasObjects, hasTextSelection]);

  // Calculate screen position with edge-awareness
  const barPosition = useMemo(() => {
    if (!selectedElement || !transform) return null;

    const { x: tx, y: ty, scale } = transform;
    const worldX = (selectedElement.x ?? 0.5) * CANVAS_WIDTH;
    const worldY = (selectedElement.y ?? 0.5) * CANVAS_HEIGHT;
    const worldW = (selectedElement.w ?? 0.2) * CANVAS_WIDTH;
    const worldH = (selectedElement.h ?? 0.1) * CANVAS_HEIGHT;

    const isFlipped = selectedElement.y < 0.15;

    let screenX = worldX * scale + tx;
    const screenY = isFlipped 
      ? (worldY + worldH / 2) * scale + ty + 20 
      : (worldY - worldH / 2) * scale + ty - 20;

    // EDGE AWARENESS: Shift the bar if it would overflow the screen
    const estimatedHalfWidth = 240; // Approximate half-width of the formatting bar
    const padding = 20;
    
    let xOffset = 0;
    if (screenX - estimatedHalfWidth < padding) {
      xOffset = padding - (screenX - estimatedHalfWidth);
    } else if (screenX + estimatedHalfWidth > window.innerWidth - padding) {
      xOffset = (window.innerWidth - padding) - (screenX + estimatedHalfWidth);
    }

    return { 
      x: screenX, 
      y: screenY, 
      xOffset,
      rotation: selectedElement.rotation || 0,
      isFlipped
    };
  }, [selectedElement, transform]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[1000]">
      <AnimatePresence>
        {selectedElement && barPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: barPosition.isFlipped ? -10 : 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: barPosition.x + barPosition.xOffset,
              y: barPosition.y
            }}
            exit={{ opacity: 0, scale: 0.9, y: barPosition.isFlipped ? -10 : 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="absolute left-0 top-0 pointer-events-auto"
            style={{
              transform: `translate(-50%, ${barPosition.isFlipped ? '0%' : '-100%'}) rotate(${barPosition.rotation}deg)`,
              zIndex: 1000
            }}
          >
            <FloatingFormatBar
              element={selectedElement}
              updateCanvasObject={updateCanvasObjectSilently}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Selection Handles - Visual only, moved back to components for better interaction */}
      <AnimatePresence>
        {selectedElement && transform && !isInteracting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute pointer-events-none"
            style={{
              left: (selectedElement.x ?? 0.5) * CANVAS_WIDTH * transform.scale + transform.x,
              top: (selectedElement.y ?? 0.5) * CANVAS_HEIGHT * transform.scale + transform.y,
              width: (selectedElement.w ?? 0.2) * CANVAS_WIDTH * transform.scale,
              height: (selectedElement.h ?? 0.1) * CANVAS_HEIGHT * transform.scale,
              transform: `translate(-50%, -50%) rotate(${selectedElement.rotation || 0}deg)`,
              zIndex: 999
            }}
          >
            {/* No longer rendering dashed border here to avoid duplication with component handles */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
