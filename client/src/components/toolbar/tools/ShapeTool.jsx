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
    className={`flex-1 py-1.5 rounded-lg transition-all text-center ${className}`}
    style={{
      background:  isActive ? 'var(--bg-primary)' : 'transparent',
      color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
      border:      isActive ? '1px solid var(--border-color)' : '1px solid transparent',
      boxShadow:   isActive ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
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
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', width: 44 }}>
    <div
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        borderTop:
          style === 'solid'
            ? '4px solid currentColor'
            : style === 'dashed'
            ? '4px dashed currentColor'
            : '4px dotted currentColor',
        background: 'transparent',
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

  const handleShapeClick = (toolId) => {
    setActiveTool(toolId);
  };

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Shape grid */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
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
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
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
                className="flex-col gap-1"
              >
                <StrokePreview style={id} />
                <span className="opacity-80">{label}</span>
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