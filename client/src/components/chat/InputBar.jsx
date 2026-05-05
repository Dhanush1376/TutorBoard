import React, { useRef, useEffect, useState } from 'react';
import {
  ArrowUp,
  Loader2,
  Square,
  Plus,
  ChevronDown,
  Mic,
  BookOpen,
  Lightbulb,
  GraduationCap,
  Activity,
  Layers,
  HelpCircle,
  FileText,
  Image,
  Settings2,
  X,
  Cpu,
  ClipboardCheck,
  Bot,
  Key,
  Globe,
  Sparkles,
  Lock,
  Timer,
  SkipBack
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';
import useWindowSize from '../../hooks/useWindowSize';
import { TRIAL_LIMITS, isFeatureBlocked } from '../../constants/trialConfig';

import { BASE_URL as API_URL } from '../../services/api';

const InputBar = ({ value, onChange, onSubmit, isGenerating, isLanding, activeMode, setActiveMode, selectedAgent, setSelectedAgent, onQuickAsk, onStopGeneration }) => {
  const { apiPrefs, switchApi, user } = useAuth();
  const { selectedTextContext, setSelectedTextContext } = useTutorStore(useShallow(s => ({
    selectedTextContext: s.selectedTextContext,
    setSelectedTextContext: s.setSelectedTextContext
  })));
  const textareaRef = useRef(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const isSpeechSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  // ─── Guest Trial State ───
  const isGuest = !!user?.isGuest;
  const { guestTrialStatus, showToast } = useTutorStore();

  const guestRemaining = Math.max(0, TRIAL_LIMITS.MAX_MESSAGES - (guestTrialStatus.messageCount || 0));
  const isTrialExhausted = isGuest && guestTrialStatus.isLimitReached;
  const isOnCooldown = isGuest && cooldownRemaining > 0;

  // ─── Guest Cooldown Timer ───
  useEffect(() => {
    // SEC-UX-03: Immediately clear timer if user is no longer a guest (login mid-cooldown)
    if (!isGuest) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      setCooldownRemaining(0);
      return;
    }

    const lastMsg = guestTrialStatus.lastMessageAt || 0;
    if (!lastMsg) return;
    const elapsed = Math.floor((Date.now() - lastMsg) / 1000);
    const remaining = TRIAL_LIMITS.COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) {
      setCooldownRemaining(remaining);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCooldownRemaining(0);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [isGuest, guestTrialStatus.lastMessageAt]);

  // Animated typing placeholder
  const placeholders = [
    "How does a Hash Map work?",
    "Explain the Greenhouse effect.",
    "Visualize Merge Sort steps.",
    "What is a Neural Network?",
    "Compare Mitosis and Meiosis."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(isLanding ? "" : "Message TutorBoard...");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Stop animation if not in landing mode or if a session has started/is generating
    if (!isLanding || isGenerating) {
      setCurrentPlaceholder("Message TutorBoard...");
      return;
    }

    let timeout;
    const typingSpeed = isDeleting ? 30 : 60;
    const fullText = placeholders[placeholderIndex];

    const runAnimation = () => {
      // SEC-UX: Strictly check visibility and active state before scheduling next frame
      if (document.visibilityState === 'hidden' || !isLanding || isGenerating) {
        timeout = setTimeout(runAnimation, 1000);
        return;
      }

      if (!isDeleting && currentPlaceholder === fullText) {
        timeout = setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && currentPlaceholder === "") {
        setIsDeleting(false);
        setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      } else {
        setCurrentPlaceholder(isDeleting
          ? fullText.substring(0, currentPlaceholder.length - 1)
          : fullText.substring(0, currentPlaceholder.length + 1));
      }
    };

    if (document.visibilityState === 'visible') {
      timeout = setTimeout(runAnimation, typingSpeed);
    } else {
      timeout = setTimeout(runAnimation, 1000);
    }

    return () => clearTimeout(timeout);
  }, [currentPlaceholder, isDeleting, placeholderIndex, placeholders, isLanding, isGenerating, document.visibilityState]);

  // SEC-UX-02: Manage visibility separately to avoid adding/removing listener every frame
  useEffect(() => {
    if (!isLanding || isGenerating) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // The main animation effect will pick up the change via its dependencies
        // if needed, but the stable listener prevents event spam
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isLanding, isGenerating]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (!isSpeechSupported) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onChange(value + (value ? ' ' : '') + transcript);
    };
    recognition.start();
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, activeMode]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isTrialExhausted || isOnCooldown) return;
      if (!isGenerating && (value.trim() || attachedFile)) {
        onSubmit(value, attachedFile);
        setAttachedFile(null); // Clear after submit
        setIsPlusMenuOpen(false);
        setIsAgentMenuOpen(false);
      }
    }
  };

  // ── Keyboard Shortcuts Listeners ──
  useEffect(() => {
    const handleToggleMenu = () => setIsAgentMenuOpen(prev => !prev);
    const handleFocusInput = () => textareaRef.current?.focus();

    window.addEventListener('toggle-agent-menu', handleToggleMenu);
    window.addEventListener('focus-input-bar', handleFocusInput);

    return () => {
      window.removeEventListener('toggle-agent-menu', handleToggleMenu);
      window.removeEventListener('focus-input-bar', handleFocusInput);
    };
  }, []);


  const agents = [
    { id: 'Universal', name: 'TutorBoard', icon: Bot, status: 'active', isSystem: true },
    ...(apiPrefs?.allKeys || [])
      .filter(k => k.isActive && k.isValid)
      .map(k => ({
        id: k._id || k.id,
        name: k.label || k.provider,
        icon: Key,
        status: k.isExpired ? 'expired' : (k.isLowCredits ? 'low' : 'active'),
        isCustom: true,
      }))
  ];

  const isAgentActive = (agentId) => {
    return selectedAgent === agentId;
  };

  const uploadActions = [
    { icon: FileText, label: 'Upload File', type: 'file' },
    { icon: Image, label: 'Upload Photo', type: 'photo' },
  ];

  const quickActions = [
    { icon: BookOpen, label: 'Quick Answer', mode: 'quick', guestAllowed: true },
    { icon: Layers, label: 'Deep Visual Dive', mode: 'deep', guestAllowed: false },
    { icon: ClipboardCheck, label: 'Test Me', mode: 'test_me', guestAllowed: false },
  ];

  const handleQuickAction = (mode) => {
    setActiveMode(mode);
    setIsToolsMenuOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleUploadAction = (type) => {
    // BUG FIX #102: Disable uploads in production until S3/Cloudinary is integrated
    if (import.meta.env.PROD) {
      showToast({
        message: "File uploads are temporarily disabled in production. Cloud storage integration (S3/Cloudinary) is in progress.",
        type: "info"
      });
      setIsPlusMenuOpen(false);
      return;
    }


    if (fileInputRef.current) {
      // Accept specific types based on 'type' parameter
      fileInputRef.current.accept = type === 'photo' ? 'image/*' : '*/*';
      fileInputRef.current.click();
    }
    setIsPlusMenuOpen(false);
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true; // Crucial for cookies
    xhr.open('POST', `${API_URL}/api/upload`, true);
    // Authorization header removed — browser sends httpOnly cookie automatically

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(0);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        if (data.url) {
          setAttachedFile({
            url: data.url,
            name: file.name,
            type: file.type,
            size: data.size
          });
        }
      } else {
        const errorData = JSON.parse(xhr.responseText || '{}');
        showToast({ message: errorData.error || 'Upload failed', type: 'error' });
      }

    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      showToast({ message: 'Network error during upload', type: 'error' });
    };


    xhr.send(formData);
  };

  const getPlaceholder = () => {
    if (activeMode === 'teach') return 'Enter a topic for live teaching...';
    if (isLanding) return currentPlaceholder;
    return 'Chat with TutorBoard...';
  };

  const { isMobile } = useWindowSize();

  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`w-full max-w-4xl mx-auto transition-transform duration-500 ${isFocused ? 'scale-[1.005]' : 'scale-100'}`}>
      <div className={`flex flex-col h-auto glass-strong ${isMobile ? 'rounded-2xl mx-2 mb-2' : 'rounded-[28px] mx-4 mb-4'} p-1.5 relative shadow-2xl transition-shadow duration-500 ${isFocused ? 'shadow-[0_20px_60px_rgba(0,0,0,0.2)] ring-[var(--text-primary)]/20' : 'ring-[var(--border-color)]'} ring-1`}>

        {/* Upload Progress Bar */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: uploadProgress / 100, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 left-0 right-0 h-[3px] bg-[#10b981] origin-left z-50 rounded-t-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            />
          )}
        </AnimatePresence>

        {/* ── Textarea Area (Top Box) ── */}
        <div className={`bg-[var(--bg-secondary)]/30 rounded-[22px] flex flex-col h-auto flex-shrink-0 transition-colors duration-300 ring-1 ring-inset relative overflow-hidden ${isFocused ? 'ring-[var(--text-primary)]/10 bg-[var(--bg-secondary)]/60' : 'ring-[var(--border-color)]/20 hover:bg-[var(--bg-secondary)]/50'}`}>

          {/* Generating Animation Line */}
          {isGenerating && (
            <motion.div
              className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--text-primary)] to-transparent z-10 w-1/2 opacity-70"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Active Mode/File Chips */}
          <AnimatePresence>
            {(activeMode || attachedFile || isUploading) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 pl-3 pt-3 flex-wrap"
              >
                {activeMode && (
                  <motion.div
                    layoutId="activeMode"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl shadow-md ring-1 ring-white/10"
                  >
                    {(() => {
                      const action = quickActions.find(a => a.mode === activeMode);
                      if (!action) return null;
                      const Icon = action.icon;
                      return (
                        <>
                          <Icon size={12} strokeWidth={2} className="opacity-90" />
                          <span className="text-[10px] font-medium tracking-tight">{action.label}</span>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => setActiveMode(null)}
                      className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </motion.div>
                )}

                {isUploading && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)] rounded-xl">
                    <Loader2 size={11} className="animate-spin" />
                    <span className="text-[9px] font-medium uppercase tracking-widest">Uploading</span>
                  </div>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-sm pr-1.5">
                    {attachedFile.type.startsWith('image/') ? (
                      <div className="w-6 h-6 rounded-lg overflow-hidden ring-1 ring-[var(--border-color)]">
                        <img src={attachedFile.url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                        <FileText size={12} strokeWidth={2.5} />
                      </div>
                    )}
                    <span className="text-[10px] font-medium tracking-tight max-w-[100px] truncate">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="ml-1 p-1 hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 rounded-lg transition-all"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Field Area */}
          {isTrialExhausted ? (
            <div className={`w-full px-6 ${isMobile ? 'pt-6 pb-4' : 'pt-8 pb-6'} flex flex-col items-center gap-3 animate-fade-in`}>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Lock size={20} strokeWidth={2} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">Trial limit reached</span>
                <p className="text-[12px] text-[var(--text-tertiary)] text-center max-w-[200px]">
                  Sign up for a free account to continue your learning journey
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Selected Context Pill */}
              <AnimatePresence>
                {selectedTextContext && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="mx-4 mt-3 mb-1 p-2 pl-3 bg-[var(--bg-tertiary)]/50 border-l-2 border-[var(--text-tertiary)] rounded-r-lg flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-medium truncate italic opacity-80">
                        "{selectedTextContext}"
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedTextContext(null)}
                      className="p-1 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative w-full">
                {/* Guest Trial Counter Pill */}
                {isGuest && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)]/30 text-[var(--text-tertiary)] rounded-full shadow-sm select-none"
                  >
                    <Activity size={10} strokeWidth={2.5} className="animate-pulse" />
                    <span className="text-[11px] font-bold tabular-nums tracking-tighter">
                      {guestRemaining}
                    </span>
                  </motion.div>
                )}
                <textarea
                  ref={textareaRef}
                  value={value}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={(e) => {
                    const maxLen = isGuest ? TRIAL_LIMITS.MAX_INPUT_LENGTH : 5000;
                    if (e.target.value.length <= maxLen) onChange(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isOnCooldown ? `Wait ${cooldownRemaining}s...` : getPlaceholder()}
                  maxLength={isGuest ? TRIAL_LIMITS.MAX_INPUT_LENGTH : 5000}
                  disabled={isOnCooldown}
                  className={`w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/60 resize-none px-4 ${isMobile ? 'py-2.5' : 'py-3.5'} outline-none text-[15px] transition-all duration-300 font-normal leading-relaxed ${isOnCooldown ? 'opacity-40 cursor-not-allowed' : ''}`}
                  rows={1}
                  style={{ minHeight: isMobile ? '44px' : '48px' }}
                />
                {/* Counter */}
                {isGuest && value.length > 0 && (
                  <div className="absolute right-4 bottom-2 text-[9px] font-medium text-[var(--text-tertiary)]/40 tabular-nums">
                    {value.length}/{TRIAL_LIMITS.MAX_INPUT_LENGTH}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Action Bar (Bottom Row) ── */}
        {/* ── Action Bar (Bottom Row) ── */}
        <div className="relative flex items-center justify-between px-2 py-1.5 min-h-[48px]">

          {/* Left Cluster */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => { setIsPlusMenuOpen(!isPlusMenuOpen); setIsToolsMenuOpen(false); setIsAgentMenuOpen(false); }}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] active:scale-95 ${isPlusMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-color)]/30' : 'text-[var(--text-tertiary)]'}`}
              >
                <Plus size={20} strokeWidth={2} />
              </button>
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className={`absolute bottom-full left-0 mb-4 ${isMobile ? 'w-44' : 'w-52'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[20px] overflow-hidden z-[100] shadow-2xl p-1.5`}
                  >
                    <div className="flex flex-col gap-1">
                      {uploadActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleUploadAction(action.type)}
                          className={`flex items-center justify-between w-full px-3 py-2.5 text-[13.5px] font-medium rounded-xl transition-all ${import.meta.env.PROD
                              ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/30'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <action.icon size={17} strokeWidth={2} />
                            <span>{action.label}</span>
                          </div>
                          {import.meta.env.PROD && (
                            <span className="text-[7.5px] uppercase font-bold bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-md">
                              Soon
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => { setIsToolsMenuOpen(!isToolsMenuOpen); setIsPlusMenuOpen(false); setIsAgentMenuOpen(false); }}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] active:scale-95 ${isToolsMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-color)]/30' : 'text-[var(--text-tertiary)]'}`}
              >
                <Settings2 size={20} strokeWidth={2} />
              </button>
              <AnimatePresence>
                {isToolsMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className={`absolute bottom-full left-0 mb-4 ${isMobile ? 'w-56' : 'w-64'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[20px] overflow-hidden z-[100] shadow-2xl p-1.5`}
                  >
                    <div className="flex flex-col gap-1">
                      {quickActions.map((action) => {
                        const isBlocked = isGuest && !action.guestAllowed;
                        const isActive = activeMode === action.mode;
                        return (
                          <button
                            key={action.label}
                            onClick={() => {
                              if (isBlocked) {
                                showToast({ message: `"${action.label}" requires a free account.`, type: 'info' });
                                setIsToolsMenuOpen(false);
                                return;
                              }
                              handleQuickAction(action.mode);
                            }}
                            className={`flex items-center justify-between gap-3 w-full px-3 py-2.5 text-[13.5px] font-medium rounded-xl transition-all ${isBlocked
                                ? 'opacity-40 cursor-not-allowed text-[var(--text-tertiary)]'
                                : isActive
                                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <action.icon size={17} strokeWidth={2} />
                              <span>{action.label}</span>
                            </div>
                            {isBlocked && <Lock size={12} strokeWidth={2.5} className="opacity-50" />}
                          </button>
                        );
                      })}
                      <div className="h-[1px] bg-[var(--border-color)]/40 my-1 mx-2" />
                      <button
                        onClick={() => { onQuickAsk?.(); setIsToolsMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-[13.5px] font-medium rounded-xl transition-all text-[#8b5cf6] hover:bg-[#8b5cf6]/10"
                      >
                        <Sparkles size={17} strokeWidth={2.5} />
                        <span>AI Assistant</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center: Agent Selector (Fixed Center) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
            <button
              onClick={() => { setIsAgentMenuOpen(!isAgentMenuOpen); setIsPlusMenuOpen(false); setIsToolsMenuOpen(false); }}
              className={`flex items-center justify-center gap-2 h-10 px-3 min-w-[100px] rounded-xl transition-all duration-200 hover:bg-[var(--bg-tertiary)] group active:scale-95 ${isAgentMenuOpen ? 'bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-color)]/30' : ''}`}
            >
              {(() => {
                const agent = agents.find(a => a.id === selectedAgent) || agents[0];
                const Icon = agent.icon;
                return (
                  <>
                    <Icon size={17} strokeWidth={2} className={`${isAgentMenuOpen ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}`} />
                    {!isMobile && (
                      <span className={`text-[9.5px] font-bold tracking-[0.05em] uppercase ${isAgentMenuOpen ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}`}>
                        {agent.name}
                      </span>
                    )}
                    <ChevronDown size={10} strokeWidth={2} className={`transition-transform duration-300 ${isAgentMenuOpen ? 'rotate-180 text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]/50 group-hover:text-[var(--text-tertiary)]'}`} />
                  </>
                );
              })()}
            </button>
            <AnimatePresence>
              {isAgentMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 ${isMobile ? 'w-48' : 'w-56'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[20px] overflow-hidden z-[100] p-1.5 shadow-2xl flex flex-col gap-1`}
                >
                  {agents.map((agent, idx) => {
                    const Icon = agent.icon;
                    const isActive = selectedAgent === agent.id;
                    const isFirstCustom = agent.isCustom && !agents[idx - 1]?.isCustom;

                    return (
                      <React.Fragment key={agent.id}>
                        {isFirstCustom && (
                          <div className="pt-2 pb-1 px-3 flex items-center gap-3">
                            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-[var(--text-tertiary)]/60">APIs</span>
                            <div className="flex-1 h-[1px] bg-[var(--border-color)]/30" />
                          </div>
                        )}
                        <button
                          onClick={() => { setSelectedAgent(agent.id); setIsAgentMenuOpen(false); }}
                          className={`flex items-center justify-between w-full px-3 py-2 text-[12px] rounded-xl transition-all font-medium ${isActive
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={16} strokeWidth={2} />
                            <span className="truncate max-w-[120px]">{agent.name}</span>
                          </div>
                          {isActive && (
                            <motion.div layoutId="agentActive" className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)] ring-2 ring-white/20" />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Cluster */}
          <div className="flex items-center justify-end gap-1">
            {isSpeechSupported && (
              <div className="relative">
                <AnimatePresence>
                  {isListening && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 2.2, opacity: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-red-500/20"
                    />
                  )}
                </AnimatePresence>
                <button
                  onClick={startListening}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${isListening
                      ? 'text-red-500 bg-red-500/15 ring-1 ring-red-500/20'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                >
                  <Mic size={20} strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Trial Badge */}


            {/* Cooldown */}
            {isOnCooldown && (
              <div className="flex items-center gap-1.5 h-10 px-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)]">
                <Timer size={11} strokeWidth={2} className="animate-pulse" />
                <span className="text-[10px] font-medium tabular-nums">{cooldownRemaining}s</span>
              </div>
            )}

            {isGenerating ? (
              <button
                onClick={onStopGeneration}
                className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all active:scale-90 group shadow-lg shadow-red-500/10 ring-1 ring-red-500/20"
              >
                <div className="absolute inset-0 rounded-xl border-[1.5px] border-red-500/20" />
                <motion.div
                  className="absolute inset-0 rounded-xl border-[1.5px] border-red-500 border-t-transparent border-l-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                />
                <Square size={13} strokeWidth={3} className="fill-current group-hover:scale-110 transition-transform" />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (isTrialExhausted || isOnCooldown) return;
                  if (value.trim() || attachedFile) {
                    onSubmit(value, attachedFile);
                    setAttachedFile(null);
                  }
                }}
                disabled={(!value.trim() && !attachedFile && !selectedTextContext) || isTrialExhausted || isOnCooldown}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 focus:outline-none shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 ${activeMode === 'teach' && (value.trim() || attachedFile || selectedTextContext)
                    ? 'bg-emerald-500 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
                    : (value.trim() || attachedFile || selectedTextContext)
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[var(--text-primary)]/20 hover:shadow-[var(--text-primary)]/30 hover:-translate-y-0.5'
                      : 'bg-[var(--text-primary)]/10 text-[var(--text-primary)]/40 shadow-none cursor-not-allowed'
                  }`}
              >
                {activeMode === 'teach' ? <GraduationCap size={22} strokeWidth={2} /> : <ArrowUp size={22} strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" onChange={onFileChange} className="hidden" />
    </div>
  );
};

export default InputBar;
