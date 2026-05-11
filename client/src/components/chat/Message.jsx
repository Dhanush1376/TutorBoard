/**
 * Message.jsx — TutorBoard v4.1 (Modular)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Copy, Edit2, Check, RefreshCw, Quote, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import useTutorStore from '../../store/tutorStore';
import VisualArtifactCard from './VisualArtifactCard';
import useWindowSize from '../../hooks/useWindowSize';
import SourceGrid from './message/SourceGrid';
import CanvasCard from './message/CanvasCard';
import { buildMarkdownComponents } from './message/MessageMarkdown';
import { extractJsonResponse } from './message/MessageUtils';

// Sub-component for actions
const ActionBtn = ({ onClick, title, children, className = '', isMobile = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`apple-pill p-1 min-w-[28px] min-h-[28px] transition-all hover:bg-[var(--bg-tertiary)] hover:opacity-100 ${className}`}
    style={{
      color: 'var(--text-tertiary)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 0,
      opacity: isMobile ? 0.7 : 0.5,
    }}
  >
    {children}
  </button>
);

const Message = ({
  role, content, messageId, timestamp,
  isStreaming, streamingContent, streamingThought,
  streamingSources,
  isSearchPerformed: streamingSearchPerformed,
  onEditMessage, onDeleteMessage, onRegenerateMessage, onFeedback,
  onOpenCanvas, hasCanvas, canvasType,
  metadata, onSwitchVersion,
  onOpenArtifact,
  steps,
  canvasSnapshot,
  isSessionActive,
  streamingMessageId,
  onHover,
}) => {
  const isAssistant = role === 'assistant';
  const { isMobile } = useWindowSize();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(metadata?.feedback || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const editRef = useRef(null);

  // Hover broadcasting
  const handleMouseEnter = () => onHover?.(messageId);
  const handleMouseLeave = () => onHover?.(null);

  const isThisStreaming = isSessionActive && streamingMessageId === messageId;
  const isCurrentlyStreaming = isStreaming && isThisStreaming;

  const rawContent = isStreaming ? streamingContent : content;
  const { content: displayContent, artifact: extractedArtifact } = React.useMemo(
    () => extractJsonResponse(rawContent),
    [rawContent]
  );

  const artifactData = metadata?.artifactData || extractedArtifact;
  const isBeingRegenerated = isSessionActive && streamingMessageId === messageId;
  const showLocalIndicator = isBeingRegenerated && (!isStreaming || !displayContent);

  const formatTime = (ts) => {
    try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) onEditMessage?.(messageId, editContent.trim());
    setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing && editRef.current) {
      requestAnimationFrame(() => {
        if (!editRef.current) return;
        editRef.current.style.height = 'auto';
        editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 300)}px`;
      });
    }
  }, [isEditing, editContent]);

  // P-5 FIX: Use a ref to keep onOpenArtifact current without recreating markdown components.
  // Although useMemo with [] technically works, this ref pattern is safer against 
  // future refactors that might add dependencies to buildMarkdownComponents.
  const onOpenArtifactRef = useRef(onOpenArtifact);
  onOpenArtifactRef.current = onOpenArtifact;

  // Stable reference — components are only created once per component lifecycle
  const markdownComponents = React.useMemo(
    () => buildMarkdownComponents((...args) => onOpenArtifactRef.current?.(...args)),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div 
      data-message-id={messageId} 
      className={`w-full py-0.5 flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`relative group min-w-0 ${isAssistant ? 'max-w-[96%] w-full' : 'max-w-[82%]'}`}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div
                className="w-full rounded-2xl overflow-hidden border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                    else if (e.key === 'Escape') {
                      setEditContent(content); // Bug 3.3 Fix: reset content on escape
                      setIsEditing(false);
                    }
                  }}
                  style={{
                    width: '100%', background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 13.5, lineHeight: 1.65, padding: '12px 16px', outline: 'none',
                    resize: 'none', border: 'none', fontFamily: 'inherit',
                  }}
                  rows={2}
                />
                <div className="flex items-center justify-end gap-1.5 px-3 pb-2.5">
                  <button
                    onClick={() => {
                      setEditContent(content); // Bug 3.3 Fix: reset content on cancel
                      setIsEditing(false);
                    }}
                    style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || editContent === content}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', fontSize: 11, fontWeight: 500,
                      background: 'var(--text-primary)', color: 'var(--bg-primary)',
                      border: 'none', cursor: 'pointer', borderRadius: 8, opacity: (!editContent.trim() || editContent === content) ? 0.3 : 1,
                    }}
                  >
                    <Check size={10} /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end'} w-full`}>

              {/* Web sources */}
              {isAssistant && (metadata?.sources || streamingSources || metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)) && (
                <SourceGrid
                  sources={metadata?.sources || streamingSources}
                  searchPerformed={metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)}
                />
              )}

              {/* Message bubble */}
              <motion.div
                key="bubble"
                initial={isStreaming ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={isStreaming ? { duration: 0 } : { duration: 0.2 }}
                className="relative min-w-0 max-w-full break-words overflow-hidden transition-all duration-300 shadow-premium"
                style={isAssistant ? {
                  color: 'var(--text-primary)',
                  padding: '4px 0 6px 0',
                  background: 'transparent',
                  border: 'none',
                } : {
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)', 
                  borderRadius: '24px 24px 4px 24px',
                  padding: '14px 20px',
                  border: '1px solid rgba(var(--text-primary-rgb), 0.1)',
                }}
              >
                {isAssistant ? (
                  <div className="markdown-content" style={{ position: 'relative' }}>
                    {showLocalIndicator ? (
                      <div className="flex items-center gap-[4px] py-2 px-1 opacity-60">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.3, 1, 0.3]
                            }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              delay: i * 0.2,
                              ease: 'easeInOut',
                            }}
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: 'var(--text-tertiary)',
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={isStreaming ? 'streaming-cursor' : ''}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={markdownComponents}
                        >
                          {displayContent || ''}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {(() => {
                      const contextMatch = displayContent?.match(/^Context: "([\s\S]*?)"\n\nQuestion: ([\s\S]*)$/);

                      if (contextMatch) {
                        const [, context, question] = contextMatch;
                        return (
                          <>
                            <div
                              className="py-1.5 mb-2 mt-1"
                              style={{ borderLeft: '4px solid currentColor', paddingLeft: 18, opacity: 0.6 }}
                            >
                              <div className="flex items-center gap-2 mb-1 opacity-80">
                                <Quote size={10} className="fill-current" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Context</span>
                              </div>
                              <p
                                className="text-[13px] leading-relaxed italic font-normal"
                                style={{
                                  color: 'inherit',
                                  opacity: 1,
                                  display: isContextExpanded ? 'block' : '-webkit-box',
                                  WebkitLineClamp: isContextExpanded ? 'none' : 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: isContextExpanded ? 'visible' : 'hidden',
                                }}
                              >
                                "{context}"
                              </p>
                              {context.length > 100 && (
                                <button
                                  onClick={() => setIsContextExpanded(!isContextExpanded)}
                                  className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity block text-left"
                                >
                                  {isContextExpanded ? 'Collapse' : 'READ MORE ...'}
                                </button>
                              )}
                            </div>
                            <p 
                              className="text-[14px] leading-relaxed font-medium px-1"
                              style={{ color: 'var(--bg-primary)', opacity: 1 }}
                            >
                              {question}
                            </p>
                          </>
                        );
                      }

                      return (
                        <p
                          style={{
                            color: 'var(--bg-primary)',
                            opacity: 1,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                            fontSize: 14,
                            margin: 0,
                            display: !isExpanded && displayContent?.length > 400 ? '-webkit-box' : 'block',
                            WebkitLineClamp: !isExpanded && displayContent?.length > 400 ? 8 : undefined,
                            WebkitBoxOrient: !isExpanded && displayContent?.length > 400 ? 'vertical' : undefined,
                            overflow: !isExpanded && displayContent?.length > 400 ? 'hidden' : 'visible',
                          }}
                        >
                          {displayContent}
                        </p>
                      );
                    })()}

                    {displayContent?.length > 400 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ 
                          marginTop: 6, fontSize: 11, fontWeight: 700, 
                          textTransform: 'uppercase', letterSpacing: '0.08em', 
                          opacity: 0.8, color: 'var(--bg-primary)', 
                          background: 'none', border: 'none', cursor: 'pointer', 
                          padding: 0, textAlign: 'left', display: 'block', width: 'fit-content'
                        }}
                      >
                        {isExpanded ? 'Show less' : 'READ MORE ...'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Visual Artifact Card (Progressive & Final) */}
              {isAssistant && (metadata?.artifactId || metadata?.hasVisualArtifact || artifactData) && (
                <VisualArtifactCard
                  artifactId={metadata?.artifactId}
                  artifactData={artifactData}
                  title={artifactData?.title || metadata?.artifactTitle}
                  rendererType={artifactData?.rendererType || artifactData?.type || metadata?.rendererType}
                  status={metadata?.artifactStatus || (isStreaming ? 'generating' : 'completed')}
                />
              )}

              {/* Canvas card */}
              {isAssistant && hasCanvas && !isStreaming && !metadata?.artifactId && (
                <CanvasCard
                  onOpenCanvas={onOpenCanvas}
                  messageId={messageId}
                  canvasType={canvasType}
                  stepCount={steps?.length}
                  title={canvasSnapshot?.title || metadata?.canvasSnapshot?.title}
                />
              )}

              {/* Action Row */}
              <div
                className={`flex items-center select-none ${isMobile ? 'flex-wrap' : 'flex-nowrap'}`}
                style={{
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginTop: 0,
                  marginLeft: isAssistant ? 0 : 'auto',
                  flexDirection: isAssistant ? 'row' : 'row-reverse',
                  gap: isMobile ? 1.5 : 2,
                  minHeight: 22,
                }}
              >
                {!isEditing && !isStreaming && !isBeingRegenerated && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    {/* User actions: Edit (Primary), Copy */}
                    {!isAssistant && (
                      <>
                        {onEditMessage && (
                          <ActionBtn onClick={handleStartEdit} title="Edit message" isMobile={isMobile}>
                            <Edit2 size={14} strokeWidth={2} />
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={handleCopy} title="Copy message" isMobile={isMobile}>
                          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} strokeWidth={2} />}
                        </ActionBtn>
                      </>
                    )}

                    {/* Assistant actions: Regenerate (Primary), Copy, Insight */}
                    {isAssistant && (
                      <>
                        {onRegenerateMessage && (
                          <ActionBtn onClick={() => onRegenerateMessage(messageId)} title="Regenerate response" isMobile={isMobile}>
                            <RefreshCw size={14} strokeWidth={2} />
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={handleCopy} title="Copy response" isMobile={isMobile}>
                          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} strokeWidth={2} />}
                        </ActionBtn>
                      </>
                    )}
                  </div>
                )}

                {/* Version navigator - Enhanced Pill Design */}
                {metadata?.versions?.length > 1 && !isStreaming && !isBeingRegenerated && (
                  <div className="flex items-center gap-0 ml-1 group/versions">
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.max(0, metadata.activeVersionIndex - 1))}
                      disabled={metadata.activeVersionIndex === 0}
                      className={`w-4 h-4 flex items-center justify-center rounded-md transition-all ${metadata.activeVersionIndex === 0 ? 'opacity-0 pointer-events-none' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 active:scale-90'}`}
                      aria-label="Previous version"
                    >
                      <ChevronLeft size={10} strokeWidth={3} />
                    </button>
                    
                    <span 
                      className="text-[9px] font-bold tabular-nums text-[var(--text-tertiary)] px-1 opacity-40 group-hover/versions:opacity-100 transition-opacity"
                      aria-label={`Version ${metadata.activeVersionIndex + 1} of ${metadata.versions.length}`}
                    >
                      {metadata.activeVersionIndex + 1}<span className="mx-0.5 opacity-30">/</span>{metadata.versions.length}
                    </span>
                    
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      className={`w-4 h-4 flex items-center justify-center rounded-md transition-all ${metadata.activeVersionIndex === metadata.versions.length - 1 ? 'opacity-0 pointer-events-none' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 active:scale-90'}`}
                      aria-label="Next version"
                    >
                      <ChevronRight size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}

                {/* Metadata */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-[180ms] ease-out"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', lineHeight: 1 }}
                >
                  <div style={{ opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isAssistant && metadata?.latencyMs && (
                      <span>{(metadata.latencyMs / 1000).toFixed(1)}s</span>
                    )}
                    {isAssistant && metadata?.latencyMs && <span>·</span>}
                    <span>{formatTime(timestamp)}</span>
                    {metadata?.edited && <span>· edited</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// P-2 FIX: Memoize Message to prevent re-renders when parent state changes (e.g. scroll, hover, new messages)
export default React.memo(Message, (prev, next) => {
  // Re-render only when visually relevant props change
  return (
    prev.content === next.content &&
    prev.role === next.role &&
    prev.messageId === next.messageId &&
    prev.isStreaming === next.isStreaming &&
    prev.streamingContent === next.streamingContent &&
    prev.streamingMessageId === next.streamingMessageId &&
    prev.isSessionActive === next.isSessionActive &&
    prev.metadata?.activeVersionIndex === next.metadata?.activeVersionIndex &&
    prev.metadata?.feedback === next.metadata?.feedback &&
    prev.metadata?.edited === next.metadata?.edited &&
    prev.metadata?.sources?.length === next.metadata?.sources?.length
  );
});
