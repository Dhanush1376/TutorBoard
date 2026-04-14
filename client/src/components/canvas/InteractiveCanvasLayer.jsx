import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './InfiniteCanvas';
import { getToolCursor } from '../../utils/cursors';

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

// High-Fidelity Geometry Helpers for Drafting
const getStarPoints = (x, y, w, h) => {
  const rOuter = Math.min(w, h) / 2;
  const rInner = rOuter * 0.4;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
};

const getHexagonPoints = (x, y, w, h) => {
  const rw = w / 2;
  const rh = h / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(`${cx + rw * Math.cos(angle)},${cy + rh * Math.sin(angle)}`);
  }
  return points.join(' ');
};

const getDiamondPoints = (x, y, w, h) => {
  const dw = w / 2;
  const dh = h / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `${cx},${cy - dh} ${cx + dw},${cy} ${cx},${cy + dh} ${cx - dw},${cy}`;
};

const InteractiveCanvasLayer = () => {
  const { 
    activeTool: rawActiveTool, canvasObjects, setCanvasObjectsWithHistory,
    selectedElementIds, setSelectedElements, undo, redo, isSnapToGrid, 
    drawColor, drawWidth, laserWidth, gridSize, noteColor, noteSize, shapeFill, 
    shapeStrokeStyle, textType, textToolSize, textWeight, textAlign, textBgColor,
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
                            activeTool === 'shape' ||
                            activeTool.startsWith('shape:') || 
                            activeTool === 'text';

  // Keyboard shortcuts (Undo, Redo, Delete) removed per user request

  // Keyboard shortcuts (Undo, Redo, Delete) removed per user request

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
          fontSize: textToolSize || 24,
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
    
    // Tap Detection: Abort shape creation if the drag was practically zero (a click)
    if (activeTool.startsWith('shape:')) {
      const isTiny = Math.abs(draftObject.w * V_WIDTH) < 5 && Math.abs(draftObject.h * V_HEIGHT) < 5;
      if (isTiny) {
        setDraftObject(null);
        setActiveTool('hand'); // Revert to hand so user can select underneath
        return;
      }
    }
    
    const finalizedObject = { 
      ...draftObject,
      animation: { type: 'none' }, // Instant appearance for manual drawing
      fill: activeTool.startsWith('shape:') ? 'none' : draftObject.fill // Default to outline for shapes
    };
    delete finalizedObject.isDraft;

    if (activeTool === 'draw:laser') {
      finalizedObject.isLaser = true;
      finalizedObject.animation = { type: 'scale', duration: 0.8 };
    }
    
    // Formatting & Coordinate Restoration
    const centerOriginTypes = [
      'rect', 'ellipse', 'step_box', 'sticky', 
      'diamond', 'star', 'hexagon', 'callout', 'cloud'
    ];
    if (centerOriginTypes.includes(finalizedObject.type)) {
      // Keep coordinates normalized (0..1) but finalize center point
      finalizedObject.x = finalizedObject.x + (finalizedObject.w / 2);
      finalizedObject.y = finalizedObject.y + (finalizedObject.h / 2);
      
      // Calculate a scale that represents the object's size relative to the standard 160px box.
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

    // Single-Use Tool Logic: Auto-select and revert to hand for continuous flow
    if (activeTool.startsWith('shape:')) {
      setSelectedElements([finalizedObject.id]);
      setActiveTool('hand');
    }
  };

  return (
    <div 
      ref={layerRef}
      className="absolute inset-0 z-[100] pointer-events-auto"
      style={{ cursor: getToolCursor(activeTool) }}
      onPointerDown={draftObject?.isTyping ? undefined : handlePointerDown}
      onPointerMove={draftObject?.isTyping ? undefined : handlePointerMove}
      onPointerUp={draftObject?.isTyping ? undefined : () => handlePointerUp()}
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
};

export default InteractiveCanvasLayer;
