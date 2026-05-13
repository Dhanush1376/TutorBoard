import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Maximize2, Minimize2, Code, Layout, Globe, 
  Terminal, History, Download, Share2, Copy, Check,
  ChevronRight, FileCode, Play, Palette, Database
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Editor from '@monaco-editor/react';

/**
 * ArtifactPanel — The secondary display engine of the AI OS.
 * Handles Code, Diagrams, Previews, and Versions.
 */
const ArtifactPanel = () => {
  const { 
    isArtifactPanelOpen, 
    closeArtifactPanel, 
    artifacts, 
    activeArtifactId, 
    setActiveArtifact,
    artifactPanelFullscreen,
    toggleArtifactFullscreen,
    streamingArtifact
  } = useTutorStore();

  const [showVersions, setShowVersions] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active Artifact derived from state
  const activeArtifact = useMemo(() => {
    if (streamingArtifact) return streamingArtifact;
    return artifacts.find(a => a.id === activeArtifactId);
  }, [artifacts, activeArtifactId, streamingArtifact]);

  if (!isArtifactPanelOpen || !activeArtifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed top-0 right-0 h-full z-[1000] border-l border-white/10 bg-[#0a0a0a]/95 backdrop-blur-3xl shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-500 ${
        artifactPanelFullscreen ? 'w-full' : 'w-[min(900px,95vw)]'
      }`}
    >
      {/* ── Header Area ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/5">
            <Layout size={13} className="text-indigo-400/70" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Artifact</span>
          </div>
          <h2 className="text-[14px] font-medium text-white/80 truncate max-w-[260px]">
            {activeArtifact.title}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-all active:scale-95"
            title="Copy Content"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`p-2 rounded-lg transition-all active:scale-95 ${
              showVersions ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-white/5 text-white/30 hover:text-white/70'
            }`}
            title="Version History"
          >
            <History size={14} />
          </button>
          <div className="w-[1px] h-4 bg-white/5 mx-1" />
          <button
            onClick={toggleArtifactFullscreen}
            className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-all active:scale-95"
          >
            {artifactPanelFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={closeArtifactPanel}
            className="p-2 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400/70 transition-all active:scale-95"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Tabs Area (Multi-artifact support) ── */}
      {artifacts.length > 1 && (
        <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-black/20 border-b border-white/5 overflow-x-auto no-scrollbar">
          {artifacts.map(art => (
            <button
              key={art.id}
              onClick={() => setActiveArtifact(art.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap ${
                activeArtifactId === art.id 
                  ? 'bg-white/5 text-white border border-white/10 shadow-sm' 
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
              }`}
            >
              {art.type === 'code' ? <Code size={14} /> : <Layout size={14} />}
              {art.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Main Content Body ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Artifact Content */}
        <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
          {activeArtifact.type === 'code' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-6 py-2 bg-black/40 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Terminal size={12} className="text-white/30" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    {activeArtifact.language || 'Plain Text'}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={activeArtifact.language || 'javascript'}
                  value={activeArtifact.content}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 20 },
                    fontFamily: 'JetBrains Mono',
                    backgroundColor: 'transparent'
                  }}
                  loading={<div className="flex items-center justify-center h-full text-white/20">Loading code editor...</div>}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20">
              <div className="flex flex-col items-center gap-4">
                <Layout size={48} strokeWidth={1} />
                <p className="text-[13px] font-medium">Renderer for {activeArtifact.type} coming soon</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Version History Sidebar ── */}
        <AnimatePresence>
          {showVersions && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 bg-[#0a0a0a] border-l border-white/5 flex flex-col overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/60">Version History</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(activeArtifact.versions || []).slice().reverse().map((v, i) => (
                  <button
                    key={i}
                    className={`w-full text-left p-4 rounded-2xl transition-all border ${
                      activeArtifact.version === v.version
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-100'
                        : 'bg-white/2 border-white/5 hover:bg-white/5 text-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold">Version {v.version}</span>
                      <span className="text-[10px] opacity-40">{new Date(v.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] truncate opacity-60">
                      {v.content.substring(0, 50)}...
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-5 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-white/20 text-[9px] font-medium tracking-wide">
          <div className="flex items-center gap-1.5">
            <Database size={10} />
            <span>ID: {activeArtifact.id.split('-').pop()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Terminal size={10} />
            <span>{activeArtifact.content.split('\n').length} lines</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 text-[10px] font-semibold transition-all">
            Download
          </button>
          <button className="px-3 py-1 rounded-lg bg-indigo-500/80 text-white text-[10px] font-semibold transition-all shadow-lg shadow-indigo-500/10 active:scale-95">
            Share
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ArtifactPanel;