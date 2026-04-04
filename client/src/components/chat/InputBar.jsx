import React, { useRef, useEffect, useState } from 'react';
import { 
  ArrowUp, 
  Loader2, 
  Plus, 
  ChevronDown, 
  Mic, 
  BookOpen, 
  Trophy,
  GitCompare,
  PencilLine,
  Lightbulb,
  MessageSquare,
  Zap,
  MicOff,
  GraduationCap,
  X,
  Sparkles,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InputBar = ({ value, onChange, onSubmit, isGenerating, isLanding, activeMode, setActiveMode, isDark }) => {
  const textareaRef = useRef(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('DeepSeek R1');
  const [isListening, setIsListening] = useState(false);
  
  const placeholders = [
    "How does Binary Search work?",
    "Explain the Greenhouse effect.",
    "Visualize Bubble Sort steps.",
    "What is a Neural Network?",
    "Show me the process of Photosynthesis.",
    "Compare Mitosis and Meiosis."
  ];
  
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(isLanding ? "" : "Message TutorBoard...");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isLanding) {
      setCurrentPlaceholder("Message TutorBoard...");
      return;
    }

    let timeout;
    const typingSpeed = isDeleting ? 40 : 80;
    const fullText = placeholders[placeholderIndex];

    if (!isDeleting && currentPlaceholder === fullText) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && currentPlaceholder === "") {
      setIsDeleting(false);
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    } else {
      timeout = setTimeout(() => {
        const nextText = isDeleting 
          ? fullText.substring(0, currentPlaceholder.length - 1)
          : fullText.substring(0, currentPlaceholder.length + 1);
        setCurrentPlaceholder(nextText);
      }, typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [currentPlaceholder, isDeleting, placeholderIndex, isLanding]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onChange(value + (value ? ' ' : '') + transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && value.trim()) {
        onSubmit();
        setIsPlusMenuOpen(false);
        setIsAgentMenuOpen(false);
      }
    }
  };

  const actionChips = [
    { id: 'teach', icon: GraduationCap, label: 'Teach me', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' },
    { id: 'solve', icon: PencilLine, label: 'Solve Problem', color: 'bg-blue-500/10 border-blue-500/20 text-blue-600' },
    { id: 'quiz', icon: Trophy, label: 'Quiz me', color: 'bg-amber-500/10 border-amber-500/20 text-amber-600' },
    { id: 'visualize', icon: GitCompare, label: 'Visualize', color: 'bg-purple-500/10 border-purple-500/20 text-purple-600' },
    { id: 'deep', icon: Zap, label: 'Deep Dive', color: 'bg-rose-500/10 border-rose-500/20 text-rose-600' },
  ];

  const quickActions = [
    { id: 'teach', icon: GraduationCap, label: 'Teach me' },
    { id: 'solve', icon: PencilLine, label: 'Solve Problem' },
    { id: 'quiz', icon: Trophy, label: 'Quiz me' },
    { id: 'visualize', icon: GitCompare, label: 'Visualize' },
    { id: 'deep', icon: Zap, label: 'Deep Dive' },
  ];

  const handleChipClick = (chipId) => {
    if (activeMode === chipId) {
      setActiveMode('chat');
    } else {
      setActiveMode(chipId);
    }
    textareaRef.current?.focus();
  };

  const handleQuickAction = (chipId) => {
    setActiveMode(chipId);
    setIsPlusMenuOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const getPlaceholder = () => {
    if (activeMode !== 'chat') {
      const chip = actionChips.find(c => c.id === activeMode);
      return `Tell me what to ${chip?.label.toLowerCase()}...`;
    }
    if (isLanding) return currentPlaceholder;
    return 'Message TutorBoard...';
  };

  const agents = ['DeepSeek R1', 'TutorBoard Pro', 'GPT-4o', 'Sonnet 3.5'];

  return (
    <div className={`w-full transition-all duration-700 ${isLanding ? 'p-0' : 'max-w-3xl mx-auto px-4'}`}>
      <div className={`flex flex-col bg-[var(--bg-secondary)] backdrop-blur-3xl border border-[var(--border-color)] rounded-2xl relative transition-all duration-300 shadow-2xl group focus-within:border-[var(--text-tertiary)] focus-within:shadow-[0_0_0_1px_var(--border-color),0_20px_40px_-12px_rgba(0,0,0,0.15)] ${
        isLanding ? 'min-h-[120px]' : 'min-h-[50px] mb-2'
      } ${activeMode !== 'chat' ? 'border-[var(--text-tertiary)]/30' : ''}`}>
        
        {/* Active mode accent bar */}
        {activeMode !== 'chat' && (
          <motion.div
            layoutId="modeAccent"
            className={`absolute top-0 left-4 right-4 h-[2px] opacity-60 rounded-full bg-gradient-to-r from-transparent via-[var(--text-primary)] to-transparent`}
          />
        )}

        {/* Main Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none px-5 py-4 outline-none text-base transition-colors duration-250 font-medium"
          rows={1}
        />
        
        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between px-4 pb-3 mt-auto relative">
          <div className="flex items-center gap-2">
             
             {/* Plus Menu Button */}
             <div className="relative">
                <button 
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className={`p-1.5 transition-colors rounded-lg hover:bg-[var(--bg-tertiary)] ${isPlusMenuOpen ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)]'}`}
                >
                   <Plus size={18} />
                </button>

                <AnimatePresence>
                  {isPlusMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-[100]"
                    >
                       <div className="p-1.5 flex flex-col gap-0.5">
                          {quickActions.map((action) => (
                            <button 
                              key={action.label}
                              onClick={() => handleQuickAction(action.id)}
                              className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-all"
                            >
                              <action.icon size={16} /> <span>{action.label}</span>
                            </button>
                          ))}
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             {/* Selected Mode Badge */}
             <AnimatePresence>
               {activeMode !== 'chat' && (
                 <motion.div
                   initial={{ opacity: 0, x: -10, scale: 0.9 }}
                   animate={{ opacity: 1, x: 0, scale: 1 }}
                   exit={{ opacity: 0, x: -10, scale: 0.9 }}
                   className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shadow-sm ml-2 ${
                     actionChips.find(c => c.id === activeMode)?.color || 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                   }`}
                 >
                   <Sparkles size={12} className="opacity-70" />
                   <span>{actionChips.find(c => c.id === activeMode)?.label}</span>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setActiveMode('chat');
                     }}
                     className="ml-1 hover:opacity-70 transition-opacity"
                   >
                     <X size={12} />
                   </button>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
             {/* Agent Selector */}
             <div className="relative">
                <button 
                  onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[11px] font-bold uppercase tracking-wider"
                >
                   {selectedAgent}
                   <ChevronDown size={13} className={`transition-transform duration-200 ${isAgentMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isAgentMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-[100] p-1.5"
                    >
                      {agents.map(agent => (
                        <button 
                          key={agent}
                          onClick={() => {
                            setSelectedAgent(agent);
                            setIsAgentMenuOpen(false);
                          }}
                          className={`flex items-center w-full px-3 py-2 text-[13px] rounded-lg transition-all ${
                            selectedAgent === agent 
                              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold' 
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {agent}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             {/* Voice Assistant Button */}
             <div className="relative flex items-center justify-center">
               <AnimatePresence>
                 {isListening && (
                   <>
                     <motion.div
                       initial={{ scale: 0.8, opacity: 0 }}
                       animate={{ scale: 2, opacity: 0 }}
                       exit={{ opacity: 0 }}
                       transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                       className="absolute inset-0 rounded-full bg-red-500/20"
                     />
                     <motion.div
                       initial={{ scale: 0.8, opacity: 0 }}
                       animate={{ scale: 1.6, opacity: 0 }}
                       exit={{ opacity: 0 }}
                       transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                       className="absolute inset-0 rounded-full bg-red-500/30"
                     />
                   </>
                 )}
               </AnimatePresence>
               
               <motion.button 
                 whileTap={{ scale: 0.9 }}
                 onClick={startListening}
                 className={`relative z-10 p-2 rounded-xl transition-all ${
                   isListening 
                     ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                     : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                 }`}
                 title="Voice Input"
               >
                  <Mic size={20} />
               </motion.button>
             </div>

             <div className="flex items-center gap-3 ml-1">
                {isGenerating ? (
                  <div className="p-2 text-[var(--text-primary)]">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : (
                  <button 
                    onClick={onSubmit}
                    disabled={!value.trim()}
                    className={`p-2 rounded-xl disabled:opacity-30 hover:opacity-90 transition-all shadow-lg ${
                      activeMode !== 'chat' && value.trim()
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    } ${!value.trim() ? 'grayscale cursor-not-allowed' : ''}`}
                  >
                    {activeMode === 'teach' ? <GraduationCap size={20} /> : <ArrowUp size={20} />}
                  </button>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Action Chips (Horizontal Scrollable) */}
      {isLanding && (
        <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
          {actionChips.map((chip) => {
            const Icon = chip.icon;
            return (
              <motion.button
                key={chip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChipClick(chip.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-[12px] font-bold shadow-sm ${
                  activeMode === chip.id 
                    ? chip.color.replace('/10', '/30').replace('/20', '/50') + ' ring-2 ring-emerald-500/20'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Icon size={14} className="opacity-70" />
                <span>{chip.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InputBar;
