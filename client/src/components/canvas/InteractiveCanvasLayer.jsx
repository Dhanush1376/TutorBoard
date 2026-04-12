import React, { useRef, useState, useEffect, useMemo } from 'react';
import useTutorStore from '../../store/tutorStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * InteractiveCanvasLayer
 *
 * Sits directly on top of the world-coordinate transformed canvas layer.
 * Intercepts drawing, shape creation, and text interactions.
 * Pushes finalized elements to the global `tutorStore`.
 */

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
const InteractiveCanvasLayer = () => {
  const { 
    activeTool: rawActiveTool, canvasObjects, setCanvasObjectsWithHistory, addCanvasObjects, 
    getCanvasTransform, selectedElementIds, setSelectedElements, history,
    undo, redo, isSnapToGrid, drawColor, drawWidth, gridSize,
    noteColor, noteSize, shapeFill, shapeStrokeStyle,
    textType, textSize
  } = useTutorStore();
  
  // Normalize tool IDs: Treat root IDs as their primary variants
  const activeTool = useMemo(() => {
    if (rawActiveTool === 'draw') return 'draw:pen';
    if (rawActiveTool === 'shape') return 'shape:rect';
    return rawActiveTool;
  }, [rawActiveTool]);

  const [draftObject, setDraftObject] = useState(null);
  
  const layerRef = useRef(null);
  const isDrawing = useRef(false);
  const startPoint = useRef(null);

  // Determine if this layer should actually handle events
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
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
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

  // CRITICAL: If we are not using a drawing tool, don't even render.
  // This allows events (selection, panning) to fall through to siblings or parents.
  if (!isInteractionTool) return null;

  const handlePointerDown = (e) => {
    // Stop propagation ONLY if we are actually handling a click
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click

    const rect = layerRef.current.getBoundingClientRect();
    const snap = (val, size = gridSize) => isSnapToGrid ? Math.round(val / size) * size : val;

    // We use relative coordinates because this layer is already inside the InfiniteCanvas transform container
    const rawX = e.nativeEvent.offsetX;
    const rawY = e.nativeEvent.offsetY;
    
    const normalizedX = (rawX) / 800; 
    const normalizedY = (rawY) / 600;

    isDrawing.current = true;
    startPoint.current = { x: normalizedX, y: normalizedY };

    if (activeTool.startsWith('shape:')) {
      const shapeType = activeTool.split(':')[1];
      const isLinear = shapeType === 'line' || shapeType === 'arrow';
      
      setDraftObject({
        id: `draft-${Date.now()}`,
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
      if (activeTool === 'draw:eraser') return;
      
      setDraftObject({
        id: `draft-${Date.now()}`,
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

      // Text & Notes immediately drop an editable bounding box
      setDraftObject({
        id: `draft-${Date.now()}`,
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
    if (!isDrawing.current || !draftObject || draftObject.isTyping) return;
    
    const snap = (val, size = gridSize) => isSnapToGrid ? Math.round(val / size) * size : val;

    const normalizedX = snap(e.nativeEvent.offsetX) / 800;
    const normalizedY = snap(e.nativeEvent.offsetY) / 600;

    if (activeTool.startsWith('shape:')) {
      // Calculate bounding box logic
      const w = normalizedX - startPoint.current.x;
      const h = normalizedY - startPoint.current.y;
      const shapeType = draftObject.type;
      const isLinear = shapeType === 'line' || shapeType === 'arrow';
      
      setDraftObject(prev => ({
        ...prev,
        w: Math.abs(w),
        h: Math.abs(h),
        // If drawing backwards, shift the anchor
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

      // Smoothing: only add points if they moved significantly
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
    
    // Commit to global store
    const finalizedObject = { ...draftObject };
    delete finalizedObject.isDraft;

    if (activeTool === 'draw:laser') {
      finalizedObject.expiresAt = Date.now() + 1500;
      finalizedObject.animation = { type: 'scale', duration: 0.8 };
    }
    
    // Formatting
    if (finalizedObject.type === 'rect' || finalizedObject.type === 'ellipse' || finalizedObject.type === 'step_box') {
      finalizedObject.x = finalizedObject.x + (finalizedObject.w / 2);
      finalizedObject.y = finalizedObject.y + (finalizedObject.h / 2);
      finalizedObject.scale = Math.max(finalizedObject.w, finalizedObject.h); 
    }
    
    // Pass text into label prop for CinematicShapes
    if (finalizedObject.text !== undefined) {
      finalizedObject.label = finalizedObject.text;
      delete finalizedObject.text;
      delete finalizedObject.isTyping;
    }
    
    // Process final path
    if (finalizedObject.type === 'path') {
      finalizedObject.path = getSvgPath(finalizedObject.points, 1, 1); // Normalized path
    }

    // Process Triangle points
    if (finalizedObject.type === 'triangle') {
      const { x, y, w, h } = finalizedObject;
      finalizedObject.points = [
        [x + w / 2, y],      // Top Middle
        [x + w,     y + h],  // Bottom Right
        [x,         y + h]   // Bottom Left
      ];
    }

    setCanvasObjectsWithHistory([...canvasObjects, finalizedObject]);
    setDraftObject(null);
  };

  // Render the draft object live
  return (
    <div 
      ref={layerRef}
      className={`absolute inset-0 z-50 ${draftObject?.isTyping ? '' : 'cursor-crosshair touch-none'}`}
      onPointerDown={draftObject?.isTyping ? undefined : handlePointerDown}
      onPointerMove={draftObject?.isTyping ? undefined : handlePointerMove}
      onPointerUp={draftObject?.isTyping ? undefined : handlePointerUp}
      onPointerCancel={draftObject?.isTyping ? undefined : handlePointerUp}
      style={{ width: 800, height: 600 }}
    >
      {draftObject && !draftObject.isTyping && (
        <svg width="100%" height="100%" viewBox="0 0 800 600" className="pointer-events-none">
          {draftObject.type === 'rect' && (
             <rect 
               x={draftObject.x * 800} 
               y={draftObject.y * 600} 
               width={draftObject.w * 800} 
               height={draftObject.h * 600} 
               fill="transparent" 
               stroke={draftObject.color} 
               strokeWidth={2} 
               strokeDasharray="4 4"
             />
          )}
          {draftObject.type === 'ellipse' && (
             <ellipse 
               cx={(draftObject.x + draftObject.w/2) * 800} 
               cy={(draftObject.y + draftObject.h/2) * 600} 
               rx={(draftObject.w/2) * 800} 
               ry={(draftObject.h/2) * 600} 
               fill="transparent" 
               stroke={draftObject.color} 
               strokeWidth={2} 
               strokeDasharray="4 4"
             />
          )}
          {draftObject.type === 'path' && (
             <path
               d={getSvgPath(draftObject.points, 800, 600)}
               fill="none"
               stroke={draftObject.color}
               strokeWidth={draftObject.strokeWidth}
               strokeLinecap="round"
               strokeLinejoin="round"
             />
          )}
          {(draftObject.type === 'line' || draftObject.type === 'arrow') && (
            <line
              x1={draftObject.x1 * 800} y1={draftObject.y1 * 600}
              x2={draftObject.x2 * 800} y2={draftObject.y2 * 600}
              stroke={draftObject.color} strokeWidth={2} strokeDasharray="4 4"
            />
          )}
          {draftObject.type === 'triangle' && (
             <polygon
               points={`
                 ${(draftObject.x + draftObject.w/2)*800}, ${draftObject.y*600}
                 ${(draftObject.x + draftObject.w)*800},   ${(draftObject.y + draftObject.h)*600}
                 ${draftObject.x*800},                     ${(draftObject.y + draftObject.h)*600}
               `}
               fill="none"
               stroke={draftObject.color} strokeWidth={2} strokeDasharray="4 4"
             />
          )}
        </svg>
      )}

      {draftObject?.isTyping && (
        <textarea
          autoFocus
          className="absolute bg-transparent text-[var(--text-primary)] outline-none resize-none font-medium leading-relaxed"
          style={{
            left: draftObject.x * 800,
            top: draftObject.y * 600,
            width: draftObject.w * 800,
            height: draftObject.h * 600,
            fontSize: draftObject.type === 'label' ? 24 : 16,
            background: draftObject.type === 'step_box' ? 'rgba(251,191,36,0.9)' : 'transparent',
            color: draftObject.type === 'step_box' ? '#fff' : 'var(--text-primary)',
            padding: draftObject.type === 'step_box' ? '12px' : 0,
            borderRadius: draftObject.type === 'step_box' ? '8px' : 0,
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
