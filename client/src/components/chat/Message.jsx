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

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import {
  Copy, Edit2, Trash2, Check, RefreshCw,
  ChevronLeft, ChevronRight, BookOpen,
  Code, Globe, FileText, Table2, GitBranch,
  Layers, ThumbsUp, ThumbsDown,
  ChevronRight as ChevronRightIcon,
  Play, FlaskConical, Network, BookMarked, Activity,
  Loader2, Image as ImageIcon, Sparkles, Eye, Quote,
  ArrowRight, CornerDownRight, List, Info, Code2,
  Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import useTutorStore from '../../store/tutorStore';
import VisualArtifactCard from './VisualArtifactCard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism as prismTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Streaming cursor ─────────────────────────────────────────────────────────

const StreamCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }}
    className="inline-block ml-1 font-normal text-[var(--text-primary)]"
    style={{ verticalAlign: 'baseline', lineHeight: 1 }}
  >
    |
  </motion.span>
);

const extractJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return { content: text };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { content: text };

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.chat_response) {
      return {
        content: parsed.chat_response,
        artifact: parsed.artifact || null,
        canvasType: parsed.canvasType || parsed.artifact?.type || null
      };
    }
    if (parsed.text && typeof parsed.text === 'string') {
      return { content: parsed.text, artifact: parsed.artifact || null };
    }
  } catch (e) {
    // If it's a partial JSON during streaming, we might be able to extract chat_response via regex
    const chatResponseMatch = trimmed.match(/"chat_response"\s*:\s*"([^"]*)"/);
    if (chatResponseMatch) {
      return { content: chatResponseMatch[1].replace(/\\n/g, '\n'), artifact: null };
    }
  }
  return { content: text };
};

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

const DataVisualizer = ({ type, data, onLaunchImmersive }) => {
  const isSmall = type === 'array' ? data.length <= 4 : Object.keys(data).length <= 3;
  const isCongested = type === 'array' ? data.length > 8 : Object.keys(data).length > 6;

  if (type === 'array') {
    return (
      <div className={`flex flex-col gap-3.5 ${isSmall ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 shrink-0">
            <List size={11} className="opacity-30" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-40">Array · {data.length}</span>
          </div>
          <button 
            onClick={() => onLaunchImmersive?.(type, data)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-all hover:translate-x-0.5"
          >
            <Sparkles size={11} /> 
            <span>Visualize</span>
          </button>
        </div>
        
        {isCongested ? (
          <div className="py-8 px-6 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center text-center gap-4">
            <Activity size={24} className="text-[var(--info)] opacity-40" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-white/90">Dataset is large</p>
              <p className="text-[11px] text-white/40 max-w-[220px]">This array contains {data.length} elements. Launch the canvas for the full interactive view.</p>
            </div>
            <button 
              onClick={() => onLaunchImmersive?.(type, data)}
              className="mt-1 px-5 py-2 rounded-xl bg-[var(--info)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              Launch Visualizer
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {data.slice(0, 15).map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 group/node shrink-0">
                <span className="text-[8px] font-bold opacity-20 uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{idx}</span>
                <div 
                  className="w-10 h-10 rounded-full border flex items-center justify-center transition-all group-hover/node:border-[var(--info)]/40"
                  style={{ 
                    background: 'rgba(var(--text-primary-rgb, 0,0,0), 0.02)', 
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {String(item)}
                </div>
              </div>
            ))}
            {data.length > 15 && <span className="text-[12px] opacity-20 font-mono self-center px-2">...</span>}
          </div>
        )}
      </div>
    );
  }

  if (type === 'object') {
    return (
      <div className={`flex flex-col gap-4 ${isSmall ? 'p-3.5' : 'p-5'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 shrink-0">
            <Layers size={11} className="opacity-40" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Object · {Object.keys(data).length}</span>
          </div>
          <button 
            onClick={() => onLaunchImmersive?.(type, data)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--info)]/10 text-[var(--info)] hover:bg-[var(--info)]/20 transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles size={11} /> 
            <span className="text-[10px] font-bold uppercase tracking-widest">Visualize</span>
          </button>
        </div>

        {isCongested ? (
          <div className="py-8 px-6 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center text-center gap-4">
            <Network size={24} className="text-[var(--info)] opacity-40" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-white/90">Complex Data Structure</p>
              <p className="text-[11px] text-white/40 max-w-[220px]">This object contains many nested properties. Open the visualizer for a better representation.</p>
            </div>
            <button 
              onClick={() => onLaunchImmersive?.(type, data)}
              className="mt-1 px-5 py-2 rounded-xl bg-[var(--info)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              Launch Visualizer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(data).map(([key, val], idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border bg-white/[0.02] hover:border-[var(--info)]/50 transition-all group/item" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{key}</span>
                  <span className="text-[13px] font-mono font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                </div>
                <CornerDownRight size={12} className="opacity-10 group-hover/item:opacity-30 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CodeBlock = memo(({ children, className, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const lang = (className || '').replace(/^language-/, '').toLowerCase();
  const langColor = LANG_COLORS[lang] || '#888';
  
  const PROGRAM_LANGS = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'cpp', 'c++', 'c', 'rust', 'rs', 'go', 'ruby', 'swift', 'kotlin', 'php', 'bash', 'sh', 'sql', 'html', 'css'
  ];
  const isProgramLang = PROGRAM_LANGS.includes(lang);
  const isRunnable = ['javascript', 'js', 'python', 'py', 'java', 'cpp', 'c++', 'c', 'rust', 'rs', 'go', 'ruby', 'ts', 'typescript'].includes(lang);
  const code = String(children).replace(/\n$/, '');

  const simpleData = useMemo(() => {
    if (lang && !['json', 'text', ''].includes(lang)) return null;
    try {
      const trimmed = code.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 16 && parsed.every(i => typeof i !== 'object')) {
        return { type: 'array', data: parsed };
      }
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length > 0 && keys.length <= 8 && Object.values(parsed).every(v => typeof v !== 'object')) {
          return { type: 'object', data: parsed };
        }
      }
      return null;
    } catch (e) { return null; }
  }, [code, lang]);

  const showHeader = isProgramLang || (lang && !['json', 'text', 'markdown', 'md', 'yaml'].includes(lang));

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleLaunchImmersive = useCallback((type, data) => {
    console.log('[CodeBlock] 🚀 Launching immersive visualization:', { type, length: Array.isArray(data) ? data.length : Object.keys(data).length });
    
    const timeline = {
      title: type === 'array' ? 'Array Visualization' : 'Object Breakdown',
      domain: 'computer_science',
      renderer: 'd3',
      totalSteps: 1,
      elements: [
        {
          id: 'viz-main-element',
          type: type === 'array' ? 'array' : 'object',
          values: type === 'array' ? data : undefined,
          properties: type === 'object' ? data : undefined,
          x: 400, y: 300,
          title: type === 'array' ? 'Array Structure' : 'Object Properties'
        }
      ],
      steps: [
        {
          id: 'immersive-viz-step-1',
          narration: `This is a visual representation of your ${type}. Explore the structure and elements here.`,
          objects: ['viz-main-element']
        }
      ]
    };
    
    // Update store and trigger canvas
    const state = useTutorStore.getState();
    state.setTimeline(timeline);
    state.setCanvasLayout('split');
    state.setActiveArtifact?.('immersive-viz');
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className={`my-3 rounded-[24px] overflow-hidden border shadow-sm group/code transition-all duration-500 no-scrollbar ${!showHeader ? 'hover:shadow-xl' : ''}`}
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-secondary)', 
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Header — macOS style dots + language */}
      {showHeader && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ 
            borderColor: 'var(--border-color)', 
            background: showHeader ? 'rgba(var(--text-primary-rgb, 0,0,0), 0.03)' : 'transparent' 
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10">
              <Code2 size={11} className="opacity-40" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60">
                {lang || 'code'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isRunnable && (
              <button
                onClick={() => onOpenArtifact?.(code, lang)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all hover:bg-[var(--text-primary)]/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                <Play size={10} className="text-emerald-500" /> Run
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all hover:bg-[var(--text-primary)]/5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Code Body */}
      <div className="relative">
        {simpleData ? (
          <DataVisualizer {...simpleData} onLaunchImmersive={handleLaunchImmersive} />
        ) : (
          <SyntaxHighlighter
            language={lang || 'text'}
            style={isDarkMode ? vscDarkPlus : prismTheme}
            customStyle={{
              margin: 0,
              padding: showHeader ? '16px 20px' : '12px 16px',
              fontSize: '13px',
              lineHeight: '1.6',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}
            codeTagProps={{
              style: { 
                fontFamily: 'var(--font-mono)', 
                background: 'transparent',
                color: 'inherit'
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}
        
        {!showHeader && !simpleData && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 border border-white/10 opacity-0 group-hover/code:opacity-100 transition-opacity"
            title="Copy Code"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/40" />}
          </button>
        )}
      </div>
    </div>
  );
});

// ─── Markdown components ──────────────────────────────────────────────────────

const buildMarkdownComponents = (onOpenArtifact) => ({
  p: ({ children }) => (
    <p style={{ marginBottom: 14, lineHeight: 1.75, fontSize: 14, color: 'var(--text-primary)', opacity: 0.95, wordBreak: 'break-word' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', opacity: 0.85 }}>{children}</em>,
  h1: ({ children }) => (
    <h1 style={{ 
      fontSize: 18, fontWeight: 800, marginBottom: 14, marginTop: 24, 
      letterSpacing: '-0.02em', color: 'var(--text-primary)', 
      borderBottom: '2px solid var(--border-color)', paddingBottom: 10 
    }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ 
      fontSize: 16, fontWeight: 700, marginBottom: 12, marginTop: 20, 
      letterSpacing: '-0.01em', color: 'var(--text-primary)' 
    }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ 
      fontSize: 14.5, fontWeight: 700, marginBottom: 10, marginTop: 16, 
      color: 'var(--text-primary)', letterSpacing: '-0.01em' 
    }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 22, marginBottom: 14, listStyleType: 'disc' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 22, marginBottom: 14, listStyleType: 'decimal' }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ marginBottom: 6, lineHeight: 1.7, fontSize: 14, color: 'var(--text-primary)', opacity: 0.9 }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ 
      borderLeft: '4px solid var(--text-tertiary)', 
      paddingLeft: 20, marginLeft: 0, marginTop: 18, marginBottom: 18, 
      opacity: 0.95, fontStyle: 'italic', 
      background: 'rgba(var(--bg-secondary-rgb), 0.5)',
      paddingTop: 8, paddingBottom: 8, borderRadius: '0 8px 8px 0'
    }}>
      {children}
    </blockquote>
  ),
  code: ({ className, children, inline }) => {
    if (inline) {
      return (
        <code style={{
          fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: '1px 5px', color: 'var(--text-primary)',
        }}>
          {children}
        </code>
      );
    }
    return <CodeBlock className={className} onOpenArtifact={onOpenArtifact}>{children}</CodeBlock>;
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ 
      textAlign: 'left', 
      padding: '12px 14px', 
      background: 'var(--bg-secondary)', 
      borderBottom: '2px solid var(--border-color)', 
      fontWeight: 700, 
      fontSize: 11, 
      color: 'var(--text-primary)', 
      textTransform: 'uppercase', 
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap'
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ 
      padding: '12px 14px', 
      borderBottom: '1px solid var(--border-color)', 
      color: 'var(--text-primary)', 
      opacity: 0.9,
      minWidth: '120px'
    }}>
      {children}
    </td>
  ),
  a: ({ children, href }) => {
    let safeHref = '#';
    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        safeHref = parsed.toString();
      }
    } catch {
      safeHref = '#';
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--info)', opacity: 0.9 }}>{children}</a>
    );
  },
  hr: () => <hr style={{ border: 'none', borderTop: '2px solid var(--border-color)', margin: '20px 0' }} />,
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
            } catch { }
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
  d3: { icon: Network, label: 'Visual Canvas', desc: 'Interactive concept map', color: 'var(--info)' },
  physics: { icon: FlaskConical, label: 'Physics Simulation', desc: 'Interactive physics canvas', color: 'var(--warning)' },
  default: { icon: Layers, label: 'Interactive Canvas', desc: 'Step-by-step visual', color: 'var(--text-tertiary)' },
};

const CanvasCard = ({ onOpenCanvas, messageId, canvasType, stepCount, title }) => {
  const activeSnapshotId = useTutorStore(s => s.activeSnapshotId);
  const isActive = activeSnapshotId === messageId;
  const setCanvasLayout = useTutorStore(s => s.setCanvasLayout);

  console.log('[CanvasCard] Rendering', { messageId, isActive, title });

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
          {title || cfg.label}
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
          background: isActive ? 'var(--success)' : 'var(--text-primary)',
          color: 'var(--bg-primary)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}
      >
        {isActive ? <Check size={9} /> : <Eye size={9} />}
        {isActive ? 'Active' : 'Open'}
      </div>
    </motion.button>
  );
};

// ─── Artifact chip (linked artifact in panel) ─────────────────────────────────

const ARTIFACT_TYPE_CONFIG = {
  code: { icon: Code, label: 'Code', color: '#3b82f6' },
  ui: { icon: Globe, label: 'UI Preview', color: '#8b5cf6' },
  document: { icon: FileText, label: 'Document', color: '#10b981' },
  table: { icon: Table2, label: 'Table', color: '#f59e0b' },
  diagram: { icon: GitBranch, label: 'Diagram', color: '#ec4899' },
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

// ─── Action button (ghost, compact) ───────────────────────────────────────────

const ActionBtn = ({ onClick, title, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`chat-action-btn ${className}`}
    style={{
      padding: '3px',
      borderRadius: 5,
      transition: 'opacity 0.18s ease, background 0.18s ease',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--text-tertiary)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.7,
      lineHeight: 0,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.opacity = '1';
      e.currentTarget.style.background = 'var(--bg-tertiary)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.opacity = '0.7';
      e.currentTarget.style.background = 'transparent';
    }}
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
  canvasSnapshot,
  isSessionActive,
  streamingMessageId,
  onHover,
}) => {
  const isAssistant = role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(metadata?.feedback || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const editRef = useRef(null);

  // Hover broadcasting
  const handleMouseEnter = () => onHover?.(messageId);
  const handleMouseLeave = () => onHover?.(null);

  const isThisStreaming = isSessionActive && streamingMessageId === messageId;
  const isCurrentlyStreaming = isStreaming && isThisStreaming;

  const rawContent = isStreaming ? streamingContent : content;
  const { content: displayContent, artifact: extractedArtifact } = React.useMemo(
    () => extractJsonResponse(rawContent),
    [rawContent]
  );

  const artifactData = metadata?.artifactData || extractedArtifact;
  const isWaitingToRegenerate = isSessionActive && !isStreaming && streamingMessageId === messageId;
  const isRegenerating = isSessionActive && isStreaming && streamingMessageId === messageId && !displayContent;

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
      requestAnimationFrame(() => {
        if (!editRef.current) return;
        editRef.current.style.height = 'auto';
        editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 300)}px`;
      });
    }
  }, [isEditing, editContent]);

  const markdownComponents = React.useMemo(
    () => buildMarkdownComponents(onOpenArtifact),
    [onOpenArtifact]
  );

  const isBeingRegenerated = isSessionActive && streamingMessageId === messageId;
  const showLocalIndicator = isBeingRegenerated && (!isStreaming || !displayContent);

  return (
    <div 
      data-message-id={messageId} 
      className={`w-full py-1.5 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`relative group min-w-0 ${isAssistant ? 'max-w-[96%] w-full' : 'max-w-[82%]'}`}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                initial={isStreaming ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={isStreaming ? { duration: 0 } : { duration: 0.2 }}
                className="relative min-w-0 max-w-full break-words overflow-hidden transition-all duration-300"
                style={isAssistant ? {
                  color: 'var(--text-primary)',
                  padding: '4px 0 12px 0',
                  background: 'transparent',
                  border: 'none',
                } : {
                  background: 'var(--user-bubble-bg)',
                  color: 'var(--bg-primary)', // User bubble uses primary text as background, so inverse text
                  borderRadius: '22px 22px 4px 22px',
                  padding: '12px 18px',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-color)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {isAssistant ? (
                  <div className="markdown-content" style={{ position: 'relative' }}>
                    {showLocalIndicator ? (
                      <div className="flex items-center gap-[4px] py-2 px-1 opacity-60">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.3, 1, 0.3]
                            }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              delay: i * 0.2,
                              ease: 'easeInOut',
                            }}
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: 'var(--text-tertiary)',
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {(displayContent || '') + (isStreaming ? '█' : '')}
                      </ReactMarkdown>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {(() => {
                      // Detect "Context: ... Question: ..." pattern
                      const contextMatch = displayContent?.match(/^Context: "([\s\S]*?)"\n\nQuestion: ([\s\S]*)$/);

                      if (contextMatch) {
                        const [, context, question] = contextMatch;
                        return (
                          <>
                            {/* Context Card */}
                            <div
                              className="py-1.5 mb-2 mt-1"
                              style={{ borderLeft: '4px solid currentColor', paddingLeft: 18, opacity: 0.6 }}
                            >
                              <div className="flex items-center gap-2 mb-1 opacity-80">
                                <Quote size={10} className="fill-current" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Context</span>
                              </div>
                              <p
                                className="text-[13px] leading-relaxed italic font-normal"
                                style={{
                                  color: 'inherit',
                                  opacity: 1,
                                  display: isContextExpanded ? 'block' : '-webkit-box',
                                  WebkitLineClamp: isContextExpanded ? 'none' : 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: isContextExpanded ? 'visible' : 'hidden',
                                }}
                              >
                                "{context}"
                              </p>
                              {context.length > 100 && (
                                <button
                                  onClick={() => setIsContextExpanded(!isContextExpanded)}
                                  className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity block text-left"
                                >
                                  {isContextExpanded ? 'Collapse' : 'READ MORE ...'}
                                </button>
                              )}
                            </div>
                            {/* Question text */}
                            <p 
                              className="text-[14px] leading-relaxed font-medium px-1"
                              style={{ color: 'var(--bg-primary)', opacity: 1 }}
                            >
                              {question}
                            </p>
                          </>
                        );
                      }

                      return (
                        <p
                          style={{
                            color: 'var(--bg-primary)',
                            opacity: 1,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                            fontSize: 14,
                            margin: 0,
                            display: !isExpanded && displayContent?.length > 400 ? '-webkit-box' : 'block',
                            WebkitLineClamp: !isExpanded && displayContent?.length > 400 ? 8 : undefined,
                            WebkitBoxOrient: !isExpanded && displayContent?.length > 400 ? 'vertical' : undefined,
                            overflow: !isExpanded && displayContent?.length > 400 ? 'hidden' : 'visible',
                          }}
                        >
                          {displayContent}
                        </p>
                      );
                    })()}

                    {displayContent?.length > 400 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ 
                          marginTop: 6, fontSize: 11, fontWeight: 700, 
                          textTransform: 'uppercase', letterSpacing: '0.08em', 
                          opacity: 0.8, color: 'var(--bg-primary)', 
                          background: 'none', border: 'none', cursor: 'pointer', 
                          padding: 0, textAlign: 'left', display: 'block', width: 'fit-content'
                        }}
                      >
                        {isExpanded ? 'Show less' : 'READ MORE ...'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Visual Artifact Card (Progressive & Final) */}
              {isAssistant && (metadata?.artifactId || metadata?.hasVisualArtifact || artifactData) && (
                <VisualArtifactCard
                  artifactId={metadata?.artifactId}
                  artifactData={artifactData}
                  title={artifactData?.title || metadata?.artifactTitle}
                  rendererType={artifactData?.rendererType || artifactData?.type || metadata?.rendererType}
                  status={metadata?.artifactStatus || (isStreaming ? 'generating' : 'completed')}
                />
              )}

              {/* Legacy Canvas card — only after streaming ends */}
              {isAssistant && hasCanvas && !isStreaming && !metadata?.artifactId && (
                <CanvasCard
                  onOpenCanvas={onOpenCanvas}
                  messageId={messageId}
                  canvasType={canvasType}
                  stepCount={steps?.length}
                  title={canvasSnapshot?.title || metadata?.canvasSnapshot?.title}
                />
              )}

              {/* ── Compact Action Row ── */}
              <div
                className="flex items-center select-none"
                style={{
                  width: 'fit-content',
                  marginTop: 4,
                  marginLeft: isAssistant ? 0 : 'auto',
                  flexDirection: isAssistant ? 'row' : 'row-reverse',
                  gap: 6,
                  height: 22,
                }}
              >
                {/* Actions — always visible */}
                {!isEditing && !isStreaming && !isSessionActive && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    {onRegenerateMessage && isAssistant && (
                      <ActionBtn onClick={() => onRegenerateMessage(messageId)} title="Regenerate">
                        <RefreshCw size={14} strokeWidth={2} />
                      </ActionBtn>
                    )}

                    <ActionBtn onClick={handleCopy} title="Copy">
                      {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} strokeWidth={2} />}
                    </ActionBtn>

                    {!isAssistant && onEditMessage && (
                      <ActionBtn onClick={handleStartEdit} title="Edit">
                        <Edit2 size={14} strokeWidth={2} />
                      </ActionBtn>
                    )}

                    {isAssistant && (
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
                        <BookMarked size={14} strokeWidth={2} />
                      </ActionBtn>
                    )}
                  </div>
                )}

                {/* Version navigator — always visible when 2+ versions */}
                {metadata?.versions?.length > 1 && !isStreaming && !isSessionActive && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0,
                      userSelect: 'none',
                    }}
                  >
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.max(0, metadata.activeVersionIndex - 1))}
                      disabled={metadata.activeVersionIndex === 0}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: metadata.activeVersionIndex === 0 ? 'default' : 'pointer',
                        padding: '0 1px',
                        color: 'var(--text-tertiary)',
                        opacity: metadata.activeVersionIndex === 0 ? 0.15 : 0.8,
                        fontSize: 13,
                        lineHeight: 1,
                        transition: 'opacity 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => { if (metadata.activeVersionIndex !== 0) e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { if (metadata.activeVersionIndex !== 0) e.currentTarget.style.opacity = '0.5'; }}
                    >
                      ‹
                    </button>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text-tertiary)',
                        opacity: 0.8,
                        fontVariantNumeric: 'tabular-nums',
                        padding: '0 2px',
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                      }}
                    >
                      {metadata.activeVersionIndex + 1}/{metadata.versions.length}
                    </span>
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: metadata.activeVersionIndex === metadata.versions.length - 1 ? 'default' : 'pointer',
                        padding: '0 1px',
                        color: 'var(--text-tertiary)',
                        opacity: metadata.activeVersionIndex === metadata.versions.length - 1 ? 0.15 : 0.5,
                        fontSize: 13,
                        lineHeight: 1,
                        transition: 'opacity 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => { if (metadata.activeVersionIndex !== metadata.versions.length - 1) e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { if (metadata.activeVersionIndex !== metadata.versions.length - 1) e.currentTarget.style.opacity = '0.5'; }}
                    >
                      ›
                    </button>
                  </div>
                )}

                {/* Metadata — visible on hover, secondary emphasis */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-[180ms] ease-out"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                    fontWeight: 400,
                  }}
                >
                  <div style={{ opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isAssistant && metadata?.latencyMs && (
                      <span>{(metadata.latencyMs / 1000).toFixed(1)}s</span>
                    )}
                    {isAssistant && metadata?.latencyMs && <span>·</span>}
                    <span>{formatTime(timestamp)}</span>
                    {metadata?.edited && <span>· edited</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Message;