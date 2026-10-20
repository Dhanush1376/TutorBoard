import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import { EASE, SPRING, Rolling, Cursor, useSequence } from './kit';

const MONO = 'JetBrains Mono, ui-monospace, monospace';
const SANS = 'Geist, Inter, sans-serif';

function MockBar({ left, right }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between gap-3 px-4 font-mono text-[10.5px] text-[var(--text-tertiary)]">
      <span className="truncate">{left}</span>
      <span className="flex shrink-0 items-center gap-3">{right}</span>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)]">
      <span className="h-[6px] w-[6px] rotate-45 rounded-[1.5px] bg-[var(--text-primary)]" />
    </span>
  );
}

const ink = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
const faint = { ...ink, strokeWidth: 1.1, style: { stroke: 'var(--mk-line-strong)' } };
const accent = { ...ink, style: { stroke: 'var(--mk-accent)' } };
const drawIn = (delay = 0, duration = 0.9) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { duration, ease: EASE, delay },
});
const label = (fill = 'var(--text-tertiary)', size = 11) => ({ fontFamily: MONO, fontSize: size, style: { fill } });

/* ── 2 · Narration, in sync: light bending into water ─────────────── */

const SENTENCE = 'Light slows down in water, so the ray bends toward the normal.'.split(' ');
const WAVE = Array.from({ length: 40 }, (_, i) => 0.25 + (((i * 53) % 17) / 17) * 0.75);

export function NarrationMock({ active }) {
  const durations = [800, ...SENTENCE.map((w) => (w.endsWith(',') || w.endsWith('.') ? 520 : 300)), 2400];
  const { phase, cycle } = useSequence(durations, active, durations.length - 1);
  const spoken = Math.min(phase, SENTENCE.length);
  const playing = phase >= 1 && phase <= SENTENCE.length;
  const progress = spoken / SENTENCE.length;
  const show = { lightIn: phase >= 1, water: phase >= 5, bend: phase >= 9, normal: phase >= 12 };

  return (
    <div className="absolute inset-0 flex flex-col p-4 pt-11 @md:p-5 @md:pt-11">
      <MockBar left="narration · optics" right={<span>0:{String(Math.round(progress * 14) + 4).padStart(2, '0')}</span>} />
      <div className="relative min-h-0 flex-1">
        <svg key={cycle} viewBox="0 0 300 120" className="absolute inset-0 h-full w-full">
          <defs>
            <marker id="narr-head" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--text-primary)' }} />
            </marker>
          </defs>
          <rect x="20" y="62" width="260" height="54" rx="4" style={{ fill: show.water ? 'var(--mk-accent-soft)' : 'rgba(var(--text-primary-rgb),0.04)', transition: 'fill .6s' }} />
          <line x1="20" y1="62" x2="280" y2="62" {...faint} />
          <text x="26" y="20" {...label()}>air</text>
          <text x="26" y="110" {...label(show.water ? 'var(--text-primary)' : 'var(--text-tertiary)')} style={{ fill: show.water ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'fill .4s' }}>
            water
          </text>
          <motion.line x1="150" y1="6" x2="150" y2="116" {...accent} strokeWidth="1.1" strokeDasharray="3 4" initial={false} animate={{ opacity: show.normal ? 1 : 0 }} transition={{ duration: 0.4 }} />
          <motion.text x="156" y="14" {...label('var(--mk-accent)', 10)} initial={false} animate={{ opacity: show.normal ? 1 : 0 }}>
            normal
          </motion.text>
          <motion.line x1="70" y1="10" x2="150" y2="62" {...ink} initial={false} animate={{ pathLength: show.lightIn ? 1 : 0 }} transition={{ duration: 1.2, ease: 'linear' }} />
          <motion.line x1="150" y1="62" x2="234" y2="116" {...faint} strokeDasharray="2 4" initial={false} animate={{ opacity: show.bend ? 1 : 0 }} transition={{ duration: 0.4 }} />
          <motion.line x1="150" y1="62" x2="194" y2="114" {...ink} markerEnd="url(#narr-head)" initial={false} animate={{ pathLength: show.bend ? 1 : 0, opacity: show.bend ? 1 : 0 }} transition={{ duration: 0.8, ease: EASE }} />
        </svg>
      </div>
      <p className="mt-2 text-[14px] leading-[1.55] tracking-[-0.01em] @md:text-[15px]">
        {SENTENCE.map((w, i) => (
          <span key={i} className="relative transition-colors duration-200" style={{ color: i < spoken ? 'var(--text-primary)' : 'rgba(var(--text-primary-rgb),0.24)' }}>
            {w}
            {i === spoken - 1 && playing && <span className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] bg-[var(--mk-accent)]" />}{' '}
          </span>
        ))}
      </p>
      <div className="mt-3 flex h-6 items-center gap-[3px]">
        {WAVE.map((h, i) => (
          <motion.span
            key={i}
            className="w-full flex-1 rounded-full"
            style={{ height: '100%', background: i / WAVE.length < progress ? 'var(--text-primary)' : 'var(--mk-line-strong)', originY: 0.5 }}
            initial={false}
            animate={playing ? { scaleY: [h * 0.4, h, h * 0.6, h * 0.9, h * 0.4] } : { scaleY: 0.12 }}
            transition={playing ? { duration: 0.9 + (i % 5) * 0.13, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 3 · Interrupt any time ───────────────────────────────────────── */

export function InterruptMock({ active }) {
  // playing · ask · answer · resume
  const { phase } = useSequence([2200, 1000, 3000, 1900], active, 2);
  const paused = phase === 1 || phase === 2;
  const width = phase === 0 ? ['16%', '44%'] : phase === 3 ? ['44%', '66%'] : '44%';
  const widthT = phase === 0 ? { duration: 2.1, ease: 'linear' } : phase === 3 ? { duration: 1.8, ease: 'linear' } : { duration: 0.2 };

  return (
    <div className="absolute inset-0 flex flex-col p-4 pt-12 @md:p-5 @md:pt-12">
      <MockBar left="lesson · how vaccines work" right={<span className={paused ? 'text-[var(--mk-accent)]' : ''}>{paused ? 'paused' : 'playing'}</span>} />
      <div className="relative flex flex-1 flex-col justify-center gap-2.5">
        <AnimatePresence>
          {paused && (
            <motion.div
              key="q"
              className="ml-auto max-w-[82%] rounded-[14px] rounded-br-[4px] bg-[var(--text-primary)] px-3 py-1.5 text-[12.5px] text-[var(--bg-primary)]"
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, x: '-30%', y: 50 }}
              transition={SPRING}
              style={{ transformOrigin: 'bottom right' }}
            >
              Wait, how does the body remember?
            </motion.div>
          )}
          {phase === 2 && (
            <motion.div key="a" className="flex max-w-[94%] gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 50 }} transition={{ duration: 0.5, ease: EASE }}>
              <Mark />
              <motion.p className="text-[12.5px] leading-[1.5] text-[var(--text-primary)]" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5, delay: 0.15 }}>
                Memory cells stay behind after the first encounter, so the next response is faster and stronger.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-3">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]">
          <AnimatePresence mode="wait" initial={false}>
            {paused ? (
              <motion.svg key="play" viewBox="0 0 12 12" className="h-3 w-3" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.16 }}>
                <path d="M3 1.8 L10.2 6 L3 10.2 Z" fill="currentColor" />
              </motion.svg>
            ) : (
              <motion.span key="pause" className="flex gap-[3px]" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.16 }}>
                <span className="h-[10px] w-[2.5px] rounded-full bg-current" />
                <span className="h-[10px] w-[2.5px] rounded-full bg-current" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <div className="relative h-4 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--mk-line-strong)]" />
          <motion.div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--text-primary)]" initial={false} animate={{ width }} transition={widthT} />
          <AnimatePresence>
            {phase === 3 && (
              <motion.span
                className="absolute top-1/2 -ml-[5px] -mt-[5px] h-[10px] w-[10px] rounded-full border-2 border-[var(--mk-surface)] bg-[var(--mk-accent)]"
                style={{ left: '44%' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ ...SPRING, delay: 0.25 }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-2 h-4 overflow-hidden font-mono text-[10px] text-[var(--text-tertiary)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={phase === 3 ? 'pin' : 'time'} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.3 }}>
            {phase === 3 ? 'answer pinned at 0:42 · resuming' : 'ask by typing, any time'}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── 4 · Rewind any moment: cell division, frame by frame ─────────── */

const STAGES = ['interphase', 'prophase', 'metaphase', 'anaphase', 'telophase', 'two cells'];
const CHROMO_Y = [-30, -10, 10, 30];
const PRO = [
  [-14, -12],
  [14, -18],
  [-12, 14],
  [16, 10],
];
const CELL = [
  { sep: 0, r: 62 },
  { sep: 0, r: 62 },
  { sep: 0, r: 64 },
  { sep: 0, r: 64 },
  { sep: 24, r: 54 },
  { sep: 76, r: 44 },
];

function chromatid(stage, k, side) {
  const y = CHROMO_Y[k];
  switch (stage) {
    case 0:
      return { x: 0, y: 0, o: 0 };
    case 1:
      return { x: PRO[k][0], y: PRO[k][1], o: 1 };
    case 2:
      return { x: 0, y, o: 1 };
    case 3:
      return { x: side * 34, y: y * 0.8, o: 1 };
    case 4:
      return { x: side * 40, y: y * 0.45, o: 0.85 };
    default:
      return { x: side * 76, y: y * 0.3, o: 0 };
  }
}

function MitosisViz({ stage, thumb = false }) {
  const C = { x: 150, y: 80 };
  const t = thumb ? { duration: 0 } : { duration: 0.9, ease: [0.65, 0, 0.35, 1] };
  const cell = CELL[stage];
  const w = thumb ? 2.6 : 1;
  const nuclei = stage === 0 ? [0] : stage >= 4 ? [-1, 1] : [];
  return (
    <svg viewBox="0 0 300 160" className="block h-full w-full">
      {[-1, 1].map((side) => (
        <motion.circle
          key={side}
          cy={C.y}
          strokeWidth={1.5 * w}
          style={{ fill: 'rgba(var(--text-primary-rgb),0.035)', stroke: 'var(--text-secondary)' }}
          initial={false}
          animate={{ cx: C.x + side * cell.sep, r: cell.r }}
          transition={t}
        />
      ))}
      {/* nuclear envelopes */}
      {[0, -1, 1].map((n) => {
        const on = nuclei.includes(n) || (stage === 1 && n === 0);
        const nx = n === 0 ? C.x : C.x + n * (stage === 5 ? 76 : 40);
        return (
          <motion.circle
            key={`n${n}`}
            cy={C.y}
            fill="none"
            strokeWidth={1.2 * w}
            strokeDasharray={thumb ? undefined : '3 3'}
            style={{ stroke: 'var(--text-tertiary)' }}
            initial={false}
            animate={{ cx: nx, r: n === 0 ? 28 : 18, opacity: on ? (stage === 1 ? 0.35 : 1) : 0 }}
            transition={t}
          />
        );
      })}
      {/* spindle */}
      {[0, 1, 2, 3].map((k) =>
        [-1, 1].map((side) => {
          const c = chromatid(stage, k, side);
          return (
            <motion.line
              key={`s${k}${side}`}
              x1={C.x + side * 60}
              y1={C.y}
              strokeWidth={0.8 * w}
              style={{ stroke: 'var(--mk-line-strong)' }}
              initial={false}
              animate={{ x2: C.x + c.x, y2: C.y + c.y, opacity: stage === 2 || stage === 3 ? 1 : 0 }}
              transition={t}
            />
          );
        }),
      )}
      {/* chromosomes: two sister chromatids each */}
      {[0, 1, 2, 3].map((k) =>
        [-1, 1].map((side) => {
          const c = chromatid(stage, k, side);
          return (
            <motion.g key={`c${k}${side}`} initial={false} animate={{ x: C.x + c.x, y: C.y + c.y, opacity: c.o }} transition={t}>
              <line x1={side * -3.5} y1="-8" x2={side * 3.5} y2="8" strokeWidth={3.4 * (thumb ? 1.8 : 1)} strokeLinecap="round" style={{ stroke: k % 2 ? 'var(--mk-accent)' : 'var(--text-primary)' }} />
            </motion.g>
          );
        }),
      )}
    </svg>
  );
}

const PICKS = [5, 2, 3, 0, 4];

export function FilmstripMock({ active }) {
  // move to a frame · click it, five times over
  const { phase } = useSequence([750, 1300, 750, 1300, 750, 1300, 750, 1300, 750, 1800], active, 9);
  const k = Math.floor(phase / 2);
  const clicked = phase % 2 === 1;
  const sel = clicked ? PICKS[k] : PICKS[(k + PICKS.length - 1) % PICKS.length];
  const target = PICKS[k];
  const root = useRef(null);
  const thumbs = useMemo(() => STAGES.map(() => React.createRef()), []);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!clicked) return undefined;
    setPressed(true);
    const id = setTimeout(() => setPressed(false), 170);
    return () => clearTimeout(id);
  }, [clicked, phase]);

  return (
    <div ref={root} className="absolute inset-0 flex flex-col">
      <MockBar
        left={
          <span className="inline-flex items-center gap-1.5">
            biology · <Rolling value={STAGES[sel]} className="text-[var(--text-primary)]" />
          </span>
        }
        right={<span>frame {String(sel + 1).padStart(2, '0')} / 06</span>}
      />
      <div className="relative flex-1 px-[10%] pb-1 pt-10">
        <MitosisViz stage={sel} />
      </div>
      <div className="border-t border-[var(--mk-line)] p-2">
        <div className="relative grid grid-cols-6">
          <motion.span className="absolute inset-y-0 rounded-[9px] border border-[var(--text-primary)]" style={{ width: `${100 / 6}%` }} initial={false} animate={{ left: `${(sel * 100) / 6}%` }} transition={SPRING} />
          {STAGES.map((s, i) => (
            <div key={s} ref={thumbs[i]} className="relative p-1">
              <div className={`aspect-[15/8] rounded-[6px] bg-[var(--mk-surface)] transition-opacity duration-300 ${i === sel ? 'opacity-100' : 'opacity-50'}`}>
                <MitosisViz stage={i} thumb />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Cursor container={root} target={thumbs[target]} anchor={{ x: 0.6, y: 0.62 }} pressed={pressed} />
    </div>
  );
}

/* ── 5 · History, with cause and effect ───────────────────────────── */

const yearX = (y) => 20 + (y - 1914) * (320 / 31);
const EVENTS = [
  { y: 1914, name: 'WWI begins', tier: 0, anchor: 'start' },
  { y: 1919, name: 'Versailles', tier: 1, anchor: 'middle' },
  { y: 1929, name: 'Crash', tier: 0, anchor: 'middle' },
  { y: 1939, name: 'WWII begins', tier: 1, anchor: 'middle' },
  { y: 1945, name: 'WWII ends', tier: 0, anchor: 'end' },
];
const AXIS_Y = 96;

export function TimelineMock({ active }) {
  const { phase, cycle } = useSequence([500, 600, 600, 600, 600, 600, 1400, 2600], active, 7);
  const shown = Math.min(Math.max(phase, 0), EVENTS.length);
  const causes = phase >= 6;
  return (
    <div className="absolute inset-0 flex flex-col">
      <MockBar left="history · 1914 – 1945" right={<span>{shown} events</span>} />
      <div className="relative flex-1 px-3 pt-8">
        <svg key={cycle} viewBox="0 0 360 180" className="h-full w-full">
          <defs>
            <marker id="cause-head" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-accent)' }} />
            </marker>
          </defs>
          <motion.line x1="14" y1={AXIS_Y} x2="346" y2={AXIS_Y} {...faint} {...drawIn(0, 0.8)} />
          {EVENTS.map((e, i) => {
            const on = i < shown;
            const x = yearX(e.y);
            const ty = e.tier ? 146 : 118;
            return (
              <motion.g key={e.y} initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 6 }} transition={{ duration: 0.45, ease: EASE }}>
                <line x1={x} y1={AXIS_Y} x2={x} y2={ty - 12} {...faint} />
                <circle cx={x} cy={AXIS_Y} r="4.5" style={{ fill: e.y === 1939 && causes ? 'var(--mk-accent)' : 'var(--text-primary)', transition: 'fill .4s' }} />
                <text x={x} y={ty} textAnchor={e.anchor} {...label('var(--text-tertiary)', 10)}>
                  {e.y}
                </text>
                <text x={x} y={ty + 14} textAnchor={e.anchor} fontFamily={SANS} fontSize="12" style={{ fill: 'var(--text-primary)' }}>
                  {e.name}
                </text>
              </motion.g>
            );
          })}
          <motion.path d={`M${yearX(1919)} ${AXIS_Y - 8} C 110 28, 240 28, ${yearX(1939) - 2} ${AXIS_Y - 9}`} {...accent} strokeWidth="1.4" markerEnd="url(#cause-head)" initial={false} animate={{ pathLength: causes ? 1 : 0, opacity: causes ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE }} />
          <motion.path d={`M${yearX(1929)} ${AXIS_Y - 8} C 205 58, 252 58, ${yearX(1939) - 4} ${AXIS_Y - 10}`} {...accent} strokeWidth="1.4" markerEnd="url(#cause-head)" initial={false} animate={{ pathLength: causes ? 1 : 0, opacity: causes ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.25 }} />
          <motion.text x="150" y="30" {...label('var(--mk-accent)', 10)} initial={false} animate={{ opacity: causes ? 1 : 0 }} transition={{ delay: 0.6 }}>
            led to
          </motion.text>
        </svg>
      </div>
    </div>
  );
}

/* ── 6 · Math, typeset ────────────────────────────────────────────── */

const DERIVATION = [
  'ax^2 + bx + c = 0',
  'x^2 + \\tfrac{b}{a}x = -\\tfrac{c}{a}',
  '\\left(x + \\tfrac{b}{2a}\\right)^2 = \\tfrac{b^2 - 4ac}{4a^2}',
  'x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
];

export function MathMock({ active }) {
  const { phase } = useSequence([700, 950, 950, 950, 2800], active, 4);
  const html = useMemo(() => DERIVATION.map((t) => katex.renderToString(t, { throwOnError: false })), []);
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-6 pt-8">
      <MockBar left="algebra · completing the square" right={<span>{phase >= 4 ? 'quadratic formula' : ''}</span>} />
      <div className="space-y-2 text-[15.5px] text-[var(--text-primary)] @md:text-[16.5px]">
        {html.map((h, i) => (
          <motion.div
            key={i}
            className="relative w-fit"
            initial={false}
            animate={{ opacity: i < phase ? 1 : 0, y: i < phase ? 0 : 8, filter: i < phase ? 'blur(0px)' : 'blur(5px)' }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <span dangerouslySetInnerHTML={{ __html: h }} />
            {i === DERIVATION.length - 1 && (
              <motion.span className="absolute -bottom-1 left-0 right-0 h-[1.5px] origin-left bg-[var(--mk-accent)]" initial={false} animate={{ scaleX: phase >= 4 ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.3 }} />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── 7 · Your keys, with fallback ─────────────────────────────────── */

const PROVIDERS = ['Groq', 'Gemini', 'OpenRouter'];
const ROW_Y = [32, 88, 144];
const route = (y) => `M 104 88 C 150 88, 150 ${y + 16}, 196 ${y + 16}`;

export function RoutingMock({ active }) {
  // idle · try first · rate-limited · fall back · served
  const { phase } = useSequence([600, 850, 900, 850, 2600], active, 4);
  const status = (i) => {
    if (i === 0 && phase >= 2) return { text: '429 · busy', tone: 'accent' };
    if (i === 0 && phase === 1) return { text: '…', tone: 'muted' };
    if (i === 1 && phase === 4) return { text: '200 · 412ms', tone: 'ink' };
    if (i === 1 && phase === 3) return { text: '…', tone: 'muted' };
    return { text: 'ready', tone: 'muted' };
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center px-3 pt-6">
      <MockBar left="your key · fallback order" right={<span>{phase === 4 ? '1 hop' : ''}</span>} />
      <svg viewBox="0 0 340 196" className="h-full max-h-[200px] w-full">
        {ROW_Y.map((y) => (
          <path key={y} d={route(y)} fill="none" strokeWidth="1.2" style={{ stroke: 'var(--mk-line-strong)' }} />
        ))}
        <motion.path
          d={route(ROW_Y[0])}
          fill="none"
          strokeWidth="1.6"
          style={{ stroke: 'var(--text-primary)' }}
          initial={false}
          animate={{ pathLength: phase === 1 ? 1 : 0, opacity: phase === 1 ? 1 : 0 }}
          transition={{ duration: phase === 1 ? 0.7 : 0.25, ease: EASE }}
        />
        {phase >= 2 && <path d={route(ROW_Y[0])} fill="none" strokeWidth="1.6" strokeDasharray="3 4" style={{ stroke: 'var(--mk-accent)' }} />}
        <motion.path
          d={route(ROW_Y[1])}
          fill="none"
          strokeWidth="1.6"
          style={{ stroke: 'var(--text-primary)' }}
          initial={false}
          animate={{ pathLength: phase >= 3 ? 1 : 0 }}
          transition={{ duration: phase >= 3 ? 0.7 : 0.2, ease: EASE }}
        />
        <rect x="14" y="72" width="90" height="32" rx="16" style={{ fill: 'var(--text-primary)' }} />
        <text x="59" y="92" textAnchor="middle" fontFamily={MONO} fontSize="11" style={{ fill: 'var(--bg-primary)' }}>
          lesson
        </text>
        {PROVIDERS.map((p, i) => {
          const s = status(i);
          const served = i === 1 && phase === 4;
          return (
            <g key={p}>
              <rect
                x="196"
                y={ROW_Y[i]}
                width="132"
                height="32"
                rx="9"
                strokeWidth="1.2"
                style={{
                  fill: served ? 'var(--text-primary)' : 'var(--mk-surface)',
                  stroke: s.tone === 'accent' ? 'var(--mk-accent)' : served ? 'var(--text-primary)' : 'var(--mk-line-strong)',
                  transition: 'fill .35s, stroke .35s',
                }}
              />
              <text x="208" y={ROW_Y[i] + 20} fontSize="12" style={{ fill: served ? 'var(--bg-primary)' : 'var(--text-primary)', transition: 'fill .35s', fontFamily: SANS }}>
                {p}
              </text>
              <text
                x="318"
                y={ROW_Y[i] + 20}
                textAnchor="end"
                fontFamily={MONO}
                fontSize="9.5"
                style={{ fill: s.tone === 'accent' ? 'var(--mk-accent)' : served ? 'var(--bg-primary)' : 'var(--text-tertiary)', transition: 'fill .35s' }}
              >
                {s.text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
