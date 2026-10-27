/**
 * ChatWindow.jsx — TutorBoard AI OS v1.0
 * Next-generation AI workspace chat engine.
 *
 * Features:
 * - Premium AI workspace welcome screen with smart suggestions
 * - Phase-aware thinking indicator (Thinking → Searching → Generating)
 * - Smooth token streaming with animated cursor
 * - Inline artifact cards
 * - Scroll-to-bottom pill
 * - Error recovery cards
 * - Zero layout shift during streaming
 */

import React, { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react';
import Message from './Message';
import ThoughtLine from './ThoughtLine';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown, AlertCircle, RotateCcw, RefreshCw, WifiOff, Zap, X,
  Shapes, FileText, Lightbulb, Pen
} from 'lucide-react';
import SkeletonMessage from './SkeletonMessage';
import { useAuth } from '../../hooks/useAuth';
import { findQuote } from '../../utils/quoteUtils';
import { extractCleanText } from '../../utils/mathTextUtils';
import useTutorStore from '../../store/tutorStore';
import VisaiLogo from '../layout/VisaiLogo';
import ErrorBoundary from '../common/ErrorBoundary';
import { describeChatError } from '../../lib/chatErrors';
import { describeProgress } from '../../lib/requestProgress';

const MessageErrorFallback = () => (
  <div
    role="note"
    className="my-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
    style={{ background: 'var(--st-fill, var(--bg-secondary))', color: 'var(--text-secondary)' }}
  >
    <AlertCircle size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
    This message couldn't be displayed. Reload the conversation to try again.
  </div>
);



/* =============================================================================
   WELCOME SCREEN -- AI Workspace Landing
   ============================================================================= */
// Prompt starters. Only "Draw a diagram" switches the mode, because drawing on
// the canvas is the one mode that changes how the answer is made.
const SUGGESTION_CHIPS = [
  { label: 'Explain something', icon: Lightbulb, prompt: 'Explain ' },
  { label: 'Draw on canvas', icon: Shapes, prompt: 'Draw a diagram of ', mode: 'deep' },
  { label: 'Summarize text', icon: FileText, prompt: 'Summarize: ' },
  { label: 'Help me write', icon: Pen, prompt: 'Help me write ' },
];

const ChatLanding = ({ onSuggestionClick }) => {
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const nickname = user?.settings?.general?.nickname || (typeof window !== 'undefined' ? sessionStorage.getItem('tb-nickname') : null);
  const firstName = nickname || (user?.isGuest ? '' : (user?.name?.split(' ')[0] || ''));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex w-full flex-1 select-none flex-col justify-center px-1 pb-4 text-[var(--text-primary)]"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="px-2"
      >
        <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-tertiary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />
          New session
        </div>
        <h2 className="mt-3 text-[20px] font-[450] leading-[1.15] tracking-[-0.03em]">
          {greeting}{firstName ? `, ${firstName}` : ''}.
          <span className="block text-[var(--text-tertiary)]">Pick a way to start, or just ask.</span>
        </h2>
      </motion.div>

      <ul className="mt-5 flex flex-col">
        {SUGGESTION_CHIPS.map((chip, i) => (
          <motion.li
            key={chip.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 + i * 0.05 }}
          >
            <button
              onClick={() => onSuggestionClick?.(chip.prompt, chip.mode)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--st-fill)] active:scale-[0.99]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
                <chip.icon size={15} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">
                {chip.label}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
};

/* =============================================================================
   ERROR CARD -- Inline error recovery
   ============================================================================= */
const ErrorCard = ({ error, onRetry, onDismiss }) => {
  const info = describeChatError(error);
  // Avoid loud blues/purples and radium colors; use tasteful, subtle warm neutral/amber/rose palette
  const isWarning = info.tone === 'amber';
  const isCritical = info.tone === 'red';

  const Icon = info.tone === 'blue' ? WifiOff : isWarning ? Zap : AlertCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      role="alert"
      className="group relative my-2.5 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-[var(--text-primary)] shadow-sm"
      style={{
        backgroundColor: 'var(--st-fill, var(--bg-secondary))',
        borderColor: isCritical 
          ? 'rgba(239, 68, 68, 0.3)' 
          : isWarning 
            ? 'rgba(217, 119, 6, 0.28)' 
            : 'var(--st-line-strong, var(--border-color))',
      }}
    >
      {/* Absolute Top-Right Dismiss Button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-color)]"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      )}

      <div className="flex items-start gap-2.5 pr-6">
        {/* Subtle, desaturated icon container */}
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]"
          aria-hidden="true"
        >
          <Icon size={14} strokeWidth={2} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className="text-[12.5px] font-semibold text-[var(--text-primary)] tracking-tight leading-snug">
            {info.title}
          </h4>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
            {info.desc}
          </p>

          {onRetry && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-primary)] border border-[var(--border-color)] transition-colors shadow-none"
              >
                <RotateCcw size={11} strokeWidth={2} aria-hidden="true" />
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* =============================================================================
   CHAT WINDOW -- Main Component
   ============================================================================= */
const ChatWindow = ({
  messages,
  isGenerating,
  onOpenCanvas,
  onDeleteMessage,
  onEditMessage,
  onRegenerateMessage,
  onFeedback,
  onSwitchVersion,
  onOpenArtifact,
  onSubmit,
  activeMode,
  setActiveMode,
  onUndoMessage,
}) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const userScrolledRef = useRef(true); // following the newest message? (only after the learner asks)
  const [showPill, setShowPill] = useState(false);

  const currentSessionId = useTutorStore((s) => s.getSid());
  const currentSessionState = useTutorStore(s => s.sessionStates[currentSessionId]);
  const currentCanvasType = useTutorStore((s) => s.currentCanvasType);

  const isStreaming = currentSessionState?.isStreaming;
  const currentStreamingContent = currentSessionState?.content || '';
  const currentStreamingThought = currentSessionState?.thought || '';
  const currentStreamingMessageId = currentSessionState?.messageId;
  const currentStreamingSources = currentSessionState?.sources || [];
  const currentSearchPerformed = currentSessionState?.searchPerformed || false;
  const isWaitingForAI = currentSessionState?.isWaitingForAI;
  const waitingSessionId = useTutorStore((s) => s.waitingSessionId);
  const lastAIError = useTutorStore((s) => s.lastAIError);
  const isMessagesLoading = useTutorStore((s) => s.isMessagesLoading);
  const currentProgress = currentSessionState?.progress || null;

  const isCurrentlyStreaming = isStreaming;
  const isCurrentlyWaiting = (isWaitingForAI && waitingSessionId === currentSessionId) || isGenerating;
  const isActive = isCurrentlyStreaming || isCurrentlyWaiting;

  // An error belongs to the conversation it happened in — never show it in another one.
  const visibleError = lastAIError && (!lastAIError.sessionId || lastAIError.sessionId === currentSessionId) ? lastAIError : null;

  const isEmpty =
    (messages || []).length === 0 && !isCurrentlyWaiting && !isCurrentlyStreaming && !visibleError && !isMessagesLoading;

  const streamingInList = (messages || []).some((m) => m.id === currentStreamingMessageId);

  const emptyArray = useMemo(() => [], []);
  const emptyHover = useCallback(() => {}, []);

  /* ── Scroll management ── */
  const countRef = useRef(0);
  const virtualizerRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef(null);
  const scrollRAFRef = useRef(null);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const dist = scrollHeight - scrollTop - clientHeight;
    const nearBottom = dist < 80;

    // Ignore smooth auto-scrolling events to prevent premature manual scroll override
    if (isAutoScrollingRef.current) {
      if (nearBottom) {
        isAutoScrollingRef.current = false;
        userScrolledRef.current = false;
        setShowPill(false);
      }
      return;
    }

    userScrolledRef.current = !nearBottom;
    setShowPill(!nearBottom);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Explicit intent to read back: stop following the stream right away. The
    // scroll event alone can't tell (auto-scroll fires it every frame while an
    // answer streams), which used to snap the learner back to the bottom.
    const leaveBottom = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 2 && el.scrollTop === 0) return; // nothing to scroll
      isAutoScrollingRef.current = false;
      userScrolledRef.current = true;
      setShowPill(true);
    };
    const onWheel = (e) => { if (e.deltaY < 0) leaveBottom(); };
    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e) => {
      const y = e.touches[0]?.clientY;
      if (touchY != null && y != null && y - touchY > 4) leaveBottom(); // finger moves down = content scrolls up
    };
    const onKey = (e) => { if (['PageUp', 'ArrowUp', 'Home'].includes(e.key)) leaveBottom(); };
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKey);
    };
  }, [handleScroll]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);

    scrollRAFRef.current = requestAnimationFrame(() => {
      scrollRAFRef.current = null;
      const el = containerRef.current;
      if (!el) return;

      const count = countRef.current;
      const virt = virtualizerRef.current;

      isAutoScrollingRef.current = true;
      userScrolledRef.current = false;
      setShowPill(false);

      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, behavior === 'smooth' ? 1000 : 100);

      if (count > 0 && virt) {
        try {
          // Leverage TanStack Virtualizer's highly optimized scroll engine which naturally 
          // supports hardware acceleration and absorbs dynamic measurement reflows smoothly
          virt.scrollToIndex(count - 1, { align: 'end', behavior });
        } catch (e) {
          // Safe fallback
          el.scrollTo({ top: el.scrollHeight, behavior });
        }
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior });
      }

      // Guarantee absolute bottom boundary alignment after layout expansion settles
      setTimeout(() => {
        if (containerRef.current && !userScrolledRef.current) {
          const cel = containerRef.current;
          // Only snap if extremely close to bottom to maintain smoothness
          if (cel.scrollHeight - cel.scrollTop - cel.clientHeight < 150) {
            cel.scrollTop = cel.scrollHeight - cel.clientHeight;
          }
        }
      }, behavior === 'smooth' ? 600 : 80);
    });
  }, []);

  // The chat moves on its own only for a request the learner just started:
  // opening a chat, opening / closing a lesson or the canvas never scrolls it.
  //  - opening a chat: it is shown where it begins, nothing auto-scrolls (the
  //    scroll-down button offers the latest); it used to jump to the top and
  //    then scroll itself down for ~1.5 s
  //  - a request starts here (send, retry, regenerate, edit): scroll to it and
  //    follow its answer while it streams, unless the learner scrolls away
  // A new chat's id is replaced by the server's mid-request: that is not
  // "opening a chat" (it is still active), so the answer keeps being followed.
  const wasActiveRef = useRef(isActive);
  useLayoutEffect(() => {
    if (isActive) return;
    userScrolledRef.current = true; // not following anything
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      const c = containerRef.current;
      setShowPill(!!c && c.scrollHeight - c.clientHeight > 80);
    });
    return () => cancelAnimationFrame(raf);
    // only when the conversation on screen changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  useEffect(() => {
    const started = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (started) {
      userScrolledRef.current = false;
      scrollToBottom('smooth');
    }
  }, [isActive, scrollToBottom]);

  const lastMessage = (messages || []).length > 0 ? messages[messages.length - 1] : null;
  const lastMessageContent = lastMessage?.content || '';

  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom(isCurrentlyStreaming ? 'auto' : 'smooth');
    }
  }, [messages.length, lastMessageContent, currentStreamingContent, isCurrentlyWaiting, isCurrentlyStreaming, scrollToBottom]);

  // #17: List Virtualization for large histories
  const showStreamingNew = isCurrentlyStreaming && !streamingInList && (currentStreamingContent || currentStreamingThought || currentStreamingSources?.length > 0 || currentCanvasType);
  const virtualItemsCount = messages.length + (showStreamingNew ? 1 : 0);
  
  const rowVirtualizer = useVirtualizer({
    count: virtualItemsCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 70,
    overscan: 5,
  });

  countRef.current = virtualItemsCount;
  virtualizerRef.current = rowVirtualizer;

  // #20: ARIA Live Announcements for accessibility
  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncedRef = useRef('');
  
  useEffect(() => {
    if (!currentStreamingContent) return;
    if (currentStreamingContent.length - lastAnnouncedRef.current.length > 100) {
      setAnnouncement(currentStreamingContent.slice(-150));
      lastAnnouncedRef.current = currentStreamingContent;
    }
  }, [currentStreamingContent]);

  // Before the answer row exists: the status the server has reported so far
  const waitingView = useMemo(
    () => describeProgress(currentProgress, { hasText: Boolean(currentStreamingContent) }),
    [currentProgress, currentStreamingContent]
  );

  const handleSuggestionClick = useCallback((prompt, mode) => {
    if (mode) setActiveMode(mode);
    useTutorStore.getState().setChatInputText?.(prompt);
  }, [setActiveMode]);

  // Support jumping directly to a quoted message from sticky notes or references
  useEffect(() => {
    const handleScrollToQuote = (e) => {
      const { messageId, quote } = e.detail || {};
      if (!quote) return;

      userScrolledRef.current = true; // prevent auto-scroll from overriding

      // Find index in messages array
      let targetIdx = -1;
      if (messageId) {
        targetIdx = (messages || []).findIndex((m) => String(m.id) === String(messageId));
      }

      const cleanQ = quote.replace(/^[“"']+|[”"'.…\s]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

      if (targetIdx === -1 && cleanQ) {
        // Try progressively smaller prefixes of cleanQ down to 15 chars
        const searchLengths = [120, 80, 50, 30, 20, 15];
        for (const len of searchLengths) {
          const needle = cleanQ.slice(0, len);
          if (needle.length < 10) continue;
          targetIdx = (messages || []).findIndex((m) =>
            (m.content || '').replace(/\s+/g, ' ').toLowerCase().includes(needle)
          );
          if (targetIdx !== -1) break;
        }

        // Fallback: match by significant words
        if (targetIdx === -1) {
          const words = cleanQ.split(/\s+/).filter((w) => w.length > 4);
          if (words.length > 0) {
            targetIdx = (messages || []).findIndex((m) => {
              const text = (m.content || '').toLowerCase();
              return words.filter((w) => text.includes(w)).length >= Math.min(3, words.length);
            });
          }
        }
      }

      const tryFlashRange = () => {
        let candidateScopes = [];
        if (messageId) {
          const msgEl = document.querySelector(`[data-message-id="${CSS.escape(String(messageId))}"]`);
          if (msgEl) {
            candidateScopes = [msgEl.querySelector('.markdown-content') || msgEl];
          }
        }
        if (candidateScopes.length === 0 && targetIdx !== -1) {
          const rowEl = document.querySelector(`[data-message-index="${targetIdx}"]`);
          if (rowEl) {
            candidateScopes = [rowEl.querySelector('.markdown-content') || rowEl];
          }
        }
        if (candidateScopes.length === 0) {
          candidateScopes = Array.from(document.querySelectorAll('.markdown-content'));
        }

        for (const scope of candidateScopes) {
          const range = findQuote(scope, quote);
          if (range) {
            if (typeof CSS !== 'undefined' && 'highlights' in CSS && typeof window !== 'undefined' && 'Highlight' in window) {
              const hl = new window.Highlight(range);
              CSS.highlights.set('tb-source-flash', hl);
              setTimeout(() => CSS.highlights.delete('tb-source-flash'), 3000);
            }
            // Ensure the exact node is scrolled into center view
            try {
              const node = range.startContainer.parentElement;
              if (node && typeof node.scrollIntoView === 'function') {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            } catch {
              /* ignore scrollIntoView error */
            }
            return true;
          }
        }
        return false;
      };

      if (targetIdx !== -1 && virtualizerRef.current) {
        virtualizerRef.current.scrollToIndex(targetIdx, { align: 'center', behavior: 'smooth' });
        // Attempt flash over multiple ticks as virtual DOM renders
        [100, 250, 450, 700].forEach((delay) => {
          setTimeout(() => {
            tryFlashRange();
          }, delay);
        });
      } else {
        [50, 200, 400].forEach((delay) => {
          setTimeout(() => {
            tryFlashRange();
          }, delay);
        });
      }
    };

    window.addEventListener('scroll-to-quote', handleScrollToQuote);
    return () => window.removeEventListener('scroll-to-quote', handleScrollToQuote);
  }, [messages]);

  return (
    <div className="chat-window-wrapper flex-1 flex flex-col min-h-0 relative">
      <div
        ref={containerRef}
        className="chat-window flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar"
        role="log"
        aria-label="Chat messages"
        style={{ paddingRight: 0 }}
        onCopy={(e) => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const container = range.cloneContents();
            if (container.querySelector('.katex')) {
              const text = extractCleanText(range);
              if (text) {
                e.clipboardData.setData('text/plain', text);
                e.preventDefault();
              }
            }
          }
        }}
      >
        <AnimatePresence mode="wait">
          {isMessagesLoading ? (
            <div key="loading" className="flex-1 flex items-center justify-center min-h-[200px]">
              <div className="flex flex-col items-center gap-4">
                <VisaiLogo className="animate-pulse opacity-20" size={48} />
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]/20"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : isEmpty ? (
            <ChatLanding key="empty" onSuggestionClick={handleSuggestionClick} />
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative"
              style={{
                // one reading column for messages, thinking and errors
                maxWidth: 760,
                margin: '8px auto 0',
                width: '100%',
                height: `${rowVirtualizer.getTotalSize()}px`,
                // The rows are absolutely positioned, so this flex item has no
                // content height of its own: without this the column scroller
                // shrank it, the last messages overflowed under the thinking /
                // error rows, and the chat could not scroll to its end.
                flexShrink: 0,
              }}
            >
              <div className="sr-only" aria-live="polite" aria-atomic="false">
                {announcement}
              </div>

              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isLast = virtualRow.index === messages.length;
                
                if (isLast && showStreamingNew) {
                  return (
                    <div
                      key="streaming-new"
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="px-0 sm:px-0.5"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <ErrorBoundary fallback={<MessageErrorFallback />}>
                        <Message
                          isLatest
                          role="assistant"
                          content={currentStreamingContent}
                          messageId={currentStreamingMessageId}
                          timestamp={new Date().toISOString()}
                          isStreaming
                          isSessionActive={isActive}
                          streamingContent={currentStreamingContent}
                          streamingThought={currentStreamingThought}
                          streamingSources={currentStreamingSources}
                          streamingProgress={currentProgress}
                          canvasType={currentCanvasType}
                          metadata={{
                            hasVisualArtifact: !!currentCanvasType,
                            rendererType: currentCanvasType,
                            artifactStatus: 'generating'
                          }}
                          isSearchPerformed={currentSearchPerformed}
                          onOpenArtifact={onOpenArtifact}
                          showCursor
                        />
                      </ErrorBoundary>
                    </div>
                  );
                }

                const msg = messages[virtualRow.index];
                if (!msg) return null;
                
                const msgKey = msg.id || `msg-${msg.role}-${msg.timestamp}`;
                const isThisStreaming = isCurrentlyStreaming && currentStreamingMessageId === msg.id;

                return (
                  <div 
                    key={msgKey} 
                    data-index={virtualRow.index}
                    data-message-index={virtualRow.index}
                    data-message-id={msg.id}
                    ref={rowVirtualizer.measureElement}
                    className="px-0 sm:px-0.5"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ErrorBoundary fallback={<MessageErrorFallback />}>
                      <Message
                        isLatest={virtualRow.index === messages.length - 1 && !showStreamingNew}
                        role={msg.role}
                        content={msg.content}
                        messageId={msg.id}
                        timestamp={msg.timestamp}
                        status={msg.status}
                        metadata={msg.metadata}
                        isStreaming={isThisStreaming}
                        isSessionActive={isActive}
                        streamingContent={isThisStreaming ? currentStreamingContent : ""}
                        streamingThought={isThisStreaming ? currentStreamingThought : ""}
                        streamingMessageId={currentStreamingMessageId}
                        onOpenCanvas={onOpenCanvas}
                        onDeleteMessage={onDeleteMessage}
                        onEditMessage={onEditMessage}
                        onRegenerateMessage={onRegenerateMessage}
                        onFeedback={onFeedback}
                        onSwitchVersion={onSwitchVersion}
                        onOpenArtifact={onOpenArtifact}
                        steps={msg.steps}
                        stepTitle={msg.stepTitle}
                        domain={msg.domain}
                        visualizationType={msg.visualizationType}
                        elements={msg.elements || msg.objects}
                        motion={msg.motion}
                        connections={msg.connections}
                        sequence={msg.sequence}
                        objects={msg.objects || msg.elements}
                        hasCanvas={msg.hasCanvas || !!(msg.elements?.length || msg.objects?.length || msg.steps?.length)}
                        canvasType={msg.canvasType}
                        isSearchPerformed={isThisStreaming ? currentSearchPerformed : false}
                        streamingSources={isThisStreaming ? currentStreamingSources : emptyArray}
                        streamingProgress={isThisStreaming || (isActive && currentStreamingMessageId === msg.id) ? currentProgress : null}
                        showCursor={isThisStreaming}
                        onHover={emptyHover}
                        onUndoMessage={onUndoMessage}
                      />
                    </ErrorBoundary>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

          <div className="mx-auto w-full max-w-[760px] shrink-0 px-0 sm:px-0.5 mt-0.5">
          <AnimatePresence mode="wait">
            {(isCurrentlyWaiting || isCurrentlyStreaming) && !streamingInList && !showStreamingNew && (
              <div className="py-1">
                <ThoughtLine
                  key="thinking"
                  working={waitingView.active}
                  steps={waitingView.stages}
                  label={waitingView.label || 'Getting started…'}
                  fontSize={14}
                  collapsible
                />
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {visibleError && (
              <ErrorCard
                key="error"
                error={visibleError}
                onDismiss={() => useTutorStore.setState({ lastAIError: null })}
                onRetry={
                  // Re-send the SAME request (same requestId): the server re-uses the
                  // saved user message, so a retry never duplicates it.
                  visibleError.retry && onSubmit
                    ? () => onSubmit(visibleError.retry.text, null, null, false, null, null, visibleError.retry)
                    : visibleError.messageId
                      ? () => onRegenerateMessage(visibleError.messageId)
                      : null
                }
              />
            )}
          </AnimatePresence>
          </div>

          <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {/* Premium High-Fidelity Scroll to Bottom Button */}
      <AnimatePresence>
        {showPill && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => {
              // Deterministic solid multi-pass scroll alignment to guarantee hitting absolute end perfectly
              scrollToBottom('smooth');
            }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-10 h-10 rounded-full border shadow-premium transition-all hover:scale-110 active:scale-95 select-none backdrop-blur-md group"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={18} strokeWidth={2.5} className="transition-transform group-hover:translate-y-0.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWindow;
