import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, BookOpen } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * Learner Mastery HUD — Compact horizontal layout
 * Shows mastery ring, mind state, doubts & sessions in a single row.
 */
const MasteryHUD = ({ collapsed = false }) => {
  const { learnerProfile, topic, doubtHistory } = useTutorStore();

  const safeTopic = (topic || '').toLowerCase().trim();
  const snakeTopic = safeTopic.replace(/\s+/g, '_');
  const topicsMap = learnerProfile?.topicsMastery || {};
  
  // Key access hardening: try exact match then normalized match
  const masteryValue = topicsMap[topic] ?? 
                       topicsMap[safeTopic] ?? 
                       topicsMap[snakeTopic] ??
                       Object.entries(topicsMap).find(([k]) => k.toLowerCase().trim() === safeTopic)?.[1] ?? 
                       0;
  const mastery = (typeof masteryValue === 'object' ? (masteryValue.mastery || 0) : (masteryValue || 0)) * 100;
  const confusion = learnerProfile?.confusionIndex || 0;
  const doubtsCount = doubtHistory?.length || 0;
  
  const getConfusionColor = (val) => {
    if (val < 0.3) return '#10b981';
    if (val < 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getConfusionLabel = (val) => {
    if (val < 0.3) return 'Clear';
    if (val < 0.6) return 'Confused';
    return 'Struggling';
  };

  const confusionColor = getConfusionColor(confusion);

  return (
    <div className={`flex flex-col gap-3 w-full ${collapsed ? 'items-end' : ''}`}>
      {/* Top Row: Mastery ring + Mind State */}
      <div className="flex items-center gap-3">
        {/* Mastery Ring */}
        <div className={`relative flex-shrink-0 ${collapsed ? 'w-9 h-9' : 'w-11 h-11'}`}>
          <svg className="w-full h-full" viewBox="0 0 44 44">
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="3"
            />
            <motion.circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth="3"
              strokeDasharray={113}
              initial={{ strokeDashoffset: 113 }}
              animate={{ strokeDashoffset: 113 - (113 * mastery) / 100 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '22px 22px', opacity: 0.8 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${collapsed ? 'text-[9px]' : 'text-[11px]'} font-bold text-[var(--text-primary)] leading-none tabular-nums`}>
              {Math.round(mastery)}%
            </span>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Mind State + Label */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] opacity-60">
                Mind State
              </span>
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: confusionColor }}
                />
                <span className="text-[11px] font-bold" style={{ color: confusionColor }}>
                  {getConfusionLabel(confusion)}
                </span>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Stats: Doubts & Sessions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <MessageSquare size={9} />
                  <span className="text-[7px] font-medium uppercase tracking-wider">Doubts</span>
                </div>
                <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">{doubtsCount}</span>
              </div>

              <div className="w-px h-6 bg-[var(--border-color)]" />

              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <BookOpen size={9} />
                  <span className="text-[7px] font-medium uppercase tracking-wider">Sessions</span>
                </div>
                <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">{learnerProfile?.totalSessions || 1}</span>
              </div>
            </div>
          </>
        )}

        {collapsed && (
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]"
            style={{ background: confusionColor }}
            title={`Mind State: ${getConfusionLabel(confusion)}`}
          />
        )}
      </div>
    </div>
  );
};

export default MasteryHUD;
