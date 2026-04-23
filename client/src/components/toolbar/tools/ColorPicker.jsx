import React, { useRef } from 'react';
import { Pipette, RotateCcw } from 'lucide-react';

export const PRESET_COLORS = [
  { id: 'default',  value: 'var(--text-primary)', display: '#71717a', label: 'Default' },
  { id: 'black',    value: '#000000', label: 'Black' },
  { id: 'white',    value: '#ffffff', label: 'White' },
  { id: 'indigo',   value: '#6366f1', label: 'Indigo' },
  { id: 'emerald',  value: '#10b981', label: 'Emerald' },
  { id: 'rose',     value: '#f43f5e', label: 'Rose' },
  { id: 'amber',    value: '#f59e0b', label: 'Amber' },
  { id: 'sky',      value: '#38bdf8', label: 'Sky' },
  { id: 'violet',   value: '#a78bfa', label: 'Violet' },
  { id: 'lime',     value: '#a3e635', label: 'Lime' },
];

export function resolveColor(value) {
  if (!value) return '#71717a';
  if (!value.startsWith('var')) return value;
  // If it's the theme-aware default, we ideally return the computed color, 
  // but for a static resolver, we return a mid-gray that contrasts with both.
  if (value === 'var(--text-primary)') return '#71717a'; 
  const preset = PRESET_COLORS.find((c) => c.value === value);
  return preset?.display ?? value;
}

const ColorPicker = ({ 
  color, 
  onChange, 
  label, 
  recentColors = [], 
  onClearRecent,
  maxRecent = 5
}) => {
  const colorInputRef = useRef(null);
  const previewColor = resolveColor(color);

  const handleNativeColorChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="px-3 pt-3 pb-1">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
          {label || 'Color'}
        </span>
        {/* Live preview swatch */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full border-2"
            style={{
              background: previewColor,
              borderColor: 'rgba(255,255,255,0.12)',
              boxShadow: `0 0 8px ${previewColor}55`,
            }}
          />
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {previewColor.startsWith('#') ? previewColor.toUpperCase() : 'CSS'}
          </span>
        </div>
      </div>

      {/* Preset swatches */}
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map((c) => {
          const isActive = color === c.value;
          const display  = c.display ?? c.value;
          return (
            <button
              key={c.id}
              title={c.label}
              onClick={() => onChange(c.value)}
              className="relative grow aspect-square rounded-lg transition-all duration-150 group"
              style={{
                background: display,
                boxShadow: isActive
                  ? `0 0 0 2px var(--bg-primary), 0 0 0 3.5px ${display}, 0 0 12px ${display}AA`
                  : '0 2px 4px rgba(0,0,0,0.15)',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm" />
                </div>
              )}
            </button>
          );
        })}

        {/* Custom color picker */}
        <button
          title="Custom color picker"
          onClick={() => colorInputRef.current?.click()}
          className="col-span-2 flex items-center justify-center gap-2 px-3 rounded-lg transition-all duration-150 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)]"
        >
          <div 
            className="w-3.5 h-3.5 rounded-sm border border-white/20" 
            style={{ background: previewColor.startsWith('#') ? previewColor : '#fff' }} 
          />
          <span className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-secondary)]">
            Custom
          </span>
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            value={previewColor.startsWith('#') ? previewColor : '#e5e5e5'}
            onChange={handleNativeColorChange}
          />
        </button>
      </div>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="mt-2.5">
          <span className="text-[9px] font-normal text-[var(--text-tertiary)] uppercase tracking-[0.12em] block mb-1.5">
            Recent
          </span>
          <div className="flex items-center gap-1.5">
            {recentColors.slice(0, maxRecent).map((c, i) => (
              <button
                key={i}
                title={c}
                onClick={() => onChange(c)}
                className="w-[16px] h-[16px] rounded-full transition-all duration-150"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--bg-primary), 0 0 0 3px ${c}` : 'none',
                  opacity: color === c ? 1 : 0.7,
                }}
              />
            ))}
            <button
              title="Clear recent"
              onClick={onClearRecent}
              className="w-[16px] h-[16px] rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <RotateCcw size={8} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
