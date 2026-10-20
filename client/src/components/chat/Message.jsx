/**
 * Message.jsx — TutorBoard v4.1 (Modular)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Copy, Edit2, Check, RefreshCw, Quote, ChevronLeft, ChevronRight, CornerUpLeft
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
import { buildMarkdownComponents } from './message/MessageMarkdown';
import { extractJsonResponse } from './message/MessageUtils';

// Sub-component for actions
const ActionBtn = ({ onClick, title, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--st-fill-strong,var(--bg-tertiary))] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text-primary)] ${className}`}
  >
    {children}
  </button>
);

const Message = ({
  role, content, messageId, timestamp, status,
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
  onUndoMessage,
  isLatest = false,
}) => {
  const isAssistant = role === 'assistant';
  const { isMobile } = useWindowSize();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(metadata?.feedback || null);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const editRef = useRef(null);

  // #21: Sync feedback state with props
  useEffect(() => {
    setFeedback(metadata?.feedback || null);
  }, [metadata?.feedback]);

  // Hover broadcasting
  const handleMouseEnter = () => onHover?.(messageId);
  const handleMouseLeave = () => onHover?.(null);

  const isThisStreaming = isSessionActive && streamingMessageId === messageId;
  const isCurrentlyStreaming = isStreaming && isThisStreaming;

  const rawContent = isStreaming ? streamingContent : content;
  const { content: displayContent, artifact: extractedArtifact, canvasType: extractedCanvasType, title: extractedTitle } = React.useMemo(
    () => extractJsonResponse(rawContent),
    [rawContent]
  );

  const baseArtifactData = metadata?.artifactData || extractedArtifact || metadata?.visuals;
  const artifactData = baseArtifactData || (hasCanvas ? { steps, canvasSnapshot, type: canvasType } : null);
  const finalTitle = extractedTitle || artifactData?.title || metadata?.artifactTitle || canvasSnapshot?.title || metadata?.canvasSnapshot?.title || metadata?.stepTitle || metadata?.title || 'Interactive Lesson';
  // an Engine v2 lesson is always shown as one, whatever the answer text suggests
  const finalRendererType = metadata?.rendererType === 'scene-v2' ? 'scene-v2'
    : extractedCanvasType || artifactData?.rendererType || artifactData?.type || metadata?.rendererType || canvasType || 'cinematic';
  const isBeingRegenerated = isSessionActive && streamingMessageId === messageId;
  const showLocalIndicator = isBeingRegenerated && (!isStreaming || !displayContent);

  const formatTime = (ts) => {
    try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent || content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: nothing to confirm */ }
  };

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setShowConfirmCancel(false);
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
  const messageIdRef = useRef(messageId);
  React.useEffect(() => {
    onOpenArtifactRef.current = onOpenArtifact;
    messageIdRef.current = messageId;
  }, [onOpenArtifact, messageId]);
  // Stable reference — components are only created once per component lifecycle
  const markdownComponents = React.useMemo(
    // Code opened from this answer remembers which message it came from (for saving its walkthrough).
    // eslint-disable-next-line react-hooks/refs
    () => buildMarkdownComponents((code, lang, opts) => onOpenArtifactRef.current?.(code, lang, { ...opts, messageId: messageIdRef.current })),
    []  
  );

  // Hide empty assistant messages that have errors (handled by global ErrorCard)
  if (isAssistant && !displayContent && metadata?.error) return null;

  return (
    <div 
      data-message-id={messageId} 
      className={`flex w-full flex-col ${isAssistant ? 'items-start pb-3' : 'items-end pt-3 pb-1'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`relative group min-w-0 ${isAssistant ? 'w-full' : 'max-w-[85%]'}`}>
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
                className="w-full rounded-2xl overflow-hidden border transition-all duration-200 focus-within:border-[var(--text-primary)] focus-within:ring-1 focus-within:ring-[var(--text-primary)]"
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
                      if (editContent !== content) {
                        setShowConfirmCancel(true);
                      } else {
                        setIsEditing(false);
                      }
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
                      if (editContent !== content) {
                        setShowConfirmCancel(true);
                      } else {
                        setIsEditing(false);
                      }
                    }}
                    style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  >
                    Cancel
                  </button>
                  {showConfirmCancel && (
                    <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                      <span className="text-xs text-red-500 font-medium">Discard?</span>
                      <button onClick={() => { setIsEditing(false); setShowConfirmCancel(false); }} className="text-xs text-red-500 font-medium hover:underline">Yes</button>
                      <button onClick={() => setShowConfirmCancel(false)} className="text-xs text-[var(--text-tertiary)] font-medium hover:underline">No</button>
                    </div>
                  )}
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
            <div key="view" className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end'} w-full`}>

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
                className="relative min-w-0 max-w-full break-words"
                style={isAssistant ? {
                  color: 'var(--text-primary)',
                  padding: '2px 0 4px',
                } : {
                  // The learner's turn: quietly tinted, not an inverted slab
                  background: 'var(--st-fill-strong, var(--bg-tertiary))',
                  color: 'var(--text-primary)',
                  borderRadius: 18,
                  padding: '10px 15px',
                }}
              >
                {isAssistant ? (
                    <div className={`markdown-content ${isStreaming ? 'streaming-cursor' : ''}`} style={{ position: 'relative' }}>
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
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={markdownComponents}
                        >
                          {displayContent || ''}
                        </ReactMarkdown>
                      )}
                      {/* An unfinished answer is labelled as such, never shown as complete */}
                      {!isStreaming && (status === 'cancelled' || status === 'failed' || metadata?.aborted) && (
                        <p
                          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px]"
                          style={{ color: 'var(--text-tertiary)' }}
                          role="note"
                        >
                          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: status === 'failed' ? '#ef4444' : 'var(--text-tertiary)' }} />
                          {status === 'failed' ? 'Answer incomplete — generation failed.' : 'Stopped before the answer finished.'}
                        </p>
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
                              style={{ borderLeft: '2px solid var(--st-line-strong, currentColor)', paddingLeft: 12, color: 'var(--text-secondary)' }}
                            >
                              <div className="flex items-center gap-2 mb-1 opacity-80">
                                <Quote size={10} className="fill-current" />
                                <span className="text-xs font-medium">Context</span>
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
                                  className="mt-2 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity block text-left"
                                >
                                  {isContextExpanded ? 'Collapse' : 'Read more...'}
                                </button>
                              )}
                            </div>
                            <p 
                              className="text-[15px] leading-relaxed"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {question}
                            </p>
                          </>
                        );
                      }

                      return (
                        <p
                          style={{
                            color: 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            lineHeight: 1.6,
                            fontSize: 15,
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
                          marginTop: 6, fontSize: 12.5, fontWeight: 500,
                          color: 'var(--text-secondary)',
                          background: 'none', border: 'none', cursor: 'pointer', 
                          padding: 0, textAlign: 'left', display: 'block', width: 'fit-content'
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Read more...'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Consolidated Visual Artifact Portal (Progressive & Final) */}
              {isAssistant && (metadata?.artifactId || metadata?.hasVisualArtifact || metadata?.visuals || artifactData || hasCanvas) && (
                <VisualArtifactCard
                  artifactId={metadata?.artifactId || messageId}
                  artifactData={artifactData}
                  title={finalTitle}
                  rendererType={finalRendererType}
                  status={metadata?.artifactStatus || (isStreaming ? 'generating' : 'completed')}
                  onOpenCanvas={onOpenCanvas}
                  messageId={messageId}
                />
              )}

              {/* Action Row */}
              <div
                className={`flex items-center select-none transition-opacity duration-150 ${isMobile ? 'flex-wrap' : 'flex-nowrap'} ${
                  isMobile || (isLatest && isAssistant) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                }`}
                style={{
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginLeft: isAssistant ? 0 : 'auto',
                  flexDirection: isAssistant ? 'row' : 'row-reverse',
                  gap: 2,
                  marginTop: 2,
                  minHeight: 32,
                }}
              >
                {!isEditing && !isStreaming && !isBeingRegenerated && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    {/* User actions: Undo, Edit (Primary), Copy */}
                    {!isAssistant && (
                      <>
                        {onUndoMessage && (
                          <ActionBtn onClick={() => onUndoMessage(messageId, content)} title="Undo message" isMobile={isMobile}>
                            <CornerUpLeft size={14} strokeWidth={2.2} />
                          </ActionBtn>
                        )}
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
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${metadata.activeVersionIndex === 0 ? 'opacity-30 cursor-default' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong,var(--bg-tertiary))]'}`}
                      aria-label="Previous version"
                    >
                      <ChevronLeft size={14} strokeWidth={2.2} />
                    </button>
                    
                    <span 
                      className="text-[11.5px] font-medium tabular-nums text-[var(--text-tertiary)] px-0.5"
                      aria-label={`Version ${metadata.activeVersionIndex + 1} of ${metadata.versions.length}`}
                    >
                      {metadata.activeVersionIndex + 1}<span className="mx-0.5 opacity-30">/</span>{metadata.versions.length}
                    </span>
                    
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${metadata.activeVersionIndex === metadata.versions.length - 1 ? 'opacity-30 cursor-default' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong,var(--bg-tertiary))]'}`}
                      aria-label="Next version"
                    >
                      <ChevronRight size={14} strokeWidth={2.2} />
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
    prev.status === next.status &&
    prev.isLatest === next.isLatest &&
    prev.metadata?.aborted === next.metadata?.aborted &&
    prev.metadata?.error === next.metadata?.error &&
    prev.metadata?.activeVersionIndex === next.metadata?.activeVersionIndex &&
    prev.metadata?.feedback === next.metadata?.feedback &&
    prev.metadata?.edited === next.metadata?.edited &&
    prev.metadata?.sources?.length === next.metadata?.sources?.length &&
    prev.metadata?.versions?.length === next.metadata?.versions?.length
  );
});
