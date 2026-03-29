import React, { useState } from 'react';
import { Edit2, Share, Trash2, Check, X } from 'lucide-react';

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
      // Brief visual feedback via a temporary tooltip (could be enhanced)
      alert('Session copied to clipboard!');
    });
  };

  return (
    <div className="space-y-2 pb-4">
      <h3 className="px-2 text-xs font-semibold text-[var(--text-tertiary)] tracking-wide mb-1">
        Recents
      </h3>
      
      {chatHistory.length === 0 ? (
        <div className="px-2 py-4 text-[12px] text-[var(--text-tertiary)]">
          No recent sessions.
        </div>
      ) : (
        <div className="space-y-0.5">
          {chatHistory.map((chat) => (
            <div key={chat.id} className="relative group/item">
              {editingId === chat.id ? (
                /* Inline Rename Mode */
                <div className="flex items-center gap-1 px-1 py-1">
                  <input 
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmEdit()}
                    autoFocus
                    className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-2 py-1.5 text-[13px] outline-none"
                  />
                  <button onClick={handleConfirmEdit} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-[var(--text-tertiary)] hover:text-red-400 rounded-md transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className={`w-full text-left px-2 py-2 rounded-lg flex items-center transition-all ${
                      activeChatId === chat.id 
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="truncate text-[13px] pr-8">
                      {chat.title || "Untitled Session"}
                    </span>
                  </button>

                  {/* Hover Actions Menu */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-gradient-to-l from-[var(--bg-tertiary)] via-[var(--bg-tertiary)] to-transparent pl-4 pr-1">
                    <button onClick={() => handleStartEdit(chat)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors" title="Rename"><Edit2 size={12} /></button>
                    <button onClick={() => handleShare(chat)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors" title="Copy to clipboard"><Share size={12} /></button>
                    <button onClick={() => onDeleteChat && onDeleteChat(chat.id)} className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors" title="Delete"><Trash2 size={12} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
