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

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Message from './Message';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown, AlertCircle, RotateCcw, RefreshCw, WifiOff, Zap,
  BarChart3, FileText, Lightbulb, Pen
} from 'lucide-react';
import SkeletonMessage from './SkeletonMessage';
import { useAuth } from '../../hooks/useAuth';
import useTutorStore from '../../store/tutorStore';
import VisaiLogo from '../layout/VisaiLogo';
import ErrorBoundary from '../common/ErrorBoundary';
import { describeChatError } from '../../lib/chatErrors';

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
   THINKING INDICATOR -- Orbital pulse with phase label
   ============================================================================= */
const ThinkingIndicator = ({ phase, progress }) => {
  const reduceMotion = useReducedMotion();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // A long lesson can take a while: say so instead of spinning silently
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const label = progress || ({
    waiting: 'Thinking',
    searching: 'Searching the web',
    generating: 'Writing',
    thinking: 'Reasoning',
  }[phase] || 'Thinking');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-2.5 py-2"
    >
      <div className="flex h-5 items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
            transition={reduceMotion ? undefined : { duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]"
          />
        ))}
      </div>
      <span className="text-[13px] text-[var(--text-secondary)]">
        {label}…
        {slow && <span className="ml-1.5 text-[var(--text-tertiary)]">still working — detailed answers can take a minute.</span>}
      </span>
    </motion.div>
  );
};

/* =============================================================================
   WELCOME SCREEN -- AI Workspace Landing
   ============================================================================= */
// Prompt starters. Only "Draw a diagram" switches the mode, because drawing on
// the canvas is the one mode that changes how the answer is made.
const SUGGESTION_CHIPS = [
  { label: 'Explain something', icon: Lightbulb, prompt: 'Explain ' },
  { label: 'Draw a diagram', icon: BarChart3, prompt: 'Draw a diagram of ', mode: 'deep' },
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

  const firstName = user?.isGuest ? '' : (user?.name?.split(' ')[0] || '');

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
              className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--st-fill)] active:scale-[0.99]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
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
  const Icon = info.tone === 'blue' ? WifiOff : info.tone === 'amber' ? Zap : AlertCircle;
  const accent = { red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6' }[info.tone] || '#ef4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      role="alert"
      className="my-2 w-full rounded-xl px-3.5 py-3"
      style={{ border: '1px solid var(--st-line-strong, var(--border-color))', background: 'var(--st-fill, var(--bg-secondary))' }}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="mt-[2px] shrink-0" style={{ color: accent }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {info.title}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {info.desc}
          </p>
        </div>
      </div>
      {(onRetry || onDismiss) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[26px]">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--st-fill-strong,var(--bg-tertiary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--text-primary)', border: '1px solid var(--st-line-strong, var(--border-color))' }}
            >
              <RotateCcw size={13} strokeWidth={2.3} aria-hidden="true" />
              Try again
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--st-fill-strong,var(--bg-tertiary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
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
  const userScrolledRef = useRef(false);
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
  const generationProgress = useTutorStore((s) => s.generationProgress);

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
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
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

  const lastMessageContent = (messages || []).length > 0 ? messages[messages.length - 1].content : '';
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom(isCurrentlyStreaming ? 'auto' : 'smooth');
    }
  }, [messages.length, lastMessageContent, currentStreamingContent, isCurrentlyWaiting, isCurrentlyStreaming, scrollToBottom]);

  // #17: List Virtualization for large histories
  const showStreamingNew = isCurrentlyStreaming && !streamingInList && (currentStreamingContent || currentStreamingThought || currentStreamingSources?.length > 0);
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

  const thinkingPhase = useMemo(() => {
    if (currentSearchPerformed && !currentStreamingContent) return 'searching';
    if (isCurrentlyStreaming) return 'generating';
    return 'waiting';
  }, [isCurrentlyStreaming, currentStreamingContent, currentSearchPerformed]);

  const handleSuggestionClick = useCallback((prompt, mode) => {
    if (mode) setActiveMode(mode);
    useTutorStore.getState().setChatInputText?.(prompt);
  }, [setActiveMode]);

  return (
    <div className="chat-window-wrapper flex-1 flex flex-col min-h-0 relative">
      <div
        ref={containerRef}
        className="chat-window flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar"
        role="log"
        aria-label="Chat messages"
        style={{ paddingRight: 4 }}
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
                      className="px-4"
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
                    ref={rowVirtualizer.measureElement}
                    className="px-4"
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

          <div className="mx-auto w-full max-w-[760px] shrink-0 px-4">
          <AnimatePresence mode="wait">
            {(isCurrentlyWaiting || (isCurrentlyStreaming && !currentStreamingContent && !currentStreamingThought)) && !streamingInList && (
              <ThinkingIndicator
                key="thinking"
                phase={thinkingPhase}
                progress={generationProgress?.label}
              />
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
