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
            {/* Step 2: MS Paint Style Bounding Box (Dashed) */}
            <div className="absolute inset-x-[-12px] inset-y-[-12px] pointer-events-none border-2 border-dashed border-cyan-500/50 rounded-lg animate-pulse z-0" />
            
            <textarea
              autoFocus
              value={localContent}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setEditingObjectId(null)}
              className={`w-full h-full bg-transparent outline-none resize-none p-2 rounded-lg shadow-xl backdrop-blur-md transition-all relative z-10
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
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[85vw] h-[85vh] max-w-4xl bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Code2 size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">Code Editor</h3>
              <p className="text-[10px] text-slate-500 font-mono">Editing: {obj.id}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <select className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-md outline-none border border-slate-700">
               <option>JavaScript</option>
               <option>Python</option>
               <option>C++</option>
               <option>Java</option>
               <option>HTML/CSS</option>
             </select>
             <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white">
               <X size={20} />
             </button>
          </div>
        </div>

        {/* Editor Body - Step 4: Split View */}
        <div className="flex-1 flex overflow-hidden">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-[#0a0f1d] p-8 font-mono text-sm leading-relaxed text-blue-100 outline-none resize-none scrollbar-thin border-r border-slate-800"
            placeholder="// Start coding here..."
            spellCheck={false}
          />
          
          {/* Visual Execution Pane */}
          <div className="w-[350px] bg-slate-950 flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visual Output</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
               <div className="w-32 h-32 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center relative">
                  <Wand2 size={40} className="text-slate-800 absolute opacity-20" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t-2 border-cyan-500/40 rounded-full"
                  />
               </div>
               <p className="text-[11px] text-slate-600 font-medium">Click "Visualize" below to start the step-by-step code animation.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/40 transition group">
              <Play size={14} className="fill-white" />
              <span>RUN CODE</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition">
              <Terminal size={14} />
              <span>VISUALIZE</span>
            </button>
          </div>

          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2 bg-slate-200 hover:bg-white text-slate-900 text-xs font-bold rounded-xl transition"
          >
            <Save size={14} />
            <span>SAVE & FINISH</span>
          </button>
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
