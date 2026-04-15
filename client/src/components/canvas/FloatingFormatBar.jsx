import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  Pin, Trash2, Code2, Sigma, Pipette, List, ListOrdered, 
  ChevronDown, Type as TypeIcon 
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { PRESET_COLORS } from '../toolbar/tools/ColorPicker';



const FONTS = [
  { id: "'Inter', sans-serif", label: "Inter" },
  { id: "'Geist Mono', monospace", label: "Mono" },
  { id: "'Georgia', serif", label: "Georgia" },
  { id: "'Outfit', sans-serif", label: "Outfit" },
  { id: "'Playfair Display', serif", label: "Playfair" },
];

const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96];

export default function FloatingFormatBar({ element, updateCanvasObject, rotation = 0 }) {
  if (!element) return null;

  const colorInputRef = React.useRef(null);
  const { deleteCanvasObject, toggleNotePin, setEditingObjectId, addRecentColor } = useTutorStore();

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
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        rotate: rotation
      }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="flex items-center gap-1 p-0.5 rounded-lg shadow-[0_15px_35px_rgba(0,0,0,0.25)] pointer-events-auto border backdrop-blur-md"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        minWidth: 'max-content',
        boxShadow: '0 8px 20px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.03)',
      }}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
    >
      <div className="flex items-center gap-1 px-1">
        
        {/* Font Selection Section */}
        <div className="flex items-center gap-1 bg-slate-100/50 p-0.5 rounded-lg border border-slate-200">
          <div className="relative flex items-center group">
            <select 
              value={styles.fontFamily || element.fontFamily || FONTS[0].id}
              onChange={(e) => handleStyleUpdate({ fontFamily: e.target.value })}
              className="appearance-none bg-transparent text-[11px] font-semibold text-slate-700 pl-2 pr-6 h-7 cursor-pointer outline-none hover:bg-white/80 rounded-md transition"
            >
              {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 pointer-events-none text-slate-400" />
          </div>
          
          <div className="w-px h-4 bg-slate-300 mx-0.5" />
          
          <div className="relative flex items-center">
            <select 
              value={styles.fontSize || element.fontSize || 16}
              onChange={(e) => handleStyleUpdate({ fontSize: Number(e.target.value) })}
              className="appearance-none bg-transparent text-[11px] font-semibold text-slate-700 pl-2 pr-6 h-7 cursor-pointer outline-none hover:bg-white/80 rounded-md transition"
            >
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 pointer-events-none text-slate-400" />
          </div>
        </div>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 mx-0.5" />

        {/* Format Toggles */}
        <div className="flex gap-0.5 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
          <button 
            onClick={() => handleStyleUpdate({ fontWeight: isBold ? 'normal' : 'bold' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${isBold ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <Bold size={10} strokeWidth={isBold ? 3 : 2} />
          </button>
          <button 
            onClick={() => handleStyleUpdate({ fontStyle: isItalic ? 'normal' : 'italic' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${isItalic ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <Italic size={10} strokeWidth={isItalic ? 3 : 2} />
          </button>
          <button 
            onClick={() => handleStyleUpdate({ textDecoration: isUnderline ? 'none' : 'underline' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${isUnderline ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <Underline size={10} strokeWidth={isUnderline ? 3 : 2} />
          </button>

        </div>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 mx-0.5" />

        {/* Alignment & Lists */}
        <div className="flex gap-0.5 bg-slate-100/50 p-0.5 rounded-lg border border-slate-200">
          <button 
            onClick={() => handleStyleUpdate({ textAlign: 'left' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${(styles.textAlign || 'left') === 'left' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <AlignLeft size={11} />
          </button>
          <button 
            onClick={() => handleStyleUpdate({ textAlign: 'center' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${(styles.textAlign) === 'center' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <AlignCenter size={11} />
          </button>
          <button 
            onClick={() => handleStyleUpdate({ textAlign: 'right' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${(styles.textAlign) === 'right' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <AlignRight size={11} />
          </button>
          
          <div className="w-px h-4 bg-slate-300 self-center mx-1" />

          {/* List Toggles (Simulated placeholders for now) */}
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600">
            <List size={12} />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600">
            <ListOrdered size={12} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 mx-0.5" />

        {/* Colors */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] p-1.5 rounded-lg border border-[var(--border-color)] overflow-hidden">
          <div className="flex gap-1">
            {PRESET_COLORS.filter(c => c.id !== 'default').slice(0, 6).map(preset => (
              <button 
                key={preset.id}
                onClick={() => {
                  updateCanvasObject(element.id, { color: preset.value });
                  if (preset.value.startsWith('#')) addRecentColor(preset.value);
                }}
                className="w-3.5 h-3.5 rounded-full border border-gray-600 transition hover:scale-110"
                style={{ 
                  background: preset.value,
                  boxShadow: element.color === preset.value ? `0 0 0 1.5px var(--bg-primary), 0 0 0 3px ${preset.value}` : 'none'
                }}
              />
            ))}
          </div>
          <button 
            onClick={() => colorInputRef.current?.click()}
            className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-[var(--bg-secondary)] transition text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <Pipette size={10} />
            <input 
              ref={colorInputRef}
              type="color"
              className="sr-only"
              onChange={(e) => {
                updateCanvasObject(element.id, { color: e.target.value });
                addRecentColor(e.target.value);
              }}
            />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border-color)] opacity-30 mx-0.5" />

        {/* Actions */}
        <div className="flex gap-0.5 bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)]">
          <button 
            onClick={() => toggleNotePin(element.id)}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${isPinned ? 'bg-amber-500/10 text-amber-500' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <Pin size={10} />
          </button>
          <button 
            onClick={() => { deleteCanvasObject(element.id); setEditingObjectId(null); }}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-all text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-400/10"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
