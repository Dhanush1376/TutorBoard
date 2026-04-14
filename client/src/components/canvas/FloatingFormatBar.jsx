import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Pin, Trash2, Code2, Sigma } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { PRESET_COLORS } from '../toolbar/components/ColorPicker';



const FONTS = [
  { id: "'Inter', sans-serif", label: "Inter" },
  { id: "system-ui, sans-serif", label: "System UI" },
  { id: "'Courier New', monospace", label: "Courier" },
  { id: "Georgia, serif", label: "Georgia" },
  { id: "'Comic Sans MS', cursive", label: "Comic Sans" },
];

const SIZES = [12, 14, 16, 20, 24, 32, 48, 64];

export default function FloatingFormatBar({ element, updateCanvasObject }) {
  if (!element) return null;

  const { deleteCanvasObject, toggleNotePin, setEditingObjectId } = useTutorStore();

  const handleUpdate = (updates) => {
    updateCanvasObject(element.id, updates);
  };

  const handleStyleUpdate = (styleUpdates) => {
    updateCanvasObject(element.id, { styles: styleUpdates });
  };

  const styles = element.styles || {};
  const isBold = styles.fontWeight === 'bold' || styles.fontWeight >= 700 || element.fontWeight === 'bold';
  const isItalic = styles.fontStyle === 'italic' || element.fontStyle === 'italic';
  const isUnderline = styles.textDecoration === 'underline' || element.textDecoration === 'underline';
  const isPinned = element.isPinned || element.pinned;
  
  const isMath = element.type === 'equation' || element.type === 'math';
  const isCode = element.type === 'code' || element.type === 'terminal';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute z-50 flex items-center gap-2 p-1.5 rounded-lg shadow-2xl pointer-events-auto"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
      onPointerDown={(e) => e.stopPropagation()} // Prevent canvas dragging
    >
      {/* Font Family Select */}
      <select 
        value={styles.fontFamily || element.fontFamily || FONTS[0].id}
        onChange={(e) => handleStyleUpdate({ fontFamily: e.target.value })}
        className="bg-transparent text-[var(--text-primary)] text-xs font-semibold outline-none cursor-pointer px-2 py-1 rounded hover:bg-[var(--bg-primary)] transition"
      >
        {FONTS.map(f => <option key={f.id} value={f.id} className="bg-[var(--bg-secondary)]">{f.label}</option>)}
      </select>

      <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />

      {/* Font Size */}
      <select 
        value={styles.fontSize || element.fontSize || 16}
        onChange={(e) => handleStyleUpdate({ fontSize: Number(e.target.value) })}
        className="bg-transparent text-[var(--text-primary)] text-xs font-semibold outline-none cursor-pointer px-1 py-1 rounded hover:bg-[var(--bg-primary)] transition"
      >
        {SIZES.map(s => <option key={s} value={s} className="bg-[var(--bg-secondary)]">{s}</option>)}
      </select>

      <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />

      {/* Format Toggles */}
      <div className="flex gap-0.5">
        <button 
          onClick={() => handleStyleUpdate({ fontWeight: isBold ? 'normal' : 'bold' })}
          className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition"
          style={{ background: isBold ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          title="Bold"
        >
          <Bold size={14} color="var(--text-primary)" />
        </button>
        <button 
          onClick={() => handleStyleUpdate({ fontStyle: isItalic ? 'normal' : 'italic' })}
          className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition"
          style={{ background: isItalic ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          title="Italic"
        >
          <Italic size={14} color="var(--text-primary)" />
        </button>
        <button 
          onClick={() => handleStyleUpdate({ textDecoration: isUnderline ? 'none' : 'underline' })}
          className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition"
          style={{ background: isUnderline ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          title="Underline"
        >
          <Underline size={14} color="var(--text-primary)" />
        </button>
      </div>

      <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />

      {/* Text Alignment */}
      <div className="flex gap-0.5">
        {['left', 'center', 'right'].map((align) => {
          const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
          const isActive = (styles.textAlign || element.textAlign || 'center') === align;
          return (
            <button 
              key={align}
              onClick={() => handleStyleUpdate({ textAlign: align })}
              className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition"
              style={{ background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              title={`Align ${align}`}
            >
              <Icon size={14} color="var(--text-primary)" />
            </button>
          )
        })}
      </div>


      <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />

      {/* Basic Color Palette — synced with shared ColorPicker */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.filter(c => c.id !== 'default').slice(0, 6).map(preset => (
            <button 
              key={preset.id}
              onClick={() => handleUpdate({ color: preset.value })}
              className="w-3.5 h-3.5 rounded-full border border-gray-600 transition hover:scale-110"
              style={{ 
                background: preset.value,
                boxShadow: element.color === preset.value ? `0 0 0 1.5px var(--bg-primary), 0 0 0 3px ${preset.value}` : 'none'
              }}
              title={preset.label}
            />
          ))}
        </div>
      </div>

      <div className="w-px h-5 bg-[var(--border-color)] opacity-50" />

      {/* Actions (Pin/Delete/Special) */}
      <div className="flex gap-0.5">
        {isCode && (
           <button title="Code Settings" className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition">
             <Code2 size={14} color="#22d3ee" />
           </button>
        )}
        {isMath && (
           <button title="Math Symbols" className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition">
             <Sigma size={14} color="#fbbf24" />
           </button>
        )}
        <button 
          onClick={() => toggleNotePin(element.id)}
          className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition"
          style={{ background: isPinned ? 'rgba(251,191,36,0.15)' : 'transparent' }}
          title={isPinned ? "Unpin" : "Pin"}
        >
          <Pin size={14} color={isPinned ? "#fbbf24" : "var(--text-primary)"} />
        </button>
        <button 
          onClick={() => { deleteCanvasObject(element.id); setEditingObjectId(null); }}
          className="p-1.5 rounded hover:bg-red-950/30 transition group"
          title="Delete"
        >
          <Trash2 size={14} className="text-[var(--text-primary)] group-hover:text-red-400" />
        </button>
      </div>
    </motion.div>
  );
}
