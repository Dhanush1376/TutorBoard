import React from 'react';
import { 
  Trash2, 
  Trash, 
  Pencil, 
  StickyNote,
  Eraser,
  Hammer
} from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import useTutorStore from '../../../store/tutorStore';
import ActionButtonBase from '../components/ActionButtonBase';

const HoldToConfirmButton = ({ onConfirm }) => {
  const [isHolding, setIsHolding] = React.useState(false);
  const controls = useAnimation();
  const HOLD_DURATION = 1500;
  const timerRef = React.useRef(null);

  const startHold = () => {
    setIsHolding(true);
    controls.start({
      strokeDashoffset: 0,
      transition: { duration: HOLD_DURATION / 1000, ease: 'linear' }
    });
    timerRef.current = setTimeout(() => {
      onConfirm();
      setIsHolding(false);
    }, HOLD_DURATION);
  };

  const cancelHold = () => {
    setIsHolding(false);
    clearTimeout(timerRef.current);
    controls.start({
      strokeDashoffset: 100,
      transition: { duration: 0.2 }
    });
  };

  return (
    <motion.button
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      whileTap={{ scale: 0.96 }}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all group overflow-hidden relative"
    >
      <div className="relative w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Trash2 size={15} className="text-red-500" />
        
        {/* Progress Circular Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <motion.circle
            cx="16" cy="16" r="14"
            fill="none"
            stroke="rgb(239,68,68)"
            strokeWidth="2"
            strokeDasharray="100"
            initial={{ strokeDashoffset: 100 }}
            animate={controls}
          />
        </svg>
      </div>

      <div className="flex flex-col items-start leading-tight">
        <span className="text-xs font-bold text-red-500">Board Reset</span>
        <span className="text-[9px] text-red-400/70 uppercase font-black">
          {isHolding ? 'Release to Cancel' : 'Hold to Confirm'}
        </span>
      </div>
      
      {/* Background Pulse while holding */}
      {isHolding && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="absolute inset-0 bg-red-500 pointer-events-none"
        />
      )}
    </motion.button>
  );
};

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

      {/* Full Reset with Hold-to-Confirm */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1 text-red-400">Danger Zone</span>
        
        <div className="relative group">
          <HoldToConfirmButton onConfirm={() => {
            clearAll();
            props.onMouseLeave?.();
          }} />
        </div>
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
