import React, { useContext, useEffect, useCallback } from 'react';
import {
  Hand,
  MousePointer,
  Maximize,
  RotateCcw,
  Check,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Home,
  Crosshair,
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

const HandTool = (props) => {
  const { activeTool, setActiveTool, setSelectedElements } = useTutorStore();
  const { fitToContent, resetView, zoomIn, zoomOut, centerView } =
    useContext(CanvasContext) ?? {};

  const lastActiveHandMode = React.useRef('select');

  React.useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      lastActiveHandMode.current = activeTool;
    }
  }, [activeTool]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e) => {
      // Don't fire if user is typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      )
        return;

      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'f' || e.key === 'F') {
        fitToContent?.();
      } else if (e.key === 'r' || e.key === 'R') {
        resetView?.();
      } else if (e.key === 'Escape') {
        setSelectedElements?.([]);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '+') {
        e.preventDefault();
        zoomIn?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        resetView?.();
      }
    },
    [setActiveTool, fitToContent, resetView, zoomIn, zoomOut, setSelectedElements]
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
                {isActive ? (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Check size={9} />
                  </div>
                ) : (
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-tertiary)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {mode.shortcut}
                  </kbd>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="mx-3 my-1"
        style={{
          height: '1px',
          background:
            'linear-gradient(to right, transparent, var(--border-color), transparent)',
          opacity: 0.5,
        }}
      />

      {/* Canvas View Actions */}
      <div className="px-4 pt-3 pb-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
          Canvas View
        </span>
      </div>

      <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
        {[
          {
            icon: Maximize,
            label: 'Fit All',
            shortcut: 'F',
            action: () => {
              fitToContent?.();
              props.onMouseLeave?.();
            },
          },
          {
            icon: Home,
            label: 'Reset',
            shortcut: 'R',
            action: () => {
              resetView?.();
              props.onMouseLeave?.();
            },
          },
          {
            icon: ZoomIn,
            label: 'Zoom In',
            shortcut: '⌘+',
            action: () => zoomIn?.(),
          },
          {
            icon: ZoomOut,
            label: 'Zoom Out',
            shortcut: '⌘−',
            action: () => zoomOut?.(),
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-150 group"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <item.icon
              size={13}
              style={{ color: 'var(--text-tertiary)' }}
              className="group-hover:text-[var(--text-primary)] transition-colors"
            />
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span
                className="text-[10px] font-semibold truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item.label}
              </span>
              <span
                className="text-[8px]"
                style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
              >
                {item.shortcut}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Deselect All – only when select mode is active */}
      {isSelect && (
        <>
          <div
            className="mx-3 my-1"
            style={{
              height: '1px',
              background:
                'linear-gradient(to right, transparent, var(--border-color), transparent)',
              opacity: 0.5,
            }}
          />
          <div className="px-2 pb-3 pt-1">
            <button
              onClick={() => {
                setSelectedElements([]);
                props.onMouseLeave?.();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all duration-150"
              style={{
                border: '1px dashed rgba(255,255,255,0.12)',
                color: 'var(--text-tertiary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <Crosshair size={12} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Deselect All
              </span>
              <kbd
                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Esc
              </kbd>
            </button>
          </div>
        </>
      )}
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