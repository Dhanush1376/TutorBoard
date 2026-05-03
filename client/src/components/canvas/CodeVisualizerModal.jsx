import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Square, ChevronRight, ChevronDown, Globe, Circle, Minus, AlertCircle, CheckCircle2, Copy, Trash2, Layout } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';
import VisaiLogo from '../layout/VisaiLogo';
import { executeCode } from '../../utils/codeRunner';

// ─── Token Highlighter ───────────────────────────────────────────────────────
const LANGUAGES = {
  javascript: {
    name: 'JavaScript',
    keywords: /\b(const|let|var|function|return|if|else|for|while|do|class|import|export|default|new|this|typeof|instanceof|try|catch|finally|throw|async|await|of|in|true|false|null|undefined|void)\b/g,
    boiler: 'console.log("Hello, World!");',
    comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g
  },
  python: {
    name: 'Python',
    keywords: /\b(def|class|if|else|elif|for|while|return|import|from|as|with|try|except|finally|raise|print|in|is|and|or|not|None|True|False|lambda|pass|break|continue)\b/g,
    boiler: 'print("Hello, World!")',
    comment: /#.*/g
  },
  java: {
    name: 'Java',
    keywords: /\b(public|private|protected|static|final|class|interface|abstract|void|int|long|float|double|boolean|String|if|else|for|while|return|import|package|new|this|try|catch|throw)\b/g,
    boiler: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g
  },
  cpp: {
    name: 'C++',
    keywords: /\b(int|float|double|char|void|long|short|unsigned|signed|const|static|volatile|struct|class|enum|union|namespace|public|private|protected|virtual|override|final|new|delete|this|try|catch|throw|if|else|for|while|do|return|using|include)\b/g,
    boiler: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g
  },
  c: {
    name: 'C',
    keywords: /\b(int|float|double|char|void|long|short|unsigned|signed|const|static|volatile|struct|enum|union|if|else|for|while|do|return|include|define|typedef|size_t)\b/g,
    boiler: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
    comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g
  },
};

const STRINGS = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const NUMBERS = /\b(\d+\.?\d*)\b/g;
const FUNCTIONS = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

function tokenize(line, lang = 'javascript') {
  const config = LANGUAGES[lang] || LANGUAGES.javascript;
  const tokens = [];
  const ranges = [];

  const addRanges = (regex, type) => {
    let m;
    const r = new RegExp(regex.source, regex.flags);
    while ((m = r.exec(line)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, type, text: m[0] });
    }
  };

  addRanges(config.comment, 'comment');
  addRanges(STRINGS, 'string');
  addRanges(config.keywords, 'keyword');
  addRanges(NUMBERS, 'number');
  addRanges(FUNCTIONS, 'function');

  ranges.sort((a, b) => a.start - b.start);

  // Deduplicate overlapping
  const clean = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start >= cursor) {
      clean.push(r);
      cursor = r.end;
    }
  }

  // Build segments
  let pos = 0;
  for (const r of clean) {
    if (r.start > pos) tokens.push({ type: 'plain', text: line.slice(pos, r.start) });
    tokens.push({ type: r.type, text: r.text });
    pos = r.end;
  }
  if (pos < line.length) tokens.push({ type: 'plain', text: line.slice(pos) });
  return tokens;
}

const GET_TOKEN_COLORS = (mode) => ({
  keyword: mode === 'dark' ? '#c792ea' : '#7c3aed',
  string: mode === 'dark' ? '#c3e88d' : '#059669',
  comment: mode === 'dark' ? '#546e7a' : '#94a3b8',
  number: mode === 'dark' ? '#f78c6c' : '#d97706',
  function: mode === 'dark' ? '#82aaff' : '#2563eb',
  plain: 'var(--text-primary)',
});

function SyntaxLine({ line, lang }) {
  const { mode } = useTheme();
  const tokens = tokenize(line, lang);
  const colors = GET_TOKEN_COLORS(mode);
  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: colors[t.type] || colors.plain }}>
          {t.text}
        </span>
      ))}
    </span>
  );
}

// ─── Console Output ───────────────────────────────────────────────────────────
function ConsolePanel({ logs, isRunning, onClear }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={ref}
        style={{
          background: 'var(--bg-primary)',
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: '12px',
          lineHeight: '1.7',
        }}
      >
        {logs.length === 0 && !isRunning && (
          <div style={{ color: 'var(--text-tertiary)', paddingTop: 4 }}>— output will appear here —</div>
        )}
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#86efac' : log.type === 'info' ? '#93c5fd' : log.type === 'warn' ? '#fde047' : '#a1a1aa',
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              marginBottom: 4,
              fontSize: '11.5px',
            }}
          >
            <span style={{ 
              color: 'var(--text-tertiary)', 
              flexShrink: 0, 
              userSelect: 'none', 
              fontSize: 9, 
              width: 20, 
              textAlign: 'right',
              fontFamily: 'var(--font-mono)'
            }}>{i + 1}</span>
            <span style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.01em',
            }}>{log.text}</span>
          </motion.div>
        ))}
        {isRunning && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
          >
            <span>▶</span>
            <span>executing…</span>
          </motion.div>
        )}
      </div>
      {logs.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-secondary)' }}>
          <button
            onClick={onClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 10, fontWeight: 400, cursor: 'pointer', transition: 'all 0.2s',
              padding: '4px 8px', borderRadius: 4
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Trash2 size={12} />
            CLEAR CONSOLE
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Line Numbers + Editor ────────────────────────────────────────────────────
function CodeEditor({ code, onChange, executingLine, lang }) {
  const lines = code.split('\n');
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const syncScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (overlayRef.current) {
        overlayRef.current.scrollTop = scrollTop;
        overlayRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Line numbers gutter */}
      <div
        ref={lineNumbersRef}
        style={{
          width: 44,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          padding: '14px 0',
          overflowY: 'hidden',
          userSelect: 'none',
        }}
      >
        {lines.map((_, i) => (
          <div
            key={i}
            style={{
              height: '21px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: executingLine === i ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              background: executingLine === i ? 'rgba(99,165,250,0.06)' : 'transparent',
              borderLeft: executingLine === i ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code area: overlay + textarea stacked absolutely */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

        {/* Syntax highlight overlay (pointer-events:none, purely visual) */}
        <div
          ref={overlayRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            padding: '14px 16px',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
            fontSize: '13px',
            lineHeight: '21px',
            whiteSpace: 'pre',
            overflowX: 'hidden',
            overflowY: 'hidden',
            pointerEvents: 'none',
            zIndex: 1,
            fontVariantLigatures: 'none',
            letterSpacing: 'normal',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                height: '21px',
                background: executingLine === i ? 'rgba(99,165,250,0.06)' : 'transparent',
                borderLeft: executingLine === i ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingLeft: executingLine === i ? 6 : 0,
                marginLeft: executingLine === i ? -16 : 0,
                paddingRight: 16,
                transition: 'all 0.2s',
              }}
            >
              <SyntaxLine line={line} lang={lang} />
            </div>
          ))}
        </div>

        {/* Actual editable textarea (transparent text, visible caret) */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          style={{
            position: 'absolute',
            inset: 0,
            padding: '14px 16px',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
            fontSize: '13px',
            lineHeight: '21px',
            background: 'transparent',
            color: 'transparent',
            caretColor: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            resize: 'none',
            zIndex: 2,
            whiteSpace: 'pre',
            overflowX: 'auto',
            overflowY: 'auto',
            tabSize: 2,
            fontVariantLigatures: 'none',
            letterSpacing: 'normal',
            WebkitFontSmoothing: 'antialiased',
          }}
        />
      </div>
    </div>
  );
}

// Execution engine moved to utils/codeRunner.js

// ─── Main Modal ───────────────────────────────────────────────────────────────
const DEFAULT_CODE = `console.log("Hello, World!");`;

const CodeVisualizerModal = () => {
  const { 
    activeOverlay, setOverlay, addCanvasObjects, addCanvasConnections, layoutView,
    isVisualizerMinimized, setVisualizerMinimized
  } = useTutorStore();

  const isVisualizerOpen = activeOverlay === 'code-editor';
  const setVisualizerOpen = (val) => setOverlay(val ? 'code-editor' : null);
  const { mode } = useTheme();
  const [lang, setLang] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const langMenuRef = useRef(null);

  const handleLangChange = (newLang) => {
    setLang(newLang);
    setCode(LANGUAGES[newLang].boiler);
    setShowLangMenu(false);
  };
  // Handle outside click for language menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    if (showLangMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executingLine, setExecutingLine] = useState(null);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'output'
  const [runStatus, setRunStatus] = useState(null); // null | 'success' | 'error'
  const abortRef = useRef(false);

  const handleRun = useCallback(async () => {
    if (isRunning) {
      abortRef.current = true;
      setIsRunning(false);
      setExecutingLine(null);
      return;
    }
    abortRef.current = false;
    setLogs([]);
    setRunStatus(null);
    setIsRunning(true);
    setActiveTab('output');

    try {
      const result = await executeCode(
        code,
        lang,
        (log) => { if (!abortRef.current) setLogs(prev => [...prev, log]); }
      );
      if (!abortRef.current) setRunStatus(result.success ? 'success' : 'error');
    } catch (e) {
      setLogs(prev => [...prev, { type: 'error', text: String(e) }]);
      setRunStatus('error');
    } finally {
      if (!abortRef.current) setIsRunning(false);
      setExecutingLine(null);
    }
  }, [code, isRunning]);

  const handleVisualize = useCallback(() => {
    const lines = code.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('//'));

    if (lines.length === 0) return;

    const objects = [];
    const timestamp = Date.now();
    // Offset startX if docked to center nodes in the visible canvas area
    const startX = isDocked ? (layoutView === 'left' ? 0.65 : 0.35) : 0.5;
    let startY = 0.15;
    const verticalGap = 0.13;

    lines.forEach((line, index) => {
      const id = `manual-flow-${timestamp}-${index}`;
      objects.push({
        id, type: 'flowstep', x: startX, y: startY, label: line,
        color: 'var(--accent-primary)',
        styles: { fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }
      });
      startY += verticalGap;
    });

    addCanvasObjects(objects);

    const newConns = lines.slice(0, -1).map((_, i) => ({
      from: objects[i].id, to: objects[i + 1].id,
      type: 'arrow', color: 'var(--text-tertiary)'
    }));
    if (newConns.length > 0) addCanvasConnections(newConns);


    setIsDocked(true);
  }, [code, addCanvasObjects, layoutView]);

  const lineCount = code.split('\n').length;
  const charCount = code.length;

  return createPortal(
    <AnimatePresence>
      {(isVisualizerOpen || isVisualizerMinimized) && (
        <div
          className={`fixed inset-0 z-[99999] pointer-events-none ${(!isVisualizerMinimized && !isDocked && !isMaximized) ? 'flex items-center justify-center' : ''}`}
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisualizerMinimized || isDocked ? 0 : 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVisualizerOpen(false)}
            className={`fixed inset-0 bg-black/60 ${isVisualizerMinimized || isDocked ? 'pointer-events-none' : 'backdrop-blur-xl pointer-events-auto'}`}
            style={{ zIndex: -1 }}
          />

          {/* Modal */}
          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={
              isVisualizerMinimized ? {
                position: 'fixed',
                top: 'auto',
                bottom: '80px',
                left: layoutView === 'right' ? '24px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '24px',
                width: '190px',
                height: '40px',
                borderRadius: '20px',
                x: 0, y: 0, scale: 1, opacity: 1,
              } : isMaximized ? {
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                width: '100vw',
                height: '100vh',
                borderRadius: 0,
                x: 0, y: 0, scale: 1, opacity: 1,
              } : isDocked ? {
                position: 'fixed',
                top: '88px',
                bottom: '88px',
                left: layoutView === 'right' ? '16px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '16px',
                width: 'min(450px, 45vw)',
                height: 'calc(100vh - 176px)',
                borderRadius: '24px',
                x: 0, y: 0, scale: 1, opacity: 1,
              } : {
                position: 'relative',
                width: 'min(860px, 95vw)',
                height: 'min(600px, 88vh)',
                borderRadius: '16px',
                x: 0, y: 0, scale: 1, opacity: 1,
              }
            }
            exit={{ scale: 0.9, opacity: 0 }}
            className="pointer-events-auto"
            style={{
              background: isVisualizerMinimized ? (mode === 'dark' ? 'rgba(30, 30, 33, 0.8)' : 'rgba(255, 255, 255, 0.8)') : 'var(--bg-primary)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              cursor: isVisualizerMinimized ? 'pointer' : 'default',
              border: '1px solid var(--border-color)',
              boxShadow: isVisualizerMinimized ? '0 8px 32px rgba(0,0,0,0.2)' : '0 40px 100px rgba(0,0,0,0.4)',
              zIndex: 100000,
              color: 'var(--text-primary)',
            }}
            whileHover={isVisualizerMinimized ? { y: -4, scale: 1.02, background: mode === 'dark' ? 'rgba(45, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)' } : {}}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={() => { if (isVisualizerMinimized) setVisualizerMinimized(false); }}
          >
            {isVisualizerMinimized ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '0 16px',
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.01em'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VisaiLogo size="xxs" style={{ color: '#febc2e' }} />
                  <div style={{
                    position: 'absolute',
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: '#febc2e',
                    opacity: 0.3,
                    filter: 'blur(4px)',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>Code Visualizer</span>
                <style>{`@keyframes pulse { 0% { opacity: 0.2; scale: 0.9; } 50% { opacity: 0.5; scale: 1.2; } 100% { opacity: 0.2; scale: 0.9; } }`}</style>
              </div>
            ) : (
              <>
                {/* ── Title Bar ── */}
                <div
                  style={{
                    height: 44,
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 16,
                    paddingRight: 16,
                    gap: 0,
                    flexShrink: 0,
                  }}
                >
                  {/* Left: Traffic Lights + Title + Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      onMouseEnter={() => setIsTrafficHovered(true)}
                      onMouseLeave={() => setIsTrafficHovered(false)}
                      style={{ display: 'flex', gap: 6, flexShrink: 0 }}
                    >
                      {[
                        { color: '#ff5f57', action: () => setVisualizerOpen(false), icon: <X size={7} /> },
                        { color: '#febc2e', action: (e) => { e.stopPropagation(); setVisualizerMinimized(true); }, icon: <Minus size={8} /> },
                        { color: '#28c840', action: (e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }, icon: isMaximized ? <Minus size={8} style={{ transform: 'rotate(90deg)' }} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} /> },
                      ].map((btn, i) => (
                        <button
                          key={i}
                          onClick={btn.action}
                          style={{
                            width: 12, height: 12,
                            borderRadius: '50%',
                            background: btn.color,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(0,0,0,0.5)',
                            padding: 0,
                            transition: 'all 0.15s',
                            boxShadow: `0 0 0 0.5px rgba(0,0,0,0.2)`,
                          }}
                        >
                          {isTrafficHovered && btn.icon}
                        </button>
                      ))}
                    </div>

                    <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3, flexShrink: 0 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                      <VisaiLogo size="xxs" className={isRunning ? "animate-pulse" : ""} />
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.04em',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {isDocked ? 'visualizer.js' : 'visualizer.js — TutorBoard'}
                      </span>
                      
                      {runStatus === 'success' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86efac', fontSize: 10, fontWeight: 400, opacity: 0.9 }}>
                          <CheckCircle2 size={10} />
                          {!isDocked && <span>passed</span>}
                        </div>
                      )}
                      {runStatus === 'error' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f87171', fontSize: 10, fontWeight: 400, opacity: 0.9 }}>
                          <AlertCircle size={10} />
                          {!isDocked && <span>error</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Mode Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => { setIsDocked(!isDocked); setIsMaximized(false); }}
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: isDocked ? 'rgba(96,165,250,0.1)' : 'transparent',
                        border: 'none',
                        color: isDocked ? '#60a5fa' : 'var(--text-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      title={isDocked ? "Floating View" : "Side-by-side View"}
                    >
                      <Layout size={15} />
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(code); }}
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Copy Code"
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>

                {/* ── Tab Bar ── */}
                <div
                  style={{
                    height: 38,
                    background: 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  {[
                    { id: 'editor', label: 'index.js' },
                    { id: 'output', label: 'console' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '0 16px',
                        background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                        border: 'none',
                        borderTop: activeTab === tab.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                        borderLeft: '1px solid ' + (activeTab === tab.id ? 'var(--border-color)' : 'transparent'),
                        borderRight: '1px solid ' + (activeTab === tab.id ? 'var(--border-color)' : 'transparent'),
                        color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontSize: 12,
                        cursor: 'pointer',
                        letterSpacing: '0.03em',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: -1,
                      }}
                    >
                      {tab.id === 'output' && isRunning && logs.length > 0 && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1 }}
                          style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}
                        />
                      )}
                      {tab.label}
                    </button>
                  ))}

                  {/* Spacer + Language Selector */}
                  <div style={{ flex: 1 }} />

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={langMenuRef}>
                    <button
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      style={{
                        height: 24,
                        padding: '0 10px',
                        borderRadius: 6,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: 10,
                        fontWeight: 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <Globe size={11} className="opacity-70" />
                      {LANGUAGES[lang].name.toUpperCase()}
                      <ChevronDown size={10} />
                    </button>

                    <AnimatePresence>
                      {showLangMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            width: 160,
                            background: 'var(--bg-primary)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                            padding: '6px',
                            zIndex: 1000,
                          }}
                        >
                          {Object.keys(LANGUAGES).map(lId => (
                            <button
                              key={lId}
                              onClick={() => handleLangChange(lId)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: '8px',
                                background: lang === lId ? 'rgba(96,165,250,0.1)' : 'transparent',
                                border: 'none', color: lang === lId ? '#60a5fa' : 'var(--text-secondary)',
                                fontSize: 11, fontWeight: lang === lId ? 700 : 500,
                                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                              }}
                            >
                              {LANGUAGES[lId].name}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {!isDocked && (
                    <>
                      <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3, margin: '0 8px' }} />
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, paddingRight: 8,
                        fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400
                      }}>
                        <span>Ln {lineCount}</span>
                        <span>Ch {charCount}</span>
                        {!isVisualizerMinimized && <span>UTF-8</span>}
                      </div>
                    </>
                  )}
                </div>

                {/* ── Main Area ── */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
                  {/* Editor Panel */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    opacity: activeTab === 'editor' ? 1 : 0,
                    pointerEvents: activeTab === 'editor' ? 'auto' : 'none',
                    transition: 'opacity 0.15s',
                  }}>
                    <CodeEditor
                      code={code}
                      onChange={setCode}
                      executingLine={isRunning ? executingLine : null}
                      lang={lang}
                    />
                  </div>

                  {/* Output Panel */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    opacity: activeTab === 'output' ? 1 : 0,
                    pointerEvents: activeTab === 'output' ? 'auto' : 'none',
                    transition: 'opacity 0.15s',
                  }}>
                    <ConsolePanel logs={logs} isRunning={isRunning} onClear={() => setLogs([])} />
                  </div>
                </div>

                {/* ── Bottom Bar ── */}
                <div
                  style={{
                    height: 48,
                    background: 'var(--bg-secondary)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 16,
                    paddingRight: 16,
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  {/* Left: git-style branch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3f3f46', fontSize: 11 }}>
                    <ChevronRight size={12} />
                    <span>main</span>
                    <span style={{ color: '#1f1f1f' }}>·</span>
                    <span>JavaScript</span>
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Right: action buttons */}
                  <button
                    onClick={handleRun}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px',
                      borderRadius: 7,
                      background: isRunning ? 'rgba(248,113,113,0.1)' : 'rgba(96,165,250,0.1)',
                      border: '1px solid ' + (isRunning ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.2)'),
                      color: isRunning ? '#f87171' : '#60a5fa',
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = isRunning ? 'rgba(248,113,113,0.18)' : 'rgba(96,165,250,0.18)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isRunning ? 'rgba(248,113,113,0.1)' : 'rgba(96,165,250,0.1)';
                    }}
                  >
                    {isRunning ? (
                      <><Square size={12} fill="currentColor" /> Stop</>
                    ) : (
                      <><Play size={12} fill="currentColor" /> Run</>
                    )}
                  </button>

                  <button
                    onClick={handleVisualize}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px',
                      borderRadius: 7,
                      background: 'rgba(167,139,250,0.1)',
                      border: '1px solid rgba(167,139,250,0.2)',
                      color: '#a78bfa',
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      <line x1="10" y1="6.5" x2="14" y2="6.5" /><line x1="12" y1="10" x2="12" y2="14" />
                      <line x1="10" y1="17.5" x2="14" y2="17.5" />
                    </svg>
                    Send to Canvas
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CodeVisualizerModal;
