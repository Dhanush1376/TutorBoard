import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Highlighter, Eraser, Shapes, Square, Circle, Minus, MoveUpRight, StickyNote,
  SquareCode, Undo2, Share, Trash2, Link2, ImageDown, Check, Settings, LogOut, User, ChevronRight,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import useTutorStore from '../../store/tutorStore';
import useAnnotationStore, { INKS, NOTE_COLORS } from '../../store/annotationStore';
import { useAuth } from '../../hooks/useAuth';
import useWindowSize from '../../hooks/useWindowSize';
import exportCanvasImage from '../../utils/exportCanvasImage';

const EASE = [0.22, 1, 0.36, 1];
const WIDTHS = [2, 4, 8];

/* ── Pieces ────────────────────────────────────────────────────────── */

function ToolButton({ label, icon: Icon, active, open, disabled, onClick, compact }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={open}
      disabled={disabled}
      onClick={onClick}
      className={`relative grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200 disabled:cursor-default disabled:opacity-35 ${
        compact ? 'h-8 w-8' : 'h-10 w-10'
      } ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
          : open
            ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon size={compact ? 16 : 18} strokeWidth={1.8} />
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-[var(--st-line-strong)] max-md:hidden" aria-hidden="true" />;

function Label({ children }) {
  return <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{children}</div>;
}

function Segmented({ items, value, onChange }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[var(--st-fill)] p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          aria-pressed={value === it.id}
          onClick={() => onChange(it.id)}
          className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-[9px] text-[11.5px] transition-colors ${
            value === it.id
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_var(--st-line)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <it.icon size={17} strokeWidth={1.8} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function InkRow() {
  const { ink, setInk } = useAnnotationStore(useShallow((s) => ({ ink: s.ink, setInk: s.setInk })));
  return (
    <div className="flex items-center gap-2.5">
      {INKS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={c.label}
          aria-pressed={ink === c.id}
          onClick={() => setInk(c.id)}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full transition-transform hover:scale-110"
          style={{ boxShadow: ink === c.id ? '0 0 0 2px var(--bg-primary), 0 0 0 3.5px var(--text-primary)' : undefined }}
        >
          <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: c.value }} />
        </button>
      ))}
    </div>
  );
}

function WidthRow() {
  const { width, setWidth } = useAnnotationStore(useShallow((s) => ({ width: s.width, setWidth: s.setWidth })));
  return (
    <div className="flex items-center gap-1.5">
      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          aria-label={`Thickness ${w}`}
          aria-pressed={width === w}
          onClick={() => setWidth(w)}
          className={`grid h-8 w-10 cursor-pointer place-items-center rounded-lg transition-colors ${
            width === w ? 'bg-[var(--st-fill-strong)]' : 'hover:bg-[var(--st-fill)]'
          }`}
        >
          <span className="w-5 rounded-full bg-[var(--text-primary)]" style={{ height: w }} />
        </button>
      ))}
    </div>
  );
}

function MenuItem({ icon: Icon, label, hint, onClick, danger, done }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
        danger ? 'text-red-500 hover:bg-red-500/[0.07]' : 'text-[var(--text-primary)] hover:bg-[var(--st-fill)]'
      }`}
    >
      <Icon size={16} strokeWidth={1.8} className={danger ? '' : 'text-[var(--text-secondary)]'} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-[var(--text-tertiary)]">{hint}</span>}
      </span>
      {done && <Check size={14} strokeWidth={2.4} className="text-emerald-500" />}
    </button>
  );
}

/* ── Panels ────────────────────────────────────────────────────────── */

function DrawPanel() {
  const { penMode, setPenMode } = useAnnotationStore(useShallow((s) => ({ penMode: s.penMode, setPenMode: s.setPenMode })));
  return (
    <>
      <Segmented
        value={penMode}
        onChange={setPenMode}
        items={[
          { id: 'pen', label: 'Pen', icon: Pencil },
          { id: 'highlighter', label: 'Marker', icon: Highlighter },
          { id: 'eraser', label: 'Eraser', icon: Eraser },
        ]}
      />
      {penMode !== 'eraser' && (
        <div className="mt-4 space-y-4">
          <div>
            <Label>Colour</Label>
            <InkRow />
          </div>
          <div>
            <Label>Thickness</Label>
            <WidthRow />
          </div>
        </div>
      )}
    </>
  );
}

function ShapePanel() {
  const { shapeKind, setShapeKind } = useAnnotationStore(useShallow((s) => ({ shapeKind: s.shapeKind, setShapeKind: s.setShapeKind })));
  return (
    <>
      <Segmented
        value={shapeKind}
        onChange={setShapeKind}
        items={[
          { id: 'rect', label: 'Box', icon: Square },
          { id: 'ellipse', label: 'Circle', icon: Circle },
          { id: 'line', label: 'Line', icon: Minus },
          { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
        ]}
      />
      <div className="mt-4 space-y-4">
        <div>
          <Label>Colour</Label>
          <InkRow />
        </div>
        <div>
          <Label>Thickness</Label>
          <WidthRow />
        </div>
      </div>
    </>
  );
}

function NotePanel({ close }) {
  const { noteColor, setNoteColor, addNote, setTool } = useAnnotationStore(
    useShallow((s) => ({ noteColor: s.noteColor, setNoteColor: s.setNoteColor, addNote: s.addNote, setTool: s.setTool })),
  );
  return (
    <>
      <Label>Note colour</Label>
      <div className="flex items-center gap-2.5">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={`${c.id} note`}
            aria-pressed={noteColor === c.id}
            onClick={() => setNoteColor(c.id)}
            className="h-7 w-7 cursor-pointer rounded-lg ring-1 ring-black/10 transition-transform hover:scale-110"
            style={{ background: c.bg, boxShadow: noteColor === c.id ? '0 0 0 2px var(--bg-primary), 0 0 0 3.5px var(--text-primary)' : undefined }}
          />
        ))}
      </div>
      <p className="mt-4 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">Click anywhere on the canvas to pin a note there. Notes stay with this session.</p>
      <button
        type="button"
        onClick={() => {
          addNote();
          setTool('select');
          close();
        }}
        className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--st-line-strong)] text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--st-fill)]"
      >
        <StickyNote size={14} strokeWidth={1.8} />
        Add one for me
      </button>
    </>
  );
}

function SharePanel({ close }) {
  const showToast = useTutorStore((s) => s.showToast);
  const [done, setDone] = useState(null);
  const flash = (id) => {
    setDone(id);
    setTimeout(() => setDone(null), 1600);
  };
  return (
    <div className="-m-1.5">
      <MenuItem
        icon={Link2}
        label="Copy link"
        hint="Share this session"
        done={done === 'link'}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            flash('link');
          } catch {
            showToast?.({ message: 'Could not copy the link.', type: 'error' });
          }
        }}
      />
      <MenuItem
        icon={ImageDown}
        label="Download image"
        hint="The canvas with your notes"
        done={done === 'img'}
        onClick={async () => {
          try {
            await exportCanvasImage();
            flash('img');
            setTimeout(close, 900);
          } catch {
            showToast?.({ message: 'Could not save the image.', type: 'error' });
          }
        }}
      />
    </div>
  );
}

function ClearPanel({ close }) {
  const { clear, data } = useAnnotationStore(useShallow((s) => ({ clear: s.clear, data: s.data })));
  const clearLesson = useTutorStore((s) => s.clearAll);
  const [confirm, setConfirm] = useState(null);

  const rows = [
    { id: 'drawings', label: 'Drawings and shapes', count: data.strokes.length + data.shapes.length, run: () => clear('drawings') },
    { id: 'notes', label: 'Sticky notes', count: data.notes.length, run: () => clear('notes') },
    { id: 'highlights', label: 'Chat highlights', count: data.highlights.length, run: () => clear('highlights') },
    { id: 'lesson', label: 'Lesson drawing', count: null, run: () => clearLesson?.() },
    { id: 'all', label: 'Everything I added', count: null, danger: true, run: () => clear('all') },
  ];

  return (
    <div className="-m-1.5">
      {rows.map((r) => {
        const arming = confirm === r.id;
        const empty = r.count === 0;
        return (
          <button
            key={r.id}
            type="button"
            disabled={empty}
            onClick={() => {
              if (!arming) return setConfirm(r.id);
              r.run();
              setConfirm(null);
              close();
            }}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors disabled:cursor-default disabled:opacity-40 ${
              arming ? 'bg-red-500/[0.08] text-red-500' : r.danger ? 'text-red-500 hover:bg-red-500/[0.06]' : 'text-[var(--text-primary)] hover:bg-[var(--st-fill)]'
            }`}
          >
            <span className="flex-1">{arming ? 'Tap again to clear' : r.label}</span>
            {r.count !== null && !arming && <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{r.count}</span>}
            {!arming && r.count === null && <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
          </button>
        );
      })}
    </div>
  );
}

function ProfilePanel({ user, onSettingsClick, onLogout }) {
  return (
    <div className="-m-1.5">
      <div className="mb-1 border-b border-[var(--st-line)] px-2.5 pb-2.5 pt-1.5">
        <div className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{user?.name || 'Guest'}</div>
        <div className="truncate text-[12px] text-[var(--text-tertiary)]">{user?.isGuest ? 'Guest session' : user?.email}</div>
      </div>
      <MenuItem icon={Settings} label="Settings" onClick={onSettingsClick} />
      <MenuItem icon={LogOut} label={user?.isGuest ? 'Leave guest session' : 'Log out'} danger onClick={onLogout} />
    </div>
  );
}

/* ── Toolbar ───────────────────────────────────────────────────────── */

const Toolbar = ({ onSettingsClick }) => {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(null); // draw | shape | note | share | clear | profile
  const [imgError, setImgError] = useState(false);
  const { isMobile } = useWindowSize();
  const { user, logout } = useAuth();
  const { layoutView, endSession, setCodeEditorOpen } = useTutorStore(
    useShallow((s) => ({ layoutView: s.layoutView, endSession: s.endSession, setCodeEditorOpen: s.setCodeEditorOpen })),
  );
  const { tool, penMode, setTool, undo, canUndo } = useAnnotationStore(
    useShallow((s) => ({ tool: s.tool, penMode: s.penMode, setTool: s.setTool, undo: s.undo, canUndo: s.past.length > 0 })),
  );

  // Panels open under the toolbar, aligned to whichever edge it sits against.
  const alignRight = layoutView !== 'right';

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(null);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useAnnotationStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A drawing tool both turns on and shows its options; pressing it again turns it off.
  const pickTool = (id) => {
    if (tool === id) {
      setTool('select');
      setOpen(null);
      return;
    }
    setTool(id);
    setOpen(id);
  };
  const toggle = (id) => setOpen((o) => (o === id ? null : id));
  const close = () => setOpen(null);

  const panels = {
    draw: { title: 'Draw', widthClass: 'w-[min(288px,calc(100vw-24px))]', body: <DrawPanel /> },
    shape: { title: 'Shapes', widthClass: 'w-[min(288px,calc(100vw-24px))]', body: <ShapePanel /> },
    note: { title: 'Sticky note', widthClass: 'w-[min(288px,calc(100vw-24px))]', body: <NotePanel close={close} /> },
    share: { title: 'Share', widthClass: 'w-[min(288px,calc(100vw-24px))]', body: <SharePanel close={close} /> },
    clear: { title: 'Clear', widthClass: 'w-[min(288px,calc(100vw-24px))]', body: <ClearPanel close={close} /> },
    profile: {
      title: null,
      widthClass: 'w-[200px]',
      body: (
        <ProfilePanel
          user={user}
          onSettingsClick={() => {
            close();
            onSettingsClick?.();
          }}
          onLogout={() => {
            close();
            logout();
            endSession?.();
          }}
        />
      ),
    },
  };
  const panel = open ? panels[open] : null;
  const DrawIcon = tool === 'draw' && penMode === 'eraser' ? Eraser : tool === 'draw' && penMode === 'highlighter' ? Highlighter : Pencil;
  const compact = isMobile;

  return (
    <div ref={rootRef} className="relative max-w-full">
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        role="toolbar"
        aria-label="Canvas tools"
        className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)]/90 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-18px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        {layoutView === 'right' ? (
          <>
            <button
              type="button"
              aria-label="Account"
              aria-expanded={open === 'profile'}
              onClick={() => toggle('profile')}
              className={`grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--st-line-strong)] transition-all ${
                compact ? 'mr-0.5 h-8 w-8' : 'h-10 w-10'
              } bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 active:scale-95 shadow-sm`}
            >
              {user?.avatar && !imgError ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
              ) : (
                <User size={compact ? 15 : 17} strokeWidth={2} />
              )}
            </button>
            <Divider />
            <ToolButton compact={compact} label="Clear" icon={Trash2} open={open === 'clear'} onClick={() => toggle('clear')} />
            <ToolButton compact={compact} label="Share" icon={Share} open={open === 'share'} onClick={() => toggle('share')} />
            <ToolButton compact={compact} label="Undo" icon={Undo2} disabled={!canUndo} onClick={undo} />
            <Divider />
            <ToolButton
              compact={compact}
              label="Code editor"
              icon={SquareCode}
              onClick={() => {
                close();
                setCodeEditorOpen(true);
              }}
            />
            <ToolButton compact={compact} label="Sticky note" icon={StickyNote} active={tool === 'note'} open={open === 'note'} onClick={() => pickTool('note')} />
            <ToolButton compact={compact} label="Shapes" icon={Shapes} active={tool === 'shape'} open={open === 'shape'} onClick={() => pickTool('shape')} />
            <ToolButton compact={compact} label="Draw" icon={DrawIcon} active={tool === 'draw'} open={open === 'draw'} onClick={() => pickTool('draw')} />
          </>
        ) : (
          <>
            <ToolButton compact={compact} label="Draw" icon={DrawIcon} active={tool === 'draw'} open={open === 'draw'} onClick={() => pickTool('draw')} />
            <ToolButton compact={compact} label="Shapes" icon={Shapes} active={tool === 'shape'} open={open === 'shape'} onClick={() => pickTool('shape')} />
            <ToolButton compact={compact} label="Sticky note" icon={StickyNote} active={tool === 'note'} open={open === 'note'} onClick={() => pickTool('note')} />
            <ToolButton
              compact={compact}
              label="Code editor"
              icon={SquareCode}
              onClick={() => {
                close();
                setCodeEditorOpen(true);
              }}
            />
            <Divider />
            <ToolButton compact={compact} label="Undo" icon={Undo2} disabled={!canUndo} onClick={undo} />
            <ToolButton compact={compact} label="Share" icon={Share} open={open === 'share'} onClick={() => toggle('share')} />
            <ToolButton compact={compact} label="Clear" icon={Trash2} open={open === 'clear'} onClick={() => toggle('clear')} />
            <Divider />
            <button
              type="button"
              aria-label="Account"
              aria-expanded={open === 'profile'}
              onClick={() => toggle('profile')}
              className={`grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--st-line-strong)] transition-all ${
                compact ? 'ml-0.5 h-8 w-8' : 'h-10 w-10'
              } bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 active:scale-95 shadow-sm`}
            >
              {user?.avatar && !imgError ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
              ) : (
                <User size={compact ? 15 : 17} strokeWidth={2} />
              )}
            </button>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {panel && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            className={`absolute top-[calc(100%+8px)] z-[100] ${panel.widthClass || 'w-[min(288px,calc(100vw-24px))]'} rounded-2xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${
              alignRight ? 'right-0' : 'left-0'
            }`}
          >
            {panel.title && <div className="mb-3 text-[13.5px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">{panel.title}</div>}
            {panel.body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Toolbar;
