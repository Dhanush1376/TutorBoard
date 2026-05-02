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
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import useTutorStore from '../../store/tutorStore';
import useWindowSize from '../../hooks/useWindowSize';
import { TRIAL_LIMITS, isFeatureBlocked } from '../../constants/trialConfig';

import { BASE_URL as API_URL } from '../../services/api';

const InputBar = ({ value, onChange, onSubmit, isGenerating, isLanding, activeMode, setActiveMode, selectedAgent, setSelectedAgent, onQuickAsk, onStopGeneration }) => {
  const { apiPrefs, switchApi, user } = useAuth();
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
    if (!isGuest) return;
    const lastMsg = guestTrialStatus.lastMessageAt || 0;
    if (!lastMsg) return;
    const elapsed = Math.floor((Date.now() - lastMsg) / 1000);
    const remaining = TRIAL_LIMITS.COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) {
      setCooldownRemaining(remaining);
      cooldownTimerRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
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
  }, [currentPlaceholder, isDeleting, placeholderIndex, placeholders, isLanding, isGenerating]);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
    xhr.open('POST', `${API_URL}/api/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('tb-token')}`);

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

  return (
    <div className="w-full">
      <div className={`flex flex-col liquid-glass ${isMobile ? 'rounded-t-2xl' : 'rounded-t-[32px]'} pt-2 px-2 pb-1 relative transition-all duration-300 group`}>
        
        {/* Upload Progress Bar */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: uploadProgress / 100, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#10b981] origin-left z-50 rounded-t-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            />
          )}
        </AnimatePresence>

        {/* ── Textarea Area (Top Box) ── */}
        <div className="bg-transparent transition-all flex flex-col">
          
          {/* Active Mode Chip */}
          <AnimatePresence>
            {(activeMode || attachedFile || isUploading) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 pl-2 pt-2 flex-wrap"
              >
                {activeMode && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg shadow-sm">
                    {(() => {
                      const action = quickActions.find(a => a.mode === activeMode);
                      if (!action) return null;
                      const Icon = action.icon;
                      return (
                        <>
                          <div className="p-1 bg-[var(--text-primary)]/10 rounded-md text-[var(--text-primary)]">
                            <Icon size={10} strokeWidth={3} />
                          </div>
                          <span className="text-[10px] font-normal tracking-tight">{action.label}</span>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => setActiveMode(null)}
                      className="ml-0.5 p-0.5 hover:bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-full transition-colors"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}

                {isUploading && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)] rounded-lg">
                    <Loader2 size={10} className="animate-spin" />
                    <span className="text-[9px] uppercase tracking-widest">Uploading</span>
                  </div>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg shadow-sm">
                    {attachedFile.type.startsWith('image/') ? (
                      <div className="w-5 h-5 rounded-sm overflow-hidden border border-[var(--border-color)]">
                        <img src={attachedFile.url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="p-1 bg-blue-500/10 rounded-md text-blue-500">
                        <FileText size={10} strokeWidth={3} />
                      </div>
                    )}
                    <span className="text-[10px] font-normal tracking-tight max-w-[80px] truncate">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="ml-0.5 p-0.5 hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 rounded-full transition-colors"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guest Trial: Limit-reached block or cooldown overlay */}
          {isTrialExhausted ? (
            <div className={`w-full px-3 ${isMobile ? 'pt-3 pb-2' : 'pt-4 pb-3'} flex flex-col items-center gap-2`}>
              <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                <Lock size={14} strokeWidth={2.5} />
                <span className="text-[13px] font-medium">Trial limit reached</span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] text-center opacity-70">
                Create a free account to continue learning
              </p>
            </div>
          ) : (
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  const maxLen = isGuest ? TRIAL_LIMITS.MAX_INPUT_LENGTH : 5000;
                  if (e.target.value.length <= maxLen) onChange(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={isOnCooldown ? `Wait ${cooldownRemaining}s...` : getPlaceholder()}
                maxLength={isGuest ? TRIAL_LIMITS.MAX_INPUT_LENGTH : 5000}
                disabled={isOnCooldown}
                className={`w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none px-3 ${isMobile ? 'pt-4 pb-2' : 'pt-5 pb-3'} outline-none text-[17px] transition-colors duration-250 font-normal leading-relaxed ${isOnCooldown ? 'opacity-40 cursor-not-allowed' : ''}`}
                rows={1}
                style={{ minHeight: isMobile ? '56px' : '64px' }}
              />
              {/* Guest character counter */}
              {isGuest && value.length > 0 && (
                <div className="absolute right-2 bottom-1 text-[9px] font-medium text-[var(--text-tertiary)] opacity-50">
                  {value.length}/{TRIAL_LIMITS.MAX_INPUT_LENGTH}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action Bar (Bottom Row) ── */}
        <div className="flex items-center justify-between px-1.5 pt-0.5 pb-0.5">
          
          <div className="flex items-center gap-1">
            {/* 1. Plus Menu (Uploads) */}
            <div className="relative">
              <button
                onClick={() => { setIsPlusMenuOpen(!isPlusMenuOpen); setIsToolsMenuOpen(false); }}
                className={`p-2 rounded-full transition-colors hover:bg-[var(--bg-tertiary)] ${isPlusMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Plus size={isMobile ? 20 : 17} strokeWidth={2.5} />
              </button>
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className={`absolute bottom-full left-0 mb-3 ${isMobile ? 'w-40' : 'w-48'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100] shadow-xl`}
                  >
                    <div className="p-1.5 flex flex-col gap-0.5">
                      {uploadActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleUploadAction(action.type)}
                          className={`flex items-center justify-between w-full px-3 py-3 text-[14px] font-normal rounded-xl transition-all ${
                            import.meta.env.PROD 
                              ? 'opacity-60 cursor-not-allowed text-[var(--text-tertiary)]' 
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <action.icon size={16} />
                            <span>{action.label}</span>
                          </div>
                          {import.meta.env.PROD && (
                            <span className="text-[7px] uppercase tracking-tighter font-bold bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md border border-[var(--border-color)]">
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

            {/* 2. Tools Menu (Teaching Modes) */}
            <div className="relative">
              <button
                onClick={() => { setIsToolsMenuOpen(!isToolsMenuOpen); setIsPlusMenuOpen(false); }}
                className={`p-2 rounded-full transition-colors hover:bg-[var(--bg-tertiary)] ${isToolsMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Settings2 size={isMobile ? 20 : 17} strokeWidth={2.5} />
              </button>
              <AnimatePresence>
                {isToolsMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className={`absolute bottom-full left-0 mb-3 ${isMobile ? 'w-52' : 'w-56'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100] shadow-xl`}
                  >
                    <div className="p-1.5 flex flex-col gap-0.5">
                      {quickActions.map((action) => {
                        const isBlocked = isGuest && !action.guestAllowed;
                        return (
                          <button
                            key={action.label}
                            onClick={() => {
                              if (isBlocked) {
                                showToast({
                                  message: `"${action.label}" requires a free account. Sign up to unlock all modes.`,
                                  type: 'info'
                                });
                                setIsToolsMenuOpen(false);
                                return;
                              }
                              handleQuickAction(action.mode);
                            }}

                            className={`flex items-center justify-between gap-3 w-full px-3 py-3 text-[14px] font-normal rounded-xl transition-all ${
                              isBlocked
                                ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)]'
                                : activeMode === action.mode 
                                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <action.icon size={16} />
                              <span>{action.label}</span>
                            </div>
                            {isBlocked && <Lock size={12} strokeWidth={2.5} className="text-[var(--text-tertiary)] opacity-60" />}
                          </button>
                        );
                      })}
                      <div className="h-[1px] bg-[var(--border-color)] my-1" />
                      <button
                        onClick={() => { onQuickAsk?.(); setIsToolsMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-3 text-[14px] font-normal rounded-xl transition-all text-[#8b5cf6] hover:bg-[#8b5cf6]/10"
                      >
                        <Sparkles size={16} />
                        <span>AI Quick Assistant</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Agent Selector (Compact) */}
            <div className="relative">
              <button
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className={`p-1 rounded-full transition-all hover:bg-[var(--bg-tertiary)] ${isAgentMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
                title="Change AI Agent"
              >
                {(() => {
                  const agent = agents.find(a => a.id === selectedAgent) || agents[0];
                  const Icon = agent.icon;
                  return (
                    <div className="flex items-center gap-1.5 px-1.5">
                      <Icon size={isMobile ? 20 : 16} strokeWidth={2.5} />
                      {!isMobile && (
                        <span className="text-[11px] text-[var(--text-tertiary)] font-normal whitespace-nowrap overflow-hidden max-w-[80px] truncate">
                          {agent.name}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </button>
              <AnimatePresence>
                {isAgentMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className={`absolute bottom-full left-0 mb-3 ${isMobile ? 'w-44' : 'w-48'} bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100] p-1.5 flex flex-col gap-0.5 shadow-xl`}
                  >
                    {agents.map((agent, idx) => {
                      const Icon = agent.icon;
                      const isActive = isAgentActive(agent.id);
                      const isFirstCustom = agent.isCustom && !agents[idx - 1]?.isCustom;

                      return (
                        <React.Fragment key={agent.id}>
                          {isFirstCustom && (
                            <div className="pt-2 pb-1 flex items-center gap-2 pr-2">
                              <span className="pl-3 text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold opacity-70 whitespace-nowrap">
                                APIs
                              </span>
                              <div className="flex-1 h-[1px] bg-[var(--border-color)] opacity-40" />
                            </div>
                          )}
                          <button
                            onClick={() => { 
                              setSelectedAgent(agent.id); 
                              setIsAgentMenuOpen(false); 
                            }}
                            className={`flex items-center justify-between w-full px-3 py-3 text-[13px] rounded-xl transition-all font-normal ${
                              isActive
                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon size={15} />
                              <span className="truncate max-w-[110px]">{agent.name}</span>
                            </div>
                            
                            {isActive && (
                              <div className="flex items-center">
                                 <motion.div 
                                   initial={{ scale: 0.8 }}
                                   animate={{ scale: [1, 1.2, 1] }}
                                   transition={{ duration: 2, repeat: Infinity }}
                                   className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]" 
                                 />
                              </div>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            {/* Voice */}
            {isSpeechSupported && (
              <div className="relative flex items-center justify-center">
                <AnimatePresence>
                  {isListening && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 2, opacity: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-red-500/20"
                    />
                  )}
                </AnimatePresence>
                <button
                  onClick={startListening}
                  title="Voice Input"
                  className={`p-2 rounded-full transition-all ${
                    isListening
                      ? 'text-red-500 bg-red-500/10'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <Mic size={isMobile ? 22 : 18} strokeWidth={2.2} />
                </button>
              </div>
            )}

            {/* Guest remaining count badge */}
            {isGuest && !isTrialExhausted && (
              <div 
                className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{
                  background: guestRemaining <= 3 ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)',
                  border: `1px solid ${guestRemaining <= 3 ? 'rgba(239,68,68,0.15)' : 'var(--border-color)'}`,
                }}
                title={`${guestRemaining} trial messages remaining`}
              >
                <span className={`text-[10px] font-bold tracking-tight ${
                  guestRemaining <= 3 ? 'text-red-400' : 'text-[var(--text-tertiary)]'
                }`}>
                  {guestRemaining}/{TRIAL_LIMITS.MAX_MESSAGES}
                </span>
              </div>
            )}

            {/* Cooldown indicator */}
            {isOnCooldown && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <Timer size={10} strokeWidth={2.5} className="text-[var(--text-tertiary)] animate-pulse" />
                <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{cooldownRemaining}s</span>
              </div>
            )}

            {/* Send / Stop Button */}
            {isGenerating ? (
              <button
                onClick={onStopGeneration}
                title="Stop generating"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all active:scale-90 group"
              >
                <Square size={16} strokeWidth={3} className="group-hover:scale-110 transition-transform" fill="currentColor" />
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
                disabled={(!value.trim() && !attachedFile) || isTrialExhausted || isOnCooldown}
                className={`${isMobile ? 'w-10 h-10' : 'w-9 h-9'} flex items-center justify-center rounded-full transition-all focus:outline-none ${
                  isTrialExhausted || isOnCooldown
                    ? 'bg-[var(--text-primary)]/10 text-[var(--text-primary)]/30 cursor-not-allowed'
                    : activeMode === 'teach' && (value.trim() || attachedFile)
                      ? 'bg-emerald-600 text-white shadow-md hover:scale-105 active:scale-95'
                      : (value.trim() || attachedFile)
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md hover:scale-105 active:scale-95 transition-transform'
                        : 'bg-[var(--text-primary)]/10 text-[var(--text-primary)]/50 cursor-not-allowed disabled:opacity-40'
                }`}
              >
                {activeMode === 'teach' ? <GraduationCap size={isMobile ? 20 : 18} /> : <ArrowUp size={isMobile ? 20 : 18} strokeWidth={2.5} />}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden File Input */}
      <input 
        ref={fileInputRef}
        type="file"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
};

export default InputBar;
