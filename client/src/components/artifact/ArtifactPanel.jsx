import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Download, Maximize2, Minimize2, Save,
  History, Code, Globe, FileText, Table2, GitBranch,
  Sparkles, Send, Loader2
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { BASE_URL as API_URL } from '../../services/api';
import CodeRenderer from './renderers/CodeRenderer';
import UIRenderer from './renderers/UIRenderer';
import DocumentRenderer from './renderers/DocumentRenderer';
import TableRenderer from './renderers/TableRenderer';
import DiagramRenderer from './renderers/DiagramRenderer';
import VersionHistory from './VersionHistory';

// ─── Type Icon Map ──────────────────────────────────────────────────────────

const TYPE_ICONS = {
  code: Code,
  ui: Globe,
  document: FileText,
  table: Table2,
  diagram: GitBranch,
};

const TYPE_LABELS = {
  code: 'Code',
  ui: 'UI Preview',
  document: 'Document',
  table: 'Table',
  diagram: 'Diagram',
};

const TYPE_COLORS = {
  code: '#3b82f6',
  ui: '#8b5cf6',
  document: '#10b981',
  table: '#f59e0b',
  diagram: '#ec4899',
};

// ─── Artifact Panel ─────────────────────────────────────────────────────────

const ArtifactPanel = ({ isDark }) => {
  const artifacts = useTutorStore(state => state.artifacts);
  const activeArtifactId = useTutorStore(state => state.activeArtifactId);
  const isArtifactPanelOpen = useTutorStore(state => state.isArtifactPanelOpen);
  const artifactPanelFullscreen = useTutorStore(state => state.artifactPanelFullscreen);
  const setActiveArtifact = useTutorStore(state => state.setActiveArtifact);
  const closeArtifactPanel = useTutorStore(state => state.closeArtifactPanel);
  const toggleArtifactFullscreen = useTutorStore(state => state.toggleArtifactFullscreen);
  const updateArtifactContent = useTutorStore(state => state.updateArtifactContent);
  const saveArtifactVersion = useTutorStore(state => state.saveArtifactVersion);
  const revertArtifact = useTutorStore(state => state.revertArtifact);
  const removeArtifact = useTutorStore(state => state.removeArtifact);
  const streamingArtifact = useTutorStore(state => state.streamingArtifact);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isAiEditing, setIsAiEditing] = useState(false);

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || streamingArtifact;

  const handleCopy = useCallback(async () => {
    if (!activeArtifact) return;
    try {
      await navigator.clipboard.writeText(activeArtifact.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [activeArtifact]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;
    const ext = {
      code: activeArtifact.language || 'txt',
      ui: 'html',
      document: 'md',
      table: 'md',
      diagram: 'txt',
    }[activeArtifact.type] || 'txt';

    const blob = new Blob([activeArtifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArtifact.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeArtifact]);

  const handleSaveVersion = useCallback(() => {
    if (!activeArtifactId) return;
    saveArtifactVersion(activeArtifactId);
  }, [activeArtifactId, saveArtifactVersion]);

  const handleContentChange = useCallback((content) => {
    if (!activeArtifactId) return;
    updateArtifactContent(activeArtifactId, content);
  }, [activeArtifactId, updateArtifactContent]);

  /** AI-powered artifact editing */
  const handleAiEdit = useCallback(async () => {
    if (!aiEditPrompt.trim() || !activeArtifact?.dbId || isAiEditing) return;

    setIsAiEditing(true);
    try {
      const response = await API.post('/api/artifact/modify', {
        artifactId: activeArtifact.dbId,
        instruction: aiEditPrompt.trim(),
      });

      if (response.status === 200) {
        const data = response.data;
        // Update local store with new content and version
        updateArtifactContent(activeArtifactId, data.content);
        saveArtifactVersion(activeArtifactId);
        setAiEditPrompt('');
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('[ArtifactPanel] AI edit failed:', err.error);
      }
    } catch (err) {
      console.error('[ArtifactPanel] AI edit error:', err);
    } finally {
      setIsAiEditing(false);
    }
  }, [aiEditPrompt, activeArtifact, activeArtifactId, isAiEditing, updateArtifactContent, saveArtifactVersion]);

  // ─── Content Cleaning ───
  const cleanContent = (content) => {
    if (typeof content !== 'string') return content;
    
    // Normalize newlines and trim
    let cleaned = content.replace(/\r\n/g, '\n').trim();
    
    // Multi-line approach: Check the first few lines specifically
    let lines = cleaned.split('\n');
    let linesToSkip = 0;

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const stripped = lines[i].trim().replace(/[#\s\*_:]/g, ''); // Strip all punctuation/markdown
      
      // If the line (when stripped) is exactly "Title" or "Introduction"
      if (stripped.toLowerCase() === 'title' || stripped.toLowerCase() === 'introduction') {
        linesToSkip = i + 1; 
        // Skip any immediately following blank lines
        while (linesToSkip < lines.length && lines[linesToSkip].trim() === '') {
          linesToSkip++;
        }
        break;
      }
    }

    if (linesToSkip > 0) {
      cleaned = lines.slice(linesToSkip).join('\n').trim();
    }

    // Final flexible removal for prefixes on the first line
    cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Title:?\s*/i, '$1');
    cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Introduction:?\s*/i, '$1');

    return cleaned;
  };

  const displayContent = cleanContent(activeArtifact?.content);

  if (!isArtifactPanelOpen || (!activeArtifact && !streamingArtifact)) return null;

  const TypeIcon = TYPE_ICONS[activeArtifact?.type] || Code;

  return (
    <AnimatePresence>
      <motion.div
        key="artifact-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative h-full bg-[var(--bg-primary)] flex flex-col overflow-hidden"
        style={{
          width: '100%',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
        }}
      >
        {/* ─── Header ─── */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]/40"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: `${TYPE_COLORS[activeArtifact?.type] || '#888'}20` }}
            >
              <TypeIcon
                size={12}
                style={{ color: TYPE_COLORS[activeArtifact?.type] || '#888' }}
              />
            </div>
            <span
              className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: `${TYPE_COLORS[activeArtifact?.type] || '#888'}15`,
                color: TYPE_COLORS[activeArtifact?.type] || '#888',
              }}
            >
              {TYPE_LABELS[activeArtifact?.type] || 'Unknown'}
            </span>
            {activeArtifact?.version > 1 && (
              <span className="text-[9px] text-[var(--text-tertiary)]">
                v{activeArtifact.version}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={handleCopy}
              title="Copy"
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Copy size={13} className={isCopied ? "text-green-500" : "text-[var(--text-tertiary)]"} />
            </button>
            <div className="w-px h-4 bg-[var(--border-color)]/30 mx-0.5" />
            <button
              onClick={handleDownload}
              title="Download"
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Download size={13} className="text-[var(--text-tertiary)]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                title="Version History"
                className={`p-1.5 rounded-md transition-colors ${showVersionHistory ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}
              >
                <History size={13} />
              </button>
              <VersionHistory
                versions={activeArtifact?.versions || []}
                currentVersion={activeArtifact?.version || 1}
                onRevert={(vIdx) => revertArtifact(activeArtifactId, vIdx)}
                isOpen={showVersionHistory}
                onClose={() => setShowVersionHistory(false)}
              />
            </div>
            <button
              onClick={handleSaveVersion}
              title="Save Version"
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Save size={13} className="text-[var(--text-tertiary)]" />
            </button>
            <div className="w-px h-4 bg-[var(--border-color)]/30 mx-0.5" />
            <button
              onClick={toggleArtifactFullscreen}
              title={artifactPanelFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {artifactPanelFullscreen
                ? <Minimize2 size={13} className="text-[var(--text-tertiary)]" />
                : <Maximize2 size={13} className="text-[var(--text-tertiary)]" />
              }
            </button>
            <button
              onClick={closeArtifactPanel}
              title="Close"
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <X size={13} className="text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* ─── Tab Bar (Multi-artifact) ─── */}
        {artifacts.length > 1 && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[var(--border-color)]/20 overflow-x-auto no-scrollbar bg-[var(--bg-secondary)]/30">
            {artifacts.map(art => {
              const Icon = TYPE_ICONS[art.type] || Code;
              const isActive = art.id === activeArtifactId;
              return (
                <button
                  key={art.id}
                  onClick={() => setActiveArtifact(art.id)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[var(--text-primary)]/[0.08] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30'
                  }`}
                >
                  <Icon size={11} style={{ color: isActive ? TYPE_COLORS[art.type] : undefined }} />
                  <span className="max-w-[100px] truncate">{art.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArtifact(art.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                  >
                    <X size={9} />
                  </button>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Content Renderer ─── */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeArtifact && (
            <div className="px-4 py-3 border-b border-[var(--border-color)]/20 bg-[var(--bg-secondary)]/20">
              <h1 className="text-[18px] font-bold text-[var(--text-primary)] leading-tight">
                {activeArtifact.title}
              </h1>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
          {activeArtifact?.type === 'code' && (
            <CodeRenderer
              content={displayContent}
              language={activeArtifact.language}
              onContentChange={handleContentChange}
              isDark={isDark}
            />
          )}
          {activeArtifact?.type === 'ui' && (
            <UIRenderer
              content={displayContent}
              onContentChange={handleContentChange}
              isDark={isDark}
            />
          )}
          {activeArtifact?.type === 'document' && (
            <DocumentRenderer
              content={displayContent}
              onContentChange={handleContentChange}
              isDark={isDark}
            />
          )}
          {activeArtifact?.type === 'table' && (
            <TableRenderer
              content={displayContent}
              onContentChange={handleContentChange}
              isDark={isDark}
            />
          )}
          {activeArtifact?.type === 'diagram' && (
            <DiagramRenderer
              content={displayContent}
              onContentChange={handleContentChange}
              isDark={isDark}
            />
          )}
          {streamingArtifact && !artifacts.find(a => a.id === streamingArtifact.id) && (
            <div className="absolute inset-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Building your artifact...</h3>
                <p className="text-sm text-[var(--text-tertiary)] max-w-xs">
                  TutorBoard AI is generating a custom {streamingArtifact.type} model for this explanation.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── AI Edit Bar ── */}
        <div className="border-t border-[var(--border-color)]/30 bg-[var(--bg-secondary)]/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)]/30 px-2.5 py-1.5">
              <Sparkles size={12} className="text-[var(--text-tertiary)] flex-shrink-0" />
              <input
                type="text"
                value={aiEditPrompt}
                onChange={(e) => setAiEditPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAiEdit();
                  }
                }}
                placeholder={activeArtifact?.dbId ? 'Ask AI to modify this artifact...' : 'Save artifact to enable AI editing'}
                disabled={!activeArtifact?.dbId || isAiEditing}
                className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 outline-none disabled:opacity-40"
              />
            </div>
            <button
              onClick={handleAiEdit}
              disabled={!aiEditPrompt.trim() || !activeArtifact?.dbId || isAiEditing}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-80 transition-all disabled:opacity-20 flex-shrink-0"
            >
              {isAiEditing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
};

export default ArtifactPanel;
