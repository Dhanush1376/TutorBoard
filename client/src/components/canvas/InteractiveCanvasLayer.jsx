import React, { useRef, useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './CanvasContext';
import { getToolCursor } from '../../utils/cursors';
import { getSvgPath, getStarPoints, getHexagonPoints, getDiamondPoints } from '../../utils/geometryUtils';

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

const InteractiveCanvasLayer = React.memo(() => {
  const { 
    activeTool: rawActiveTool, canvasObjects, setCanvasObjectsWithHistory,
    selectedElementIds, setSelectedElements, undo, redo, isSnapToGrid, 
    drawColor, drawWidth, laserWidth, gridSize, noteColor, noteSize, shapeFill, 
    shapeStrokeStyle, textType, textToolSize, textWeight, textItalic, textUnderline, textAlign, textBgColor,
    addNoteToCanvas, setActiveTool, setInteracting, setEditingObjectId,
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
                            activeTool === 'shape' ||
                            activeTool.startsWith('shape:') || 
                            activeTool === 'text';


  const handlePointerDown = useCallback((e) => {
    // If we're already drawing or typing, don't intercept
    if (isDrawing.current || draftObject?.isTyping) return;
    
    // Only handle primary button
    if (e.button !== 0) return;

    // Boundary check using the layer's rect
    const layer = layerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    // U3 FIX: Surgical Hit-Testing
    // We only intercept the click if it's on the "background" (no meaningful elements under cursor)
    const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
    const isOverExistingElement = elementsAtPoint.some(el => {
      // Ignore the grid, background, or the interaction layer itself
      if (el === layer || el.classList.contains('canvas-grid') || el.id === 'infinite-canvas-container') return false;
      
      return el.getAttribute('data-element-id') || 
             el.classList.contains('selectable-element') ||
             el.closest('.selectable-element') ||
             el.closest('foreignObject') ||
             el.closest('g[data-element-id]');
    });

    if (isOverExistingElement) return; // Pass through to allow selection/hover/editing of existing content

    setInteracting(true);
    cachedRect.current = rect;
    
    if (!transform) return;
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
    } else if (activeTool === 'text') {
      const newId = generateId();
      const type = textType === 'formula' ? 'equation' : (textType === 'code' ? 'code' : 'label');
      
      const newObj = {
        id: newId,
        type,
        x: normalizedX,
        y: normalizedY,
        w: 0.2, h: 0.1,
        content: '', label: '',
        styles: {
          fontSize: textToolSize || 24,
          fontWeight: textWeight === 'bold' ? 700 : (textWeight === 'medium' ? 500 : 400),
          fontStyle: textItalic ? 'italic' : 'normal',
          textDecoration: textUnderline ? 'underline' : 'none',
          textAlign: textAlign || 'center',
          backgroundColor: textBgColor || 'transparent',
          fontFamily: textType === 'code' ? "'Geist Mono', monospace" : "'Inter', sans-serif"
        },
        color: drawColor || 'var(--text-primary)',
        animation: { type: 'scale', duration: 0.4 }
      };

      setCanvasObjectsWithHistory([...canvasObjects, newObj]);
      setSelectedElements([newId]);
      setActiveTool('select');
      setTimeout(() => {
        setEditingObjectId(newId);
        setInteracting(false);
      }, 50);
    }
  }, [activeTool, canvasObjects, drawColor, drawWidth, laserWidth, shapeFill, shapeStrokeStyle, textType, textToolSize, textWeight, textAlign, textBgColor, transform, setCanvasObjectsWithHistory, setSelectedElements, setActiveTool, setEditingObjectId, setInteracting]);


  const handlePointerMove = useCallback((e) => {
    // Eraser works without a draftObject
    if (!isDrawing.current || (!draftObject && activeTool !== 'draw:eraser') || draftObject?.isTyping) return;
    
    const { scale, x: tx, y: ty } = transform;
    const rect = cachedRect.current || layerRef.current.getBoundingClientRect();

    const worldX = (e.clientX - rect.left - tx) / scale;
    const worldY = (e.clientY - rect.top - ty) / scale;

    const normalizedX = (isSnapToGrid ? Math.round(worldX / gridSize) * gridSize : worldX) / V_WIDTH;
    const normalizedY = (isSnapToGrid ? Math.round(worldY / gridSize) * gridSize : worldY) / V_HEIGHT;

    if (activeTool.startsWith('shape:')) {
      if (!draftObject) return; // Guard against stale closures
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
        if (!isDrawing.current) return;
        
        // E2 OPTIMIZATION: Bounding Box Pre-Check
        const hit = canvasObjects.find(obj => {
          if (obj.x !== undefined && obj.y !== undefined && obj.w !== undefined && obj.h !== undefined) {
             const buffer = 0.05;
             if (normalizedX < obj.x - buffer || normalizedX > obj.x + obj.w + buffer ||
                 normalizedY < obj.y - buffer || normalizedY > obj.y + obj.h + buffer) {
               return false;
             }
          }

          if (obj.points) {
            for (let i = 0; i < obj.points.length; i += 2) {
              const p = obj.points[i];
              if (Math.abs(p[0]-normalizedX) < 0.02 && Math.abs(p[1]-normalizedY) < 0.02) return true;
            }
            return false;
          }
          
          if (obj.x && obj.y) {
             const dx = Math.abs(obj.x - normalizedX);
             const dy = Math.abs(obj.y - normalizedY);
             return dx < 0.04 && dy < 0.04;
          }
          return false;
        });

        if (hit) {
          setCanvasObjectsWithHistory(canvasObjects.filter(o => o.id !== hit.id));
        }
        return;
      }

      if (!draftObject) return;
      const lastPoint = draftObject.points[draftObject.points.length - 1];
      const dist = Math.sqrt(Math.pow(normalizedX - lastPoint[0], 2) + Math.pow(normalizedY - lastPoint[1], 2));
      
      if (dist > 0.0035) {
        setDraftObject(prev => ({
          ...prev,
          points: [...prev.points, [normalizedX, normalizedY]]
        }));
      }
    }
  }, [draftObject, activeTool, transform, isSnapToGrid, gridSize, canvasObjects, setCanvasObjectsWithHistory]);

  const handlePointerUp = useCallback((force = false) => {
    if (!force && (!isDrawing.current || !draftObject)) {
      isDrawing.current = false;
      setInteracting(false);
      return;
    }
    isDrawing.current = false;
    setInteracting(false);
    
    // Tap Detection: Abort shape creation if the drag was practically zero (a click)
    if (activeTool.startsWith('shape:')) {
      const isTiny = Math.abs(draftObject.w * V_WIDTH) < 5 && Math.abs(draftObject.h * V_HEIGHT) < 5;
      if (isTiny) {
        setDraftObject(null);
        setActiveTool('hand'); 
        return;
      }
    }
    
    const finalizedObject = { 
      ...draftObject,
      animation: { type: 'none' }, 
      fill: activeTool.startsWith('shape:') ? 'none' : draftObject.fill 
    };
    delete finalizedObject.isDraft;

    if (activeTool === 'draw:laser') {
      finalizedObject.isLaser = true;
      finalizedObject.animation = { type: 'scale', duration: 0.8 };
    }
    
    const centerOriginTypes = [
      'rect', 'ellipse', 'step_box', 'sticky', 
      'diamond', 'star', 'hexagon', 'callout', 'cloud'
    ];
    if (centerOriginTypes.includes(finalizedObject.type)) {
      finalizedObject.x = finalizedObject.x + (finalizedObject.w / 2);
      finalizedObject.y = finalizedObject.y + (finalizedObject.h / 2);
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
        [x + w / 2, y],      
        [x + w,     y + h],  
        [x,         y + h]   
      ];
    }

    setCanvasObjectsWithHistory([...canvasObjects, finalizedObject]);
    setDraftObject(null);

    if (activeTool.startsWith('shape:')) {
      setSelectedElements([finalizedObject.id]);
      setActiveTool('hand');
    }
  }, [activeTool, draftObject, canvasObjects, setCanvasObjectsWithHistory, setActiveTool, setSelectedElements, setInteracting]);

  // U4: Global Event Management to solve hover-blocking
  useEffect(() => {
    if (!isInteractionTool) return;

    const onGlobalDown = (e) => handlePointerDown(e);
    const onGlobalMove = (e) => handlePointerMove(e);
    const onGlobalUp = (e) => handlePointerUp();

    window.addEventListener('pointerdown', onGlobalDown);
    window.addEventListener('pointermove', onGlobalMove);
    window.addEventListener('pointerup', onGlobalUp);

    return () => {
      window.removeEventListener('pointerdown', onGlobalDown);
      window.removeEventListener('pointermove', onGlobalMove);
      window.removeEventListener('pointerup', onGlobalUp);
    };
  }, [isInteractionTool, handlePointerDown, handlePointerMove, handlePointerUp]);
  
  if (!isInteractionTool) return null;

  return (
    <div 
      ref={layerRef}
      className={`absolute inset-0 z-[100] ${isDrawing.current ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ cursor: activeTool === 'text' ? 'text' : getToolCursor(activeTool) }}
    >
      {draftObject && !draftObject.isTyping && (
        <svg width="100%" height="100%" className="border-none pointer-events-none overflow-visible">
          <motion.g animate={{ x: transform.x, y: transform.y, scale: transform.scale }}>
            {(() => {
              const dx = draftObject.x * V_WIDTH;
              const dy = draftObject.y * V_HEIGHT;
              const dw = draftObject.w * V_WIDTH;
              const dh = draftObject.h * V_HEIGHT;
              const strokeProps = {
                fill: "transparent",
                stroke: draftObject.color,
                strokeWidth: 2,
                strokeDasharray: draftObject.strokeStyle === 'dashed' ? '6,6' : (draftObject.strokeStyle === 'dotted' ? '2,4' : 'none')
              };

              switch (draftObject.type) {
                case 'rect':
                  return <rect x={dx} y={dy} width={dw} height={dh} rx={4} {...strokeProps} />;
                case 'diamond':
                  return <polygon points={getDiamondPoints(dx, dy, dw, dh)} {...strokeProps} />;
                case 'triangle':
                  return <polygon points={`${dx + dw/2},${dy} ${dx + dw},${dy + dh} ${dx},${dy + dh}`} {...strokeProps} />;
                case 'star':
                  return <polygon points={getStarPoints(dx, dy, dw, dh)} {...strokeProps} />;
                case 'hexagon':
                  return <polygon points={getHexagonPoints(dx, dy, dw, dh)} {...strokeProps} />;
                case 'ellipse':
                  return <ellipse cx={dx + dw/2} cy={dy + dh/2} rx={dw/2} ry={dh / 2} {...strokeProps} />;
                case 'line':
                case 'arrow':
                   return <line x1={draftObject.x1 * V_WIDTH} y1={draftObject.y1 * V_HEIGHT} x2={draftObject.x2 * V_WIDTH} y2={draftObject.y2 * V_HEIGHT} {...strokeProps} />;
                case 'path':
                  return <path d={getSvgPath(draftObject.points, V_WIDTH, V_HEIGHT)} fill="none" stroke={draftObject.color} strokeWidth={draftObject.strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeProps.strokeDasharray} />;
                case 'callout':
                case 'speech': {
                  const rw = dw / 2; const rh = dh / 2; const cx = dx + rw; const cy = dy + rh;
                  return <path d={`M ${cx - rw},${cy - rh} H ${cx + rw} V ${cy + rh} H ${cx - rw + 30} L ${cx - rw},${cy + rh + 20} L ${cx - rw + 15},${cy + rh} H ${cx - rw} Z`} {...strokeProps} />;
                }
                case 'cloud':
                  return <rect x={dx} y={dy} width={dw} height={dh} rx={20} {...strokeProps} />;
                default:
                  return <rect x={dx} y={dy} width={dw} height={dh} {...strokeProps} />;
              }
            })()}


          </motion.g>
        </svg>
      )}

    </div>
  );
});

export default InteractiveCanvasLayer;
