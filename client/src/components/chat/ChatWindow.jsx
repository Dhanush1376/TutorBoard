import React, { useRef, useEffect, useCallback } from 'react';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BookOpen, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import useWindowSize from '../../hooks/useWindowSize';
import useTutorStore from '../../store/tutorStore';

// ── Premium Landing Interface ──────────────────────────────────────────────

const ChatLanding = ({ setActiveMode, activeMode }) => {
  const { user } = useAuth();
  const { isMobile } = useWindowSize();
  
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning,";
    if (hour >= 12 && hour < 17) return "Good afternoon,";
    if (hour >= 17 && hour < 21) return "Good evening,";
    return "Good evening,";
  }, []);

  const modes = [
    { id: 'quick', label: 'Quick Answer', icon: BookOpen, desc: 'Concise explanations' },
    { id: 'deep', label: 'Visual Dive', icon: Layers, desc: 'Step-by-step canvas' },
    { id: 'test_me', label: 'Test Me', icon: ClipboardCheck, desc: 'Interactive quiz' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex-1 flex flex-col justify-center ${isMobile ? 'px-5 py-6' : 'px-6 py-12'} select-none overflow-y-auto no-scrollbar`}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={isMobile ? "mb-6" : "mb-10"}
      >
        <p className={`text-[var(--text-tertiary)] mb-1.5 font-normal ${isMobile ? 'text-[11px]' : 'text-[12px]'}`}>
          {greeting}
        </p>
        <h1 className={`${isMobile ? '!text-[18px]' : '!text-[26px]'} font-normal text-[var(--text-primary)] leading-[1.25] tracking-tight`}>
          What would you like<br />to learn today?
        </h1>
      </motion.div>

      <div className="flex flex-col gap-2">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setActiveMode(activeMode === mode.id ? null : mode.id)}
            className={`flex items-center ${isMobile ? 'gap-2.5 px-3.5 py-2.5' : 'gap-3 px-4 py-3'} rounded-xl border transition-all active:scale-[0.97] group ${
              activeMode === mode.id 
                ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' 
                : 'bg-[var(--bg-secondary)]/60 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)]/30'
            }`}
          >
            <mode.icon size={isMobile ? 15 : 17} strokeWidth={2} className={activeMode === mode.id ? 'opacity-100' : 'opacity-50'} />
            <div className="flex flex-col items-start gap-0">
              <span className={`${isMobile ? 'text-[12.5px]' : 'text-[13.5px]'} font-medium tracking-tight`}>
                {mode.label}
              </span>
              <span className={`text-[10px] font-normal ${activeMode === mode.id ? 'opacity-60' : 'opacity-40'}`}>
                {mode.desc}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ── Thinking / Typing Indicator ─────────────────────────────────────────────

const ThinkingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 12, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
    className="flex items-center gap-3 px-5 py-4 select-none"
  >
    <div className="relative">
      <VisaiLogo size="xxs" />
      <motion.div 
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[var(--text-primary)] rounded-full blur-md -z-10"
      />
    </div>

    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--text-tertiary)] animate-pulse">
          Agent Thinking
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        <motion.div 
          className="h-1 rounded-full bg-gradient-to-r from-[var(--text-primary)] to-transparent"
          initial={{ width: 0 }}
          animate={{ width: 40 }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                opacity: [0.2, 1, 0.2],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                delay: i * 0.2,
                ease: "easeInOut" 
              }}
              className="w-1 h-1 rounded-full bg-[var(--text-primary)]"
            />
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHATWINDOW — Stream-aware, conversation-first rendering
// ═══════════════════════════════════════════════════════════════════════════════

const ChatWindow = ({
  messages, isGenerating,
  onOpenCanvas, onDeleteMessage, onEditMessage, onRegenerateMessage, onFeedback, onSwitchVersion,
  activeMode, setActiveMode,
}) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const userScrolledRef = useRef(false);

  // Read streaming state from store
  const isStreaming = useTutorStore((s) => s.isStreaming);
  const streamingContent = useTutorStore((s) => s.streamingContent);
  const streamingThought = useTutorStore((s) => s.streamingThought);
  const streamingMessageId = useTutorStore((s) => s.streamingMessageId);
  const streamingSessionId = useTutorStore((s) => s.streamingSessionId);
  const streamingSources = useTutorStore((s) => s.conversationSources);
  const isWaitingForAI = useTutorStore((s) => s.isWaitingForAI);
  const waitingSessionId = useTutorStore((s) => s.waitingSessionId);
  const currentSessionId = useTutorStore((s) => s.chatSessionId || s.sessionId);

  // Filter streaming/waiting status by session ID to prevent cross-chat UI bleed
  const isCurrentlyStreaming = isStreaming && streamingSessionId === currentSessionId;
  const isCurrentlyWaiting = isWaitingForAI && waitingSessionId === currentSessionId;

  // ── Smart Auto-Scroll ──
  // Only auto-scroll if user hasn't manually scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    userScrolledRef.current = !isNearBottom;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (!userScrolledRef.current) {
      // Use 'auto' behavior during streaming for perfect smoothness, 'smooth' for static messages
      const behavior = isStreaming ? 'auto' : 'smooth';
      bottomRef.current?.scrollIntoView({ behavior });
    }
  }, [messages.length, streamingContent, isWaitingForAI, isStreaming]);

  const isEmpty = messages.length === 0 && !isGenerating && !isCurrentlyWaiting && !isCurrentlyStreaming;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <ChatLanding key="empty" activeMode={activeMode} setActiveMode={setActiveMode} />
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col px-3 py-3 gap-1"
          >
            {messages.map((msg) => {
              const msgKey = msg.id || `msg-idx-${msg.role}-${msg.timestamp}`;
              return (
                <Message
                  key={msgKey}
                  role={msg.role}
                  content={msg.content}
                  messageId={msg.id}
                  timestamp={msg.timestamp}
                  metadata={msg.metadata}
                  onOpenCanvas={onOpenCanvas}
                  onDeleteMessage={onDeleteMessage}
                  onEditMessage={onEditMessage}
                  onRegenerateMessage={onRegenerateMessage}
                  onFeedback={onFeedback}
                  onSwitchVersion={onSwitchVersion}
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
                />
              );
            })}

            {/* ── Streaming Message (live typing) ── */}
            {isCurrentlyStreaming && streamingContent && (
              <Message
                key="streaming-msg"
                role="assistant"
                content={streamingContent}
                messageId={streamingMessageId}
                timestamp={new Date().toISOString()}
                isStreaming={true}
                streamingContent={streamingContent}
                streamingThought={streamingThought}
                streamingSources={streamingSources}
              />
            )}

            {/* ── Thinking Indicator (waiting for AI) ── */}
            <AnimatePresence>
              {(isCurrentlyWaiting || (isGenerating && !isCurrentlyStreaming)) && (
                <ThinkingIndicator key="thinking" />
              )}
            </AnimatePresence>

            <div ref={bottomRef} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWindow;
