import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Brain, MessageSquare, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * Learner Mastery HUD
 * Collapsible side widget showing progress, confusion, and engagement stats.
 */
const MasteryHUD = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { learnerProfile, topic, doubtHistory } = useTutorStore();

  const safeTopic = (topic || '').toLowerCase().trim();
  const topicsMap = learnerProfile?.topicsMastery || {};
  
  // Key access hardening: try exact match then normalized match
  const masteryValue = topicsMap[topic] ?? 
                       topicsMap[safeTopic] ?? 
                       Object.entries(topicsMap).find(([k]) => k.toLowerCase().trim() === safeTopic)?.[1] ?? 
                       0;
  const mastery = (masteryValue || 0) * 100;
  const confusion = learnerProfile?.confusionIndex || 0;
  const doubtsCount = doubtHistory?.length || 0;
  
  // Resolve confusion color
  const getConfusionColor = (val) => {
    if (val < 0.3) return 'bg-emerald-500';
    if (val < 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getConfusionLabel = (val) => {
    if (val < 0.3) return 'Clear';
    if (val < 0.6) return 'Slightly Confused';
    return 'Struggling';
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-32 left-6 z-[100] flex items-start gap-3"
    >
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            key="hud-expanded"
            initial={{ width: 0, opacity: 0, scale: 0.9 }}
            animate={{ width: 'auto', opacity: 1, scale: 1 }}
            exit={{ width: 0, opacity: 0, scale: 0.9 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-3xl p-5 shadow-2xl flex items-center gap-6 min-w-[320px]">
              
              {/* Mastery Ring */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-full h-full rotate-[-90deg]">
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="var(--bg-tertiary)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="var(--text-primary)"
                    strokeWidth="6"
                    strokeDasharray={176}
                    initial={{ strokeDashoffset: 176 }}
                    animate={{ strokeDashoffset: 176 - (176 * mastery) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-[14px] font-normal text-[var(--text-primary)] leading-none">{Math.round(mastery)}%</span>
                  <span className="text-[7px] font-normal uppercase tracking-widest text-[var(--text-tertiary)] mt-1">Mastery</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="flex-1 grid grid-cols-1 gap-3">
                
                {/* Confusion Dot */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getConfusionColor(confusion)} animate-pulse shadow-[0_0_10px_rgba(0,0,0,0.2)]`} />
                    <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-wider">Mind State</span>
                  </div>
                  <span className="text-[10px] font-normal text-[var(--text-primary)]">{getConfusionLabel(confusion)}</span>
                </div>

                <div className="h-px bg-[var(--border-color)] opacity-40" />

                {/* Engagement Stats */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                      <MessageSquare size={10} />
                      <span className="text-[8px] font-normal uppercase tracking-widest">Doubts</span>
                    </div>
                    <span className="text-[12px] font-normal text-[var(--text-primary)]">{doubtsCount}</span>
                  </div>

                  <div className="w-px h-6 bg-[var(--border-color)] opacity-40" />

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                      <BookOpen size={10} />
                      <span className="text-[8px] font-normal uppercase tracking-widest">Sessions</span>
                    </div>
                    <span className="text-[12px] font-normal text-[var(--text-primary)]">{learnerProfile?.totalSessions || 1}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all shadow-xl backdrop-blur-xl"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </motion.div>
  );
};

export default MasteryHUD;
