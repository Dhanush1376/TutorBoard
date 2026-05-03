/**
 * DiagramRenderer.jsx — UPGRADED
 *
 * New features:
 * - Auto-detects Mermaid syntax vs plain hierarchical text
 * - If plain text hierarchy detected, renders as interactive tree
 * - Zoom with Ctrl+scroll AND pinch gesture
 * - Full-panel drag to pan
 * - Better error messages with suggested fix
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GitBranch, Code, Eye, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import mermaid from 'mermaid';
import Editor from '@monaco-editor/react';

let mermaidInitialized = false;

const MERMAID_STARTERS = ['graph ', 'flowchart ', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'gitGraph', 'journey', 'quadrantChart', 'requirementDiagram', 'C4Context'];

function isMermaidSyntax(content) {
  if (!content) return false;
  const trimmed = content.trim();
  return MERMAID_STARTERS.some(s => trimmed.startsWith(s));
}

// ─── Simple Tree Renderer for hierarchical text ──────────────────────────────

function parseHierarchy(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const root = { label: 'Root', children: [], level: -1 };
  const stack = [root];

  for (const line of lines) {
    const indent = line.search(/\S/);
    const level = Math.floor(indent / 2);
    const label = line.trim().replace(/^[-*•▸→>]+\s*/, '');
    if (!label) continue;

    const node = { label, children: [], level };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children.length === 1 ? root.children[0] : root;
}

const TreeNode = ({ node, depth = 0, isDark }) => {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const hasChildren = node.children?.length > 0;
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
  const color = colors[depth % colors.length];

  return (
    <div className="relative" style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      {/* Connector */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0"
          style={{
            borderLeft: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderBottom: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            width: 12,
            height: 16,
            marginLeft: -12,
          }}
        />
      )}

      <div
        className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer select-none hover:bg-[var(--bg-tertiary)]/40 transition-colors group"
        onClick={() => hasChildren && setCollapsed(!collapsed)}
      >
        {hasChildren && (
          <span
            className="text-[10px] font-mono w-3 text-center transition-transform duration-150"
            style={{ color, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}
          >
            ▾
          </span>
        )}
        {!hasChildren && <span className="w-3 text-center" style={{ color }}>•</span>}

        <span
          className="text-[13px] font-medium leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {node.label}
        </span>
        {hasChildren && (
          <span className="text-[10px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-60 transition-opacity">
            {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="ml-3 border-l border-[var(--border-color)]/20 pl-1">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Diagram Renderer ───────────────────────────────────────────────────

const DiagramRenderer = ({ content, isDark, onContentChange }) => {
  const [viewMode, setViewMode] = useState('preview');
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const containerRef = useRef(null);
  const renderIdRef = useRef(0);

  const isMermaid = isMermaidSyntax(content);
  const isHierarchy = !isMermaid && content?.includes('\n');

  // Init mermaid
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: '"Inter", sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis' },
      });
      mermaidInitialized = true;
    }
  }, []);

  // Re-init on theme change
  useEffect(() => {
    mermaid.initialize({ theme: isDark ? 'dark' : 'default' });
    if (isMermaid && content) renderDiagram(content);
  }, [isDark]);

  const renderDiagram = useCallback(async (code) => {
    if (!code?.trim()) { setSvgHtml(''); setError(null); return; }
    const currentRender = ++renderIdRef.current;
    try {
      const id = `mermaid-${Date.now()}-${currentRender}`;
      const { svg } = await mermaid.render(id, code.trim());
      if (currentRender === renderIdRef.current) {
        setSvgHtml(svg);
        setError(null);
      }
    } catch (err) {
      if (currentRender === renderIdRef.current) {
        setError(err.message || 'Failed to render diagram');
        setSvgHtml('');
      }
    }
  }, []);

  useEffect(() => {
    if (!isMermaid) return;
    const timer = setTimeout(() => renderDiagram(content), 300);
    return () => clearTimeout(timer);
  }, [content, renderDiagram, isMermaid]);

  // Zoom handlers
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(Math.max(z + delta, 0.2), 4));
    }
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const treeData = isHierarchy ? parseHierarchy(content) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)]/50 rounded-md p-0.5">
            {['preview', 'code'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded transition-all capitalize ${
                  viewMode === mode
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mode === 'preview' ? <Eye size={10} /> : <Code size={10} />}
                {mode}
              </button>
            ))}
          </div>

          {/* Type badge */}
          {viewMode === 'preview' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full border border-[var(--border-color)]/30 text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]/30 uppercase tracking-wider">
              {isHierarchy ? 'tree' : 'mermaid'}
            </span>
          )}
        </div>

        {viewMode === 'preview' && isMermaid && (
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.2))} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"><ZoomOut size={12} /></button>
            <span className="text-[9px] font-mono text-[var(--text-tertiary)] w-8 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"><ZoomIn size={12} /></button>
            <button onClick={resetView} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]" title="Reset view"><RotateCcw size={11} /></button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'preview' ? (
          <div className="w-full h-full relative overflow-hidden">
            {/* Mermaid render */}
            {isMermaid && !error && svgHtml && (
              <div
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-full h-full flex items-center justify-center overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease',
                  }}
                  className="mermaid-diagram"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              </div>
            )}

            {/* Loading */}
            {isMermaid && !error && !svgHtml && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center animate-pulse">
                  <GitBranch size={18} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">Rendering diagram…</p>
              </div>
            )}

            {/* Tree View */}
            {isHierarchy && treeData && (
              <div className="w-full h-full overflow-auto p-4">
                <TreeNode node={treeData} depth={0} isDark={isDark} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10">
                  <AlertTriangle size={22} className="text-red-400" />
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-[var(--text-primary)] mb-1">Diagram syntax error</h4>
                  <p className="text-[11px] text-[var(--text-tertiary)] max-w-xs leading-relaxed">{error}</p>
                </div>
                <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]/30 text-[10px] text-[var(--text-tertiary)]">
                  Make sure it starts with: <code className="font-mono">graph TD</code>, <code className="font-mono">flowchart LR</code>, etc.
                </div>
                <button
                  onClick={() => setViewMode('code')}
                  className="px-3 py-1.5 text-[11px] rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-80"
                >
                  Edit Syntax
                </button>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={content || ''}
            onChange={e => onContentChange?.(e.target.value)}
            className="w-full h-full p-4 bg-transparent text-[12px] font-mono text-[var(--text-primary)] resize-none outline-none leading-relaxed"
            spellCheck={false}
            placeholder="Enter Mermaid syntax...\n\nExample:\ngraph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do something]\n  B -->|No| D[Done]"
          />
        )}
      </div>
    </div>
  );
};

export default DiagramRenderer;