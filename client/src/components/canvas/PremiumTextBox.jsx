import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import useTutorStore from '../../store/tutorStore';
import { CanvasContext } from './CanvasContext';
import { Handle, RotateHandle, DeleteHandle } from './ElementHandles';
import FloatingFormatBar from './FloatingFormatBar';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants/canvas';


const PremiumTextBox = React.memo(({ obj, isSelected, onUpdate, onDelete }) => {
  const { 
    editingObjectId, 
    setEditingObjectId, 
    setSelectedElements, 
    activeTool,
    selectedElementIds,
    updateCanvasObjectSilently,
    commitHistory,
    setInteracting,
    setHasTextSelection
  } = useTutorStore();
  const { transform } = useContext(CanvasContext) || { transform: { scale: 1, x: 0, y: 0 } };
  
  const isEditing = editingObjectId === obj.id;
  const content = obj.content || obj.label || '';
  const sanitizedContent = React.useMemo(() => DOMPurify.sanitize(content), [content]);
  const styles = obj.styles || {};
  
  // Normalized stored bounds
  const px = (obj.x ?? 0.5) * CANVAS_WIDTH;
  const py = (obj.y ?? 0.5) * CANVAS_HEIGHT;
  const pbw = obj.w ? (obj.w <= 1 ? obj.w * CANVAS_WIDTH : obj.w) : (obj.scale || 1) * 200;
  const pbh = obj.h ? (obj.h <= 1 ? obj.h * CANVAS_HEIGHT : obj.h) : (obj.scale || 1) * 60;
  
  // Local state for dragging and immediate input response
  const [localContent, setLocalContent] = useState(content);
  const [localPos, setLocalPos] = useState({ x: px, y: py });
  const [localDim, setLocalDim] = useState({ w: Math.max(pbw, 100), h: Math.max(pbh, 40) });
  const [localRot, setLocalRot] = useState(obj.rotation || 0);
  
  // Dragging states
  const interactState = useRef({ action: null, startX: 0, startY: 0, startPos: {}, startDim: {}, startRot: 0 });
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isEditing && localContent !== content) setLocalContent(content);
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setInteracting(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(localContent.length, localContent.length);
      }
    } else {
      // Use rAF to ensure pointer events clear at the end of the frame before unlocking.
      // This prevents the 50ms race condition where rapid clicking is blocked.
      requestAnimationFrame(() => setInteracting(false));
    }
  }, [isEditing, setInteracting]);

  // BUG 10 FIX: Escape key to cancel editing
  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        commitHistory();
        setEditingObjectId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, setEditingObjectId]);

  // Synchronize local visually if store moves it remotely (except while interacting)
  useEffect(() => {
    if (!interactState.current.action) {
      setLocalPos({ x: px, y: py });
      setLocalDim({ w: Math.max(pbw, 100), h: Math.max(pbh, 40) });
      setLocalRot(obj.rotation || 0);
    }
  }, [px, py, pbw, pbh, obj.rotation]);

  // Expand textarea height based on scrollHeight
  const handleInput = (e) => {
    const val = e.target.value;
    setLocalContent(val);
    
    // Auto-resize
    e.target.style.height = 'auto';
    const newHeight = Math.max(40, e.target.scrollHeight);
    e.target.style.height = newHeight + 'px';
    
    setLocalDim(prev => ({ ...prev, h: newHeight }));
    updateCanvasObjectSilently(obj.id, { content: val, h: newHeight / CANVAS_HEIGHT });
  };

  const handleKeyDown = (e) => {
    // Tab Support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newVal = localContent.substring(0, start) + "    " + localContent.substring(end);
      setLocalContent(newVal);
      updateCanvasObjectSilently(obj.id, { content: newVal });
      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
    
    // Smart finish with Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      commitHistory();
      setEditingObjectId(null);
      setHasTextSelection(false);
    }
  };

  const handleSelectionChange = (e) => {
    const hasSelection = e.target.selectionStart !== e.target.selectionEnd;
    setHasTextSelection(hasSelection);
  };

  const handlePointerDown = (e, actionType) => {
    e.stopPropagation();
    
    // Switch to select tool if not editing, helps interaction
    if (activeTool !== 'select' && activeTool !== 'hand' && !isEditing) {
      useTutorStore.getState().setActiveTool('select');
    }
    
    if (!isEditing && actionType === 'move') {
      setSelectedElements([obj.id]);
    }
    
    if (isEditing && actionType === 'move') return; // Don't drag while typing

    interactState.current = {
      action: actionType,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...localPos },
      startDim: { ...localDim },
      startRot: localRot
    };

    setInteracting(true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    const { action, startX, startY, startPos, startDim } = interactState.current;
    if (!action) return;

    const dx = (e.clientX - startX) / transform.scale;
    const dy = (e.clientY - startY) / transform.scale;
    
    if (action === 'move') {
      setLocalPos({
        x: startPos.x + dx,
        y: startPos.y + dy
      });
    } else if (action === 'resize-br') {
      const newW = Math.max(80, startDim.w + dx);
      const newH = Math.max(40, startDim.h + dy);
      // Because pos is center, expanding w/h shifts the center
      setLocalDim({ w: newW, h: newH });
      setLocalPos({
        x: startPos.x + dx / 2,
        y: startPos.y + dy / 2
      });
    } else if (action === 'resize-bl') {
      const newW = Math.max(80, startDim.w - dx);
      const newH = Math.max(40, startDim.h + dy);
      setLocalDim({ w: newW, h: newH });
      setLocalPos({
        x: startPos.x + dx / 2,
        y: startPos.y + dy / 2
      });
    } else if (action === 'resize-tr') {
      const newW = Math.max(80, startDim.w + dx);
      const newH = Math.max(40, startDim.h - dy);
      setLocalDim({ w: newW, h: newH });
      setLocalPos({
        x: startPos.x + dx / 2,
        y: startPos.y + dy / 2
      });
    } else if (action === 'resize-tl') {
      const newW = Math.max(80, startDim.w - dx);
      const newH = Math.max(40, startDim.h - dy);
      setLocalDim({ w: newW, h: newH });
      setLocalPos({
        x: startPos.x + dx / 2,
        y: startPos.y + dy / 2
      });
    } else if (action === 'resize-t') {
      const newH = Math.max(40, startDim.h - dy);
      setLocalDim({ w: startDim.w, h: newH });
      setLocalPos({ x: startPos.x, y: startPos.y + dy / 2 });
    } else if (action === 'resize-b') {
      const newH = Math.max(40, startDim.h + dy);
      setLocalDim({ w: startDim.w, h: newH });
      setLocalPos({ x: startPos.x, y: startPos.y + dy / 2 });
    } else if (action === 'resize-l') {
      const newW = Math.max(80, startDim.w - dx);
      setLocalDim({ w: newW, h: startDim.h });
      setLocalPos({ x: startPos.x + dx / 2, y: startPos.y });
    } else if (action === 'resize-r') {
      const newW = Math.max(80, startDim.w + dx);
      setLocalDim({ w: newW, h: startDim.h });
      setLocalPos({ x: startPos.x + dx / 2, y: startPos.y });
    } else if (action === 'rotate') {
      const { startRot } = interactState.current;
      setLocalRot(startRot + dx * 0.5);
    }
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    
    // Commit to global store
    if (interactState.current.action) {
      // Small timeout to allow state to flush to local first safely
      setTimeout(() => {
        setLocalPos(prevPos => {
          setLocalDim(prevDim => {
            setLocalRot(prevRot => {
              onUpdate(obj.id, { 
                x: prevPos.x / CANVAS_WIDTH, 
                y: prevPos.y / CANVAS_HEIGHT, 
                w: prevDim.w / CANVAS_WIDTH, 
                h: prevDim.h / CANVAS_HEIGHT,
                rotation: prevRot
              });
              return prevRot;
            });
            return prevDim;
          });
          return prevPos;
        });
        setInteracting(false);
      }, 10);
    } else {
      setInteracting(false);
    }
    
    interactState.current.action = null;
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditingObjectId(obj.id);
  };

  // Selection / UI states
  const isDragging = interactState.current.action === 'move' || interactState.current.action === 'resize';
  const isPrimarySelection = selectedElementIds?.[0] === obj.id;
  const showUIContext = isSelected && !isEditing && isPrimarySelection && !isDragging;

  // We must calculate the top-left based on center because canvas x,y is center
  const renderLeft = localPos.x - localDim.w / 2;
  const renderTop = localPos.y - localDim.h / 2;

  return (
    <g style={{ transform: `rotate(${localRot}deg)`, transformOrigin: `${localPos.x}px ${localPos.y}px` }}>
      <foreignObject
        x={renderLeft - 300}
        y={renderTop - 200}
        width={localDim.w + 600}
        height={localDim.h + 400}
        style={{ overflow: 'visible' }}
      >
        <div className="relative w-full h-full flex items-center justify-center p-[20px]" style={{ pointerEvents: 'none' }}>
          
          {/* Main Box Area */}
          <motion.div
            animate={{
              scale: isDragging ? 1.02 : 1,
              boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.2)' : 'none'
            }}
            transition={{ duration: 0.15 }}
            className={`relative pointer-events-auto flex flex-col rounded-xl transition-all ${isSelected ? 'border border-dashed border-blue-500/50' : 'hover:ring-1 hover:ring-slate-500/30'}`}
            style={{ 
              width: localDim.w, 
              height: localDim.h,
              backgroundColor: styles.backgroundColor || 'transparent',
              cursor: isEditing ? 'text' : 'grab'
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onDoubleClick={handleDoubleClick}
            onClick={(e) => e.stopPropagation()}
          >


            {/* View Mode */}
            {!isEditing && (
              <div
                className={`w-full h-full p-2 whitespace-pre-wrap break-words overflow-hidden transition-all ${!localContent ? 'border border-dashed border-[var(--text-tertiary)]/30 rounded-lg bg-[var(--bg-tertiary)]/5 min-h-[40px]' : ''}`}
                style={{
                  fontFamily: styles.fontFamily || 'var(--font-sans)',
                  fontSize: styles.fontSize || 16,
                  fontWeight: styles.fontWeight || 'normal',
                  fontStyle: styles.fontStyle || 'normal',
                  textDecoration: styles.textDecoration || 'none',
                  textAlign: styles.textAlign || 'center',
                  color: obj.color || 'var(--text-primary)',
                  lineHeight: 1.4,
                  userSelect: 'none'
                }}
              >
                {localContent || <span className="opacity-30">Empty text...</span>}
              </div>
            )}

            {/* Edit Mode */}
            {isEditing && (
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onSelect={handleSelectionChange}
                onKeyUp={handleSelectionChange} // Handle arrow key selection
                onPointerUp={handleSelectionChange} // Handle mouse/touch selection release
                onBlur={() => {
                  commitHistory();
                  setEditingObjectId(null);
                  setHasTextSelection(false);
                }}
                onPointerDown={(e) => e.stopPropagation()} // Let user click inside to move cursor
                className="w-full bg-transparent outline-none resize-none p-2 rounded-xl transition-all"
                style={{
                  height: 'auto',
                  minHeight: localDim.h,
                  fontFamily: styles.fontFamily || 'var(--font-sans)',
                  fontSize: styles.fontSize || 16,
                  fontWeight: styles.fontWeight || 'normal',
                  fontStyle: styles.fontStyle || 'normal',
                  textDecoration: styles.textDecoration || 'none',
                  textAlign: styles.textAlign || 'center',
                  color: obj.color || 'var(--text-primary)',
                  lineHeight: 1.4,
                  boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.2)',
                  background: 'rgba(255,255,255,0.02)'
                }}
                placeholder="Type your content..."
                spellCheck={false}
              />
            )}

          {/* Selection Handles - Restored to match 1st pic (Visible during selection, even if editing) */}
            <AnimatePresence>
              {isSelected && !isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <div className="absolute inset-0 pointer-events-none" />
                  <Handle pos="top-left" onPointerDown={(e) => handlePointerDown(e, 'resize-tl')} />
                  <Handle pos="top-center" onPointerDown={(e) => handlePointerDown(e, 'resize-t')} />
                  <Handle pos="top-right" onPointerDown={(e) => handlePointerDown(e, 'resize-tr')} />
                  <Handle pos="left-center" onPointerDown={(e) => handlePointerDown(e, 'resize-l')} />
                  <Handle pos="right-center" onPointerDown={(e) => handlePointerDown(e, 'resize-r')} />
                  <Handle pos="bottom-left" onPointerDown={(e) => handlePointerDown(e, 'resize-bl')} />
                  <Handle pos="bottom-center" onPointerDown={(e) => handlePointerDown(e, 'resize-b')} />
                  <Handle pos="bottom-right" onPointerDown={(e) => handlePointerDown(e, 'resize-br')} />
                  <RotateHandle onPointerDown={(e) => handlePointerDown(e, 'rotate')} />
                  <DeleteHandle onClick={() => onDelete(obj.id)} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

      </foreignObject>
    </g>
  );
});

export default PremiumTextBox;