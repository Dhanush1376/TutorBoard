import React, { useState, useRef } from 'react';
import ChatHistory from './ChatHistory';
import AccountMenu from './AccountMenu';
import ThemeSelector from '../ThemeSelector';
import { Plus, Search, MessageSquare, Library, PanelLeftClose, Settings, X } from 'lucide-react';

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
  setActiveView
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const recentsRef = useRef(null);

  const filteredHistory = searchQuery.trim()
    ? chatHistory.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistory;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-250 font-sans">
      
      {/* Top Toggle & Settings */}
      <div className="p-3 flex items-center justify-between">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
        >
          <Settings size={18} />
        </button>
        <button 
          onClick={onClose}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
        >
          <PanelLeftClose size={20} />
        </button>
      </div>

      {/* Main Menu Links (ChatGPT Style) */}
      <div className="px-3 space-y-0.5 mt-1">
        <button 
          onClick={() => {
            onNewChat();
            setActiveView('chat');
          }}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors group ${activeView === 'chat' && !activeChatId ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
        >
          <div className="flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full w-6 h-6 shadow-sm">
            <Plus size={14} className="text-[var(--text-primary)]" />
          </div>
          <span className="text-[13px] font-medium">New chat</span>
        </button>

        <button 
          onClick={() => { setIsSearchOpen(!isSearchOpen); setSearchQuery(''); }}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${isSearchOpen ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
        >
          <div className="w-6 flex justify-center"><Search size={16} /></div>
          <span className="text-[14px] font-medium">Search</span>
        </button>

        <button 
          onClick={() => { setActiveView('chat'); recentsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <div className="w-6 flex justify-center"><MessageSquare size={16} /></div>
          <span className="text-[14px] font-medium">Chats</span>
        </button>

        <button 
          onClick={() => setActiveView('modules')}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors group ${activeView === 'modules' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
        >
          <div className="w-6 flex justify-center"><Library size={16} /></div>
          <span className="text-[14px] font-medium">Learning Modules</span>
        </button>
      </div>

      {/* Search Filter Input */}
      {isSearchOpen && (
        <div className="px-3 pt-3">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sessions..."
            autoFocus
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--text-tertiary)] transition-colors"
          />
        </div>
      )}

      {/* Scrollable Recents */}
      <div ref={recentsRef} className="flex-1 overflow-y-auto no-scrollbar px-3 pt-6">
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

      {/* Bottom Section */}
      <div className="mt-auto p-2 border-t border-[var(--border-color)] flex-shrink-0">
        <AccountMenu />
      </div>

      {/* Settings Modal (Appearance Section) */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
                  Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:text-[var(--text-primary)] transition-colors text-[var(--text-tertiary)]">
                   <X size={18} />
                </button>
             </div>
             
             <div className="p-6">
                <ThemeSelector />
             </div>

             <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)] flex justify-end">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
