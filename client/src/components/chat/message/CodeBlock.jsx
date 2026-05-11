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

  return (
    <div
      className="my-4 rounded-[28px] overflow-hidden sf-glass shadow-premium group/code transition-all duration-500 no-scrollbar"
      style={{
        background: 'rgba(var(--bg-secondary-rgb), 0.3)', 
      }}
    >
      {showHeader && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-white/5"
          style={{ 
            background: 'rgba(var(--text-primary-rgb), 0.02)',
          }}
        >
          <div className="flex items-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--text-primary)]/10 border border-white/10">
              <div className="w-1 h-1 rounded-full bg-[var(--theme-color, var(--text-primary))] shadow-[0_0_8px_var(--theme-color)]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] opacity-70">
                {lang || 'code'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isRunnable && (
              <button
                onClick={() => onOpenArtifact?.(code, lang)}
                className="apple-pill flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] transition-all hover:scale-105 active:scale-95"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                <Play size={11} className="text-emerald-500 fill-emerald-500/20" /> 
                <span className="opacity-80">Run</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="apple-pill flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] transition-all hover:scale-105 active:scale-95"
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="opacity-50" />}
              <span className="opacity-80">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        {simpleData ? (
          <DataVisualizer {...simpleData} onLaunchImmersive={handleLaunchImmersive} />
        ) : (
          <SyntaxHighlighter
            language={lang || 'text'}
            style={isDarkMode ? vscDarkPlus : prismTheme}
            customStyle={{
              margin: 0,
              padding: showHeader ? '16px 20px' : '12px 16px',
              fontSize: '13px',
              lineHeight: '1.6',
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
        
        {!showHeader && !simpleData && (
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
