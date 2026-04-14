import React from 'react';
import { StickyNote, Check } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const NOTE_COLORS = [
  { id: 'yellow',   bg: '#fef9c3', tape: '#facc15', ruled: '#fde047', dark: '#854d0e', label: 'Yellow'   },
  { id: 'lime',     bg: '#dcfce7', tape: '#4ade80', ruled: '#86efac', dark: '#166534', label: 'Lime'     },
  { id: 'sky',      bg: '#dbeafe', tape: '#60a5fa', ruled: '#93c5fd', dark: '#1e40af', label: 'Sky'      },
  { id: 'rose',     bg: '#fce7f3', tape: '#f472b6', ruled: '#f9a8d4', dark: '#9d174d', label: 'Rose'     },
  { id: 'peach',    bg: '#ffedd5', tape: '#fb923c', ruled: '#fdba74', dark: '#9a3412', label: 'Peach'    },
  { id: 'lavender', bg: '#ede9fe', tape: '#a78bfa', ruled: '#c4b5fd', dark: '#5b21b6', label: 'Lavender' },
  { id: 'mint',     bg: '#ccfbf1', tape: '#2dd4bf', ruled: '#5eead4', dark: '#115e59', label: 'Mint'     },
  { id: 'white',    bg: '#fffef9', tape: '#d1d5db', ruled: '#e5e7eb', dark: '#374151', label: 'Paper'    },
];

const NOTE_SIZES = [
  { id: 'xs', label: 'XS', w: 120, h: 120 },
  { id: 's',  label: 'S',  w: 160, h: 160 },
  { id: 'm',  label: 'M',  w: 200, h: 200 },
  { id: 'l',  label: 'L',  w: 260, h: 260 },
  { id: 'xl', label: 'XL', w: 340, h: 340 },
];

const SegBar = ({ children }) => (
  <div
    className="flex gap-1 p-1 rounded-xl border"
    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
  >
    {children}
  </div>
);

const SegButton = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className="flex-1 py-1.5 rounded-lg transition-all"
    style={{
      background:  isActive ? 'var(--bg-primary)' : 'transparent',
      color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
      border:      isActive ? '1px solid var(--border-color)' : '1px solid transparent',
      boxShadow:   isActive ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
    }}
  >
    {children}
  </button>
);

const NoteTool = (props) => {
  const {
    noteColor,  setNoteColor,
    noteSize,   setNoteSize,
    notePinned, setNotePinned,
    canvasTransform, addNoteToCanvas,
    showNotes, setShowNotes
  } = useTutorStore();

  const handleAddNote = () => {
    const { x, y, scale } = canvasTransform;
    
    // Calculate center of current viewport (window), adding a random scatter effect
    const offsetX = (Math.random() * 60) - 30; 
    const offsetY = (Math.random() * 60) - 30;
    
    // Center is (windowWidth/2) on screen. Convert to world:
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const worldX = (centerX - x + offsetX) / scale;
    const worldY = (centerY - y + offsetY) / scale;

    addNoteToCanvas(worldX, worldY);
  };

  const activeColorEntry = NOTE_COLORS.find((c) => c.bg === noteColor) ?? NOTE_COLORS[0];

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Color swatches */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Sticky Color
        </span>
        <div className="grid grid-cols-4 gap-2 px-1">
          {NOTE_COLORS.map(({ id, bg, tape, ruled, label }) => {
            const isActive = noteColor === bg;
            return (
              <button
                key={id}
                title={label}
                onClick={() => setNoteColor(bg)}
                className="relative flex flex-col items-center gap-1 transition-all group"
                style={{ cursor: 'pointer' }}
              >
                <div 
                  className="w-full aspect-square rounded-md shadow-sm border border-black/5 transition-transform overflow-hidden relative"
                  style={{ 
                    background: bg,
                    transform: isActive ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
                    boxShadow: isActive ? `0 4px 12px rgba(0,0,0,0.1), 0 0 0 2px var(--bg-primary), 0 0 0 4px ${tape}` : 'none'
                  }}
                >
                  {/* Ruled lines preview */}
                  <div className="absolute inset-0 flex flex-col gap-[20%] p-[15%] opacity-40">
                    <div className="h-px w-full" style={{ background: ruled }} />
                    <div className="h-px w-full" style={{ background: ruled }} />
                    <div className="h-px w-full" style={{ background: ruled }} />
                  </div>

                  <div 
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[20%] rounded-b-sm opacity-60"
                    style={{ background: tape }}
                  />
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={14} className="text-black/30" strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Note size
        </span>
        <div className="flex gap-2 h-11 items-end px-1">
          {NOTE_SIZES.map(({ id, label, w }) => {
            const isActive = noteSize === id;
            // Scale based on size index
            const sizeIndex = NOTE_SIZES.findIndex(s => s.id === id);
            const sizeScale = 0.5 + (sizeIndex * 0.125); 

            return (
              <button
                key={id}
                onClick={() => setNoteSize(id)}
                className="flex-1 flex flex-col items-center gap-2 group transition-all"
                style={{ cursor: 'pointer' }}
              >
                <div 
                  className="w-full bg-black/5 rounded-t-sm transition-all"
                  style={{ 
                    height: `${sizeScale * 100}%`,
                    background: isActive ? activeColorEntry.bg : 'var(--bg-tertiary)',
                    opacity: isActive ? 1 : 0.4,
                    border: isActive ? `1px solid ${activeColorEntry.tape}` : '1px solid transparent',
                    boxShadow: isActive ? '0 -4px 12px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                   <div 
                    className="w-1/3 h-[15%] mx-auto rounded-b-[1px]"
                    style={{ background: activeColorEntry.tape, opacity: isActive ? 0.5 : 0 }}
                  />
                </div>
                <span className={`text-[9px] font-bold uppercase transition-colors ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Add Note Action */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleAddNote}
          className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] group relative overflow-hidden"
          style={{ 
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            boxShadow: '0 8px 16px -4px rgba(0,0,0,0.2)'
          }}
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-[14px] font-medium leading-none mt-[-2px]">+</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Add Note</span>
        </button>

        <button
          onClick={() => setShowNotes(!showNotes)}
          className="px-4 rounded-xl flex items-center justify-center transition-all bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] text-[var(--text-primary)]"
          title={showNotes ? "Hide All Notes" : "Show All Notes"}
        >
          <span className="text-[12px]">{showNotes ? "🙈" : "👁️"}</span>
        </button>
      </div>

    </div>
  );

  return (
    <ToolButtonBase
      {...props}
      id="note"
      icon={StickyNote}
      label="Sticky Note"
      shortcut="N"
      customSubmenu={Submenu}
    />
  );
};

export default NoteTool;