import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Highlighter, Eraser, Zap, Circle, RotateCcw } from 'lucide-react';
import ToolButtonBase from '../components/ToolButtonBase';
import useTutorStore from '../../../store/tutorStore';
import ColorPicker, { resolveColor } from '../components/ColorPicker';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const MAX_RECENT = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

const DrawTool = (props) => {
  const {
    activeTool, setActiveTool,
    drawColor,    setDrawColor,
    drawWidth,    setDrawWidth,
    laserWidth,   setLaserWidth,
    recentColors, addRecentColor,
  } = useTutorStore();

  const lastActiveDrawMode = useRef('draw:pen');
  const colorInputRef = useRef(null);

  // ── Derived state ──────────────────────────────────────────────────────────
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
          const val = isLaser ? laserWidth : drawWidth;
          const setter = isLaser ? setLaserWidth : setDrawWidth;
          const idx = WEIGHTS.findIndex((w) => w.value === val);
          if (idx > 0) setter(WEIGHTS[idx - 1].value);
          break;
        }
        case ']': {
          const val = isLaser ? laserWidth : drawWidth;
          const setter = isLaser ? setLaserWidth : setDrawWidth;
          const idx = WEIGHTS.findIndex((w) => w.value === val);
          if (idx < WEIGHTS.length - 1) setter(WEIGHTS[idx + 1].value);
          break;
        }
        default:
          break;
      }
    },
    [isDrawing, drawWidth, laserWidth, isLaser, setDrawWidth, setLaserWidth, setActiveTool]
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
    if (!value.startsWith('var')) {
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
    <div className="flex flex-col gap-0 min-w-[240px]">
      {/* ─── Real-time Stroke Status ─── */}
      <div className="px-4 py-3 bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
            Live Preview
          </span>
          {!isEraser && (
             <span className="text-[9px] font-mono text-[var(--text-secondary)]">
               {isLaser ? laserWidth : drawWidth}px • {previewColor.toUpperCase()}
             </span>
          )}
        </div>
        
        <div 
          className="h-10 w-full rounded-lg flex items-center justify-center relative overflow-hidden"
          style={{ 
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          {/* Subtle Grid Pattern in background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, var(--text-primary) 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
          
          <svg width="100%" height="100%" className="relative z-10 overflow-visible">
            {!isEraser ? (
               <motion.path
                 d="M 40 20 Q 80 5 120 20 T 200 20"
                 fill="none"
                 stroke={previewColor}
                 strokeWidth={isLaser ? laserWidth : drawWidth}
                 strokeLinecap="round"
                 initial={false}
                 animate={{ 
                    stroke: previewColor, 
                    strokeWidth: isLaser ? laserWidth : drawWidth 
                 }}
                 transition={{ type: 'spring', stiffness: 300, damping: 30 }}
               />
            ) : (
              <Eraser size={20} className="text-[var(--text-tertiary)] opacity-40" />
            )}
          </svg>
        </div>
      </div>

      {/* Mode Strip */}
      <div className="px-2 pt-3 pb-2">
        <div className="flex items-center gap-1">
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
            <ColorPicker
              label="Stroke Color"
              color={drawColor}
              onChange={handleColorPick}
              recentColors={recents}
              onClearRecent={() => addRecentColor?.('__clear__')}
              maxRecent={MAX_RECENT}
            />

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
                  return (
                    <button
                      key={w.id}
                      title={`${w.label} (${w.value}px)`}
                      onClick={() => setDrawWidth(w.value)}
                      className="flex-1 flex flex-col items-center gap-2 py-2.5 rounded-xl transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border:     isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                        color:      isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      <div className="h-6 flex items-center justify-center w-full">
                         <div 
                           className="w-full mx-2 rounded-full transition-all" 
                           style={{ 
                             height: w.value, 
                             background: 'currentColor',
                             boxShadow: isActive ? `0 0 8px currentColor` : 'none',
                             opacity: isActive ? 1 : 0.4
                           }} 
                         />
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider">{w.label}</span>
                    </button>
                  );
                })}
              </div>
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
              {isLaser ? laserWidth : drawWidth}px
            </span>
          </div>
          <div className="flex items-center gap-1">
            {WEIGHTS.map((w) => {
              const val = isLaser ? laserWidth : drawWidth;
              const isActive = val === w.value;
              const setter = isLaser ? setLaserWidth : setDrawWidth;
              return (
                <button
                  key={w.id}
                  title={`${w.label} (${w.value}px)`}
                  onClick={() => setter(w.value)}
                  className="flex-1 flex flex-col items-center gap-2 py-2.5 rounded-xl transition-all duration-150"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border:     isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                    color:      isActive ? (isLaser ? '#f43f5e' : 'var(--text-primary)') : 'var(--text-tertiary)',
                  }}
                >
                  <div className="h-6 flex items-center justify-center w-full">
                     <div 
                       className="w-full mx-2 rounded-full transition-all" 
                       style={{ 
                         height: w.value, 
                         background: 'currentColor',
                         boxShadow: isActive && isLaser ? `0 0 10px #f43f5e` : (isActive ? '0 0 8px currentColor' : 'none'),
                         opacity: isActive ? 1 : 0.4
                       }} 
                     />
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-wider">{w.label}</span>
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