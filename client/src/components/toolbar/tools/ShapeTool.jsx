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
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

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

const FILL_STYLES = [
  { id: 'none',   label: 'None'   },
  { id: 'subtle', label: 'Subtle' },
  { id: 'solid',  label: 'Solid'  },
];

const StrokePreview = ({ style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
    <div
      style={{
        flex: 1,
        height: 2,
        borderRadius: 1,
        borderTop:
          style === 'solid'
            ? '2px solid currentColor'
            : style === 'dashed'
            ? '2px dashed currentColor'
            : '2px dotted currentColor',
        background: 'transparent',
      }}
    />
  </div>
);

const ShapeTool = (props) => {
  const {
    activeTool, setActiveTool,
    shapeFill,        setShapeFill,
    shapeStrokeStyle, setShapeStrokeStyle,
    addCanvasObjects, canvasTransform,
    setSelectedElements, drawColor
  } = useTutorStore();

  const handleInstantAdd = (toolId) => {
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
      h: isLinear ? 0.001 : 0.15,
      color: drawColor || '#3b82f6',
      fill: shapeFill || 'none',
      strokeStyle: shapeStrokeStyle || 'solid',
      dashed: shapeStrokeStyle === 'dashed',
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
        <div className="grid grid-cols-5 gap-1">
          {SHAPES.map(({ id, icon: Icon, label }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => handleInstantAdd(id)}
                title={label}
                className="flex items-center justify-center p-2 rounded-lg transition-all border outline-none overflow-hidden relative group"
                style={{
                  background:   isActive ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.02)',
                  borderColor:  isActive ? 'var(--border-color)' : 'transparent',
                  color:        isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors" />
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} className="relative z-10 transition-transform group-hover:scale-110" />
              </button>
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
        <div
          className="flex gap-1 p-1 rounded-xl border"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          {STROKE_STYLES.map(({ id, label }) => {
            const isActive = shapeStrokeStyle === id;
            return (
              <button
                key={id}
                onClick={() => setShapeStrokeStyle(id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
                style={{
                  background:  isActive ? 'var(--bg-primary)' : 'transparent',
                  color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border:      isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                  boxShadow:   isActive ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
                }}
              >
                <StrokePreview style={id} />
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fill effect */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Fill appearance
        </span>
        <div className="flex gap-1.5">
          {FILL_STYLES.map(({ id, label }) => {
            const isActive = shapeFill === id;
            return (
              <button
                key={id}
                onClick={() => setShapeFill(id)}
                className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border"
                style={{
                  background:  isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                <div
                  className="w-full h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      id === 'none'
                        ? 'transparent'
                        : id === 'subtle'
                        ? 'rgba(128,128,255,.08)'
                        : 'var(--bg-secondary)',
                    border: id === 'none' ? '1.5px dashed var(--border-color)' : 'none',
                  }}
                >
                  {isActive && <Check size={11} />}
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
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