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
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown, AlertCircle, RotateCcw, RefreshCw, WifiOff, Zap,
  Sparkles, Code2, BarChart3, FileText, Lightbulb, Pen
} from 'lucide-react';
import SkeletonMessage from './SkeletonMessage';
import { useAuth } from '../../hooks/useAuth';
import useWindowSize from '../../hooks/useWindowSize';
import useTutorStore from '../../store/tutorStore';
import VisaiLogo from '../layout/VisaiLogo';
import ErrorBoundary from '../common/ErrorBoundary';

const MessageErrorFallback = ({ error }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    className="mx-auto my-2 p-4 rounded-2xl border flex flex-col items-center justify-center text-center max-w-[420px] w-full"
    style={{ 
      background: 'rgba(239,68,68,0.05)', 
      borderColor: 'rgba(239,68,68,0.15)',
      boxShadow: '0 8px 32px rgba(239,68,68,0.03)'
    }}
  >
    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
      style={{ background: 'rgba(239,68,68,0.12)' }}>
      <AlertCircle size={16} style={{ color: '#ef4444' }} />
    </div>
    <h4 className="text-[13px] font-semibold mb-0.5 tracking-tight" style={{ color: 'var(--text-primary)' }}>
      Rendering Exception
    </h4>
    <p className="text-[11.5px] leading-relaxed mb-0 px-2" style={{ color: 'var(--text-tertiary)' }}>
      Unable to render message node safely. Please reload the workspace session.
    </p>
  </motion.div>
);

/* =============================================================================
   THINKING INDICATOR -- Orbital pulse with phase label
   ============================================================================= */
const ThinkingIndicator = ({ phase, progress }) => {
  const label = progress || ({
    waiting: 'Thinking',
    searching: 'Searching',
    generating: 'Writing',
    thinking: 'Reasoning',
  }[phase] || 'Thinking');

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full py-2 flex items-center gap-3 px-2"
    >
      <div className="flex items-center gap-1.5 h-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ 
              y: [0, -3, 0],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{ 
              duration: 1, 
              repeat: Infinity, 
              delay: i * 0.15,
              ease: "easeInOut"
            }}
            className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]/40"
          />
        ))}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] opacity-60">
        {label}
      </span>
    </motion.div>
  );
};

/* =============================================================================
   WELCOME SCREEN -- AI Workspace Landing
   ============================================================================= */
const SUGGESTION_CHIPS = [
  { label: 'Explain a concept', icon: Lightbulb, prompt: 'Explain ', mode: 'explain', color: '#f59e0b' },
  { label: 'Write code', icon: Code2, prompt: 'Write code for ', mode: 'code', color: '#6366f1' },
  { label: 'Create a diagram', icon: BarChart3, prompt: 'Create a diagram of ', mode: 'deep', color: '#0ea5e9' },
  { label: 'Summarize text', icon: FileText, prompt: 'Summarize: ', mode: 'summarize', color: '#10b981' },
  { label: 'Help me write', icon: Pen, prompt: 'Help me write ', mode: 'write', color: '#ec4899' },
  { label: 'Generate ideas', icon: Sparkles, prompt: 'Generate ideas for ', mode: 'ideas', color: '#a855f7' },
];

const ChatLanding = ({ onSuggestionClick }) => {
  const { user } = useAuth();
  const { isMobile } = useWindowSize();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-start justify-center select-none no-scrollbar px-10 pb-2"
      style={{ maxWidth: 600, margin: '0', width: '100%', color: 'var(--text-primary)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-3 mt-[-40px]"
      >
        <div className="mb-2.5 relative flex items-center gap-2">
          <VisaiLogo size="xxs" className="opacity-60" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-primary)] opacity-20">Workspace</span>
        </div>
        
        <h2 className="text-[16px] font-bold tracking-tight mb-0" style={{ color: 'var(--text-primary)' }}>
          {greeting}, {firstName}
        </h2>
        <p className="text-[10px] tracking-tight font-medium uppercase mt-0.5" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>
          Select a directive
        </p>
      </motion.div>

      <div className="flex flex-col gap-0.5 w-full max-w-[240px]">
        {SUGGESTION_CHIPS.map((chip, i) => (
          <motion.button
            key={chip.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.02, duration: 0.3 }}
            onClick={() => {
              if (chip.mode) {
                onSuggestionClick?.(chip.prompt, chip.mode);
              } else {
                onSuggestionClick?.(chip.prompt);
              }
            }}
            className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-transparent border border-transparent hover:bg-[var(--text-primary)]/5 transition-all active:scale-[0.98] text-left"
          >
            <div 
              className="w-4 h-4 rounded-sm flex items-center justify-center transition-colors"
              style={{ background: chip.color + '05' }}
            >
              <chip.icon size={9} strokeWidth={2} style={{ color: chip.color }} />
            </div>
            <span className="text-[11px] font-medium transition-colors" style={{ color: 'var(--text-tertiary)' }}>
              {chip.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

/* =============================================================================
   ERROR CARD -- Inline error recovery
   ============================================================================= */
const ErrorCard = ({ error, onRetry }) => {
  const getFriendlyError = (err) => {
    const msg = typeof err === 'string' ? err : err?.message || '';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { title: "Rate Limited", desc: "Too many requests. Please wait a moment before trying again.", icon: Zap, color: 'amber' };
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return { title: "Connection Disrupted", desc: "Check your active connection and synchronize to resume.", icon: WifiOff, color: 'blue' };
    }
    return { title: "Generation Incomplete", desc: msg || "An unexpected orchestration error occurred during streaming.", icon: AlertCircle, color: 'red' };
  };

  const info = getFriendlyError(error);
  const Icon = info.icon;

  const colorMap = {
    red: { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.15)', iconBg: 'rgba(239,68,68,0.12)', icon: '#ef4444', glow: 'rgba(239,68,68,0.03)' },
    amber: { bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)', iconBg: 'rgba(245,158,11,0.12)', icon: '#f59e0b', glow: 'rgba(245,158,11,0.03)' },
    blue: { bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.15)', iconBg: 'rgba(59,130,246,0.12)', icon: '#3b82f6', glow: 'rgba(59,130,246,0.03)' },
  };
  const c = colorMap[info.color] || colorMap.red;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 8 }}
      className="mx-auto my-2 p-4 rounded-2xl border flex flex-col items-center justify-center text-center max-w-[420px] w-full transition-all"
      style={{ 
        background: c.bg, 
        borderColor: c.border,
        boxShadow: `0 8px 32px ${c.glow}`
      }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-colors"
        style={{ background: c.iconBg }}>
        <Icon size={16} style={{ color: c.icon }} />
      </div>
      
      <h4 className="text-[13px] font-semibold mb-0.5 tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {info.title}
      </h4>
      
      <p className="text-[11.5px] leading-relaxed mb-3 px-2" style={{ color: 'var(--text-tertiary)' }}>
        {info.desc}
      </p>
      
      <button
        onClick={onRetry}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11.5px] font-semibold transition-all active:scale-95 shadow-md hover:opacity-90"
        style={{
          background: c.icon,
          color: '#ffffff',
        }}
      >
        <RotateCcw size={13} strokeWidth={2.5} />
        <span>Try Again</span>
      </button>
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
  const isCurrentlyWaiting = isWaitingForAI && waitingSessionId === currentSessionId;
  const isActive = isCurrentlyStreaming || isCurrentlyWaiting;

  const isEmpty =
    (messages || []).length === 0 && !isCurrentlyWaiting && !isCurrentlyStreaming && !lastAIError && !isMessagesLoading;

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
              className="relative py-1"
              style={{ 
                maxWidth: 780, 
                margin: '0 auto', 
                width: '100%', 
                padding: '8px 16px 8px 20px',
                height: `${rowVirtualizer.getTotalSize()}px`
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
                        role={msg.role}
                        content={msg.content}
                        messageId={msg.id}
                        timestamp={msg.timestamp}
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
            {lastAIError && (
              <ErrorCard
                error={lastAIError}
                onRetry={() => {
                  if (lastAIError?.messageId) {
                    onRegenerateMessage(lastAIError.messageId);
                  } else {
                    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                    onRegenerateMessage(lastAssistant?.id || null);
                  }
                }}
              />
            )}
          </AnimatePresence>

          <div ref={bottomRef} className="h-1" />
        </AnimatePresence>
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
