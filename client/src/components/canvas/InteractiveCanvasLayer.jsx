import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
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

// Helper: Convert raw points to a smooth SVG path string (Midpoint averaging)
const getSvgPath = (points, width, height) => {
  if (points.length < 2) return '';
  
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

// ID generator fallback
const generateId = () => `drawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const InteractiveCanvasLayer = () => {
  const { 
    activeTool: rawActiveTool, canvasObjects, setCanvasObjectsWithHistory,
    selectedElementIds, setSelectedElements, undo, redo, isSnapToGrid, 
    drawColor, drawWidth, gridSize, noteColor, noteSize, shapeFill, 
    shapeStrokeStyle, textType, textSize
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

  // Laser Pointer Auto-Cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const needsCleanup = canvasObjects.some(obj => obj.expiresAt && obj.expiresAt < now);
      if (needsCleanup) {
        setCanvasObjectsWithHistory(canvasObjects.filter(obj => !obj.expiresAt || obj.expiresAt >= now));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [canvasObjects, setCanvasObjectsWithHistory]);

  if (!isInteractionTool) return null;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const rect = layerRef.current.getBoundingClientRect();
    cachedRect.current = rect;
    
    // BUG 13 FIX: Calculate world coordinates by accounting for the current pan/zoom
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
      if (activeTool === 'draw:eraser') return; // Eraser doesn't create a draft object
      
      setDraftObject({
        id: generateId(),
        type: 'path',
        points: [[normalizedX, normalizedY]],
        color: activeTool === 'draw:highlighter' 
          ? (drawColor === 'var(--text-primary)' ? 'rgba(255, 255, 0, 0.5)' : `${drawColor}80`) 
          : (activeTool === 'draw:laser' ? '#fde047' : drawColor),
        strokeWidth: activeTool === 'draw:highlighter' ? 12 : (activeTool === 'draw:laser' ? 4 : drawWidth),
        isDraft: true,
      });
    } else if (activeTool === 'text' || activeTool === 'note') {
      const isNote = activeTool === 'note';
      const w = isNote ? (noteSize === 'small' ? 0.18 : noteSize === 'large' ? 0.35 : 0.25) : 0.25;
      const h = isNote ? (noteSize === 'small' ? 0.1 : noteSize === 'large' ? 0.22 : 0.15) : 0.15;
      
      const type = isNote ? 'step_box' : (
        textType === 'code' ? 'code_panel' : 
        textType === 'formula' ? 'equation' : 'label'
      );

      setDraftObject({
        id: generateId(),
        type,
        x: normalizedX,
        y: normalizedY,
        w,
        h,
        scale: isNote ? 1 : (textSize / 16),
        color: isNote ? noteColor : 'var(--text-primary)',
        text: '',
        isDraft: true,
        isTyping: true,
        animation: { type: isNote ? 'drop' : 'scale', duration: 0.4 }
      });
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
    if (finalizedObject.type === 'rect' || finalizedObject.type === 'ellipse' || finalizedObject.type === 'step_box') {
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
            {draftObject.type === 'rect' && (
               <rect 
                 x={(draftObject.x - draftObject.w/2) * V_WIDTH} 
                 y={(draftObject.y - draftObject.h/2) * V_HEIGHT} 
                 width={draftObject.w * V_WIDTH} 
                 height={draftObject.h * V_HEIGHT} 
                 fill="transparent" 
                 stroke={draftObject.color} 
                 strokeWidth={2} 
                 strokeDasharray="4 4"
                 rx={12}
               />
            )}
            {draftObject.type === 'ellipse' && (
               <ellipse 
                 cx={draftObject.x * V_WIDTH} 
                 cy={draftObject.y * V_HEIGHT} 
                 rx={(draftObject.w/2) * V_WIDTH} 
                 ry={(draftObject.h/2) * V_HEIGHT} 
                 fill="transparent" 
                 stroke={draftObject.color} 
                 strokeWidth={2} 
                 strokeDasharray="4 4"
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
                stroke={draftObject.color} strokeWidth={2} strokeDasharray="4 4"
              />
            )}
            {draftObject.type === 'triangle' && (
               <polygon
                 points={`
                   ${draftObject.x * V_WIDTH}, ${(draftObject.y - draftObject.h/2)*V_HEIGHT}
                   ${(draftObject.x + draftObject.w/2)*V_WIDTH},   ${(draftObject.y + draftObject.h/2)*V_HEIGHT}
                   ${(draftObject.x - draftObject.w/2)*V_WIDTH},   ${(draftObject.y + draftObject.h/2)*V_HEIGHT}
                 `}
                 fill="none"
                 stroke={draftObject.color} strokeWidth={2} strokeDasharray="4 4"
               />
            )}
          </motion.g>
        </svg>
      )}

      {draftObject?.isTyping && (
        <textarea
          autoFocus
          placeholder="Start typing..."
          className="absolute bg-transparent text-[var(--text-primary)] outline-none resize-none font-medium leading-relaxed placeholder:opacity-50"
          style={{
            left: ((draftObject.x - draftObject.w/2) * V_WIDTH * transform.scale) + transform.x,
            top: ((draftObject.y - draftObject.h/2) * V_HEIGHT * transform.scale) + transform.y,
            width: draftObject.w * V_WIDTH * transform.scale,
            height: draftObject.h * V_HEIGHT * transform.scale,
            fontSize: (draftObject.type === 'label' ? 24 : 14) * transform.scale,
            background: draftObject.type === 'step_box' ? (noteColor || 'rgba(251,191,36,0.9)') : 'transparent',
            color: draftObject.type === 'step_box' ? '#fff' : 'var(--text-primary)',
            padding: (draftObject.type === 'step_box' ? 12 : 0) * transform.scale,
            borderRadius: 8 * transform.scale,
            boxShadow: draftObject.type === 'step_box' ? '0 8px 32px rgba(0,0,0,0.2)' : 'none',
            border: draftObject.type === 'label' ? '1px dashed var(--border-color)' : 'none',
          }}
          value={draftObject.text || ''}
          onChange={(e) => setDraftObject(prev => ({ ...prev, text: e.target.value }))}
          onBlur={() => {
            if (draftObject.text.trim()) {
              handlePointerUp(true); // Force commit
            } else {
              setDraftObject(null); // Cancel empty drafts
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && e.shiftKey)) {
              e.target.blur();
            }
          }}
        />
      )}
    </div>
  );
};

export default InteractiveCanvasLayer;
