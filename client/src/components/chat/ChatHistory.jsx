import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Copy, Trash2, Check, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useWindowSize from '../../hooks/useWindowSize';
import useTutorStore from '../../store/tutorStore';

const EASE = [0.22, 1, 0.36, 1];

function stamp(chat) {
  const t = chat.updatedAt || chat.createdAt || 0;
  return typeof t === 'number' ? t : new Date(t).getTime() || 0;
}

/** "Today", "Yesterday", "This week", "Earlier" */
function groupOf(ts) {
  if (!ts) return 'Earlier';
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= start) return 'Today';
  if (ts >= start - 86400000) return 'Yesterday';
  if (ts >= start - 6 * 86400000) return 'This week';
  return 'Earlier';
}

function shortTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const g = groupOf(ts);
  if (g === 'Today') return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (g === 'Yesterday') return 'Yesterday';
  if (g === 'This week') return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function RowMenu({ onRename, onCopy, onDelete, onClose }) {
  const ref = useRef(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const away = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const item = 'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] transition-colors';
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: EASE }}
      className="absolute right-1 top-[calc(100%+4px)] z-50 w-48 rounded-2xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.45)]"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onRename} className={`${item} text-[var(--text-primary)] hover:bg-[var(--st-fill)]`}>
        <Pencil size={15} strokeWidth={1.8} className="text-[var(--text-secondary)]" /> Rename
      </button>
      <button type="button" onClick={onCopy} className={`${item} text-[var(--text-primary)] hover:bg-[var(--st-fill)]`}>
        <Copy size={15} strokeWidth={1.8} className="text-[var(--text-secondary)]" /> Copy as text
      </button>
      <div className="my-1 h-px bg-[var(--st-line)]" />
      <button
        type="button"
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        className={`${item} ${confirming ? 'bg-red-500/10 text-red-500' : 'text-red-500 hover:bg-red-500/[0.07]'}`}
      >
        <Trash2 size={15} strokeWidth={1.8} /> {confirming ? 'Tap again to delete' : 'Delete'}
      </button>
    </motion.div>
  );
}

const ChatHistory = ({ chatHistory, activeChatId, onSelectChat, onDeleteChat, onRenameChat }) => {
  const { unreadSessions } = useTutorStore();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuId, setMenuId] = useState(null);
  const { isMobile } = useWindowSize();

  const groups = useMemo(() => {
    const out = [];
    chatHistory.forEach((chat) => {
      const label = groupOf(stamp(chat));
      let g = out.find((x) => x.label === label);
      if (!g) out.push((g = { label, items: [] }));
      g.items.push(chat);
    });
    return out;
  }, [chatHistory]);

  const startEdit = (chat) => {
    setMenuId(null);
    setEditingId(chat.id);
    setEditTitle(chat.title || 'Untitled');
  };
  const confirmEdit = () => {
    if (editTitle.trim() && onRenameChat) onRenameChat(editingId, editTitle.trim());
    setEditingId(null);
  };

  const copyChat = (chat) => {
    setMenuId(null);
    const clean = (t) => (t || '').replace(/<thought>[\s\S]*?<\/thought>/g, '').replace(/\s+/g, ' ').trim();
    const text = `${chat.title || 'Untitled'}\n\n${(chat.messages || []).map((m) => `${m.role === 'user' ? 'You' : 'TutorBoard'}: ${clean(m.content)}`).join('\n\n')}`;
    navigator.clipboard
      .writeText(text)
      .then(() => useTutorStore.getState().showToast({ message: 'Copied to clipboard', type: 'success', duration: 2000 }))
      .catch(() => useTutorStore.getState().showToast({ message: 'Could not copy', type: 'error', duration: 2000 }));
  };

  if (!chatHistory || chatHistory.length === 0 || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--st-fill)] text-[var(--text-tertiary)] mb-2.5">
          <MessageSquare size={17} strokeWidth={1.8} />
        </div>
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">No conversations yet</p>
        <p className="text-[11.5px] text-[var(--text-tertiary)] mt-0.5">
          Your saved sessions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-3">
      {groups.map((g) => (
        <section key={g.label}>
          <h4 className="px-2.5 pb-1 text-[12px] font-medium text-[var(--text-tertiary)]">{g.label}</h4>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {g.items.map((chat, i) => {
                const active = activeChatId === chat.id;
                const unread = unreadSessions.includes(chat.id) && !active;
                const open = menuId === chat.id;
                return (
                  <motion.li
                    key={`sn-${chat.id || chat._id || 'g'}-${i}`}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group/item relative"
                  >
                    {editingId === chat.id ? (
                      <div className="relative flex h-10 w-full items-center">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          aria-label="Session name"
                          className="h-10 w-full rounded-xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] pl-3 pr-16 text-[13.5px] text-[var(--text-primary)] outline-none shadow-[0_0_0_2px_var(--st-fill-strong)] transition-all"
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={confirmEdit}
                            aria-label="Confirm rename"
                            title="Save"
                            className="grid h-6 w-6 cursor-pointer place-items-center rounded-lg text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors"
                          >
                            <Check size={14} strokeWidth={2.4} />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel rename"
                            title="Cancel"
                            className="grid h-6 w-6 cursor-pointer place-items-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <X size={14} strokeWidth={2.2} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectChat(chat.id)}
                          className={`flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left transition-colors ${
                            active ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mk-accent)]" aria-label="New" />}
                          <span className={`min-w-0 flex-1 truncate text-[13.5px] tracking-[-0.01em] ${active ? 'font-medium' : ''}`}>
                            {chat.title || 'Untitled'}
                          </span>
                          {/* Time shown on hover */}
                          <span className={`shrink-0 pr-7 text-[10.5px] tracking-tight tabular-nums text-[var(--text-tertiary)] transition-opacity opacity-0 group-hover/item:opacity-100 ${open ? '!opacity-0' : ''}`}>
                            {shortTime(stamp(chat))}
                          </span>
                        </button>
                        {/* 3-dots menu button visible by default */}
                        <button
                          type="button"
                          aria-label="Session options"
                          aria-expanded={open}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(open ? null : chat.id);
                          }}
                          className={`absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)] ${
                            open ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)] opacity-100' : 'opacity-70 group-hover/item:opacity-100'
                          }`}
                        >
                          <MoreHorizontal size={15} strokeWidth={1.8} />
                        </button>
                        <AnimatePresence>
                          {open && (
                            <RowMenu
                              onClose={() => setMenuId(null)}
                              onRename={() => startEdit(chat)}
                              onCopy={() => copyChat(chat)}
                              onDelete={() => {
                                setMenuId(null);
                                onDeleteChat?.(chat.id);
                              }}
                            />
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ChatHistory;
