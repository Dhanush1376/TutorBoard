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
  return (
    <div className="flex shrink-0 items-center gap-2">
      {onMinimize && onMaximize ? (
        <div className="flex h-8 items-center rounded-full bg-[var(--st-fill-strong)] p-0.5 border border-[var(--st-line)]">
          <Seg label="Minimise" onClick={onMinimize} hoverColorClass="hover:!bg-[#f59e0b] hover:!text-white">
            <Minus size={15} strokeWidth={2.2} />
          </Seg>
          <Seg label={maximized ? 'Restore size' : 'Full screen'} onClick={onMaximize} hoverColorClass="hover:!bg-[#10b981] hover:!text-white">
            {maximized ? <Minimize2 size={13} strokeWidth={2.2} /> : <Maximize2 size={13} strokeWidth={2.2} />}
          </Seg>
        </div>
      ) : (
        <>
          {onMinimize && (
            <button
              type="button"
              title="Minimise"
              aria-label="Minimise"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              className="group grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] text-[var(--text-secondary)] shadow-sm transition-all hover:!bg-[#f59e0b] hover:!text-white active:scale-90"
            >
              <Minus size={14} strokeWidth={2.2} />
            </button>
          )}
          {onMaximize && (
            <button
              type="button"
              title={maximized ? 'Restore size' : 'Full screen'}
              aria-label={maximized ? 'Restore size' : 'Full screen'}
              onClick={(e) => {
                e.stopPropagation();
                onMaximize();
              }}
              className="group grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] text-[var(--text-secondary)] shadow-sm transition-all hover:bg-[var(--st-fill-strong)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90"
            >
              {maximized ? <Minimize2 size={13} strokeWidth={2.2} /> : <Maximize2 size={13} strokeWidth={2.2} />}
            </button>
          )}
        </>
      )}
      <button
        type="button"
        title={closeLabel}
        aria-label={closeLabel}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="group grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] text-[var(--text-secondary)] shadow-sm transition-all hover:bg-[var(--st-fill-strong)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90"
      >
        <X size={14} strokeWidth={2.2} className="transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
