import React, { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { executeCode } from '../../../utils/codeRunner';

const LANGUAGE_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  yaml: 'yaml',
  sh: 'shell',
  bash: 'shell',
};

const resolveLanguage = (lang) => {
  if (!lang) return 'javascript';
  const lower = lang.toLowerCase().trim();
  return LANGUAGE_MAP[lower] || lower;
};

const CodeRenderer = ({ content, language, onContentChange, isDark }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showOutput, setShowOutput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const output = logs.join('\n');

  const monacoLang = resolveLanguage(language);
  const lineCount = (content || '').split('\n').length;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [content]);

  const handleRun = useCallback(async () => {
    setLogs([]);
    setShowOutput(true);
    setIsRunning(true);

    try {
      const result = await executeCode(content, monacoLang, (log) => {
        setLogs(prev => [...prev, log.text]);
      });
      // Final result is already logged via callback
    } catch (err) {
      setLogs(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  }, [content, monacoLang]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {monacoLang}
          </span>
          <span className="text-[9px] text-[var(--text-tertiary)]">
            {lineCount} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          {['javascript', 'python', 'java', 'c', 'cpp'].includes(monacoLang) && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                isRunning 
                  ? 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)] cursor-not-allowed' 
                  : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-80 active:scale-95'
              }`}
            >
              {isRunning ? 'Running...' : '▶ Run'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 text-[10px] rounded border border-[var(--border-color)]/30 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {isCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={monacoLang}
          value={content || ''}
          onChange={(val) => onContentChange?.(val || '')}
          theme={isDark ? 'vs-dark' : 'vs-light'}
          options={{
            fontSize: 13,
            fontFamily: '"Fira Code", monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            padding: { top: 12, bottom: 12 },
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          }}
        />
      </div>

      {/* Output Panel */}
      {showOutput && (
        <div className="border-t border-[var(--border-color)]/30 bg-[#1e1e1e] text-[#d4d4d4]">
          <div className="flex items-center justify-between px-3 py-1 border-b border-[#333]">
            <span className="text-[10px] uppercase tracking-wider font-medium">Output</span>
            <button
              onClick={() => setShowOutput(false)}
              className="text-[10px] opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono max-h-32 overflow-auto whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CodeRenderer;
