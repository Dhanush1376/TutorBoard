/**
 * Message.jsx — TutorBoard v4.1 (Modular)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Copy, Edit2, Check, RefreshCw, Quote, ChevronLeft, ChevronRight, Undo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import useTutorStore from '../../store/tutorStore';
import VisualArtifactCard from './VisualArtifactCard';
import ThoughtLine from './ThoughtLine';
import useWindowSize from '../../hooks/useWindowSize';
import SourceGrid from './message/SourceGrid';
import { buildMarkdownComponents } from './message/MessageMarkdown';
import { extractJsonResponse, formatConciseTopic, isGenericTitle, formatShortAction, DEFAULT_AGENT_STEPS, detectCurrentAction } from './message/MessageUtils';

// Sub-component for actions
const ActionBtn = ({ onClick, title, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--st-fill-strong,var(--bg-tertiary))] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text-primary)] active:scale-90 ${className}`}
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

  const conversationTopic = useTutorStore((s) => s.conversationTopic);
  const activeSceneTitle = useTutorStore((s) => s.activeScene?.title);

  const firstHeading = React.useMemo(() => {
    const raw = displayContent || content || '';
    if (!raw) return null;
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0].replace(/^[#*\s_>]+/, '').trim();
    return first.length > 0 && first.length < 120 ? first : null;
  }, [displayContent, content]);

  const rawCandidateTitle = 
    (!isGenericTitle(extractedTitle) && extractedTitle) || 
    (!isGenericTitle(artifactData?.title) && artifactData?.title) || 
    (!isGenericTitle(metadata?.artifactTitle) && metadata?.artifactTitle) || 
    (!isGenericTitle(canvasSnapshot?.title) && canvasSnapshot?.title) || 
    (!isGenericTitle(metadata?.canvasSnapshot?.title) && metadata?.canvasSnapshot?.title) || 
    (!isGenericTitle(metadata?.stepTitle) && metadata?.stepTitle) || 
    (!isGenericTitle(metadata?.topic) && metadata?.topic) || 
    (!isGenericTitle(metadata?.title) && metadata?.title) || 
    (!isGenericTitle(activeSceneTitle) && activeSceneTitle) || 
    (!isGenericTitle(firstHeading) && firstHeading) || 
    (!isGenericTitle(conversationTopic) && conversationTopic) ||
    'Visual Concept';

  const finalTitle = formatConciseTopic(rawCandidateTitle);
  // an Engine v2 lesson is always shown as one, whatever the answer text suggests
  const finalRendererType = metadata?.rendererType === 'scene-v2' ? 'scene-v2'
    : extractedCanvasType || artifactData?.rendererType || artifactData?.type || metadata?.rendererType || canvasType || 'cinematic';
  const isBeingRegenerated = isSessionActive && streamingMessageId === messageId;
  const showLocalIndicator = isBeingRegenerated && (!isStreaming || !displayContent);
  const generationProgress = useTutorStore((s) => s.generationProgress);

  const hasVisualArtifact = isAssistant && (metadata?.artifactId || metadata?.hasVisualArtifact || metadata?.visuals || artifactData || hasCanvas);

  // Split markdown content so VisualArtifactCard appears after the entire chat and above "Want to go deeper?"
  const { mainContent, deeperContent } = React.useMemo(() => {
    if (!displayContent || !isAssistant) {
      return { mainContent: displayContent || '', deeperContent: null };
    }

    const pattern = /(?:\n+(?:---|\*\*\*|___)?\s*\n+)?((?:#{1,4}\s*)?\*{0,2}Want to go deeper\??\*{0,2}[\s\S]*)$/i;
    const match = displayContent.match(pattern);
    if (match) {
      const main = displayContent.substring(0, match.index).trimEnd();
      const deeper = match[1].trim();
      return { mainContent: main, deeperContent: deeper };
    }

    return { mainContent: displayContent, deeperContent: null };
  }, [displayContent, isAssistant]);

  const thinkingLabel = React.useMemo(() => {
    return detectCurrentAction({
      displayContent,
      isStreaming: isCurrentlyStreaming,
      searchPerformed: Boolean(streamingSearchPerformed || metadata?.searchPerformed),
      hasVisualArtifact: Boolean(hasVisualArtifact),
      generationProgress,
    });
  }, [generationProgress, streamingSearchPerformed, metadata?.searchPerformed, isCurrentlyStreaming, displayContent, hasVisualArtifact]);

  const thoughtSteps = React.useMemo(() => {
    if (steps && Array.isArray(steps) && steps.length > 0) {
      return steps.map(s => formatShortAction(typeof s === 'string' ? s : s.title || s.text || String(s)));
    }
    const list = [
      'Analyzing problem',
      'Planning canvas',
      'Solving logic',
      'Generating visual',
      'Animating steps',
      'Writing response',
      'Refining formulas',
      'Polishing answer',
      'Finalizing'
    ];
    if (metadata?.searchPerformed || streamingSearchPerformed || streamingSources?.length > 0 || metadata?.sources?.length > 0) {
      list.splice(1, 0, 'Searching web');
    }
    return list;
  }, [steps, metadata, streamingSearchPerformed, streamingSources]);

  // ThoughtLine: strictly visible while generating, disappears completely afterwards
  const isGeneratingThisMessage = isAssistant && (
    isCurrentlyStreaming ||
    showLocalIndicator ||
    (isLatest && isSessionActive && isStreaming && !displayContent)
  );
  const showThoughtLine = isGeneratingThisMessage;

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

  const adjustTextareaHeight = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.max(52, Math.min(el.scrollHeight, 380));
    el.style.height = `${newHeight}px`;
    el.scrollTop = 0;
  }, []);

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setShowConfirmCancel(false);
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      const el = editRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollTop = 0;
      }
    });
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) onEditMessage?.(messageId, editContent.trim());
    setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing, editContent, adjustTextareaHeight]);

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
      className={`flex w-full flex-col ${isAssistant ? 'items-start pt-1 pb-1.5' : 'items-end self-end ml-auto pt-1 pb-1'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`relative group min-w-0 ${isAssistant ? 'w-full' : 'max-w-[85%] self-end ml-auto'}`}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <div
                className="w-full overflow-hidden transition-all duration-200"
                style={{
                  background: 'var(--user-bubble-bg, var(--bg-tertiary))',
                  color: 'var(--user-bubble-text, var(--text-primary))',
                  borderRadius: '22px 22px 4px 22px',
                  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                }}
              >
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    adjustTextareaHeight();
                  }}
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
                    width: '100%',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 15,
                    lineHeight: 1.6,
                    padding: '14px 18px 8px',
                    outline: 'none',
                    resize: 'none',
                    border: 'none',
                    fontFamily: 'inherit',
                    overflowY: 'hidden',
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                  rows={Math.max(1, (editContent || '').split('\n').length)}
                  placeholder="Edit your message…"
                />
                <div className="flex items-center justify-end gap-2 px-3 pb-2.5 pt-1">
                  <div className="flex items-center gap-2 ml-auto">
                    {showConfirmCancel ? (
                      <div className="flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/25">
                        <span className="text-[11px] text-red-500 font-medium">Discard?</span>
                        <button
                          type="button"
                          onClick={() => { setIsEditing(false); setShowConfirmCancel(false); }}
                          className="text-[11px] text-red-500 font-semibold hover:underline"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmCancel(false)}
                          className="text-[11px] font-medium hover:underline"
                          style={{ color: 'inherit', opacity: 0.8 }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (editContent !== content) {
                            setShowConfirmCancel(true);
                          } else {
                            setIsEditing(false);
                          }
                        }}
                        className="rounded-full px-3.5 py-1 text-[12px] font-medium transition-all border border-[var(--user-bubble-text)]/25 hover:border-[var(--user-bubble-text)]/50 hover:bg-[var(--user-bubble-text)]/10 active:scale-95"
                        style={{ color: 'var(--user-bubble-text, var(--text-primary))' }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={!editContent.trim() || editContent === content}
                      className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[12px] font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: 'var(--user-bubble-text, var(--text-primary))',
                        color: 'var(--user-bubble-bg, var(--bg-primary))',
                      }}
                    >
                      <Check size={11} strokeWidth={2.6} /> Save
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div key="view" className={`flex flex-col gap-0 ${isAssistant ? 'items-start' : 'items-end self-end ml-auto'} w-full`}>

              {/* Web sources */}
              {isAssistant && (metadata?.sources || streamingSources || metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)) && (
                <SourceGrid
                  sources={metadata?.sources || streamingSources}
                  searchPerformed={metadata?.searchPerformed || (isStreaming && streamingSearchPerformed)}
                />
              )}

              {/* ThoughtLine — strictly visible while generating; disappears completely afterwards */}
              <AnimatePresence>
                {showThoughtLine && (
                  <motion.div
                    key="active-thought-line"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="py-1 overflow-hidden"
                  >
                    <ThoughtLine
                      working={true}
                      steps={thoughtSteps}
                      label={thinkingLabel}
                      glyph="matrix"
                      fontSize={14}
                      collapsible
                      showTimer
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Message bubble */}
              {(!isAssistant || displayContent || hasVisualArtifact) && (
                <motion.div
                  key="bubble"
                  initial={isStreaming ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={isStreaming ? { duration: 0 } : { duration: 0.2 }}
                  className={`relative min-w-0 max-w-full break-words ${
                    isAssistant ? 'self-start w-full' : 'self-end ml-auto rounded-[22px] rounded-br-[4px]'
                  }`}
                  style={isAssistant ? {
                    color: 'var(--text-primary)',
                    padding: '2px 0 4px',
                  } : {
                    background: 'var(--user-bubble-bg, var(--bg-tertiary))',
                    color: 'var(--user-bubble-text, var(--text-primary))',
                    borderRadius: '22px 22px 4px 22px',
                    padding: '10px 18px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {isAssistant ? (
                    <div className={`markdown-content ${isStreaming ? 'streaming-cursor' : ''}`} style={{ position: 'relative' }}>
                      {/* 1. Main Chat Content (The Entire Chat Explanation) */}
                      {mainContent ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={markdownComponents}
                        >
                          {mainContent}
                        </ReactMarkdown>
                      ) : null}

                      {/* 2. Visual Artifact Card — Placed AFTER the entire chat and ABOVE "Want to go deeper?" */}
                      {hasVisualArtifact && (
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

                      {/* 3. "Want to go deeper?" Section (Rendered below the artifact card) */}
                      {deeperContent && (
                        <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={markdownComponents}
                          >
                            {deeperContent}
                          </ReactMarkdown>
                        </div>
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
                                style={{ color: 'var(--user-bubble-text, var(--text-primary))' }}
                              >
                                {question}
                              </p>
                            </>
                          );
                        }

                        return (
                          <p
                            style={{
                              color: 'var(--user-bubble-text, var(--text-primary))',
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
              )}

              {/* Action Row */}
              <div
                className={`flex items-center select-none ${isMobile ? 'flex-wrap' : 'flex-nowrap'} ${
                  isAssistant ? 'self-start' : 'self-end ml-auto'
                }`}
                style={{
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginLeft: isAssistant ? 0 : 'auto',
                  flexDirection: isAssistant ? 'row' : 'row-reverse',
                  gap: 2,
                  marginTop: 2,
                  minHeight: 26,
                }}
              >
                {!isEditing && !isStreaming && !isBeingRegenerated && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    {/* User actions: Undo, Edit (Primary), Copy */}
                    {!isAssistant && (
                      <>
                        {onUndoMessage && (
                          <ActionBtn onClick={() => onUndoMessage(messageId, content)} title="Undo message" isMobile={isMobile}>
                            <Undo2 size={12} strokeWidth={1.8} />
                          </ActionBtn>
                        )}
                        {onEditMessage && (
                          <ActionBtn onClick={handleStartEdit} title="Edit message" isMobile={isMobile}>
                            <Edit2 size={12} strokeWidth={1.8} />
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={handleCopy} title="Copy message" isMobile={isMobile}>
                          {copied ? <Check size={12} strokeWidth={2.2} style={{ color: '#10b981' }} /> : <Copy size={12} strokeWidth={1.8} />}
                        </ActionBtn>
                      </>
                    )}

                    {/* Assistant actions: Regenerate (Primary), Copy, Insight */}
                    {isAssistant && (
                      <>
                        {onRegenerateMessage && (
                          <ActionBtn onClick={() => onRegenerateMessage(messageId)} title="Regenerate response" isMobile={isMobile}>
                            <RefreshCw size={12} strokeWidth={1.8} />
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={handleCopy} title="Copy response" isMobile={isMobile}>
                          {copied ? <Check size={12} strokeWidth={2.2} style={{ color: '#10b981' }} /> : <Copy size={12} strokeWidth={1.8} />}
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
                      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${metadata.activeVersionIndex === 0 ? 'opacity-30 cursor-default' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong,var(--bg-tertiary))]'}`}
                      aria-label="Previous version"
                    >
                      <ChevronLeft size={12} strokeWidth={2} />
                    </button>
                    
                    <span 
                      className="text-[11px] font-medium tabular-nums text-[var(--text-tertiary)] px-0.5"
                      aria-label={`Version ${metadata.activeVersionIndex + 1} of ${metadata.versions.length}`}
                    >
                      {metadata.activeVersionIndex + 1}<span className="mx-0.5 opacity-30">/</span>{metadata.versions.length}
                    </span>
                    
                    <button
                      onClick={() => onSwitchVersion?.(messageId, Math.min(metadata.versions.length - 1, metadata.activeVersionIndex + 1))}
                      disabled={metadata.activeVersionIndex === metadata.versions.length - 1}
                      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${metadata.activeVersionIndex === metadata.versions.length - 1 ? 'opacity-30 cursor-default' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong,var(--bg-tertiary))]'}`}
                      aria-label="Next version"
                    >
                      <ChevronRight size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}

                {/* Metadata */}
                <div
                  className={`${isMobile ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 ease-out pointer-events-none px-1`}
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
