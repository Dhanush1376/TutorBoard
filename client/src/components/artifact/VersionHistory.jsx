import React from 'react';
import { History, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VersionHistory = ({ versions, currentVersion, onRevert, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="absolute top-full right-0 mt-1 z-50 w-64 max-h-72 overflow-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="px-3 py-2 border-b border-[var(--border-color)]/30">
          <div className="flex items-center gap-1.5">
            <History size={12} className="text-[var(--text-tertiary)]" />
            <span className="text-[11px] font-medium text-[var(--text-primary)]">
              Version History
            </span>
            <span className="text-[9px] text-[var(--text-tertiary)] ml-auto">
              {versions?.length || 0} versions
            </span>
          </div>
        </div>

        <div className="p-1.5 space-y-0.5">
          {(versions || []).map((v, idx) => {
            const isCurrent = v.version === currentVersion;
            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-[var(--text-primary)]/[0.06]'
                    : 'hover:bg-[var(--bg-tertiary)]/50'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">
                    Version {v.version}
                    {isCurrent && (
                      <span className="ml-1.5 text-[9px] font-normal text-[var(--text-tertiary)] uppercase tracking-wider">
                        current
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-[var(--text-tertiary)]">
                    {v.createdAt ? new Date(v.createdAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }) : 'Unknown'}
                  </span>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => {
                      onRevert(idx);
                      onClose?.();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-[var(--border-color)]/30 hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
                  >
                    <RotateCcw size={10} />
                    Revert
                  </button>
                )}
              </div>
            );
          })}

          {(!versions || versions.length === 0) && (
            <div className="px-3 py-4 text-center text-[11px] text-[var(--text-tertiary)]">
              No version history yet
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VersionHistory;
