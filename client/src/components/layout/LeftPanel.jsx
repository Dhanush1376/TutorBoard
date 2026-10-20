import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  FileText, Download, Sparkles, ArrowUpRight
} from 'lucide-react';
import Loader from './Loader';
import BrandLockup from './BrandLockup';
import useWindowSize from '../../hooks/useWindowSize';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../common/ErrorBoundary';


const STARTERS = [
  { subject: 'Earth science', q: 'Why do we have seasons?' },
  { subject: 'Biology', q: 'How does photosynthesis work?' },
  { subject: 'History', q: 'What caused the French Revolution?' },
  { subject: 'Economics', q: 'Why do prices rise when supply drops?' },
];

const iconBtn =
  'grid h-9 w-9 place-items-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)] active:scale-95';

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
  isSplitView = false,
  onUndoMessage,
}) => {
  const { isMobile } = useWindowSize();
  const navigate = useNavigate();
  const { setSidebarOpen, layoutView, setOverlay } = useTutorStore();
  const { user } = useAuth();
  const isGuest = !!user?.isGuest;
  const hasStarted = (messages || []).length > 0;
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const loaderRef = useRef(null);

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

  // SEC-48: Use a callback ref for infinite scroll to ensure reliable observation
  const observerRef = useRef(null);
  const loaderCallbackRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !hasMore || isLoadingMore || searchQuery.trim() || isGuest) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onLoadMore?.();
      }
    }, { threshold: 0.1 });

    observerRef.current.observe(node);
  }, [hasMore, isLoadingMore, searchQuery, isGuest, onLoadMore]);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const filteredHistory = useMemo(() => {
    const base = searchQuery.trim()
      ? chatHistory.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
      : chatHistory;

    // SEC-UX-05: Deduplicate by ID and sort by latest activity
    const unique = [];
    const seen = new Set();

    [...base].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(s => {
      const sid = s.id || s._id;
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      unique.push(s);
    });

    return unique;
  }, [chatHistory, searchQuery]);

  // ── RENDER HELPERS ──
  const renderScrollContent = () => {
    if (activeView === 'chat') {
      return (
        <div className="flex flex-col gap-2 relative h-full">
          <div className="sticky top-0 z-[15] -mx-1 mb-2 flex items-center justify-between border-b border-[var(--st-line)] bg-[var(--bg-primary)] px-1 pb-2.5 pt-2">
            <button
              onClick={() => { setActiveView('history'); }}
              className="group inline-flex h-8 cursor-pointer items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={16} strokeWidth={1.8} className="transition-transform group-hover:-translate-x-0.5" />
              Sessions
            </button>

            <div className="flex items-center gap-0.5">
              <button onClick={() => onExport?.('pdf')} className={`${iconBtn} h-8 w-8`} title="Export as PDF" aria-label="Export as PDF">
                <FileText size={15} strokeWidth={1.8} />
              </button>
              <button onClick={() => onExport?.('docx')} className={`${iconBtn} h-8 w-8`} title="Export as Word" aria-label="Export as Word">
                <Download size={15} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 pt-0">
            <ErrorBoundary>
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
                onSubmit={onSubmit}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                onUndoMessage={onUndoMessage}
              />
            </ErrorBoundary>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0 w-full relative h-full">
        <div className="flex flex-col w-full pt-3">
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
            <div ref={loaderCallbackRef} className="w-full px-1 py-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 opacity-40">
                <Loader size={16} fullScreen={false} />
                {/* Subtle pulse circles instead of text — Premium Zen Minimalist */}
                <div className="flex gap-1.5 mt-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]"
                    />
                  ))}
                </div>
              </div>
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
      <div className="flex flex-1 select-none flex-col justify-end px-1 pb-3 pt-2">
        <div className="px-2 text-[12.5px] text-[var(--text-tertiary)]">Try asking</div>

        <ul className="mt-1.5 flex flex-col">
          {STARTERS.map((s, i) => (
            <motion.li
              key={s.q}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 + i * 0.05 }}
            >
              <button
                onClick={() => {
                  setPrompt(s.q);
                  setTimeout(() => onSubmit(s.q), 10);
                }}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--st-fill)]"
              >
                <span className="min-w-0 flex-1 truncate text-[14px] tracking-[-0.01em] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">{s.q}</span>
                <ArrowUpRight size={15} strokeWidth={1.8} className="shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    );
  };


  return (
    <div className={`flex flex-col h-full relative text-[var(--text-primary)] bg-transparent min-w-[280px]`}>

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className={`${isMobile ? 'px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)]' : 'px-5 pb-4 pt-5'} flex items-center justify-between`}>
          <BrandLockup />


          <div className="-mr-1.5 flex items-center gap-0.5">
            <button onClick={() => setOverlay('settings')} className={iconBtn} title="Settings" aria-label="Open settings">
              <Settings size={18} strokeWidth={1.7} />
            </button>
            <button onClick={() => setSidebarOpen(false)} className={iconBtn} title="Close workspace" aria-label="Close workspace">
              <PanelLeftClose size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>

        {/* Top block visible only on landing/history */}
        <div className={`${isMobile ? 'px-4 mb-2' : 'px-5 mb-3'}`}>
          <div className="flex flex-col gap-2">

            {activeView !== 'chat' && (
              <>
                <button
                  onClick={() => {
                    onNewChat();
                    setActiveView('chat');
                  }}
                  className="group flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--text-primary)] px-3 text-[var(--bg-primary)] transition-opacity hover:opacity-90 active:scale-[0.99]"
                >
                  <Plus size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:rotate-90" />
                  <span className="flex-1 text-left text-[13.5px] font-medium tracking-[-0.01em]">New session</span>
                  {!isMobile && <kbd className="font-mono text-[10px] tracking-[0.06em] opacity-50">Alt N</kbd>}
                </button>

                <div className="relative">
                  <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search sessions"
                    aria-label="Search sessions"
                    className="h-10 w-full rounded-xl border border-[var(--st-line-strong)] bg-transparent pl-9 pr-9 text-[13.5px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus:border-[var(--text-secondary)] focus:shadow-[0_0_0_3px_var(--st-line)]"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {searchQuery ? (
                      <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="grid h-6 w-6 place-items-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]">
                        <X size={13} strokeWidth={2} />
                      </button>
                    ) : !isMobile && (
                      <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-[var(--st-line-strong)] px-1 font-mono text-[10px] text-[var(--text-tertiary)]">/</kbd>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className={`flex-1 flex flex-col min-h-0 ${activeView === 'chat' || (activeView === 'history' && chatHistory.length === 0) ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} thin-scrollbar ${isMobile ? 'px-4' : 'px-5'} pt-0 pb-2 relative`}>


        {/* List content (Messages OR History + Suggestions) */}
        {renderScrollContent()}
      </div>

      {/* ─── 3. FIXED BOTTOM SECTION ─── */}
      <div className="flex-shrink-0 w-full relative z-50">
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
