import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutGrid, 
  TableProperties, 
  Grid3X3, 
  MousePointer2, 
  Check,
  Maximize2,
  Minimize2,
  Square
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const GRID_TYPES = [
  { id: 'dots',  icon: TableProperties, label: 'Dots' },
  { id: 'lines', icon: Grid3X3,        label: 'Lines' },
];

const SIZES = [
  { id: 20, label: 'Small',  icon: Minimize2 },
  { id: 40, label: 'Medium', icon: Square },
  { id: 80, label: 'Large',  icon: Maximize2 },
];

const THEMES = [
  { id: 'dark',      color: '#121212', label: 'Classic' },
  { id: 'midnight',  color: '#09090b', label: 'Midnight' },
  { id: 'blueprint', color: '#0f172a', label: 'Blueprint' },
];

const GridTool = (props) => {
  const { 
    showGrid, toggleGrid,
    isSnapToGrid, toggleSnap,
    gridType, setGridType,
    gridSize, setGridSize,
    canvasTheme, setCanvasTheme
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-5 p-3.5 min-w-[200px]">
      {/* Primary Toggles */}
      <div className="flex gap-2">
        <button
          onClick={toggleGrid}
          className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all"
          style={{ 
            background: showGrid ? 'rgba(255,255,255,0.06)' : 'transparent',
            borderColor: showGrid ? 'var(--text-primary)' : 'var(--border-color)',
            color: showGrid ? 'var(--text-primary)' : 'var(--text-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} />
            <span className="text-[11px] font-bold uppercase tracking-wide">Grid</span>
          </div>
          {showGrid && <Check size={12} />}
        </button>

        <button
          onClick={toggleSnap}
          className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all"
          style={{ 
            background: isSnapToGrid ? 'rgba(255,255,255,0.06)' : 'transparent',
            borderColor: isSnapToGrid ? 'var(--text-primary)' : 'var(--border-color)',
            color: isSnapToGrid ? 'var(--text-primary)' : 'var(--text-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <MousePointer2 size={15} />
            <span className="text-[11px] font-bold uppercase tracking-wide">Snap</span>
          </div>
          {isSnapToGrid && <Check size={12} />}
        </button>
      </div>

      {showGrid && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

          {/* Grid Style */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Style</span>
            <div className="flex gap-1">
              {GRID_TYPES.map(type => {
                const isActive = gridType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setGridType(type.id)}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all"
                    style={{ 
                      background: isActive ? 'var(--bg-secondary)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    }}
                  >
                    <type.icon size={14} />
                    <span className="text-[11px] font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Size */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Size</span>
            <div className="flex gap-1">
              {SIZES.map(s => {
                const isActive = gridSize === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setGridSize(s.id)}
                    className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all"
                    style={{ 
                      background: isActive ? 'var(--bg-secondary)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    }}
                  >
                    <s.icon size={14} />
                    <span className="text-[9px] font-bold">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Themes */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Theme</span>
          <span className="text-[9px] font-medium text-[var(--text-secondary)]">{THEMES.find(t => t.id === canvasTheme)?.label}</span>
        </div>
        <div className="flex items-center gap-3 px-1.5 pb-1">
          {THEMES.map(theme => {
            const isActive = canvasTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setCanvasTheme(theme.id)}
                className="relative w-8 h-8 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{ 
                  background: theme.color,
                  border: '1.5px solid var(--border-color)',
                  boxShadow: isActive ? `0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-primary)` : 'none'
                }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={14} color="white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <ToolButtonBase 
      {...props}
      id="grid" 
      icon={LayoutGrid} 
      label="Layout"
      customSubmenu={Submenu}
    />
  );
};

export default GridTool;
