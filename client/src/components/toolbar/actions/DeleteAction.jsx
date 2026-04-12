import React from 'react';
import { 
  Trash2, 
  Trash, 
  Pencil, 
  StickyNote,
  Eraser,
  Hammer
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ActionButtonBase from '../components/ActionButtonBase';

const DeleteAction = (props) => {
  const { clearAll, clearDrawings, clearNotes } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5 min-w-[200px]">
      {/* Selective Hygiene */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Quick Purge</span>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => {
              clearDrawings();
              props.onMouseLeave?.();
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <Pencil size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Clean Drawings</span>
          </button>
          <button
            onClick={() => {
              clearNotes();
              props.onMouseLeave?.();
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <StickyNote size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Clear All Notes</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Full Reset */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1 text-red-400">Danger Zone</span>
        <button
          onClick={() => {
            clearAll();
            props.onMouseLeave?.();
          }}
          className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Trash2 size={15} className="text-red-500" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs font-bold text-red-500">Board Reset</span>
            <span className="text-[9px] text-red-400/70 uppercase font-black">Destructive</span>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <ActionButtonBase 
      {...props}
      icon={Trash2} 
      label="Clear Canvas" 
      isDestructive={true}
      customSubmenu={Submenu}
    />
  );
};

export default DeleteAction;
