import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Square, ChevronRight, ChevronLeft, ChevronDown, Globe, Circle, Minus, AlertCircle, CheckCircle2, Copy, Trash2, Layout, Terminal } from 'lucide-react';
import Editor from '@monaco-editor/react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';
import VisaiLogo from '../layout/VisaiLogo';
import { executeCode } from '../../utils/codeRunner';

const LANGUAGES = {
  javascript: { name: 'JavaScript', boiler: 'import.meta.env.DEV && console.log("Hello, World!");' },
  python: { name: 'Python', boiler: 'print("Hello, World!")' },
  java: { name: 'Java', boiler: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}' },
  cpp: { name: 'C++', boiler: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}' },
  c: { name: 'C', boiler: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' },
  typescript: { name: 'TypeScript', boiler: 'const message: string = "Hello, World!";\nimport.meta.env.DEV && console.log(message);' },
  ruby: { name: 'Ruby', boiler: 'puts "Hello, World!"' },
  go: { name: 'Go', boiler: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}' },
  rust: { name: 'Rust', boiler: 'fn main() {\n    println!("Hello, World!");\n}' },
  sql: { name: 'SQL', boiler: 'SELECT * FROM users WHERE active = true;' },
  html: { name: 'HTML', boiler: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>' },
  css: { name: 'CSS', boiler: 'body {\n  background: #f0f0f0;\n  color: #333;\n  font-family: sans-serif;\n}' },
};

const CodeVisualizerModal = () => {
  const { 
    activeOverlay, setOverlay, addCanvasObjects, addCanvasConnections, layoutView,
    isVisualizerMinimized, setVisualizerMinimized,
    codeEditorCode, codeEditorLang, showToast
  } = useTutorStore();

  const isVisualizerOpen = activeOverlay === 'code-editor';
  const setVisualizerOpen = (val) => setOverlay(val ? 'code-editor' : null);
  const { mode } = useTheme();
  const [lang, setLang] = useState('javascript');
  const [code, setCode] = useState('import.meta.env.DEV && console.log("Hello, World!");');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [runStatus, setRunStatus] = useState(null);
  const langMenuRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (isVisualizerOpen && codeEditorCode) {
      setCode(codeEditorCode);
      setLang(codeEditorLang || 'javascript');
    }
  }, [isVisualizerOpen, codeEditorCode, codeEditorLang]);

  const handleLangChange = (newLang) => {
    setLang(newLang);
    setCode(LANGUAGES[newLang].boiler);
    setShowLangMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    if (showLangMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setLogs([]);
    setRunStatus(null);
    setIsRunning(true);
    setShowOutput(true);

    try {
      const result = await executeCode(code, lang, (log) => {
        setLogs(prev => [...prev, log]);
      });
      
      setRunStatus(result.success ? 'success' : 'error');
      setShowOutput(true);

      if (!result.success) {
        showToast({
          message: result.error || 'Code execution failed',
          type: 'error',
          duration: 4000
        });
      }
    } catch (e) {
      setLogs(prev => [...prev, { type: 'error', text: String(e) }]);
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  }, [code, lang, isRunning, showToast]);

  // Keyboard Shortcuts (Ctrl+Enter to run)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  const handleVisualize = useCallback(() => {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    if (lines.length === 0) return;
    const objects = [];
    const timestamp = Date.now();
    const startX = isDocked ? (layoutView === 'left' ? 0.65 : 0.35) : 0.5;
    let startY = 0.15;
    lines.forEach((line, index) => {
      const id = `manual-flow-${timestamp}-${index}`;
      objects.push({ id, type: 'flowstep', x: startX, y: startY, label: line, color: 'var(--accent-primary)', styles: { fontSize: 14, fontFamily: "'JetBrains Mono', monospace" } });
      startY += 0.13;
    });
    addCanvasObjects(objects);
    const newConns = lines.slice(0, -1).map((_, i) => ({ from: objects[i].id, to: objects[i + 1].id, type: 'arrow', color: 'var(--text-tertiary)' }));
    if (newConns.length > 0) addCanvasConnections(newConns);
    setIsDocked(true);
  }, [code, addCanvasObjects, layoutView, isDocked]);

  return createPortal(
    <AnimatePresence>
      {(isVisualizerOpen || isVisualizerMinimized) && (
        <div className="fixed inset-0 z-[99999] pointer-events-none">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: isVisualizerMinimized || isDocked ? 0 : 1 }} exit={{ opacity: 0 }} onClick={() => setVisualizerOpen(false)} className={`fixed inset-0 ${isVisualizerMinimized || isDocked ? 'pointer-events-none' : 'pointer-events-auto'}`} style={{ zIndex: -1 }} />
          {/* Minimized Tab */}
          <motion.div initial={{ x: '100%' }} animate={{ x: isVisualizerMinimized ? 0 : '100%' }} transition={{ type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.4 }} style={{ position: 'fixed', top: 'calc(50vh - 48px)', right: 0, width: '40px', height: '96px', zIndex: 100000 }} className="pointer-events-auto">
            <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', borderRadius: '16px 0 0 16px', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)' }} onClick={() => setVisualizerMinimized(false)}>
              <ChevronLeft size={20} color="var(--text-secondary)" />
            </div>
          </motion.div>

          <motion.div layout initial={{ x: '100%', y: 0, scale: 1, opacity: 1 }} animate={
            isMaximized ? { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, width: '100vw', height: '100vh', borderRadius: 0, scale: 1, opacity: 1, y: 0, x: isVisualizerMinimized ? '100%' : 0 } :
            isDocked ? { position: 'fixed', top: 'auto', bottom: '100px', left: layoutView === 'right' ? '24px' : 'auto', right: layoutView === 'right' ? 'auto' : '24px', width: 'min(500px, 45vw)', height: 'min(550px, 70vh)', borderRadius: '24px', scale: 1, opacity: 1, y: 0, x: isVisualizerMinimized ? (layoutView === 'right' ? '-100vw' : '100vw') : 0 } :
            { position: 'fixed', bottom: 0, right: 0, width: 'min(900px, 95vw)', height: 'min(650px, 88vh)', borderRadius: '16px 0 0 0', scale: 1, opacity: 1, y: 0, x: isVisualizerMinimized ? '100%' : 0 }
          } exit={{ x: '100%', y: 0, scale: 1, opacity: 1 }} transition={{ type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.4 }} className="pointer-events-auto" style={{ background: 'var(--bg-primary)', backdropFilter: 'blur(20px)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', borderBottom: 'none', borderRight: 'none', boxShadow: '0 16px 64px rgba(0,0,0,0.2)', zIndex: 100000 }}>
            
            <>
              <div style={{ height: 44, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>

                  <div onMouseEnter={() => setIsTrafficHovered(true)} onMouseLeave={() => setIsTrafficHovered(false)} style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setVisualizerOpen(false)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isTrafficHovered && <X size={7} />}</button>
                    <button onClick={(e) => { e.stopPropagation(); setVisualizerMinimized(true); }} style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isTrafficHovered && <Minus size={8} />}</button>
                    <button onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }} style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isTrafficHovered && (isMaximized ? <Minus size={8} style={{ transform: 'rotate(90deg)' }} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} />)}</button>
                  </div>
                  <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <VisaiLogo size="xxs" className={isRunning ? "animate-pulse" : ""} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>visualizer.js</span>
                    {runStatus === 'success' && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86efac', fontSize: 10 }}><CheckCircle2 size={10} /><span>passed</span></div>}
                    {runStatus === 'error' && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f87171', fontSize: 10 }}><AlertCircle size={10} /><span>error</span></div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative' }} ref={langMenuRef}>
                      <button onClick={() => setShowLangMenu(!showLangMenu)} style={{ height: 26, padding: '0 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <Globe size={11} className="opacity-70" />{LANGUAGES[lang].name.toUpperCase()}<ChevronDown size={10} />
                      </button>
                      <AnimatePresence>
                        {showLangMenu && (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 150, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', padding: '6px', zIndex: 1000 }}>
                            {Object.keys(LANGUAGES).map(lId => (
                              <button key={lId} onClick={() => handleLangChange(lId)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: lang === lId ? 'rgba(96,165,250,0.1)' : 'transparent', border: 'none', color: lang === lId ? '#60a5fa' : 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>{LANGUAGES[lId].name}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={() => { setIsDocked(!isDocked); setIsMaximized(false); }} style={{ padding: '6px', borderRadius: '8px', background: isDocked ? 'rgba(96,165,250,0.1)' : 'transparent', border: 'none', color: isDocked ? '#60a5fa' : 'var(--text-tertiary)', cursor: 'pointer' }}><Layout size={15} /></button>
                    <button onClick={() => navigator.clipboard.writeText(code)} style={{ padding: '6px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Copy size={15} /></button>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
                  <Editor
                    height="100%"
                    language={lang}
                    value={code}
                    theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
                    onChange={(val) => setCode(val || '')}
                    onMount={(editor) => { editorRef.current = editor; }}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      minimap: { enabled: false },
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                      automaticLayout: true,
                      tabSize: 2,
                    }}
                  />

                  {/* Slide-up Output Panel */}
                  <AnimatePresence>
                    {showOutput && (
                      <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          height: '40%',
                          background: 'var(--bg-secondary)',
                          borderTop: '1px solid var(--border-color)',
                          zIndex: 10,
                          display: 'flex', flexDirection: 'column'
                        }}
                      >
                        <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                            <Terminal size={12} /> CONSOLE
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 10, cursor: 'pointer' }}>Clear</button>
                            <button onClick={() => setShowOutput(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
                          {logs.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>No output to display.</div>}
                          {logs.map((log, i) => (
                            <div key={i} style={{ marginBottom: 4, color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#86efac' : (log.type === 'info' ? 'var(--text-tertiary)' : 'var(--text-primary)'), whiteSpace: 'pre-wrap' }}>
                              <span style={{ color: 'var(--text-tertiary)', marginRight: 12, opacity: 0.5 }}>{i + 1}</span>
                              {log.text}
                            </div>
                          ))}
                          {runStatus && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', opacity: 0.5, fontSize: 10, color: runStatus === 'success' ? '#86efac' : '#f87171' }}>
                              [Process finished with exit code {runStatus === 'success' ? '0' : '1'}]
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div style={{ height: 60, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 11 }}>
                    <Terminal size={12} className="opacity-50" />
                    <span style={{ letterSpacing: '0.02em' }}>Compiler Ready</span>
                    <span style={{ opacity: 0.2 }}>|</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{lang.toUpperCase()}</span>
                  </div>
                  
                  <motion.button 
                    whileHover={{ backgroundColor: 'var(--text-primary)', opacity: 0.9 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRun} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 7, 
                      padding: '8px 16px', borderRadius: '8px', 
                      background: isRunning ? '#ef4444' : 'var(--text-primary)',
                      color: 'var(--bg-primary)', 
                      fontSize: '11px', fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      letterSpacing: '0.03em'
                    }}
                  >
                    {isRunning ? <><Square size={12} fill="currentColor" /> STOP</> : <><Play size={12} fill="currentColor" /> RUN</>}
                  </motion.button>

                  <motion.button 
                    whileHover={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--text-tertiary)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleVisualize} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 7, 
                      padding: '8px 16px', borderRadius: '8px', 
                      background: 'transparent',
                      color: 'var(--text-secondary)', 
                      fontSize: '11px', fontWeight: 500,
                      border: '1px solid var(--border-color)', 
                      cursor: 'pointer',
                      letterSpacing: '0.03em'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="10" y1="6.5" x2="14" y2="6.5" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="10" y1="17.5" x2="14" y2="17.5" /></svg>
                    VISUALIZE
                  </motion.button>
                </div>
              </>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CodeVisualizerModal;
