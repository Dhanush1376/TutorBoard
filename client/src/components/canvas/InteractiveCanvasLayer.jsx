import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './InfiniteCanvas';

/**
 * InteractiveCanvasLayer
 *
 * Sits directly on top of the world-coordinate transformed canvas layer.
 * Intercepts drawing, shape creation, and text interactions.
 * Pushes finalized elements to the global `tutorStore`.
 */

// Virtual Space Constants for coordinate normalization
const V_WIDTH = 800;
const V_HEIGHT = 600;

const generateId = () => `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper: Convert raw points to a smooth SVG path string (Midpoint averaging)
const getSvgPath = (points, width, height) => {
  if (!points || points.length < 2) return '';
  const pts = points.map(p => [p[0] * width, p[1] * height]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]},${pts[i][1]} ${xc},${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]},${last[1]}`;
  return d;
};

const InteractiveCanvasLayer = () => {
  const { 
    activeTool: rawActiveTool, canvasObjects, setCanvasObjectsWithHistory,
    selectedElementIds, setSelectedElements, undo, redo, isSnapToGrid, 
    drawColor, drawWidth, laserWidth, gridSize, noteColor, noteSize, shapeFill, 
    shapeStrokeStyle, textType, textSize, textWeight, textAlign, textBgColor,
    addNoteToCanvas, setActiveTool,
    showNotes, setShowNotes
  } = useTutorStore();
  
  // Use transform from context to handle "Infinite Drawing" coordinates
  const { transform } = useContext(CanvasContext);
  
  const activeTool = useMemo(() => {
    if (rawActiveTool === 'draw') return 'draw:pen';
    if (rawActiveTool === 'shape') return 'shape:rect';
    return rawActiveTool;
  }, [rawActiveTool]);

  const [draftObject, setDraftObject] = useState(null);
  const layerRef = useRef(null);
  const tapCounter = useRef({ count: 0, last: 0 });
  const isDrawing = useRef(false);
  const startPoint = useRef(null);
  const cachedRect = useRef(null);

  const isInteractionTool = activeTool.startsWith('draw:') || 
                            activeTool.startsWith('shape:') || 
                            activeTool === 'text' || 
                            activeTool === 'note';

  // Global Keyboard Shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedElementIds.length > 0) {
          const newObjects = canvasObjects.filter(obj => !selectedElementIds.includes(obj.id));
          setCanvasObjectsWithHistory(newObjects);
          setSelectedElements([]);
        }
      }

      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedElementIds, canvasObjects, setCanvasObjectsWithHistory, setSelectedElements, undo, redo]);

  // Laser Pointer Auto-Cleanup (L4 FIX: bypasses undo history to avoid stack pollution)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentObjects = useTutorStore.getState().canvasObjects;
      const needsCleanup = currentObjects.some(obj => obj.expiresAt && obj.expiresAt < now);
      if (needsCleanup) {
        // Direct set — don't push to undo history for automatic cleanup
        useTutorStore.setState({ 
          canvasObjects: currentObjects.filter(obj => !obj.expiresAt || obj.expiresAt >= now) 
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!isInteractionTool) return null;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    // C1 FIX: Always clear previous selection when starting a new interaction
    if (selectedElementIds.length > 0) {
      setSelectedElements([]);
    }

    const rect = layerRef.current.getBoundingClientRect();
    cachedRect.current = rect;
    
    const { scale, x: tx, y: ty } = transform;
    const worldX = (e.clientX - rect.left - tx) / scale;
    const worldY = (e.clientY - rect.top - ty) / scale;
    
    const normalizedX = (worldX) / V_WIDTH; 
    const normalizedY = (worldY) / V_HEIGHT;

    isDrawing.current = true;
    startPoint.current = { x: normalizedX, y: normalizedY };

    if (activeTool.startsWith('shape:')) {
      const shapeType = activeTool.split(':')[1];
      const isLinear = shapeType === 'line' || shapeType === 'arrow';
      
      setDraftObject({
        id: generateId(),
        type: shapeType,
        x: normalizedX,
        y: normalizedY,
        x1: isLinear ? normalizedX : undefined,
        y1: isLinear ? normalizedY : undefined,
        x2: isLinear ? normalizedX : undefined,
        y2: isLinear ? normalizedY : undefined,
        w: 0,
        h: 0,
        color: drawColor,
        strokeWidth: drawWidth,
        fill: shapeFill,
        strokeStyle: shapeStrokeStyle,
        dashed: shapeStrokeStyle === 'dashed',
        isDraft: true,
        animation: { type: 'bounce', duration: 0.3 }
      });
    } else if (activeTool.startsWith('draw:')) {
      if (activeTool === 'draw:eraser') {
        // H5 FIX: Set isDrawing flag so eraser only works while mouse is held down
        isDrawing.current = true;
        return;
      }
      
      setDraftObject({
        id: generateId(),
        type: 'path',
        points: [[normalizedX, normalizedY]],
        color: activeTool === 'draw:highlighter' 
          ? (drawColor === 'var(--text-primary)' ? 'rgba(255, 255, 0, 0.5)' : `${drawColor}80`) 
          : (activeTool === 'draw:laser' ? '#fde047' : drawColor),
        strokeWidth: activeTool === 'draw:highlighter' ? 12 : (activeTool === 'draw:laser' ? laserWidth : drawWidth),
        isDraft: true,
      });
    } else if (activeTool === 'note') {
      // Create note on a simple single click when note tool is active
      addNoteToCanvas(worldX, worldY);
      
      // Optional: switch back to 'select' tool after placing a note, or let them place multiple.
      // E.g., setActiveTool('select');
      return; 
    } else if (activeTool === 'text') {
      const newId = generateId();
      const type = textType === 'formula' ? 'equation' : (textType === 'code' ? 'code' : 'label');
      
      const newObj = {
        id: newId,
        type,
        x: normalizedX,
        y: normalizedY,
        w: 0.2, // Default width
        h: 0.1, // Default height
        content: '',
        label: '',
        styles: {
          fontSize: textSize || 16,
          fontWeight: textWeight === 'bold' ? 700 : (textWeight === 'medium' ? 500 : 400),
          textAlign: textAlign || 'center',
          backgroundColor: textBgColor || 'transparent',
          fontFamily: textType === 'code' ? "'Geist Mono', monospace" : "'Inter', sans-serif"
        },
        color: drawColor || 'var(--text-primary)',
        animation: { type: 'scale', duration: 0.4 }
      };

      setCanvasObjectsWithHistory([...canvasObjects, newObj]);
      setSelectedElements([newId]);
      
      // Delay slightly to ensure store update propagates before focusing
      setTimeout(() => {
        useTutorStore.getState().setEditingObjectId(newId);
      }, 50);
      return;
    }
  };

  const handlePointerMove = (e) => {
    // Eraser works without a draftObject
    if (!isDrawing.current || (!draftObject && activeTool !== 'draw:eraser') || draftObject?.isTyping) return;
    
    const { scale, x: tx, y: ty } = transform;
    const rect = cachedRect.current || layerRef.current.getBoundingClientRect();

    const worldX = (e.clientX - rect.left - tx) / scale;
    const worldY = (e.clientY - rect.top - ty) / scale;

    const normalizedX = (isSnapToGrid ? Math.round(worldX / gridSize) * gridSize : worldX) / V_WIDTH;
    const normalizedY = (isSnapToGrid ? Math.round(worldY / gridSize) * gridSize : worldY) / V_HEIGHT;

    if (activeTool.startsWith('shape:')) {
      const w = normalizedX - startPoint.current.x;
      const h = normalizedY - startPoint.current.y;
      const isLinear = draftObject.type === 'line' || draftObject.type === 'arrow';
      
      setDraftObject(prev => ({
        ...prev,
        w: Math.abs(w),
        h: Math.abs(h),
        x: w < 0 ? normalizedX : startPoint.current.x,
        y: h < 0 ? normalizedY : startPoint.current.y,
        x2: isLinear ? normalizedX : undefined,
        y2: isLinear ? normalizedY : undefined,
      }));
    } else if (activeTool.startsWith('draw:')) {
      if (activeTool === 'draw:eraser') {
        // H5 FIX: Only erase while mouse button is held down
        if (!isDrawing.current) return;
        const hit = canvasObjects.find(obj => {
          if (obj.points) {
            return obj.points.some(p => Math.abs(p[0]-normalizedX) < 0.02 && Math.abs(p[1]-normalizedY) < 0.02);
          }
          if (obj.x && obj.y) {
             const dx = Math.abs(obj.x - normalizedX);
             const dy = Math.abs(obj.y - normalizedY);
             return dx < 0.05 && dy < 0.05;
          }
          return false;
        });
        if (hit) {
          setCanvasObjectsWithHistory(canvasObjects.filter(o => o.id !== hit.id));
        }
        return;
      }

      const lastPoint = draftObject.points[draftObject.points.length - 1];
      const dist = Math.sqrt(Math.pow(normalizedX - lastPoint[0], 2) + Math.pow(normalizedY - lastPoint[1], 2));
      
      if (dist > 0.002) {
        setDraftObject(prev => ({
          ...prev,
          points: [...prev.points, [normalizedX, normalizedY]]
        }));
      }
    }
  };

  const handlePointerUp = (force = false) => {
    if (!force && (!isDrawing.current || !draftObject)) return;
    isDrawing.current = false;
    
    const finalizedObject = { ...draftObject };
    delete finalizedObject.isDraft;

    if (activeTool === 'draw:laser') {
      finalizedObject.expiresAt = Date.now() + 1500;
      finalizedObject.animation = { type: 'scale', duration: 0.8 };
    }
    
    // Formatting & Coordinate Restoration (Fix Bug 14)
    if (finalizedObject.type === 'rect' || finalizedObject.type === 'ellipse' || finalizedObject.type === 'step_box' || finalizedObject.type === 'sticky') {
      // Keep coordinates normalized (0..1) but finalize center point
      finalizedObject.x = finalizedObject.x + (finalizedObject.w / 2);
      finalizedObject.y = finalizedObject.y + (finalizedObject.h / 2);
      
      // Calculate a scale that represents the object's size relative to the standard 160px box.
      // scale = 1 means 160px. V_WIDTH=800.
      finalizedObject.scale = (finalizedObject.w * V_WIDTH) / 160; 
    }
    
    if (finalizedObject.text !== undefined) {
      finalizedObject.label = finalizedObject.text;
      delete finalizedObject.text;
      delete finalizedObject.isTyping;
    }
    
    if (finalizedObject.type === 'path') {
      finalizedObject.path = getSvgPath(finalizedObject.points, V_WIDTH, V_HEIGHT);
    }

    if (finalizedObject.type === 'triangle') {
      const { x, y, w, h } = finalizedObject;
      finalizedObject.x = x + w / 2;
      finalizedObject.y = y + h / 2;
      finalizedObject.points = [
        [x + w / 2, y],      // Top Middle
        [x + w,     y + h],  // Bottom Right
        [x,         y + h]   // Bottom Left
      ];
    }

    setCanvasObjectsWithHistory([...canvasObjects, finalizedObject]);
    setDraftObject(null);
  };

  return (
    <div 
      ref={layerRef}
      className="absolute inset-0 z-[100] cursor-crosshair pointer-events-auto"
      onPointerDown={draftObject?.isTyping ? undefined : handlePointerDown}
      onPointerMove={draftObject?.isTyping ? undefined : handlePointerMove}
      onPointerUp={draftObject?.isTyping ? undefined : () => handlePointerUp()}
    >
      {draftObject && !draftObject.isTyping && (
        <svg width="100%" height="100%" className="border-none pointer-events-none overflow-visible">
          <motion.g animate={{ x: transform.x, y: transform.y, scale: transform.scale }}>
            {(draftObject.type === 'rect' || draftObject.type === 'diamond' || draftObject.type === 'star' || draftObject.type === 'hexagon' || draftObject.type === 'callout' || draftObject.type === 'cloud') && (
               <rect 
                 x={draftObject.x * V_WIDTH} 
                 y={draftObject.y * V_HEIGHT} 
                 width={draftObject.w * V_WIDTH} 
                 height={draftObject.h * V_HEIGHT} 
                 fill="transparent" 
                 stroke={draftObject.color} 
                 strokeWidth={2} 
                 rx={draftObject.type === 'rect' ? 4 : 0}
               />
            )}
            {draftObject.type === 'ellipse' && (
               <ellipse 
                 cx={(draftObject.x + draftObject.w/2) * V_WIDTH} 
                 cy={(draftObject.y + draftObject.h/2) * V_HEIGHT} 
                 rx={(draftObject.w/2) * V_WIDTH} 
                 ry={(draftObject.h/2) * V_HEIGHT} 
                 fill="transparent" 
                 stroke={draftObject.color} 
                 strokeWidth={2} 
               />
            )}
            {draftObject.type === 'path' && (
               <path
                 d={getSvgPath(draftObject.points, V_WIDTH, V_HEIGHT)}
                 fill="none"
                 stroke={draftObject.color}
                 strokeWidth={draftObject.strokeWidth}
                 strokeLinecap="round"
                 strokeLinejoin="round"
               />
            )}
            {(draftObject.type === 'line' || draftObject.type === 'arrow') && (
              <line
                x1={draftObject.x1 * V_WIDTH} y1={draftObject.y1 * V_HEIGHT}
                x2={draftObject.x2 * V_WIDTH} y2={draftObject.y2 * V_HEIGHT}
                stroke={draftObject.color} strokeWidth={2} 
              />
            )}
            {(draftObject.type === 'triangle') && (
               <polygon
                 points={`
                   ${(draftObject.x + draftObject.w/2) * V_WIDTH}, ${draftObject.y * V_HEIGHT}
                   ${(draftObject.x + draftObject.w) * V_WIDTH},   ${(draftObject.y + draftObject.h) * V_HEIGHT}
                   ${draftObject.x * V_WIDTH},                     ${(draftObject.y + draftObject.h) * V_HEIGHT}
                 `}
                 fill="none"
                 stroke={draftObject.color} strokeWidth={2} 
               />
            )}
            {(draftObject.type === 'pentagon') && (
              <rect 
                x={draftObject.x * V_WIDTH} 
                y={draftObject.y * V_HEIGHT} 
                width={draftObject.w * V_WIDTH} 
                height={draftObject.h * V_HEIGHT} 
                fill="transparent" 
                stroke={draftObject.color} 
                strokeWidth={1} 
              />
            )}
          </motion.g>
        </svg>
      )}

    </div>
  );
};

export default InteractiveCanvasLayer;
