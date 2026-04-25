import React from 'react';
import { StickyNote, Check, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from './ToolButtonBase';

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
      fontWeight: 400,
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
    noteToolSize, setNoteToolSize, // Use isolated note size
    isSidebarOpen,
    canvasTransform, addNoteToCanvas,
    showNotes, setShowNotes,
    setActiveTool
  } = useTutorStore();

  const handleAddNote = () => {
    const { x, y, scale } = canvasTransform;
    
    // Calculate center of current viewport (window), adding a random scatter effect
    const offsetX = (Math.random() * 60) - 30; 
    const offsetY = (Math.random() * 60) - 30;
    
    const sidebarWidth = isSidebarOpen ? 340 : 0;
    const canvasWidthPx = window.innerWidth - sidebarWidth;
    const canvasHeightPx = window.innerHeight;

    // Normalize screen center to 0-1 virtual space
    // Adding a small scatter offset (in pixels) then dividing by virtual dimensions
    const worldX = 0.5 + (offsetX / 800);
    const worldY = 0.5 + (offsetY / 600);

    addNoteToCanvas(worldX, worldY);
    setActiveTool('select');
  };

  const activeColorEntry = NOTE_COLORS.find((c) => c.bg === noteColor) ?? NOTE_COLORS[0];

  const Submenu = (
    <div className="flex flex-col gap-4 p-4" style={{ minWidth: 240 }}>

      {/* Color swatches */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Sticky Color
        </span>
        <div className="grid grid-cols-4 gap-x-2 gap-y-3 px-1">
          {NOTE_COLORS.map(({ id, bg, tape, ruled, label }) => {
            const isActive = noteColor === bg;
            return (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <button
                  title={label}
                  onClick={() => setNoteColor(bg)}
                  className="relative w-full aspect-square outline-none group"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                >
                  <motion.div 
                    animate={{
                      scale: isActive ? 1.08 : 1,
                      y: isActive ? -3 : 0,
                    }}
                    whileHover={{ scale: isActive ? 1.1 : 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="absolute inset-0 rounded-lg border border-black/5 overflow-hidden transition-shadow"
                    style={{ 
                      background: bg,
                      boxShadow: isActive 
                        ? `0 8px 20px rgba(0,0,0,0.12), 0 0 0 2px var(--bg-primary), 0 0 0 4px ${tape}` 
                        : '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Ruled lines preview */}
                    <div className="absolute inset-0 flex flex-col gap-[20%] p-[15%] opacity-30">
                      <div className="h-px w-full" style={{ background: ruled }} />
                      <div className="h-px w-full" style={{ background: ruled }} />
                      <div className="h-px w-full" style={{ background: ruled }} />
                    </div>

                    <div 
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[20%] rounded-b-sm opacity-60"
                      style={{ background: tape }}
                    />
                    
                    <AnimatePresence>
                      {isActive && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute inset-0 flex items-center justify-center bg-white/10"
                        >
                          <div className="bg-white/90 rounded-full p-1 shadow-sm">
                            <Check size={10} className="text-black" strokeWidth={4} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </button>
                <span className={`text-[8px] font-normal uppercase tracking-tight truncate w-full text-center transition-colors ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Note size
        </span>
        <div className="flex gap-2 h-14 items-center px-1">
          {NOTE_SIZES.map(({ id, label }) => {
            const isActive = noteSize === id;
            const sizeIndex = NOTE_SIZES.findIndex(s => s.id === id);
            // Proportional scale for both dimensions
            const baseSize = 32;
            const sizeScale = 0.6 + (sizeIndex * 0.15); 

            return (
              <button
                key={id}
                onClick={() => setNoteSize(id)}
                className="flex-1 flex flex-col items-center gap-2 group transition-all"
                style={{ cursor: 'pointer' }}
              >
                <div className="h-10 w-full flex items-center justify-center">
                  <div 
                    className="bg-black/5 rounded-sm transition-all relative overflow-hidden"
                    style={{ 
                      width: `${sizeScale * baseSize}px`,
                      height: `${sizeScale * baseSize}px`,
                      background: isActive ? activeColorEntry.bg : 'var(--bg-tertiary)',
                      opacity: isActive ? 1 : 0.4,
                      border: isActive ? `1px solid ${activeColorEntry.tape}` : '1px solid transparent',
                      boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <div 
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[20%] rounded-b-[1px]"
                      style={{ background: activeColorEntry.tape, opacity: isActive ? 0.5 : 0 }}
                    />
                  </div>
                </div>
                <span className={`text-[9px] font-normal uppercase transition-colors ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* TypographySection */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Font scale
        </span>
        <SegBar>
          {[12, 16, 24, 32, 48].map((s) => (
            <SegButton key={s} isActive={noteToolSize === s} onClick={() => setNoteToolSize(s)}>
              {s}
            </SegButton>
          ))}
        </SegBar>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Add Note Action */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleAddNote}
          className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)] group relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="absolute inset-0 bg-blue-500/0 group-active:bg-blue-500/10 transition-colors" />
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] transition-transform group-hover:scale-105 shadow-sm">
            <span className="text-[14px] text-blue-400 font-normal mt-[-1px]">+</span>
          </div>
          <span className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-primary)]">Add Note</span>
        </button>

        <button
          onClick={() => setShowNotes(!showNotes)}
          className="px-4 rounded-xl flex items-center justify-center transition-all bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] text-[var(--text-primary)]"
          title={showNotes ? "Hide All Notes" : "Show All Notes"}
        >
          {showNotes ? <EyeOff size={16} /> : <Eye size={16} />}
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
      customSubmenu={Submenu}
    />
  );
};

export default NoteTool;
