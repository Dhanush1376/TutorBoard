import React, { useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './InfiniteCanvas';
import FloatingFormatBar from './FloatingFormatBar';

const CW = 800;
const CH = 600;

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
    updateCanvasObjectSilently 
  } = useTutorStore();
  
  const { transform } = useContext(CanvasContext);

  // Identify the single selected element for formatting
  const selectedElement = useMemo(() => {
    if (selectedElementIds.length !== 1) return null;
    const id = selectedElementIds[0];
    const obj = canvasObjects.find(o => o.id === id);
    
    // Only show for text-type elements (label, code, equation, sticky)
    const textTypes = ['label', 'code', 'equation', 'sticky', 'step_box', 'doubt_note'];
    if (obj && textTypes.includes(obj.type) && editingObjectId !== obj.id) {
      return obj;
    }
    return null;
  }, [selectedElementIds, canvasObjects, editingObjectId]);

  // Calculate screen position
  const barPosition = useMemo(() => {
    if (!selectedElement || !transform) return null;

    const { x: tx, y: ty, scale } = transform;
    const worldX = (selectedElement.x ?? 0.5) * CW;
    const worldY = (selectedElement.y ?? 0.5) * CH;
    const worldW = (selectedElement.w ?? 0.2) * CW;
    const worldH = (selectedElement.h ?? 0.1) * CH;

    // Calculate top-center of the element in screen space
    // Note: element (x,y) is center
    const screenX = worldX * scale + tx;
    const screenY = (worldY - worldH / 2) * scale + ty;

    return { 
      x: screenX, 
      y: screenY - 20, // Offset above the element
      rotation: selectedElement.rotation || 0 
    };
  }, [selectedElement, transform]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[200]">
      <AnimatePresence>
        {selectedElement && barPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              x: barPosition.x,
              y: barPosition.y
            }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute left-0 top-0 pointer-events-auto"
            style={{ 
              transform: `translate(-50%, -100%) rotate(${barPosition.rotation}deg)`,
              zIndex: 1000
            }}
          >
            <FloatingFormatBar 
              element={selectedElement} 
              updateCanvasObject={updateCanvasObjectSilently}
              rotation={-barPosition.rotation} // Keep bar leveled
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
