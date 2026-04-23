/**
 * MasteryDashboard v1.0 — Learner Analytics & Semantic History
 * 
 * Features:
 * - Topic Mastery Heatmap
 * - Progress Curve (Confusion vs. Mastery)
 * - Semantic History (Past relevant sessions)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';

export default function MasteryDashboard() {
  const { learnerProfile, doubtHistory } = useTutorStore();
  const topics = learnerProfile?.topicsMastery || {};

  const topicEntries = useMemo(() => Object.entries(topics), [topics]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 bg-[var(--bg-primary)] min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-normal tracking-tight">Learner Intelligence</h1>
        <p className="text-white/50 text-lg">Synthesizing your pedagogical journey across dimensions.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Overall Mastery" 
          value={`${Math.round(topicEntries.reduce((acc, [_, v]) => acc + v, 0) / (topicEntries.length || 1) * 100)}%`}
          color="blue"
        />
        <StatCard 
          label="Learning Pace" 
          value={learnerProfile?.pace || 'Normal'}
          color="purple"
        />
        <StatCard 
          label="Resolved Doubts" 
          value={doubtHistory?.length || 0}
          color="green"
        />
      </div>

      {/* Topic Mastery Section */}
      <section className="space-y-6">
        <h3 className="text-xl font-normal flex items-center space-x-3">
          <span className="w-2 h-6 bg-blue-500 rounded-full" />
          <span>Topic Specialization</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {topicEntries.length > 0 ? topicEntries.map(([topic, mastery]) => (
            <TopicCard key={topic} topic={topic} mastery={mastery} />
          )) : (
            <div className="col-span-full p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 text-white/30">
              No topic mastery data yet. Start a lesson to build your profile.
            </div>
          )}
        </div>
      </section>

      {/* History & Semantic Continuity */}
      <section className="space-y-6">
        <h3 className="text-xl font-normal flex items-center space-x-3">
          <span className="w-2 h-6 bg-purple-500 rounded-full" />
          <span>Semantic Continuity</span>
        </h3>
        
        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40">
                <th className="px-6 py-4">Topic</th>
                <th className="px-6 py-4">Confusion Index</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Last Interaction</th>
              </tr>
            </thead>
            <tbody>
              {doubtHistory?.slice(-5).map((doubt, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-normal">{doubt.topic}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${(doubt.confusionScore || 0) * 100}%` }} />
                      </div>
                      <span className="text-[10px]">{Math.round((doubt.confusionScore || 0) * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-normal rounded-full uppercase">Resolved</span>
                  </td>
                  <td className="px-6 py-4 text-right text-white/40 text-xs">
                    {new Date(doubt.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/5 border-green-500/20 text-green-400',
  };

  return (
    <div className={`p-8 rounded-3xl border bg-gradient-to-br ${colors[color]} space-y-2 relative overflow-hidden`}>
      <p className="text-xs font-normal uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-4xl font-normal">{value}</p>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -mr-16 -mt-16 rounded-full" />
    </div>
  );
}

function TopicCard({ topic, mastery }) {
  return (
    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:border-white/20 transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
          <div className="w-6 h-6 bg-blue-500 rounded-lg blur-[2px] opacity-50" />
        </div>
        <span className="text-2xl font-normal text-white/90">{Math.round(mastery * 100)}%</span>
      </div>
      <h4 className="font-normal text-lg mb-2">{topic}</h4>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500" 
          initial={{ width: 0 }}
          animate={{ width: `${mastery * 100}%` }}
        />
      </div>
    </div>
  );
}
