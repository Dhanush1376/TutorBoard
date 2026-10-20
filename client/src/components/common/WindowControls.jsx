import React from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';

/**
 * Window controls for panels (Settings, Code editor): size controls share one
 * soft capsule, and close is its own round button, easy to find and to hit.
 */
const Seg = ({ label, onClick, hoverColorClass, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`grid h-7 w-8 cursor-pointer place-items-center rounded-full text-[var(--text-secondary)] transition-all ${hoverColorClass} active:scale-90`}
  >
    {children}
  </button>
);

export default function WindowControls({ onClose, onMinimize, onMaximize, maximized = false, closeLabel = 'Close' }) {
  const sizing = onMinimize || onMaximize;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {sizing && (
        <div className="flex h-8 items-center rounded-full bg-[var(--st-fill-strong)] p-0.5 border border-[var(--st-line)]">
          {onMinimize && (
            <Seg label="Minimise" onClick={onMinimize} hoverColorClass="hover:!bg-[#f59e0b] hover:!text-white">
              <Minus size={15} strokeWidth={2.2} />
            </Seg>
          )}
          {onMaximize && (
            <Seg label={maximized ? 'Restore size' : 'Full screen'} onClick={onMaximize} hoverColorClass="hover:!bg-[#10b981] hover:!text-white">
              {maximized ? <Minimize2 size={13} strokeWidth={2.2} /> : <Maximize2 size={13} strokeWidth={2.2} />}
            </Seg>
          )}
        </div>
      )}
      <button
        type="button"
        title={closeLabel}
        aria-label={closeLabel}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="group grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill-strong)] text-[var(--text-secondary)] transition-all hover:!bg-[#ef4444] hover:!border-[#ef4444] hover:!text-white active:scale-90"
      >
        <X size={15} strokeWidth={2.2} className="transition-transform group-hover:scale-105" />
      </button>
    </div>
  );
}
