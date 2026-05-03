import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GitBranch, Code, Eye, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import mermaid from 'mermaid';

/**
 * DiagramRenderer — Full Mermaid.js-powered diagram renderer.
 * Supports flowcharts, sequence diagrams, class diagrams, Gantt, mind maps, etc.
 * Includes code/preview toggle, zoom controls, and error fallback.
 */

let mermaidInitialized = false;

const DiagramRenderer = ({ content, isDark, onContentChange }) => {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const renderIdRef = useRef(0);

  // Initialize mermaid once
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: '"Inter", sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { mirrorActors: false },
      });
      mermaidInitialized = true;
    }
  }, []);

  // Re-initialize theme when dark mode changes
  useEffect(() => {
    mermaid.initialize({
      theme: isDark ? 'dark' : 'default',
    });
    // Re-render with new theme
    if (content) renderDiagram(content);
  }, [isDark]);

  const renderDiagram = useCallback(async (code) => {
    if (!code || !code.trim()) {
      setSvgHtml('');
      setError(null);
      return;
    }

    const currentRender = ++renderIdRef.current;

    try {
      // Generate a unique ID for each render to avoid conflicts
      const id = `mermaid-${Date.now()}-${currentRender}`;
      const { svg } = await mermaid.render(id, code.trim());
      
      // Only apply if this is still the latest render
      if (currentRender === renderIdRef.current) {
        setSvgHtml(svg);
        setError(null);
      }
    } catch (err) {
      if (currentRender === renderIdRef.current) {
        console.warn('[DiagramRenderer] Mermaid render error:', err.message);
        setError(err.message || 'Failed to render diagram');
        setSvgHtml('');
      }
    }
  }, []);

  // Render on content change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      renderDiagram(content);
    }, 300);
    return () => clearTimeout(timer);
  }, [content, renderDiagram]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

  // Scroll-to-zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(Math.max(z + delta, 0.25), 3));
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)]/50 rounded-md p-0.5">
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              viewMode === 'preview'
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Eye size={10} /> Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              viewMode === 'code'
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code size={10} /> Code
          </button>
        </div>

        {viewMode === 'preview' && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-tertiary)]"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[9px] font-mono text-[var(--text-tertiary)] w-8 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-tertiary)]"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-tertiary)]"
              title="Reset zoom"
            >
              <RotateCcw size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {viewMode === 'preview' ? (
          <div
            ref={containerRef}
            onWheel={handleWheel}
            className="w-full h-full flex items-center justify-center p-6 overflow-auto"
          >
            {error ? (
              <div className="flex flex-col items-center gap-3 max-w-md text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                >
                  <AlertTriangle size={22} className="text-red-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                    Diagram Render Failed
                  </h4>
                  <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                    {error}
                  </p>
                </div>
                {/* Show raw code as fallback */}
                <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]/30 text-[10px] font-mono text-[var(--text-secondary)] max-w-full overflow-auto max-h-40 w-full text-left">
                  {content}
                </pre>
              </div>
            ) : svgHtml ? (
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
                className="mermaid-diagram"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center animate-pulse"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                >
                  <GitBranch size={22} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">Rendering diagram...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full">
            <textarea
              value={content || ''}
              onChange={(e) => onContentChange?.(e.target.value)}
              className="w-full h-full p-4 bg-transparent text-[12px] font-mono text-[var(--text-primary)] resize-none outline-none leading-relaxed"
              spellCheck={false}
              placeholder="Enter Mermaid syntax here...&#10;&#10;Example:&#10;graph TD&#10;  A[Start] --> B{Decision}&#10;  B -->|Yes| C[Do something]&#10;  B -->|No| D[Do something else]"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagramRenderer;
