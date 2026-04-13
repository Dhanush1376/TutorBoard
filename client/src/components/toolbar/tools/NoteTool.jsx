import React from 'react';
import { StickyNote, Check } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const NOTE_COLORS = [
  { id: 'yellow',   bg: '#fef9c3', tape: '#facc15', label: 'Yellow'   },
  { id: 'lime',     bg: '#dcfce7', tape: '#4ade80', label: 'Lime'     },
  { id: 'sky',      bg: '#dbeafe', tape: '#60a5fa', label: 'Sky'      },
  { id: 'rose',     bg: '#fce7f3', tape: '#f472b6', label: 'Rose'     },
  { id: 'peach',    bg: '#ffedd5', tape: '#fb923c', label: 'Peach'    },
  { id: 'lavender', bg: '#ede9fe', tape: '#a78bfa', label: 'Lavender' },
  { id: 'mint',     bg: '#ccfbf1', tape: '#2dd4bf', label: 'Mint'     },
  { id: 'white',    bg: '#fffef9', tape: '#d1d5db', label: 'Paper'    },
];

const NOTE_SIZES = [
  { id: 'small',  label: 'Small',  w: 140, h: 140 },
  { id: 'medium', label: 'Medium', w: 180, h: 180 },
  { id: 'large',  label: 'Large',  w: 240, h: 240 },
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
  } = useTutorStore();

  const activeColorEntry = NOTE_COLORS.find((c) => c.bg === noteColor) ?? NOTE_COLORS[0];

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Color swatches */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Sticky Color
        </span>
        <div className="grid grid-cols-4 gap-2 px-1">
          {NOTE_COLORS.map(({ id, bg, tape, label }) => {
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
                  className="w-full aspect-square rounded-md shadow-sm border border-black/5 transition-transform"
                  style={{ 
                    background: bg,
                    transform: isActive ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
                    boxShadow: isActive ? `0 4px 12px rgba(0,0,0,0.1), 0 0 0 2px var(--bg-primary), 0 0 0 4px ${tape}` : 'none'
                  }}
                >
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

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Note size */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Note size
        </span>
        <div className="flex gap-2 h-20 items-end px-1">
          {NOTE_SIZES.map(({ id, label, w }) => {
            const isActive = noteSize === id;
            const sizeScale = id === 'small' ? 0.6 : id === 'medium' ? 0.8 : 1;
            return (
              <button
                key={id}
                onClick={() => setNoteSize(id)}
                className="flex-1 flex flex-col items-center gap-2 group transition-all"
                style={{ cursor: 'pointer' }}
              >
                <div 
                  className="w-full bg-black/5 rounded-t-lg transition-all"
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

      {/* Behavior toggle */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Behaviour
        </span>
        <SegBar>
          <SegButton isActive={!notePinned} onClick={() => setNotePinned(false)}>
            Draggable
          </SegButton>
          <SegButton isActive={!!notePinned} onClick={() => setNotePinned(true)}>
            Fixed
          </SegButton>
        </SegBar>
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