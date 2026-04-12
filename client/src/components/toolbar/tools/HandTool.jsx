import React, { useContext } from 'react';
import { 
  Hand, 
  MousePointer, 
  Maximize, 
  RotateCcw,
  Check,
  MousePointer2
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';
import { CanvasContext } from '../../canvas/InfiniteCanvas';

const MODES = [
  { id: 'select', icon: MousePointer2, label: 'Select Tool', shortcut: 'V' },
  { id: 'hand',   icon: Hand,          label: 'Pan Tool',    shortcut: 'H' },
];

const HandTool = (props) => {
  const { activeTool, setActiveTool, setSelectedElements } = useTutorStore();
  const { fitToContent, resetView } = useContext(CanvasContext);

  const isSelect = activeTool === 'select';

  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5 min-w-[190px]">
      {/* Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Tool Mode</span>
        <div className="flex flex-col gap-1">
          {MODES.map((mode) => {
            const isActive = activeTool === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveTool(mode.id)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg transition-all"
                style={{ 
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <mode.icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="text-[11px] font-medium">{mode.label}</span>
                </div>
                {isActive ? (
                  <Check size={12} className="text-[var(--text-primary)]" />
                ) : (
                  <span className="text-[9px] font-bold text-[var(--text-tertiary)] opacity-60">{mode.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Navigation Actions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Canvas View</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              fitToContent?.();
              props.onMouseLeave?.(); // Close menu
            }}
            className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <Maximize size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-[9px] font-bold uppercase tracking-tight text-[var(--text-tertiary)]">Fit All</span>
          </button>

          <button
            onClick={() => {
              resetView?.();
              props.onMouseLeave?.(); // Close menu
            }}
            className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <RotateCcw size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-[9px] font-bold uppercase tracking-tight text-[var(--text-tertiary)]">Reset</span>
          </button>
        </div>
      </div>

      {isSelect && (
        <>
          <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />
          <button
            onClick={() => {
              setSelectedElements([]);
              props.onMouseLeave?.();
            }}
            className="flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Deselect All</span>
          </button>
        </>
      )}
    </div>
  );

  const CurrentIcon = MODES.find(m => m.id === activeTool)?.icon || MousePointer2;

  return (
    <ToolButtonBase 
      {...props}
      id="hand" 
      icon={CurrentIcon} 
      label={isSelect ? "Select" : "Pan"} 
      shortcut={isSelect ? "V" : "H"} 
      customSubmenu={Submenu}
    />
  );
};

export default HandTool;
