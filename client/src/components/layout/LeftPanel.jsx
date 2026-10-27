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
  FileText, Download, Sparkles, ArrowUpRight, Undo2
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
  undoConfirmModal,
  setUndoConfirmModal,
  executeConfirmedUndo,
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
    // guests page through their history too: hiding older pages made their chats look deleted
    if (!node || !hasMore || isLoadingMore || searchQuery.trim()) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onLoadMore?.();
      }
    }, { threshold: 0.1 });

    observerRef.current.observe(node);
  }, [hasMore, isLoadingMore, searchQuery, onLoadMore]);

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
      // a conversation with no question in it (e.g. every message undone) is not listed
      // (entries restored from the local cache carry no messages: they stay listed)
      if (Array.isArray(s.messages) && s.messages.length > 0 && !s.messages.some((m) => m?.role === 'user')) return;
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
          <div className={`sticky top-0 z-[15] -mx-1 flex items-center justify-between border-b border-[var(--st-line)] bg-[var(--bg-primary)] px-1 ${isMobile ? 'mb-2.5 pb-2.5 pt-2' : 'mb-3 pb-3 pt-2'}`}>
            <button
              onClick={() => {
                setActiveView('history');
                const store = useTutorStore.getState();
                store.setCanvasLayout('inline');
                store.closeCanvasLayout();
                store.setActiveSnapshotId(null);
                store.clearArtifacts();
              }}
              className="group inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <ChevronLeft size={15} strokeWidth={2.2} className="transition-transform group-hover:-translate-x-0.5" />
              <span>Sessions</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onExport?.('pdf')}
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill)]/50 text-[var(--text-secondary)] transition-all hover:bg-[var(--st-fill-strong)] hover:border-[var(--st-line-strong)] hover:text-[var(--text-primary)] active:scale-95"
                title="Export as PDF"
                aria-label="Export as PDF"
              >
                <FileText size={14} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => onExport?.('docx')}
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill)]/50 text-[var(--text-secondary)] transition-all hover:bg-[var(--st-fill-strong)] hover:border-[var(--st-line-strong)] hover:text-[var(--text-primary)] active:scale-95"
                title="Export as Word (.docx)"
                aria-label="Export as Word (.docx)"
              >
                <Download size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 pt-0 -mx-1">
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
          ) : (
            <ChatHistory
              chatHistory={filteredHistory}
              activeChatId={activeChatId}
              onSelectChat={(id) => { onSelectChat(id); setActiveView('chat'); }}
              onDeleteChat={onDeleteChat}
              onRenameChat={onRenameChat}
            />
          )}

          {/* Pagination trigger: older conversations load as the list is scrolled */}
          {hasMore && !searchQuery.trim() && (
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
    <div className={`flex flex-col h-full relative text-[var(--text-primary)] bg-transparent min-w-[280px] overflow-hidden`}>

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className={`${isMobile ? 'px-4 pb-1.5 pt-[max(env(safe-area-inset-top),8px)]' : 'px-5 pb-4 pt-5'} flex items-center justify-between`}>
          <BrandLockup />


          <div className="-mr-1 flex items-center gap-1">
            <button
              onClick={() => setOverlay('settings')}
              className={`grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95`}
              title="Settings"
              aria-label="Open settings"
            >
              <Settings size={isMobile ? 20 : 19} strokeWidth={1.9} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95`}
              title="Close workspace"
              aria-label="Close workspace"
            >
              <PanelLeftClose size={isMobile ? 20 : 19} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        {/* Top block visible only on landing/history */}
        {activeView !== 'chat' && (
          <div className={`${isMobile ? 'px-4 mb-2.5' : 'px-5 mb-3'}`}>
            <div className={isMobile ? 'flex items-center gap-2' : 'flex flex-col gap-2'}>
              <button
                onClick={() => {
                  onNewChat();
                  setActiveView('chat');
                }}
                className={`group flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm ${
                  isMobile
                    ? 'h-9.5 px-4 shrink-0 text-[13px]'
                    : 'h-9.5 w-full px-4 text-[13.5px]'
                }`}
              >
                <Plus size={16} strokeWidth={2.2} className="transition-transform duration-300 group-hover:rotate-90 shrink-0" />
                <span className="tracking-[-0.01em]">New session</span>
                {!isMobile && <kbd className="ml-auto font-mono text-[10px] tracking-[0.06em] opacity-50">Alt N</kbd>}
              </button>

              <div className={`relative ${isMobile ? 'flex-1 min-w-0' : 'w-full'}`}>
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isMobile ? 'Search...' : 'Search sessions'}
                  aria-label="Search sessions"
                  className={`w-full rounded-full border border-[var(--st-line-strong)] bg-transparent pl-9 pr-8 text-[13px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-tertiary)] focus:border-[var(--text-secondary)] focus:shadow-[0_0_0_2px_var(--st-line)] ${
                    isMobile ? 'h-9.5' : 'h-9.5'
                  }`}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {searchQuery ? (
                    <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]">
                      <X size={13} strokeWidth={2} />
                    </button>
                  ) : !isMobile && (
                    <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-[var(--st-line-strong)] px-1 font-mono text-[10px] text-[var(--text-tertiary)]">/</kbd>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* ── Undo Confirmation Overlay (Contained on Left Panel) ── */}
      <AnimatePresence>
        {undoConfirmModal && (
          <motion.div
            key="undo-modal-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 pointer-events-auto select-none"
            onClick={() => setUndoConfirmModal?.(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] rounded-[22px] border p-4 shadow-2xl relative flex flex-col gap-2.5"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-[var(--st-fill-strong)] text-[var(--text-primary)]">
                    <Undo2 size={13} strokeWidth={2} />
                  </div>
                  <h3 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Restore to chat box?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUndoConfirmModal?.(null)}
                  className="p-1 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label="Close"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Subtitle description */}
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Restoring request might loose your response{undoConfirmModal.affectedCount > 1 ? `, and roll back ${undoConfirmModal.affectedCount - 1} subsequent message${undoConfirmModal.affectedCount - 1 > 1 ? 's' : ''}` : ''}.
              </p>

              {/* Question preview */}
              {undoConfirmModal.content && (
                <div
                  className="rounded-xl px-2.5 py-1.5 text-[11.5px] leading-relaxed border italic line-clamp-2"
                  style={{
                    background: 'var(--st-fill, var(--bg-primary))',
                    borderColor: 'var(--st-line, var(--border-color))',
                    color: 'var(--text-secondary)'
                  }}
                >
                  "{undoConfirmModal.content}"
                </div>
              )}

              {/* Footer Controls */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setUndoConfirmModal?.(null)}
                  className="rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedUndo}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-1 font-semibold text-[11.5px] transition-all active:scale-95 shadow-sm hover:opacity-90"
                  style={{
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)'
                  }}
                >
                  <Undo2 size={11} strokeWidth={2.4} />
                  <span>Restore to chat box</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeftPanel;
