import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Play, Copy, Check, Footprints } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism as prismTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DataVisualizer from './DataVisualizer';
import { RUNNABLE_LANGS } from './constants';
import useTutorStore, { STATES } from '../../../store/tutorStore';

const CodeBlock = memo(({ children, className, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const lang = (className || '').replace(/^language-/, '').toLowerCase();
  const code = String(children).replace(/\n$/, '');

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


  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked (permissions / insecure context): leave the button as is */ }
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

  const actionClass =
    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] ' +
    'transition-colors hover:bg-[var(--st-fill-strong,var(--bg-tertiary))] hover:text-[var(--text-primary)] ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text-primary)]';

  return (
    <div
      className="tb-code group/code @container my-3 block w-full overflow-hidden rounded-xl"
      style={{ background: 'var(--st-fill, var(--bg-secondary))', border: '1px solid var(--st-line-strong, var(--border-color))' }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--st-line, var(--border-color))' }}
      >
        <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] lowercase text-[var(--text-tertiary)]">{lang || 'code'}</span>
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          {isRunnable && (
            <button
              type="button"
              onClick={() => onOpenArtifact?.(code, lang, { visualize: true })}
              title="Run it one step at a time and watch the variables change"
              aria-label="Step through"
              className={actionClass}
            >
              <Footprints size={13} className="text-amber-500" aria-hidden="true" />
              <span className="hidden @[22rem]:inline">Step through</span>
            </button>
          )}
          {isRunnable && (
            <button type="button" onClick={() => onOpenArtifact?.(code, lang)} className={actionClass} aria-label="Run" title="Run">
              <Play size={13} className="text-emerald-500" aria-hidden="true" />
              <span className="hidden @[22rem]:inline">Run</span>
            </button>
          )}
          <button type="button" onClick={handleCopy} className={actionClass} aria-label={copied ? 'Copied' : 'Copy code'}>
            {copied ? <Check size={13} className="text-emerald-500" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            <span className="hidden @[22rem]:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="relative w-full">
        {simpleData ? (
          <DataVisualizer {...simpleData} onLaunchImmersive={handleLaunchImmersive} />
        ) : (
          <SyntaxHighlighter
            language={lang || 'text'}
            style={isDarkMode ? vscDarkPlus : prismTheme}
            customStyle={{
              margin: 0,
              padding: '12px 14px',
              fontSize: '13px',
              lineHeight: '1.6',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              overflowX: 'auto',
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
      </div>
    </div>
  );
});

export default CodeBlock;
