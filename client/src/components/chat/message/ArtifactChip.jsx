import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Code, Globe, FileText, Table2, GitBranch, ChevronRight as ChevronRightIcon } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';

const ARTIFACT_TYPE_CONFIG = {
  code: { icon: Code, label: 'Code', color: '#3b82f6' },
  ui: { icon: Globe, label: 'UI Preview', color: '#8b5cf6' },
  document: { icon: FileText, label: 'Document', color: '#10b981' },
  table: { icon: Table2, label: 'Table', color: '#f59e0b' },
  diagram: { icon: GitBranch, label: 'Diagram', color: '#ec4899' },
};

const ArtifactChip = ({ artifactId }) => {
  const artifact = useTutorStore(
    useCallback((s) => s.artifacts?.find((a) => a.id === artifactId), [artifactId])
  );
  const openArtifactPanel = useTutorStore((s) => s.openArtifactPanel);

  if (!artifact) return null;

  const cfg = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.code;
  const Icon = cfg.icon;

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => {
        useTutorStore.getState().setActiveArtifact?.(artifactId);
        openArtifactPanel?.();
      }}
      className="mt-3 flex items-center gap-3 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.98] text-left sf-glass border border-white/5"
      style={{
        padding: '10px 14px',
        background: 'rgba(var(--bg-secondary-rgb), 0.4)',
        maxWidth: '100%',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}18` }}
      >
        <Icon size={13} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artifact.title || cfg.label}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>
          {cfg.label} · Click to open
        </p>
      </div>
      <ChevronRightIcon size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </motion.button>
  );
};

export default ArtifactChip;
