import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Highlighter, Eraser, Zap, Circle } from 'lucide-react';
import ToolButtonBase from '../components/ToolButtonBase';
import useTutorStore from '../../../store/tutorStore';

const COLORS = [
  { id: 'primary', value: 'var(--text-primary)', label: 'Default' },
  { id: 'indigo',  value: '#6366f1', label: 'Indigo' },
  { id: 'emerald', value: '#10b981', label: 'Emerald' },
  { id: 'rose',    value: '#f43f5e', label: 'Rose' },
  { id: 'amber',   value: '#f59e0b', label: 'Amber' },
];

const WEIGHTS = [
  { id: 'thin',   value: 2,  label: 'Thin' },
  { id: 'medium', value: 5,  label: 'Medium' },
  { id: 'bold',   value: 12, label: 'Bold' },
];

const MODES = [
  { id: 'draw:pen',         icon: Pencil,      label: 'Pen' },
  { id: 'draw:highlighter', icon: Highlighter, label: 'Highlighter' },
  { id: 'draw:laser',       icon: Zap,         label: 'Laser Pointer' },
  { id: 'draw:eraser',      icon: Eraser,      label: 'Eraser' },
];

const DrawTool = (props) => {
  const { 
    activeTool, setActiveTool,
    drawColor, setDrawColor,
    drawWidth, setDrawWidth 
  } = useTutorStore();

  const isEraser = activeTool === 'draw:eraser';
  const isLaser  = activeTool === 'draw:laser';

  const Submenu = (
    <div className="flex flex-col gap-4 p-3 min-w-[180px]">
      {/* Mode Selector */}
      <div className="flex items-center justify-between gap-1">
        {MODES.map((mode) => {
          const isActive = activeTool === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveTool(mode.id)}
              className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all"
              style={{ 
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
              }}
            >
              <mode.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{mode.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {!isEraser && (
        <>
          <div className="h-px bg-[var(--border-color)] opacity-50" />
          
          {/* Color Palette */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Color</span>
            <div className="flex items-center gap-2 px-1">
              {COLORS.map((c) => {
                const isActive = drawColor === c.value;
                return (
                  <button
                    key={c.id}
                    onClick={() => setDrawColor(c.value)}
                    className="relative w-6 h-6 rounded-full transition-transform active:scale-90"
                    style={{ 
                      background: c.value.startsWith('var') ? 'var(--text-primary)' : c.value,
                      boxShadow: isActive ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c.value.startsWith('var') ? 'var(--text-primary)' : c.value}` : 'none',
                      transform: isActive ? 'scale(0.85)' : 'scale(1)'
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Stroke Width */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Stroke</span>
            <div className="flex items-center gap-2 px-1">
              {WEIGHTS.map((w) => {
                const isActive = drawWidth === w.value;
                return (
                  <button
                    key={w.id}
                    onClick={() => setDrawWidth(w.value)}
                    className="flex-1 flex items-center justify-center p-2 rounded-lg transition-all"
                    style={{ 
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    }}
                  >
                    <Circle 
                      size={Math.min(14, 4 + w.value/2)} 
                      fill="currentColor" 
                      stroke="none" 
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <ToolButtonBase 
      {...props}
      id="draw" 
      icon={MODES.find(m => m.id === activeTool)?.icon || Pencil} 
      label="Draw" 
      shortcut="D"
      customSubmenu={Submenu}
    />
  );
};

export default DrawTool;
