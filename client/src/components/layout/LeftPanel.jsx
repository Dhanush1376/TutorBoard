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
  ChevronLeft, Lightbulb, HelpCircle, Activity, Layers, ChevronDown, Settings, LayoutDashboard,
  FileText, Download, Sparkles
} from 'lucide-react';
import Loader from './Loader';
import VisaiLogo from './VisaiLogo';
import useWindowSize from '../../hooks/useWindowSize';
import { useAuth } from '../../context/AuthContext';
import GuestTrialBanner from '../common/GuestTrialBanner';


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
  onQuickAsk,
  onRegenerateMessage, onFeedback, onStopGeneration,
  onSwitchVersion,
  onOpenArtifact,
  onExport,
  isSplitView = false
}) => {
  const navigate = useNavigate();
  const { setSidebarOpen, layoutView, setOverlay } = useTutorStore();
  const { user } = useAuth();
  const isGuest = !!user?.isGuest;
  const hasStarted = messages.length > 0;
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard Shortcuts for Professional Feel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isMobile) return;

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
        <div className="flex flex-col gap-2 relative h-full">
          {/* Compact Back Button for Sidebar Chat */}
          {/* Sticky Header with Back Button - Fixed overlap */}
          <div className="sticky top-0 z-[15] pt-1 pb-2.5 -mx-1 px-1 bg-[var(--bg-primary)] flex items-center justify-between">
            <button
              onClick={() => { setActiveView('history'); }}
              className="flex items-center gap-1.5 px-1 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.15em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all group"
            >
              <ChevronLeft size={12} strokeWidth={2} className="text-[var(--text-tertiary)]" />
              <p className="px-0.5 tracking-[0.1em]">All Sessions</p>
            </button>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onExport?.('pdf')}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/60 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                title="Export as PDF"
              >
                <FileText size={13} />
              </button>
              <button
                onClick={() => onExport?.('docx')}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/60 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                title="Export as Word (DOCX)"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 pt-1">
            <ChatWindow
              messages={messages}
              isGenerating={isGenerating}
              onOpenCanvas={onOpenCanvas}
              onDeleteMessage={onDeleteMessage}
              onEditMessage={onEditMessage}
              onRegenerateMessage={onRegenerateMessage}
              onFeedback={onFeedback}
              onSwitchVersion={onSwitchVersion}
              onOpenArtifact={onOpenArtifact}
              activeMode={activeMode}
              setActiveMode={setActiveMode}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0 w-full relative h-full">
        {/* Sticky Header for Recents - Show for guests if they have history */}
        {(!isGuest || chatHistory.length > 0) && (
          <div className="sticky top-0 z-[15] pt-0 pb-1.5 -mx-1 px-1 bg-[var(--bg-primary)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] px-2 py-2 text-[var(--text-tertiary)]">Recents</p>
          </div>
        )}
        <div className="flex flex-col w-full pt-1">
          {isLoadingHistory ? (
            <div className="space-y-3 px-1 py-2">
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-40" />
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-20" />
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse opacity-10" />
            </div>
          ) : (!isGuest || chatHistory.length > 0) ? (
            <ChatHistory
              chatHistory={filteredHistory}
              activeChatId={activeChatId}
              onSelectChat={(id) => { onSelectChat(id); setActiveView('chat'); }}
              onDeleteChat={onDeleteChat}
              onRenameChat={onRenameChat}
            />
          ) : null}

          {/* Pagination Trigger - Hidden for guests */}
          {hasMore && !searchQuery.trim() && !isGuest && (
            <div className="px-1 py-4">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[11px] font-normal uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader size={14} />
                ) : (
                  <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                )}
                {isLoadingMore ? 'Loading...' : 'Load older sessions'}
              </button>
            </div>
          )}
        </div>

        {/* Empty State & Suggestions - integrated directly into the flow below the header */}
        {renderEmptyState()}
      </div>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingHistory || chatHistory.length > 0 || activeView !== 'history') return null;

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-0.5 select-none animate-fade-in py-8">
        {/* 1. Empty State Illustration - Hidden for guests */}
        {!isGuest && (
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center opacity-40 shadow-inner">
              <BookOpen size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
            </div>
          </div>
        )}

        <div className="text-center px-4 mb-8">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] opacity-80 mb-1">
            No Recents Found
          </h3>
          <p className="text-[11px] text-[var(--text-tertiary)] font-normal opacity-60">
            Your session history will appear here.
          </p>
        </div>

        <div className="w-full">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[var(--border-color)]" />
            <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--text-tertiary)] opacity-50 whitespace-nowrap">
              Ask a Question
            </span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[var(--border-color)]" />
          </div>

          {/* Scrollable Suggestions — Now available for all users */}
          <div className="w-full px-4">
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth snap-x">
              {[
                "Explain prefix sum in detail",
                "How does linear search work?",
                "Visualize bubble sort algorithm",
                "Explain sliding window technique",
                "The process of photosynthesis",
                "Core concepts of DSA",
                "Exploring the Solar system",
                "Step-by-step Binary search",
                "Quantum computing basics",
                "What is a Neural Network?",
                "How do Black Holes form?",
                "The Nitrogen cycle explained",
                "Introduction to React hooks"
              ].map((text, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrompt(text);
                    setTimeout(() => onSubmit(text), 10);
                  }}
                  className="snap-start flex-shrink-0 px-5 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all hover:scale-[1.03] active:scale-[0.97] hover:border-[var(--text-tertiary)]/30 shadow-sm"
                >
                  {text}
                </button>
              ))}
            </div>

            {/* Subtle scroll indicator hint */}
            <div className="flex justify-center mt-2 opacity-30">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const { isMobile } = useWindowSize();

  return (
    <div className={`flex flex-col h-full relative text-[var(--text-primary)] bg-transparent`}>

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <VisaiLogo size={isMobile ? "xs" : "xs"} className="text-[var(--text-primary)]" />
            <span
              className={`${isMobile ? 'text-[14px]' : 'text-[13px]'} font-normal uppercase tracking-[0.22em] text-[var(--text-primary)]`}
              style={{ letterSpacing: '0.22em', opacity: 0.9 }}
            >
              TutorBoard
            </span>
          </div>


            <button
              onClick={() => useTutorStore.getState().setMasteryOpen(true)}
              className={`${isMobile ? 'p-2.5' : 'p-2.5'} rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group`}
              title="Learner Dashboard"
            >
              <LayoutDashboard size={isMobile ? 22 : 20} strokeWidth={1.8} className="group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={() => setOverlay('settings')}
              className={`${isMobile ? 'p-2.5' : 'p-2.5'} rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group`}
              title="Open Settings"
            >
              <Settings size={isMobile ? 22 : 20} strokeWidth={1.8} className="group-hover:rotate-45 transition-transform" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`${isMobile ? 'p-2.5' : 'p-2.5'} rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group`}
              title="Close Workspace"
            >
              {isMobile ? <X size={24} strokeWidth={2} /> : <PanelLeftClose size={22} strokeWidth={1.8} className="group-hover:scale-110 transition-transform" />}
            </button>
          </div>

        {/* Top block visible only on landing/history */}
        {activeView !== 'chat' && (
          <div className={`${isMobile ? 'px-3 mb-4' : 'px-4 mb-6'}`}>
            <div className="flex flex-col gap-3">
              {/* Guest Trial Banner */}
              {isGuest && (
                <GuestTrialBanner />
              )}

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
                  <div className={`${isMobile ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-[var(--bg-primary)]/15 border border-white/10 flex items-center justify-center group-hover:rotate-90 transition-transform duration-500`}>
                    <Plus size={isMobile ? 16 : 14} strokeWidth={3} />
                  </div>
                  <span className={`${isMobile ? 'text-[13px]' : 'text-[13px]'} font-medium tracking-tight`}>New session</span>
                </div>

                {!isMobile && (
                  <div className="text-[10px] font-medium opacity-40 px-1.5 py-0.5 rounded-md border border-white/20 uppercase tracking-[0.1em] bg-white/5 group-hover:opacity-100 transition-opacity">
                    Alt N
                  </div>
                )}
              </button>

              {/* 2. Search (Integrated Command-style Search) — Show for guests if they have history */}
              {(!isGuest || chatHistory.length > 0) && (
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
                    className={`w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--text-tertiary)] ${isMobile ? 'rounded-xl pl-10 pr-9 py-2.5' : 'rounded-2xl pl-10 pr-10 py-2.5'} text-[13px] outline-none transition-all placeholder:text-[var(--text-tertiary)]/60 placeholder:font-normal shadow-sm`}
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
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className={`flex-1 flex flex-col min-h-0 ${activeView === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'} thin-scrollbar ${isMobile ? 'px-3' : 'px-4'} pt-0 pb-2 relative`}>


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
          onStopGeneration={onStopGeneration}
        />
      </div>
    </div>
  );
};

export default LeftPanel;
