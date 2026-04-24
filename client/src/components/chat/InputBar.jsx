import React, { useRef, useEffect, useState } from 'react';
import {
  ArrowUp,
  Loader2,
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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import useTutorStore from '../../store/tutorStore';

import { BASE_URL as API_URL } from '../../services/api';

const InputBar = ({ value, onChange, onSubmit, isGenerating, isLanding, activeMode, setActiveMode, selectedAgent, setSelectedAgent, onQuickAsk }) => {
  const { apiPrefs, switchApi } = useAuth();
  const textareaRef = useRef(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isSpeechSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  // Animated typing placeholder
  const placeholders = [
    "How does a Hash Map work?",
    "Explain the Greenhouse effect.",
    "Visualize Merge Sort steps.",
    "What is a Neural Network?",
    "Show me the process of Photosynthesis.",
    "Compare Mitosis and Meiosis."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(isLanding ? "" : "Message TutorBoard...");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isLanding) { setCurrentPlaceholder("Message TutorBoard..."); return; }
    
    let timeout;
    const typingSpeed = isDeleting ? 30 : 60;
    const fullText = placeholders[placeholderIndex];

    const runAnimation = () => {
      if (document.visibilityState === 'hidden') {
        timeout = setTimeout(runAnimation, 1000); // Check again in 1s
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

    // Pause animation if tab is hidden to save battery
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeout);
        runAnimation();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (document.visibilityState === 'visible') {
      timeout = setTimeout(runAnimation, typingSpeed);
    } else {
      timeout = setTimeout(runAnimation, 1000);
    }

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentPlaceholder, isDeleting, placeholderIndex, isLanding]);

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
    { icon: BookOpen, label: 'Quick Answer', mode: 'quick' },
    { icon: Layers, label: 'Deep Visual Dive', mode: 'deep' },
    { icon: ClipboardCheck, label: 'Test Me', mode: 'test_me' },
  ];

  const handleQuickAction = (mode) => {
    setActiveMode(mode);
    setIsToolsMenuOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleUploadAction = (type) => {
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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (data.url) {
        setAttachedFile({
          url: data.url,
          name: file.name,
          type: file.type,
          size: data.size
        });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getPlaceholder = () => {
    if (activeMode === 'teach') return 'Enter a topic for live teaching...';
    if (isLanding) return currentPlaceholder;
    return 'Chat with TutorBoard...';
  };

  return (
    <div className="w-full">
      <div className={`flex flex-col bg-[var(--bg-secondary)] rounded-t-[28px] pt-2 px-3 pb-4 shadow-sm relative transition-all duration-300 group`}>

        {/* ── Textarea Area (Top Box) ── */}
        <div className="bg-transparent transition-all flex flex-col">
          
          {/* Active Mode Chip */}
          <AnimatePresence>
            {(activeMode || attachedFile || isUploading) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 pl-3 pt-3 flex-wrap"
              >
                {activeMode && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-sm">
                    {(() => {
                      const action = quickActions.find(a => a.mode === activeMode);
                      if (!action) return null;
                      const Icon = action.icon;
                      return (
                        <>
                          <div className="p-1 bg-[var(--text-primary)]/10 rounded-md text-[var(--text-primary)]">
                            <Icon size={12} strokeWidth={3} />
                          </div>
                          <span className="text-[11px] font-normal tracking-tight">{action.label}</span>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => setActiveMode(null)}
                      className="ml-1 p-1 hover:bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-full transition-colors"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                )}

                {isUploading && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)] rounded-xl">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[10px] uppercase tracking-widest">Uploading...</span>
                  </div>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-2.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-sm group/file">
                    {attachedFile.type.startsWith('image/') ? (
                      <div className="w-6 h-6 rounded-md overflow-hidden border border-[var(--border-color)]">
                        <img src={attachedFile.url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="p-1 bg-blue-500/10 rounded-md text-blue-500">
                        <FileText size={12} strokeWidth={3} />
                      </div>
                    )}
                    <span className="text-[11px] font-normal tracking-tight max-w-[120px] truncate">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="ml-1 p-1 hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 rounded-full transition-colors"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            maxLength={5000}
            className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none px-2 pt-4 pb-2 outline-none text-[15px] transition-colors duration-250 font-normal leading-relaxed"
            rows={1}
            style={{ minHeight: '52px' }}
          />
        </div>

        {/* ── Action Bar (Bottom Row) ── */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          
          <div className="flex items-center gap-1">
            {/* 1. Plus Menu (Uploads) */}
            <div className="relative">
              <button
                onClick={() => { setIsPlusMenuOpen(!isPlusMenuOpen); setIsToolsMenuOpen(false); }}
                className={`p-1.5 rounded-full transition-colors hover:bg-[var(--bg-tertiary)] ${isPlusMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Plus size={17} strokeWidth={2.5} />
              </button>
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute bottom-full left-0 mb-3 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100]"
                  >
                    <div className="p-2 flex flex-col gap-0.5">
                      {uploadActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleUploadAction(action.type)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-all"
                        >
                          <action.icon size={16} />
                          <span>{action.label}</span>
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
                className={`p-1.5 rounded-full transition-colors hover:bg-[var(--bg-tertiary)] ${isToolsMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Settings2 size={17} strokeWidth={2.5} />
              </button>
              <AnimatePresence>
                {isToolsMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute bottom-full left-0 mb-3 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100]"
                  >
                    <div className="p-2 flex flex-col gap-0.5">
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleQuickAction(action.mode)}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 text-[13px] font-normal rounded-xl transition-all ${activeMode === action.mode ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                        >
                          <action.icon size={16} />
                          <span>{action.label}</span>
                        </button>
                      ))}
                      <div className="h-[1px] bg-[var(--border-color)] my-1" />
                      <button
                        onClick={() => { onQuickAsk?.(); setIsToolsMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] font-normal rounded-xl transition-all text-[#8b5cf6] hover:bg-[#8b5cf6]/10"
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
                className={`p-1.5 rounded-full transition-all hover:bg-[var(--bg-tertiary)] ${isAgentMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
                title="Change AI Agent"
              >
                {(() => {
                  const agent = agents.find(a => a.id === selectedAgent) || agents[0];
                  const Icon = agent.icon;
                  return (
                    <div className="flex items-center gap-1.5 px-0.5">
                      <Icon size={15} strokeWidth={2.5} />
                      <span className="text-[11px] text-[var(--text-tertiary)] font-normal whitespace-nowrap overflow-hidden max-w-[80px] truncate">
                        {agent.name}
                      </span>
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
                    className="absolute bottom-full left-0 mb-3 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden z-[100] p-1.5 flex flex-col gap-0.5 shadow-xl"
                  >
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {agents.map((agent, idx) => {
                      const Icon = agent.icon;
                      const isActive = isAgentActive(agent.id);
                      const isFirstCustom = agent.isCustom && !agents[idx - 1]?.isCustom;

                      return (
                        <React.Fragment key={agent.id}>
                          {isFirstCustom && (
                            <div className="pt-2 pb-1 flex items-center gap-2 pr-2">
                              <span className="pl-3 text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] font-bold opacity-70 whitespace-nowrap">
                                Custom API's
                              </span>
                              <div className="flex-1 h-[1px] bg-[var(--border-color)] opacity-40" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const { setOverlay, setSettingsActiveSection } = useTutorStore.getState();
                                  setSettingsActiveSection('ai');
                                  setOverlay('settings');
                                  setIsAgentMenuOpen(false);
                                }}
                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors group/add"
                                title="Manage & Add APIs"
                              >
                                <Plus size={10} strokeWidth={3} className="opacity-60 group-hover/add:opacity-100" />
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => { 
                              setSelectedAgent(agent.id); 
                              setIsAgentMenuOpen(false); 
                            }}
                            className={`flex items-center justify-between w-full px-3 py-2.5 text-[12px] rounded-xl transition-all font-normal ${
                              isActive
                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon size={15} />
                              <span className="truncate max-w-[120px]">{agent.name}</span>
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
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
                  className={`p-1.5 rounded-full transition-all ${
                    isListening
                      ? 'text-red-500 bg-red-500/10'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <Mic size={18} strokeWidth={2.2} />
                </button>
              </div>
            )}

            {/* Send Button */}
            {isGenerating ? (
              <div className="p-2 text-[var(--text-primary)]">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <button
                onClick={() => {
                  if (value.trim() || attachedFile) {
                    onSubmit(value, attachedFile);
                    setAttachedFile(null);
                  }
                }}
                disabled={!value.trim() && !attachedFile}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all focus:outline-none ${
                  activeMode === 'teach' && (value.trim() || attachedFile)
                    ? 'bg-emerald-600 text-white shadow-md hover:scale-105 active:scale-95'
                    : (value.trim() || attachedFile)
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md hover:scale-105 active:scale-95 transition-transform'
                      : 'bg-[var(--text-primary)]/10 text-[var(--text-primary)]/50 cursor-not-allowed disabled:opacity-40'
                }`}
              >
                {activeMode === 'teach' ? <GraduationCap size={18} /> : <ArrowUp size={18} strokeWidth={2.5} />}
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
