import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlighter, StickyNote, MessageSquareQuote, Eraser } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useTutorStore from '../../store/tutorStore';
import useAnnotationStore from '../../store/annotationStore';

/*
 * Select text in a chat answer and a small bar appears:
 *   Highlight — marks it (kept with the session)
 *   Note      — pins it to the canvas as a sticky note
 *   Ask       — asks a follow-up about it
 *
 * Highlights use the CSS Custom Highlight API, so the message markup is
 * never rewritten; they are found again by their text after every render.
 */

const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,pre,blockquote,td,th,div';
const supportsHighlights = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof window !== 'undefined' && 'Highlight' in window;

/** Finds `quote` inside `scope`, ignoring whitespace differences, and returns a Range. */
function findQuote(scope, quote) {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let text = '';
  const map = [];
  let prevSpace = true;
  let prevBlock = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const block = n.parentElement?.closest(BLOCKS);
    if (prevBlock && block !== prevBlock && !prevSpace) {
      text += ' ';
      map.push(null);
      prevSpace = true;
    }
    prevBlock = block;
    const t = n.nodeValue;
    for (let i = 0; i < t.length; i++) {
      if (/\s/.test(t[i])) {
        if (prevSpace) continue;
        text += ' ';
        prevSpace = true;
      } else {
        text += t[i].toLowerCase();
        prevSpace = false;
      }
      map.push([n, i]);
    }
  }
  const q = quote.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return null;
  const at = text.indexOf(q);
  if (at < 0) return null;
  let s = at;
  while (s < at + q.length && !map[s]) s++;
  let e = at + q.length - 1;
  while (e > s && !map[e]) e--;
  if (!map[s] || !map[e]) return null;
  const range = document.createRange();
  range.setStart(map[s][0], map[s][1]);
  range.setEnd(map[e][0], map[e][1] + 1);
  return range;
}

function overlaps(a, b) {
  return a.compareBoundaryPoints(Range.END_TO_START, b) < 0 && a.compareBoundaryPoints(Range.START_TO_END, b) > 0;
}

function Btn({ icon: Icon, label, onClick, accent }) {
  return (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors hover:bg-white/10 dark:hover:bg-black/10"
  >
    <Icon size={15} strokeWidth={1.9} style={accent ? { color: 'var(--mk-accent)' } : undefined} />
    {label}
  </button>
);
}

const SelectionPopover = () => {
  const [bar, setBar] = useState(null); // { top, left, text, messageId, below, overlapId }
  const barRef = useRef(null);
  const rangesRef = useRef([]); // [{ id, range }]

  const { setSidebarOpen, setSelectedTextContext, showToast } = useTutorStore(
    useShallow((s) => ({ setSidebarOpen: s.setSidebarOpen, setSelectedTextContext: s.setSelectedTextContext, showToast: s.showToast })),
  );
  const { highlights, addHighlight, removeHighlight, addNote } = useAnnotationStore(
    useShallow((s) => ({ highlights: s.data.highlights, addHighlight: s.addHighlight, removeHighlight: s.removeHighlight, addNote: s.addNote })),
  );

  /* ── Paint saved highlights, and repaint whenever the chat re-renders ── */
  const paint = useCallback(() => {
    if (!supportsHighlights) return;
    const found = [];
    highlights.forEach((h) => {
      const msg = document.querySelector(`[data-message-id="${CSS.escape(String(h.messageId))}"]`);
      if (!msg) return;
      const range = findQuote(msg.querySelector('.markdown-content') || msg, h.quote);
      if (range) found.push({ id: h.id, range });
    });
    rangesRef.current = found;
    CSS.highlights.set('tb-highlight', new window.Highlight(...found.map((f) => f.range)));
  }, [highlights]);

  useEffect(() => {
    paint();
    if (!highlights.length) return undefined;
    let t;
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(paint, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(t);
      mo.disconnect();
    };
  }, [paint, highlights.length]);

  useEffect(() => () => supportsHighlights && CSS.highlights.delete('tb-highlight'), []);

  /* ── Show the bar for a selection inside a chat answer ── */
  useEffect(() => {
    let t;
    const read = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || '';
      if (!sel || sel.rangeCount === 0 || text.length < 2) return setBar(null);
      const range = sel.getRangeAt(0);
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      if (!node.closest('.chat-window, .markdown-content, .message-bubble') || node.closest('button, input, textarea, .no-select, [data-selection-bar]')) {
        return setBar(null);
      }
      const msg = node.closest('[data-message-id]') || range.startContainer.parentElement?.closest('[data-message-id]');
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return setBar(null);
      const below = rect.top < 64;
      const overlap = rangesRef.current.find((r) => overlaps(r.range, range));
      setBar({
        top: below ? rect.bottom + 10 : rect.top - 10,
        left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
        below,
        text,
        messageId: msg?.getAttribute('data-message-id') || null,
        overlapId: overlap?.id || null,
      });
    };
    const soon = () => {
      clearTimeout(t);
      t = setTimeout(read, 60);
    };
    const hide = () => setBar(null);
    document.addEventListener('selectionchange', soon);
    window.addEventListener('scroll', hide, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('selectionchange', soon);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  const done = () => {
    setBar(null);
    try {
      window.getSelection().removeAllRanges();
    } catch {
      /* noop */
    }
  };

  const onHighlight = () => {
    if (!bar) return;
    if (bar.overlapId) removeHighlight(bar.overlapId);
    else if (bar.messageId) addHighlight(bar.messageId, bar.text);
    else showToast?.({ message: 'This text can’t be highlighted.', type: 'info' });
    done();
  };

  const onNote = () => {
    if (!bar) return;
    addNote({ source: bar.text.slice(0, 400) });
    showToast?.({ message: 'Pinned to the canvas as a note.', type: 'success' });
    if (window.innerWidth < 768) setSidebarOpen(false);
    done();
  };

  const onAsk = () => {
    if (!bar) return;
    setSelectedTextContext(bar.text);
    setSidebarOpen(true);
    done();
    window.dispatchEvent(new CustomEvent('focus-input-bar'));
  };

  // Portalled to <body>: the canvas area sits below the sidebar, so the bar must escape it.
  return createPortal(
    <AnimatePresence>
      {bar && (
        <motion.div
          ref={barRef}
          data-selection-bar
          role="toolbar"
          aria-label="Selection actions"
          initial={{ opacity: 0, y: bar.below ? -4 : 4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            top: bar.top,
            left: bar.left,
            translateX: '-50%',
            translateY: bar.below ? '0%' : '-100%',
            zIndex: 10000,
          }}
          className="flex items-center gap-0.5 rounded-full bg-[var(--text-primary)] p-1 text-[var(--bg-primary)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]"
        >
          <Btn icon={bar.overlapId ? Eraser : Highlighter} label={bar.overlapId ? 'Remove' : 'Highlight'} onClick={onHighlight} accent={!bar.overlapId} />
          <span className="h-4 w-px bg-current opacity-20" />
          <Btn icon={StickyNote} label="Note" onClick={onNote} />
          <span className="h-4 w-px bg-current opacity-20" />
          <Btn icon={MessageSquareQuote} label="Ask" onClick={onAsk} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default SelectionPopover;
