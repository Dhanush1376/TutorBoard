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
import ToolButtonBase from '../components/ToolButtonBase';
import ColorPicker from '../components/ColorPicker';

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

  const handleInstantAdd = (e, toolId) => {
    e.stopPropagation();
    setActiveTool(toolId);
    
    // Parse shape type from 'shape:rect' -> 'rect'
    const type = toolId.split(':')[1];
    const id = `stamped-${type}-${Date.now()}`;
    const { x: tx, y: ty, scale } = canvasTransform;
    
    // Calculate world center
    const scatter = (Math.random() * 20) - 10;
    const worldX = (window.innerWidth / 2 - tx + scatter) / scale / 800;
    const worldY = (window.innerHeight / 2 - ty + scatter) / scale / 600;

    const isLinear = type === 'line' || type === 'arrow';

    const newObj = {
      id,
      type,
      x: worldX,
      y: worldY,
      w: isLinear ? 0.2 : 0.15,
      h: isLinear ? 0.02 : 0.15,
      color: drawColor || '#3b82f6',
      fill: 'none',
      strokeStyle: shapeStrokeStyle || 'solid',
      dashed: shapeStrokeStyle !== 'solid',
      animation: { type: 'bounce', duration: 0.4 }
    };

    // For linear shapes, we need endpoints
    if (isLinear) {
      newObj.x1 = worldX - 0.1;
      newObj.y1 = worldY;
      newObj.x2 = worldX + 0.1;
      newObj.y2 = worldY;
    }

    addCanvasObjects([newObj]);
    
    // Auto-select for immediate manipulation
    setTimeout(() => {
      setSelectedElements([id]);
    }, 50);
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
                  onClick={() => setActiveTool(id)}
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
                
                {/* Instant Add / Stamp badge */}
                <button 
                   onClick={(e) => handleInstantAdd(e, id)}
                   className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg border border-white/20"
                   title="Quick Stamp at center"
                >
                   <Plus size={10} strokeWidth={3} />
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
      shortcut="R"
      customSubmenu={Submenu}
    />
  );
};

export default ShapeTool;