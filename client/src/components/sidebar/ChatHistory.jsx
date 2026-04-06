import React, { useState } from 'react';
import { Edit2, Share, Trash2, Check, X, MessageSquare, MoreVertical } from 'lucide-react';
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
    navigator.clipboard.writeText(summary);
  };

  return (
    <div className="space-y-1 pb-2">
      <AnimatePresence initial={false}>
        {chatHistory.map((chat, index) => (
          <motion.div 
            key={chat.id} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
            className="relative group/item px-0.5"
          >
            {editingId === chat.id ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-lg ring-2 ring-[var(--text-primary)]/10">
                <input 
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmEdit()}
                  onBlur={handleConfirmEdit}
                  autoFocus
                  className="flex-1 bg-transparent text-[var(--text-primary)] text-[13px] font-semibold outline-none"
                />
                <div className="flex items-center gap-1">
                  <button onClick={handleConfirmEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl flex items-center transition-all duration-200 relative overflow-hidden group/btn ${
                    activeChatId === chat.id 
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MessageSquare 
                    size={15} 
                    className={`mr-3 transition-colors ${activeChatId === chat.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover/btn:text-[var(--text-secondary)]'}`} 
                  />
                  
                  <span className="truncate text-[13px] flex-1 font-medium transition-colors">
                    {chat.title || "Untitled Session"}
                  </span>
                  
                  {activeChatId === chat.id && (
                    <motion.div 
                      layoutId="activeIndicator" 
                      className="absolute left-0 top-3 bottom-3 w-1 bg-[var(--text-primary)] rounded-r-full" 
                    />
                  )}
                </button>

                {/* Actions Menu (revealed on hover) */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-all duration-200 bg-gradient-to-l from-[var(--bg-tertiary)] via-[var(--bg-tertiary)] to-transparent pl-8 rounded-r-xl py-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(chat); }} 
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/50 rounded-lg transition-all" 
                    title="Rename"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(chat); }} 
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/50 rounded-lg transition-all" 
                    title="Share"
                  >
                    <Share size={13} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteChat && onDeleteChat(chat.id); }} 
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" 
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ChatHistory;
