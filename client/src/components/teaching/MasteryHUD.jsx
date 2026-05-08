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
    <div className="w-full flex items-center justify-between gap-3">
        {/* Mastery Ring */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-full h-full rotate-[-90deg]">
            <circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="4"
            />
            <motion.circle
              cx="24" cy="24" r="20"
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth="4"
              strokeDasharray={126}
              initial={{ strokeDashoffset: 126 }}
              animate={{ strokeDashoffset: 126 - (126 * mastery) / 100 }}
              transition={{ duration: 1, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-[11px] font-normal text-[var(--text-primary)] leading-none">{Math.round(mastery)}%</span>
            <span className="text-[6px] font-normal uppercase tracking-widest text-[var(--text-tertiary)] mt-1">Mastery</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 flex flex-col gap-3">
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
  );
};

export default MasteryHUD;
