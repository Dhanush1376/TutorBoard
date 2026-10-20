import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ArrowUp,
  Loader2,
  Square,
  Plus,
  ChevronDown,
  FileText,
  Image,
  X,
  Cpu,
  Bot,
  Lock,
  Timer,
  Mic,
  Shapes,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';
import useWindowSize from '../../hooks/useWindowSize';
import useVoiceInput from '../../hooks/useVoiceInput';
import { TRIAL_LIMITS } from '../../constants/trialConfig';
import BorderGlow from '../ui/BorderGlow';

import { BASE_URL as API_URL } from '../../services/api';

const InputBar = ({ 
  value = '', 
  onChange = () => {}, 
  onSubmit = () => {}, 
  isGenerating = false, 
  isLanding = false, 
  activeMode = null, 
  setActiveMode = () => {}, 
  selectedAgent = 'Universal', 
  setSelectedAgent = () => {}, 
  onQuickAsk = () => {}, 
  onStopGeneration = () => {} 
}) => {
  const { apiPrefs, switchApi, user } = useAuth();
  const { selectedTextContext, setSelectedTextContext } = useTutorStore(useShallow(s => ({
    selectedTextContext: s.selectedTextContext,
    setSelectedTextContext: s.setSelectedTextContext
  })));
  const textareaRef = useRef(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedFile, setAttachedFile] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const fileInputRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  // ─── Guest Trial State ───
  const isGuest = false; // Guest restrictions, counter pill & limits disabled per user request
  // S-1 FIX: Use targeted selector instead of subscribing to entire store
  const { guestTrialStatus, showToast } = useTutorStore(useShallow(s => ({
    guestTrialStatus: s.guestTrialStatus,
    showToast: s.showToast
  })));

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

  const [isFocused, setIsFocused] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(document.visibilityState === 'visible');
  const [isStopping, setIsStopping] = useState(false);

  // SEC-UX-02: Manage visibility separately to ensure reactivity
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Animation pause state consolidated to prevent unnecessary re-renders/effect triggers (Bug 5.3)
  const isAnimationPaused = !isLanding || isGenerating || isFocused || (value && value.length > 0);

  useEffect(() => {
    // Stop animation if not in landing mode or if a session has started/is generating
    // Also pause if user is currently typing or focused (Fixed: UX-01)
    if (isAnimationPaused) {
      if (textareaRef.current) textareaRef.current.placeholder = "Ask anything...";
      return;
    }

    const placeholders = [
      "Why do we have seasons?",
      "How does photosynthesis work?",
      "What caused the French Revolution?",
      "Explain supply and demand.",
      "How does a neuron fire?"
    ];

    let timeout;
    let isDeletingLocal = false;
    let pIndex = 0;
    let cText = "Ask anything...";

    const runAnimation = () => {
      // SEC-UX: Strictly check visibility and active state before scheduling next frame
      if (document.visibilityState === 'hidden' || isAnimationPaused || !textareaRef.current) {
        timeout = setTimeout(runAnimation, 1000);
        return;
      }

      const fullText = placeholders[pIndex];
      const typingSpeed = isDeletingLocal ? 30 : 60;

      if (!isDeletingLocal && cText === fullText) {
        timeout = setTimeout(() => { isDeletingLocal = true; runAnimation(); }, 2500);
        return;
      } else if (isDeletingLocal && cText === "") {
        isDeletingLocal = false;
        pIndex = (pIndex + 1) % placeholders.length;
      } else {
        cText = isDeletingLocal
          ? fullText.substring(0, cText.length - 1)
          : fullText.substring(0, cText.length + 1);
      }

      textareaRef.current.placeholder = cText;
      timeout = setTimeout(runAnimation, typingSpeed);
    };

    if (isTabVisible) {
      timeout = setTimeout(runAnimation, 60);
    } else {
      timeout = setTimeout(runAnimation, 1000);
    }

    return () => clearTimeout(timeout);
  }, [isTabVisible, isAnimationPaused]);


  useEffect(() => {
    if (!isGenerating) {
      setIsStopping(false);
    }
  }, [isGenerating]);


  // Auto-resize textarea logic
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Use useLayoutEffect for immediate height calculation before browser paint
  useEffect(() => {
    adjustHeight();
  }, [value, activeMode, adjustHeight]);

  // Handle container resize (e.g. sidebar open/close)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const observer = new ResizeObserver(() => {
      adjustHeight();
    });

    observer.observe(textarea);
    return () => observer.disconnect();
  }, [adjustHeight]);

  const handleKeyDown = (e) => {
    // Enter that confirms an IME composition (Chinese, Japanese, Korean…) is not a send
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isTrialExhausted || isOnCooldown) return;
      
      const isInterjection = isGenerating;
      const hasContent = value.trim() || attachedFile || selectedTextContext;
      if (hasContent) {
        import.meta.env.DEV && console.log('[InputBar] Enter pressed (Interjection:', isInterjection, '), submitting...');
        onSubmit(value, attachedFile, activeMode);
        setAttachedFile(null);
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
        icon: Cpu, // Improved icon for custom models
        status: k.isExpired ? 'expired' : (k.isLowCredits ? 'low' : 'active'),
        isCustom: true,
      }))
  ];

  const uploadActions = [
    { icon: FileText, label: 'Upload File', type: 'file' },
    { icon: Image, label: 'Upload Photo', type: 'photo' },
  ];

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

    // SEC-GDPR: Rely on withCredentials and HttpOnly cookies for CSRF rather than manual JS read

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

  const { isMobile } = useWindowSize();

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: (transcript) => {
      onChange(value ? `${value} ${transcript}` : transcript);
    },
    onStateChange: (listening) => {
      if (listening) {
        showToast({ message: "Listening... Talk to TutorBoard", type: "success", duration: 2000 });
      }
    }
  });

  // Menus close when you tap anywhere else.
  const rootRef = useRef(null);
  const anyMenu = isPlusMenuOpen || isAgentMenuOpen || isToolsOpen;
  useEffect(() => {
    if (!anyMenu) return undefined;
    const away = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsPlusMenuOpen(false);
        setIsAgentMenuOpen(false);
        setIsToolsOpen(false);
      }
    };
    // Capture phase: the sidebar stops pointer events from bubbling.
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [anyMenu]);

  // Only offer what actually works here.
  const canUpload = !import.meta.env.PROD;
  const canSpeak = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const drawing = activeMode === 'deep';
  const hasContent = !!(value?.trim() || attachedFile || selectedTextContext);
  const currentAgent = agents.find((a) => a.id === selectedAgent) || agents[0];

  const send = () => {
    if (isTrialExhausted || isOnCooldown || !hasContent) return;
    onSubmit(value, attachedFile, activeMode);
    setAttachedFile(null);
    setIsPlusMenuOpen(false);
    setIsAgentMenuOpen(false);
    setIsToolsOpen(false);
  };

  const closeMenus = () => {
    setIsPlusMenuOpen(false);
    setIsAgentMenuOpen(false);
    setIsToolsOpen(false);
  };

  const iconBtn = (on) =>
    `grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${
      on ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
    }`;
  const menu = 'absolute bottom-full left-0 mb-3 z-[100] overflow-hidden rounded-2xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]';
  const item = 'flex w-full cursor-pointer items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-[13.5px] transition-colors';
  const pop = { initial: { opacity: 0, y: 6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 6, scale: 0.98 }, transition: { duration: 0.16 } };

  return (
    <div ref={rootRef} className={`mx-auto w-full max-w-3xl overflow-visible ${isMobile ? 'px-3 pb-[max(env(safe-area-inset-bottom),12px)]' : 'px-4 pb-4'}`}>
      <BorderGlow
        isFocused={isFocused}
        borderRadius={28}
        glowRadius={12}
        glowIntensity={0.4}
        edgeSensitivity={20}
        coneSpread={24}
        speed={0.016}
        colors={['#ffffff', '#fb923c', '#ea580c']}
        glowColor="26 92% 58%"
        backgroundColor="var(--bg-secondary)"
        className="w-full overflow-visible transition-[border-color,background-color,box-shadow] duration-300"
      >
        <div
          onClick={(e) => e.target === e.currentTarget && textareaRef.current?.focus()}
          className="relative flex flex-col rounded-[28px] overflow-visible"
        >
        {/* Upload progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: uploadProgress / 100, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-6 right-6 top-0 z-50 h-[2px] origin-left rounded-full bg-[var(--text-primary)]"
            />
          )}
        </AnimatePresence>

        {/* Chips: drawing mode, quoted text, attachment */}
        <AnimatePresence>
          {(drawing || attachedFile || isUploading || selectedTextContext) && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2 px-4 pt-3.5">
              {drawing && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] py-1 pl-2.5 pr-1 text-[12px] font-medium text-[var(--bg-primary)]">
                  <Shapes size={12} strokeWidth={2} />
                  Draw on canvas
                  <button type="button" aria-label="Turn off drawing" onClick={() => setActiveMode(null)} className="grid h-5 w-5 cursor-pointer place-items-center rounded-full opacity-70 hover:bg-[var(--bg-primary)]/20 hover:opacity-100">
                    <X size={11} strokeWidth={2.4} />
                  </button>
                </span>
              )}
              {selectedTextContext && (
                <span className="flex max-w-full items-center gap-1.5 rounded-full bg-[var(--st-fill-strong)] py-1 pl-3 pr-1 text-[12.5px] text-[var(--text-secondary)]">
                  <span className="truncate">“{selectedTextContext}”</span>
                  <button type="button" aria-label="Remove quote" onClick={() => setSelectedTextContext(null)} className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                    <X size={11} strokeWidth={2.4} />
                  </button>
                </span>
              )}
              {isUploading && (
                <span className="flex items-center gap-2 rounded-full bg-[var(--st-fill-strong)] px-3 py-1 text-[12px] text-[var(--text-tertiary)]">
                  <Loader2 size={12} className="animate-spin" /> Uploading
                </span>
              )}
              {attachedFile && (
                <span className="flex items-center gap-2 rounded-full bg-[var(--st-fill-strong)] py-0.5 pl-0.5 pr-1">
                  {attachedFile.type.startsWith('image/') ? (
                    <img src={attachedFile.url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                      <FileText size={12} />
                    </span>
                  )}
                  <span className="max-w-[140px] truncate text-[12.5px] text-[var(--text-primary)]">{attachedFile.name}</span>
                  <button type="button" aria-label="Remove file" onClick={() => setAttachedFile(null)} className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                    <X size={11} strokeWidth={2.4} />
                  </button>
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text */}
        {isTrialExhausted ? (
          <div className="flex flex-col items-center gap-2 px-6 py-7 text-center">
            <Lock size={18} className="text-[var(--text-tertiary)]" />
            <span className="text-[14px] font-medium text-[var(--text-primary)]">Free questions used up</span>
            <span className="text-[12.5px] text-[var(--text-tertiary)]">Sign up free to keep learning.</span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length <= 5000) onChange(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isOnCooldown ? `Wait ${cooldownRemaining}s…` : drawing ? 'What should I draw for you?' : 'Ask anything…'}
            maxLength={5000}
            disabled={isOnCooldown}
            rows={2}
            style={{ minHeight: 96 }}
            className="w-full resize-none border-none bg-transparent px-5 pb-3 pt-5 text-[15.5px] leading-[1.6] text-[var(--text-primary)] shadow-none outline-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:shadow-none disabled:opacity-40"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-2.5 pb-2.5">
          {/* Left: may shrink. Right: mic and send never move or overlap. */}
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {canUpload && (
            <div className="relative">
              <button type="button" aria-label="Attach" onClick={() => { const o = !isPlusMenuOpen; closeMenus(); setIsPlusMenuOpen(o); }} className={iconBtn(isPlusMenuOpen)}>
                <Plus size={20} strokeWidth={1.7} />
              </button>
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <motion.div {...pop} className={`${menu} w-48`}>
                    {uploadActions.map((a) => (
                      <button key={a.label} type="button" onClick={() => handleUploadAction(a.type)} className={`${item} text-[var(--text-primary)] hover:bg-[var(--st-fill)]`}>
                        <a.icon size={16} strokeWidth={1.8} className="text-[var(--text-secondary)]" />
                        {a.type === 'photo' ? 'Photo' : 'File'}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Tools: the one option that changes the answer */}
          <div className="relative">
            <button
              type="button"
              aria-label="Answer options"
              onClick={() => { const o = !isToolsOpen; closeMenus(); setIsToolsOpen(o); }}
              className={iconBtn(isToolsOpen || drawing)}
            >
              <SlidersHorizontal size={18} strokeWidth={1.7} />
            </button>
            <AnimatePresence>
              {isToolsOpen && (
                <motion.div {...pop} className={`${menu} w-[184px]`}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode(drawing ? null : 'deep');
                      setIsToolsOpen(false);
                    }}
                    className={`${item} ${
                      drawing
                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium shadow-sm'
                        : 'text-[var(--text-primary)] hover:bg-[var(--st-fill)]'
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${drawing ? 'bg-[var(--bg-primary)]/20 text-[var(--bg-primary)]' : 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]'}`}>
                      <Shapes size={15} strokeWidth={1.9} />
                    </span>
                    <span className="flex-1 truncate text-[13px] font-medium">Draw on canvas</span>
                    {drawing && <Check size={14} strokeWidth={2.4} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Model */}
          <div className="relative min-w-0">
            <button
              type="button"
              aria-label="Choose model"
              onClick={() => { const o = !isAgentMenuOpen; closeMenus(); setIsAgentMenuOpen(o); }}
              className={`flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-[var(--st-fill-strong)] ${isAgentMenuOpen ? 'bg-[var(--st-fill-strong)]' : ''}`}
            >
              <currentAgent.icon size={16} strokeWidth={1.7} className="shrink-0 text-[var(--text-secondary)]" />
              <span className="max-w-[120px] truncate text-[12px] font-medium tracking-tight text-[var(--text-primary)]">{currentAgent.name}</span>
              <ChevronDown size={14} strokeWidth={1.8} className={`shrink-0 text-[var(--text-tertiary)] transition-transform ${isAgentMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isAgentMenuOpen && (
                <motion.div {...pop} className={`${menu} w-60`}>
                  {agents.map((a) => {
                    const on = selectedAgent === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setSelectedAgent(a.id); setIsAgentMenuOpen(false); }}
                        className={`${item} ${on ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'}`}
                      >
                        <a.icon size={16} strokeWidth={1.8} />
                        <span className="flex-1 truncate">{a.name}</span>
                        {on && <Check size={15} className="text-[var(--mk-accent)]" />}
                      </button>
                    );
                  })}
                  <div className="my-1 h-px bg-[var(--st-line)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsAgentMenuOpen(false);
                      const st = useTutorStore.getState();
                      st.setSettingsActiveSection?.('ai');
                      st.setOverlay?.('settings');
                    }}
                    className={`${item} text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]`}
                  >
                    <Plus size={16} strokeWidth={1.8} />
                    Add your own key
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isOnCooldown && (
              <span className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--st-fill-strong)] px-3 text-[12px] tabular-nums text-[var(--text-tertiary)]">
                <Timer size={12} /> {cooldownRemaining}s
              </span>
            )}
            {canSpeak && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? 'Stop listening' : 'Speak your question'}
                className={isListening ? 'grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-red-500 text-white' : iconBtn(false)}
              >
                <Mic size={18} strokeWidth={1.7} className={isListening ? 'animate-pulse' : ''} />
              </button>
            )}
            {isGenerating && !hasContent ? (
              <button
                type="button"
                onClick={() => { setIsStopping(true); onStopGeneration(); }}
                disabled={isStopping}
                aria-label="Stop"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={send}
                disabled={!hasContent || isTrialExhausted || isOnCooldown}
                aria-label="Send"
                className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
                  hasContent
                    ? 'cursor-pointer bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] hover:scale-[1.04]'
                    : 'cursor-default text-[var(--text-primary)] opacity-60'
                }`}
              >
                <ArrowUp size={19} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
        </div>
      </BorderGlow>

      <input ref={fileInputRef} type="file" onChange={onFileChange} className="hidden" />
    </div>
  );
};

export default InputBar;
