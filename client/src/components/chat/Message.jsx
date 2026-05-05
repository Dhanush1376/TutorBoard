/**
 * Message.jsx — TutorBoard AI Chat Message Component
 *
 * UPGRADED:
 * - KaTeX math rendering (inline $ and block $$)
 * - Syntax-highlighted code blocks with language label
 * - Smart canvas CTA — only shown when relevant (not on every message)
 * - Formula highlight boxes for equations
 * - Mermaid diagram preview inline
 * - Hierarchical / tree output for data structures
 * - AI "thinking" dropdown
 * - Source cards
 * - Artifact chip
 * - Version switcher
 * - Feedback buttons (thumbs up/down)
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Copy, Edit2, Trash2, Check, RefreshCw,
  ChevronLeft, ChevronRight, BookOpen,
  Code, Globe, FileText, Table2, GitBranch,
  Layers, ThumbsUp, ThumbsDown, ChevronRight as ChevronRightIcon,
  Play, FlaskConical, Network, BookMarked, Activity, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VisaiLogo from '../layout/VisaiLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import useTutorStore from '../../store/tutorStore';

// ─── Artifact type config ────────────────────────────────────────────────────

const ARTIFACT_TYPE_CONFIG = {
  code: { icon: Code, label: 'Code', color: '#3b82f6' },
  ui: { icon: Globe, label: 'UI Preview', color: '#8b5cf6' },
  document: { icon: FileText, label: 'Document', color: '#10b981' },
  table: { icon: Table2, label: 'Table', color: '#f59e0b' },
  diagram: { icon: GitBranch, label: 'Diagram', color: '#ec4899' },
};

// ─── Language label colors ───────────────────────────────────────────────────

const LANG_COLORS = {
  javascript: '#f7df1e', js: '#f7df1e',
  typescript: '#3178c6', ts: '#3178c6',
  python: '#3776ab', py: '#3776ab',
  java: '#f89820',
  cpp: '#659ad2', c: '#a8b9cc',
  go: '#00add8',
  rust: '#ce422b', rs: '#ce422b',
  html: '#e34f26',
  css: '#1572b6',
  sql: '#cc2927',
  bash: '#4eaa25', sh: '#4eaa25',
  json: '#cbcb41',
  yaml: '#cb171e',
  markdown: '#083fa1', md: '#083fa1',
};

// ─── Inline code copy button ─────────────────────────────────────────────────

const CodeBlock = memo(({ children, className, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  const lang = (className || '').replace(/^language-/, '').toLowerCase();
  const langColor = LANG_COLORS[lang] || '#888';
  const isRunnable = ['javascript', 'js', 'python', 'py', 'java', 'cpp', 'c++', 'c', 'rust', 'rs', 'go', 'ruby', 'ts', 'typescript'].includes(lang);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setShowOutput(true);
    setOutput('Running...');
    try {
      const logs = [];
      const fakeConsole = {
        log: (...args) => logs.push(args.map(String).join(' ')),
        error: (...args) => logs.push('ERROR: ' + args.map(String).join(' ')),
        warn: (...args) => logs.push('WARN: ' + args.map(String).join(' ')),
      };
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', code);
      const result = fn(fakeConsole);
      if (result !== undefined) logs.push('→ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
      setOutput(logs.join('\n') || '(no output)');
    } catch (err) {
      setOutput(`${err.name}: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [code]);

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-color)]/20">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: langColor }}
          />
          <span className="text-[10px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            {lang || 'code'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isRunnable && (
            <button
              onClick={() => onOpenArtifact?.(code, lang)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-80 transition-colors"
            >
              <Play size={8} />
              Run
            </button>
          )}
          {onOpenArtifact && !isRunnable && (
            <button
              onClick={() => onOpenArtifact(code, lang)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--text-primary)]/[0.08] text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.12] transition-colors"
            >
              <FlaskConical size={8} />
              Open
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--text-primary)]/[0.04] text-[var(--text-tertiary)] hover:bg-[var(--text-primary)]/[0.08] hover:text-[var(--text-primary)] transition-colors"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="p-4 overflow-x-auto text-[12.5px] font-mono leading-[1.65] text-[var(--text-primary)]/90">
        <code>{code}</code>
      </pre>

      {/* Output */}
      <AnimatePresence>
        {showOutput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.06] bg-[#0a0f16]"
          >
            <div className="flex items-center justify-between px-3 py-1 border-b border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-widest font-medium text-white/30">Output</span>
              <button onClick={() => setShowOutput(false)} className="text-[9px] text-white/20 hover:text-white/50">✕</button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap max-h-40 overflow-auto leading-relaxed">
              {output}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Formula highlight box ───────────────────────────────────────────────────

const FormulaBlock = ({ children }) => (
  <div className="my-4 px-5 py-4 rounded-xl border border-[var(--text-tertiary)]/15 bg-[var(--text-primary)]/[0.025] overflow-x-auto text-center">
    <div className="katex-display-wrapper text-[var(--text-primary)]">
      {children}
    </div>
  </div>
);

// ─── Markdown components ─────────────────────────────────────────────────────

const buildMarkdownComponents = (onOpenArtifact) => ({
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-[1.75] text-[13.5px] text-[var(--text-primary)]/90 break-words">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic opacity-80">{children}</em>
  ),
  h1: ({ children }) => (
    <h1 className="text-[17px] font-bold mb-4 mt-6 first:mt-0 tracking-tight text-[var(--text-primary)] leading-tight border-b border-[var(--border-color)]/25 pb-2.5">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[15px] font-semibold mb-2.5 mt-5 first:mt-0 tracking-[-0.01em] text-[var(--text-primary)] leading-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[14px] font-medium mb-2 mt-4 first:mt-0 text-[var(--text-primary)] leading-snug">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 pl-5 space-y-1.5 list-disc marker:text-[var(--text-tertiary)] text-[13.5px]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 pl-5 space-y-1.5 list-decimal marker:text-[var(--text-tertiary)] marker:font-medium text-[13.5px]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-[1.7] pl-1">{children}</li>
  ),
  // Inline code
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="px-1.5 py-[2px] rounded-md text-[12px] font-mono bg-[var(--text-primary)]/[0.07] text-[var(--text-primary)] border border-[var(--border-color)]/20">
          {children}
        </code>
      );
    }
    return (
      <CodeBlock className={className} onOpenArtifact={onOpenArtifact}>
        {children}
      </CodeBlock>
    );
  },
  // Block math ($$...$$)
  div: ({ className, children }) => {
    if (className === 'math math-display') {
      return <FormulaBlock>{children}</FormulaBlock>;
    }
    return <div className={className}>{children}</div>;
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-[4px] border-[var(--text-tertiary)]/40 pl-4 py-2 pr-2 my-4 rounded-r-lg bg-[var(--text-primary)]/[0.03] text-[13px] text-[var(--text-secondary)] italic leading-relaxed">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-6 border-[var(--border-color)]" />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 text-[var(--text-primary)] font-medium hover:opacity-60 transition-opacity decoration-[var(--text-tertiary)]/30"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-[var(--border-color)]/60 shadow-sm">
      <table className="text-[12.5px] border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--text-primary)]/[0.04]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider border-b border-[var(--border-color)]/60 text-[var(--text-secondary)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 border-b border-[var(--border-color)]/10 text-[var(--text-primary)]/85 leading-relaxed">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-[var(--bg-tertiary)]/20 transition-colors">{children}</tr>
  ),
});

// ─── Artifact chip ───────────────────────────────────────────────────────────

const ArtifactChipForMessage = ({ artifactId }) => {
  const { artifacts, setActiveArtifact, openArtifactPanel } = useTutorStore();
  const artifact = artifacts.find(a => a.id === artifactId || a.dbId === artifactId);
  if (!artifact) return null;

  const config = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.code;
  const Icon = config.icon;

  return (
    <button
      onClick={() => { setActiveArtifact(artifact.id); openArtifactPanel(); }}
      className="mt-3.5 flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/30 hover:border-[var(--text-tertiary)]/50 hover:bg-[var(--bg-tertiary)] transition-all group w-full max-w-xs text-left"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${config.color}18` }}
      >
        <Icon size={17} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {artifact.title}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
          Click to open {config.label}
        </div>
      </div>
      <ChevronRightIcon size={13} className="text-[var(--text-tertiary)] opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
};

// ─── Canvas CTA (context-aware) ──────────────────────────────────────────────

const CanvasCTA = ({ onOpenCanvas, messageId, canvasType }) => {
  const labels = {
    cinematic: { icon: Layers, label: 'Watch Visual Explanation', desc: 'Animated canvas breakdown' },
    d3: { icon: Network, label: 'View Data Structure', desc: 'Interactive graph / tree' },
    physics: { icon: FlaskConical, label: 'Open Physics Simulation', desc: 'Interactive physics canvas' },
    default: { icon: Layers, label: 'Open on Canvas', desc: 'Step-by-step visual' },
  };
  const cfg = labels[canvasType] || labels.default;
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => onOpenCanvas?.(messageId)}
      className="mt-3.5 flex items-center gap-3 px-4 py-2.5 bg-[var(--text-primary)]/[0.05] hover:bg-[var(--text-primary)]/[0.09] border border-[var(--border-color)]/20 hover:border-[var(--text-tertiary)]/40 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] group"
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)]/[0.07] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--text-primary)]/[0.12] transition-colors">
        <Icon size={15} strokeWidth={1.8} className="text-[var(--text-primary)]/70" />
      </div>
      <div className="flex-1 text-left">
        <div className="text-[12px] font-medium text-[var(--text-primary)]/80">
          {cfg.label}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
          {cfg.desc}
        </div>
      </div>
      <ChevronRightIcon size={13} className="text-[var(--text-tertiary)] opacity-40 group-hover:opacity-80 transition-opacity flex-shrink-0" />
    </button>
  );
};

// ─── Thinking dropdown ───────────────────────────────────────────────────────

// ThoughtBlock REMOVED per user request
const ThoughtBlock = () => null;

// ─── Source cards ────────────────────────────────────────────────────────────

const SourceGrid = ({ sources, searchPerformed }) => {
  if (!searchPerformed && (!sources || sources.length === 0)) return null;

  return (
    <div className="mb-4 w-full">
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 mb-3 w-fit px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)]/60 rounded-full shadow-sm"
      >
        {sources?.length > 0 ? (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--text-primary)]/[0.05]">
            <BookOpen size={10} className="text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="flex items-center justify-center w-5 h-5"
          >
            <Loader2 size={12} className="text-[var(--info)]" />
          </motion.div>
        )}
        <span className={`text-[11.5px] font-medium tracking-wide ${sources?.length > 0 ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
          {sources?.length > 0 ? 'Searched the web' : 'Searching the web...'}
        </span>
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
            } catch { }
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
                      <img src={favicon} alt="" className="w-3 h-3 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity" onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider truncate">{hostname}</span>
                  </div>
                  <h4 className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">{source.title}</h4>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Message ─────────────────────────────────────────────────────────────────

const Message = ({
  role, content, messageId, timestamp,
  isStreaming, streamingContent,
  isStreamingThought, streamingThought,
  streamingSources,
  isSearchPerformed: streamingSearchPerformed,
  onEditMessage, onDeleteMessage, onRegenerateMessage, onFeedback,
  onOpenCanvas, hasCanvas, canvasType,
  metadata, onSwitchVersion,
  onOpenArtifact,
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
    try {
      return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
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
    if (editContent.trim() && editContent !== content) {
      onEditMessage?.(messageId, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleFeedback = (val) => {
    const newFeedback = feedback === val ? null : val;
    setFeedback(newFeedback);
    onFeedback?.(messageId, newFeedback);
  };

  // Auto-resize edit textarea
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
    <div className={`w-full py-1 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
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
              <div className="rounded-2xl border border-[var(--text-primary)]/20 overflow-hidden bg-[var(--bg-secondary)]">
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                    else if (e.key === 'Escape') { setIsEditing(false); }
                  }}
                  className="w-full bg-transparent text-[var(--text-primary)] text-[13.5px] leading-[1.65] px-4 py-3 outline-none resize-none font-normal"
                  rows={2}
                />
                <div className="flex items-center justify-end gap-1.5 px-3 pb-2">
                  <button onClick={() => setIsEditing(false)} className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === content}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg hover:opacity-90 disabled:opacity-20 transition-all"
                  >
                    <Check size={10} /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end'} w-full`}>

              {/* Sources */}
              {isAssistant && (metadata?.sources || streamingSources || metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)) && (
                <SourceGrid
                  sources={metadata?.sources || streamingSources}
                  searchPerformed={metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)}
                />
              )}

              {/* Thinking / Reasoning Block */}
              {(metadata?.thought || (isStreaming && streamingThought)) && (
                <ThoughtBlock
                  content={metadata?.thought || streamingThought}
                  isStreaming={isStreaming && !metadata?.thought}
                />
              )}


              {/* Bubble */}
              <motion.div
                key="display"
                initial={isStreaming ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={isStreaming ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`relative min-w-0 max-w-full break-words overflow-hidden ${isAssistant
                    ? 'px-0 py-1 text-[14px] leading-relaxed'
                    : 'px-4 py-2.5 rounded-[22px] rounded-tr-[4px] text-[14px] shadow-sm'
                  }`}
                style={isAssistant ? {
                  color: 'var(--text-primary)',
                } : {
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                }}
              >
                {isAssistant ? (
                  <div className="relative markdown-content opacity-[0.98]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {displayContent || ''}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <p style={{ color: 'inherit' }} className={`whitespace-pre-wrap leading-[1.6] font-medium tracking-tight ${!isExpanded && displayContent?.length > 400 ? 'line-clamp-[8]' : ''}`}>
                      {displayContent}
                    </p>
                    {displayContent?.length > 400 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-2 self-start text-[11px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        {isExpanded ? 'Show Less' : 'Read More'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Canvas CTA — context-aware, not on every message */}
              {isAssistant && hasCanvas && !isStreaming && (
                <CanvasCTA onOpenCanvas={onOpenCanvas} messageId={messageId} canvasType={canvasType} />
              )}

              {/* Artifact chip */}
              {isAssistant && metadata?.artifactId && (
                <ArtifactChipForMessage artifactId={metadata.artifactId} />
              )}

              {/* Action bar */}
              <AnimatePresence>
                {!isEditing && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className={`flex items-center gap-0 mt-1 ${isAssistant ? '' : 'flex-row-reverse'}`}
                  >
                    <button onClick={handleCopy} title="Copy" className="chat-action-btn">
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>

                    {!isAssistant && onEditMessage && (
                      <button onClick={handleStartEdit} title="Edit" className="chat-action-btn">
                        <Edit2 size={12} />
                      </button>
                    )}

                    {onRegenerateMessage && (
                      <button
                        onClick={() => onRegenerateMessage(messageId)}
                        title="Regenerate"
                        className="chat-action-btn"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}

                    {isAssistant && (
                      <button
                        onClick={() => {
                          const fullText = displayContent || '';
                          // Capture first 300 chars or first two paragraphs
                          let insight = fullText.split('\n\n').slice(0, 2).join('\n\n');
                          if (insight.length > 300) {
                            insight = insight.substring(0, 297) + '...';
                          }
                          
                          useTutorStore.getState().addTakeaway(insight);
                          
                          // Show interactive toast
                          useTutorStore.getState().showToast({
                            message: 'Insight saved to your dashboard',
                            type: 'success',
                            duration: 4000,
                            action: {
                              label: 'View',
                              onClick: () => useTutorStore.getState().setMasteryOpen(true)
                            }
                          });
                        }}
                        title="Save as Key Insight"
                        className="chat-action-btn hover:!text-amber-500"
                      >
                        <BookMarked size={12} />
                      </button>
                    )}


                    <span className={`text-[9px] text-[var(--text-tertiary)]/40 tabular-nums tracking-wide px-1 ${isAssistant ? '' : 'order-first'} flex items-center gap-1.5`}>
                      {isAssistant && metadata?.latencyMs && (
                        <span className="flex items-center gap-0.5 opacity-80">
                          <Activity size={8} className="text-[var(--info)]/60" />
                          <span>Generated in {(metadata.latencyMs / 1000).toFixed(1)}s</span>
                          <span className="opacity-30 mx-0.5">|</span>
                        </span>
                      )}
                      {formatTime(timestamp)}
                      {metadata?.edited && <span className="ml-1 italic opacity-60">· edited</span>}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Version switcher — ChatGPT style */}
              {metadata?.versions?.length > 1 && !isStreaming && (
                <div className={`flex items-center gap-2.5 mt-2 transition-opacity ${isAssistant ? '' : 'justify-end'}`}>
                  <div className="flex items-center bg-[var(--text-primary)]/[0.04] border border-[var(--border-color)]/20 rounded-full px-1.5 py-0.5">
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.max(0, metadata.activeVersionIndex - 1))}
                      disabled={metadata.activeVersionIndex === 0}
                      className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={13} strokeWidth={2.5} />
                    </button>
                    <span className="text-[10px] font-bold tabular-nums text-[var(--text-tertiary)] px-1 min-w-[32px] text-center">
                      {metadata.activeVersionIndex + 1} / {metadata.versions.length}
                    </span>
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
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