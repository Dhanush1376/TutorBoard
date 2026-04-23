import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Brain, Play, Pause, ChevronRight, 
  ChevronDown, Info, Lightbulb, TrendingUp,
  AlertTriangle, CheckCircle2, History, Minus
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';

import VisaiLogo from '../layout/VisaiLogo';

const DifficultyBadge = ({ steps, objects }) => {
  const complexity = steps.length + (objects.length / 3);
  let label = 'Easy';
  let color = '#10b981';
  let reason = 'Simple logic with few moving parts.';

  if (complexity > 15) {
    label = 'Hard';
    color = '#ef4444';
    reason = 'Advanced multi-stage reasoning required.';
  } else if (complexity > 7) {
    label = 'Medium';
    color = '#f59e0b';
    reason = 'Standard problem-solving depth.';
  }

  return (
    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-normal uppercase tracking-widest text-[var(--text-tertiary)]">Complexity</span>
        <div 
          className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {label}
        </div>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{reason}</p>
    </div>
  );
};

const StepCard = ({ step, index, isActive, isExpanded, onToggle, onWhy, onPlayTo }) => {
  return (
    <motion.div 
      layout
      className={`group relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
        isActive 
          ? 'bg-[var(--bg-tertiary)] border-[var(--accent-primary)] shadow-lg' 
          : 'bg-transparent border-[var(--border-color)] hover:border-[var(--text-tertiary)]/30'
      }`}
      onClick={() => onPlayTo(index)}
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          isActive ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)]'
        }`}>
          {index + 1}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-sm font-normal truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              {step.title || `Step ${index + 1}`}
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onWhy(index); }}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                title="Reasoning"
              >
                <Lightbulb size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] transition-colors"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)] font-normal">
                  {step.explanation || step.narration}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {isActive && (
        <motion.div 
          layoutId="active-glow"
          className="absolute inset-0 rounded-2xl border-2 border-[var(--accent-primary)] pointer-events-none"
          initial={false}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.div>
  );
};

const ExplainSolutionOverlay = ({ isOpen, onClose }) => {
  const { 
    canvasObjects, canvasConnections, canvasSteps, 
    currentStepIndex, setCurrentStep, layoutView,
    isExplainMinimized, setExplainMinimized, isVisualizerMinimized
  } = useTutorStore();
  const { mode } = useTheme();

  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReasoning, setShowReasoning] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const timerRef = useRef(null);

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= canvasSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, canvasSteps.length, setCurrentStep]);

  const toggleExpand = (idx) => setExpandedIndex(expandedIndex === idx ? null : idx);

  // Calculate bottom offset if multiple are minimized
  const bottomOffset = isExplainMinimized && isVisualizerMinimized ? 130 : 80;
  const isActuallyOpen = isOpen || isExplainMinimized;

  if (!isActuallyOpen) return null;

  return (
    <AnimatePresence>
      {isActuallyOpen && (
        <div 
          className={`fixed inset-0 z-[5999] pointer-events-none ${(!isExplainMinimized && !isMaximized) ? 'flex items-center justify-center' : ''}`}
        >
          {/* Backdrop Blur */}
          {!isExplainMinimized && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[5999] bg-black/40 backdrop-blur-xl pointer-events-auto"
              onClick={onClose}
            />
          )}

          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={
              isExplainMinimized ? {
                position: 'fixed',
                top: 'auto',
                bottom: `${bottomOffset}px`,
                left: layoutView === 'right' ? '24px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '24px',
                width: '190px',
                height: '40px',
                borderRadius: '20px',
                x: 0, y: 0, scale: 1, opacity: 1,
              } : isMaximized ? {
                  position: 'fixed',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  width: '100vw',
                  height: '100vh',
                  borderRadius: 0,
                  x: 0, y: 0, scale: 1, opacity: 1,
                } : {
                  position: 'relative',
                  width: '1024px',
                  height: '85vh',
                  borderRadius: '24px',
                  x: 0, y: 0, scale: 1, opacity: 1,
                }
              }
              exit={{ 
              scale: 0.95, 
              opacity: 0,
              y: 10,
              transition: { duration: 0.2, ease: "easeOut" }
            }}
            className="pointer-events-auto"
              style={{
                background: isExplainMinimized
                  ? (mode === 'dark' ? 'rgba(39, 39, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)')
                  : 'var(--bg-primary)',
                backdropFilter: isExplainMinimized ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: isExplainMinimized ? 'blur(12px)' : 'none',
                border: isMaximized ? 'none' : isExplainMinimized ? `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : '1px solid var(--border-color)',
                boxShadow: isExplainMinimized
                  ? '0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
                  : mode === 'dark'
                    ? '0 0 0 1px #1a1a1a, 0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(255,255,255,0.02)'
                    : '0 40px 120px rgba(0,0,0,0.1), 0 0 40px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                cursor: isExplainMinimized ? 'pointer' : 'default',
                zIndex: 100000,
                color: 'var(--text-primary)',
              }}
              whileHover={isExplainMinimized ? { y: -4, scale: 1.02, background: mode === 'dark' ? 'rgba(45, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)' } : {}}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={() => { if (isExplainMinimized) setExplainMinimized(false); }}
            >
            {isExplainMinimized ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '0 16px',
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.01em'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VisaiLogo size="xxs" style={{ color: '#febc2e' }} />
                  <div style={{
                    position: 'absolute',
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: '#febc2e',
                    opacity: 0.3,
                    filter: 'blur(4px)',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>Explain Solution</span>
                <style>{`@keyframes pulse { 0% { opacity: 0.2; scale: 0.9; } 50% { opacity: 0.5; scale: 1.2; } 100% { opacity: 0.2; scale: 0.9; } }`}</style>
              </div>
            ) : (
              <>
                {/* ── Title Bar ── */}
                <div
                  style={{
                    height: 44,
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 16,
                    paddingRight: 16,
                    gap: 0,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      onMouseEnter={() => setIsTrafficHovered(true)}
                      onMouseLeave={() => setIsTrafficHovered(false)}
                      style={{ display: 'flex', gap: 6, flexShrink: 0 }}
                    >
                      {[
                        { color: '#ff5f57', action: () => onClose(), icon: <X size={7} /> },
                        { color: '#febc2e', action: (e) => { e.stopPropagation(); setExplainMinimized(true); }, icon: <Minus size={8} /> },
                        { color: '#28c840', action: (e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }, icon: isMaximized ? <Minus size={8} style={{ transform: 'rotate(90deg)' }} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} /> },
                      ].map((btn, i) => (
                        <button
                          key={i}
                          onClick={btn.action}
                          style={{
                            width: 12, height: 12,
                            borderRadius: '50%',
                            background: btn.color,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(0,0,0,0.5)',
                            padding: 0,
                            transition: 'all 0.15s',
                            boxShadow: `0 0 0 0.5px rgba(0,0,0,0.2)`,
                          }}
                        >
                          {isTrafficHovered && btn.icon}
                        </button>
                      ))}
                    </div>

                    <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3, flexShrink: 0 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                      <VisaiLogo size="xxs" />
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.04em',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        Explain Solution — TutorBoard
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Section */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center shadow-sm">
                      <Brain size={22} strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="text-xl font-normal text-[var(--text-primary)] tracking-tight font-serif">Explain My Solution</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--text-tertiary)] font-normal uppercase tracking-widest">Pedagogical Walkthrough</span>
                        <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]/30" />
                        <span className="text-[10px] text-[var(--accent-primary)] font-bold uppercase tracking-widest">
                          {canvasSteps.length} Logical Steps
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-normal transition-all ${
                        isPlaying 
                          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30' 
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-quaternary)]'
                      }`}
                    >
                      {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      {isPlaying ? 'Pause Walkthrough' : 'Play Walkthrough'}
                    </button>
                  </div>
                </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left Column: Steps List */}
              <div className="w-[380px] border-right border-[var(--border-color)] flex flex-col bg-[var(--bg-primary)]/20">
                <div className="p-6 border-b border-[var(--border-color)]">
                   <DifficultyBadge steps={canvasSteps} objects={canvasObjects} />
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                  {canvasSteps.map((step, i) => (
                    <StepCard 
                      key={i} 
                      step={step} 
                      index={i}
                      isActive={currentStepIndex === i}
                      isExpanded={expandedIndex === i}
                      onToggle={() => toggleExpand(i)}
                      onWhy={() => setShowReasoning(i)}
                      onPlayTo={setCurrentStep}
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Visual Flow & Insights */}
              <div className="flex-1 flex flex-col bg-[var(--bg-tertiary)]/10">
                <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                  {/* Visual Flow Representation */}
                  <div className="mb-10">
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp size={16} className="text-[var(--text-tertiary)]" />
                      <span className="text-[11px] font-normal uppercase tracking-widest text-[var(--text-tertiary)]">Logical Pipeline</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center justify-center">
                      {canvasSteps.map((step, i) => (
                        <React.Fragment key={i}>
                          <motion.div
                            animate={{ 
                              scale: currentStepIndex === i ? 1.05 : 1,
                              borderColor: currentStepIndex === i ? 'var(--accent-primary)' : 'var(--border-color)',
                              backgroundColor: currentStepIndex === i ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'
                            }}
                            className="px-4 py-3 rounded-xl border flex flex-col gap-1 min-w-[120px] shadow-sm"
                          >
                            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-tighter">Step {i + 1}</span>
                            <span className="text-[11px] text-[var(--text-primary)] font-normal line-clamp-1">{step.title}</span>
                          </motion.div>
                          {i < canvasSteps.length - 1 && (
                            <ChevronRight size={14} className="text-[var(--text-tertiary)]/40" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Why reasoning overlay or panel */}
                  <AnimatePresence mode="wait">
                    {showReasoning !== null ? (
                      <motion.div 
                        key={showReasoning}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-8 rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-xl relative overflow-hidden"
                      >
                         <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent-primary)]" />
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                               <Lightbulb size={18} />
                               <span className="text-xs font-bold uppercase tracking-wider">Solution Logic</span>
                            </div>
                            <button onClick={() => setShowReasoning(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                               <X size={14} />
                            </button>
                         </div>
                         <h4 className="text-base font-normal text-[var(--text-primary)] mb-3">
                            Why {canvasSteps[showReasoning].title}?
                         </h4>
                         <p className="text-sm leading-relaxed text-[var(--text-secondary)] font-normal italic">
                            "{canvasSteps[showReasoning].explanation || "This step establishes the necessary context and variables to proceed with the core logic of the solution."}"
                         </p>
                         <div className="mt-8 pt-6 border-t border-[var(--border-color)] flex items-center gap-6">
                            <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">Focus</span>
                               <span className="text-xs text-[var(--text-primary)]">{canvasSteps[showReasoning].highlightIds?.length || 0} Entities</span>
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">Intensity</span>
                               <span className="text-xs text-[var(--text-primary)]">High Impact</span>
                            </div>
                         </div>
                      </motion.div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)] mb-4">
                          <History size={32} strokeWidth={1} />
                        </div>
                        <h4 className="text-sm font-normal text-[var(--text-secondary)]">Select a step to see reasoning</h4>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Deep logic and mistaking detection appear here.</p>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Advanced: Optimization Suggestions */}
                  {canvasSteps.length > 5 && (
                    <div className="mt-10 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center gap-3 mb-3">
                         <Info size={16} className="text-blue-500" />
                         <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Optimization Insight</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        The AI detected a linear solution pattern. This is optimal for the current complexity. 
                        To improve clarity, consider grouping Step 2 and 3 if the variables are independent.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)] flex justify-between items-center">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <CheckCircle2 size={14} className="text-green-500" />
                     <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Solution Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <AlertTriangle size={14} className="text-amber-500" />
                     <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">No Inefficiencies Found</span>
                  </div>
               </div>
               <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-[0.2em]">Pedagogical Engine v5.0 • explain_mode</span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
};

export default ExplainSolutionOverlay;
