import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Highlighter, Eraser, Zap, Circle, Pipette, RotateCcw } from 'lucide-react';
import ToolButtonBase from '../components/ToolButtonBase';
import useTutorStore from '../../../store/tutorStore';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const WEIGHTS = [
  { id: 'hairline', value: 1,  label: 'Hair' },
  { id: 'thin',     value: 2,  label: 'Thin' },
  { id: 'medium',   value: 5,  label: 'Med' },
  { id: 'bold',     value: 10, label: 'Bold' },
  { id: 'thick',    value: 18, label: 'Thick' },
];

const MODES = [
  { id: 'draw:pen',         icon: Pencil,      label: 'Pen',     shortcut: 'P' },
  { id: 'draw:highlighter', icon: Highlighter, label: 'Marker',  shortcut: 'M' },
  { id: 'draw:laser',       icon: Zap,         label: 'Laser',   shortcut: 'L' },
  { id: 'draw:eraser',      icon: Eraser,      label: 'Eraser',  shortcut: 'E' },
];

const OPACITY_STEPS = [25, 50, 75, 100];

const MAX_RECENT = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a CSS-var color token to a hex so we can display it */
function resolveColor(value) {
  if (!value.startsWith('var')) return value;
  const preset = PRESET_COLORS.find((c) => c.value === value);
  return preset?.display ?? '#e5e5e5';
}

// ─── Component ────────────────────────────────────────────────────────────────

const DrawTool = (props) => {
  const {
    activeTool, setActiveTool,
    drawColor,    setDrawColor,
    drawWidth,    setDrawWidth,
    // Optional extras we add to the store (fall back gracefully)
    drawOpacity,  setDrawOpacity,
    recentColors, addRecentColor,
  } = useTutorStore();

  const lastActiveDrawMode = useRef('draw:pen');
  const colorInputRef = useRef(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const opacity   = drawOpacity  ?? 100;
  const recents   = recentColors ?? [];
  const isDrawing = activeTool.startsWith('draw:');
  const isEraser  = activeTool === 'draw:eraser';
  const isLaser   = activeTool === 'draw:laser';
  const hideColorControls = isEraser || isLaser;

  // ── Sync last draw mode ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTool.startsWith('draw:')) {
      lastActiveDrawMode.current = activeTool;
    }
  }, [activeTool]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (!isDrawing) return; // only active when draw tool is selected

      switch (e.key) {
        case '[': {
          // Decrease stroke width
          const idx = WEIGHTS.findIndex((w) => w.value === drawWidth);
          if (idx > 0) setDrawWidth(WEIGHTS[idx - 1].value);
          break;
        }
        case ']': {
          // Increase stroke width
          const idx = WEIGHTS.findIndex((w) => w.value === drawWidth);
          if (idx < WEIGHTS.length - 1) setDrawWidth(WEIGHTS[idx + 1].value);
          break;
        }
        default:
          break;
      }
    },
    [isDrawing, drawWidth, setDrawWidth]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMainClick = () => setActiveTool(lastActiveDrawMode.current);

  const handleColorPick = (value) => {
    setDrawColor(value);
    // Track recent colors (skip CSS vars and duplicates)
    if (!value.startsWith('var') && addRecentColor) {
      addRecentColor(value);
    }
  };

  const handleNativeColorChange = (e) => {
    handleColorPick(e.target.value);
  };

  // ── Preview pill ───────────────────────────────────────────────────────────
  const previewColor = resolveColor(drawColor);

  // ── Submenu ────────────────────────────────────────────────────────────────
  const Submenu = (
    <div className="flex flex-col gap-0 min-w-[210px]">
      {/* Mode Strip */}
      <div className="px-2 pt-3 pb-2">
        <span className="px-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
          Tool
        </span>
        <div className="flex items-center gap-1 mt-2">
          {MODES.map((mode) => {
            const isActive = activeTool === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveTool(mode.id)}
                title={`${mode.label} (${mode.shortcut})`}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
                  color:      isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border:     isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                }}
              >
                <mode.icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[8px] font-bold uppercase tracking-wider leading-none">
                  {mode.label}
                </span>
                <kbd
                  className="text-[7px] font-bold px-1 rounded"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    color:      isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                  }}
                >
                  {mode.shortcut}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 my-0.5" style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border-color), transparent)', opacity: 0.5 }} />

      {/* Color & Weight – hidden for eraser / laser */}
      <AnimatePresence>
        {!hideColorControls && (
          <motion.div
            key="color-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {/* Color */}
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                  Color
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
              <div className="flex items-center gap-1.5 flex-wrap">
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
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.4)' }}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Custom color picker trigger */}
                <button
                  title="Custom color"
                  onClick={() => colorInputRef.current?.click()}
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-150"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px dashed rgba(255,255,255,0.2)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
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

              {/* Recent colors */}
              {recents.length > 0 && (
                <div className="mt-2.5">
                  <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.12em] block mb-1.5">
                    Recent
                  </span>
                  <div className="flex items-center gap-1.5">
                    {recents.slice(0, MAX_RECENT).map((color, i) => (
                      <button
                        key={i}
                        title={color}
                        onClick={() => handleColorPick(color)}
                        className="w-[16px] h-[16px] rounded-full transition-all duration-150"
                        style={{
                          background: color,
                          boxShadow: drawColor === color ? `0 0 0 2px var(--bg-primary), 0 0 0 3px ${color}` : 'none',
                          opacity: drawColor === color ? 1 : 0.7,
                        }}
                      />
                    ))}
                    <button
                      title="Clear recent"
                      onClick={() => addRecentColor?.('__clear__')}
                      className="w-[16px] h-[16px] rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <RotateCcw size={8} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-3 my-1" style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border-color), transparent)', opacity: 0.5 }} />

            {/* Stroke Width */}
            <div className="px-3 pt-2.5 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                  Stroke
                </span>
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {drawWidth}px <span style={{ opacity: 0.5 }}>[ / ]</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                {WEIGHTS.map((w) => {
                  const isActive = drawWidth === w.value;
                  const dotSize  = Math.max(4, Math.min(16, 3 + w.value * 0.7));
                  return (
                    <button
                      key={w.id}
                      title={`${w.label} (${w.value}px)`}
                      onClick={() => setDrawWidth(w.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border:     isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                        color:      isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      <Circle
                        size={dotSize}
                        fill="currentColor"
                        stroke="none"
                      />
                      <span className="text-[8px] font-bold uppercase">{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-3 my-1" style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border-color), transparent)', opacity: 0.5 }} />

            {/* Opacity */}
            <div className="px-3 pt-2 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                  Opacity
                </span>
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {opacity}%
                </span>
              </div>

              {/* Segmented opacity picker */}
              <div className="flex gap-1">
                {OPACITY_STEPS.map((step) => {
                  const isActive = opacity === step;
                  return (
                    <button
                      key={step}
                      onClick={() => setDrawOpacity?.(step)}
                      className="flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border:     isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                        color:      isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        opacity:    step / 100,
                      }}
                    >
                      {step}%
                    </button>
                  );
                })}
              </div>

              {/* Fine slider */}
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={opacity}
                onChange={(e) => setDrawOpacity?.(Number(e.target.value))}
                className="w-full mt-2.5"
                style={{
                  accentColor: previewColor.startsWith('#') ? previewColor : 'var(--text-primary)',
                  height: '3px',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eraser / Laser size hint */}
      {hideColorControls && (
        <div className="px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
              {isLaser ? 'Laser Size' : 'Eraser Size'}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {drawWidth}px
            </span>
          </div>
          <div className="flex items-center gap-1">
            {WEIGHTS.map((w) => {
              const isActive = drawWidth === w.value;
              const dotSize  = Math.max(4, Math.min(18, 3 + w.value * 0.7));
              return (
                <button
                  key={w.id}
                  title={`${w.label} (${w.value}px)`}
                  onClick={() => setDrawWidth(w.value)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all duration-150"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border:     isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                    color:      isActive ? (isLaser ? '#f43f5e' : 'var(--text-primary)') : 'var(--text-tertiary)',
                  }}
                >
                  <Circle size={dotSize} fill="currentColor" stroke="none" />
                  <span className="text-[8px] font-bold uppercase">{w.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const currentModeIcon = MODES.find((m) => m.id === lastActiveDrawMode.current)?.icon ?? Pencil;

  return (
    <ToolButtonBase
      {...props}
      id="draw"
      icon={currentModeIcon}
      label="Draw"
      shortcut="P"
      onClick={handleMainClick}
      customSubmenu={Submenu}
    />
  );
};

export default DrawTool;