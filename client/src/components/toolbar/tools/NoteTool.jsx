import React from 'react';
import { motion } from 'framer-motion';
import { 
  StickyNote, 
  Check,
  Type
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const NOTE_COLORS = [
  { id: 'gold',     value: '#fbbf24', label: 'Classic' },
  { id: 'mint',     value: '#6ee7b7', label: 'Mint' },
  { id: 'peach',    value: '#fca5a5', label: 'Peach' },
  { id: 'sky',      value: '#7dd3fc', label: 'Sky' },
  { id: 'lavender', value: '#c4b5fd', label: 'Lavender' },
];

const NOTE_SIZES = [
  { id: 'small',  label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large',  label: 'Large' },
];

const NoteTool = (props) => {
  const { 
    noteColor, setNoteColor,
    noteSize, setNoteSize 
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-5 p-3.5 min-w-[200px]">
      {/* Color Palette */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Note Color</span>
        <div className="flex items-center gap-2 px-1">
          {NOTE_COLORS.map((c) => {
            const isActive = noteColor === c.value;
            return (
              <button
                key={c.id}
                onClick={() => setNoteColor(c.value)}
                className="relative w-8 h-8 rounded-lg transition-transform active:scale-90"
                style={{ 
                  background: c.value,
                  boxShadow: isActive ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c.value}` : 'none',
                  transform: isActive ? 'scale(0.85)' : 'scale(1)',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={14} color="rgba(0,0,0,0.4)" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Size Selector */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Note Size</span>
        <div className="flex gap-1.5 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          {NOTE_SIZES.map((s) => {
            const isActive = noteSize === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setNoteSize(s.id)}
                className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all"
                style={{ 
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                }}
              >
                {s.label[0]}
              </button>
            );
          })}
        </div>
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
