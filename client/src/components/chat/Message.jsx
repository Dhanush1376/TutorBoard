/**
 * Message.jsx — TutorBoard v4.0
 *
 * UPGRADED:
 * - Streaming cursor blink (no "stuck" feel)
 * - Canvas preview card inline (connected to canvas elements)
 * - Visual generation artifact card with thumbnail
 * - Web search source pills
 * - Smooth character-by-character reveal feel via CSS
 * - KaTeX math, syntax-highlighted code blocks
 * - Feedback, copy, edit, regenerate, save insight
 * - Version switcher
 * - Zero layout shift during streaming
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Copy, Edit2, Trash2, Check, RefreshCw,
  ChevronLeft, ChevronRight, BookOpen,
  Code, Globe, FileText, Table2, GitBranch,
  Layers, ThumbsUp, ThumbsDown,
  ChevronRight as ChevronRightIcon,
  Play, FlaskConical, Network, BookMarked, Activity,
  Loader2, Image as ImageIcon, Sparkles, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import useTutorStore from '../../store/tutorStore';

// ─── Streaming cursor ─────────────────────────────────────────────────────────

const StreamCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.65, repeat: Infinity, ease: 'linear' }}
    style={{
      display: 'inline-block',
      width: 2,
      height: '1em',
      background: 'var(--text-primary)',
      borderRadius: 1,
      marginLeft: 1,
      verticalAlign: 'text-bottom',
    }}
  />
);

// ─── Language label colors ────────────────────────────────────────────────────

const LANG_COLORS = {
  javascript: '#f7df1e', js: '#f7df1e',
  typescript: '#3178c6', ts: '#3178c6',
  python: '#3776ab', py: '#3776ab',
  java: '#f89820',
  cpp: '#659ad2', c: '#a8b9cc',
  go: '#00add8',
  rust: '#ce422b', rs: '#ce422b',
  html: '#e34f26', css: '#1572b6',
  sql: '#cc2927',
  bash: '#4eaa25', sh: '#4eaa25',
  json: '#cbcb41', yaml: '#cb171e',
  markdown: '#083fa1', md: '#083fa1',
};

// ─── Code block ──────────────────────────────────────────────────────────────

const CodeBlock = memo(({ children, className, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const lang = (className || '').replace(/^language-/, '').toLowerCase();
  const langColor = LANG_COLORS[lang] || '#888';
  const isRunnable = ['javascript','js','python','py','java','cpp','c++','c','rust','rs','go','ruby','ts','typescript'].includes(lang);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div
      className="my-3 rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: langColor }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang || 'code'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isRunnable && (
            <button
              onClick={() => onOpenArtifact?.(code, lang)}
              className="flex items-center gap-1 rounded-md transition-all hover:opacity-80"
              style={{ padding: '2px 8px', fontSize: 10, fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              <Play size={8} /> Run
            </button>
          )}
          {onOpenArtifact && !isRunnable && (
            <button
              onClick={() => onOpenArtifact(code, lang)}
              className="flex items-center gap-1 rounded-md transition-all hover:opacity-80"
              style={{ padding: '2px 8px', fontSize: 10, fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg-primary)', opacity: 0.8 }}
            >
              <FlaskConical size={8} /> Open
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded-md transition-all"
            style={{
              padding: '2px 8px', fontSize: 10, fontWeight: 500,
              background: 'transparent', color: 'var(--text-tertiary)',
            }}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto" style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', lineHeight: 1.65, color: 'var(--text-primary)', margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
});

// ─── Markdown components ──────────────────────────────────────────────────────

const buildMarkdownComponents = (onOpenArtifact) => ({
  p: ({ children }) => (
    <p style={{ marginBottom: 12, lineHeight: 1.75, fontSize: 13.5, color: 'var(--text-primary)', opacity: 0.92, wordBreak: 'break-word' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ opacity: 0.8 }}>{children}</em>,
  h1: ({ children }) => <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 20, letterSpacing: '-0.01em', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, marginTop: 18, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, marginTop: 14, color: 'var(--text-primary)' }}>{children}</h3>,
  ul: ({ children }) => <ul style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 5, lineHeight: 1.65, fontSize: 13.5, color: 'var(--text-primary)', opacity: 0.9 }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid var(--text-tertiary)', paddingLeft: 14, marginLeft: 0, opacity: 0.7, fontStyle: 'italic' }}>{children}</blockquote>
  ),
  code: ({ className, children, inline }) => {
    if (inline) {
      return (
        <code style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
          borderRadius: 5, padding: '1px 5px', color: 'var(--text-primary)',
        }}>
          {children}
        </code>
      );
    }
    return <CodeBlock className={className} onOpenArtifact={onOpenArtifact}>{children}</CodeBlock>;
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ textAlign: 'left', padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', opacity: 0.9 }}>{children}</td>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)', textDecoration: 'underline', textDecorationColor: 'var(--info)', opacity: 0.8 }}>{children}</a>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />,
});

// ─── Source grid ──────────────────────────────────────────────────────────────

const SourceGrid = ({ sources, searchPerformed }) => {
  if (!searchPerformed && (!sources || sources.length === 0)) return null;

  return (
    <div className="mb-4 w-full">
      <motion.div
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2 w-fit px-0"
      >
        {sources?.length > 0 ? (
          <div className="flex items-center gap-2">
            <BookOpen size={13} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
            <span style={{ 
              fontSize: 11.5, 
              fontWeight: 500, 
              color: 'var(--text-tertiary)',
              letterSpacing: '-0.01em',
              opacity: 0.8
            }}>
              Searched the web · {sources.length} sources
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-[4px] opacity-40">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 1, 0.3] 
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: 3.5,
                    height: 3.5,
                    borderRadius: '50%',
                    background: 'var(--text-tertiary)',
                  }}
                />
              ))}
            </div>
            <span style={{ 
              fontSize: 11.5, 
              fontWeight: 500, 
              color: 'var(--text-tertiary)',
              letterSpacing: '-0.01em',
              opacity: 0.8
            }}>
              Searching the web...
            </span>
          </div>
        )}
      </motion.div>

      {sources?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {sources.map((source, idx) => {
            let hostname = 'Link';
            let favicon = '';
            try {
              const url = new URL(source.url);
              hostname = url.hostname.replace('www.', '');
              favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
            } catch {}
            return (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 rounded-xl border transition-all"
                style={{
                  width: 138,
                  padding: '10px 10px',
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  textDecoration: 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5 overflow-hidden">
                  {favicon && <img src={favicon} alt="" style={{ width: 12, height: 12, borderRadius: 2, opacity: 0.7 }} onError={e => { e.target.style.display = 'none'; }} />}
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hostname}</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {source.title}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Canvas preview card (connected to canvas) ────────────────────────────────

const CANVAS_CONFIGS = {
  cinematic: { icon: Layers, label: 'Visual Explanation', desc: 'Watch animated canvas breakdown', color: 'var(--success)' },
  d3: { icon: Network, label: 'Data Structure', desc: 'Interactive graph / tree', color: 'var(--info)' },
  physics: { icon: FlaskConical, label: 'Physics Simulation', desc: 'Interactive physics canvas', color: 'var(--warning)' },
  default: { icon: Layers, label: 'Open on Canvas', desc: 'Step-by-step visual', color: 'var(--text-tertiary)' },
};

const CanvasCard = ({ onOpenCanvas, messageId, canvasType, stepCount }) => {
  const cfg = CANVAS_CONFIGS[canvasType] || CANVAS_CONFIGS.default;
  const Icon = cfg.icon;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onOpenCanvas?.(messageId)}
      className="mt-3 w-full flex items-center gap-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.98] text-left"
      style={{
        padding: '12px 14px',
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Icon area */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}18` }}
      >
        <Icon size={18} strokeWidth={1.8} style={{ color: cfg.color }} />
      </div>

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          {cfg.label}
        </p>
        <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
          {cfg.desc}{stepCount ? ` · ${stepCount} steps` : ''}
        </p>
      </div>

      {/* Open chip */}
      <div
        className="flex items-center gap-1 rounded-lg flex-shrink-0"
        style={{
          padding: '4px 10px',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}
      >
        <Eye size={9} />
        Open
      </div>
    </motion.button>
  );
};

// ─── Artifact chip (linked artifact in panel) ─────────────────────────────────

const ARTIFACT_TYPE_CONFIG = {
  code:     { icon: Code,     label: 'Code',       color: '#3b82f6' },
  ui:       { icon: Globe,    label: 'UI Preview',  color: '#8b5cf6' },
  document: { icon: FileText, label: 'Document',    color: '#10b981' },
  table:    { icon: Table2,   label: 'Table',       color: '#f59e0b' },
  diagram:  { icon: GitBranch,label: 'Diagram',     color: '#ec4899' },
};

const ArtifactChip = ({ artifactId }) => {
  const artifact = useTutorStore(
    useCallback((s) => s.artifacts?.find((a) => a.id === artifactId), [artifactId])
  );
  const openArtifactPanel = useTutorStore((s) => s.openArtifactPanel);

  if (!artifact) return null;

  const cfg = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.code;
  const Icon = cfg.icon;

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => {
        useTutorStore.getState().setActiveArtifact?.(artifactId);
        openArtifactPanel?.();
      }}
      className="mt-3 flex items-center gap-2.5 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.98] text-left"
      style={{
        padding: '9px 12px',
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        maxWidth: '100%',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}18` }}
      >
        <Icon size={13} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artifact.title || cfg.label}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>
          {cfg.label} · Click to open
        </p>
      </div>
      <ChevronRightIcon size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </motion.button>
  );
};

// ─── Action bar ───────────────────────────────────────────────────────────────

const ActionBtn = ({ onClick, title, children, className = '' }) => (
  <button
    onClick={onClick}
    title={title}
    className={`chat-action-btn ${className}`}
    style={{ padding: '3px 5px', borderRadius: 6, transition: 'all 0.15s', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
  >
    {children}
  </button>
);

// ─── Main Message ─────────────────────────────────────────────────────────────

const Message = ({
  role, content, messageId, timestamp,
  isStreaming, streamingContent, streamingThought,
  streamingSources,
  isSearchPerformed: streamingSearchPerformed,
  showCursor,
  onEditMessage, onDeleteMessage, onRegenerateMessage, onFeedback,
  onOpenCanvas, hasCanvas, canvasType,
  metadata, onSwitchVersion,
  onOpenArtifact,
  steps,
}) => {
  const isAssistant = role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(metadata?.feedback || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const editRef = useRef(null);

  const displayContent = isStreaming ? streamingContent : content;

  const formatTime = (ts) => {
    try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) onEditMessage?.(messageId, editContent.trim());
    setIsEditing(false);
  };

  const handleFeedback = (val) => {
    const next = feedback === val ? null : val;
    setFeedback(next);
    onFeedback?.(messageId, next);
  };

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 300)}px`;
    }
  }, [isEditing, editContent]);

  const markdownComponents = React.useMemo(
    () => buildMarkdownComponents(onOpenArtifact),
    [onOpenArtifact]
  );

  return (
    <div className={`w-full py-1.5 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
      <div className={`relative group min-w-0 ${isAssistant ? 'max-w-[96%] w-full' : 'max-w-[82%]'}`}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full"
            >
              <div
                className="w-full rounded-2xl overflow-hidden border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                    else if (e.key === 'Escape') setIsEditing(false);
                  }}
                  style={{
                    width: '100%', background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 13.5, lineHeight: 1.65, padding: '12px 16px', outline: 'none',
                    resize: 'none', border: 'none', fontFamily: 'inherit',
                  }}
                  rows={2}
                />
                <div className="flex items-center justify-end gap-1.5 px-3 pb-2.5">
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === content}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', fontSize: 11, fontWeight: 500,
                      background: 'var(--text-primary)', color: 'var(--bg-primary)',
                      border: 'none', cursor: 'pointer', borderRadius: 8, opacity: (!editContent.trim() || editContent === content) ? 0.3 : 1,
                    }}
                  >
                    <Check size={10} /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end'} w-full`}>

              {/* Web sources */}
              {isAssistant && (metadata?.sources || streamingSources || metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)) && (
                <SourceGrid
                  sources={metadata?.sources || streamingSources}
                  searchPerformed={metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)}
                />
              )}

              {/* Message bubble */}
              <motion.div
                key="bubble"
                initial={isStreaming ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={isStreaming ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative min-w-0 max-w-full break-words overflow-hidden"
                style={isAssistant ? {
                  color: 'var(--text-primary)',
                  padding: '4px 0',
                } : {
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  borderRadius: '20px 20px 4px 20px',
                  padding: '10px 16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
              >
                {isAssistant ? (
                  <div className="markdown-content" style={{ position: 'relative' }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {displayContent || ''}
                    </ReactMarkdown>
                    {/* Streaming cursor appended after last char */}
                    {showCursor && displayContent && (
                      <StreamCursor />
                    )}
                  </div>
                ) : (
                  <div>
                    <p
                      style={{
                        color: 'inherit',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        fontSize: 13.5,
                        margin: 0,
                        display: !isExpanded && displayContent?.length > 400 ? '-webkit-box' : 'block',
                        WebkitLineClamp: !isExpanded && displayContent?.length > 400 ? 8 : undefined,
                        WebkitBoxOrient: !isExpanded && displayContent?.length > 400 ? 'vertical' : undefined,
                        overflow: !isExpanded && displayContent?.length > 400 ? 'hidden' : 'visible',
                      }}
                    >
                      {displayContent}
                    </p>
                    {displayContent?.length > 400 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Canvas card — only after streaming ends */}
              {isAssistant && hasCanvas && !isStreaming && (
                <CanvasCard
                  onOpenCanvas={onOpenCanvas}
                  messageId={messageId}
                  canvasType={canvasType}
                  stepCount={steps?.length}
                />
              )}

              {/* Artifact chip */}
              {isAssistant && metadata?.artifactId && (
                <ArtifactChip artifactId={metadata.artifactId} />
              )}

              {/* Action bar — shown on hover after stream ends */}
              <AnimatePresence>
                {!isEditing && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className={`flex items-center gap-0 mt-1 ${isAssistant ? '' : 'flex-row-reverse'}`}
                  >
                    <ActionBtn onClick={handleCopy} title="Copy">
                      {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    </ActionBtn>

                    {!isAssistant && onEditMessage && (
                      <ActionBtn onClick={handleStartEdit} title="Edit">
                        <Edit2 size={12} />
                      </ActionBtn>
                    )}

                    {onRegenerateMessage && (
                      <ActionBtn onClick={() => onRegenerateMessage(messageId)} title="Regenerate">
                        <RefreshCw size={12} />
                      </ActionBtn>
                    )}

                    {isAssistant && (
                      <>
                        <ActionBtn
                          onClick={() => handleFeedback('up')}
                          title="Helpful"
                          className={feedback === 'up' ? '!text-emerald-500' : ''}
                        >
                          <ThumbsUp size={12} style={feedback === 'up' ? { color: '#10b981' } : {}} />
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => handleFeedback('down')}
                          title="Not helpful"
                          className={feedback === 'down' ? '!text-red-400' : ''}
                        >
                          <ThumbsDown size={12} style={feedback === 'down' ? { color: '#f87171' } : {}} />
                        </ActionBtn>

                        <ActionBtn
                          onClick={() => {
                            const fullText = displayContent || '';
                            let insight = fullText.split('\n\n').slice(0, 2).join('\n\n');
                            if (insight.length > 300) insight = insight.substring(0, 297) + '...';
                            useTutorStore.getState().addTakeaway?.(insight);
                            useTutorStore.getState().showToast?.({
                              message: 'Saved to Key Insights',
                              type: 'success',
                              duration: 3500,
                              action: { label: 'View', onClick: () => useTutorStore.getState().setMasteryOpen?.(true) },
                            });
                          }}
                          title="Save as Key Insight"
                        >
                          <BookMarked size={12} />
                        </ActionBtn>
                      </>
                    )}

                    <span
                      className={`tabular-nums tracking-wide px-1 flex items-center gap-1.5 ${isAssistant ? '' : 'order-first'}`}
                      style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5 }}
                    >
                      {isAssistant && metadata?.latencyMs && (
                        <>
                          <Activity size={8} style={{ color: 'var(--info)', opacity: 0.7 }} />
                          <span>{(metadata.latencyMs / 1000).toFixed(1)}s</span>
                          <span style={{ opacity: 0.3 }}>·</span>
                        </>
                      )}
                      {formatTime(timestamp)}
                      {metadata?.edited && <span style={{ marginLeft: 4, fontStyle: 'italic', opacity: 0.6 }}>· edited</span>}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Version switcher */}
              {metadata?.versions?.length > 1 && !isStreaming && (
                <div className={`flex items-center gap-2.5 mt-2 ${isAssistant ? '' : 'justify-end'}`}>
                  <div
                    className="flex items-center rounded-full"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '2px 6px' }}
                  >
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.max(0, metadata.activeVersionIndex - 1))}
                      disabled={metadata.activeVersionIndex === 0}
                      style={{
                        padding: 3, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer',
                        opacity: metadata.activeVersionIndex === 0 ? 0.2 : 1,
                      }}
                    >
                      <ChevronLeft size={13} strokeWidth={2.5} />
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', padding: '0 4px', minWidth: 32, textAlign: 'center' }}>
                      {metadata.activeVersionIndex + 1} / {metadata.versions.length}
                    </span>
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      style={{
                        padding: 3, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer',
                        opacity: metadata.activeVersionIndex === metadata.versions.length - 1 ? 0.2 : 1,
                      }}
                    >
                      <ChevronRight size={13} strokeWidth={2.5} />
                    </button>
                  </div>
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
