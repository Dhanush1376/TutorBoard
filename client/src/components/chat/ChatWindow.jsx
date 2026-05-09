/**
 * ChatWindow.jsx — TutorBoard v4.0
 * Premium LLM-grade chat experience:
 * - Smooth token streaming with cursor blink
 * - Smart phase-aware thinking indicator (Thinking → Searching → Generating)
 * - Scroll-to-latest pill when user scrolls up during generation
 * - Canvas artifact cards inline in chat
 * - Zero layout shift during streaming
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BookOpen, ClipboardCheck, ArrowDown, AlertCircle, RotateCcw, MessageSquare } from 'lucide-react';
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
      <div className="flex items-center justify-center w-5 h-5 opacity-40">
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--text-tertiary)',
            boxShadow: '0 0 10px var(--text-tertiary)',
          }}
        />
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
    <div style={{ ...style, overflow: 'hidden' }} data-message-id={msg.id}>
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

// ── Message Navigation Rail (Orbital Arc) ────────────────────────────────────
const MessageNav = ({ messages, containerRef, hoveredMessageId, scrollToMessage }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(messages[0]?.id || null);

  // Filter only user messages for navigation dots
  const navMessages = useMemo(() => {
    return messages
      .map((msg, idx) => ({ ...msg, _globalIdx: idx }))
      .filter(msg => msg.role === 'user');
  }, [messages]);

  // Track active message via IntersectionObserver
  useEffect(() => {
    if (!containerRef.current || navMessages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const topVisible = visibleEntries[0]; 
          const id = topVisible.target.getAttribute('data-message-id');
          if (id) {
            // Find which user question this belongs to
            const currentIdx = messages.findIndex(m => m.id === id);
            if (currentIdx !== -1) {
              const precedingUserMsg = [...messages.slice(0, currentIdx + 1)]
                .reverse()
                .find(m => m.role === 'user');
              if (precedingUserMsg) setActiveMessageId(precedingUserMsg.id);
            }
          }
        }
      },
      {
        root: containerRef.current,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        rootMargin: '-40% 0px -40% 0px'
      }
    );

    const messageElements = containerRef.current.querySelectorAll('[data-message-id]');
    messageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, containerRef, navMessages.length]);

  // Auto-scroll nav container to active dot (centered within the 5-dot window)
  const navScrollRef = useRef(null);
  useEffect(() => {
    if (!navScrollRef.current || !activeMessageId) return;
    const activeDot = navScrollRef.current.querySelector(`[data-nav-id="${activeMessageId}"]`);
    if (activeDot) {
      activeDot.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [activeMessageId]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredIdx(null);
      }}
      className="absolute right-0 top-1/2 -translate-y-1/2 z-[45] flex items-center justify-end px-1 py-8 transition-all duration-700 pointer-events-none"
      style={{ width: isHovered ? '220px' : '30px', height: 'auto' }}
    >
      <div className="relative flex items-center justify-center">
        <div 
          ref={navScrollRef}
          className="relative flex flex-col items-center overflow-y-auto no-scrollbar pointer-events-auto snap-y snap-mandatory scroll-py-14" 
          style={{ 
            height: '140px', // Exactly 5 dots * 28px
            width: '30px',
            padding: '56px 0', // 2 dots worth of padding on each side to allow centering first/last
            zIndex: 1
          }}
        >
          {/* The Rail Track */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[1px] opacity-20"
            style={{ 
              background: 'linear-gradient(to bottom, transparent, var(--text-primary), transparent)',
              zIndex: 0
            }}
          />

          {navMessages.map((msg, i) => {
            const isActive = activeMessageId === msg.id;
            const isPointHovered = hoveredIdx === i;
            const preview = (msg.content || '').slice(0, 60).trim();
            const isAssistant = msg.role === 'assistant';
            
            return (
              <div 
                key={msg.id || i}
                data-nav-id={msg.id}
                style={{ height: '28px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                className="shrink-0 snap-center"
              >
                {/* Persistent Step Indicator for Active Dot */}
                <AnimatePresence>
                  {isActive && !isHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 0.5, x: -20 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="absolute right-6 whitespace-nowrap pointer-events-none"
                    >
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-info">
                        Question {i + 1}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={false}
                  animate={{
                    opacity: isHovered || isActive ? 1 : 0.4,
                    scale: isPointHovered ? 1.4 : isActive ? 1.3 : 0.85,
                  }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  className="relative flex items-center justify-center"
                  style={{ width: 16, height: 16, zIndex: 2 }}
                >
                  {/* Tooltip */}
                  <AnimatePresence>
                    {isPointHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: -20, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                        className="absolute right-6 whitespace-nowrap z-[50] liquid-glass"
                        style={{
                          borderRadius: 14,
                          padding: '12px 16px',
                          maxWidth: '240px',
                        }}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[9px] uppercase tracking-[0.15em] font-bold opacity-40 text-primary">
                              Question {i + 1}
                            </span>
                            {isActive && <span className="text-[8px] bg-info/20 text-info px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Current</span>}
                          </div>
                          <span className="text-[12px] leading-snug font-medium text-[var(--text-primary)] break-words line-clamp-3 italic opacity-90">
                            "{preview || 'Message'}"
                          </span>
                        </div>
                        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 liquid-glass" style={{ borderLeft: 'none', borderBottom: 'none', zIndex: -1 }} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Orbital Dot */}
                  <button
                    onClick={() => scrollToMessage(msg.id)}
                    onMouseEnter={() => setHoveredIdx(i)}
                    className="relative group flex items-center justify-center w-full h-full"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <motion.div
                      animate={{
                        width: isActive || isPointHovered ? 7 : 4,
                        height: isActive || isPointHovered ? 7 : 4,
                        backgroundColor: isActive ? '#fff' : (isAssistant ? 'var(--text-secondary)' : 'var(--text-primary)'),
                        boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.8)' : 'none',
                      }}
                      className="rounded-full transition-all duration-300"
                    />
                    
                    {/* Pulsing Active Ring */}
                    {isActive && (
                      <motion.div
                        animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute w-5 h-5 rounded-full border border-white/30"
                      />
                    )}
                  </button>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
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

  const scrollToMessage = useCallback((id) => {
    if (shouldVirtualize && listRef.current) {
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1) {
        listRef.current.scrollToItem(idx, 'center');
      }
    } else {
      const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [messages, shouldVirtualize]);

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
                    <div key={msgKey} data-message-id={msg.id}>
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
                        streamingSources={isThisStreaming ? currentStreamingSources : []}
                        showCursor={isThisStreaming}
                        onHover={setHoveredMessageId}
                      />
                    </div>
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

              <div ref={bottomRef} className="h-1" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to Bottom Pill */}
      <AnimatePresence>
        {showPill && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-lg hover:scale-110 active:scale-90 transition-all group border border-white/10"
          >
            <ArrowDown size={20} strokeWidth={2.5} className="group-hover:translate-y-0.5 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Message Navigation Rail */}
      {!isEmpty && (
        <MessageNav 
          messages={messages} 
          containerRef={containerRef} 
          scrollToMessage={scrollToMessage}
        />
      )}
    </div>
  );
};

export default ChatWindow;