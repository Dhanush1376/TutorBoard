/**
 * MasteryDashboard v2.0 — Advanced Learner Analytics
 * 
 * Features:
 * - Real-time Mastery Radar Chart
 * - Confusion History Trend Line
 * - Learning Velocity Stat
 * - Mastery Heatmap
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area
} from 'recharts';
import {
  Zap, Brain, Target, ArrowUpRight, Clock,
  MessageSquare, LayoutDashboard, ChevronRight, Activity, Sparkles,
  X, Minus, Plus, BookMarked, Trash2, Calendar, RefreshCw
} from 'lucide-react';
import API from '../../services/api';
import useTutorStore from '../../store/tutorStore';
import Loader from '../layout/Loader';

import { useNavigate } from 'react-router-dom';



export default function MasteryDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { 
    learnerProfile, isMasteryOpen, setMasteryOpen, takeaways, removeTakeaway: storeRemoveTakeaway,
    isConnected, connectionError 
  } = useTutorStore(useShallow(state => ({
    learnerProfile: state.learnerProfile,
    isMasteryOpen: state.isMasteryOpen,
    setMasteryOpen: state.setMasteryOpen,
    takeaways: state.takeaways,
    removeTakeaway: state.removeTakeaway,
    isConnected: state.isConnected,
    connectionError: state.connectionError
  })));
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleClose = async (e) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    // Allow time for the closing animation to play
    setTimeout(() => {
      setMasteryOpen(false);
      setIsClosing(false); // Reset for next open
    }, 450);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get('/api/learner/dashboard');
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTakeaway = async (id) => {
    try {
      await API.delete(`/api/learner/takeaways/${id}`);
      // Refresh local store to keep UI in sync
      storeRemoveTakeaway(id);
      // Refresh local dashboard data if needed
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to remove takeaway:', err);
      setError('Failed to remove insight. Please check your connection.');
    }
  };

  useEffect(() => {
    // SEC-FO-01: Prevent redundant fetches if we already have data and aren't loading.
    // Manual refreshes should still be handled via handleRefresh.
    if (isMasteryOpen && !data && !loading) {
      fetchDashboardData();
    }
  }, [isMasteryOpen, data, loading, fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const radarData = useMemo(() => {
    if (!data?.mastery) return [];
    return Object.entries(data.mastery).map(([topic, m]) => ({
      subject: topic.length > 12 ? topic.substring(0, 10) + '...' : topic,
      A: Math.round((m.mastery || 0) * 100),
      fullMark: 100,
    }));
  }, [data]);

  const confusionData = useMemo(() => {
    if (!data?.confusionHistory) return [];
    return data.confusionHistory.map((d, i) => ({
      name: i,
      confusion: Math.round((d.score || 0) * 100),
      topic: d.topic
    }));
  }, [data]);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'insights', label: 'Key Insights', icon: BookMarked },
    { id: 'domains', label: 'Domain Mastery', icon: Brain },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'reviews', label: 'Review Center', icon: Clock },
  ];

  if (!isMasteryOpen && !isClosing) return null;

  return createPortal(
    <AnimatePresence>
      {(isMasteryOpen || isClosing) && (
        <div
          className="fixed inset-0 z-[7000] flex items-center justify-center pointer-events-none"
          style={{ fontFamily: '"Outfit", "Inter", sans-serif' }}
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{
              opacity: isClosing || isMinimized ? 0 : 1,
              backdropFilter: isClosing || isMinimized ? 'blur(0px)' : 'blur(20px)',
              pointerEvents: isMinimized || isClosing ? 'none' : 'auto'
            }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className={`fixed inset-0 bg-black/40 dark:bg-black/60`}
            style={{ zIndex: -1 }}
            onClick={(e) => {
              if (isMinimized) return;
              handleClose(e);
            }}
          />

          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
            animate={{
              opacity: isClosing ? 0 : 1,
              scale: isClosing ? 0.95 : (isMinimized ? 0.25 : 1),
              y: isClosing ? 10 : (isMinimized ? 'calc(50vh - 100px)' : 0),
              x: isMinimized ? 'calc(50vw - 140px)' : 0,
              width: isMaximized ? '100vw' : (isMinimized ? '400px' : 'min(1100px, 95vw)'),
              height: isMaximized ? '100vh' : (isMinimized ? '120px' : 'min(780px, 90vh)'),
              borderRadius: (isMaximized) ? '0px' : (isMinimized ? '20px' : '28px'),
              filter: isClosing ? 'blur(10px)' : 'blur(0px)',
              pointerEvents: isClosing ? 'none' : 'auto'
            }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8,
              layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
            }}
            className={`liquid-glass border border-[var(--border-color)] flex flex-col shadow-[0_60px_120px_rgba(0,0,0,0.5)] overflow-hidden relative pointer-events-auto ${isMinimized ? 'cursor-pointer' : ''}`}
            onClick={(e) => {
              if (isMinimized) {
                e.stopPropagation();
                setIsMinimized(false);
              }
            }}
          >
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader glass={true} />
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Activity size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Data Sync Failed</h3>
                  <p className="text-sm text-[var(--text-tertiary)] max-w-xs">{error}</p>
                </div>
                <button 
                  onClick={fetchDashboardData}
                  className="px-6 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} /> Retry Sync
                </button>
              </div>
            ) : (
              <>
                {/* macOS Traffic Light Header */}
                <div className="h-[52px] flex items-center justify-between px-6 bg-[var(--bg-secondary)]/50 border-b border-[var(--border-color)] shrink-0 z-20">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      onMouseEnter={() => setIsTrafficHovered(true)}
                      onMouseLeave={() => setIsTrafficHovered(false)}
                      className="flex gap-2"
                    >
                      {[
                        { color: '#ff5f57', action: handleClose, icon: <X size={7} strokeWidth={4} /> },
                        { color: '#febc2e', action: handleMinimize, icon: <Minus size={8} strokeWidth={4} /> },
                        { color: '#28c840', action: () => setIsMaximized(!isMaximized), icon: isMaximized ? <Minus size={8} strokeWidth={4} style={{ transform: 'rotate(90deg)' }} /> : <Plus size={7} strokeWidth={4} /> },
                      ].map((btn, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); btn.action(e); }}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all cursor-pointer border-none outline-none hover:brightness-90 active:scale-95 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.15)]"
                          style={{ background: btn.color }}
                        >
                          {isTrafficHovered && <span className="text-black/60">{btn.icon}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="w-[1px] h-4 bg-[var(--border-color)] opacity-40 mx-1" />
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-blue-500" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] opacity-80">
                        Learner Intelligence Dashboard
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRefresh}
                      className="p-2 hover:bg-[var(--bg-primary)] rounded-full transition-all text-[var(--text-tertiary)] hover:text-blue-400"
                      title="Refresh Data"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-primary)]/50 rounded-full border border-[var(--border-color)] text-[10px] font-medium text-[var(--text-secondary)]">
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${connectionError ? 'bg-red-500' : (isConnected ? 'bg-green-500' : 'bg-yellow-500')}`} />
                      {connectionError ? 'Sync Connection Lost' : (isConnected ? 'Live Sync Active' : 'Reconnecting...')}
                    </div>
                  </div>
                </div>

                {/* Segmented Navigation Bar */}
                <div className="h-14 flex justify-center gap-1 px-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30 shrink-0 overflow-x-auto no-scrollbar">
                  {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative px-6 flex items-center gap-2.5 transition-all duration-300 ${isActive ? 'text-blue-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <tab.icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                        <span className={`text-[13px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="dash-active-tab"
                            className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-t-full shadow-[0_-4px_12px_rgba(59,130,246,0.5)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="max-w-6xl mx-auto w-full space-y-12"
                    >
                      {activeTab === 'insights' && (
                        <div className="space-y-8">
                          <header className="flex items-end justify-between">
                            <div>
                              <h2 className="text-3xl font-light tracking-tight">Key <span className="font-normal text-amber-400">Insights</span></h2>
                              <p className="text-[var(--text-secondary)] text-sm">Critical concepts and takeaways captured during your journey.</p>
                            </div>
                            <div className="px-4 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                              {takeaways?.length || 0} Saved
                            </div>
                          </header>

                          {takeaways?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                              {takeaways.slice().reverse().map((insight) => (
                                <motion.div
                                  key={insight.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="group relative p-6 bg-[var(--bg-secondary)]/40 rounded-[2rem] border border-[var(--border-color)] hover:border-amber-500/30 transition-all flex gap-6 items-start"
                                >
                                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:bg-amber-500/20 transition-all">
                                    <BookMarked size={20} />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest flex items-center gap-2">
                                        <Calendar size={10} />
                                        {new Date(insight.timestamp).toLocaleDateString()} · {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <button
                                        onClick={() => removeTakeaway(insight.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        title="Remove Insight"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                    <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]/90 italic">
                                      "{insight.text}"
                                    </p>
                                  </div>

                                  {/* Decorative quote marks */}
                                  <div className="absolute top-4 right-8 text-4xl font-serif text-amber-500/5 select-none group-hover:text-amber-500/10 transition-colors">”</div>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-[var(--bg-secondary)]/20 rounded-[3rem] border-2 border-dashed border-[var(--border-color)]/30">
                              <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)]/50 flex items-center justify-center text-[var(--text-tertiary)] shadow-inner">
                                <BookMarked size={32} strokeWidth={1} />
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-lg font-medium text-[var(--text-primary)]">Your Knowledge Vault is Empty</h4>
                                <p className="text-sm text-[var(--text-tertiary)] max-w-[320px] leading-relaxed">
                                  Click the bookmark icon on any AI response during your lessons to save key insights and theoretical foundations here.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {activeTab === 'overview' && (
                        <div className="space-y-10">
                          <header className="space-y-2">
                            <h2 className="text-4xl font-light tracking-tight">
                              Knowledge <span className="font-normal text-blue-400">Synthesis</span>
                            </h2>
                            <p className="text-[var(--text-secondary)] text-sm max-w-xl">
                              Monitoring cognitive expansion across {Object.keys(data?.mastery || {}).length} active domains with semantic vector tracking.
                            </p>
                          </header>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatsCard
                              title="Overall Mastery"
                              value={`${Math.round(Object.values(data?.mastery || {}).reduce((s, m) => s + (m.mastery || 0), 0) / (Object.keys(data?.mastery || {}).length || 1) * 100)}%`}
                              description="Average across active topics"
                              icon={<Target size={20} className="text-blue-500" />}
                              progress={Object.values(data?.mastery || {}).reduce((s, m) => s + (m.mastery || 0), 0) / (Object.keys(data?.mastery || {}).length || 1)}
                            />
                            <StatsCard
                              title="Cognitive Engagement"
                              value={data?.analytics?.totalSteps || 0}
                              description="Visual steps completed"
                              icon={<Zap size={20} className="text-yellow-500" />}
                            />
                            <StatsCard
                              title="Active Doubts"
                              value={data?.analytics?.totalDoubts || 0}
                              description="Misconceptions resolved"
                              icon={<MessageSquare size={20} className="text-purple-500" />}
                            />
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-7 bg-[var(--bg-secondary)]/50 rounded-[2rem] p-8 border border-[var(--border-color)] h-[440px] flex flex-col">
                              <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-2">
                                  <Brain size={14} className="text-blue-400" /> Mental Model Radar
                                </h3>
                              </div>
                              <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                    <PolarGrid stroke="var(--border-color)" opacity={0.5} />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-tertiary)', fontSize: 9, fontWeight: 500 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar
                                      name="Mastery"
                                      dataKey="A"
                                      stroke="#3b82f6"
                                      fill="#3b82f6"
                                      fillOpacity={0.15}
                                      strokeWidth={2}
                                    />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: 'var(--bg-primary)',
                                        borderColor: 'var(--border-color)',
                                        borderRadius: '12px',
                                        fontSize: '11px'
                                      }}
                                    />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            <div className="lg:col-span-5 space-y-6">
                              <div className="p-8 bg-blue-500 rounded-[2rem] text-white overflow-hidden relative group">
                                <div className="relative z-10 space-y-4">
                                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">Intelligence Profile</p>
                                  <h4 className="text-2xl font-medium tracking-tight">Your learning velocity is <span className="underline decoration-white/30 underline-offset-4">{data?.velocity || 0} pts/wk</span></h4>
                                  <button
                                    onClick={() => navigate('/session')}
                                    className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                                  >
                                    Resume Learning <ChevronRight size={14} />
                                  </button>
                                </div>
                                <Sparkles className="absolute bottom-[-20px] right-[-20px] w-40 h-40 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
                              </div>

                              <div className="p-8 bg-[var(--bg-secondary)]/50 rounded-[2rem] border border-[var(--border-color)] space-y-4">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--text-tertiary)]">Detected Style</p>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center">
                                    <Zap size={24} />
                                  </div>
                                  <div>
                                    <h4 className="text-xl font-medium capitalize">{data?.learningStyle || 'Building Profile...'}</h4>
                                    <p className="text-[10px] text-[var(--text-tertiary)]">
                                     {data?.learningStyle === 'visual' ? 'Optimized for high-engagement simulations and diagrams.' :
                                      data?.learningStyle === 'conceptual' ? 'Focused on theoretical foundations and deep explanations.' :
                                      data?.learningStyle === 'balanced' ? 'Personalized mix of visual models and logical reasoning.' :
                                      'Interpreting your interaction patterns for optimization.'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'domains' && (
                        <div className="space-y-8">
                          <header className="flex items-end justify-between">
                            <div>
                              <h2 className="text-3xl font-light tracking-tight">Domain <span className="font-normal text-green-400">Mastery</span></h2>
                              <p className="text-[var(--text-secondary)] text-sm">Deep-dive into specific conceptual areas.</p>
                            </div>
                            <div className="px-4 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                              {Object.keys(data?.mastery || {}).length} Domains
                            </div>
                          </header>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(data?.mastery || {}).map(([topic, m], i) => (
                              <TopicMasteryCard key={topic} topic={topic} mastery={m.mastery} index={i} />
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === 'analytics' && (
                        <div className="space-y-8">
                          <header>
                            <h2 className="text-3xl font-light tracking-tight">Engagement <span className="font-normal text-red-400">Analytics</span></h2>
                            <p className="text-[var(--text-secondary)] text-sm">Tracking cognitive friction and confusion events.</p>
                          </header>
                          <div className="bg-[var(--bg-secondary)]/50 rounded-[2.5rem] p-8 border border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Confusion Index History</h3>
                            </div>
                            <div className="h-[300px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={confusionData}>
                                  <defs>
                                    <linearGradient id="colorConfusion" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                  <XAxis dataKey="name" hide />
                                  <YAxis domain={[0, 100]} hide />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--bg-primary)',
                                      borderColor: 'var(--border-color)',
                                      borderRadius: '14px',
                                      fontSize: '11px',
                                      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                                    }}
                                    itemStyle={{ color: '#ef4444' }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="confusion"
                                    stroke="#ef4444"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorConfusion)"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'reviews' && (
                        <div className="space-y-8">
                          <header className="flex items-end justify-between">
                            <div>
                              <h2 className="text-3xl font-light tracking-tight">Review <span className="font-normal text-purple-400">Center</span></h2>
                              <p className="text-[var(--text-secondary)] text-sm font-mono opacity-60">Spaced-repetition reinforcement queue</p>
                            </div>
                            <div className="px-4 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                              {data?.dueConcepts?.length || 0} Ready
                            </div>
                          </header>

                          {data?.dueConcepts?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {data.dueConcepts.map((concept, i) => (
                                <motion.div 
                                  key={i}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="group p-6 bg-[var(--bg-secondary)]/40 rounded-[2rem] border border-[var(--border-color)] hover:border-purple-500/30 transition-all flex justify-between items-center"
                                >
                                  <div className="space-y-1">
                                    <h4 className="font-semibold text-sm text-[var(--text-primary)]">{concept}</h4>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                      <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold tracking-widest">Reinforcement Due</span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => navigate('/session', { state: { topic: concept } })}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-xl text-[10px] font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/20"
                                  >
                                    Review Now
                                  </button>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 bg-[var(--bg-secondary)]/20 rounded-[3rem] border-2 border-dashed border-[var(--border-color)]/30">
                              <div className="w-20 h-20 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                                <Zap size={32} />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-lg font-semibold">Everything is up to date!</h4>
                                <p className="text-sm text-[var(--text-tertiary)] max-w-[300px]">
                                  You've mastered your current curriculum. Check back later for scheduled reinforcements.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="h-10 px-6 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-color)] flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] font-bold shrink-0">
                  <div className="flex items-center gap-4">
                    <span>TutorBoard v5.0</span>
                    <div className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                    <span>Semantic Engine</span>
                  </div>
                  <span>© 2026 VISAI LABS</span>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function StatMini({ label, value, unit, icon }) {
  return (
    <div className="px-5 py-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)]">{label}</p>
        <p className="text-lg font-medium">
          {value}<span className="text-xs ml-1 opacity-40 font-normal">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function StatsCard({ title, value, description, icon, progress }) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      className="bg-[var(--bg-secondary)]/40 rounded-[2rem] p-8 border border-[var(--border-color)] relative overflow-hidden group shadow-sm hover:shadow-xl transition-all duration-500"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] font-bold opacity-60">{title}</p>
          <p className="text-4xl font-mono tracking-tighter flex items-baseline gap-1">
            {value}
            {progress !== undefined && <span className="text-[10px] font-mono text-blue-400 opacity-60">.log</span>}
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)] font-medium opacity-80">{description}</p>
        </div>
        <div className="w-12 h-12 bg-[var(--bg-primary)]/50 rounded-2xl border border-[var(--border-color)] flex items-center justify-center transition-all group-hover:rotate-12 group-hover:scale-110 shadow-inner">
          {icon}
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-8 space-y-2">
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-tertiary)] opacity-60 uppercase">
            <span>Optimization</span>
            <span>{(progress * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden p-[1px] border border-[var(--border-color)]/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-300 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"
            />
          </div>
        </div>
      )}

      {/* Technical Background Detail */}
      <div className="absolute bottom-[-20px] left-[-20px] w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
    </motion.div>
  );
}

function TopicMasteryCard({ topic, mastery, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + (index * 0.05), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, borderColor: 'rgba(59, 130, 246, 0.5)' }}
      className="p-6 bg-[var(--bg-secondary)]/40 rounded-[2rem] border border-[var(--border-color)] space-y-6 transition-all group cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
          <Brain size={18} />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xl font-mono font-bold tracking-tighter text-blue-400">{Math.round(mastery * 100)}%</span>
          <span className="text-[8px] uppercase tracking-widest text-[var(--text-tertiary)] opacity-60">Status: Optimal</span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-xs line-clamp-1 opacity-90 group-hover:opacity-100">{topic}</h4>
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${i < Math.round(mastery * 5) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'bg-[var(--bg-tertiary)]'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex -space-x-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-5 h-5 rounded-full border-2 border-[var(--bg-secondary)] bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-blue-400/20 to-purple-400/20" />
            </div>
          ))}
        </div>
        <span className="text-[9px] text-[var(--text-tertiary)] font-mono opacity-50 uppercase">Domain: Concept</span>
      </div>
    </motion.div>
  );
}
