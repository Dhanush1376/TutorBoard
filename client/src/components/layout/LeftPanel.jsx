import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatWindow from '../chat/ChatWindow';
import InputBar from '../chat/InputBar';
import ChatHistory from '../chat/ChatHistory';
import ThemeSelector from './ThemeSelector';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import {
  BookOpen, Plus, Search, PanelLeftClose, X, PanelLeft, PanelRight, Check,
  ChevronLeft, Lightbulb, HelpCircle, Activity, Layers, ChevronDown, Settings, Loader
} from 'lucide-react';
import VisaiLogo from './VisaiLogo';
import ToastContainer from './ToastContainer';


const LeftPanel = ({
  // routing
  activeView, setActiveView,
  // sessions
  chatHistory, activeChatId,
  onNewChat, onSelectChat, onDeleteChat, onRenameChat,
  // chat
  messages, isGenerating,
  onOpenCanvas, onDeleteMessage, onEditMessage,
  // input
  prompt, setPrompt, onSubmit, activeMode, setActiveMode, isDark,
  // agent selection
  selectedAgent, setSelectedAgent,
  isLoadingHistory,
  hasMore, isLoadingMore, onLoadMore,
  onQuickAsk
}) => {
  const navigate = useNavigate();
  const { setSidebarOpen, layoutView, setOverlay } = useTutorStore();
  const hasStarted = messages.length > 0;
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard Shortcuts for Professional Feel
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. "/" focuses search
      if (e.key === '/' && 
          document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA' &&
          !document.activeElement.isContentEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // 2. "Alt + N" starts new session
      if (e.altKey && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        onNewChat();
        setActiveView('chat');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewChat, setActiveView]);

  const filteredHistory = searchQuery.trim()
    ? chatHistory.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistory;

  // ── RENDER HELPERS ──
  const renderScrollContent = () => {
    if (activeView === 'chat') {
      return (
        <div className="flex flex-col gap-2 relative min-h-full">
          {/* Compact Back Button for Sidebar Chat */}
          {/* Sticky Header with Back Button */}
          <div className="sticky top-0 bg-transparent z-10 pt-0 pb-2.5">
            <button
              onClick={() => { setActiveView('history'); }}
              className="flex items-center gap-1.5 px-1 py-1 text-[12px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors group"
            >
              <ChevronLeft size={14} strokeWidth={3.5} className="text-[12px] font-normal uppercase tracking-[0.15em] px-1 text-[var(--text-tertiary)]" />
              <p className="text-[12px] font-normal uppercase tracking-[0.15em] px-1 py-1 text-[var(--text-tertiary)]">All Sessions</p>
            </button>
          </div>
          <ChatWindow
            messages={messages}
            isGenerating={isGenerating}
            onOpenCanvas={onOpenCanvas}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0 w-full relative">
        {/* Recent sessions history */}
        {/* Sticky Header for Recents */}
        <div className="sticky top-0 bg-transparent z-10 pt-0 pb-1">
          <p className="text-[10px] font-normal uppercase tracking-[0.15em] px-1 py-1 text-[var(--text-tertiary)]">Recents</p>
        </div>
        <div className="flex flex-col w-full">
          {isLoadingHistory ? (
            <div className="space-y-3 px-1 py-2">
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-40" />
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-20" />
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-10" />
            </div>
          ) : (
            <ChatHistory
              chatHistory={filteredHistory}
              activeChatId={activeChatId}
              onSelectChat={(id) => { onSelectChat(id); setActiveView('chat'); }}
              onDeleteChat={onDeleteChat}
              onRenameChat={onRenameChat}
            />
          )}

          {/* Pagination Trigger */}
          {hasMore && !searchQuery.trim() && (
            <div className="px-1 py-4">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[11px] font-normal uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                )}
                {isLoadingMore ? 'Loading...' : 'Load older sessions'}
              </button>
            </div>
          )}
        </div>

        {/* Empty State & Suggestions (shown only on landing if no history) */}
        {!isLoadingHistory && chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-0.5 select-none animate-fade-in">
            {/* 1. Large Cinematic Logo */}
            <div className="relative mb-8 group cursor-default">
              {/* Pulsing Background Glow */}
              <motion.div 
                animate={{ 
                  opacity: [0.05, 0.12, 0.05],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-0 bg-[var(--text-primary)] blur-[60px] rounded-full pointer-events-none" 
              />
              
              {/* Floating Logo Animation */}
              <motion.div 
                animate={{ 
                  y: [0, -12, 0],
                  rotate: [0, 1, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="relative transform hover:scale-110 transition-transform duration-700 ease-spring"
              >
                <VisaiLogo size="xl" className="text-[var(--text-primary)] opacity-80" />
              </motion.div>
            </div>

            <div className="text-center space-y-2 mb-12">
              <h3 className="text-[20px] font-serif uppercase tracking-[0.2em] text-[var(--text-primary)] opacity-90 leading-tight">
                No Sessions
              </h3>
              <p className="text-[11px] text-[var(--text-tertiary)] font-normal tracking-wide opacity-60">
                Your cinematic learning journey starts here
              </p>
            </div>

            <div className="w-full mt-4">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[var(--border-color)]" />
                <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--text-tertiary)] opacity-50 whitespace-nowrap">
                  Ask a Question
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[var(--border-color)]" />
              </div>

              <div className="relative h-12 w-full overflow-hidden mask-fade-x">
                <motion.div
                  className="flex gap-3 absolute whitespace-nowrap items-center h-full py-1"
                  animate={{ x: [0, -1200] }}
                  transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
                >
                  {[
                    "Explain prefix sum in detail",
                    "How does linear search work?",
                    "Visualize bubble sort algorithm",
                    "Explain sliding window technique",
                    "The process of photosynthesis",
                    "Core concepts of DSA",
                    "Exploring the Solar system",
                    "Step-by-step Binary search",
                    "Explain prefix sum in detail",
                    "How does linear search work?",
                    "Visualize bubble sort algorithm",
                    "Explain sliding window technique",
                    "The process of photosynthesis",
                    "Core concepts of DSA",
                    "Exploring the Solar system",
                    "Step-by-step Binary search",
                  ].map((text, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPrompt(text);
                        setTimeout(() => onSubmit(text), 10);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all hover:scale-[1.03] active:scale-[0.97] hover:border-[var(--text-tertiary)]/30 shadow-sm"
                    >
                      {text}
                    </button>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={`flex flex-col h-full text-[var(--text-primary)] bg-[var(--bg-primary)] ${isMobile ? 'pr-0' : 'pr-2'}`}>

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <VisaiLogo size={isMobile ? "xxs" : "xs"} className="text-[var(--text-primary)]" />
            <span
              className={`${isMobile ? 'text-[11px]' : 'text-[13px]'} font-normal uppercase tracking-[0.22em] text-[var(--text-primary)]`}
              style={{ letterSpacing: '0.22em', opacity: 0.9 }}
            >
              TutorBoard
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setOverlay('settings')}
              className={`${isMobile ? 'p-2' : 'p-2.5'} rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group`}
              title="Open Settings"
            >
              <Settings size={isMobile ? 18 : 20} strokeWidth={1.8} className="group-hover:rotate-45 transition-transform" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`${isMobile ? 'p-2' : 'p-2.5'} rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group`}
              title="Close Workspace"
            >
              {isMobile ? <X size={20} strokeWidth={2} /> : <PanelLeftClose size={22} strokeWidth={1.8} className="group-hover:scale-110 transition-transform" />}
            </button>
          </div>
        </div>

        {/* Top block visible only on landing/history */}
        {activeView !== 'chat' && (
          <div className={`${isMobile ? 'px-3 mb-4' : 'px-4 mb-6'}`}>
            <div className="flex flex-col gap-3">
              {/* 1. New Chat (Primary Hero Action) */}
              <button
                onClick={() => { 
                  onNewChat(); 
                  setActiveView('chat'); 
                }}
                className={`relative group w-full flex items-center justify-between gap-3 ${isMobile ? 'px-3.5 py-2.5 rounded-xl' : 'px-4 py-3 rounded-2xl'} bg-gradient-to-br from-[var(--text-primary)] to-[var(--text-primary)]/90 text-[var(--bg-primary)] shadow-lg shadow-[var(--text-primary)]/10 hover:shadow-[var(--text-primary)]/20 active:scale-[0.98] transition-all duration-300 overflow-hidden`}
              >
                {/* Subtle Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-primary)]/15 border border-white/10 flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                    <Plus size={14} strokeWidth={3} />
                  </div>
                  <span className={`${isMobile ? 'text-[12px]' : 'text-[13px]'} font-medium tracking-tight`}>New session</span>
                </div>
                
                {!isMobile && (
                  <div className="text-[10px] font-medium opacity-40 px-1.5 py-0.5 rounded-md border border-white/20 uppercase tracking-[0.1em] bg-white/5 group-hover:opacity-100 transition-opacity">
                    Alt N
                  </div>
                )}
              </button>

              {/* 2. Search (Integrated Command-style Search) */}
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors pointer-events-none">
                  <Search size={14} strokeWidth={2.5} className="group-focus-within:scale-110 transition-transform" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search sessions..."
                  className={`w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--text-tertiary)] ${isMobile ? 'rounded-xl pl-9 pr-9 py-2' : 'rounded-2xl pl-10 pr-10 py-2.5'} text-[12.5px] outline-none transition-all placeholder:text-[var(--text-tertiary)]/60 placeholder:font-normal shadow-sm`}
                />
                
                {/* Clear search or Keyboard Hint */}
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchQuery ? (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  ) : !isMobile && (
                    <div className="text-[9px] font-medium text-[var(--text-tertiary)]/50 border border-[var(--border-color)] rounded-md px-1.5 py-0.5 uppercase tracking-tighter bg-[var(--bg-tertiary)]/30 group-focus-within:opacity-0 transition-opacity">
                      /
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className={`flex-1 overflow-y-auto no-scrollbar ${isMobile ? 'px-3' : 'px-4'} pt-0 pb-6 min-h-0 relative`}>


        {/* List content (Messages OR History + Suggestions) */}
        {renderScrollContent()}
      </div>

      {/* ─── 3. FIXED BOTTOM SECTION ─── */}
      <div className="flex-shrink-0 w-full relative z-20">
        <InputBar
          value={prompt}
          onChange={setPrompt}
          onSubmit={onSubmit}
          isGenerating={isGenerating}
          isLanding={!hasStarted}
          activeMode={activeMode}
          setActiveMode={setActiveMode}
          isDark={isDark}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          onQuickAsk={onQuickAsk}
        />
      </div>
    </div>
  );
};

export default LeftPanel;
