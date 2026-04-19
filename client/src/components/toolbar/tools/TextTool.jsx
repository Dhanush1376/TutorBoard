import React from 'react';
import {
  Heading1,
  Type,
  ALargeSmall,
  MessageSquare,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Plus,
  Pipette,
  RotateCcw,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from './ToolButtonBase';

const MODES = [
  { id: 'heading',  icon: Heading1,    label: 'Heading', desc: 'Title'    },
  { id: 'standard', icon: Type,        label: 'Body',    desc: 'General'  },
  { id: 'caption',  icon: ALargeSmall, label: 'Caption', desc: 'Note'     },
];

const SIZES = [
  { id: 12, label: '12' },
  { id: 16, label: '16' },
  { id: 24, label: '24' },
  { id: 32, label: '32' },
  { id: 48, label: '48' },
];

const WEIGHTS = [
  { id: 'regular', label: 'Regular', style: 400 },
  { id: 'medium',  label: 'Medium',  style: 500 },
  { id: 'bold',    label: 'Bold',    style: 700 },
];

const ALIGNMENTS = [
  { id: 'left',    icon: AlignLeft    },
  { id: 'center',  icon: AlignCenter  },
  { id: 'right',   icon: AlignRight   },
  { id: 'justify', icon: AlignJustify },
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
    textToolSize,setTextToolSize,
    textWeight, setTextWeight,
    textItalic, setTextItalic,
    textUnderline, setTextUnderline,
    textAlign,  setTextAlign,
    textBgColor, setTextBgColor,
    recentColors, addRecentColor,
    addCanvasObjects, canvasTransform,
    isSidebarOpen,
    selectedElementIds,
    setEditingObjectId
  } = useTutorStore();

  const handleAdd = (mode) => {
    const id = `manual-text-${Date.now()}`;
    const { canvasTransform, isSidebarOpen } = useTutorStore.getState();
    const { x: tx, y: ty, scale } = canvasTransform;
    
    // Style Mapping for Presets
    const presets = {
      heading:  { size: 32, weight: 700, opacity: 1, w: 0.4 },
      standard: { size: 24, weight: 400, opacity: 1, w: 0.3 },
      caption:  { size: 16, weight: 400, opacity: 0.7, w: 0.2 }
    };

    const preset = presets[mode] || presets.standard;
    const sidebarWidth = isSidebarOpen ? 340 : 0;
    
    // H3 FIX: Correct centerX = sidebarWidth + (remainingSpace / 2)
    const centerX = sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
    const centerY = window.innerHeight / 2;

    const scatter = (Math.random() - 0.5) * 40;
    const worldX = (centerX - tx + scatter) / scale / 800;
    const worldY = (centerY - ty + scatter) / scale / 600;

    const newObj = {
      id,
      type: 'label',
      x: worldX,
      y: worldY,
      w: preset.w,
      h: preset.size * 2.5 / 600, // Normalized height estimate
      content: '',
      label: '',
      styles: {
        fontSize: textToolSize || preset.size,
        fontWeight: textWeight === 'bold' ? 700 : (textWeight === 'medium' ? 500 : 400),
        fontStyle: textItalic ? 'italic' : 'normal',
        textDecoration: textUnderline ? 'underline' : 'none',
        textAlign: 'center',
        backgroundColor: 'transparent',
        fontFamily: "'Inter', sans-serif"
      },
      color: useTutorStore.getState().drawColor || 'var(--text-primary)',
      animation: { type: 'drop', duration: 0.5 }
    };

    addCanvasObjects([newObj]);
    setTextType(mode);
    setEditingObjectId(id);
  };

  const Submenu = (
    <div className="flex flex-col gap-3 p-3" style={{ minWidth: 225 }}>

      {/* Instant Add Actions */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 px-1">
          {MODES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleAdd(id)}
              className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all border border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)] group overflow-hidden relative"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {/* Plus Indicator on Hover */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-1 group-hover:translate-y-0 -translate-y-1">
                <Plus size={10} className="text-blue-400" strokeWidth={3} />
              </div>

              <div className="absolute inset-0 bg-blue-500/0 group-active:bg-blue-500/10 transition-colors" />
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] transition-transform group-hover:scale-105 shadow-sm">
                <Icon size={14} className="text-blue-400" />
              </div>
              <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-tight text-center">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Preview Area */}
      <div className="flex flex-col gap-2">
        <div 
          className="h-10 rounded-xl flex items-center justify-center border border-dashed transition-all"
          style={{ 
            background: 'var(--bg-secondary)', 
            borderColor: 'var(--border-color)',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          <span 
            className="transition-all truncate px-4"
            style={{ 
              fontSize: textToolSize || (textType === 'heading' ? 32 : (textType === 'caption' ? 16 : 24)), 
              fontWeight: textWeight === 'bold' ? 700 : (textWeight === 'medium' ? 500 : 400),
              fontStyle: textItalic ? 'italic' : 'normal',
              textDecoration: textUnderline ? 'underline' : 'none',
              color: useTutorStore.getState().drawColor || 'var(--text-primary)',
              textAlign: textAlign || 'center',
              opacity: textType === 'caption' ? 0.7 : 1
            }}
          >
            {textType === 'heading' ? 'Main Heading' : (textType === 'caption' ? 'Smaller Note...' : 'Body Text')}
          </span>
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-20 mx-1" />

      {/* Formatting Row - Always visible for a stable "medium" size */}
      <div className="flex items-center gap-1.5 px-0.5">
      
        {/* Font Size Dropdown - Unified Styling */}
        <SegBar>
          <div className="relative flex-none">
            <select 
              value={textToolSize}
              onChange={(e) => setTextToolSize(Number(e.target.value))}
              className="appearance-none h-6 bg-transparent text-[10px] font-bold text-[var(--text-primary)] px-2 rounded cursor-pointer outline-none pr-6"
            >
              {SIZES.map(s => <option key={s.id} value={s.id}>{s.id}px</option>)}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <svg width="7" height="5" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </SegBar>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 flex-none" />

        {/* Style Toggles */}
        <div className="flex gap-0.5 bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-color)] shadow-sm">
           {[ 
             { id: 'bold',      icon: Bold,      active: textWeight === 'bold', onClick: () => setTextWeight(textWeight === 'bold' ? 'regular' : 'bold') },
             { id: 'italic',    icon: Italic,    active: textItalic,            onClick: () => setTextItalic(!textItalic) },
             { id: 'underline', icon: Underline, active: textUnderline,         onClick: () => setTextUnderline(!textUnderline) }
           ].map(btn => (
             <button
               key={btn.id}
               onClick={btn.onClick}
               className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${btn.active ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/50'}`}
             >
               <btn.icon size={11} strokeWidth={btn.active ? 3 : 2} />
             </button>
           ))}
        </div>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 flex-none" />

        {/* Alignment */}
        <div className="flex gap-0.5 bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-color)] shadow-sm">
          {ALIGNMENTS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTextAlign(id)}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${textAlign === id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/50'}`}
            >
              <Icon size={11} />
            </button>
          ))}
        </div>
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