import React, { useState, useRef, useEffect } from 'react';
import ChatHistory from './ChatHistory';
import { Plus, Search, MessageSquare, Library, PanelLeftClose, Settings, Send, BookOpen, Lightbulb, HelpCircle, Activity, Layers, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ 
  chatHistory, 
  activeChatId, 
  onSelectChat, 
  onNewChat,
  onLoadModule,
  onClose,
  onDeleteChat,
  onRenameChat,
  activeView,
  setActiveView,
  prompt,
  setPrompt,
  onSubmit,
  isGenerating,
  selectedAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const filteredHistory = searchQuery.trim()
    ? chatHistory.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistory;

  // Handle click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const newChatOptions = [
    { label: 'Teach Me', icon: <BookOpen size={14} />, mode: 'teach' },
    { label: 'Solve Problem', icon: <Lightbulb size={14} />, mode: 'solve' },
    { label: 'Quiz Me', icon: <HelpCircle size={14} />, mode: 'quiz' },
    { label: 'Visualize', icon: <Activity size={14} />, mode: 'visualize' },
    { label: 'Deep Dive', icon: <Layers size={14} />, mode: 'deepdive' },
  ];

  const handleNewChatOption = (mode) => {
    onNewChat(mode); // Passing mode if backend supports it
    setActiveView('chat');
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col h-full text-[var(--text-primary)] transition-colors duration-300 font-sans min-h-0 bg-[var(--bg-primary)]">
      
      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)]">
        {/* Branding Header */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--text-primary)] rounded-md flex items-center justify-center">
              <span className="text-[var(--bg-primary)] text-[10px] font-black">T</span>
            </div>
            <span className="text-[13px] font-bold tracking-[0.15em] text-[var(--text-primary)] uppercase">
              TutorBoard
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
            title="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Primary Actions */}
        <div className="px-3 pb-3 space-y-2">
          {/* New Chat Dropdown Container */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-2">
                <Plus size={16} />
                <span className="text-[13px] font-bold">New Chat</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-xl shadow-xl overflow-hidden z-[100] border-t-0 p-1"
                >
                  {newChatOptions.map((option) => (
                    <button 
                      key={option.mode}
                      onClick={() => handleNewChatOption(option.mode)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-left"
                    >
                      <span className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
                        {option.icon}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Integrated Search Input */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" size={14} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-[var(--bg-tertiary)] border border-transparent text-[var(--text-primary)] rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:border-[var(--border-color)] transition-all"
            />
          </div>

        </div>
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-2 pb-6 scroll-smooth mask-fade-y">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30 select-none grayscale">
            <MessageSquare size={32} strokeWidth={1} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-4 text-center">No recent sessions</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-2 pt-2">
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Recent Activity</span>
            </div>
            <ChatHistory 
              chatHistory={filteredHistory}
              activeChatId={activeChatId}
              onSelectChat={(id) => {
                onSelectChat(id);
                setActiveView('chat');
              }}
              onDeleteChat={onDeleteChat}
              onRenameChat={onRenameChat}
            />
          </div>
        )}

        {/* Prompt Suggestions */}
        {!activeChatId && (
          <div className="mt-8 mb-4 border-t border-[var(--border-color)]/30 pt-6">
            <span className="px-2 text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-3 block">Recommended Topics</span>
            <div className="space-y-1.5 px-0.5">
              {[
                "Explain me prefix sum",
                "Explain linear search",
                "Explain me bubble sort",
                "Explain me about sliding window",
                "Explain me the process of photosynthesis",
                "On DSA",
                "Solar system",
                "Explain binary search"
              ].map((text, i) => (
                <button 
                  key={i}
                  onClick={() => { setPrompt(text); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/30 border border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/60 transition-all text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. FIXED BOTTOM SECTION ─── */}
      <div className="flex-shrink-0 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-t border-[var(--border-color)] p-3">
        <div className="relative flex flex-col gap-2">
          <div className="relative flex items-center bg-[var(--bg-tertiary)] border border-transparent rounded-2xl shadow-sm focus-within:border-[var(--border-strong)] transition-all pr-2 pl-1 group/input">
            <textarea 
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent border-none outline-none text-[13px] py-3 px-3 no-scrollbar resize-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSubmit())}
            />
            <button 
              onClick={onSubmit}
              disabled={!prompt.trim() || isGenerating}
              className={`p-1.5 rounded-lg transition-all ${prompt.trim() && !isGenerating ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm hover:scale-[1.05] active:scale-[0.95]' : 'bg-[var(--border-color)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'}`}
            >
              <Send size={14} className={isGenerating ? 'animate-pulse' : 'mr-[1px] mt-[1px]'} />
            </button>
          </div>
          
          <div className="flex items-center justify-between px-2 pt-0.5">
             <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)] opacity-50" />
                <button className="text-[9px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center transition-colors">
                   {selectedAgent || "Gemini 3.1 Pro"} 
                </button>
             </div>
             <button className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                <Settings size={12} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
