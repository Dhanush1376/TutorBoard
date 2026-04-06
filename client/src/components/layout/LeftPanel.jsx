import React, { useState, useRef, useEffect } from 'react';
import ChatWindow from '../chat/ChatWindow';
import InputBar from '../chat/InputBar';
import ChatHistory from '../sidebar/ChatHistory';
import ThemeSelector from '../ThemeSelector';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import {
  BookOpen, Plus, Search, PanelLeftClose, X,
  ChevronLeft, Lightbulb, HelpCircle, Activity, Layers, ChevronDown
} from 'lucide-react';

const LeftPanel = ({
  // routing
  activeView, setActiveView,
  // sessions
  chatHistory, activeChatId,
  onNewChat, onSelectChat, onDeleteChat, onRenameChat,
  // chat
  messages, isGenerating,
  onOpenCanvas, onDeleteMessage, onEditMessage,
  // input
  prompt, setPrompt, onSubmit, activeMode, setActiveMode, isDark,
  // agent selection
  selectedAgent, setSelectedAgent,
}) => {
  const { setSidebarOpen } = useTutorStore();
  const hasStarted = messages.length > 0;
  const [showSettings, setShowSettings] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredHistory = searchQuery.trim()
    ? chatHistory.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistory;

  // ── RENDER HELPERS ──
  const renderScrollContent = () => {
    if (activeView === 'chat' && (hasStarted || isGenerating)) {
      return (
        <div className="flex flex-col gap-2 relative min-h-full">
          {/* Compact Back Button for Sidebar Chat */}
          {/* Sticky Header with Back Button */}
          <div className="sticky top-0 bg-[var(--bg-primary)] z-10 pt-0 pb-2.5">
            <button
              onClick={() => { setActiveView('history'); }}
              className="flex items-center gap-1.5 px-0.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors group"
            >
              <ChevronLeft size={13} strokeWidth={3.5} className="text-[10px] font-bold uppercase tracking-[0.15em] px-0.5 text-[var(--text-tertiary)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-0.5 py-1 text-[var(--text-tertiary)]">All Sessions</p>
            </button>
          </div>
          <ChatWindow
            messages={messages}
            isGenerating={isGenerating}
            onOpenCanvas={onOpenCanvas}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0 w-full relative">
        {/* Recent sessions history */}
        {/* Sticky Header for Recents */}
        <div className="sticky top-0 bg-[var(--bg-primary)] z-10 pt-0 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-0.5 py-1 text-[var(--text-tertiary)]">Recents</p>
        </div>
        <div className="flex flex-col w-full">
          <ChatHistory
            chatHistory={filteredHistory}
            activeChatId={activeChatId}
            onSelectChat={(id) => { onSelectChat(id); setActiveView('chat'); }}
            onDeleteChat={onDeleteChat}
            onRenameChat={onRenameChat}
          />
        </div>

        {/* Suggestions (shown only on landing if no history) */}
        {chatHistory.length === 0 && (
          <div className="flex flex-col gap-2 px-0.5 mt-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-1.5 mb-2 text-[var(--text-tertiary)]">Try asking</p>
            {[
              'Explain me prefix sum',
              'Explain linear search',
              'Explain me bubble sort',
              'Explain me about sliding window',
              'Explain me the process of photosynthesis',
              'On DSA',
              'Solar system',
              'Explain binary search',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setPrompt(suggestion); }}
                className="w-full text-left px-5 py-3 rounded-2xl text-[13px] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-accent-strong)] transition-all flex items-center gap-3 bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-color)]"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--text-tertiary)]" />
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── MAIN UNIFIED RETURN ──
  return (
    <div className="flex flex-col h-full text-[var(--text-primary)] bg-transparent">

      {/* ─── 1. FIXED TOP SECTION ─── */}
      <div className="flex-shrink-0 relative z-20">
        {/* Top Controls (Fixed Header) */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--text-primary)] rounded-md flex items-center justify-center">
              <span className="text-[var(--bg-primary)] text-[10px] font-black">T</span>
            </div>
            <span className="text-[14px] font-black uppercase tracking-[0.25em] text-[var(--text-primary)]">
              TutorBoard
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all active:scale-90 group"
            title="Close Sidebar"
          >
            <PanelLeftClose size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Top block visible only on landing/history */}
        {!(activeView === 'chat' && hasStarted) && (
          <div className="px-4 mb-0.5">
            <div className="bg-[var(--bg-tertiary)] rounded-[22px] p-2 border border-[var(--border-color)] shadow-sm">
              
              {/* Simple New Chat Button */}
              <button
                onClick={() => { onNewChat(); setActiveView('chat'); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm hover:opacity-90 active:scale-[0.98] transition-all font-semibold group"
              >
                <Plus size={18} strokeWidth={2.8} />
                <span className="text-[14px]">New chat</span>
              </button>

              <div className="mx-3 my-1.5 h-[1px] bg-[var(--border-color)] opacity-60" />

              {/* Search */}
              <button
                onClick={() => { setIsSearchOpen(v => !v); setSearchQuery(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[16px] transition-all font-semibold ${isSearchOpen ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                <Search size={18} strokeWidth={2.5} />
                <span className="text-[14px]">Search</span>
              </button>

              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="pt-1 px-1 overflow-hidden"
                  >
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Filter sessions..."
                      autoFocus
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--text-tertiary)] transition-all shadow-sm mb-1"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        )}
      </div>

      {/* ─── 2. SCROLLABLE MIDDLE SECTION ─── */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-0 pb-6 min-h-0 relative">


        {/* List content (Messages OR History + Suggestions) */}
        {renderScrollContent()}
      </div>

      {/* ─── 3. FIXED BOTTOM SECTION ─── */}
      <div className="flex-shrink-0 w-full relative z-20">
        <InputBar
          value={prompt}
          onChange={setPrompt}
          onSubmit={onSubmit}
          isGenerating={isGenerating}
          isLanding={true}
          activeMode={activeMode}
          setActiveMode={setActiveMode}
          isDark={isDark}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
        />
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          >
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[24px] shadow-2xl overflow-hidden"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(24px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
              }}
            >
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <h3 className="text-[13px] font-extrabold text-[var(--text-primary)] uppercase tracking-widest">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className="p-6">
                <ThemeSelector />
              </div>
              
              <div className="p-5 border-t border-[var(--border-color)] flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[13px] font-bold hover:opacity-90 transition-opacity drop-shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeftPanel;
