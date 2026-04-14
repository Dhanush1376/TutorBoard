import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaintBucket, Pipette } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const PRESET_COLORS = [
  { id: 'default',  value: 'var(--text-primary)', display: '#e5e5e5', label: 'Default' },
  { id: 'indigo',   value: '#6366f1', label: 'Indigo' },
  { id: 'emerald',  value: '#10b981', label: 'Emerald' },
  { id: 'rose',     value: '#f43f5e', label: 'Rose' },
  { id: 'amber',    value: '#f59e0b', label: 'Amber' },
  { id: 'sky',      value: '#38bdf8', label: 'Sky' },
  { id: 'violet',   value: '#a78bfa', label: 'Violet' },
  { id: 'lime',     value: '#a3e635', label: 'Lime' },
];

function resolveColor(value) {
  if (!value.startsWith('var')) return value;
  const preset = PRESET_COLORS.find((c) => c.value === value);
  return preset?.display ?? '#e5e5e5';
}

const FillTool = (props) => {
  const { activeTool, setActiveTool, drawColor, setDrawColor } = useTutorStore();
  const colorInputRef = useRef(null);
  
  const handleMainClick = () => setActiveTool('fill');

  const handleColorPick = (value) => {
    setDrawColor(value);
  };

  const handleNativeColorChange = (e) => {
    handleColorPick(e.target.value);
  };

  const previewColor = resolveColor(drawColor);

  const Submenu = (
    <div className="flex flex-col gap-0 min-w-[210px]">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
            Fill Color
          </span>
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

        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          {PRESET_COLORS.map((c) => {
            const isActive = drawColor === c.value;
            const display  = c.display ?? c.value;
            return (
              <button
                key={c.id}
                title={c.label}
                onClick={() => handleColorPick(c.value)}
                className="relative rounded-full transition-all duration-150"
                style={{
                  width: isActive ? '22px' : '18px',
                  height: isActive ? '22px' : '18px',
                  background: display,
                  boxShadow: isActive
                    ? `0 0 0 2px var(--bg-primary), 0 0 0 3.5px ${display}, 0 0 10px ${display}88`
                    : 'none',
                  flexShrink: 0,
                }}
              >
                {isActive && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)' }} />
                  </span>
                )}
              </button>
            );
          })}

          <button
            title="Custom color"
            onClick={() => colorInputRef.current?.click()}
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px dashed rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <Pipette size={9} style={{ color: 'var(--text-tertiary)' }} />
            <input
              ref={colorInputRef}
              type="color"
              className="sr-only"
              value={previewColor.startsWith('#') ? previewColor : '#e5e5e5'}
              onChange={handleNativeColorChange}
            />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ToolButtonBase
      {...props}
      id="fill"
      icon={PaintBucket}
      label="Fill Color"
      shortcut="F"
      onClick={handleMainClick}
      customSubmenu={Submenu}
    />
  );
};

export default FillTool;
