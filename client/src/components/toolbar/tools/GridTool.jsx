import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const GridPreview = ({ type, size, isActive }) => {
  const scaledSize = size / 2;
  const baseStyle = {
    opacity: isActive ? 0.6 : 0.2,
    transition: 'all 0.3s ease'
  };

  const dotsStyle = {
    ...baseStyle,
    backgroundImage: `radial-gradient(circle, var(--text-tertiary) 0.8px, transparent 0.8px),
                      radial-gradient(circle, var(--text-tertiary) 1.5px, transparent 1.5px)`,
    backgroundSize: `${scaledSize}px ${scaledSize}px, ${scaledSize * 5}px ${scaledSize * 5}px`
  };

  const linesStyle = {
    ...baseStyle,
    backgroundImage: `linear-gradient(to right, var(--border-color) 1px, transparent 1px),
                      linear-gradient(to bottom, var(--border-color) 1px, transparent 1px),
                      linear-gradient(to right, var(--text-tertiary) 1px, transparent 1px),
                      linear-gradient(to bottom, var(--text-tertiary) 1px, transparent 1px)`,
    backgroundSize: `${scaledSize}px ${scaledSize}px, ${scaledSize}px ${scaledSize}px, ${scaledSize * 5}px ${scaledSize * 5}px, ${scaledSize * 5}px ${scaledSize * 5}px`
  };

  return (
    <div 
      className="w-10 h-10 rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)]"
      style={type === 'dots' ? dotsStyle : linesStyle}
    />
  );
};

const GridTool = (props) => {
  const { 
    showGrid, toggleGrid,
    isSnapToGrid, toggleSnap,
    gridType, setGridType,
    gridSize, setGridSize
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-5 p-3.5 min-w-[220px]">
      {/* Primary Toggles + Preview */}
      <div className="flex flex-col gap-3">
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

        {/* Status indicator with Live Preview */}
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Live Preview</span>
            <span className="text-[10px] text-[var(--text-secondary)]">
              {gridType.charAt(0).toUpperCase() + gridType.slice(1)} • {gridSize}px
            </span>
          </div>
          <GridPreview type={gridType} size={gridSize} isActive={showGrid} />
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Grid Settings Section - Always visible but disabled if grid off */}
      <div 
        className="flex flex-col gap-5 transition-all duration-300"
        style={{ 
          opacity: showGrid ? 1 : 0.4,
          pointerEvents: showGrid ? 'auto' : 'none',
          filter: showGrid ? 'none' : 'grayscale(0.5)'
        }}
      >
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
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
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
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
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
      </div>
    </div>
  );

  return (
    <ToolButtonBase 
      {...props}
      id="grid" 
      icon={LayoutGrid} 
      label="Layout"
      shortcut="G"
      customSubmenu={Submenu}
    />
  );
};

export default GridTool;
