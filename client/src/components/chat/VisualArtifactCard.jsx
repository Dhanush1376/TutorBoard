import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Box, Activity, FlaskConical,
  Network, Sparkles, ArrowUpRight, Loader2,
  X, Radio, Eye, EyeOff, Terminal, Code, Layout
} from 'lucide-react';
import useTutorStore, { CANVAS_LAYOUT } from '../../store/tutorStore';

const CONFIGS = {
  cinematic:  { icon: Layout,       label: 'Interactive UI',     desc: 'Dynamic component preview',    accent: '#6366f1', tag: 'UI'        },
  d3:         { icon: Network,      label: 'Concept Graph',      desc: 'Interactive node map',         accent: '#0ea5e9', tag: 'GRAPH'     },
  physics:    { icon: FlaskConical, label: 'Simulation',        desc: 'Real-time physics model',      accent: '#f59e0b', tag: 'SIM'       },
  three:      { icon: Box,          label: '3D Space',           desc: 'Spatial 3D visualization',     accent: '#a855f7', tag: '3D'        },
  matter:     { icon: Activity,     label: 'Dynamics',           desc: 'Physical interaction engine',   accent: '#ec4899', tag: 'PHYSICS'   },
  algorithm:  { icon: Terminal,     label: 'Logic Flow',         desc: 'Step-through visualizer',      accent: '#10b981', tag: 'LOGIC'     },
  code:       { icon: Code,         label: 'Source Code',        desc: 'Functional code block',        accent: '#6366f1', tag: 'CODE'      },
  default:    { icon: Sparkles,     label: 'Artifact',           desc: 'AI-generated intelligence',    accent: '#64748b', tag: 'AI'        },
};

const Spinner = ({ size = 14, color = 'currentColor' }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
  >
    <Loader2 size={size} color={color} strokeWidth={2} />
  </motion.div>
);

/**
 * VisualArtifactCard — AI OS Artifact Portal.
 * Premium glassmorphism card for AI-generated visual components.
 */
const VisualArtifactCard = ({
  artifactId,
  artifactData,
  title,
  type = 'visual',
  rendererType = 'cinematic',
  status = 'completed',
  onOpenCanvas,
  messageId,
}) => {
  const { openArtifactOnCanvas, setCanvasLayout, activeScene, canvasLayout } = useTutorStore();
  const activeSnapshotId = useTutorStore((state) => state.activeSnapshotId);

  const artifact = useTutorStore(
    (state) => state.artifacts?.find((a) => a.id === artifactId || a.dbId === artifactId)
  ) || artifactData;

  const isPersisting = status === 'completed' && artifact && !artifact.dbId && !artifactData && artifactId;
  const isGenerating = status === 'generating';
  const canOpen     = status === 'completed' && !isPersisting;

  const currentId    = artifact?.dbId || artifact?.id || artifactId || messageId || 'visual-sim';
  const isTitleMatch = activeScene?.title && (activeScene.title === (artifact?.title || title));
  const isActive     = ((activeScene?.id === currentId || isTitleMatch) || (messageId && activeSnapshotId === messageId)) && canvasLayout !== CANVAS_LAYOUT.INLINE;

  const cfgType  = (artifact?.metadata?.rendererType || artifact?.rendererType || rendererType || 'cinematic').toLowerCase();
  const cfg      = CONFIGS[cfgType] || CONFIGS.default;
  const Icon     = cfg.icon;

  const displayTitle = title || artifact?.title || cfg.label;
  const stepCount    = artifact?.visual_steps?.length || artifact?.animation_steps?.length || artifact?.timeline?.length || artifact?.narrations?.length || artifact?.content?.length || artifact?.steps?.length || artifact?.script?.length || artifact?.canvasSteps?.length || artifact?.canvasObjects?.length || 0;

  const handleToggle = React.useCallback((e) => {
    e?.stopPropagation();
    if (!canOpen) return;

    if (isActive) {
      setCanvasLayout(CANVAS_LAYOUT.INLINE);
      useTutorStore.getState().setActiveSnapshotId?.(null);
    } else {
      if (onOpenCanvas && messageId) {
        onOpenCanvas(messageId);
      }
      // Fetch latest artifact state to avoid stale closure issues during auto-open
      const latestArtifact = useTutorStore.getState().artifacts?.find((a) => a.id === artifactId || a.dbId === artifactId) || artifact;
      
      openArtifactOnCanvas({
        id: currentId,
        title: title || latestArtifact?.title || cfg.label,
        type: latestArtifact?.type || type,
        content: latestArtifact?.visual_steps || latestArtifact?.animation_steps || latestArtifact?.timeline || latestArtifact?.narrations || latestArtifact?.steps || latestArtifact?.script || latestArtifact?.content || latestArtifact?.canvasSteps || latestArtifact?.canvasObjects || (latestArtifact?.script ? latestArtifact.script : (Array.isArray(latestArtifact) ? latestArtifact : [])),
        rendererType: (latestArtifact?.metadata?.rendererType || latestArtifact?.rendererType || rendererType || 'cinematic').toLowerCase(),
      });
    }
  }, [canOpen, isActive, currentId, title, cfg.label, type, rendererType, artifactId, artifact, onOpenCanvas, messageId, openArtifactOnCanvas, setCanvasLayout]);

  // #24: Artifact Hydration Guard - Auto-activate artifact when it finishes generating
  const prevStatusRef = React.useRef(status);
  React.useEffect(() => {
    if (prevStatusRef.current === 'generating' && status === 'completed' && !isActive) {
      handleToggle();
    }
    prevStatusRef.current = status;
  }, [status, isActive, handleToggle]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full mt-4 mb-3"
    >
      <div
        onClick={handleToggle}
        className={`relative group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 ${isGenerating ? 'artifact-generating' : ''}`}
        style={{
          background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
          borderColor: isActive ? 'rgba(99,102,241,0.4)' : 'var(--border-color)',
          boxShadow: isActive ? '0 0 30px rgba(99,102,241,0.15)' : '0 2px 12px rgba(0,0,0,0.02)',
        }}
      >
        <div className="p-4 flex items-center gap-4">
          {/* Icon Section */}
          <div className="relative shrink-0">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500"
              style={{
                background: isGenerating ? 'rgba(99,102,241,0.1)' : isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg-tertiary)',
                color: isGenerating || isActive ? '#818cf8' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-color)',
              }}
            >
              {isGenerating ? (
                <Spinner size={18} color="#6366f1" />
              ) : (
                <Icon size={20} strokeWidth={1.5} />
              )}
            </div>
            
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-[#0a0a0a] shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-[14px] font-semibold truncate tracking-tight transition-colors duration-300" style={{ color: 'var(--text-primary)' }}>
                {displayTitle}
              </h4>
              {!isGenerating && (
                <span 
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border"
                  style={{
                    background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                    borderColor: isActive ? 'rgba(99,102,241,0.3)' : 'var(--border-color)',
                    color: isActive ? '#6366f1' : 'var(--text-tertiary)'
                  }}
                >
                  {cfg.tag}
                </span>
              )}
            </div>
            
            <p className="text-[12px] truncate font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {isGenerating ? 'Architecting visual component...' : cfg.desc}
            </p>
          </div>

          {/* Action Area */}
          <div className="shrink-0 flex items-center gap-3">
            {stepCount > 0 && !isGenerating && (
              <div className="px-2 py-1 rounded-md border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-tertiary)' }}>
                  {stepCount} layers
                </span>
              </div>
            )}
            
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
              style={{
                background: isActive ? '#6366f1' : 'var(--bg-tertiary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 15px rgba(99,102,241,0.4)' : 'none',
                border: isActive ? 'none' : '1px solid var(--border-color)',
              }}
            >
              {isActive ? <EyeOff size={14} strokeWidth={2.5} /> : <ArrowUpRight size={14} strokeWidth={2.5} />}
            </div>
          </div>
        </div>

        {/* Shimmer overlay for loading state */}
        {isGenerating && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VisualArtifactCard;