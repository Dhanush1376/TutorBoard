import { create } from 'zustand';

/*
 * The learner's own marks on the canvas and in the chat: pen strokes, shapes,
 * sticky notes and chat highlights. Kept per session and saved to
 * localStorage, so they are still there when the session is opened again.
 *
 * Canvas coordinates are fractions (0–1) of the canvas size, so marks stay
 * in place when the window or sidebar changes size.
 */

const KEY = (id) => `tb-annotations:${id}`;
const EMPTY = () => ({ strokes: [], shapes: [], notes: [], highlights: [] });

export const INKS = [
  { id: 'ink', label: 'Ink', value: 'var(--text-primary)' },
  { id: 'amber', label: 'Amber', value: '#e08a0b' },
  { id: 'blue', label: 'Blue', value: '#2563eb' },
  { id: 'green', label: 'Green', value: '#16a34a' },
  { id: 'red', label: 'Red', value: '#dc2626' },
];

// Pastel sticky-note stock: paper, ruling, washi tape and folded-corner tones.
// Ids are kept stable so saved notes keep their colour.
export const NOTE_COLORS = [
  { id: 'amber', label: 'Lemon', bg: '#fff3a6', line: '#f0d96f', tape: '#f7c63c', fold: '#ead26e', ink: '#3b3214' },
  { id: 'rose', label: 'Pink', bg: '#ffd9e8', line: '#f6b2ca', tape: '#f286b2', fold: '#ecafc6', ink: '#45202f' },
  { id: 'paper', label: 'Tangerine', bg: '#ffdfc4', line: '#f6b98c', tape: '#f4965a', fold: '#ecbb93', ink: '#422817' },
  { id: 'mint', label: 'Mint', bg: '#d5f6db', line: '#a2e0ae', tape: '#58cb7a', fold: '#a9dcb3', ink: '#1d3a25' },
  { id: 'sky', label: 'Sky', bg: '#d6e9ff', line: '#a6c9f5', tape: '#6aa5ee', fold: '#a8c6ec', ink: '#1b2d45' },
  { id: 'lilac', label: 'Lilac', bg: '#e8dfff', line: '#c6b3f5', tape: '#a585ee', fold: '#c6b6ef', ink: '#2e2348' },
];

function load(id) {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (!raw) return EMPTY();
    return { ...EMPTY(), ...JSON.parse(raw) };
  } catch {
    return EMPTY();
  }
}

function save(id, data) {
  try {
    const empty = !data.strokes.length && !data.shapes.length && !data.notes.length && !data.highlights.length;
    if (empty) localStorage.removeItem(KEY(id));
    else localStorage.setItem(KEY(id), JSON.stringify(data));
  } catch {
    /* storage full or blocked: marks still work for this visit */
  }
}

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const useAnnotationStore = create((set, get) => {
  // Every change goes through here: update, remember for undo, save.
  const commit = (fn, { track = true } = {}) => {
    const { data, sessionKey, past } = get();
    const next = fn(data);
    if (next === data) return;
    set({ data: next, past: track ? [...past.slice(-49), data] : past });
    save(sessionKey, next);
  };

  return {
    sessionKey: 'draft',
    data: load('draft'),
    past: [],

    // Tool state
    tool: 'select', // select | draw | shape | note
    penMode: 'pen', // pen | highlighter | eraser
    ink: 'ink',
    width: 3,
    shapeKind: 'rect', // rect | ellipse | line | arrow
    noteColor: 'amber',
    focusNoteId: null,

    setTool: (tool) => set({ tool }),
    setPenMode: (penMode) => set({ penMode, tool: 'draw' }),
    setInk: (ink) => set({ ink }),
    setWidth: (width) => set({ width }),
    setShapeKind: (shapeKind) => set({ shapeKind, tool: 'shape' }),
    setNoteColor: (noteColor) => set({ noteColor }),
    clearFocus: () => set({ focusNoteId: null }),

    /** Switch to a session's marks. A brand-new session inherits marks made before it had an id. */
    setSession: (id) => {
      const key = id || 'draft';
      const { sessionKey, data } = get();
      if (key === sessionKey) return;
      let next = load(key);
      const nextEmpty = !next.strokes.length && !next.shapes.length && !next.notes.length && !next.highlights.length;
      if (sessionKey === 'draft' && key !== 'draft' && nextEmpty) {
        next = data;
        save(key, next);
        save('draft', EMPTY());
      }
      set({ sessionKey: key, data: next, past: [], focusNoteId: null });
    },

    addStroke: (stroke) => commit((d) => ({ ...d, strokes: [...d.strokes, { id: uid('s'), ...stroke }] })),
    addShape: (shape) => commit((d) => ({ ...d, shapes: [...d.shapes, { id: uid('h'), ...shape }] })),

    eraseAt: (ids) =>
      commit((d) => {
        if (!ids.length) return d;
        const gone = new Set(ids);
        return { ...d, strokes: d.strokes.filter((s) => !gone.has(s.id)), shapes: d.shapes.filter((s) => !gone.has(s.id)) };
      }),

    addNote: ({ x, y, text = '', color, source } = {}) => {
      const { data, noteColor } = get();
      // Without a position, cascade new notes down the right side so none hide another.
      const n = data.notes.length;
      const note = {
        id: uid('n'),
        x: x ?? 0.62 + (n % 3) * 0.03,
        y: y ?? 0.22 + (n % 6) * 0.07,
        text,
        color: color || noteColor,
        source: source || null,
        createdAt: Date.now(),
      };
      commit((d) => ({ ...d, notes: [...d.notes, note] }));
      set({ focusNoteId: text ? null : note.id });
      return note.id;
    },
    updateNote: (id, patch, track = false) =>
      commit((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }), { track }),
    removeNote: (id) => commit((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),
    bringToFront: (id) =>
      commit(
        (d) => {
          const i = d.notes.findIndex((n) => n.id === id);
          if (i < 0 || i === d.notes.length - 1) return d;
          const notes = [...d.notes];
          notes.push(notes.splice(i, 1)[0]);
          return { ...d, notes };
        },
        { track: false },
      ),

    addHighlight: (messageId, quote) =>
      commit((d) => ({ ...d, highlights: [...d.highlights, { id: uid('q'), messageId, quote }] })),
    removeHighlight: (id) => commit((d) => ({ ...d, highlights: d.highlights.filter((h) => h.id !== id) })),

    clear: (what) =>
      commit((d) => {
        if (what === 'drawings') return { ...d, strokes: [], shapes: [] };
        if (what === 'notes') return { ...d, notes: [] };
        if (what === 'highlights') return { ...d, highlights: [] };
        return EMPTY();
      }),

    undo: () => {
      const { past, sessionKey } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({ data: prev, past: past.slice(0, -1) });
      save(sessionKey, prev);
    },
  };
});

export default useAnnotationStore;
