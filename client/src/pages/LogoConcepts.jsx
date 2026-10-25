import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/useTheme';

/*
 * /logo — six identity concepts for TutorBoard, presented for selection.
 * Not wired into the app anywhere: nothing else imports these marks.
 *
 * Every mark is one ink colour plus one amber accent: the amber is always
 * the "live" point, the nib of the pen, the point being plotted, the scene
 * being played. That is the idea the brand has to carry: an AI tutor that
 * draws the lesson in front of you.
 */

const INK = 'var(--text-primary)';
const AMBER = 'var(--mk-accent)';
const EASE = [0.22, 1, 0.36, 1];


/** Draw-on animation for a path. */
const draw = (_, delay = 0, duration = 1.1) => ({
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration, ease: EASE, delay },
});

const pop = (_, delay) => ({
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 380, damping: 18, delay },
  style: { transformBox: 'fill-box', transformOrigin: 'center' },
});

/* ── The marks (64 × 64), round two: solid forms, negative space ──── */

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 4, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.7, ease: EASE, delay },
  style: { transformBox: 'fill-box', transformOrigin: 'center' },
});

/** Solid ink shape with cut-outs, so the negative space works on any background. */
function Cut({ id, cut, children }) {
  return (
    <>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="white" />
          <g fill="black" stroke="black">{cut}</g>
        </mask>
      </defs>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}

function Nib() {
  const id = `nib-${useId().replace(/:/g, '')}`;
  return (
    <>
      <motion.g {...rise(0)}>
        <Cut
          id={id}
          cut={
            <>
              <rect x="23" y="15" width="18" height="3.6" rx="1.8" strokeWidth="0" />
              <rect x="30.2" y="15" width="3.6" height="33" rx="1.8" strokeWidth="0" />
            </>
          }
        >
          <path d="M19 6 H45 V22 C45 36 37.5 44 32 57 C26.5 44 19 36 19 22 Z" fill={INK} />
        </Cut>
      </motion.g>
      <motion.circle cx="32" cy="61" r="2.6" fill={AMBER} {...pop(0, 0.6)} />
    </>
  );
}

function BrushT() {
  return (
    <>
      <motion.path d="M7 19 C 19 12.5, 45 12.5, 57 17.5 C 45 21.5, 20 22.5, 7 19 Z" fill={INK} {...rise(0)} />
      <motion.path d="M29.5 18 C 31.5 30, 28.5 44, 33 55.5 C 37 45, 36.5 30, 35.5 18 Z" fill={INK} {...rise(0.2)} />
      <motion.circle cx="34.5" cy="59" r="3" fill={AMBER} {...pop(0, 0.7)} />
    </>
  );
}

function StrokeTile() {
  const id = `tile-${useId().replace(/:/g, '')}`;
  return (
    <>
      <motion.g {...rise(0)}>
        <Cut
          id={id}
          cut={<path d="M15 43 C 23 43, 25 22, 33 23 S 39 39, 46 24" fill="none" strokeWidth="5.2" strokeLinecap="round" />}
        >
          <rect x="5" y="5" width="54" height="54" rx="16" fill={INK} />
        </Cut>
      </motion.g>
      <motion.circle cx="46.5" cy="23" r="4.6" fill={AMBER} {...pop(0, 0.5)} />
    </>
  );
}

function Compass() {
  return (
    <>
      <motion.path
        d="M44.6 52.4 A 43.9 43.9 0 0 0 57.5 46.2"
        fill="none"
        stroke={AMBER}
        strokeWidth="2.6"
        strokeLinecap="round"
        {...draw(0, 0.5, 0.8)}
      />
      <motion.g {...rise(0)}>
        <path d="M29.5 12.5 L34 14.5 L18.6 54.5 L16.4 53.6 Z" fill={INK} />
        <path d="M30 14.5 L34.5 12.5 L45.4 46 L41.2 47.4 Z" fill={INK} />
        <circle cx="32" cy="10.5" r="5.4" fill={INK} />
      </motion.g>
      <motion.path d="M41.2 47.4 L45.4 46 L44.4 52.6 Z" fill={AMBER} {...pop(0, 0.35)} />
    </>
  );
}

function Frame() {
  return (
    <>
      <motion.g {...rise(0)}>
        {['M9 23 V9 H23', 'M41 9 H55 V23', 'M55 41 V55 H41', 'M23 55 H9 V41'].map((d) => (
          <path key={d} d={d} fill="none" stroke={INK} strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </motion.g>
      <motion.path d="M20 42 C 24 42, 26 39, 28.5 36" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" {...draw(0, 0.4, 0.6)} />
      <motion.circle cx="32" cy="32" r="5.2" fill={AMBER} {...pop(0, 0.85)} />
    </>
  );
}

function InkDrop() {
  const id = `drop-${useId().replace(/:/g, '')}`;
  return (
    <>
      <motion.g {...rise(0)}>
        <Cut
          id={id}
          cut={
            <>
              <rect x="22.5" y="29" width="19" height="4.6" rx="2.3" strokeWidth="0" />
              <rect x="29.7" y="29" width="4.6" height="19" rx="2.3" strokeWidth="0" />
            </>
          }
        >
          <path d="M32 5 C 36 11, 51 25, 51 38.5 A 19 19 0 0 1 13 38.5 C 13 25, 28 11, 32 5 Z" fill={INK} />
        </Cut>
      </motion.g>
      <motion.circle cx="32" cy="47.2" r="2.3" fill={AMBER} {...pop(0, 0.6)} />
    </>
  );
}

const CONCEPTS = [
  {
    id: 'nib',
    name: 'Nib',
    Mark: Nib,
    idea: 'A solid fountain-pen nib. Its slit and crossbar are cut away to form a T, and an amber drop of ink waits at the tip.',
    reads: 'The tutor holds the pen.',
  },
  {
    id: 'brush-t',
    name: 'Brush T',
    Mark: BrushT,
    idea: 'A T written in two tapered calligraphy strokes, thick through the middle and fine at the ends, finished with a drop of amber ink.',
    reads: 'Hand-drawn, with craft.',
  },
  {
    id: 'stroke-tile',
    name: 'Stroke Tile',
    Mark: StrokeTile,
    idea: 'A solid tile is the canvas; a single fluid line is drawn straight through it and ends at an amber point.',
    reads: 'An idea, drawn on the board.',
  },
  {
    id: 'compass',
    name: 'Compass',
    Mark: Compass,
    idea: 'A drafting compass caught mid-arc: steel legs in ink, an amber pencil tip, the arc still being drawn.',
    reads: 'Precise, patient, teaching.',
  },
  {
    id: 'frame',
    name: 'Frame',
    Mark: Frame,
    idea: 'Four heavy corners frame an empty canvas while a short line draws in toward an amber point at its centre.',
    reads: 'Your question, brought into focus.',
  },
  {
    id: 'ink-drop',
    name: 'Ink Drop',
    Mark: InkDrop,
    idea: 'A drop of ink with a T cut out of it; the amber nib at the foot of the T is where the drawing starts.',
    reads: 'Every lesson starts with one drop of ink.',
  },
];

/* ── Presentation ─────────────────────────────────────────────────── */

function Glyph({ Mark, size, play, w }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="block overflow-visible">
      {/* a new key remounts the mark, which replays its draw-on */}
      <g key={String(play)}>
        <Mark w={w} />
      </g>
    </svg>
  );
}

function Tile({ Mark, dark, label }) {
  // App icon: the mark on a squircle, in both themes.
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${dark ? 'dark' : ''} grid h-16 w-16 place-items-center rounded-[18px] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.4)]`}
        style={{ background: dark ? '#0b0b0a' : '#fdfaf3', border: `1px solid ${dark ? 'rgba(249,246,229,0.08)' : 'rgba(26,24,20,0.1)'}` }}
      >
        <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true" style={{ '--text-primary': dark ? '#f9f6e5' : '#0f0f0e', '--mk-accent': dark ? '#f5a524' : '#e08a0b' }}>
          <Mark />
        </svg>
      </div>
      <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

function Concept({ c, index, selected, onSelect }) {
  const [play, setPlay] = useState(0);
  const { Mark } = c;
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.07 }}
      className={`relative overflow-hidden rounded-[24px] border bg-[var(--mk-surface)] transition-colors duration-300 ${
        selected ? 'border-[var(--mk-accent)]' : 'border-[var(--mk-line-strong)]'
      }`}
    >
      {/* hero mark */}
      <button
        type="button"
        onClick={() => setPlay((p) => p + 1)}
        onMouseEnter={() => setPlay((p) => p + 1)}
        className="mk-dots relative grid h-[260px] w-full cursor-pointer place-items-center border-b border-[var(--mk-line)] bg-[var(--mk-sunken)]"
        aria-label={`Replay ${c.name}`}
      >
        <Glyph Mark={Mark} size={132} play={play} />
        <span className="absolute left-5 top-4 text-[12px] font-medium text-[var(--text-tertiary)]">
          {String(index + 1).padStart(2, '0')} · {c.name}
        </span>
        <span className="absolute right-5 top-4 text-[11px] font-medium text-[var(--text-tertiary)]">hover to redraw</span>
      </button>

      <div className="p-6 sm:p-7">
        {/* wordmark lockup */}
        <div className="flex items-center gap-3">
          <Glyph Mark={Mark} size={30} play="lockup" />
          <span className="text-[22px] font-[500] tracking-[-0.035em] text-[var(--text-primary)]">TutorBoard</span>
        </div>

        <p className="mt-5 text-[15px] leading-[1.6] text-[var(--text-secondary)]">{c.idea}</p>
        <p className="mt-2 text-[14px] text-[var(--text-primary)]">
          <span className="text-[12px] font-medium text-[var(--mk-accent)]">Reads as · </span>
          {c.reads}
        </p>

        {/* in use: app icons and small sizes */}
        <div className="mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-[var(--mk-line)] pt-6">
          <div className="flex gap-4">
            <Tile Mark={Mark} dark label="Dark" />
            <Tile Mark={Mark} label="Light" />
          </div>
          <div className="flex items-end gap-4">
            {[16, 24, 32].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <Glyph Mark={Mark} size={s} play="small" w={s <= 16 ? 7 : undefined} />
                <span className="font-mono text-[9.5px] text-[var(--text-tertiary)]">{s}px</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect(c.id)}
          className={`mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full text-[13px] transition-colors ${
            selected
              ? 'bg-[var(--mk-accent)] text-[#0b0b0a]'
              : 'border border-[var(--mk-line-strong)] text-[var(--text-primary)] hover:bg-[var(--mk-ink-soft)]'
          }`}
        >
          {selected ? 'Selected' : `Choose ${c.name}`}
        </button>
      </div>
    </motion.article>
  );
}

export default function LogoConcepts() {
  const [selected, setSelected] = useState(null);
  const { mode, toggleMode } = useTheme();
  const dark = mode === 'dark';

  const chosen = CONCEPTS.find((c) => c.id === selected);

  return (
    <div className="h-screen overflow-y-auto bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1160px] px-5 pb-24 pt-12 sm:px-8 lg:px-10 lg:pt-16">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[12px] font-medium text-[var(--mk-accent)]">Identity · concepts</div>
            <h1 className="mt-4 text-[clamp(2.2rem,5vw,4rem)] font-[450] leading-[1.02] tracking-[-0.045em]">
              Round two: six symbols.
              <span className="block text-[var(--text-tertiary)]">Pick the one that feels like us.</span>
            </h1>
            <p className="mt-5 max-w-[60ch] text-[15.5px] leading-[1.65] text-[var(--text-secondary)]">
              Solid, crafted forms about drawing and the canvas, in ink with one amber accent. The amber is always the live part: the ink drop, the pencil tip, the point being drawn. Hover a mark to replay it.
            </p>
          </div>
        </header>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-16">
          {CONCEPTS.map((c, i) => (
            <Concept key={c.id} c={c} index={i} selected={selected === c.id} onSelect={setSelected} />
          ))}
        </div>

        {chosen && (
          <div className="sticky bottom-6 mt-10 flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-[var(--mk-line-strong)] bg-[rgba(var(--bg-primary-rgb),0.85)] py-2 pl-3 pr-5 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <Glyph Mark={chosen.Mark} size={26} play="bar" />
              <span className="text-[13.5px]">
                You picked <span className="font-medium">{chosen.name}</span>. Tell me in chat and I will roll it out.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
