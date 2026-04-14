import React from 'react';
import {
  Type,
  Terminal,
  Sigma,
  MessageSquare,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const MODES = [
  { id: 'standard', icon: Type,          label: 'Label',   desc: 'Clean'       },
  { id: 'code',     icon: Terminal,      label: 'Code',    desc: 'Monospace'    },
  { id: 'formula',  icon: Sigma,         label: 'Math',    desc: 'LaTeX'        },
];

const SIZES = [
  { id: 12, label: 'XS' },
  { id: 16, label: 'S'  },
  { id: 24, label: 'M'  },
  { id: 32, label: 'L'  },
  { id: 48, label: 'XL' },
];

const WEIGHTS = [
  { id: 'regular', label: 'Regular', style: 400 },
  { id: 'medium',  label: 'Medium',  style: 500 },
  { id: 'bold',    label: 'Bold',    style: 700 },
];

const ALIGNMENTS = [
  { id: 'left',   icon: AlignLeft   },
  { id: 'center', icon: AlignCenter },
  { id: 'right',  icon: AlignRight  },
];

const SegButton = ({ isActive, onClick, children, style: extraStyle }) => (
  <button
    onClick={onClick}
    className="flex-1 py-1.5 rounded-lg transition-all text-center"
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

const SegBar = ({ children }) => (
  <div
    className="flex gap-1 p-1 rounded-xl border"
    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
  >
    {children}
  </div>
);

const TextTool = (props) => {
  const {
    textType,   setTextType,
    textSize,   setTextSize,
    textWeight, setTextWeight,
    textAlign,  setTextAlign,
    textBgColor, setTextBgColor,
    addCanvasObjects, canvasTransform,
    setEditingObjectId
  } = useTutorStore();

  const handleAdd = (type) => {
    const id = `manual-${type}-${Date.now()}`;
    const { x: tx, y: ty, scale } = canvasTransform;
    
    // Calculate world center with a small scatter offset
    const scatter = (Math.random() * 40) - 20;
    const worldX = (window.innerWidth / 2 - tx + scatter) / scale / 800;
    const worldY = (window.innerHeight / 2 - ty + scatter) / scale / 600;

    const newObj = {
      id,
      type: type === 'formula' ? 'equation' : (type === 'code' ? 'code' : 'label'),
      x: worldX,
      y: worldY,
      w: type === 'code' ? 0.4 : 0.25,
      h: type === 'code' ? 0.3 : 0.15,
      content: '',
      label: '',
      styles: {
        fontSize: textSize || 20,
        fontWeight: textWeight || 'bold',
        textAlign: textAlign || 'center',
        backgroundColor: textBgColor || 'transparent',
        fontFamily: type === 'code' ? "'Geist Mono', monospace" : "'Inter', sans-serif"
      },
      color: useTutorStore.getState().drawColor || 'var(--text-primary)',
      animation: { type: 'drop', duration: 0.5 }
    };

    addCanvasObjects([newObj]);
    setTextType(type); // Update tool mode for icon consistency
    
    // Auto-open editor
    setTimeout(() => {
      setEditingObjectId(id);
    }, 100);
  };

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Instant Add Actions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Quick add to canvas
        </span>
        <div className="grid grid-cols-1 gap-1.5">
          {MODES.map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => handleAdd(id)}
              className="flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)] group overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="absolute inset-0 bg-blue-500/0 group-active:bg-blue-500/10 transition-colors" />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] transition-transform group-hover:scale-105 shadow-sm">
                <Icon size={16} className="text-blue-400" />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[11px] font-bold text-[var(--text-primary)]">Add {label}</span>
                <span className="text-[9px] text-[var(--text-tertiary)]">{desc}</span>
              </div>
              <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-blue-400">+</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Font scale */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Font scale
        </span>
        <SegBar>
          {SIZES.map(({ id, label }) => (
            <SegButton key={id} isActive={textSize === id} onClick={() => setTextSize(id)}>
              {label}
            </SegButton>
          ))}
        </SegBar>
      </div>

      {/* Font weight */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Text color & Highlight
        </span>
        <SegBar>
          {WEIGHTS.map(({ id, label, style: fw }) => (
            <SegButton
              key={id}
              isActive={(textWeight ?? 'regular') === id}
              onClick={() => setTextWeight(id)}
              style={{ fontWeight: fw }}
            >
              {label}
            </SegButton>
          ))}
        </SegBar>
      </div>
      {/* Text Appearance */}
      <div className="flex flex-col gap-2 px-1">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
          Text Appearance
        </span>
        <div className="grid grid-cols-2 gap-2">
           <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Text</span>
              <div className="flex gap-1">
                {['var(--text-primary)', '#6366f1', '#10b981', '#f43f5e'].map(c => (
                  <button 
                    key={c}
                    onClick={() => useTutorStore.getState().setDrawColor(c)}
                    className="w-3.5 h-3.5 rounded-full border border-white/5"
                    style={{ 
                      background: c,
                      boxShadow: useTutorStore.getState().drawColor === c ? '0 0 0 1.5px var(--bg-primary), 0 0 0 3px ' + c : 'none'
                    }}
                  />
                ))}
              </div>
           </div>
           <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Bg</span>
              <div className="flex gap-1">
                {['transparent', '#fef08a', '#bbf7d0', '#bfdbfe'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setTextBgColor(c)}
                    className="w-3.5 h-3.5 rounded border border-white/5"
                    style={{ 
                      background: c === 'transparent' ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 50% / 3px 3px' : c,
                      boxShadow: textBgColor === c ? '0 0 0 1.5px var(--bg-primary), 0 0 0 3px ' + (c === 'transparent' ? '#666' : c) : 'none'
                    }}
                  />
                ))}
              </div>
           </div>
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Alignment */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Alignment
        </span>
        <SegBar>
          {ALIGNMENTS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTextAlign(id)}
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all"
              style={{
                background:  (textAlign ?? 'left') === id ? 'var(--bg-primary)' : 'transparent',
                color:       (textAlign ?? 'left') === id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border:      (textAlign ?? 'left') === id ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow:   (textAlign ?? 'left') === id ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
              }}
            >
              <Icon size={13} />
            </button>
          ))}
        </SegBar>
      </div>

    </div>
  );

  const CurrentIcon = MODES.find((m) => m.id === textType)?.icon ?? Type;

  return (
    <ToolButtonBase
      {...props}
      id="text"
      icon={CurrentIcon}
      label="Text"
      shortcut="T"
      customSubmenu={Submenu}
    />
  );
};

export default TextTool;