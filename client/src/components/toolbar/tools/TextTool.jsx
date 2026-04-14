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
  Pipette,
  RotateCcw,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const MODES = [
  { id: 'standard', icon: Type,          label: 'Label',   desc: 'Clean'       },
  { id: 'code',     icon: Terminal,      label: 'Code',    desc: 'Monospace'    },
  { id: 'formula',  icon: Sigma,         label: 'Math',    desc: 'LaTeX'        },
];

const SIZES = [
  { id: 12, label: 'XS (12px)' },
  { id: 16, label: 'S (16px)'  },
  { id: 24, label: 'M (24px)'  },
  { id: 32, label: 'L (32px)'  },
  { id: 48, label: 'XL (48px)' },
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
    recentColors, addRecentColor,
    addCanvasObjects, canvasTransform,
    isSidebarOpen,
    setEditingObjectId
  } = useTutorStore();

  const handleAdd = (type) => {
    const id = `manual-${type}-${Date.now()}`;
    const { x: tx, y: ty, scale } = canvasTransform;
    
    const sidebarWidth = isSidebarOpen ? 340 : 0;
    const centerX = (window.innerWidth + sidebarWidth) / 2;
    const centerY = window.innerHeight / 2;

    const scatter = (Math.random() - 0.5) * 40;
    const worldX = (centerX - tx + scatter) / scale / 800;
    const worldY = (centerY - ty + scatter) / scale / 600;

    const newObj = {
      id,
      type: type === 'formula' ? 'equation' : (type === 'code' ? 'code' : 'label'),
      x: worldX,
      y: worldY,
      w: type === 'code' ? 0.4 : (type === 'formula' ? 0.35 : 0.25),
      h: type === 'code' ? 0.3 : (type === 'formula' ? 0.18 : 0.15),
      content: '',
      label: '',
      styles: {
        fontSize: textSize || 20,
        fontWeight: WEIGHTS.find(w => w.id === textWeight)?.style || 700,
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
        <div className="grid grid-cols-1 gap-1">
          {MODES.map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => handleAdd(id)}
              className="flex items-center gap-2.5 p-2 rounded-xl transition-all border border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)] group overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="absolute inset-0 bg-blue-500/0 group-active:bg-blue-500/10 transition-colors" />
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] transition-transform group-hover:scale-105 shadow-sm">
                <Icon size={14} className="text-blue-400" />
              </div>
              <div className="flex flex-col text-left leading-tight py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-[var(--text-primary)]">Add {label}</span>
                  {id === 'formula' && (
                    <span className="text-[7px] font-bold bg-blue-500/10 text-blue-400 px-1 rounded uppercase tracking-tighter">KaTeX</span>
                  )}
                </div>
                <span className="text-[8.5px] text-[var(--text-tertiary)]">{desc}</span>
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
          Font weight
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
      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Alignment */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Alignment
        </span>
        <SegBar>
          {ALIGNMENTS.map(({ id, icon: Icon }) => (
            <SegButton
              key={id}
              isActive={(textAlign ?? 'left') === id}
              onClick={() => setTextAlign(id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon size={13} />
            </SegButton>
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
      onClick={() => {
        // H1 FIX: Only activate the tool — don't create elements from toolbar click.
        // Elements are created via submenu "Quick Add" buttons or via canvas click.
        useTutorStore.getState().setActiveTool('text');
      }}
      customSubmenu={Submenu}
    />
  );
};

export default TextTool;