import React, { useState, useRef, useEffect } from 'react';
import { User, Copy, Edit2, Trash2, Check, RefreshCw, X, Layers, ChevronLeft, ChevronRight, BookOpen, Code, Globe, FileText, Table2, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VisaiLogo from '../layout/VisaiLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useTutorStore from '../../store/tutorStore';

// Artifact type config
const ARTIFACT_TYPE_CONFIG = {
  code: { icon: Code, label: 'Code', color: '#3b82f6' },
  ui: { icon: Globe, label: 'UI Preview', color: '#8b5cf6' },
  document: { icon: FileText, label: 'Document', color: '#10b981' },
  table: { icon: Table2, label: 'Table', color: '#f59e0b' },
  diagram: { icon: GitBranch, label: 'Diagram', color: '#ec4899' },
};

// ─── Markdown Renderers (Premium Notes-App Typography) ──────────────────────

const MarkdownComponents = {
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0 leading-[1.7] text-[13px] text-[var(--text-primary)]/90 break-words">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic opacity-85">{children}</em>
  ),
  h1: ({ children }) => (
    <h1 className="!text-[18px] !font-bold !mb-4 !mt-6 first:!mt-0 !tracking-tight !text-[var(--text-primary)] !leading-tight !border-b !border-[var(--border-color)]/30 !pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="!text-[14.5px] !font-semibold !mb-2 !mt-3.5 first:!mt-0 !tracking-[-0.01em] !text-[var(--text-primary)] !leading-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="!text-[13.5px] !font-medium !mb-1.5 !mt-3 first:!mt-0 !text-[var(--text-primary)] !leading-snug">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 pl-4 space-y-1 list-disc marker:text-[var(--text-tertiary)]/60 text-[13px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-4 space-y-1 list-decimal marker:text-[var(--text-tertiary)]/60 text-[13px]">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-[1.65] pl-0.5">{children}</li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1 py-[1px] rounded text-[11.5px] font-mono bg-[var(--text-primary)]/[0.06] text-[var(--text-primary)] border border-[var(--border-color)]/20">
        {children}
      </code>
    ) : (
      <pre className="my-3 p-3.5 rounded-lg text-[11.5px] font-mono bg-[var(--text-primary)]/[0.04] overflow-x-auto leading-relaxed border border-[var(--border-color)]/15">
        <code>{children}</code>
      </pre>
    ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-[var(--text-tertiary)]/25 pl-3.5 my-3 text-[13px] text-[var(--text-secondary)] italic">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-5 border-[var(--border-color)]/40" />
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-[var(--text-primary)] font-medium hover:opacity-60 transition-opacity decoration-[var(--text-tertiary)]/30">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border-color)]/30">
      <table className="text-[12px] border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b border-[var(--border-color)]/30 bg-[var(--text-primary)]/[0.03]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 border-b border-[var(--border-color)]/15 text-[12.5px]">{children}</td>
  ),
};

// ─── Artifact Chip (shown in assistant messages when artifact exists) ────────

const ArtifactChipForMessage = ({ artifactId }) => {
  const { artifacts, setActiveArtifact, openArtifactPanel } = useTutorStore();
  
  const artifact = artifacts.find(a => a.id === artifactId);
  if (!artifact) return null;

  const config = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.code;
  const Icon = config.icon;

  return (
    <button
      onClick={() => {
        setActiveArtifact(artifact.id);
        openArtifactPanel();
      }}
      className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/30 hover:border-[var(--text-tertiary)]/50 hover:bg-[var(--bg-tertiary)] transition-all group w-full max-w-sm text-left"
    >
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${config.color}15` }}
      >
        <Icon size={16} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
          {artifact.title}
        </div>
        <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">
          Click to open {config.label}
        </div>
      </div>
    </button>
  );
};

// ─── Thinking Dropdown ──────────────────────────────────────────────────────

const ThoughtDropdown = ({ content, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!content && !isStreaming) return null;

  return (
    <div className="mb-3 w-full max-w-[90%]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--text-primary)]/[0.04] hover:bg-[var(--text-primary)]/[0.08] border border-[var(--border-color)]/20 transition-all group"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-pulse" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors">
            {isStreaming ? 'Agent is thinking...' : 'View Reasoning'}
          </span>
        </div>
        <ChevronRight size={12} className={`text-[var(--text-tertiary)] transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-xl bg-[var(--text-primary)]/[0.02] border border-[var(--border-color)]/10 text-[12px] leading-relaxed text-[var(--text-secondary)] italic font-light border-l-2 border-l-[var(--text-tertiary)]/30">
              {content}
              {isStreaming && <span className="animate-pulse ml-0.5">▍</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Source Cards ──────────────────────────────────────────────────────────

const SourceGrid = ({ sources, searchPerformed }) => {
  if (!searchPerformed && (!sources || sources.length === 0)) return null;

  return (
    <div className="mb-4 w-full">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.05] flex items-center justify-center">
          <BookOpen size={10} className="text-[var(--text-tertiary)]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
          {sources && sources.length > 0 ? 'Sources' : 'Searched the web'}
        </span>
        {(!sources || sources.length === 0) && searchPerformed && (
          <span className="text-[9px] text-[var(--text-tertiary)]/40 font-normal normal-case tracking-normal">
            (No direct links found)
          </span>
        )}
      </div>
      
      {sources && sources.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-0.5">
          {sources.map((source, idx) => {
            let hostname = '';
            let favicon = '';
            try {
              const url = new URL(source.url);
              hostname = url.hostname.replace('www.', '');
              favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
            } catch (e) {
              hostname = 'Link';
              favicon = '';
            }

            return (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 w-36 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/20 hover:border-[var(--text-tertiary)]/40 hover:bg-[var(--bg-tertiary)] transition-all group"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {favicon && (
                      <img 
                        src={favicon} 
                        alt="" 
                        className="w-3 h-3 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider truncate">
                      {hostname}
                    </span>
                  </div>
                  <h4 className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
                    {source.title}
                  </h4>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Message Component ──────────────────────────────────────────────────────

const Message = ({
  role, content, messageId, timestamp,
  isStreaming, streamingContent,
  isStreamingThought, streamingThought,
  streamingSources,
  isSearchPerformed: streamingSearchPerformed,
  onEditMessage, onDeleteMessage, onRegenerateMessage, onFeedback,
  onOpenCanvas, hasCanvas, elements, objects, steps, stepTitle, domain,
  visualizationType, motion: motionData, connections, sequence,
  metadata, onSwitchVersion,
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
    <div
      className={`w-full py-1 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
    >
      {/* ── Message Bubble ── */}
      <div className={`relative group min-w-0 ${isAssistant ? 'max-w-[95%] w-full' : 'max-w-[85%]'}`}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <motion.div
              key="editing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full min-w-[240px]"
            >
              <div className="rounded-2xl border border-[var(--text-primary)]/20 overflow-hidden bg-[var(--bg-secondary)]">
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full bg-transparent text-[var(--text-primary)] text-[13.5px] leading-[1.65] px-4 py-3 outline-none resize-none font-normal"
                  rows={2}
                />
                <div className="flex items-center justify-end gap-1.5 px-3 pb-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === content}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg hover:opacity-90 transition-all disabled:opacity-20"
                  >
                    <Check size={10} /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── DISPLAY MODE ── */
            <div className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end'} min-w-0 w-full`}>
                {isAssistant && (metadata?.sources || streamingSources || metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)) && (
                  <SourceGrid 
                    sources={metadata?.sources || streamingSources} 
                    searchPerformed={metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)}
                  />
                )}
                
                {isAssistant && (metadata?.thought || streamingThought) && (
                  <ThoughtDropdown 
                    content={metadata?.thought || streamingThought} 
                    isStreaming={isStreaming && !!streamingThought} 
                  />
                )}
                
                <motion.div
                  key="display"
                  initial={isStreaming ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={isStreaming ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`relative min-w-0 max-w-full break-words overflow-hidden ${
                  isAssistant
                    ? 'px-1 py-1 text-[13px]'
                    : 'px-4 py-2.5 rounded-2xl rounded-tr-md text-[13.5px]'
                }`}
                style={
                  isAssistant ? {} : {
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }
                }
              >
                {isAssistant ? (
                  <div className="relative">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={MarkdownComponents}
                    >
                      {displayContent || ''}
                    </ReactMarkdown>
                    {isStreaming && (
                      <span className="inline-block w-[3px] h-[15px] bg-[var(--text-primary)] ml-1 animate-[pulse_0.8s_infinite] align-middle" />
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'inherit' }} className="whitespace-pre-wrap leading-[1.65]">{displayContent}</p>
                )}
              </motion.div>

              {/* ── Inline Action Bar (below bubble) ── */}
              <AnimatePresence>
                {!isEditing && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.12 }}
                    className={`flex items-center gap-0 mt-0.5 ${isAssistant ? '' : 'flex-row-reverse'}`}
                  >
                    {/* Copy */}
                    <button onClick={handleCopy} title="Copy" className="chat-action-btn">
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>

                    {/* Edit (user only) */}
                    {!isAssistant && onEditMessage && (
                      <button onClick={handleStartEdit} title="Edit" className="chat-action-btn">
                        <Edit2 size={12} />
                      </button>
                    )}

                    {/* Regenerate (assistant only) */}
                    {isAssistant && onRegenerateMessage && (
                      <button onClick={() => onRegenerateMessage(messageId)} title="Regenerate" className="chat-action-btn">
                        <RefreshCw size={12} />
                      </button>
                    )}

                    {/* Delete */}
                    {onDeleteMessage && (
                      <button onClick={() => onDeleteMessage(messageId)} title="Delete" className="chat-action-btn hover:!text-red-400">
                        <Trash2 size={12} />
                      </button>
                    )}

                    {/* Timestamp */}
                    <span className={`text-[9px] text-[var(--text-tertiary)]/40 tabular-nums tracking-wide px-1 ${isAssistant ? '' : 'order-first'}`}>
                      {formatTime(timestamp)}
                      {metadata?.edited && <span className="ml-1 italic opacity-60">· edited</span>}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Canvas CTA ── */}
              {isAssistant && hasCanvas && !isStreaming && (
                <button
                  onClick={() => onOpenCanvas?.(messageId)}
                  className="mt-2 flex items-center gap-2 px-3.5 py-2 bg-[var(--text-primary)]/[0.06] hover:bg-[var(--text-primary)]/[0.1] border border-[var(--border-color)]/30 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] text-[11px] font-medium text-[var(--text-secondary)] tracking-wide uppercase"
                >
                  <Layers size={13} strokeWidth={2} />
                  Open Canvas
                </button>
              )}

              {/* ── Artifact Chip ── */}
              {isAssistant && metadata?.artifactId && (
                <ArtifactChipForMessage artifactId={metadata.artifactId} />
              )}

              {/* ── Version Switcher ── */}
              {metadata?.versions?.length > 1 && (
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium tracking-wide text-[var(--text-tertiary)]/60 hover:text-[var(--text-tertiary)] transition-colors`}>
                  <button
                    onClick={() => onSwitchVersion?.(messageId, Math.max(0, metadata.activeVersionIndex - 1))}
                    disabled={metadata.activeVersionIndex === 0}
                    className="p-0.5 hover:text-[var(--text-primary)] rounded disabled:opacity-20 transition-colors"
                  >
                    <ChevronLeft size={11} strokeWidth={2.5} />
                  </button>
                  
                  <span className="tabular-nums">
                    {metadata.activeVersionIndex + 1}/{metadata.versions.length}
                  </span>

                  <button
                    onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                    disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                    className="p-0.5 hover:text-[var(--text-primary)] rounded disabled:opacity-20 transition-colors"
                  >
                    <ChevronRight size={11} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Message;
