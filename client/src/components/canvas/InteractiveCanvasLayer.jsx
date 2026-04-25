import React, { useRef, useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './CanvasContext';
import { getToolCursor } from '../../utils/cursors';
import { getSvgPath, getStarPoints, getHexagonPoints, getDiamondPoints } from '../../utils/geometryUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';

/**
 * InteractiveCanvasLayer
 *
 * Sits directly on top of the world-coordinate transformed canvas layer.
 * Intercepts drawing, shape creation, and text interactions.
 * Pushes finalized elements to the global `tutorStore`.
 */

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

  const isInteractionTool = (
    (activeTool && String(activeTool).startsWith('draw:')) ||
    activeTool === 'shape' ||
    (activeTool && String(activeTool).startsWith('shape:')) ||
    activeTool === 'text'
  );

  const pointsRef = useRef([]);
  const draftStateRef = useRef(null);

  const handlePointerDown = useCallback((e) => {
    if (isDrawing.current || draftStateRef.current?.isTyping) return;
    if (e.button !== 0) return;

    const layer = layerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    if (!transform) return;
    const { scale, x: tx, y: ty } = transform;
    const worldX = (e.clientX - rect.left - tx) / scale;
    const worldY = (e.clientY - rect.top - ty) / scale;
    const normalizedX = worldX / CANVAS_WIDTH; 
    const normalizedY = worldY / CANVAS_HEIGHT;

    const isOverExistingElement = canvasObjects.some(obj => {
      // SEC-20: Reduced default hitbox (from 8% to 2%) for elements without explicit bounds.
      // This prevents large invisible bounding boxes from blocking drawing activity.
      const bw = obj.w || (obj.scale || 1) * 0.02;
      const bh = obj.h || (obj.scale || 1) * 0.015;
      return (
        normalizedX >= obj.x - bw/2 && normalizedX <= obj.x + bw/2 &&
        normalizedY >= obj.y - bh/2 && normalizedY <= obj.y + bh/2
      );
    });

    if (isOverExistingElement) return;
    
    // TRIPLE TAP DETECTION
    const now = Date.now();
    if (now - tapCounter.current.last < 400) {
      tapCounter.current.count += 1;
    } else {
      tapCounter.current.count = 1;
    }
    tapCounter.current.last = now;

    if (tapCounter.current.count === 3) {
      const { deselectAll } = useTutorStore.getState();
      deselectAll?.();
      tapCounter.current.count = 0;
      return;
    }

    // Only set global interaction lock for tools that involve dragging/drawing paths
    const isDragTool = activeTool.startsWith('draw:') || activeTool.startsWith('shape:');
    if (isDragTool) setInteracting(true);
    
    cachedRect.current = rect;
    isDrawing.current = true;
    startPoint.current = { x: normalizedX, y: normalizedY };
    pointsRef.current = [[normalizedX, normalizedY]];

    let newDraft = null;
    if (activeTool.startsWith('shape:')) {
      const shapeType = activeTool.split(':')[1];
      const isLinear = shapeType === 'line' || shapeType === 'arrow';
      newDraft = {
        id: generateId(),
        type: shapeType,
        x: normalizedX, y: normalizedY,
        x1: isLinear ? normalizedX : undefined, y1: isLinear ? normalizedY : undefined,
        x2: isLinear ? normalizedX : undefined, y2: isLinear ? normalizedY : undefined,
        w: 0, h: 0,
        color: drawColor, strokeWidth: drawWidth, fill: shapeFill, strokeStyle: shapeStrokeStyle,
        dashed: shapeStrokeStyle === 'dashed', isDraft: true,
        animation: { type: 'bounce', duration: 0.3 }
      };
    } else if (activeTool.startsWith('draw:')) {
      if (activeTool === 'draw:eraser') return;
      newDraft = {
        id: generateId(),
        type: 'path',
        points: [[normalizedX, normalizedY]],
        color: activeTool === 'draw:highlighter' 
          ? (drawColor === 'var(--text-primary)' ? 'rgba(255, 255, 0, 0.5)' : `${drawColor}80`) 
          : (activeTool === 'draw:laser' ? '#fde047' : drawColor),
        strokeWidth: activeTool === 'draw:highlighter' ? 12 : (activeTool === 'draw:laser' ? laserWidth : drawWidth),
        isDraft: true,
      };
    } else if (activeTool === 'text') {
      const newId = generateId();
      const type = textType === 'formula' ? 'equation' : (textType === 'code' ? 'code' : 'label');
      const w = 0.2; const h = 0.08;
      const newObj = {
        id: newId, type,
        x: normalizedX + (w / 2), y: normalizedY + (h / 2),
        w, h, content: '', label: '',
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
      const latestObjects = useTutorStore.getState().canvasObjects;
      setCanvasObjectsWithHistory([...latestObjects, newObj]);
      setSelectedElements([newId]);
      setActiveTool('select');
      setTimeout(() => {
        setEditingObjectId(newId);
        // Note: setInteracting(false) was moved/removed to prevent race conditions
      }, 50);
      return; // Exit early as text doesn't need drag logic
    }
    
    draftStateRef.current = newDraft;
    setDraftObject(newDraft);
  }, [activeTool, transform, setInteracting, canvasObjects, drawColor, drawWidth, shapeFill, shapeStrokeStyle, textType, textToolSize, textWeight, textItalic, textUnderline, textAlign, textBgColor, setSelectedElements, setCanvasObjectsWithHistory, setActiveTool, addNoteToCanvas, setEditingObjectId]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawing.current || (!draftStateRef.current && activeTool !== 'draw:eraser')) return;
    
    const state = useTutorStore.getState();
    const { scale, x: tx, y: ty } = transform || state.canvasTransform;
    const rect = cachedRect.current || layerRef.current.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - tx) / scale;
    const worldY = (e.clientY - rect.top - ty) / scale;
    const { isSnapToGrid, gridSize } = state;
    const normalizedX = (isSnapToGrid ? Math.round(worldX / gridSize) * gridSize : worldX) / CANVAS_WIDTH;
    const normalizedY = (isSnapToGrid ? Math.round(worldY / gridSize) * gridSize : worldY) / CANVAS_HEIGHT;

    if (activeTool.startsWith('shape:')) {
      const draft = draftStateRef.current;
      if (!draft) return;
      const w = normalizedX - startPoint.current.x;
      const h = normalizedY - startPoint.current.y;
      const isLinear = draft.type === 'line' || draft.type === 'arrow';
      
      const updated = {
        ...draft, w: Math.abs(w), h: Math.abs(h),
        x: w < 0 ? normalizedX : startPoint.current.x,
        y: h < 0 ? normalizedY : startPoint.current.y,
        x2: isLinear ? normalizedX : undefined, y2: isLinear ? normalizedY : undefined,
      };
      draftStateRef.current = updated;
      setDraftObject(updated);
    } else if (activeTool.startsWith('draw:')) {
      if (activeTool === 'draw:eraser') {
        const currentObjects = useTutorStore.getState().canvasObjects;
        const hit = currentObjects.find(obj => {
          if (obj.points) {
            // SEC-21: Check every point (i++) rather than skipping (i+=2) 
            // for reliable erasure on thin/curved strokes.
            for (let i = 0; i < obj.points.length; i++) {
              const p = obj.points[i];
              if (Math.abs(p[0]-normalizedX) < 0.02 && Math.abs(p[1]-normalizedY) < 0.02) return true;
            }
          } else if (obj.x && obj.y) {
             const dx = Math.abs(obj.x - normalizedX);
             const dy = Math.abs(obj.y - normalizedY);
             if (dx < 0.04 && dy < 0.04) return true;
          }
          return false;
        });
        if (hit) state.setCanvasObjectsWithHistory(currentObjects.filter(o => o.id !== hit.id));
        return;
      }

      const points = pointsRef.current;
      const lastPoint = points[points.length - 1];
      const dist = Math.sqrt(Math.pow(normalizedX - lastPoint[0], 2) + Math.pow(normalizedY - lastPoint[1], 2));
      
      if (dist > 0.003) {
        points.push([normalizedX, normalizedY]);
        const updated = { ...draftStateRef.current, points: [...points] };
        draftStateRef.current = updated;
        setDraftObject(updated);
      }
    }
  }, [activeTool, transform]);

  const handlePointerUp = useCallback(() => {
    const draft = draftStateRef.current;
    isDrawing.current = false;
    setInteracting(false);
    draftStateRef.current = null;
    
    if (!draft) {
      setDraftObject(null);
      return;
    }
    
    const state = useTutorStore.getState();

    if (activeTool.startsWith('shape:')) {
      const isTiny = Math.abs(draft.w * CANVAS_WIDTH) < 5 && Math.abs(draft.h * CANVAS_HEIGHT) < 5;
      if (isTiny) {
        setDraftObject(null);
        state.setActiveTool('hand'); 
        return;
      }
    }
    
    const finalizedObject = { ...draft, animation: { type: 'fade', duration: 0.3 } };
    delete finalizedObject.isDraft;

    if (activeTool === 'draw:laser') {
      finalizedObject.isLaser = true;
      finalizedObject.animation = { type: 'scale', duration: 0.8 };
    }
    
    const centerOriginTypes = ['rect', 'ellipse', 'step_box', 'sticky', 'diamond', 'star', 'hexagon', 'callout', 'cloud'];
    if (centerOriginTypes.includes(finalizedObject.type)) {
      finalizedObject.x = finalizedObject.x + (finalizedObject.w / 2);
      finalizedObject.y = finalizedObject.y + (finalizedObject.h / 2);
      finalizedObject.scale = (finalizedObject.w * CANVAS_WIDTH) / 160; 
    }
    
    if (finalizedObject.type === 'path') {
      finalizedObject.path = getSvgPath(pointsRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (!finalizedObject.path) {
        setDraftObject(null);
        return;
      }
      finalizedObject.points = [...pointsRef.current];
    }

    setDraftObject(null);
    pointsRef.current = [];
    isDrawing.current = false;
    setInteracting(false);
    draftStateRef.current = null;

    state.addCanvasObjects([finalizedObject]);

    if (activeTool.startsWith('shape:')) {
      state.setSelectedElements([finalizedObject.id]);
      state.setActiveTool('hand');
    }
  }, [activeTool, setInteracting]);

  useEffect(() => {
    if (!isInteractionTool) return;
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isInteractionTool, handlePointerDown, handlePointerMove, handlePointerUp]);
  
  useEffect(() => {
    if (isInteractionTool) {
      document.body.style.cursor = activeTool === 'text' ? 'text' : getToolCursor(activeTool);
    } else {
      document.body.style.cursor = 'default';
    }
    return () => { document.body.style.cursor = 'default'; };
  }, [isInteractionTool, activeTool]);

  if (!isInteractionTool) return null;

  return (
    <div 
      ref={layerRef}
      className="absolute inset-0 z-10 pointer-events-auto"
    >
      <AnimatePresence>
        {draftObject && !draftObject.isTyping && (
          <svg key={`draft-svg-${draftObject.id}`} width="100%" height="100%" className="border-none pointer-events-none overflow-visible">
            <motion.g
              key={`draft-${draftObject.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ pointerEvents: 'none' }}
            >
              {/* SEC-19: Using native transform attribute for pixel-perfect alignment with canvas world coords */}
              <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                {(() => {
                  const dx = draftObject.x * CANVAS_WIDTH;
                  const dy = draftObject.y * CANVAS_HEIGHT;
                  const dw = draftObject.w * CANVAS_WIDTH;
                  const dh = draftObject.h * CANVAS_HEIGHT;
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
                      return <line x1={draftObject.x1 * CANVAS_WIDTH} y1={draftObject.y1 * CANVAS_HEIGHT} x2={draftObject.x2 * CANVAS_WIDTH} y2={draftObject.y2 * CANVAS_HEIGHT} {...strokeProps} />;
                    case 'path':
                      return <path d={getSvgPath(draftObject.points, CANVAS_WIDTH, CANVAS_HEIGHT)} fill="none" stroke={draftObject.color} strokeWidth={draftObject.strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeProps.strokeDasharray} />;
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
              </g>
            </motion.g>
          </svg>
        )}
      </AnimatePresence>
    </div>
  );
});

export default InteractiveCanvasLayer;
