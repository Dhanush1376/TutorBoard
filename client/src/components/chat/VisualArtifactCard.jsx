import React from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, Maximize2, Play, Box, 
  Activity, FlaskConical, Network, 
  Sparkles, CheckCircle2, GitBranch 
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const RENDERER_ICONS = {
  d3: Network,
  three: Box,
  matter: Activity,
  cinematic: Layers,
  algorithm: GitBranch,
};

const VisualArtifactCard = ({ 
  artifactId, 
  title, 
  type = 'visual', 
  rendererType = 'cinematic',
  status = 'completed' // 'generating' | 'completed'
}) => {
  const { openArtifactOnCanvas } = useTutorStore();
  const artifact = useTutorStore(state => 
    state.artifacts?.find(a => a.id === artifactId || a.dbId === artifactId)
  );

  const isPersisting = status === 'completed' && artifact && !artifact.dbId;
  const canOpen = status === 'completed' && artifact && (artifact.dbId || artifact.id);

  const Icon = RENDERER_ICONS[rendererType] || Layers;

  const handleOpen = () => {
    if (!canOpen || isPersisting) return;
    openArtifactOnCanvas({ 
      id: artifact.dbId || artifact.id, 
      title: artifact.title || title, 
      type: artifact.type || type, 
      rendererType: artifact.metadata?.rendererType || rendererType 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`my-4 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg group relative ${isPersisting ? 'cursor-wait' : ''}`}
      style={{ maxWidth: '450px' }}
    >
      {/* Visual Preview Placeholder / Skeleton */}
      <div className="aspect-[16/10] bg-[var(--bg-tertiary)] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[var(--text-primary)] opacity-[0.03]" />
        
        {status === 'generating' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Icon size={32} className="text-[var(--text-tertiary)] opacity-20" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 border border-dashed border-[var(--text-tertiary)] opacity-30 rounded-full"
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] font-semibold">Generating Model</span>
              <div className="h-1 w-24 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                <motion.div 
                  animate={{ x: [-100, 100] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-full bg-[var(--text-primary)] opacity-40"
                />
              </div>
            </div>
          </div>
        ) : isPersisting ? (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={24} className="text-[var(--text-tertiary)] opacity-40" />
            </motion.div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] font-medium">Saving to cloud...</span>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 opacity-10">
              {/* Decorative Background for finished artifact */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] border-2 border-dashed border-[var(--text-primary)] rounded-full animate-[spin_20s_linear_infinite]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] border border-[var(--text-primary)] rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            </div>
            <Icon size={48} className="text-[var(--text-primary)] opacity-20" />
            
            {/* Play/Open Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleOpen}
                disabled={!canOpen || isPersisting}
                className="bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPersisting ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Activity size={14} />
                    </motion.div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    Launch Lesson
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="p-4 flex items-center justify-between gap-4 bg-[var(--bg-secondary)]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">
              {rendererType} Model
            </span>
            {status === 'completed' && !isPersisting && <CheckCircle2 size={12} className="text-[var(--success)]" />}
          </div>
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
            {title || (artifact?.title) || 'Interactive Visualization'}
          </h4>
        </div>
        
        <button 
          onClick={handleOpen}
          disabled={!canOpen || isPersisting}
          className="p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          title={isPersisting ? "Saving..." : "Fullscreen"}
        >
          {isPersisting ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}><Layers size={16} /></motion.div> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Decorative corners */}
      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
        <Sparkles size={14} className="text-[var(--text-primary)]" />
      </div>
    </motion.div>
  );
};

export default VisualArtifactCard;
