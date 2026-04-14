import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import { 
  Code2, Play, X, Maximize2, Sigma, 
  ChevronRight, Save, Wand2, Terminal
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import FloatingFormatBar from './FloatingFormatBar.jsx';

// Scale factor helper
const CW = 800;
const CH = 600;

export default function InlineEditor({ elements, editingObjectId, Z, tx, ty }) {
  const { updateCanvasObject, setEditingObjectId } = useTutorStore();
  const obj = elements.find(e => e.id === editingObjectId);
  
  const [localContent, setLocalContent] = useState('');
  
  useEffect(() => {
    if (obj) {
      setLocalContent(obj.content || obj.label || obj.code || obj.text || '');
    }
  }, [editingObjectId]);

  if (!obj) return null;

  const isPremiumText = obj.type === 'text' || obj.type === 'label' || obj.type === 'annotation' || obj.type === 'caption';
  if (isPremiumText) return null; // PremiumTextBox handles its own editing state natively


  // Compute scaled coordinate metrics
  const cx = (obj.x ?? 0.5) * CW;
  const cy = (obj.y ?? 0.5) * CH;
  const baseW = obj.w ? (obj.w <= 1 ? obj.w * CW : obj.w) : (obj.scale || 1) * 200;
  const baseH = obj.h ? (obj.h <= 1 ? obj.h * CH : obj.h) : (obj.scale || 1) * 120;
  
  const left = (cx - baseW/2) * Z + tx;
  const top = (cy - baseH/2) * Z + ty;
  const width = baseW * Z;
  const height = baseH * Z;

  const handleChange = (val) => {
    setLocalContent(val);
    updateCanvasObject(obj.id, { content: val });
  };

  const isMath = obj.type === 'equation' || obj.type === 'math' || obj.type === 'formula';
  const isCode = obj.type === 'code' || obj.type === 'codeline' || obj.type === 'terminal';

  if (isCode) {
    return (
      <CodeModalEditor 
        obj={obj} 
        value={localContent} 
        onChange={handleChange} 
        onClose={() => setEditingObjectId(null)} 
      />
    );
  }

  return (
    <>
      <div 
        className="absolute z-50 transition-all duration-300"
        style={{ left, top: top - 55 }}
      >
        <FloatingFormatBar element={obj} updateCanvasObject={updateCanvasObject} />
      </div>
      
      <div 
        className="absolute z-40 bg-transparent flex flex-col"
        style={{ left, top, width, height }}
      >
        {isMath ? (
          <MathInsideEditor 
            value={localContent} 
            onChange={handleChange} 
            styles={obj.styles || {}} 
            Z={Z}
            color={obj.color}
          />
        ) : (
          <div className="w-full h-full relative">

            
            <textarea
              autoFocus
              value={localContent}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setEditingObjectId(null)}
              className={`w-full h-full bg-transparent outline-none resize-none p-2 rounded-lg shadow-xl transition-all relative z-10
                ${obj.type === 'code' ? 'font-mono' : 'font-sans'}`}
              style={{
                fontSize: (obj.styles?.fontSize || 16) * Z,
                fontWeight: obj.styles?.fontWeight || 'normal',
                fontStyle: obj.styles?.fontStyle || 'normal',
                textDecoration: obj.styles?.textDecoration || 'none',
                textAlign: obj.styles?.textAlign || 'center',
                color: obj.color || 'var(--text-primary)',
                background: (obj.type === 'sticky' || obj.type === 'note') 
                  ? `${obj.color}cc` 
                  : (obj.styles?.backgroundColor || 'transparent'),
                fontFamily: obj.type === 'code' ? "'Geist Mono', monospace" : (obj.styles?.fontFamily || 'var(--font-sans)'),
                lineHeight: 1.2
              }}
              spellCheck={false}
            />
          </div>
        )}
      </div>
      
      {/* Click Away Shield */}
      <div 
        className="absolute inset-0 z-30" 
        onPointerDown={(e) => {
          e.stopPropagation();
          setEditingObjectId(null);
        }} 
      />
    </>
  );
}

function CodeModalEditor({ obj, value, onChange, onClose }) {
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  // Sync scroll between textarea and gutter
  const handleScroll = (e) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // ─── DRAGGABLE STATE ───
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const onDragStart = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragMove = (e) => {
    if (!isDragging.current) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  };

  const onDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  };

  // Line number computation
  const lines = (value || '').split('\n');
  const lineCount = Math.max(lines.length, 12);

  const handleRun = () => {
    setShowOutput(true);
    try {
      // Simulated output — in real app, this could call an API
      setOutput(`> Running ${language}...\n> Compiled successfully.\n> Output: (sandbox execution not available)`);
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    }
  };

  const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript', ext: '.js' },
    { id: 'python',     label: 'Python',     ext: '.py' },
    { id: 'cpp',        label: 'C++',        ext: '.cpp' },
    { id: 'java',       label: 'Java',       ext: '.java' },
    { id: 'html',       label: 'HTML/CSS',   ext: '.html' },
    { id: 'typescript', label: 'TypeScript', ext: '.ts' },
    { id: 'rust',       label: 'Rust',       ext: '.rs' },
    { id: 'go',         label: 'Go',         ext: '.go' },
  ];

  const activeLang = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-transparent">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="flex flex-col overflow-hidden"
        style={{
          width: isMaximized ? 'min(98vw, 1200px)' : 'min(90vw, 620px)',
          height: isMinimized ? '42px' : (isMaximized ? 'min(95vh, 800px)' : 'min(80vh, 480px)'),
          borderRadius: 14,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ═══ TITLE BAR (Draggable) ═══ */}
        <div
          ref={dragRef}
          onMouseDown={onDragStart}
          className="flex items-center justify-between px-3.5 py-2 border-b select-none"
          style={{
            cursor: isDragging.current ? 'grabbing' : 'grab',
            borderColor: 'var(--border-color)',
            background: 'var(--bg-tertiary)',
          }}
        >
          {/* Traffic lights + Title */}
          <div className="flex items-center gap-3 group/lights">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] transition-all border border-[#e14640]/40 shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-95 flex items-center justify-center group"
                title="Close"
              >
                <X size={8} className="opacity-0 group-hover/lights:opacity-100 transition-opacity text-black/40 stroke-[4px]" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#fdb119] transition-all border border-[#d79a1d]/40 shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-95 flex items-center justify-center" 
                title={isMinimized ? "Restore" : "Minimize"} 
              >
                <div className="w-1.5 h-[1.5px] bg-black/40 opacity-0 group-hover/lights:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); setIsMinimized(false); }}
                className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#20af35] transition-all border border-[#1fa233]/40 shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-95 flex items-center justify-center" 
                title={isMaximized ? "Restore Size" : "Maximize"} 
              >
                <Maximize2 size={8} className="opacity-0 group-hover/lights:opacity-100 transition-opacity text-black/40 stroke-[4px]" />
              </button>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <Code2 size={14} style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                untitled{activeLang.ext}
              </span>
            </div>
          </div>

          {/* Custom Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              {activeLang.label}
              <ChevronRight size={10} className={`transform transition-transform ${showLanguageMenu ? 'rotate-90' : 'rotate-0'}`} />
            </button>
            
            <AnimatePresence>
              {showLanguageMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  className="absolute top-full right-0 mt-2 z-[7000] p-1.5 rounded-xl shadow-2xl border"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-color)',
                    minWidth: '140px'
                  }}
                >
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => { setLanguage(lang.id); setShowLanguageMenu(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--bg-secondary)] transition-colors"
                      style={{ color: language === lang.id ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    >
                      {lang.label}
                      {language === lang.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ═══ EDITOR BODY ═══ */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Line Numbers Gutter */}
          <div
            ref={gutterRef}
            className="flex flex-col items-end py-4 pr-3 pl-3 select-none overflow-hidden"
            style={{
              background: 'var(--bg-tertiary)',
              borderRight: '1px solid var(--border-color)',
              minWidth: 48,
            }}
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div
                key={i}
                className="leading-[1.7] text-right"
                style={{
                  fontSize: 12,
                  fontFamily: "'Geist Mono', 'Fira Code', 'JetBrains Mono', monospace",
                  color: i < lines.length
                    ? 'var(--text-tertiary)'
                    : 'transparent',
                  opacity: i < lines.length ? 0.5 : 0,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code Textarea */}
          <textarea
            ref={textareaRef}
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            className="flex-1 outline-none resize-none p-4 overflow-auto scroll-smooth"
            placeholder="// Start coding here..."
            spellCheck={false}
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontFamily: "'Geist Mono', 'Fira Code', 'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.6,
              letterSpacing: '0.01em',
              caretColor: '#60a5fa',
              tabSize: 4,
            }}
            onKeyDown={(e) => {
              // Tab support
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const newVal = value.substring(0, start) + '  ' + value.substring(end);
                onChange(newVal);
                setTimeout(() => {
                  e.target.selectionStart = e.target.selectionEnd = start + 2;
                }, 0);
              }
            }}
          />
        </div>

        {/* ═══ TERMINAL OUTPUT (Collapsible) ═══ */}
        <AnimatePresence>
          {showOutput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 120, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="h-full flex flex-col" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-2">
                    <Terminal size={11} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Terminal Output
                    </span>
                  </div>
                  <button
                    onClick={() => setShowOutput(false)}
                    className="p-0.5 rounded transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X size={12} />
                  </button>
                </div>
                <pre
                  className="flex-1 p-3 overflow-auto text-[11px] leading-relaxed"
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {output || '> Waiting for execution...'}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ FOOTER STATUS BAR ═══ */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--bg-tertiary)',
          }}
        >
          {/* Left: Status indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Ready
              </span>
            </div>
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              Ln {lines.length}, Col {(value || '').length > 0 ? value.split('\n').pop().length + 1 : 1}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {(value || '').length} chars
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 border"
              style={{
                background: '#10b981',
                color: '#fff',
                borderColor: '#059669',
                boxShadow: '0 2px 8px rgba(16,185,129,0.15)',
              }}
            >
              <Play size={10} className="fill-white" strokeWidth={3} />
              Run
            </button>

            <button
              onClick={() => setShowOutput(!showOutput)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Terminal size={10} strokeWidth={3} />
              Terminal
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border shadow-md"
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                borderColor: 'var(--text-primary)',
              }}
            >
              <Save size={10} strokeWidth={3} />
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MathInsideEditor({ value, onChange, styles, Z, color }) {
  const { setEditingObjectId } = useTutorStore();
  const previewRef = useRef(null);

  useEffect(() => {
    if (previewRef.current && value) {
      try {
        katex.render(value, previewRef.current, {
           throwOnError: false,
           displayMode: true
        });
      } catch (err) {}
    }
  }, [value]);

  const insertMath = (symbol) => {
    onChange(value + symbol);
  };

  return (
    <div className="w-full h-full relative flex flex-col bg-slate-900/95 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div className="flex-1 flex overflow-hidden">
        {/* LaTeX Input */}
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter LaTeX..."
          className="flex-1 bg-slate-950/50 p-3 font-mono text-sm text-cyan-400 outline-none resize-none border-r border-slate-800"
        />

        {/* Scientific Panel - Step 3: Calculator Grid */}
        <div className="w-56 bg-slate-900 p-2 grid grid-cols-4 gap-1 overflow-y-auto content-start">
           {[
             { label: 'sin', val: '\\sin(' }, { label: 'cos', val: '\\cos(' }, { label: 'tan', val: '\\tan(' }, { label: '√', val: '\\sqrt{' },
             { label: 'ln', val: '\\ln(' }, { label: 'log', val: '\\log_{10}(' }, { label: '^', val: '^' }, { label: 'π', val: '\\pi' },
             { label: '(', val: '(' }, { label: ')', val: ')' }, { label: '{ }', val: '{ }' }, { label: '÷', val: '\\div' },
             { label: '7', val: '7' }, { label: '8', val: '8' }, { label: '9', val: '9' }, { label: '×', val: '\\times' },
             { label: '4', val: '4' }, { label: '5', val: '5' }, { label: '6', val: '6' }, { label: '−', val: '-' },
             { label: '1', val: '1' }, { label: '2', val: '2' }, { label: '3', val: '3' }, { label: '+', val: '+' },
             { label: '0', val: '0' }, { label: '.', val: '.' }, { label: ',', val: ',' }, { label: '=', val: '=' },
           ].map((sym) => (
             <button
               key={sym.label}
               onPointerDown={(e) => { e.stopPropagation(); insertMath(sym.val); }}
               className={`h-9 flex items-center justify-center rounded border border-slate-700/50 transition text-[11px] font-bold ${
                 /[0-9]/.test(sym.label) ? 'bg-slate-800/80 text-white' : 'bg-slate-900 text-cyan-400'
               } hover:brightness-125 active:scale-95`}
             >
               {sym.label}
             </button>
           ))}
        </div>
      </div>

      {/* Real-time Preview */}
      <div className="h-20 flex items-center justify-center p-4 overflow-auto bg-slate-950/80 border-t border-slate-800 relative group">
        <div ref={previewRef} style={{ color: color || 'white', fontSize: (styles.fontSize || 20) * Z }} />
        <div className="absolute top-1 left-2 text-[8px] font-bold text-slate-600 uppercase">Preview</div>
      </div>
      
      <button 
        onPointerDown={(e) => { e.stopPropagation(); setEditingObjectId(null); }}
        className="absolute bottom-2 right-2 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors z-20 shadow-lg"
      >
        Done
      </button>
    </div>
  );
}
