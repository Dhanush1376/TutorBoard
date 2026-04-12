import React from 'react';
import { motion } from 'framer-motion';
import { 
  Square, 
  Circle, 
  Triangle, 
  Minus, 
  ArrowUpRight,
  Check,
  Spline,
  Layers,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const SHAPES = [
  { id: 'shape:rect',     icon: Square,       label: 'Rectangle' },
  { id: 'shape:ellipse',  icon: Circle,       label: 'Circle' },
  { id: 'shape:triangle', icon: Triangle,     label: 'Triangle' },
  { id: 'shape:line',     icon: Minus,        label: 'Line' },
  { id: 'shape:arrow',    icon: ArrowUpRight, label: 'Arrow' },
];

const STROKE_STYLES = [
  { id: 'solid',  label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
];

const FILL_STYLES = [
  { id: 'none',   label: 'None',   icon: Spline },
  { id: 'subtle', label: 'Subtle', icon: Layers },
  { id: 'glass',  label: 'Glass',  icon: Layers },
];

const ShapeTool = (props) => {
  const { 
    activeTool, setActiveTool,
    shapeFill, setShapeFill,
    shapeStrokeStyle, setShapeStrokeStyle
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-5 p-3.5 min-w-[210px]">
      {/* Shape Selector Grid */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Geometric Primitive</span>
        <div className="grid grid-cols-5 gap-1">
          {SHAPES.map((shape) => {
            const isActive = activeTool === shape.id;
            return (
              <button
                key={shape.id}
                onClick={() => setActiveTool(shape.id)}
                className="flex items-center justify-center p-2 rounded-lg transition-all"
                style={{ 
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}
              >
                <shape.icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Stroke Style */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Stroke style</span>
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          {STROKE_STYLES.map((style) => {
            const isActive = shapeStrokeStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => setShapeStrokeStyle(style.id)}
                className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all"
                style={{ 
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                }}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fill Style */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Fill effect</span>
        <div className="flex gap-1.5">
          {FILL_STYLES.map((fill) => {
            const isActive = shapeFill === fill.id;
            return (
              <button
                key={fill.id}
                onClick={() => setShapeFill(fill.id)}
                className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border"
                style={{ 
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}
              >
                <div 
                  className="w-full h-8 rounded-lg mb-1 flex items-center justify-center" 
                  style={{ 
                    background: fill.id === 'none' ? 'transparent' : fill.id === 'subtle' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                    border: fill.id === 'none' ? '1.5px dashed var(--border-color)' : 'none',
                    backdropFilter: fill.id === 'glass' ? 'blur(4px)' : 'none'
                  }}
                >
                  {isActive && <Check size={12} />}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-tight">{fill.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const CurrentIcon = SHAPES.find(s => s.id === activeTool)?.icon || Square;

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
