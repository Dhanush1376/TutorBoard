import React, { useState } from 'react';
import { User, Copy, Edit2, Trash2, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Markdown component styles
const MarkdownComponents = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic opacity-80">{children}</em>
  ),
  h1: ({ children }) => (
    <h1 className="text-[15px] font-bold mb-2 mt-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-bold mb-1.5 mt-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mb-1 mt-1">{children}</h3>
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

const Message = ({
  role, content, steps, stepTitle, domain, visualizationType,
  onOpenCanvas, onDeleteMessage, onEditMessage, messageId,
  elements, motion: motionData, connections, sequence, objects, hasCanvas
}) => {
  const isAssistant = role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full px-3 py-1.5 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar + label row */}
      <div className={`flex items-center gap-1.5 mb-1.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
        {isAssistant ? (
          <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] flex items-center justify-center flex-shrink-0">
            <Sparkles size={10} className="text-[var(--bg-primary)]" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-[var(--text-secondary)]/20 border border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
            <User size={10} className="text-[var(--text-secondary)]" />
          </div>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
          {isAssistant ? 'TutorBoard' : 'You'}
        </span>
        <span className="text-[9px] text-[var(--text-tertiary)]/50 font-medium">{timestamp}</span>

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
          className={`relative px-3.5 py-2.5 text-[13px] leading-relaxed transition-all duration-200 ${
            isAssistant
              ? 'rounded-2xl rounded-tl-md shadow-sm'
              : 'rounded-2xl rounded-tr-md shadow-md'
          }`}
          style={{
            backgroundColor: isAssistant ? 'var(--ai-bubble-bg)' : 'var(--user-bubble-bg)',
            color: isAssistant ? 'var(--ai-bubble-text)' : 'var(--user-bubble-text)',
            border: '1px solid var(--border-color)',
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
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-all shadow-sm active:scale-95 group font-semibold tracking-wide text-[11px] uppercase"
                >
                  <Sparkles size={12} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
                  Open Canvas
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
