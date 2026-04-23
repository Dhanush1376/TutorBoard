import React, { useState } from 'react';
import { User, Copy, Edit2, Trash2, Check, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VisaiLogo from '../layout/VisaiLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Markdown component styles
const MarkdownComponents = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <span className="font-normal text-[var(--text-primary)]">{children}</span>
  ),
  em: ({ children }) => (
    <em className="italic opacity-80">{children}</em>
  ),
  h1: ({ children }) => (
    <h1 className="text-[15px] font-normal mb-2 mt-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-normal mb-1.5 mt-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-normal mb-1 mt-1">{children}</h3>
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
    <th className="px-2 py-1.5 text-left font-normal border border-[var(--border-color)] bg-black/5 dark:bg-white/5">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border border-[var(--border-color)]">{children}</td>
  ),
};

const Message = ({
  role, content, steps, stepTitle, domain, visualizationType,
  onOpenCanvas, onDeleteMessage, onEditMessage, messageId, timestamp,
  elements, motion: motionData, connections, sequence, objects, hasCanvas
}) => {
  const isAssistant = role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const formatTime = (ts) => {
    try {
      const d = ts ? new Date(ts) : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const displayTime = formatTime(timestamp);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className={`w-full px-4 py-2 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar + label row */}
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
        <span className="text-[9px] text-[var(--text-tertiary)]/40 font-normal tabular-nums tracking-wider">{displayTime}</span>

        {/* Hover actions - moved to header to avoid bubble overlap */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, x: isAssistant ? -4 : 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAssistant ? -4 : 4 }}
              className={`flex items-center gap-1.5 ${isAssistant ? 'ml-1' : 'mr-1'}`}
            >
              <button
                onClick={handleCopy}
                title="Copy"
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-0.5"
              >
                {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
              </button>
              {!isAssistant && onEditMessage && (
                <button
                  onClick={() => onEditMessage(messageId, content)}
                  title="Edit"
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-0.5"
                >
                  <Edit2 size={11} />
                </button>
              )}
              {onDeleteMessage && (
                <button
                  onClick={() => onDeleteMessage(messageId)}
                  title="Delete"
                  className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors p-0.5"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bubble */}
      <div className="relative group max-w-[90%]">
        <div
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
          {/* Message content — Markdown for assistant, plain for user */}
          {isAssistant ? (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {content}
              </ReactMarkdown>
              
              {/* Conditional Open Canvas Button */}
              {hasCanvas && (
                <button
                  onClick={() => onOpenCanvas(messageId)}
                  className="mt-4 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] group font-normal tracking-widest text-[10px] uppercase"
                >
                  <Layers size={13} className="text-[var(--bg-primary)] group-hover:scale-110 transition-transform" />
                  Deep Visual Dive
                </button>
              )}
            </>
          ) : (
            <p style={{ color: 'inherit' }} className="whitespace-pre-wrap leading-relaxed">{content}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Message;

