/**
 * ChatWindow.jsx — TutorBoard v4.0
 * Premium LLM-grade chat experience:
 * - Smooth token streaming with cursor blink
 * - Smart phase-aware thinking indicator (Thinking → Searching → Generating)
 * - Scroll-to-latest pill when user scrolls up during generation
 * - Canvas artifact cards inline in chat
 * - Zero layout shift during streaming
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BookOpen, ClipboardCheck, ArrowDown, AlertCircle, RotateCcw } from 'lucide-react';
import * as reactWindow from 'react-window';
const { VariableSizeList } = reactWindow;
import { useAuth } from '../../context/AuthContext';
import useWindowSize from '../../hooks/useWindowSize';
import useTutorStore from '../../store/tutorStore';

// ── Phase-aware thinking indicator ──────────────────────────────────────────
const ThinkingIndicator = ({ phase, progress }) => {
  const label = progress || ({
    waiting: 'Thinking',
    searching: 'Searching the web',
    generating: 'Generating response',
    thinking: 'Thinking',
  }[phase] || 'Thinking');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full py-2.5 flex items-center gap-3"
      style={{ minHeight: '36px' }}
    >
      <div className="flex items-center gap-[4px] opacity-40">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            style={{
              width: 3.5,
              height: 3.5,
              borderRadius: '50%',
              background: 'var(--text-tertiary)',
            }}
          />
        ))}
      </div>

      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-tertiary)',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          opacity: 0.7,
        }}
      >
        {label}...
      </span>
    </motion.div>
  );
};

// ── Landing welcome screen ────────────────────────────────────────────────────
const ChatLanding = ({ setActiveMode, activeMode }) => {
  const { user } = useAuth();
  const { isMobile } = useWindowSize();

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.name?.split(' ')[0] || '';

  const modes = [
    { id: 'quick', label: 'Quick Answer', icon: BookOpen, desc: 'Concise explanations', accent: 'var(--info)' },
    { id: 'deep', label: 'Visual Dive', icon: Layers, desc: 'Step-by-step canvas', accent: 'var(--success)' },
    { id: 'test_me', label: 'Test Me', icon: ClipboardCheck, desc: 'Interactive quiz', accent: 'var(--warning)' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex-1 flex flex-col justify-center select-none overflow-y-auto no-scrollbar
        ${isMobile ? 'px-5 py-8' : 'px-5 py-10'}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={isMobile ? 'mb-7' : 'mb-9'}
      >
        <p style={{ fontSize: isMobile ? 11 : 11.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <h1 style={{
          fontSize: isMobile ? 22 : 26,
          fontWeight: 400,
          color: 'var(--text-primary)',
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          What would you like<br />to learn today?
        </h1>
      </motion.div>

      <div className="flex flex-col gap-2">
        {modes.map((mode, i) => {
          const active = activeMode === mode.id;
          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setActiveMode(active ? null : mode.id)}
              className="flex items-center gap-3 rounded-2xl border transition-all active:scale-[0.97]"
              style={{
                padding: isMobile ? '10px 14px' : '12px 16px',
                background: active ? 'var(--text-primary)' : 'var(--bg-secondary)',
                borderColor: active ? 'var(--text-primary)' : 'var(--border-color)',
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: active ? 'rgba(255,255,255,0.15)' : `${mode.accent}1a` }}
              >
                <mode.icon
                  size={15}
                  strokeWidth={2}
                  style={{ color: active ? 'var(--bg-primary)' : mode.accent }}
                />
              </div>
              <div className="flex flex-col items-start">
                <span style={{
                  fontSize: isMobile ? 12.5 : 13,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: active ? 'var(--bg-primary)' : 'var(--text-primary)',
                }}>
                  {mode.label}
                </span>
                <span style={{
                  fontSize: 10,
                  color: active ? 'rgba(255,255,255,0.55)' : 'var(--text-tertiary)',
                }}>
                  {mode.desc}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

// ── Row Wrapper for Dynamic Height ──────────────────────────────────────────
const MessageRow = ({ index, style, data }) => {
  const {
    messages, onHeightChange,
    isCurrentlyStreaming, currentStreamingMessageId, currentStreamingContent,
    currentStreamingThought, currentStreamingSources, currentSearchPerformed,
    isActive, ...callbacks
  } = data;

  const msg = messages[index];
  const rowRef = useRef(null);
  const isThisStreaming = isCurrentlyStreaming && currentStreamingMessageId === msg.id;

  useEffect(() => {
    if (!rowRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const height = Math.ceil(entry.contentRect.height) + 4; // Add small buffer
        onHeightChange(index, height);
      }
    });
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, [index, onHeightChange]);

  return (
    <div style={{ ...style, overflow: 'hidden' }}>
      <div ref={rowRef} className="py-0.5 px-3">
        <Message
          {...msg}
          {...callbacks}
          isStreaming={isThisStreaming}
          isSessionActive={isActive}
          streamingContent={isThisStreaming ? currentStreamingContent : ""}
          streamingThought={isThisStreaming ? currentStreamingThought : ""}
          streamingMessageId={currentStreamingMessageId}
          isSearchPerformed={isThisStreaming ? currentSearchPerformed : false}
          streamingSources={isThisStreaming ? currentStreamingSources : []}
          showCursor={isThisStreaming}
          hasCanvas={msg.hasCanvas || !!(msg.elements?.length || msg.objects?.length || msg.steps?.length)}
        />
      </div>
    </div>
  );
};

// ── Error recovery card ──────────────────────────────────────────────────────
const ErrorCard = ({ error, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mx-3 my-4 p-4 rounded-2xl border bg-red-50/30 border-red-200/50 flex flex-col gap-3"
  >
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <AlertCircle size={16} className="text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-semibold text-red-900 mb-1">Generation failed</h4>
        <p className="text-[12px] text-red-700 leading-relaxed">
          {error || "An unexpected error occurred while generating the response."}
        </p>
      </div>
    </div>
    <div className="flex justify-end">
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold transition-all hover:bg-red-700 active:scale-95 shadow-sm shadow-red-200"
      >
        <RotateCcw size={12} />
        Try again
      </button>
    </div>
  </motion.div>
);

// ── Scroll-to-bottom pill ────────────────────────────────────────────────────
const ScrollPill = ({ visible, onClick }) => (
  <AnimatePresence>
    {visible && (
      <motion.button
        initial={{ opacity: 0, y: 10, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.8 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={onClick}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[30] flex items-center justify-center rounded-full shadow-lg border border-white/10 transition-all hover:scale-110 active:scale-90"
        style={{
          width: 38,
          height: 38,
          background: 'rgba(23, 23, 23, 0.85)',
          backdropFilter: 'blur(12px)',
          color: 'white',
        }}
        title="Scroll to bottom"
      >
        <ArrowDown size={18} strokeWidth={2.5} />
      </motion.button>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHATWINDOW
// ═══════════════════════════════════════════════════════════════════════════════

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
  activeMode,
  setActiveMode,
}) => {
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const containerRef = useRef(null);
  const userScrolledRef = useRef(false);
  const [showPill, setShowPill] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  const currentSessionId = useTutorStore((s) => s.chatSessionId || s.sessionId || 'temp');
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
  const generationProgress = useTutorStore((s) => s.generationProgress);

  const isCurrentlyStreaming = isStreaming;
  // Robust check: matches if either the current session ID or the waiting ID matches
  const isCurrentlyWaiting = isWaitingForAI && (waitingSessionId === currentSessionId || waitingSessionId === 'temp');
  const isActive = isCurrentlyStreaming || isCurrentlyWaiting;

  // Variables used by hooks must be defined before those hooks
  const isEmpty =
    messages.length === 0 && !isGenerating && !isCurrentlyWaiting && !isCurrentlyStreaming;

  const streamingInList = messages.some((m) => m.id === currentStreamingMessageId);
  const shouldVirtualize = !isActive && messages.length > 80;

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const dist = scrollHeight - scrollTop - clientHeight;
    const nearBottom = dist < 80;
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

  const scrollRAFRef = useRef(null);
  const lastScrollTimeRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    // 16ms debounce + requestAnimationFrame to prevent layout thrashing (Fixed: CRITICAL)
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 16) return;

    if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);

    scrollRAFRef.current = requestAnimationFrame(() => {
      if (shouldVirtualize && listRef.current) {
        listRef.current.scrollToItem(Math.max(0, messages.length - 1), 'end');
      } else if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior });
      }
      userScrolledRef.current = false;
      setShowPill(false);
      lastScrollTimeRef.current = Date.now();
      scrollRAFRef.current = null;
    });
  }, [messages.length, shouldVirtualize]);

  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom(isCurrentlyStreaming ? 'auto' : 'smooth');
    }
  }, [messages.length, currentStreamingContent, isCurrentlyWaiting, isCurrentlyStreaming, scrollToBottom]);

  const thinkingPhase = React.useMemo(() => {
    if (currentSearchPerformed && !currentStreamingContent) return 'searching';
    if (isCurrentlyStreaming) return 'generating';
    return 'waiting';
  }, [isCurrentlyStreaming, currentStreamingContent, currentSearchPerformed]);

  const estimateMessageHeight = useCallback((msg) => {
    const content = msg?.content || '';
    const lineCount = Math.max(1, Math.ceil(content.length / 50));
    const base = msg?.role === 'assistant' ? 160 : 100;
    return Math.min(900, base + (lineCount * 20));
  }, []);

  const rowSizeCacheRef = useRef({});
  const lastResetRef = useRef(0);
  const onHeightChange = useCallback((index, height) => {
    if (rowSizeCacheRef.current[index] === height) return;
    rowSizeCacheRef.current[index] = height;

    const now = Date.now();
    // UX-05: Throttle virtualizer resets during streaming to prevent layout thrashing
    if (now - lastResetRef.current > 500 || !isStreaming) {
      if (listRef.current) {
        listRef.current.resetAfterIndex(index, true);
      }
      lastResetRef.current = now;
    }
  }, [isStreaming]);

  const getItemSize = useCallback((index) => {
    return rowSizeCacheRef.current[index] || estimateMessageHeight(messages[index]);
  }, [messages, estimateMessageHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight || 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="chat-window-wrapper flex-1 flex flex-col min-h-0 relative">
      <div
        ref={containerRef}
        className="chat-window flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar"
      >
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <ChatLanding key="empty" activeMode={activeMode} setActiveMode={setActiveMode} />
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col px-3 py-3 gap-0.5"
            >
              {shouldVirtualize ? (
                <VariableSizeList
                  ref={listRef}
                  height={Math.max(200, viewportHeight - 24)}
                  width="100%"
                  itemCount={messages.length}
                  itemSize={getItemSize}
                  overscanCount={8}
                  itemData={{
                    messages,
                    onHeightChange,
                    isCurrentlyStreaming,
                    currentStreamingMessageId,
                    currentStreamingContent,
                    currentStreamingThought,
                    currentStreamingSources,
                    currentSearchPerformed,
                    isActive,
                    onOpenCanvas,
                    onDeleteMessage,
                    onEditMessage,
                    onRegenerateMessage,
                    onFeedback,
                    onSwitchVersion,
                    onOpenArtifact,
                  }}
                  onScroll={({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
                    if (scrollUpdateWasRequested) return;
                    const totalEstimatedHeight = messages.reduce((acc, _, idx) => acc + getItemSize(idx), 0);
                    const nearBottom = totalEstimatedHeight - (scrollOffset + Math.max(200, viewportHeight - 24)) < 120;
                    if (scrollDirection === 'backward') userScrolledRef.current = true;
                    if (nearBottom) userScrolledRef.current = false;
                    setShowPill(!nearBottom);
                  }}
                >
                  {MessageRow}
                </VariableSizeList>
              ) : (
                messages.map((msg) => {
                  const msgKey = msg.id || `msg-${msg.role}-${msg.timestamp}`;
                  const isThisStreaming = isCurrentlyStreaming && currentStreamingMessageId === msg.id;

                  return (
                    <Message
                      key={msgKey}
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
                      streamingSources={isThisStreaming ? currentStreamingSources : []}
                      showCursor={isThisStreaming}
                    />
                  );
                })
              )}

              {/* Streaming new message not yet in list */}
              {isCurrentlyStreaming && !streamingInList &&
                (currentStreamingContent || currentStreamingThought || currentStreamingSources?.length > 0) && (
                  <Message
                    key="streaming-new"
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
                    isSearchPerformed={currentSearchPerformed}
                    onOpenArtifact={onOpenArtifact}
                    showCursor
                  />
                )}

              {/* Thinking / waiting indicator */}
              <AnimatePresence>
                {(isCurrentlyWaiting || (isCurrentlyStreaming && !currentStreamingContent)) && !streamingInList && (
                  <ThinkingIndicator
                    key="thinking"
                    phase={thinkingPhase}
                    progress={generationProgress?.label}
                  />
                )}
              </AnimatePresence>

              {/* Error recovery card */}
              <AnimatePresence>
                {lastAIError && (
                  <ErrorCard
                    error={lastAIError}
                    onRetry={() => {
                      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                      onRegenerateMessage(lastAssistant?.id);
                    }}
                  />
                )}
              </AnimatePresence>

              <div ref={bottomRef} className="h-20" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ScrollPill visible={showPill} onClick={() => scrollToBottom('smooth')} />
    </div>
  );
};

export default ChatWindow;
