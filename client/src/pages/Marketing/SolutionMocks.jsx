import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE, SPRING, Cursor, Rolling, useSequence } from './kit';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

function Bar({ left, right }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--mk-line)] px-4 font-mono text-[10.5px] text-[var(--text-tertiary)]">
      <span className="truncate">{left}</span>
      <span className="flex shrink-0 items-center gap-3">{right}</span>
    </div>
  );
}

/* ── Students: a tangent sliding along x³ − 3x ────────────────────── */

const W = 400;
const H = 230;
const XR = 2.2;
const YR = 4.4;
const sx = (x) => 24 + ((x + XR) / (2 * XR)) * (W - 48);
const sy = (y) => H / 2 - (y / YR) * (H / 2 - 18);
const f = (x) => x ** 3 - 3 * x;
const df = (x) => 3 * x * x - 3;
const CURVE = Array.from({ length: 89 }, (_, i) => {
  const x = -XR + (i / 88) * 2 * XR;
  return `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(f(x)).toFixed(1)}`;
}).join(' ');

export function TangentMock({ active }) {
  const x = useMotionValue(-1.9);
  const reduce = useReducedMotion();
  const [seen, setSeen] = useState({ max: false, min: false });

  useEffect(() => {
    if (!active || reduce) return undefined;
    x.set(-1.9);
    setSeen({ max: false, min: false });
    const controls = animate(x, [-1.9, 1.9], { duration: 5.2, ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatType: 'mirror', delay: 1.2 });
    return () => controls.stop();
  }, [active, reduce, x]);

  useMotionValueEvent(x, 'change', (v) => {
    if (!seen.max && v > -1) setSeen((s) => ({ ...s, max: true }));
    if (!seen.min && v > 1) setSeen((s) => ({ ...s, min: true }));
  });

  const px = useTransform(x, sx);
  const py = useTransform(x, (v) => sy(f(v)));
  const x1 = useTransform(x, (v) => sx(v - 0.75));
  const y1 = useTransform(x, (v) => sy(f(v) - df(v) * 0.75));
  const x2 = useTransform(x, (v) => sx(v + 0.75));
  const y2 = useTransform(x, (v) => sy(f(v) + df(v) * 0.75));
  const slope = useTransform(x, (v) => {
    const m = df(v);
    return `${m < -0.005 ? '−' : ' '}${Math.abs(m).toFixed(2)}`;
  });
  const flat = useTransform(x, (v) => (Math.abs(df(v)) < 0.35 ? 1 : 0));

  return (
    <div className="absolute inset-0 flex flex-col">
      <Bar left="f(x) = x³ − 3x" right={<span>calculus · derivatives</span>} />
      <div className="relative flex-1">
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2 rounded-full border border-[var(--mk-line)] bg-[var(--mk-surface)] px-2.5 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
          f′(x) =<motion.span className="tabular-nums text-[var(--text-primary)]">{slope}</motion.span>
          <motion.span className="text-[var(--mk-accent)]" style={{ opacity: flat }}>
            · flat
          </motion.span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id="plot-clip">
              <rect x="24" y="6" width={W - 48} height={H - 12} />
            </clipPath>
          </defs>
          <line x1="24" y1={H / 2} x2={W - 24} y2={H / 2} strokeWidth="1" style={{ stroke: 'var(--mk-line-strong)' }} />
          <line x1={W / 2} y1="10" x2={W / 2} y2={H - 10} strokeWidth="1" style={{ stroke: 'var(--mk-line-strong)' }} />
          <motion.path
            d={CURVE}
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ stroke: 'var(--text-primary)' }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: active || reduce ? 1 : 0 }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          />
          {[
            { at: -1, show: seen.max, label: 'max' },
            { at: 1, show: seen.min, label: 'min' },
          ].map((m) => (
            <motion.g key={m.label} initial={false} animate={{ opacity: m.show ? 1 : 0, scale: m.show ? 1 : 0.4 }} transition={SPRING} style={{ transformBox: 'view-box', transformOrigin: `${sx(m.at)}px ${sy(f(m.at))}px` }}>
              <circle cx={sx(m.at)} cy={sy(f(m.at))} r="4" style={{ fill: 'var(--mk-surface)', stroke: 'var(--text-primary)' }} strokeWidth="1.4" />
              <text x={sx(m.at)} y={sy(f(m.at)) + (m.label === 'max' ? -12 : 20)} textAnchor="middle" fontFamily={MONO} fontSize="10.5" style={{ fill: 'var(--text-secondary)' }}>
                {m.label}
              </text>
            </motion.g>
          ))}
          <g clipPath="url(#plot-clip)">
            <motion.line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.6" strokeLinecap="round" style={{ stroke: 'var(--mk-accent)' }} />
          </g>
          <motion.circle cx={px} cy={py} r="5" style={{ fill: 'var(--mk-accent)' }} />
          <motion.circle cx={px} cy={py} r="10" fill="none" strokeWidth="1" style={{ stroke: 'var(--mk-accent)', opacity: 0.4 }} />
        </svg>
      </div>
    </div>
  );
}

/* ── Self-learners: a concept map that grows with you ─────────────── */

const CONCEPTS = [
  { name: 'Gravity', x: 14, y: 26 },
  { name: 'Orbits', x: 20, y: 74 },
  { name: 'Kepler’s laws', x: 43, y: 50 },
  { name: 'Light', x: 64, y: 18 },
  { name: 'Stars', x: 70, y: 54 },
  { name: 'Fusion', x: 54, y: 86 },
  { name: 'Black holes', x: 84, y: 84 },
];
const LINKS = [
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 4],
  [3, 4],
  [4, 5],
  [4, 6],
];

export function ConceptMapMock({ active }) {
  const { phase } = useSequence([700, 900, 900, 900, 900, 900, 900, 2600], active, 7);
  const learned = Math.min(phase, CONCEPTS.length);
  const current = learned - 1;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Bar
        left="your path · astronomy"
        right={
          <span>
            <Rolling value={learned} className="text-[var(--text-primary)]" /> / {CONCEPTS.length} concepts
          </span>
        }
      />
      <div className="relative m-4 flex-1 @md:m-6">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {LINKS.map(([a, b]) => {
            const shown = a < learned && b < learned;
            return (
              <g key={`${a}-${b}`}>
                <line x1={CONCEPTS[a].x} y1={CONCEPTS[a].y} x2={CONCEPTS[b].x} y2={CONCEPTS[b].y} vectorEffect="non-scaling-stroke" strokeWidth="1" strokeDasharray="2 4" style={{ stroke: 'var(--mk-line-strong)' }} />
                <motion.line
                  x1={CONCEPTS[a].x}
                  y1={CONCEPTS[a].y}
                  x2={CONCEPTS[b].x}
                  y2={CONCEPTS[b].y}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1.4"
                  style={{ stroke: 'var(--text-primary)' }}
                  initial={false}
                  animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              </g>
            );
          })}
        </svg>
        {CONCEPTS.map((c, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'next';
          return (
            <motion.div
              key={c.name}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              initial={false}
              animate={{ opacity: state === 'next' ? 0.35 : 1, scale: state === 'now' ? 1.06 : 1 }}
              transition={SPRING}
            >
              {state === 'now' && (
                <motion.span
                  className="absolute -inset-1.5 rounded-full border border-[var(--mk-accent)]"
                  animate={{ opacity: [0.7, 0], scale: [1, 1.25] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span
                className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] tracking-[-0.01em] transition-colors duration-300 @md:text-[12.5px] ${
                  state === 'now'
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]'
                    : state === 'done'
                      ? 'border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[var(--text-primary)]'
                      : 'border-dashed border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[var(--text-tertiary)]'
                }`}
              >
                {state === 'done' && <Check size={11} strokeWidth={2.4} className="text-[var(--text-secondary)]" />}
                {c.name}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Educators: present live, share for replay ────────────────────── */

const ARC = Array.from({ length: 31 }, (_, i) => {
  const t = i / 30;
  return [30 + t * 300, 170 - 480 * t * (1 - t)];
});
const ARC_D = ARC.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const SCENE_LIST = ['Launch angle', 'Velocity parts', 'The arc', 'Range'];

export function ClassroomMock({ active }) {
  // draw · reach for share · press · copied · hold
  const { phase, cycle } = useSequence([2800, 800, 260, 2600, 700], active, 3);
  const root = useRef(null);
  const share = useRef(null);
  const copied = phase >= 3;

  return (
    <div ref={root} className="absolute inset-0 flex flex-col">
      <Bar
        left="presenting · projectile motion"
        right={
          <span className="inline-flex items-center gap-1.5 text-[var(--mk-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />
            live
          </span>
        }
      />
      <div className="flex min-h-0 flex-1">
        <ul className="hidden w-[30%] shrink-0 border-r border-[var(--mk-line)] py-2 @md:block">
          {SCENE_LIST.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 px-4 py-2 text-[12px] ${i === 2 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
              <span className="font-mono text-[10px]">{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ul>
        <div className="relative flex-1">
          <svg viewBox="0 0 360 200" className="absolute inset-0 h-full w-full">
            <line x1="20" y1="170" x2="345" y2="170" strokeWidth="1" style={{ stroke: 'var(--mk-line-strong)' }} />
            <motion.path
              key={`arc-${cycle}`}
              d={ARC_D}
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="3 5"
              style={{ stroke: 'var(--text-secondary)' }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: 'linear', delay: 0.3 }}
            />
            <motion.circle
              key={`ball-${cycle}`}
              r="7"
              style={{ fill: 'var(--text-primary)' }}
              initial={{ cx: ARC[0][0], cy: ARC[0][1] }}
              animate={{ cx: ARC.map((p) => p[0]), cy: ARC.map((p) => p[1]) }}
              transition={{ duration: 2.2, ease: 'linear', delay: 0.3 }}
            />
            <line x1="30" y1="170" x2="62" y2="138" strokeWidth="1.6" style={{ stroke: 'var(--mk-accent)' }} markerEnd="url(#arrow-acc)" />
            <defs>
              <marker id="arrow-acc" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-accent)' }} />
              </marker>
            </defs>
            <text x="70" y="140" fontFamily={MONO} fontSize="10.5" style={{ fill: 'var(--text-secondary)' }}>
              v₀ · 45°
            </text>
            <text x="180" y="190" textAnchor="middle" fontFamily={MONO} fontSize="10" style={{ fill: 'var(--text-tertiary)' }}>
              range = v₀² / g
            </text>
          </svg>
          <AnimatePresence>
            {copied && (
              <motion.div
                className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--text-primary)] py-1.5 pl-2 pr-3 text-[12px] text-[var(--bg-primary)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)]"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={SPRING}
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
                  <Check size={10} strokeWidth={3} />
                </span>
                Lesson link copied
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--mk-line)] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {SCENE_LIST.map((s, i) => (
            <span key={s} className={`h-1 rounded-full transition-all duration-500 ${i === 2 ? 'w-5 bg-[var(--text-primary)]' : 'w-1.5 bg-[var(--mk-line-strong)]'}`} />
          ))}
        </div>
        <motion.span
          ref={share}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mk-line-strong)] px-3 py-1 text-[12px] text-[var(--text-primary)]"
          animate={{ scale: phase === 2 ? 0.94 : 1 }}
          transition={{ duration: 0.15 }}
        >
          {copied ? 'Shared' : 'Share lesson'}
        </motion.span>
      </div>
      <Cursor container={root} target={share} anchor={phase >= 1 ? { x: 0.55, y: 0.6 } : { x: -1.4, y: -2.2 }} pressed={phase === 2} visible={phase >= 1 && phase <= 3} />
    </div>
  );
}
