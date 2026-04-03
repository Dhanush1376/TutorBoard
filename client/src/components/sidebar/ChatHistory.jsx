import React, { useState } from 'react';
import { Edit2, Share, Trash2, Check, X, MessageSquareDashed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatHistory = ({ chatHistory, activeChatId, onSelectChat, onDeleteChat, onRenameChat }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (chat) => {
    setEditingId(chat.id);
    setEditTitle(chat.title || 'Untitled Session');
  };

  const handleConfirmEdit = () => {
    if (editTitle.trim() && onRenameChat) {
      onRenameChat(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleShare = (chat) => {
    const summary = `TutorBoard Session: ${chat.title || 'Untitled'}\n\nMessages:\n${
      chat.messages.map(m => `[${m.role}]: ${m.content}`).join('\n')
    }`;
    navigator.clipboard.writeText(summary).then(() => {
      alert('Session copied to clipboard!');
    });
  };

  return (
    <div className="space-y-4 pb-6 mt-2">
      <h3 className="px-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.15em] opacity-80">
        Recents
      </h3>
      
      {chatHistory.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)] opacity-60"
        >
          <MessageSquareDashed size={24} className="mb-3 opacity-50" />
          <span className="text-[12px] font-normal tracking-tight">No recent sessions</span>
        </motion.div>
      ) : (
        <div className="space-y-1 px-1.5">
          <AnimatePresence>
            {chatHistory.map((chat, index) => (
              <motion.div 
                key={chat.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
                className="relative group/item"
              >
                {editingId === chat.id ? (
                  /* Inline Rename Mode */
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-sm">
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmEdit()}
                      autoFocus
                      className="flex-1 bg-transparent text-[var(--text-primary)] px-1 py-1 text-[13px] font-medium outline-none"
                    />
                    <div className="flex items-center gap-1 border-l border-[var(--border-color)] pl-2">
                      <button onClick={handleConfirmEdit} className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-md transition-colors"><X size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelectChat(chat.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center transition-all duration-200 relative overflow-hidden ${
                        activeChatId === chat.id 
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm' 
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {activeChatId === chat.id && (
                        <motion.div layoutId="activeChatIndicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-[var(--text-primary)] rounded-r-full" />
                      )}
                      <span className={`truncate text-[13px] ${activeChatId === chat.id ? 'font-medium ml-1.5' : 'font-normal'} pr-8 transition-all`}>
                        {chat.title || "Untitled Session"}
                      </span>
                    </button>

                    {/* Hover Actions Menu */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 translate-x-2 group-hover/item:translate-x-0 transition-all duration-200 bg-gradient-to-l from-[var(--bg-tertiary)] via-[var(--bg-tertiary)] to-transparent pl-6 pr-1.5 py-1 rounded-r-xl">
                      <button onClick={() => handleStartEdit(chat)} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-all" title="Rename"><Edit2 size={13} /></button>
                      <button onClick={() => handleShare(chat)} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-all" title="Copy to clipboard"><Share size={13} /></button>
                      <button onClick={() => onDeleteChat && onDeleteChat(chat.id)} className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
