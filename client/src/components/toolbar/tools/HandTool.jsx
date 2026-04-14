import React, { useContext, useEffect, useCallback } from 'react';
import {
  Hand,
  MousePointer2,
  Check,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';
import { CanvasContext } from '../../canvas/InfiniteCanvas';

const MODES = [
  {
    id: 'select',
    icon: MousePointer2,
    label: 'Select Tool',
    shortcut: 'V',
    description: 'Click and drag to select elements',
  },
  {
    id: 'hand',
    icon: Hand,
    label: 'Pan Tool',
    shortcut: 'H',
    description: 'Click and drag to pan the canvas',
  },
];

const HandTool = ({ closeMenu, ...props }) => {
  const { activeTool, setActiveTool, setSelectedElements } = useTutorStore();
  const { fitToContent, resetView, zoomIn, zoomOut } =
    useContext(CanvasContext) ?? {};

  const lastActiveHandMode = React.useRef('select');

  React.useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      lastActiveHandMode.current = activeTool;
    }
  }, [activeTool]);

  // Tools shortcuts (P, M, L, E) are handled in their respective components or Toolbar.
  // HandTool only handles mode switching.
  const handleKeyDown = useCallback(
    (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      )
        return;

      if (e.key.toLowerCase() === 'h') {
        setActiveTool('hand');
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      } else if (e.key === 'Escape') {
        setSelectedElements?.([]);
      }
    },
    [setActiveTool, setSelectedElements]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleMainClick = () => {
    setActiveTool(lastActiveHandMode.current);
  };

  const isGroupActive = activeTool === 'select' || activeTool === 'hand';
  const displayModeId = isGroupActive ? activeTool : lastActiveHandMode.current;
  const currentMode = MODES.find((m) => m.id === displayModeId) || MODES[0];
  const CurrentIcon = currentMode.icon;
  const isSelect = activeTool === 'select';

  const Submenu = (
    <div className="flex flex-col gap-0 min-w-[210px] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
          Tool Mode
        </span>
      </div>

      {/* Mode Selector */}
      <div className="px-2 flex flex-col gap-0.5 pb-2">
        {MODES.map((mode) => {
          const isActive = activeTool === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveTool(mode.id)}
              className="group flex items-center justify-between px-2.5 py-2.5 rounded-lg transition-all duration-150"
              style={{
                background: isActive
                  ? 'rgba(255,255,255,0.07)'
                  : 'transparent',
                color: isActive
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={{
                    background: isActive
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <mode.icon
                    size={14}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-semibold leading-tight">
                    {mode.label}
                  </span>
                  <span
                    className="text-[9px] leading-tight mt-0.5 transition-all"
                    style={{
                      color: isActive
                        ? 'var(--text-secondary)'
                        : 'var(--text-tertiary)',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    {mode.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isActive && (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Check size={9} />
                  </div>
                )}
                <kbd
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {mode.shortcut}
                </kbd>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );

  return (
    <ToolButtonBase
      {...props}
      id="hand"
      icon={CurrentIcon}
      label={currentMode.label.split(' ')[0]}
      shortcut={currentMode.shortcut}
      onClick={handleMainClick}
      customSubmenu={Submenu}
    />
  );
};

export default HandTool;