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
  ChevronLeft, Lightbulb, HelpCircle, Activity, Layers, ChevronDown, Settings
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
          <div className="sticky top-0 bg-[var(--bg-primary)] z-10 pt-0 pb-2.5">
            <button
              onClick={() => { setActiveView('history'); }}
              className="flex items-center gap-1.5 px-0.5 py-1 text-[12px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors group"
            >
              <ChevronLeft size={14} strokeWidth={3.5} className="text-[12px] font-normal uppercase tracking-[0.15em] px-0.5 text-[var(--text-tertiary)]" />
              <p className="text-[12px] font-normal uppercase tracking-[0.15em] px-0.5 py-1 text-[var(--text-tertiary)]">All Sessions</p>
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
        <div className="sticky top-0 bg-[var(--bg-primary)] z-10 pt-0 pb-1">
          <p className="text-[10px] font-normal uppercase tracking-[0.15em] px-0.5 py-1 text-[var(--text-tertiary)]">Recents</p>
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
          <div className="flex flex-col items-center justify-center py-6 px-0.5 select-none animate-fade-in opacity-60 hover:opacity-100 transition-opacity duration-500">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-3 cursor-default"
            >
              <div className="absolute inset-0 bg-[var(--text-primary)] opacity-5 blur-2xl rounded-full" />
              <div className="relative w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)] border border-[var(--border-color)] shadow-inner opacity-40">
                <BookOpen size={20} strokeWidth={1.5} />
              </div>
            </motion.div>

            <div className="text-center space-y-1 mb-6">
              <h3 className="text-[10px] font-normal uppercase tracking-[0.25em] text-[var(--text-primary)]">
                No recents
              </h3>
              <p className="text-[9px] text-[var(--text-tertiary)] font-normal leading-relaxed">
                Your history is empty
              </p>
            </div>

            <div className="w-full mt-2">
              <div className="flex items-center gap-2.5 mb-4 px-2">
                <span className="text-[8px] font-normal uppercase tracking-[0.2em] text-[var(--text-tertiary)] whitespace-nowrap">
                  Try asking one
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--border-color)] to-transparent" />
              </div>

              <div className="relative overflow-hidden h-10 w-full mask-fade-x">
                <motion.div
                  className="flex gap-2.5 absolute whitespace-nowrap items-center h-full"
                  animate={{ x: [0, -1000] }}
                  transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                >
                  {[
                    "Explain me prefix sum",
                    "Explain linear search",
                    "Explain me bubble sort",
                    "Explain me about sliding window",
                    "Explain me the process of photosynthesis",
                    "On DSA",
                    "Solar system",
                    "Explain binary search",
                    "Explain me prefix sum",
                    "Explain linear search",
                    "Explain me bubble sort",
                    "Explain me about sliding window",
                    "Explain me the process of photosynthesis",
                    "On DSA",
                    "Solar system",
                    "Explain binary search",
                  ].map((text, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPrompt(text);
                        // SEC-14: Auto-submit suggestion for better UX
                        setTimeout(() => onSubmit(text), 10);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all hover:scale-[1.05] active:scale-[0.95] shadow-sm hover:shadow-md"
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

  // ── MAIN UNIFIED RETURN ──
  return (
    <div className="flex flex-col h-full text-[var(--text-primary)] bg-transparent">

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VisaiLogo size="xs" className="text-[var(--text-primary)]" />
            <span className="text-[16px] font-normal uppercase tracking-[0.25em] text-[var(--text-primary)]">
              TutorBoard
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setOverlay('settings')}
              className="p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group"
              title="Open Settings"
            >
              <Settings size={20} strokeWidth={2.5} className="group-hover:rotate-45 transition-transform" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group"
              title="Close Sidebar"
            >
              <PanelLeftClose size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Top block visible only on landing/history */}
        {activeView !== 'chat' && (
          <div className="px-4 mb-6">
            {/* Professional Action Console (Redesigned like InputBar) */}
            <div className="bg-[var(--bg-secondary)] rounded-[24px] border border-[var(--border-color)] overflow-hidden flex flex-col p-1.5 gap-1.5 transition-all duration-300">
              {/* 1. New Chat (Primary Action) */}
              <button
                onClick={() => { onNewChat(); setActiveView('chat'); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-[16px] font-normal bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[20px] hover:opacity-95 active:scale-[0.97] transition-all group"
              >
                <div className="p-1.5 bg-[var(--bg-primary)]/15 rounded-xl border border-transparent group-hover:border-[var(--bg-primary)]/20 transition-all">
                  <Plus size={16} strokeWidth={3.5} />
                </div>
                <span className="tracking-tight">New chat</span>
              </button>

              {/* 2. Search (Secondary Input-like Action) */}
              <button
                onClick={() => { setIsSearchOpen(v => !v); setSearchQuery(''); }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-[13px] font-normal rounded-[18px] transition-all active:scale-[0.98] group/search ${isSearchOpen ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <div className="p-1.5 text-[var(--text-tertiary)] group-hover/search:text-[var(--text-primary)] transition-colors">
                  <Search size={16} strokeWidth={2.5} className="group-hover/search:scale-110 transition-transform" />
                </div>
                <span className="tracking-tight">Search chats</span>
              </button>

              {/* 3. Mastery Dashboard (SPA Routing) */}
              <button
                onClick={() => { setActiveView?.('mastery'); navigate('/mastery'); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-[18px] transition-all active:scale-[0.98] group"
              >
                <div className="p-1.5 text-blue-500/70 group-hover:text-blue-500 transition-colors">
                  <Activity size={16} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="tracking-tight">Mastery Dashboard</span>
              </button>

              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="pt-1 px-1 overflow-hidden"
                  >
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Filter sessions..."
                      autoFocus
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--text-tertiary)] transition-all shadow-sm mb-1"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        )}
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-0 pb-6 min-h-0 relative">


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

      <ToastContainer />

    </div>
  );
};

export default LeftPanel;
