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
import { createPortal } from 'react-dom';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BookOpen, ClipboardCheck, ArrowDown, AlertCircle, RotateCcw, MessageSquare, RefreshCw, WifiOff, Zap } from 'lucide-react';
import SkeletonMessage from './SkeletonMessage';
import { useAuth } from '../../hooks/useAuth';
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
      transition={{ duration: 0.2 }}
      className="w-full py-4 flex items-center gap-4"
      style={{ minHeight: '44px' }}
    >
      <div className="flex items-center justify-center w-6 h-6">
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--text-primary)',
          }}
        />
      </div>

      <span
        className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-40"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
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
      className={`flex-1 flex flex-col justify-start select-none overflow-y-auto no-scrollbar
        ${isMobile ? 'px-6 pt-6 pb-8' : 'px-8 pt-8 pb-10'}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'ease-apple' }}
        className={isMobile ? 'mb-6' : 'mb-8'}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-30 mb-2">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <div
          style={{
            fontSize: isMobile ? 18 : 24,
            fontWeight: 400,
            lineHeight: 1.3,
            letterSpacing: '-0.015em',
            color: 'var(--text-primary)',
            opacity: 0.85,
          }}
        >
          What would you like to learn today?
        </div>
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
              aria-pressed={active}
              className="flex items-center gap-4 rounded-2xl transition-all active:scale-[0.98] sf-glass border border-white/5 hover:border-white/10"
              style={{
                padding: isMobile ? '12px 16px' : '14px 20px',
                background: active ? 'var(--text-primary)' : 'rgba(var(--bg-secondary-rgb), 0.4)',
                boxShadow: active ? '0 12px 32px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: active ? 'rgba(255,255,255,0.15)' : `color-mix(in srgb, ${mode.accent} 10%, transparent)` }}
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



// ── Error recovery card ──────────────────────────────────────────────────────
const ErrorCard = ({ error, onRetry }) => {
  const getFriendlyError = (err) => {
    const msg = typeof err === 'string' ? err : err?.message || '';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return {
        title: "Model is busy",
        desc: "We're receiving a high volume of requests. Please wait a few seconds and try again.",
        icon: Zap,
        color: "amber"
      };
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return {
        title: "Connection issue",
        desc: "We're having trouble reaching the AI engine. Check your internet or try again.",
        icon: WifiOff,
        color: "blue"
      };
    }
    return {
      title: "Generation failed",
      desc: msg || "An unexpected error occurred while generating the response.",
      icon: AlertCircle,
      color: "red"
    };
  };

  const info = getFriendlyError(error);
  const Icon = info.icon;
  const colorMap = {
    red: { bg: 'bg-red-50/30', border: 'border-red-200/50', iconBg: 'bg-red-100', iconColor: 'text-red-600', textTitle: 'text-red-900', textDesc: 'text-red-700', btn: 'bg-red-600 hover:bg-red-700 shadow-red-200' },
    amber: { bg: 'bg-amber-50/30', border: 'border-amber-200/50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', textTitle: 'text-amber-900', textDesc: 'text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' },
    blue: { bg: 'bg-blue-50/30', border: 'border-blue-200/50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', textTitle: 'text-blue-900', textDesc: 'text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' },
  };
  const c = colorMap[info.color] || colorMap.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-3 my-4 p-4 rounded-2xl border ${c.bg} ${c.border} flex flex-col gap-3 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={16} className={c.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-[13px] font-semibold ${c.textTitle} mb-1`}>{info.title}</h4>
          <p className={`text-[12px] ${c.textDesc} leading-relaxed`}>{info.desc}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onRetry}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-all active:scale-95 shadow-sm ${c.btn}`}
        >
          <RotateCcw size={12} />
          Try again
        </button>
      </div>
    </motion.div>
  );
};

// ── High-End Radial Conversation Navigator (Canvas Integrated) ────────────────
const MessageNav = ({ messages, containerRef, scrollToMessage }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [activeMessageId, setActiveMessageId] = useState(
    () => messages.find((m) => m.role === "user")?.id ?? messages[0]?.id ?? null
  );

  const observerRef = useRef(null);

  const navMessages = useMemo(
    () => messages.filter((m) => m.role === "user"),
    [messages]
  );

  const activeIdx = useMemo(() => 
    navMessages.findIndex(m => m.id === activeMessageId),
    [navMessages, activeMessageId]
  );

  // ── Interaction Logic ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    if (!isExpanded) return;
    e.preventDefault();
    const delta = e.deltaY * 0.08;
    setScrollOffset(prev => Math.max(0, Math.min(prev + delta, (navMessages.length - 1) * 30)));
  }, [isExpanded, navMessages.length]);

  useEffect(() => {
    if (!isExpanded) setScrollOffset(activeIdx * 30);
  }, [activeIdx, isExpanded]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || navMessages.length === 0) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visible[0];
        const id = topEntry.target.getAttribute("data-message-id");
        if (!id) return;
        const currentIdx = messages.findIndex((m) => m.id === id);
        if (currentIdx === -1) return;
        const precedingUserMsg = [...messages.slice(0, currentIdx + 1)].reverse().find((m) => m.role === "user");
        if (precedingUserMsg) setActiveMessageId(precedingUserMsg.id);
      },
      { root, threshold: [0.1, 0.5, 1.0], rootMargin: "-30% 0px -30% 0px" }
    );
    root.querySelectorAll("[data-message-id]").forEach((el) => observerRef.current.observe(el));
    return () => observerRef.current?.disconnect();
  }, [messages, containerRef, navMessages.length]);

  if (!messages.length) return null;

  // ── Radial Math (Optimized for Canvas area) ────────────────────────────────
  const RADIUS = 320;
  const NODE_SPACING = 32; 

  const navContent = (
    <div
      className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end h-[600px] pointer-events-none"
      style={{ width: isExpanded ? '450px' : '60px' }}
      onWheel={handleWheel}
    >
      {/* ── EXPANDED RADIAL CANVAS ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.98 }}
            transition={{ type: "spring", damping: 35, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-full flex items-center pointer-events-none"
          >
            {/* Immersive Arc Track */}
            <svg 
              className="absolute right-0 top-0 h-full w-full pointer-events-none overflow-visible"
              viewBox="0 0 450 600"
            >
              <defs>
                <linearGradient id="arc-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="var(--text-primary)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <motion.path
                d={`M 450 100 A ${RADIUS} ${RADIUS} 0 0 0 450 500`}
                fill="none"
                stroke="url(#arc-glow)"
                strokeWidth="1.5"
                strokeDasharray="2 10"
              />
            </svg>

            {/* Radial Nodes & Previews */}
            <div className="relative w-full h-full flex items-center justify-end pr-12 pointer-events-auto">
              {navMessages.map((msg, i) => {
                const isActive = activeMessageId === msg.id;
                const isHoveredNode = hoveredIdx === i;
                const relativeIdx = i - (scrollOffset / 30);
                const angle = relativeIdx * NODE_SPACING;
                const angleRad = (angle * Math.PI) / 180;
                
                const distFromCenter = Math.abs(relativeIdx);
                const opacity = Math.max(0, 1 - distFromCenter * 0.35);
                const scale = Math.max(0.6, 1 - distFromCenter * 0.12);
                const blur = distFromCenter * 3;

                const x = Math.cos(angleRad) * RADIUS - RADIUS;
                const y = Math.sin(angleRad) * RADIUS;

                if (opacity <= 0.02) return null;

                return (
                  <motion.div
                    key={msg.id}
                    className="absolute right-4 flex items-center justify-end"
                    animate={{ 
                      x: x - 40, 
                      y, 
                      opacity, 
                      scale: isHoveredNode ? scale * 1.08 : scale,
                      filter: `blur(${blur}px)`
                    }}
                    transition={{ type: "spring", damping: 40, stiffness: 400 }}
                  >
                    {/* Futuristic Preview Card */}
                    <motion.div
                      onClick={() => {
                        scrollToMessage(msg.id);
                        setScrollOffset(i * 30);
                      }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className={`sf-glass p-4 rounded-[28px] border border-white/10 shadow-premium cursor-pointer transition-all ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`}
                      animate={{
                        borderColor: isActive ? 'var(--text-primary)' : 'rgba(255,255,255,0.1)',
                        boxShadow: isActive ? '0 0 30px rgba(var(--theme-color-rgb), 0.3)' : '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Quest {i + 1}</span>
                        {isActive && <div className="w-1 h-1 rounded-full bg-[var(--text-primary)] shadow-[0_0_8px_var(--text-primary)]" />}
                      </div>
                      <p className="text-[12px] font-semibold leading-tight line-clamp-2 max-w-[200px]" style={{ color: 'var(--text-primary)' }}>
                        {msg.content}
                      </p>
                      <div className="mt-3 flex items-center justify-between opacity-30">
                         <span className="text-[9px] font-mono tracking-tighter">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                         <Zap size={10} className={isActive ? 'text-yellow-400' : ''} />
                      </div>
                    </motion.div>

                    {/* Glowing Arc Joint */}
                    <motion.div 
                       className="w-1.5 h-1.5 rounded-full ml-4 shadow-lg"
                       animate={{
                          backgroundColor: isActive ? 'var(--text-primary)' : 'rgba(255,255,255,0.2)',
                          boxShadow: isActive ? '0 0 12px var(--text-primary)' : 'none'
                       }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STABLE ANCHOR RAIL ── */}
      <motion.div
        className="relative h-[240px] w-[40px] flex flex-col items-center justify-center pointer-events-auto"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => {
          setIsExpanded(false);
          setHoveredIdx(null);
        }}
        style={{ zIndex: 6500 }}
      >
        <div className="flex flex-col items-center gap-5 relative z-10">
          {navMessages.map((msg, i) => {
            const isActive = activeMessageId === msg.id;
            return (
              <motion.button
                key={msg.id}
                onClick={() => {
                  scrollToMessage(msg.id);
                  setScrollOffset(i * 30);
                }}
                className="w-1.5 h-1.5 rounded-full relative group focus:outline-none"
                animate={{
                  scale: isActive ? 1.8 : 1,
                  backgroundColor: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  opacity: isActive ? 1 : 0.3,
                  boxShadow: isActive ? '0 0 12px var(--text-primary)' : 'none'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="rail-active"
                    className="absolute inset-[-4px] border border-[var(--text-primary)]/30 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

// CHATWINDOW
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
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const bottomRef = useRef(null);
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
  const isMessagesLoading = useTutorStore((s) => s.isMessagesLoading);
  const generationProgress = useTutorStore((s) => s.generationProgress);

  const isCurrentlyStreaming = isStreaming;
  // Bug 2.3 Fix: Require exact session match, remove 'temp' fallback
  const isCurrentlyWaiting = isWaitingForAI && waitingSessionId === currentSessionId;
  const isActive = isCurrentlyStreaming || isCurrentlyWaiting;

  // Variables used by hooks must be defined before those hooks
  const isEmpty =
    (messages || []).length === 0 && !isCurrentlyWaiting && !isCurrentlyStreaming && !lastAIError && !isMessagesLoading;

  const streamingInList = (messages || []).some((m) => m.id === currentStreamingMessageId);

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
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior });
      }
      userScrolledRef.current = false;
      setShowPill(false);
      lastScrollTimeRef.current = Date.now();
      scrollRAFRef.current = null;
    });
    // P-3 FIX: Stable callback — messages.length was incorrectly in deps, causing recreation on every message
  }, []);

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

  const scrollToMessage = useCallback((id) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

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
        className="chat-window flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar pr-1 mr-1.5"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <AnimatePresence mode="wait">
          {isMessagesLoading ? (
            <div key="loading" className="flex-1 flex items-center justify-center min-h-[300px]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-[3px] border-[var(--text-primary)]/5 border-t-[var(--text-primary)]/30 rounded-full"
              />
            </div>
          ) : lastAIError?.type === 'RESTORE_ERROR' || lastAIError?.type === 'FETCH_ERROR' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6">
                <AlertCircle size={32} className="text-red-500/60" />
              </div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
                Failed to Load Session
              </h3>
              <p className="text-[13px] text-[var(--text-tertiary)] max-w-[240px] mb-8 leading-relaxed">
                {lastAIError.message || "We couldn't retrieve your conversation. Please try again."}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[13px] font-semibold hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                <RefreshCw size={14} />
                Retry Loading
              </button>
            </motion.div>
          ) : isEmpty ? (
            <ChatLanding key="empty" activeMode={activeMode} setActiveMode={setActiveMode} />
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col px-3 py-3 gap-0.5"
            >
              {messages.map((msg) => {
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
              })}

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
              <AnimatePresence mode="wait">
                {((isCurrentlyWaiting && !currentStreamingThought) ||
                  ((isCurrentlyStreaming || currentStreamingThought) && !currentStreamingContent)) &&
                  !streamingInList && (
                    <motion.div
                      key="thinking-state-wrapper"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="w-full flex flex-col gap-1"
                    >
                      {isCurrentlyWaiting && !currentStreamingThought && (
                        <div className="h-4" /> 
                      )}
                      <ThinkingIndicator
                        key="thinking-component"
                        phase={thinkingPhase}
                        progress={generationProgress?.label}
                      />
                    </motion.div>
                  )}
              </AnimatePresence>

              {/* Error recovery card */}
              <AnimatePresence>
                {lastAIError && (
                  <ErrorCard
                    error={lastAIError}
                    onRetry={() => {
                      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant?.id) {
                        onRegenerateMessage(lastAssistant.id);
                      } else {
                        // Bug 4.5 Fix: Fallback to resubmitting last user message
                        const lastUser = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUser) onSubmit(lastUser.content);
                      }
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-11 h-11 flex items-center justify-center rounded-full sf-glass shadow-premium hover:scale-110 active:scale-90 transition-all group border border-white/10"
          >
            <ArrowDown size={20} strokeWidth={2.5} className="group-hover:translate-y-0.5 transition-transform text-[var(--text-primary)]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Message Navigation Rail */}
      {messages.length > 1 && (
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
