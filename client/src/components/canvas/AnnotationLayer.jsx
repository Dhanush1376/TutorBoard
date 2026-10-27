import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useAnnotationStore, { INKS, NOTE_COLORS, NOTE_FONTS } from '../../store/annotationStore';
import useTutorStore from '../../store/tutorStore';
import { cleanFormulaText, formatNoteMathText, hasMathMarkup } from '../../utils/mathTextUtils';

/*
 * The learner's layer on top of the canvas: pen, highlighter and eraser
 * strokes, simple shapes, and sticky notes. Inert (click-through) while the
 * Select tool is on, so the lesson underneath stays fully interactive.
 */

const EASE = [0.22, 1, 0.36, 1];
const inkOf = (id) => INKS.find((i) => i.id === id)?.value || INKS[0].value;
const noteOf = (id) => NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];

function pathFrom(points, w, h) {
  if (!points.length) return '';
  const p = points.map(([x, y]) => [x * w, y * h]);
  if (p.length === 1) return `M${p[0][0]} ${p[0][1]} l0.01 0`;
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }
  const last = p[p.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

function Shape({ s, w, h }) {
  const color = inkOf(s.ink);
  const x1 = s.x1 * w, y1 = s.y1 * h, x2 = s.x2 * w, y2 = s.y2 * h;
  const common = { fill: 'none', stroke: color, strokeWidth: s.width, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (s.shape === 'rect') return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} rx={6} {...common} />;
  if (s.shape === 'ellipse')
    return <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} {...common} />;
  if (s.shape === 'line') return <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
  // arrow
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = 10 + s.width * 2;
  const p1 = [x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45)];
  const p2 = [x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)];
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
      <path d={`M${p1[0]} ${p1[1]} L${x2} ${y2} L${p2[0]} ${p2[1]}`} {...common} />
    </g>
  );
}

/* ── Sticky note ────────────────────────────────────────────────────── */

const LINE = 30; // ruling pitch, matched to the handwriting line height
const FOLD = 22; // dog-eared corner size

// Fine paper grain, multiplied over the note colour.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.35  0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function hashOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Each note keeps its own small tilt, and its tape sits a little crooked.
function tiltOf(id) {
  const h = hashOf(id);
  const mag = 1.2 + (h % 21) / 10; // 1.2°–3.2°: never quite straight
  return Number(((h >> 5) % 2 ? mag : -mag).toFixed(2));
}
function tapeOf(id) {
  const h = hashOf(`${id}tape`);
  return { rot: ((h % 9) - 4) * 0.9, shift: (h % 13) - 6 };
}

function StickyNote({ note, bounds }) {
  const { updateNote, removeNote, bringToFront, focusNoteId, clearFocus } = useAnnotationStore(
    useShallow((s) => ({
      updateNote: s.updateNote,
      removeNote: s.removeNote,
      bringToFront: s.bringToFront,
      focusNoteId: s.focusNoteId,
      clearFocus: s.clearFocus,
    })),
  );
  const ta = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [writing, setWriting] = useState(false);
  const [hover, setHover] = useState(false);
  const c = noteOf(note.color);
  const tilt = tiltOf(note.id);
  const tape = tapeOf(note.id);
  const lifted = dragging || writing;
  const fold = lifted || hover ? FOLD + 9 : FOLD; // the corner curls up when you reach for it

  useEffect(() => {
    if (focusNoteId === note.id) {
      ta.current?.focus();
      clearFocus();
    }
  }, [focusNoteId, note.id, clearFocus]);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = LINE * 7;
    const targetHeight = Math.max(el.scrollHeight, LINE * 4);
    if (targetHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${targetHeight}px`;
      el.style.overflowY = 'hidden';
    }
  }, [note.text]);

  // The whole sheet is the handle, except where you write or press a control.
  const onDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('textarea, button')) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    bringToFront(note.id);
    updateNote(note.id, {}, true); // one undo step for the whole move
    drag.current = { sx: e.clientX, sy: e.clientY, x: note.x, y: note.y };
    setDragging(true);
  };
  const onMove = (e) => {
    if (!drag.current || !bounds.w) return;
    const nx = drag.current.x + (e.clientX - drag.current.sx) / bounds.w;
    const ny = drag.current.y + (e.clientY - drag.current.sy) / bounds.h;
    updateNote(note.id, { x: Math.min(Math.max(nx, 0), 0.94), y: Math.min(Math.max(ny, 0), 0.94) });
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const jumpToSource = useCallback((e) => {
    e.stopPropagation();
    if (!note.source) return;

    // Ensure chat sidebar is open
    useTutorStore.getState().setSidebarOpen(true);

    // Dispatch direct jump event to ChatWindow virtualizer
    window.dispatchEvent(
      new CustomEvent('scroll-to-quote', {
        detail: {
          messageId: note.messageId,
          quote: note.source,
        },
      })
    );
  }, [note.source, note.messageId]);

  const ruling = `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, ${c.line} ${LINE - 1}px, ${c.line} ${LINE}px)`;

  return (
    <motion.div
      data-note
      data-rot={lifted ? 0 : tilt}
      // Stick on: drops from above, a touch larger, and settles with a small bounce.
      initial={{ opacity: 0, scale: 1.12, rotate: tilt - 10, y: -48, x: -10 }}
      animate={{ opacity: 1, scale: lifted ? 1.03 : 1, rotate: lifted ? 0 : tilt, y: lifted ? -3 : 0, x: 0 }}
      // Peel off: the bottom lifts first, then the sheet comes away from the tape.
      exit={{
        opacity: [1, 1, 0],
        rotate: [tilt, tilt - 6, tilt + 16],
        scaleY: [1, 0.94, 0.9],
        y: [0, -6, -70],
        x: [0, 4, 46],
        transition: { duration: 0.42, times: [0, 0.35, 1], ease: [0.45, 0, 0.8, 0.4] },
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 17, mass: 0.85 }}
      className={`group pointer-events-auto absolute touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        left: `${note.x * 100}%`,
        top: `${note.y * 100}%`,
        width: 'min(236px, 48vw)',
        transformOrigin: '50% 0%',
        // drop-shadow follows the cut corner, unlike box-shadow
        filter: lifted
          ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.10)) drop-shadow(0 18px 22px rgba(0,0,0,0.22))'
          : 'drop-shadow(0 1px 1px rgba(0,0,0,0.10)) drop-shadow(0 6px 10px rgba(0,0,0,0.16))',
        transition: 'filter 0.3s ease',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* The sheet, with its bottom-right corner folded back */}
      <div
        data-note-paper
        className="relative flex min-h-[224px] flex-col"
        style={{
          background: c.bg,
          color: c.ink,
          clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${fold}px), calc(100% - ${fold}px) 100%, 0 100%)`,
          transition: 'clip-path 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.035) 100%)' }}
        />

        {/* Head: punched hole on the left; colours and remove on hover */}
        <div className="relative flex h-11 shrink-0 items-center px-3.5">
          <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full" style={{ background: 'rgba(60,55,50,0.28)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.25)' }} />
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
            {NOTE_COLORS.map((nc) => (
              <button
                key={nc.id}
                type="button"
                aria-label={`${nc.label} note`}
                onClick={() => updateNote(note.id, { color: nc.id }, true)}
                className="h-3.5 w-3.5 cursor-pointer rounded-full"
                style={{
                  background: nc.tape,
                  boxShadow: nc.id === note.color ? `0 0 0 1.5px ${c.bg}, 0 0 0 2.5px ${c.ink}` : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                }}
              />
            ))}
            {NOTE_FONTS.length > 1 && (
              <button
                type="button"
                aria-label="Change handwriting font"
                title="Change font"
                onClick={() => {
                  const fonts = NOTE_FONTS.map((f) => f.id);
                  const currIdx = fonts.indexOf(note.font || 'patrick');
                  const nextFont = fonts[(currIdx + 1) % fonts.length];
                  updateNote(note.id, { font: nextFont }, true);
                }}
                className="ml-0.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full text-[11px] font-semibold opacity-60 transition-all hover:bg-black/[0.08] hover:opacity-100"
                style={{ color: c.ink }}
              >
                F
              </button>
            )}
            <button
              type="button"
              aria-label="Remove note"
              onClick={() => removeNote(note.id)}
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-full opacity-55 transition-opacity hover:bg-black/[0.07] hover:opacity-100"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        {note.source && (
          <div className="relative mx-4 mb-2 flex items-start gap-1">
            <button
              type="button"
              onClick={jumpToSource}
              title="Jump to source in chat"
              className="group/source relative flex-1 cursor-pointer border-l-[1.5px] pl-2 text-left text-[11.5px] leading-[1.45] opacity-75 transition-all hover:opacity-100 hover:border-l-[2.5px]"
              style={{ borderColor: c.ink }}
            >
              {(() => {
                const formattedMath = formatNoteMathText(note.source);
                if (formattedMath) {
                  return (
                    <span
                      className="line-clamp-3 group-hover/source:underline font-serif"
                      dangerouslySetInnerHTML={{ __html: `“${formattedMath}”` }}
                    />
                  );
                }
                const cleanSource = cleanFormulaText(note.source);
                return <span className="line-clamp-3 group-hover/source:underline">“{cleanSource}”</span>;
              })()}
            </button>
            <button
              type="button"
              aria-label="Remove quote preview"
              title="Remove quote"
              onClick={(e) => {
                e.stopPropagation();
                updateNote(note.id, { source: null, messageId: null }, true);
              }}
              className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full opacity-40 transition-opacity hover:bg-black/[0.08] hover:opacity-100"
              style={{ color: c.ink }}
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Ruled writing area: the lines carry on to the bottom of the sheet */}
        <div className="relative flex-1 px-4 pb-6" style={{ backgroundImage: ruling, backgroundPosition: '0 0' }}>
          {/* Always-editable textarea */}
          <textarea
            ref={ta}
            value={note.text}
            onChange={(e) => updateNote(note.id, { text: e.target.value })}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text');
              if (pasted) {
                const cleaned = cleanFormulaText(pasted);
                if (cleaned !== pasted) {
                  e.preventDefault();
                  const target = e.target;
                  const start = target.selectionStart ?? 0;
                  const end = target.selectionEnd ?? 0;
                  const current = target.value || '';
                  const nextText = current.slice(0, start) + cleaned + current.slice(end);
                  updateNote(note.id, { text: nextText });
                  requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + cleaned.length;
                  });
                }
              }
            }}
            onFocus={() => {
              setWriting(true);
              bringToFront(note.id);
            }}
            onBlur={() => setWriting(false)}
            placeholder={note.source ? 'Your thought…' : 'Write something…'}
            rows={4}
            spellCheck={false}
            className={`tb-note-hand tb-note-font-${note.font || 'patrick'} relative block w-full cursor-text resize-none bg-transparent p-0 outline-none placeholder:opacity-40 ${
              !writing && note.text && (hasMathMarkup(note.text) || formatNoteMathText(note.text))
                ? 'opacity-0'
                : 'opacity-100'
            }`}
            style={{ color: c.ink, lineHeight: `${LINE}px`, paddingTop: 3 }}
          />

          {/* Formatted Math Overlay when not typing: crisp KaTeX math rendered over the ruled lines */}
          {!writing && note.text && (hasMathMarkup(note.text) || formatNoteMathText(note.text)) && (
            <div
              aria-hidden="true"
              className={`tb-note-hand tb-note-font-${note.font || 'patrick'} pointer-events-none absolute inset-x-4 top-0 overflow-hidden select-none`}
              style={{
                color: c.ink,
                lineHeight: `${LINE}px`,
                paddingTop: 3,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              dangerouslySetInnerHTML={{
                __html: formatNoteMathText(note.text) || note.text,
              }}
            />
          )}
        </div>
      </div>

      {/* The folded-back flap */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0"
        style={{
          width: fold,
          height: fold,
          background: `linear-gradient(315deg, transparent 50%, ${c.fold} 50%)`,
          filter: `drop-shadow(-1px -1px ${fold > FOLD ? 3 : 1.5}px rgba(0,0,0,${fold > FOLD ? 0.18 : 0.12}))`,
          transition: 'width 0.28s cubic-bezier(0.22,1,0.36,1), height 0.28s cubic-bezier(0.22,1,0.36,1), filter 0.28s ease',
        }}
      />

      {/* Washi tape holding it up */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[11px] left-1/2 h-[22px] w-[62px]"
        initial={{ opacity: 0, scale: 1.25, y: -10, rotate: tape.rot }}
        animate={{ opacity: 0.85, scale: 1, y: 0, rotate: tape.rot }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 520, damping: 26 }}
        style={{
          marginLeft: -31 + tape.shift,
          background: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.34) 0 4px, rgba(255,255,255,0) 4px 8px), ${c.tape}`,
          boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
          clipPath: 'polygon(2% 0, 98% 4%, 100% 50%, 97% 100%, 3% 96%, 0 50%)',
        }}
      />
    </motion.div>
  );
}

/* ── Layer ─────────────────────────────────────────────────────────── */

const HINTS = {
  pen: 'Pen: drag to draw',
  highlighter: 'Highlighter: drag over anything',
  eraser: 'Eraser: drag across marks',
  shape: 'Shape: drag to draw',
  note: 'Note: click where it should go',
};

export default function AnnotationLayer({ sessionKey }) {
  const ref = useRef(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0 });
  const [draft, setDraftState] = useState(null);
  const draftRef = useRef(null);
  // The in-progress mark lives in a ref (always current) and is mirrored to state for rendering.
  const setDraft = (next) => {
    draftRef.current = typeof next === 'function' ? next(draftRef.current) : next;
    setDraftState(draftRef.current);
  };
  const erasing = useRef(false);

  const s = useAnnotationStore(
    useShallow((st) => ({
      data: st.data,
      tool: st.tool,
      penMode: st.penMode,
      ink: st.ink,
      width: st.width,
      shapeKind: st.shapeKind,
      setSession: st.setSession,
      setTool: st.setTool,
      addStroke: st.addStroke,
      addShape: st.addShape,
      addNote: st.addNote,
      eraseAt: st.eraseAt,
    })),
  );

  useEffect(() => {
    s.setSession(sessionKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBounds({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && useAnnotationStore.getState().tool !== 'select') useAnnotationStore.getState().setTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = s.tool !== 'select';
  const mode = s.tool === 'draw' ? s.penMode : s.tool;

  const frac = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)];
  };

  const hits = ([fx, fy]) => {
    const px = fx * bounds.w, py = fy * bounds.h, r = 12;
    const ids = [];
    for (const st of s.data.strokes) {
      if (st.points.some(([x, y]) => Math.hypot(x * bounds.w - px, y * bounds.h - py) < r + st.width)) ids.push(st.id);
    }
    for (const sh of s.data.shapes) {
      const x1 = Math.min(sh.x1, sh.x2) * bounds.w - r, x2 = Math.max(sh.x1, sh.x2) * bounds.w + r;
      const y1 = Math.min(sh.y1, sh.y2) * bounds.h - r, y2 = Math.max(sh.y1, sh.y2) * bounds.h + r;
      if (px > x1 && px < x2 && py > y1 && py < y2) ids.push(sh.id);
    }
    return ids;
  };

  const live = () => {
    const cur = useAnnotationStore.getState();
    return { cur, mode: cur.tool === 'draw' ? cur.penMode : cur.tool };
  };

  const onDown = (e) => {
    const { cur, mode } = live();
    if (cur.tool === 'select') return;
    if (e.target.closest('[data-note],[data-hint]')) return;
    e.preventDefault();
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone; the gesture still works without capture */
    }
    const p = frac(e);
    if (mode === 'note') return;
    if (mode === 'eraser') {
      erasing.current = true;
      s.eraseAt(hits(p));
      return;
    }
    if (cur.tool === 'shape') {
      setDraft({ kind: 'shape', shape: cur.shapeKind, ink: cur.ink, width: cur.width, x1: p[0], y1: p[1], x2: p[0], y2: p[1] });
      return;
    }
    setDraft({ kind: 'stroke', mode, ink: cur.ink, width: mode === 'highlighter' ? cur.width * 5 + 6 : cur.width, points: [p] });
  };

  const onMove = (e) => {
    if (live().cur.tool === 'select') return;
    if (erasing.current) {
      s.eraseAt(hits(frac(e)));
      return;
    }
    const p = frac(e);
    // Decide from the latest draft, not this render's copy: events can outrun renders.
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === 'shape') return { ...d, x2: p[0], y2: p[1] };
      const last = d.points[d.points.length - 1];
      if (Math.hypot((p[0] - last[0]) * bounds.w, (p[1] - last[1]) * bounds.h) < 1.5) return d;
      return { ...d, points: [...d.points, p] };
    });
  };

  const onUp = (e) => {
    const { cur, mode } = live();
    if (cur.tool === 'select') return;
    if (e.target.closest('[data-hint]')) return;
    if (erasing.current) {
      erasing.current = false;
      return;
    }
    if (mode === 'note') {
      if (e.target.closest('[data-note]')) return;
      const [x, y] = frac(e);
      s.addNote({ x: Math.min(x, 0.8), y: Math.min(y, 0.85) });
      s.setTool('select');
      return;
    }
    const draft = draftRef.current;
    if (!draft) return;
    if (draft.kind === 'shape') {
      const big = Math.hypot((draft.x2 - draft.x1) * bounds.w, (draft.y2 - draft.y1) * bounds.h) > 6;
      if (big) s.addShape({ shape: draft.shape, ink: draft.ink, width: draft.width, x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 });
    } else {
      s.addStroke({ mode: draft.mode, ink: draft.ink, width: draft.width, points: draft.points });
    }
    setDraft(null);
  };

  const strokeEl = (st, key) => (
    <path
      key={key}
      d={pathFrom(st.points, bounds.w, bounds.h)}
      fill="none"
      stroke={inkOf(st.ink)}
      strokeWidth={st.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={st.mode === 'highlighter' ? 0.32 : 1}
    />
  );

  const cursor = !active ? 'default' : mode === 'note' ? 'copy' : mode === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div
      ref={ref}
      data-annotation-layer
      className="absolute inset-0 z-[30]"
      style={{ pointerEvents: active ? 'auto' : 'none', touchAction: active ? 'none' : 'auto', cursor }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg width={bounds.w} height={bounds.h} className="absolute inset-0 overflow-visible" aria-hidden="true">
        {s.data.strokes.map((st) => strokeEl(st, st.id))}
        {s.data.shapes.map((sh) => (
          <Shape key={sh.id} s={sh} w={bounds.w} h={bounds.h} />
        ))}
        {draft?.kind === 'stroke' && strokeEl(draft, 'draft')}
        {draft?.kind === 'shape' && <Shape s={draft} w={bounds.w} h={bounds.h} />}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {s.data.notes.map((n) => (
            <StickyNote key={n.id} note={n} bounds={bounds} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            data-hint
            className="pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),20px)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)] py-1.5 pl-4 pr-1.5 text-[13px] text-[var(--text-secondary)] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.4)]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />
            {HINTS[mode]}
            <button
              type="button"
              onClick={() => s.setTool('select')}
              className="h-7 cursor-pointer rounded-full bg-[var(--text-primary)] px-3 text-[12.5px] font-medium text-[var(--bg-primary)] hover:opacity-90"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
