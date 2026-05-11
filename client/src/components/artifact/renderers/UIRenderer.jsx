import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { RefreshCw } from 'lucide-react';
import DOMPurify from 'dompurify';

const UIRenderer = ({ content, onContentChange, isDark }) => {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code' | 'split'
  const [autoRefresh, setAutoRefresh] = useState(true);
  const iframeRef = useRef(null);
  const [previewContent, setPreviewContent] = useState(content);

  // Debounce preview updates (only when auto-refresh is on)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setTimeout(() => {
      setPreviewContent(content);
    }, 300);
    return () => clearTimeout(timer);
  }, [content, autoRefresh]);

  // Sync preview immediately when content changes while auto-refresh is off then turned on
  useEffect(() => {
    if (autoRefresh) {
      setPreviewContent(content);
    }
  }, [autoRefresh]);

  const handleManualRefresh = useCallback(() => {
    setPreviewContent(content);
  }, [content]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [content]);

  const renderPreview = () => {
    // SEC-24: Sandbox Hardening
    // 1. Sanitize AI-generated HTML
    const sanitizedHtml = DOMPurify.sanitize(previewContent, {
      ADD_TAGS: ['script', 'style'],
      ADD_ATTR: ['onclick', 'onerror'], 
      WHOLE_DOCUMENT: true,
    });

    // 2. Wrap with strict CSP
    const wrappedContent = `
      <meta http-equiv="Content-Security-Policy" 
        content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;">
      ${sanitizedHtml}
    `;

    return (
      <iframe
        ref={iframeRef}
        srcDoc={wrappedContent}
        className="w-full h-full border-0 bg-white rounded-b-lg"
        sandbox="allow-scripts allow-forms allow-modals"
        // SEC-GDPR: We explicitly OMIT 'allow-same-origin' to prevent
        // the sandboxed code from accessing the parent window's context.
        title="UI Preview"
      />
    );
  };

  const renderEditor = () => (
    <Editor
      height="100%"
      language="html"
      value={content || ''}
      onChange={(val) => onContentChange?.(val || '')}
      theme={isDark ? 'vs-dark' : 'vs-light'}
      options={{
        fontSize: 13,
        fontFamily: '"Fira Code", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 12 },
        scrollbar: { verticalScrollbarSize: 6 },
      }}
    />
  );

  return (
    <div className="h-full flex flex-col">
      {/* Mode Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)]/50 rounded-md p-0.5">
            {['preview', 'code', 'split'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all capitalize ${
                  viewMode === mode
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-color)]/30 text-[var(--text-tertiary)]'
            }`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw size={9} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>

          {/* Manual Refresh (only when auto-refresh is off) */}
          {!autoRefresh && (
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-80 transition-all"
            >
              <RefreshCw size={9} /> Refresh
            </button>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="px-2 py-0.5 text-[10px] rounded border border-[var(--border-color)]/30 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Copy
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex">
        {viewMode === 'preview' && (
          <div className="w-full h-full">{renderPreview()}</div>
        )}
        {viewMode === 'code' && (
          <div className="w-full h-full">{renderEditor()}</div>
        )}
        {viewMode === 'split' && (
          <>
            <div className="w-1/2 h-full border-r border-[var(--border-color)]/20">
              {renderEditor()}
            </div>
            <div className="w-1/2 h-full">{renderPreview()}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default UIRenderer;

