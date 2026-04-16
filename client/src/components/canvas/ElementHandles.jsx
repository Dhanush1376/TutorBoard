import React from 'react';
import { RotateCw, Trash2 } from 'lucide-react';

export const Handle = ({ pos, onPointerDown }) => {
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

export const RotateHandle = ({ onPointerDown }) => (
  <div
    onPointerDown={onPointerDown}
    className="absolute left-1/2 -top-10 -translate-x-1/2 w-6 h-6 flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--text-primary)] rounded-full pointer-events-auto shadow-sm cursor-grab hover:bg-[var(--bg-secondary)] transition-colors"
  >
    <RotateCw size={12} className="text-[var(--text-primary)]" strokeWidth={3} />
  </div>
);

export const DeleteHandle = ({ onClick }) => (
  <div
    onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
    className="absolute left-1/2 -top-10 translate-x-[24px] w-6 h-6 flex items-center justify-center bg-red-500 border border-red-600 rounded-full pointer-events-auto shadow-sm cursor-pointer hover:bg-red-600 transition-colors group"
    title="Delete Element"
  >
    <Trash2 size={12} className="text-white" strokeWidth={3} />
  </div>
);
