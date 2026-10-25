import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, PanelRight, PanelLeft, Square, Copy, Check, ChevronDown, Terminal, Footprints, Loader2, Code2, Trash2, PencilLine, Keyboard,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/useTheme';
import useWindowSize from '../../hooks/useWindowSize';
import WindowControls from '../common/WindowControls';
import { executeCode } from '../../utils/codeRunner';
import { traceCode, findWalkthrough, saveWalkthrough, rememberStep } from '../../visualizer/runTrace';
import { nextStepOnLine } from '../../visualizer/analysis';
import useWalkthroughSuggestions from '../../visualizer/useWalkthroughSuggestions';
import TracePlayer from '../../visualizer/ui/TracePlayer';
import '../../visualizer/ui/visualizer.css';

const EASE = [0.22, 1, 0.36, 1];

// The five languages that really run (see utils/codeRunner.js).
const LANGUAGES = {
  javascript: { name: 'JavaScript', ext: 'js', boiler: 'console.log("Hello, World!");' },
  python: { name: 'Python', ext: 'py', boiler: 'print("Hello, World!")' },
  java: { name: 'Java', ext: 'java', boiler: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}' },
  cpp: { name: 'C++', ext: 'cpp', boiler: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}' },
  c: { name: 'C', ext: 'c', boiler: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' },
};

/* Editor themes in the app's ink-and-amber palette. */
function defineThemes(monaco) {
  const css = getComputedStyle(document.documentElement);
  const read = (v, fb) => (css.getPropertyValue(v).trim() || fb).slice(0, 7);
  monaco.editor.defineTheme('tb-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6f6a60', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f5a524' },
      { token: 'string', foreground: 'a6d6a0' },
      { token: 'number', foreground: 'e9b872' },
      { token: 'type', foreground: '9cc3f0' },
    ],
    colors: {
      'editor.background': read('--bg-primary', '#0a0908'),
      'editor.foreground': '#ece8dd',
      'editorLineNumber.foreground': '#4a4740',
      'editorLineNumber.activeForeground': '#bdb6a6',
      'editor.lineHighlightBackground': '#ffffff08',
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': '#f5a524',
      'editor.selectionBackground': '#f5a52433',
      'editor.inactiveSelectionBackground': '#f5a5241a',
      'editorIndentGuide.background1': '#ffffff0d',
      'editorWidget.background': '#141311',
      'scrollbarSlider.background': '#ffffff14',
      'scrollbarSlider.hoverBackground': '#ffffff22',
    },
  });
  monaco.editor.defineTheme('tb-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9a958a', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'b4630a' },
      { token: 'string', foreground: '2f7a3b' },
      { token: 'number', foreground: 'a35c12' },
      { token: 'type', foreground: '2a5d9c' },
    ],
    colors: {
      'editor.background': read('--bg-primary', '#fdfcf9'),
      'editor.foreground': '#1a1814',
      'editorLineNumber.foreground': '#c2bdb1',
      'editorLineNumber.activeForeground': '#5c574d',
      'editor.lineHighlightBackground': '#0000000a',
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': '#e08a0b',
      'editor.selectionBackground': '#e08a0b2e',
      'editor.inactiveSelectionBackground': '#e08a0b18',
      'editorIndentGuide.background1': '#0000000d',
      'scrollbarSlider.background': '#00000014',
      'scrollbarSlider.hoverBackground': '#00000022',
    },
  });
}

function IconBtn({ label, onClick, active, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${
        active ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

const CodeVisualizerModal = () => {
  const {
    activeOverlay, setOverlay, layoutView,
    isVisualizerMinimized, setVisualizerMinimized, codeEditorCode, codeEditorLang, codeEditorContext, showToast, isSidebarOpen,
  } = useTutorStore();
  const { mode } = useTheme();
  const { isMobile } = useWindowSize();
  // This modal is always mounted, so it watches finished answers for code worth stepping through.
  useWalkthroughSuggestions();

  const isOpen = activeOverlay === 'code-editor';
  const close = () => {
    setVisualizerMinimized(false);
    setOverlay(null);
  };

  const [lang, setLang] = useState('javascript');
  const [code, setCode] = useState(LANGUAGES.javascript.boiler);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dockSide, setDockSide] = useState(null); // null = centred, or 'left' / 'right'
  const isDocked = !!dockSide;
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [runStatus, setRunStatus] = useState(null); // null | success | error
  const [copied, setCopied] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const langMenuRef = useRef(null);
  // Step-through walkthrough: { trace, id, followUps } while it's open.
  const [walk, setWalk] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [traceStatus, setTraceStatus] = useState('');
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const editorRef = useRef(null);
  const decoRef = useRef(null);
  const contextRef = useRef(null);
  // Bumped each time an editor mounts: a fast trace (JavaScript) can be ready before the
  // editor has loaded, and its line marks have to be drawn once the editor is there.
  const [editorEpoch, setEditorEpoch] = useState(0);
  // The editor's click handler is registered once; it reads the walkthrough through these.
  const walkRef = useRef(null);
  const stepRef = useRef(0);
  walkRef.current = walk;
  stepRef.current = stepIndex;

  useEffect(() => {
    if (isOpen && codeEditorCode) {
      setCode(codeEditorCode);
      setLang(LANGUAGES[codeEditorLang] ? codeEditorLang : 'javascript');
      setWalk(null);
    }
  }, [isOpen, codeEditorCode, codeEditorLang]);

  useEffect(() => {
    if (!showLangMenu) return undefined;
    const outside = (e) => langMenuRef.current && !langMenuRef.current.contains(e.target) && setShowLangMenu(false);
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showLangMenu]);

  const startWalkthrough = useCallback(async (source, language) => {
    if (tracing) return;
    const ctx = contextRef.current;
    const where = { sessionId: ctx?.sessionId, messageId: ctx?.messageId, language, source, stdin };
    setTracing(true);
    setTraceStatus(language === 'python' ? 'Loading Python…' : ['java', 'cpp', 'c'].includes(language) ? 'Compiling and running…' : 'Running your code…');
    setShowOutput(false);
    try {
      const saved = await findWalkthrough(where);
      let trace = saved?.trace;
      let id = saved?.id || null;
      if (!trace) {
        trace = await traceCode(source, language, { stdin, onStatus: setTraceStatus });
        // A walkthrough worth keeping has steps; errors before the first step are just shown.
        if (trace.steps.length) id = await saveWalkthrough(where, trace, `${LANGUAGES[language].name} walkthrough`);
      }
      setWalk({ trace, id, followUps: saved?.followUps || [], where, nonce: Date.now() });
      // Reopening lands where the learner left off.
      setStepIndex(Math.max(0, Math.min(saved?.lastStep || 0, trace.steps.length - 1)));
      setShowInput(false);
    } catch (e) {
      showToast?.({ message: e?.message || 'The step-through could not start.', type: 'error', duration: 4000 });
    } finally {
      setTracing(false);
    }
  }, [tracing, stdin, showToast]);

  // Opened from a code block's "Step through": start straight away.
  useEffect(() => {
    if (!isOpen || !codeEditorContext) return;
    contextRef.current = codeEditorContext;
    if (codeEditorContext.autoVisualize && codeEditorCode) {
      const language = LANGUAGES[codeEditorLang] ? codeEditorLang : 'javascript';
      startWalkthrough(codeEditorCode, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, codeEditorContext?.nonce]);

  // Remember the step (debounced): reopening the walkthrough lands here.
  useEffect(() => {
    if (!walk || !walk.trace.steps.length) return undefined;
    const t = setTimeout(() => rememberStep(walk, stepIndex), 800);
    return () => clearTimeout(t);
  }, [walk, stepIndex]);

  // Lines that ran at least once (they can be clicked) and lines that never ran.
  const ranLines = React.useMemo(() => new Set(walk?.trace.steps.map((s) => s.line) || []), [walk]);

  // The line about to run, and the one that just ran, marked in the editor.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!decoRef.current) decoRef.current = editor.createDecorationsCollection([]);
    const step = walk?.trace.steps[stepIndex];
    if (!step) {
      decoRef.current.clear();
      return;
    }
    const prev = stepIndex > 0 ? walk.trace.steps[stepIndex - 1] : null;
    const marks = [];
    const model = editor.getModel();
    const lineCount = model?.getLineCount() || 0;
    for (let ln = 1; ln <= lineCount; ln++) {
      if (ln === step.line) continue;
      if (ranLines.has(ln)) marks.push({ range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: 1 }, options: { glyphMarginClassName: 'tb-trace-ran', className: 'tb-trace-ran-line', glyphMarginHoverMessage: { value: 'Ran — click to jump to it' } } });
      else if (model.getLineContent(ln).trim()) marks.push({ range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: model.getLineMaxColumn(ln) }, options: { inlineClassName: 'tb-trace-unrun' } });
    }
    if (prev && prev.line !== step.line) marks.push({ range: { startLineNumber: prev.line, startColumn: 1, endLineNumber: prev.line, endColumn: 1 }, options: { isWholeLine: true, className: 'tb-trace-prev' } });
    marks.push({
      range: { startLineNumber: step.line, startColumn: 1, endLineNumber: step.line, endColumn: 1 },
      options: { isWholeLine: true, className: step.event === 'exception' ? 'tb-trace-error' : 'tb-trace-line', glyphMarginClassName: 'tb-trace-glyph' },
    });
    decoRef.current.set(marks);
    editor.revealLineInCenterIfOutsideViewport(step.line);
  }, [walk, stepIndex, ranLines, editorEpoch]);

  const changeLang = (id) => {
    // Keep the learner's code if they've written something; only swap untouched starters.
    const untouched = Object.values(LANGUAGES).some((l) => l.boiler === code) || !code.trim();
    setLang(id);
    setWalk(null);
    if (untouched) setCode(LANGUAGES[id].boiler);
    setShowLangMenu(false);
  };

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setLogs([]);
    setRunStatus(null);
    setIsRunning(true);
    setShowOutput(true);
    try {
      const result = await executeCode(code, lang, (log) => setLogs((prev) => [...prev, log]));
      setRunStatus(result.success ? 'success' : 'error');
      if (!result.success) showToast({ message: result.error || 'Your code stopped with an error.', type: 'error', duration: 4000 });
    } catch (e) {
      setLogs((prev) => [...prev, { type: 'error', text: String(e) }]);
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  }, [code, lang, isRunning, showToast]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if (e.key === 'Escape' && !showLangMenu && !isMaximized) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handleRun, showLangMenu, isMaximized]);

  // Read the editor itself: the `code` state can be a render behind what's on screen.
  const handleVisualize = useCallback(() => startWalkthrough(editorRef.current?.getValue() ?? code, lang), [startWalkthrough, code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const L = LANGUAGES[lang];
  const full = isMaximized || isMobile;
  const walking = !!walk;
  const sideBySide = walking && !isDocked && !isMobile;
  // Docking on the chat panel's side sits beside the panel, never on top of it.
  const chatSide = layoutView === 'right' ? 'right' : 'left';
  const chatWidth = isSidebarOpen && !isMobile ? document.querySelector('aside.tb-sidebar')?.getBoundingClientRect().width || 0 : 0;
  const dockOffset = 16 + (dockSide === chatSide ? chatWidth : 0);

  // Every position key is set in every mode: framer-motion keeps a key alive once
  // it has been used, so a dropped `left` or `right` would linger.
  const frame = full
    ? { top: 0, bottom: 0, left: 0, right: 0, margin: 0, width: '100vw', height: '100dvh', borderRadius: 0 }
    : isDocked
      ? {
          top: 80,
          bottom: 16,
          left: dockSide === 'left' ? dockOffset : 'auto',
          right: dockSide === 'right' ? dockOffset : 'auto',
          margin: 0,
          width: 'min(460px, 40vw)',
          height: 'auto',
          borderRadius: 22,
        }
      : {
          top: 0, bottom: 0, left: 0, right: 0, margin: 'auto',
          width: walking ? 'min(1180px, 96vw)' : 'min(980px, 94vw)',
          height: walking ? 'min(760px, 90vh)' : 'min(680px, 88vh)',
          borderRadius: 22,
        };

  return createPortal(
    <AnimatePresence>
      {(isOpen || isVisualizerMinimized) && (
        <div className="pointer-events-none fixed inset-0 z-[99999] font-sans">
          {/* Backdrop (centred mode only) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: !isVisualizerMinimized && !isDocked && !full ? 1 : 0 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className={`fixed inset-0 -z-10 bg-black/35 backdrop-blur-[3px] dark:bg-black/55 ${!isVisualizerMinimized && !isDocked && !full ? 'pointer-events-auto' : 'pointer-events-none'}`}
          />

          {/* Minimised: a small tab on the screen edge */}
          <AnimatePresence>
            {isVisualizerMinimized && (
              <motion.button
                type="button"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 60, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={() => setVisualizerMinimized(false)}
                className="pointer-events-auto fixed right-0 top-1/2 flex -translate-y-1/2 cursor-pointer items-center gap-2 rounded-l-2xl border border-r-0 border-[var(--st-line-strong)] bg-[var(--bg-primary)] py-3 pl-3 pr-3.5 text-[13px] font-medium text-[var(--text-primary)] shadow-[0_12px_32px_-14px_rgba(0,0,0,0.45)]"
              >
                <Code2 size={16} strokeWidth={1.8} />
                <span className="max-md:hidden">Code</span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.div
            layout
            role="dialog"
            aria-label="Code editor"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{
              opacity: isVisualizerMinimized ? 0 : 1,
              scale: isVisualizerMinimized ? 0.94 : 1,
              y: isVisualizerMinimized ? 28 : 0,
            }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 32,
              mass: 0.8,
              layout: { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 },
            }}
            className={`fixed flex flex-col overflow-hidden border bg-[var(--bg-primary)] text-[var(--text-primary)] ${
              isVisualizerMinimized ? 'pointer-events-none' : 'pointer-events-auto'
            } ${full ? 'border-transparent' : 'border-[var(--st-line-strong)] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.6)]'}`}
            // Position is plain style (always exact); `layout` animates the move between positions.
            style={{ ...frame, willChange: 'transform' }}
          >
            {/* ── Header ───────────────────────────────────────────── */}
            <div className={`flex h-14 shrink-0 items-center gap-2 border-b border-[var(--st-line)] ${isMobile ? 'px-3 pt-[env(safe-area-inset-top)]' : 'px-4'}`}>
              <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border${isDocked ? ' hidden' : ''} border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)]`}>
                  <Code2 size={15} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12.5px] text-[var(--text-primary)]">main.{L.ext}</div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {isRunning ? (
                      <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--mk-accent)]" />Running</>
                    ) : runStatus === 'success' ? (
                      <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Ran fine</>
                    ) : runStatus === 'error' ? (
                      <><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Error</>
                    ) : (
                      <><span className="h-1.5 w-1.5 rounded-full bg-[var(--st-line-strong)]" />Ready</>
                    )}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <div className="relative mr-1" ref={langMenuRef}>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={showLangMenu}
                    onClick={() => setShowLangMenu((v) => !v)}
                    className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors ${
                      showLangMenu ? 'border-[var(--text-tertiary)] text-[var(--text-primary)]' : 'border-[var(--st-line-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {L.name}
                    <ChevronDown size={13} className={`transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showLangMenu && (
                      <motion.div
                        role="listbox"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: EASE }}
                        className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-52 flex-col gap-0.5 rounded-2xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
                      >
                        {Object.entries(LANGUAGES).map(([id, l]) => (
                          <button
                            key={id}
                            type="button"
                            role="option"
                            aria-selected={lang === id}
                            onClick={() => changeLang(id)}
                            className={`flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors ${
                              lang === id ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {l.name}
                            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">.{l.ext}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {!isDocked && (
                  <IconBtn label={copied ? 'Copied' : 'Copy code'} onClick={copy}>
                    {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} strokeWidth={1.8} />}
                  </IconBtn>
                )}
                {!isMobile && (
                  <div role="radiogroup" aria-label="Window position" className="ml-1 flex h-8 items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill-strong)] p-0.5">
                    {[
                      { id: 'left', label: 'Dock left', icon: PanelLeft },
                      { id: null, label: 'Centre', icon: Square },
                      { id: 'right', label: 'Dock right', icon: PanelRight },
                    ].map((o) => {
                      const on = dockSide === o.id && !isMaximized;
                      return (
                        <button
                          key={o.label}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          title={o.label}
                          aria-label={o.label}
                          onClick={() => { setDockSide(o.id); setIsMaximized(false); }}
                          className={`grid h-7 w-8 cursor-pointer place-items-center rounded-full transition-colors ${
                            on ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.25)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <o.icon size={o.id ? 15 : 13} strokeWidth={1.8} />
                        </button>
                      );
                    })}
                  </div>
                )}
                <span className="ml-1.5">
                  <WindowControls
                    onMinimize={() => setVisualizerMinimized(true)}
                    onMaximize={isMobile ? undefined : () => { setIsMaximized((m) => !m); setDockSide(null); }}
                    maximized={isMaximized}
                    onClose={close}
                  />
                </span>
              </div>
            </div>

            {/* ── Editor + console (+ walkthrough) ─────────────────── */}
            <div className={`relative flex min-h-0 flex-1 ${sideBySide ? 'flex-row' : 'flex-col'}`}>
              <div className={`relative min-h-0 ${walking && !sideBySide ? 'h-[38%] shrink-0' : 'flex-1'} ${sideBySide ? 'min-w-0' : ''}`}>
                {tracing && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--bg-primary)]/70 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)] px-3.5 py-2 text-[12.5px] text-[var(--text-primary)] shadow-[0_12px_30px_-14px_rgba(0,0,0,0.4)]">
                      <Loader2 size={14} className="animate-spin text-[var(--mk-accent)]" />
                      {traceStatus || 'Running your code…'}
                    </div>
                  </div>
                )}
                <Editor
                  height="100%"
                  language={lang === 'cpp' ? 'cpp' : lang}
                  value={code}
                  theme={mode === 'dark' ? 'tb-dark' : 'tb-light'}
                  beforeMount={defineThemes}
                  onChange={(val) => setCode(val || '')}
                  onMount={(editor) => {
                    editorRef.current = editor;
                    decoRef.current = null;
                    setEditorEpoch((n) => n + 1);
                    editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
                    // During a walkthrough, clicking a line goes to the next time it runs.
                    editor.onMouseDown((e) => {
                      const w = walkRef.current;
                      const line = e.target?.position?.lineNumber;
                      if (!w || !line || !w.trace.steps.length) return;
                      const at = nextStepOnLine(w.trace, line, stepRef.current);
                      if (at >= 0) setStepIndex(at);
                      else showToast?.({ message: `Line ${line} didn't run in this walkthrough.`, type: 'info', duration: 2500 });
                    });
                  }}
                  loading={<div className="grid h-full place-items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Loading editor</div>}
                  options={{
                    fontSize: isMobile ? 13 : 13.5,
                    lineHeight: 22,
                    fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
                    fontLigatures: true,
                    minimap: { enabled: false },
                    padding: { top: 18, bottom: 18 },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 3,
                    renderLineHighlight: 'line',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    automaticLayout: true,
                    tabSize: 2,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
                    guides: { indentation: true },
                    readOnly: walking,
                    glyphMargin: walking,
                    domReadOnly: walking,
                  }}
                />
              </div>

              {walking && (
                <div className={`flex min-h-0 flex-col bg-[var(--bg-primary)] ${sideBySide ? 'w-[400px] shrink-0 border-l border-[var(--st-line-strong)]' : 'flex-1 border-t border-[var(--st-line-strong)]'}`}>
                  <TracePlayer
                    key={walk.nonce}
                    trace={walk.trace}
                    index={stepIndex}
                    onIndex={setStepIndex}
                    visualizationId={walk.id}
                    followUps={walk.followUps}
                  />
                </div>
              )}

              <AnimatePresence>
                {showOutput && !walking && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: '42%', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-[var(--st-line-strong)] bg-[var(--st-fill)]"
                  >
                    <div className="flex h-10 shrink-0 items-center gap-3 px-4">
                      <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                        <Terminal size={13} strokeWidth={1.8} />
                        Console
                      </span>
                      {runStatus && !isRunning && (
                        <span className={`font-mono text-[10.5px] ${runStatus === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          exit {runStatus === 'success' ? 0 : 1}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-0.5">
                        <IconBtn label="Clear console" onClick={() => { setLogs([]); setRunStatus(null); }}>
                          <Trash2 size={14} strokeWidth={1.8} />
                        </IconBtn>
                        <IconBtn label="Hide console" onClick={() => setShowOutput(false)}>
                          <ChevronDown size={16} strokeWidth={1.8} />
                        </IconBtn>
                      </div>
                    </div>
                    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4 font-mono text-[12.5px] leading-[1.6]">
                      {isRunning && logs.length === 0 && (
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                          <Loader2 size={13} className="animate-spin" /> Running…
                        </div>
                      )}
                      {!isRunning && logs.length === 0 && <div className="text-[var(--text-tertiary)]">Nothing printed yet. Press Run to see output here.</div>}
                      {logs.map((log, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 whitespace-pre-wrap ${
                            log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : log.type === 'info' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="select-none text-[var(--text-tertiary)] opacity-50">›</span>
                          <span className="min-w-0 flex-1">{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Program input (stdin) ────────────────────────────── */}
            <AnimatePresence>
              {showInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="shrink-0 overflow-hidden border-t border-[var(--st-line)]"
                >
                  <div className="px-4 py-3">
                    <label htmlFor="tb-stdin" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Input · one value per line
                    </label>
                    <textarea
                      id="tb-stdin"
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      rows={3}
                      maxLength={10000}
                      placeholder="What your program reads with input(), scanf, cin or Scanner"
                      className="w-full resize-none rounded-[12px] border border-[var(--st-line-strong)] bg-[var(--st-fill)] px-3 py-2 font-mono text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--text-tertiary)]"
                    />
                    {walking && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleVisualize}
                          disabled={tracing}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3 text-[12.5px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {tracing ? <Loader2 size={13} className="animate-spin" /> : <Footprints size={13} />}
                          Run again with this input
                        </button>
                        <span className="text-[11.5px] text-[var(--text-tertiary)]">A new walkthrough is recorded for the new input.</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Footer ───────────────────────────────────────────── */}
            <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-[var(--st-line)] px-4 ${isMobile ? 'pb-[max(env(safe-area-inset-bottom),12px)] pt-3' : 'h-[60px]'}`}>
              {/* Left: Metadata & Status metrics */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span className="truncate shrink-0 max-w-[85px]">{L.name}</span>
                <span className="h-3 w-px shrink-0 bg-[var(--st-line-strong)]" />
                <span className="shrink-0 whitespace-nowrap normal-case tracking-normal">
                  {walking ? <span className="max-sm:hidden">Click a line to jump to it</span> : `Ln ${cursor.line}, Col ${cursor.col}`}
                </span>
                {!isMobile && !isDocked && (
                  <>
                    <span className="h-3 w-px shrink-0 bg-[var(--st-line-strong)] max-md:hidden" />
                    <button
                      type="button"
                      onClick={() => setShowOutput((v) => !v)}
                      className="shrink-0 cursor-pointer whitespace-nowrap hover:text-[var(--text-primary)] max-md:hidden"
                    >
                      {showOutput ? 'Hide console' : 'Console'}
                    </button>
                  </>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {walking ? (
                  <>
                    <IconBtn
                      label={stdin ? 'Input (set) — change it and run again' : 'Give the program input and run again'}
                      onClick={() => setShowInput((v) => !v)}
                      active={showInput || !!stdin}
                    >
                      <Keyboard size={15} strokeWidth={1.8} />
                    </IconBtn>
                    <button
                      type="button"
                      onClick={() => setWalk(null)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--st-line-strong)] px-3.5 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--st-fill)]"
                    >
                      <PencilLine size={15} strokeWidth={1.8} />
                      <span className="max-sm:hidden">Edit code</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Console toggle button (available as icon when docked or mobile) */}
                    {(isDocked || isMobile) && (
                      <IconBtn
                        label={showOutput ? 'Hide console' : 'Show console'}
                        onClick={() => setShowOutput((v) => !v)}
                        active={showOutput}
                      >
                        <Terminal size={15} strokeWidth={1.8} />
                      </IconBtn>
                    )}
                    <IconBtn
                      label={stdin ? 'Input (set)' : 'Input for your program'}
                      onClick={() => setShowInput((v) => !v)}
                      active={showInput || !!stdin}
                    >
                      <Keyboard size={15} strokeWidth={1.8} />
                    </IconBtn>
                    <button
                      type="button"
                      onClick={handleVisualize}
                      disabled={tracing}
                      title="Run it one step at a time and watch the variables change"
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--st-line-strong)] px-3 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--st-fill)] disabled:opacity-60"
                    >
                      {tracing ? <Loader2 size={15} className="animate-spin" /> : <Footprints size={15} strokeWidth={1.8} />}
                      <span className={isDocked ? 'hidden' : 'max-md:hidden'}>Step through</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 sm:gap-2 rounded-full bg-[var(--text-primary)] px-3.5 text-[13px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70"
                >
                  {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                  <span>{isRunning ? 'Running' : 'Run'}</span>
                  {!isMobile && !isDocked && !isRunning && <kbd className="ml-0.5 font-mono text-[10px] opacity-55">⌘↵</kbd>}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default CodeVisualizerModal;
