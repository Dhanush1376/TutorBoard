import React, { useState, useRef, useEffect } from 'react';
import { User, Copy, Edit2, Trash2, Check, RefreshCw, ThumbsUp, ThumbsDown, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VisaiLogo from '../layout/VisaiLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Markdown Renderers ─────────────────────────────────────────────────────

const MarkdownComponents = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <span className="font-semibold text-[var(--text-primary)]">{children}</span>
  ),
  em: ({ children }) => (
    <em className="italic opacity-80">{children}</em>
  ),
  h1: ({ children }) => (
    <h1 className="text-[15px] font-semibold mb-2 mt-3">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-semibold mb-1.5 mt-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mb-1 mt-1.5">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 pl-4 space-y-1 list-disc marker:text-[var(--text-tertiary)]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 pl-4 space-y-1 list-decimal marker:text-[var(--text-tertiary)]">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1.5 py-0.5 rounded-md text-[11px] font-mono bg-black/10 dark:bg-white/10 text-[var(--text-primary)]">
        {children}
      </code>
    ) : (
      <pre className="my-2 p-3 rounded-xl text-[11px] font-mono bg-black/10 dark:bg-white/10 overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--text-tertiary)]/40 pl-3 my-2 italic opacity-80">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-3 border-[var(--border-color)]" />
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline opacity-70 hover:opacity-100 transition-opacity">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-[11px] border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold border border-[var(--border-color)] bg-black/5 dark:bg-white/5">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border border-[var(--border-color)]">{children}</td>
  ),
};

// ─── Streaming Cursor ───────────────────────────────────────────────────────

const StreamingCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0] }}
    transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
    className="inline-block w-[2px] h-[1em] bg-[var(--text-primary)] ml-0.5 align-middle rounded-full"
  />
);

// ─── Message Component ──────────────────────────────────────────────────────

const Message = ({
  role, content, messageId, timestamp,
  isStreaming, streamingContent,
  onEditMessage, onDeleteMessage, onRegenerateMessage, onFeedback,
  onOpenCanvas, hasCanvas, elements, objects, steps, stepTitle, domain,
  visualizationType, motion: motionData, connections, sequence,
  metadata,
}) => {
  const isAssistant = role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editRef = useRef(null);

  const displayContent = isStreaming ? streamingContent : content;

  const formatTime = (ts) => {
    try {
      const d = ts ? new Date(ts) : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) {
      onEditMessage?.(messageId, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleEditKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Auto-resize edit textarea
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 300)}px`;
    }
  }, [isEditing, editContent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className={`w-full px-4 py-2 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
      onMouseEnter={() => !isStreaming && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* ── Header: Avatar + Label + Actions ── */}
      <div className={`flex items-center gap-1.5 mb-1.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
        {isAssistant ? (
          <VisaiLogo size="xxs" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[var(--text-secondary)]/20 border border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
            <User size={10} className="text-[var(--text-secondary)]" />
          </div>
        )}
        <span className="text-[10px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)] opacity-60">
          {isAssistant ? 'TutorBoard' : 'You'}
        </span>
        <span className="text-[9px] text-[var(--text-tertiary)]/40 font-normal tabular-nums tracking-wider">
          {formatTime(timestamp)}
        </span>

        {/* Edited badge */}
        {metadata?.edited && (
          <span className="text-[8px] text-[var(--text-tertiary)]/50 font-normal italic ml-1">edited</span>
        )}

        {/* ── Hover Action Bar ── */}
        <AnimatePresence>
          {showActions && !isEditing && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, x: isAssistant ? -4 : 4, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: isAssistant ? -4 : 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`flex items-center gap-0.5 ${isAssistant ? 'ml-1' : 'mr-1'} 
                bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)]/50 
                rounded-lg px-1 py-0.5 shadow-lg`}
            >
              {/* Copy */}
              <button onClick={handleCopy} title="Copy" className="chat-action-btn">
                {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>

              {/* Edit (user messages only) */}
              {!isAssistant && onEditMessage && (
                <button onClick={handleStartEdit} title="Edit" className="chat-action-btn">
                  <Edit2 size={11} />
                </button>
              )}

              {/* Regenerate (assistant messages only) */}
              {isAssistant && onRegenerateMessage && (
                <button onClick={() => onRegenerateMessage(messageId)} title="Regenerate" className="chat-action-btn">
                  <RefreshCw size={11} />
                </button>
              )}

              {/* Feedback (assistant messages only) */}
              {isAssistant && onFeedback && (
                <>
                  <button
                    onClick={() => onFeedback(messageId, 'positive')}
                    title="Good response"
                    className={`chat-action-btn ${metadata?.feedback === 'positive' ? '!text-emerald-500' : ''}`}
                  >
                    <ThumbsUp size={11} />
                  </button>
                  <button
                    onClick={() => onFeedback(messageId, 'negative')}
                    title="Bad response"
                    className={`chat-action-btn ${metadata?.feedback === 'negative' ? '!text-red-400' : ''}`}
                  >
                    <ThumbsDown size={11} />
                  </button>
                </>
              )}

              {/* Delete */}
              {onDeleteMessage && (
                <button onClick={() => onDeleteMessage(messageId)} title="Delete" className="chat-action-btn hover:!text-red-400">
                  <Trash2 size={11} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Message Bubble ── */}
      <div className="relative group max-w-[90%]">
        <AnimatePresence mode="wait">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <motion.div
              key="editing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full min-w-[280px]"
            >
              <div className="rounded-2xl border-2 border-[var(--text-primary)]/30 overflow-hidden bg-[var(--bg-secondary)]">
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full bg-transparent text-[var(--text-primary)] text-[14px] leading-relaxed px-4 py-3 outline-none resize-none font-normal"
                  rows={2}
                />
                <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === content}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg hover:opacity-90 transition-all disabled:opacity-30"
                  >
                    <Check size={11} /> Save & Submit
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── DISPLAY MODE ── */
            <motion.div
              key="display"
              initial={false}
              className={`relative px-4 py-3 text-[14px] leading-relaxed transition-all duration-300 ${
                isAssistant
                  ? 'rounded-2xl rounded-tl-sm'
                  : 'rounded-2xl rounded-tr-sm'
              }`}
              style={{
                backgroundColor: isAssistant ? 'var(--bg-secondary)' : 'var(--text-primary)',
                color: isAssistant ? 'var(--text-primary)' : 'var(--bg-primary)',
                boxShadow: isAssistant ? 'none' : '0 8px 30px rgba(0,0,0,0.1)',
              }}
            >
              {isAssistant ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={MarkdownComponents}
                  >
                    {displayContent || ''}
                  </ReactMarkdown>
                  {isStreaming && <StreamingCursor />}

                  {/* Canvas button */}
                  {hasCanvas && !isStreaming && (
                    <button
                      onClick={() => onOpenCanvas?.(messageId)}
                      className="mt-4 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] group font-normal tracking-widest text-[10px] uppercase"
                    >
                      <Layers size={13} className="text-[var(--bg-primary)] group-hover:scale-110 transition-transform" />
                      Deep Visual Dive
                    </button>
                  )}
                </>
              ) : (
                <p style={{ color: 'inherit' }} className="whitespace-pre-wrap leading-relaxed">{displayContent}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Message;
