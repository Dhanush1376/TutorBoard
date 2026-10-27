import React from 'react';
import { motion, AnimatePresence, useScroll, useVelocity, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { EASE, useActive, useTypewriter, useScrollContainer } from './kit';

/*
 * "Under the hood": one real question travels through the four systems.
 * Each column shows what that system hands to the next, so the pipeline
 * reads as work being done rather than four labels on a line.
 * Speed dynamically scales with the reader's scroll velocity.
 */

const SYSTEMS = [
  { name: 'Intent', verb: 'Reading', body: 'Works out what you asked, what you meant, and which picture will help.' },
  { name: 'Planner', verb: 'Planning', body: 'Turns the idea into short scenes, in teaching order.' },
  { name: 'Renderer', verb: 'Drawing', body: 'Draws each scene on a live canvas: diagrams, charts, timelines, molecules, math.' },
  { name: 'Narrator', verb: 'Speaking', body: 'Explains each step in sync with what moves on screen.' },
];

const EXAMPLES = [
  {
    q: 'Why do we have seasons?',
    intent: [['Subject', 'Earth science'], ['Goal', 'Explain a cause'], ['Picture', 'Orbit diagram']],
    scenes: ['The tilted axis', 'One orbit, one year', 'Sunlight at an angle', 'Recap'],
    lines: ['Earth leans 23.4° on its axis.', 'So each half gets more direct sun for part of the year.'],
    visual: 'orbit',
  },
  {
    q: 'How do plants make their food?',
    intent: [['Subject', 'Biology'], ['Goal', 'Show a process'], ['Picture', 'Flow diagram']],
    scenes: ['Light reaches the leaf', 'Water and CO₂ go in', 'Glucose is made', 'Oxygen leaves'],
    lines: ['Chlorophyll captures the light.', 'Its energy turns water and CO₂ into glucose.'],
    visual: 'leaf',
  },
  {
    q: 'Why do prices rise when supply drops?',
    intent: [['Subject', 'Economics'], ['Goal', 'Compare two forces'], ['Picture', 'Line chart']],
    scenes: ['The demand curve', 'The supply curve', 'Where they meet', 'Supply shifts left'],
    lines: ['Price settles where the curves cross.', 'Less supply moves that point up: a higher price.'],
    visual: 'market',
  },
];

// 4 to 5 seconds per step so the user can comfortably absorb each stage without flashing
const BASE_DURATIONS = [2200, 4500, 4500, 4500, 4800, 3500];
const STAGE_MS = BASE_DURATIONS.slice(1, 5); // [4500, 4500, 4500, 4800]

// 1 column → 2×2 → 4 across, with hairlines only between cells.
const BORDERS = [
  '',
  'border-t md:border-t-0 md:border-l',
  'border-t xl:border-t-0 xl:border-l',
  'border-t md:border-l xl:border-t-0',
];

const ink = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
const faint = { ...ink, style: { stroke: 'var(--mk-line-strong)' } };

function draw(live, delay = 0, duration = 0.6, speed = 1) {
  const d = Math.max(0.18, duration / Math.max(1, speed));
  const dl = (delay || 0) / Math.max(1, speed);
  return live
    ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: d, delay: dl, ease: EASE } }
    : { initial: false, animate: { pathLength: 1 } };
}

function pop(live, delay = 0, speed = 1) {
  const dl = (delay || 0) / Math.max(1, speed);
  return live
    ? { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: Math.min(500, 300 * Math.max(1, speed)), damping: 20, delay: dl } }
    : { initial: false, animate: { scale: 1, opacity: 1 } };
}

const box = { transformBox: 'fill-box', transformOrigin: 'center' };

/* ── Stage outputs ─────────────────────────────────────────────────── */

function Pending({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-2.5 pt-1" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="h-2 rounded-full bg-[var(--mk-ink-soft)]" style={{ width: `${88 - i * 18}%` }} />
      ))}
    </div>
  );
}

function IntentOut({ ex, live, speed = 1 }) {
  const s = Math.max(1, speed);
  return (
    <dl className="flex flex-col gap-2">
      {ex.intent.map(([k, v], i) => (
        <motion.div
          key={k}
          className="flex items-baseline justify-between gap-3 border-b border-[var(--mk-line)] pb-2 last:border-0"
          initial={live ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: Math.max(0.2, 0.4 / s), ease: EASE, delay: live ? (0.15 + i * 0.25) / s : 0 }}
        >
          <dt className="text-[11px] font-medium text-[var(--text-tertiary)]">{k}</dt>
          <dd className={`truncate text-[13px] ${i === 2 ? 'text-[var(--mk-accent)]' : 'text-[var(--text-primary)]'}`}>{v}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

function PlannerOut({ ex, live, done, speed = 1 }) {
  const s = Math.max(1, speed);
  return (
    <ol className="flex flex-col gap-1.5">
      {ex.scenes.map((sc, i) => (
        <motion.li
          key={sc}
          className="flex items-center gap-2.5 text-[13px] text-[var(--text-primary)]"
          initial={live ? { opacity: 0, x: -6 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: Math.max(0.18, 0.35 / s), ease: EASE, delay: live ? (0.12 + i * 0.22) / s : 0 }}
        >
          <span
            className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] font-mono text-[9.5px] ${
              done ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--mk-line-strong)] text-[var(--text-tertiary)]'
            }`}
          >
            {i + 1}
          </span>
          <span className="truncate">{sc}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function RendererOut({ ex, live, speed = 1 }) {
  const s = Math.max(1, speed);
  return (
    <svg viewBox="0 0 200 104" className="h-[104px] w-full" aria-hidden="true">
      {ex.visual === 'orbit' && (
        <>
          <motion.ellipse cx="100" cy="54" rx="78" ry="34" {...faint} {...draw(live, 0, 0.45, s)} />
          <motion.circle cx="100" cy="54" r="10" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.15, s)} />
          <motion.g
            initial={live ? { opacity: 0 } : false}
            animate={{ opacity: 1, x: live ? [0, -14] : -14, y: live ? [0, 6] : 6 }}
            transition={{ duration: live ? Math.max(0.1, 0.6 / s) : 0, delay: live ? 0.25 / s : 0, ease: EASE }}
          >
            <circle cx="172" cy="40" r="7" style={{ fill: 'var(--text-primary)' }} />
            <line x1="168" y1="29" x2="176" y2="51" {...ink} />
          </motion.g>
          <motion.path d="M112 50 L150 43" {...ink} style={{ stroke: 'var(--mk-accent)' }} strokeDasharray="2 4" {...draw(live, 0.4, 0.3, s)} />
        </>
      )}
      {ex.visual === 'leaf' && (
        <>
          <motion.path d="M70 84 C 70 40, 120 20, 156 22 C 152 60, 118 88, 70 84 Z" {...ink} {...draw(live, 0, 0.45, s)} />
          <motion.path d="M74 80 C 100 62, 124 44, 148 28" {...faint} {...draw(live, 0.18, 0.35, s)} />
          <motion.circle cx="34" cy="22" r="9" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.12, s)} />
          <motion.path d="M46 30 L72 44" {...ink} style={{ stroke: 'var(--mk-accent)' }} {...draw(live, 0.25, 0.25, s)} />
          {[
            ['CO₂', 'M18 66 L58 66', 24, 60],
            ['O₂', 'M150 78 L188 78', 172, 72],
          ].map(([t, d, tx, ty], i) => (
            <g key={t}>
              <motion.path d={d} {...ink} {...draw(live, 0.35 + i * 0.12, 0.25, s)} />
              <motion.text
                x={tx}
                y={ty}
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                style={{ fill: 'var(--text-secondary)' }}
                initial={live ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ delay: live ? (0.4 + i * 0.12) / s : 0 }}
              >
                {t}
              </motion.text>
            </g>
          ))}
        </>
      )}
      {ex.visual === 'market' && (
        <>
          <motion.path d="M24 8 V92 H192" {...faint} {...draw(live, 0, 0.35, s)} />
          <motion.path d="M34 18 L178 86" {...ink} {...draw(live, 0.1, 0.35, s)} />
          <motion.path d="M34 86 L178 18" {...ink} style={{ stroke: 'var(--text-tertiary)' }} strokeDasharray="3 4" {...draw(live, 0.2, 0.35, s)} />
          <motion.path d="M20 86 L134 12" {...ink} {...draw(live, 0.4, 0.35, s)} />
          <motion.circle cx="86" cy="43" r="5" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.65, s)} />
        </>
      )}
    </svg>
  );
}

function NarratorLine({ text, typing, done, speed = 1 }) {
  const shown = useTypewriter(text, typing, done, 22, speed);
  return (
    <p className="min-h-[2.5em] text-[13px] leading-[1.4] text-[var(--text-primary)]">
      {shown}
      {typing && !done && <span className="mk-caret ml-px inline-block h-[1em] w-px translate-y-[2px] bg-[var(--mk-accent)]" />}
    </p>
  );
}

function NarratorOut({ ex, live, done, half, speed = 1 }) {
  const s = Math.max(1, speed);
  return (
    <div>
      <div className="mb-3 flex h-4 items-end gap-[3px]" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-[var(--text-primary)]"
            initial={false}
            animate={live ? { height: [3, 6 + ((i * 7) % 10), 3] } : { height: 3 + ((i * 5) % 6) }}
            transition={live ? { duration: Math.max(0.08, 0.35 / s), repeat: Infinity, delay: ((i % 6) * 0.04) / s, ease: 'easeInOut' } : { duration: 0.15 }}
            style={{ opacity: live ? 0.85 : 0.35 }}
          />
        ))}
      </div>
      <NarratorLine text={ex.lines[0]} typing={live} done={done || half} speed={s} />
      <div className="mt-1 text-[var(--text-secondary)]">
        <NarratorLine text={ex.lines[1]} typing={live && half} done={done} speed={s} />
      </div>
    </div>
  );
}

/* ── Panel ─────────────────────────────────────────────────────────── */

export default function Pipeline({ className = '' }) {
  const [ref, active] = useActive(0.2);
  const scrollContainerRef = useScrollContainer();

  // 1. Scroll tracking on the target section
  const { scrollY } = useScroll({
    container: scrollContainerRef || undefined,
    target: ref,
    offset: ['start 95%', 'end 5%'],
  });
  const scrollVelocity = useVelocity(scrollY);

  // 2. Speed multiplier: 1x (idle/normal) up to 3.5x (during active fast scroll)
  const [speedMultiplier, setSpeedMultiplier] = React.useState(1);
  const reduce = useReducedMotion();

  // 3. Listen directly for scroll / wheel / touch activity for natural acceleration
  React.useEffect(() => {
    const sc = scrollContainerRef?.current || (typeof window !== 'undefined' ? window : null);
    if (!sc) return;

    let lastY = sc.scrollTop !== undefined ? sc.scrollTop : (window.scrollY || 0);
    let lastTime = performance.now();
    let decayTimer = null;

    const onScrollOrWheel = (e) => {
      const now = performance.now();
      const dt = Math.max(8, now - lastTime);
      const currentY = sc.scrollTop !== undefined ? sc.scrollTop : (window.scrollY || 0);
      const dy = Math.abs(currentY - lastY) || (e?.deltaY ? Math.abs(e.deltaY) : 0);
      lastY = currentY;
      lastTime = now;

      // Instantaneous scroll speed in px/s
      const instVelocity = (dy / dt) * 1000;
      const lenisVelocity = sc.__lenis?.velocity ? Math.abs(sc.__lenis.velocity) * 1000 : 0;
      const v = Math.max(instVelocity, lenisVelocity, Math.abs(scrollVelocity.get() || 0));

      // If scrolling fast (v > 150 px/s), scale smoothly from 1x up to 3.5x max
      if (v > 150) {
        const mult = Math.min(3.5, 1 + (v - 150) / 450);
        setSpeedMultiplier(mult);
      }

      clearTimeout(decayTimer);
      decayTimer = setTimeout(() => {
        setSpeedMultiplier(1);
      }, 300);
    };

    sc.addEventListener('scroll', onScrollOrWheel, { passive: true });
    window.addEventListener('wheel', onScrollOrWheel, { passive: true });
    window.addEventListener('touchmove', onScrollOrWheel, { passive: true });

    return () => {
      sc.removeEventListener('scroll', onScrollOrWheel);
      window.removeEventListener('wheel', onScrollOrWheel);
      window.removeEventListener('touchmove', onScrollOrWheel);
      clearTimeout(decayTimer);
    };
  }, [scrollContainerRef, scrollVelocity]);

  // 4. Framer-motion scroll velocity subscriber
  useMotionValueEvent(scrollVelocity, 'change', (v) => {
    const absV = Math.abs(v);
    if (absV > 150) {
      const mult = Math.min(3.5, 1 + (absV - 150) / 450);
      setSpeedMultiplier((prev) => Math.max(prev, mult));
    }
  });

  const [phase, setPhase] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);

  // 5. Calm, steady phase sequencer with 4 to 5 seconds per step
  React.useEffect(() => {
    if (!active || reduce) return undefined;

    const effectiveDuration = Math.max(600, Math.round(BASE_DURATIONS[phase] / speedMultiplier));

    const id = setTimeout(() => {
      setPhase((curr) => {
        const next = (curr + 1) % BASE_DURATIONS.length;
        if (next === 0) setCycle((c) => c + 1);
        return next;
      });
    }, effectiveDuration);

    return () => clearTimeout(id);
  }, [phase, active, reduce, speedMultiplier]);

  const ex = EXAMPLES[cycle % EXAMPLES.length];
  const question = useTypewriter(ex.q, phase === 0 && !reduce, phase > 0 || reduce, 22, speedMultiplier);

  // Narrator types its second line halfway through its turn
  const [halfOf, setHalfOf] = React.useState(-1);
  React.useEffect(() => {
    if (phase !== 4) return undefined;
    const id = setTimeout(() => setHalfOf(cycle), Math.max(500, Math.round(2000 / speedMultiplier)));
    return () => clearTimeout(id);
  }, [phase, cycle, speedMultiplier]);
  const half = phase === 4 && halfOf === cycle;

  const stateOf = (i) => (phase > i + 1 ? 'done' : phase === i + 1 ? 'live' : 'wait');
  const running = phase >= 1 && phase <= 4;

  return (
    <div ref={ref} className={`mk-shadow overflow-hidden rounded-[24px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] ${className}`}>
      {/* The question coming in */}
      <div className="flex items-center gap-3 border-b border-[var(--mk-line)] px-5 py-4 sm:px-6">
        <span className="text-[12px] font-medium text-[var(--text-tertiary)]">Ask</span>
        <span className="h-px w-4 bg-[var(--mk-line-strong)]" />
        <span className="min-w-0 flex-1 truncate text-[15px] tracking-[-0.01em] text-[var(--text-primary)]">
          {question}
          {phase === 0 && !reduce && <span className="mk-caret ml-px inline-block h-[1.05em] w-px translate-y-[3px] bg-[var(--text-primary)]" />}
        </span>
        <span className="hidden items-center gap-2 text-[11px] font-medium text-[var(--text-tertiary)] sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-[var(--mk-accent)]' : phase === 5 ? 'bg-[var(--text-primary)]' : 'bg-[var(--mk-line-strong)]'}`} />
          {phase === 0 ? 'Listening' : phase === 5 ? 'Lesson ready' : SYSTEMS[phase - 1].verb}
        </span>
      </div>

      {/* Four systems */}
      <ol className="grid md:grid-cols-2 xl:grid-cols-4">
        {SYSTEMS.map((s, i) => {
          const st = stateOf(i);
          const live = st === 'live';
          const stageDurationSec = Math.max(0.04, (STAGE_MS[i] / 1000) / speedMultiplier);

          return (
            <li
              key={s.name}
              className={`relative flex flex-col border-[var(--mk-line)] px-5 pb-6 pt-5 transition-colors duration-300 sm:px-6 ${BORDERS[i]} ${
                live ? 'bg-[var(--mk-ink-soft)]' : ''
              }`}
            >
              {/* progress for this stage */}
              <span className="absolute inset-x-0 top-0 h-px bg-transparent">
                <motion.span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--mk-accent)]"
                  initial={false}
                  animate={{ scaleX: st === 'wait' ? 0 : 1, opacity: st === 'wait' ? 0 : 1 }}
                  transition={{ duration: live ? stageDurationSec : 0.15, ease: live ? 'linear' : EASE }}
                />
              </span>

              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{String.fromCharCode(65 + i)}</span>
                  <h4 className="text-[18px] font-[450] tracking-[-0.02em] text-[var(--text-primary)]">{s.name}</h4>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                    live ? 'text-[var(--mk-accent)]' : st === 'done' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                  {live ? s.verb : st === 'done' ? 'Done' : 'Waiting'}
                </span>
              </div>

              <div className="mt-5 min-h-[124px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${cycle}-${st === 'wait' ? 'w' : 'o'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: Math.max(0.06, 0.2 / speedMultiplier) }}
                  >
                    {st === 'wait' ? (
                      <Pending rows={i === 2 ? 2 : 3} />
                    ) : i === 0 ? (
                      <IntentOut ex={ex} live={live} speed={speedMultiplier} />
                    ) : i === 1 ? (
                      <PlannerOut ex={ex} live={live} done={st === 'done'} speed={speedMultiplier} />
                    ) : i === 2 ? (
                      <RendererOut ex={ex} live={live} speed={speedMultiplier} />
                    ) : (
                      <NarratorOut ex={ex} live={live} done={st === 'done'} half={half} speed={speedMultiplier} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <p className="mt-5 border-t border-[var(--mk-line)] pt-4 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">{s.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
