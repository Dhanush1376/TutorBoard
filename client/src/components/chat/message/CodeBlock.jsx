import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Play, Copy, Check, Sparkles } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism as prismTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DataVisualizer from './DataVisualizer';
import { LANG_COLORS, PROGRAM_LANGS, RUNNABLE_LANGS } from './constants';
import useTutorStore, { STATES } from '../../../store/tutorStore';

const CodeBlock = memo(({ children, className, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const lang = (className || '').replace(/^language-/, '').toLowerCase();
  const code = String(children).replace(/\n$/, '');

  const isProgramLang = PROGRAM_LANGS.includes(lang);
  const isRunnable = RUNNABLE_LANGS.includes(lang);

  const simpleData = useMemo(() => {
    if (lang && !['json', 'text', ''].includes(lang)) return null;
    try {
      const trimmed = code.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 16 && parsed.every(i => typeof i !== 'object')) {
        return { type: 'array', data: parsed };
      }
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length > 0 && keys.length <= 8 && Object.values(parsed).every(v => typeof v !== 'object')) {
          return { type: 'object', data: parsed };
        }
      }
      return null;
    } catch (e) { return null; }
  }, [code, lang]);

  const showHeader = isProgramLang || (lang && !['json', 'text', 'markdown', 'md', 'yaml'].includes(lang));

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleLaunchImmersive = useCallback((type, data) => {
    const timeline = {
      title: type === 'array' ? 'Array Visualization' : 'Object Breakdown',
      domain: 'computer_science',
      renderer: 'd3',
      totalSteps: 1,
      elements: [
        {
          id: 'viz-main-element',
          type: type === 'array' ? 'array' : 'object',
          values: type === 'array' ? data : undefined,
          properties: type === 'object' ? data : undefined,
          x: 400, y: 300,
          title: type === 'array' ? 'Array Structure' : 'Object Properties'
        }
      ],
      steps: [
        {
          id: 'immersive-viz-step-1',
          narration: `This is a visual representation of your ${type}. Explore the structure and elements here.`,
          objects: ['viz-main-element']
        }
      ]
    };
    
    const state = useTutorStore.getState();
    state.setTimeline(timeline);
    state.setCanvasLayout('split');
    state.setMachineState?.(STATES.TEACHING); 
    state.setActiveArtifact?.('immersive-viz');
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const isSingleLine = !code.includes('\n');

  // Completely streamlined UI for single line or short inline tags
  if (isSingleLine) {
    return (
      <code
        onClick={handleCopy}
        title="Click to copy"
        className="px-3 py-1 rounded-lg font-mono text-[12.5px] font-medium inline-flex items-center gap-1.5 my-1 mx-0.5 transition-all cursor-pointer hover:opacity-80 active:scale-95 select-all"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          lineHeight: '1.35',
          verticalAlign: 'middle',
        }}
      >
        <span>{code}</span>
        {copied ? (
          <Check size={11} className="text-emerald-500 shrink-0 ml-0.5" />
        ) : null}
      </code>
    );
  }

  // Ensure multi-line blocks always get a gorgeous professional container
  const effectiveShowHeader = showHeader || !isSingleLine;

  return (
    <div
      className="my-3 rounded-xl overflow-hidden group/code transition-all duration-500 no-scrollbar w-full block"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      }}
    >
      {effectiveShowHeader && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]/30"
          style={{ background: 'transparent' }}
        >
          <div className="flex items-center gap-2.5">
            {/* macOS Developer Traffic Lights */}
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/20 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/20 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/20 inline-block" />
            </div>
            <div className="h-3 w-[1px] bg-[var(--border-color)]/40" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-primary)] opacity-50">
              {lang || 'code'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isRunnable && (
              <button
                onClick={() => onOpenArtifact?.(code, lang)}
                className="flex items-center gap-1 px-2.5 py-1 text-[var(--text-primary)] opacity-40 hover:opacity-100 transition-all active:scale-95"
                style={{ fontSize: 10.5, fontWeight: 600 }}
              >
                <Play size={10} className="text-emerald-500 fill-emerald-500/20" /> 
                <span className="opacity-80">Run</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-[var(--text-primary)] opacity-40 hover:opacity-100 transition-all active:scale-95"
              style={{ fontSize: 10.5, fontWeight: 600 }}
            >
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="opacity-50" />}
              <span className="opacity-80">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full">
        {simpleData ? (
          <DataVisualizer {...simpleData} onLaunchImmersive={handleLaunchImmersive} />
        ) : (
          <SyntaxHighlighter
            language={lang || 'text'}
            style={isDarkMode ? vscDarkPlus : prismTheme}
            customStyle={{
              margin: 0,
              padding: effectiveShowHeader ? '12px 16px' : '10px 14px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}
            codeTagProps={{
              style: { 
                fontFamily: 'var(--font-mono)', 
                background: 'transparent',
                color: 'inherit'
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}
        
        {!effectiveShowHeader && !simpleData && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 border border-white/10 opacity-0 group-hover/code:opacity-100 transition-opacity"
            title="Copy Code"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/40" />}
          </button>
        )}
      </div>
    </div>
  );
});

export default CodeBlock;
