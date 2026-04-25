import React from 'react';
import {
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowUpRight,
  Diamond,
  Star,
  Hexagon,
  MessageSquare,
  Cloud,
  Check,
  Plus,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from './ToolButtonBase';
import ColorPicker from './ColorPicker';

const SHAPES = [
  { id: 'shape:rect',     icon: Square,        label: 'Rectangle' },
  { id: 'shape:ellipse',  icon: Circle,        label: 'Circle'    },
  { id: 'shape:triangle', icon: Triangle,      label: 'Triangle'  },
  { id: 'shape:line',     icon: Minus,         label: 'Line'      },
  { id: 'shape:arrow',    icon: ArrowUpRight,  label: 'Arrow'     },
  { id: 'shape:diamond',  icon: Diamond,       label: 'Diamond'   },
  { id: 'shape:star',     icon: Star,          label: 'Star'      },
  { id: 'shape:hexagon',  icon: Hexagon,       label: 'Hexagon'   },
  { id: 'shape:callout',  icon: MessageSquare, label: 'Callout'   },
  { id: 'shape:cloud',    icon: Cloud,         label: 'Cloud'     },
];

const STROKE_STYLES = [
  { id: 'solid',  label: 'Solid'  },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];



const SegButton = ({ isActive, onClick, children, style: extraStyle, className = "" }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all text-center ${className}`}
    style={{
      background:  isActive ? 'var(--bg-primary)' : 'transparent',
      color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
      border:      isActive ? '1px solid var(--border-color)' : '1px solid transparent',
      boxShadow:   isActive ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
      fontSize: 9,
      fontWeight: 400,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      minHeight: '40px',
      ...extraStyle,
    }}
  >
    {children}
  </button>
);

const SegBar = ({ children, className = "" }) => (
  <div
    className={`flex gap-1 p-1 rounded-xl border ${className}`}
    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
  >
    {children}
  </div>
);

const StrokePreview = ({ style }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '2px 0' }}>
    <div
      style={{
        width: '24px',
        height: '0px',
        borderTop:
          style === 'solid'
            ? '2.5px solid currentColor'
            : style === 'dashed'
            ? '2.5px dashed currentColor'
            : '2.5px dotted currentColor',
      }}
    />
  </div>
);

const ShapeTool = (props) => {
  const {
    activeTool, setActiveTool,
    shapeStrokeStyle, setShapeStrokeStyle,
    addCanvasObjects, canvasTransform,
    setSelectedElements, drawColor, setDrawColor,
    recentColors, addRecentColor
  } = useTutorStore();

  const handleAdd = (toolId) => {
    const shapeType = toolId.replace('shape:', '');
    const { canvasTransform, isSidebarOpen, addCanvasObjects, drawColor } = useTutorStore.getState();
    const { x: tx, y: ty, scale } = canvasTransform;

    const sidebarWidth = isSidebarOpen ? 340 : 0;
    const centerX = sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
    const centerY = window.innerHeight / 2;

    const scatter = (Math.random() - 0.5) * 40;
    const worldX = (centerX + scatter - tx) / scale / 800; 
    const worldY = (centerY + scatter - ty) / scale / 600;

    const id = `manual-shape-${Date.now()}`;
    const newObj = {
      id,
      type: shapeType,
      x: worldX,
      y: worldY,
      w: 0.15,
      h: 0.15,
      color: drawColor || 'var(--text-primary)',
      styles: {
        stroke: drawColor || 'var(--text-primary)',
        strokeWidth: 2,
        strokeStyle: shapeStrokeStyle || 'solid'
      },
      animation: { type: 'draw', duration: 0.5 }
    };

    addCanvasObjects([newObj]);
    setActiveTool(toolId);
  };

  const handleShapeClick = (toolId) => {
    if (activeTool === toolId) {
      handleAdd(toolId);
    } else {
      setActiveTool(toolId);
    }
  };

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Shape grid */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Geometric primitives
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {SHAPES.map(({ id, icon: Icon, label }) => {
            const isActive = activeTool === id;
            return (
              <div key={id} className="relative group">
                <button
                  onClick={() => handleShapeClick(id)}
                  title={label}
                  className="w-full flex items-center justify-center p-2 rounded-lg transition-all border outline-none overflow-hidden"
                  style={{
                    background:   isActive ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.02)',
                    borderColor:  isActive ? 'var(--border-color)' : 'transparent',
                    color:        isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="relative z-10 transition-transform group-hover:scale-110" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Stroke style */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Outline style
        </span>
        <SegBar>
          {STROKE_STYLES.map(({ id, label }) => {
            const isActive = shapeStrokeStyle === id;
            return (
              <SegButton
                key={id}
                isActive={isActive}
                onClick={() => setShapeStrokeStyle(id)}
                className="gap-0.5"
              >
                <StrokePreview style={id} />
                <span className="opacity-80" style={{ marginTop: '-2px' }}>{label}</span>
              </SegButton>
            );
          })}
        </SegBar>
      </div>


      {/* Shape Color — Uses shared ColorPicker for consistency */}
      <div className="flex flex-col gap-2">
        <ColorPicker
          label="Shape Color"
          color={drawColor}
          onChange={(c) => {
            setDrawColor(c);
            if (!c.startsWith('var')) addRecentColor(c);
          }}
          recentColors={recentColors || []}
          onClearRecent={() => addRecentColor?.('__clear__')}
          maxRecent={5}
        />
      </div>


    </div>
  );

  const CurrentIcon = SHAPES.find((s) => s.id === activeTool)?.icon ?? Square;

  return (
    <ToolButtonBase
      {...props}
      id="shape"
      icon={CurrentIcon}
      label="Shape"
      customSubmenu={Submenu}
    />
  );
};

export default ShapeTool;
