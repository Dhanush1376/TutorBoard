import React, { useRef, useEffect } from 'react';
import Message from './Message';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, MessageSquare, BookOpen, Wrench, ClipboardCheck, Image } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';

// ── New premium starting interface ──
const ChatLanding = ({ setActiveMode, activeMode }) => {
  const { user } = useAuth();
  
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Welcome, Early Bird,";
    if (hour >= 12 && hour < 17) return "Welcome, Day Dreamer,";
    if (hour >= 17 && hour < 21) return "Welcome, Calm Creator,";
    return "Welcome, Night Owl,";
  }, []);

  const modes = [
    { id: 'quick', label: 'Quick Answer', icon: BookOpen, color: '#60a5fa' },
    { id: 'deep', label: 'Deep Visual Dive', icon: Layers, color: '#f87171' },
    { id: 'test_me', label: 'Test Me', icon: ClipboardCheck, color: '#fbbf24' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col justify-start px-6 py-16 select-none overflow-y-auto no-scrollbar"
    >
      {/* Personalized Greeting */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <p className="!text-[11px] lg:!text-[12px] font-normal text-[var(--text-secondary)] mb-1 tracking-tight opacity-80">
          {greeting}
        </p>
        <h1 className="!text-[22px] lg:!text-[30px] font-normal text-[var(--text-primary)] leading-[1.2] tracking-tight">
          Where should <br /> we start?
        </h1>
      </motion.div>

      {/* Starting Blocks (Modes) */}
      <div className="flex flex-col gap-3 items-start">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setActiveMode(mode.id)}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-full border transition-all active:scale-[0.96] shadow-sm hover:shadow-md group ${
              activeMode === mode.id 
                ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' 
                : 'bg-[var(--bg-tertiary)]/60 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/90'
            }`}
          >
            <div className={`flex items-center justify-center transition-transform group-hover:scale-110 ${
              activeMode === mode.id ? 'opacity-100' : 'opacity-80'
            }`}>
              <mode.icon size={20} strokeWidth={2.5} style={{ color: activeMode === mode.id ? '#fff' : mode.color }} />
            </div>
            <span className="text-[16px] font-normal tracking-tight pr-1">
              {mode.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ── Thinking / Typing indicator ──
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
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3]
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

const ChatWindow = ({ messages, isGenerating, onOpenCanvas, onDeleteMessage, onEditMessage, activeMode, setActiveMode }) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  const isEmpty = messages.length === 0 && !isGenerating;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <ChatLanding key="empty" activeMode={activeMode} setActiveMode={setActiveMode} />
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col py-2"
          >
            {messages.map((msg, index) => {
              // Ensure we have a bulletproof unique key, even on remounts
              const msgKey = msg.id || `msg-idx-${index}-${msg.role}`;
              return (
                <Message
                  key={msgKey}
                  role={msg.role}
                  content={msg.content}
                  steps={msg.steps}
                  stepTitle={msg.stepTitle}
                  domain={msg.domain}
                  visualizationType={msg.visualizationType}
                  onOpenCanvas={onOpenCanvas}
                  onDeleteMessage={onDeleteMessage}
                  onEditMessage={onEditMessage}
                  messageId={msg.id}
                  timestamp={msg.timestamp}
                  elements={msg.elements || msg.objects}
                  motion={msg.motion}
                  connections={msg.connections}
                  sequence={msg.sequence}
                  objects={msg.objects || msg.elements}
                  hasCanvas={msg.hasCanvas || !!(msg.elements?.length || msg.objects?.length || msg.steps?.length)}
                />
              );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
              {isGenerating && <ThinkingIndicator key="thinking" />}
            </AnimatePresence>

            <div ref={bottomRef} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWindow;
