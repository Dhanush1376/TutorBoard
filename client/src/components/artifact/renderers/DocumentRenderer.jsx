import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentRenderer = ({ content, onContentChange, isDark }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [content]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)]/50 rounded-md p-0.5">
          <button
            onClick={() => setIsEditing(false)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              !isEditing
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              isEditing
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Edit
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 text-[10px] rounded border border-[var(--border-color)]/30 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {isCopied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isEditing ? (
          <textarea
            value={content || ''}
            onChange={(e) => onContentChange?.(e.target.value)}
            className="w-full h-full p-4 bg-transparent text-[var(--text-primary)] font-mono text-[13px] leading-relaxed resize-none outline-none"
            spellCheck={false}
            placeholder="Write markdown content..."
          />
        ) : (
          <div className="p-4 prose prose-sm max-w-none text-[var(--text-primary)]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({children}) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0 text-[var(--text-primary)] border-b border-[var(--border-color)]/30 pb-2">{children}</h1>,
                h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3 text-[var(--text-primary)]">{children}</h2>,
                h3: ({children}) => <h3 className="text-[15px] font-medium mb-1.5 mt-2.5 text-[var(--text-primary)]">{children}</h3>,
                p: ({children}) => <p className="mb-2 leading-[1.7] text-[13px] text-[var(--text-primary)]/90">{children}</p>,
                ul: ({children}) => <ul className="my-2 pl-4 space-y-1 list-disc marker:text-[var(--text-tertiary)]/60 text-[13px]">{children}</ul>,
                ol: ({children}) => <ol className="my-2 pl-4 space-y-1 list-decimal marker:text-[var(--text-tertiary)]/60 text-[13px]">{children}</ol>,
                li: ({children}) => <li className="leading-[1.65]">{children}</li>,
                strong: ({children}) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                code: ({children, inline}) => inline 
                  ? <code className="px-1 py-[1px] rounded text-[11.5px] font-mono bg-[var(--text-primary)]/[0.06] border border-[var(--border-color)]/20">{children}</code>
                  : <pre className="my-3 p-3.5 rounded-lg text-[11.5px] font-mono bg-[var(--text-primary)]/[0.04] overflow-x-auto border border-[var(--border-color)]/15"><code>{children}</code></pre>,
                blockquote: ({children}) => <blockquote className="border-l-[3px] border-[var(--text-tertiary)]/25 pl-3.5 my-3 text-[13px] text-[var(--text-secondary)] italic">{children}</blockquote>,
                table: ({children}) => <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border-color)]/30"><table className="text-[12px] border-collapse w-full">{children}</table></div>,
                th: ({children}) => <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b border-[var(--border-color)]/30 bg-[var(--text-primary)]/[0.03]">{children}</th>,
                td: ({children}) => <td className="px-3 py-1.5 border-b border-[var(--border-color)]/15">{children}</td>,
              }}
            >
              {content || '*No content yet*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRenderer;
