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
    shapeOpacity,     setShapeOpacity,
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5" style={{ minWidth: 230 }}>

      {/* Shape grid */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Geometric primitive
        </span>
        <div className="grid grid-cols-5 gap-1">
          {SHAPES.map(({ id, icon: Icon, label }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                title={label}
                className="flex items-center justify-center p-2 rounded-lg transition-all border"
                style={{
                  background:   isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderColor:  isActive ? 'var(--border-color)' : 'transparent',
                  color:        isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Stroke style */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Stroke style
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
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Fill effect
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

      {/* Opacity */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
            Opacity
          </span>
          <span className="text-[11px] text-[var(--text-secondary)]">
            {shapeOpacity ?? 100}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={shapeOpacity ?? 100}
          onChange={(e) => setShapeOpacity(Number(e.target.value))}
          className="w-full"
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