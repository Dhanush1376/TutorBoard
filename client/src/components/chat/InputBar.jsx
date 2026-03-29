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
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InputBar = ({ value, onChange, onSubmit, isGenerating, isLanding }) => {
  const textareaRef = useRef(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('DeepSeek R1');
  const [isListening, setIsListening] = useState(false);

  // Voice Assistant logic
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

  const agents = ['DeepSeek R1', 'TutorBoard Pro', 'GPT-4o', 'Sonnet 3.5'];

  // TutorBoard-relevant quick actions
  const quickActions = [
    { icon: BookOpen, label: 'Explain step-by-step', prefix: 'Explain step-by-step: ' },
    { icon: Trophy, label: 'Quiz me', prefix: 'Generate a quiz on: ' },
    { icon: GitCompare, label: 'Compare concepts', prefix: 'Compare and visualize: ' },
    { icon: PencilLine, label: 'Practice problems', prefix: 'Give me practice problems for: ' },
    { icon: Lightbulb, label: 'Think deeply', prefix: '[think deeply] ' },
  ];

  const handleQuickAction = (prefix) => {
    onChange(prefix);
    setIsPlusMenuOpen(false);
    // Focus the textarea after prefilling
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className={`w-full transition-all duration-700 ${isLanding ? 'p-0' : 'max-w-3xl mx-auto px-4'}`}>
      <div className={`flex flex-col bg-[var(--bg-secondary)] backdrop-blur-3xl border border-[var(--border-color)] rounded-2xl relative transition-all duration-300 shadow-2xl group focus-within:border-[var(--text-tertiary)] focus-within:shadow-[0_0_0_1px_var(--border-color),0_20px_40px_-12px_rgba(0,0,0,0.15)] ${
        isLanding ? 'min-h-[120px]' : 'min-h-[50px] mb-2'
      }`}>
        
        {/* Main Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to learn today?"
          className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none px-5 py-4 outline-none text-base transition-colors duration-250 font-medium"
          rows={1}
        />
        
        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between px-4 pb-3 mt-auto relative">
          <div className="flex items-center gap-2">
             
             {/* Plus Menu Button — Teaching Tools */}
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
                              onClick={() => handleQuickAction(action.prefix)}
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
          </div>

          <div className="flex items-center gap-2">
             {/* Voice Assistant Button with Premium Animation */}
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
                  {isListening ? <Mic size={20} /> : <Mic size={20} />}
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
                    className={`p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl disabled:opacity-30 hover:opacity-90 transition-all shadow-lg ${!value.trim() ? 'grayscale cursor-not-allowed' : ''}`}
                  >
                    <ArrowUp size={20} />
                  </button>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
