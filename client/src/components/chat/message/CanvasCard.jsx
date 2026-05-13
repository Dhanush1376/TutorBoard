import React from 'react';
import { motion } from 'framer-motion';
import { Check, Eye, Layers, Network, FlaskConical } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';

const CANVAS_CONFIGS = {
  cinematic: { icon: Layers, label: 'Visual Explanation', desc: 'Watch animated canvas breakdown', color: 'var(--success)' },
  d3: { icon: Network, label: 'Visual Canvas', desc: 'Interactive concept map', color: 'var(--info)' },
  physics: { icon: FlaskConical, label: 'Physics Simulation', desc: 'Interactive physics canvas', color: 'var(--warning)' },
  default: { icon: Layers, label: 'Interactive Canvas', desc: 'Step-by-step visual', color: 'var(--text-tertiary)' },
};

const CanvasCard = ({ onOpenCanvas, messageId, canvasType, stepCount, title }) => {
  const activeSnapshotId = useTutorStore(s => s.activeSnapshotId);
  const isActive = activeSnapshotId === messageId;

  const cfg = CANVAS_CONFIGS[canvasType] || CANVAS_CONFIGS.default;
  const Icon = cfg.icon;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onOpenCanvas?.(messageId)}
      className="mt-4 flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.98] text-left"
      style={{
        padding: '12px 18px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 28,
        width: '100%',
        maxWidth: 500,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        display: 'flex',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}18` }}
      >
        <Icon size={18} strokeWidth={1.8} style={{ color: cfg.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          {title || cfg.label}
        </p>
        <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
          {cfg.desc}{stepCount ? ` · ${stepCount} steps` : ''}
        </p>
      </div>

      <div
        className="flex items-center gap-1 rounded-lg flex-shrink-0"
        style={{
          padding: '4px 10px',
          background: isActive ? 'var(--success)' : 'var(--text-primary)',
          color: 'var(--bg-primary)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}
      >
        {isActive ? <Check size={9} /> : <Eye size={9} />}
        {isActive ? 'Active' : 'Open'}
      </div>
    </motion.button>
  );
};

export default CanvasCard;
