import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import FloatingFormatBar from './FloatingFormatBar.jsx';
import { CanvasContext } from './InfiniteCanvas.jsx';
import { RotateCw } from 'lucide-react';

const CW = 800;
const CH = 600;

export default function PremiumTextBox({ obj, isSelected, onUpdate, onDelete }) {
  const { editingObjectId, setEditingObjectId, setSelectedElements, activeTool } = useTutorStore();
  const { transform } = useContext(CanvasContext) || { transform: { scale: 1, x: 0, y: 0 } };
  
  const isEditing = editingObjectId === obj.id;
  const content = obj.content || obj.label || '';
  const styles = obj.styles || {};
  
  // Normalized stored bounds
  const px = (obj.x ?? 0.5) * CW;
  const py = (obj.y ?? 0.5) * CH;
  const pbw = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 200;
  const pbh = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 60;
  
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
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.setSelectionRange(localContent.length, localContent.length);
    }
  }, [isEditing]);

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
    onUpdate(obj.id, { content: val, h: newHeight / CH });
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
                x: prevPos.x / CW, 
                y: prevPos.y / CH, 
                w: prevDim.w / CW, 
                h: prevDim.h / CH,
                rotation: prevRot
              });
              return prevRot;
            });
            return prevDim;
          });
          return prevPos;
        });
      }, 10);
    }
    
    interactState.current.action = null;
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditingObjectId(obj.id);
  };

  const isDragging = interactState.current.action === 'move';
  const showUIContext = isSelected || isEditing;

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
            className={`relative pointer-events-auto flex flex-col ${showUIContext ? 'ring-1 ring-[var(--text-tertiary)] rounded-xl' : 'hover:ring-1 hover:ring-slate-500/30 rounded-xl'}`}
            style={{ 
              width: localDim.w, 
              height: localDim.h,
              backgroundColor: styles.backgroundColor || 'transparent',
              cursor: isEditing ? 'text' : 'grab'
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onDoubleClick={handleDoubleClick}
          >
            {/* View Mode */}
            {!isEditing && (
              <div
                className="w-full h-full p-2 whitespace-pre-wrap break-words overflow-hidden"
                style={{
                  fontFamily: styles.fontFamily || 'var(--font-sans)',
                  fontSize: styles.fontSize || 16,
                  fontWeight: styles.fontWeight || 'normal',
                  fontStyle: styles.fontStyle || 'normal',
                  textDecoration: styles.textDecoration || 'none',
                  textAlign: styles.textAlign || 'left',
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
                onPointerDown={(e) => e.stopPropagation()} // Let user click inside to move cursor
                className="w-full bg-transparent outline-none resize-none p-2 rounded-xl"
                style={{
                  height: localDim.h,
                  fontFamily: styles.fontFamily || 'var(--font-sans)',
                  fontSize: styles.fontSize || 16,
                  fontWeight: styles.fontWeight || 'normal',
                  fontStyle: styles.fontStyle || 'normal',
                  textDecoration: styles.textDecoration || 'none',
                  textAlign: styles.textAlign || 'left',
                  color: obj.color || 'var(--text-primary)',
                  lineHeight: 1.4,
                }}
                spellCheck={false}
              />
            )}

            {/* Handles */}
            <AnimatePresence>
              {showUIContext && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <Handle pos="top-left" onPointerDown={(e) => handlePointerDown(e, 'resize-tl')} />
                  <Handle pos="top-center" onPointerDown={(e) => handlePointerDown(e, 'resize-t')} />
                  <Handle pos="top-right" onPointerDown={(e) => handlePointerDown(e, 'resize-tr')} />
                  <Handle pos="left-center" onPointerDown={(e) => handlePointerDown(e, 'resize-l')} />
                  <Handle pos="right-center" onPointerDown={(e) => handlePointerDown(e, 'resize-r')} />
                  <Handle pos="bottom-left" onPointerDown={(e) => handlePointerDown(e, 'resize-bl')} />
                  <Handle pos="bottom-center" onPointerDown={(e) => handlePointerDown(e, 'resize-b')} />
                  <Handle pos="bottom-right" onPointerDown={(e) => handlePointerDown(e, 'resize-br')} />
                  <RotateHandle onPointerDown={(e) => handlePointerDown(e, 'rotate')} />
                </motion.div>
              )}
            </AnimatePresence>
            
          </motion.div>
          
          {/* Floating Format Bar */}
          <AnimatePresence>
            {showUIContext && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-1/2 -top-12 -translate-x-1/2 pointer-events-auto"
                onPointerDown={(e) => e.stopPropagation()} // Keep toolbar clicks from leaking to canvas
              >
                <FloatingFormatBar element={obj} updateCanvasObject={onUpdate} inSVG={true} />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </foreignObject>
    </g>
  );
}

const Handle = ({ pos, onPointerDown }) => {
  const isTop = pos.includes('top');
  const isBottom = pos.includes('bottom');
  const isLeft = pos.includes('left');
  const isRight = pos.includes('right');
  
  let cursor = 'auto';
  if ((isTop && isLeft) || (isBottom && isRight)) cursor = 'nwse-resize';
  else if ((isTop && isRight) || (isBottom && isLeft)) cursor = 'nesw-resize';
  else if (isTop || isBottom) cursor = 'ns-resize';
  else if (isLeft || isRight) cursor = 'ew-resize';
  
  let top = 'auto', bottom = 'auto', left = 'auto', right = 'auto', transform = 'none';
  if (isTop) top = -4;
  else if (isBottom) bottom = -4;
  else { top = '50%'; transform = 'translateY(-50%)'; }
  
  if (isLeft) left = -4;
  else if (isRight) right = -4;
  else { left = '50%'; transform = transform === 'none' ? 'translateX(-50%)' : 'translate(-50%, -50%)'; }

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute w-2 h-2 bg-[var(--bg-primary)] border border-[var(--text-primary)] pointer-events-auto shadow-sm hover:bg-[var(--text-primary)] transition-colors"
      style={{ top, bottom, left, right, transform, cursor }}
    />
  );
};

const RotateHandle = ({ onPointerDown }) => (
  <div
    onPointerDown={onPointerDown}
    className="absolute left-1/2 -top-10 -translate-x-1/2 w-6 h-6 flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--text-primary)] rounded-full pointer-events-auto shadow-sm cursor-grab hover:bg-[var(--bg-secondary)] transition-colors"
  >
    <RotateCw size={12} className="text-[var(--text-primary)]" strokeWidth={3} />
  </div>
);
