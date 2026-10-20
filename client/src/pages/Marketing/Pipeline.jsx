import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE, useActive, useSequence, useTypewriter } from './kit';

/*
 * "Under the hood": one real question travels through the four systems.
 * Each column shows what that system hands to the next, so the pipeline
 * reads as work being done rather than four labels on a line.
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

// ask → intent → planner → renderer → narrator → hold
const DURATIONS = [750, 900, 1100, 1350, 1500, 600];
const STAGE_MS = DURATIONS.slice(1, 5);

// 1 column → 2×2 → 4 across, with hairlines only between cells.
const BORDERS = [
  '',
  'border-t md:border-t-0 md:border-l',
  'border-t xl:border-t-0 xl:border-l',
  'border-t md:border-l xl:border-t-0',
];

const ink = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
const faint = { ...ink, style: { stroke: 'var(--mk-line-strong)' } };

function draw(live, delay = 0, duration = 0.5) {
  return live
    ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration, delay, ease: EASE } }
    : { initial: false, animate: { pathLength: 1 } };
}

function pop(live, delay = 0) {
  return live
    ? { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: 420, damping: 18, delay } }
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

function IntentOut({ ex, live }) {
  return (
    <dl className="flex flex-col gap-2">
      {ex.intent.map(([k, v], i) => (
        <motion.div
          key={k}
          className="flex items-baseline justify-between gap-3 border-b border-[var(--mk-line)] pb-2 last:border-0"
          initial={live ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE, delay: live ? 0.08 + i * 0.18 : 0 }}
        >
          <dt className="text-[11px] font-medium text-[var(--text-tertiary)]">{k}</dt>
          <dd className={`truncate text-[13px] ${i === 2 ? 'text-[var(--mk-accent)]' : 'text-[var(--text-primary)]'}`}>{v}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

function PlannerOut({ ex, live, done }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {ex.scenes.map((s, i) => (
        <motion.li
          key={s}
          className="flex items-center gap-2.5 text-[13px] text-[var(--text-primary)]"
          initial={live ? { opacity: 0, x: -6 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: EASE, delay: live ? 0.06 + i * 0.19 : 0 }}
        >
          <span
            className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] font-mono text-[9.5px] ${
              done ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--mk-line-strong)] text-[var(--text-tertiary)]'
            }`}
          >
            {i + 1}
          </span>
          <span className="truncate">{s}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function RendererOut({ ex, live }) {
  return (
    <svg viewBox="0 0 200 104" className="h-[104px] w-full" aria-hidden="true">
      {ex.visual === 'orbit' && (
        <>
          <motion.ellipse cx="100" cy="54" rx="78" ry="34" {...faint} {...draw(live, 0, 0.5)} />
          <motion.circle cx="100" cy="54" r="10" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.2)} />
          <motion.g
            initial={live ? { opacity: 0 } : false}
            animate={{ opacity: 1, x: live ? [0, -14] : -14, y: live ? [0, 6] : 6 }}
            transition={{ duration: live ? 0.8 : 0, delay: live ? 0.35 : 0, ease: EASE }}
          >
            <circle cx="172" cy="40" r="7" style={{ fill: 'var(--text-primary)' }} />
            <line x1="168" y1="29" x2="176" y2="51" {...ink} />
          </motion.g>
          <motion.path d="M112 50 L150 43" {...ink} style={{ stroke: 'var(--mk-accent)' }} strokeDasharray="2 4" {...draw(live, 0.6, 0.35)} />
        </>
      )}
      {ex.visual === 'leaf' && (
        <>
          <motion.path d="M70 84 C 70 40, 120 20, 156 22 C 152 60, 118 88, 70 84 Z" {...ink} {...draw(live, 0, 0.5)} />
          <motion.path d="M74 80 C 100 62, 124 44, 148 28" {...faint} {...draw(live, 0.25, 0.4)} />
          <motion.circle cx="34" cy="22" r="9" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.15)} />
          <motion.path d="M46 30 L72 44" {...ink} style={{ stroke: 'var(--mk-accent)' }} {...draw(live, 0.35, 0.3)} />
          {[
            ['CO₂', 'M18 66 L58 66', 24, 60],
            ['O₂', 'M150 78 L188 78', 172, 72],
          ].map(([t, d, tx, ty], i) => (
            <g key={t}>
              <motion.path d={d} {...ink} {...draw(live, 0.5 + i * 0.18, 0.3)} />
              <motion.text
                x={tx}
                y={ty}
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                style={{ fill: 'var(--text-secondary)' }}
                initial={live ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ delay: live ? 0.65 + i * 0.18 : 0 }}
              >
                {t}
              </motion.text>
            </g>
          ))}
        </>
      )}
      {ex.visual === 'market' && (
        <>
          <motion.path d="M24 8 V92 H192" {...faint} {...draw(live, 0, 0.4)} />
          <motion.path d="M34 18 L178 86" {...ink} {...draw(live, 0.15, 0.45)} />
          <motion.path d="M34 86 L178 18" {...ink} style={{ stroke: 'var(--text-tertiary)' }} strokeDasharray="3 4" {...draw(live, 0.3, 0.45)} />
          <motion.path d="M20 86 L134 12" {...ink} {...draw(live, 0.6, 0.45)} />
          <motion.circle cx="86" cy="43" r="5" style={{ fill: 'var(--mk-accent)', ...box }} {...pop(live, 0.9)} />
        </>
      )}
    </svg>
  );
}

function NarratorLine({ text, typing, done }) {
  const shown = useTypewriter(text, typing, done, 20);
  return (
    <p className="min-h-[2.5em] text-[13px] leading-[1.4] text-[var(--text-primary)]">
      {shown}
      {typing && !done && <span className="mk-caret ml-px inline-block h-[1em] w-px translate-y-[2px] bg-[var(--mk-accent)]" />}
    </p>
  );
}

function NarratorOut({ ex, live, done, half }) {
  return (
    <div>
      <div className="mb-3 flex h-4 items-end gap-[3px]" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-[var(--text-primary)]"
            initial={false}
            animate={live ? { height: [3, 6 + ((i * 7) % 10), 3] } : { height: 3 + ((i * 5) % 6) }}
            transition={live ? { duration: 0.45, repeat: Infinity, delay: (i % 6) * 0.05, ease: 'easeInOut' } : { duration: 0.2 }}
            style={{ opacity: live ? 0.85 : 0.35 }}
          />
        ))}
      </div>
      <NarratorLine text={ex.lines[0]} typing={live} done={done || half} />
      <div className="mt-1 text-[var(--text-secondary)]">
        <NarratorLine text={ex.lines[1]} typing={live && half} done={done} />
      </div>
    </div>
  );
}

/* ── Panel ─────────────────────────────────────────────────────────── */

export default function Pipeline({ className = '' }) {
  const [ref, active] = useActive(0.35);
  const { phase, cycle, reduce } = useSequence(DURATIONS, active, 5);
  const ex = EXAMPLES[cycle % EXAMPLES.length];
  const question = useTypewriter(ex.q, phase === 0 && !reduce, phase > 0 || reduce, 20);

  // Narrator types its second line halfway through its turn.
  const [halfOf, setHalfOf] = React.useState(-1);
  React.useEffect(() => {
    if (phase !== 4) return undefined;
    const id = setTimeout(() => setHalfOf(cycle), 650);
    return () => clearTimeout(id);
  }, [phase, cycle]);
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
          return (
            <li
              key={s.name}
              className={`relative flex flex-col border-[var(--mk-line)] px-5 pb-6 pt-5 transition-colors duration-500 sm:px-6 ${BORDERS[i]} ${
                live ? 'bg-[var(--mk-ink-soft)]' : ''
              }`}
            >
              {/* progress for this stage */}
              <span className="absolute inset-x-0 top-0 h-px bg-transparent">
                <motion.span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--mk-accent)]"
                  initial={false}
                  animate={{ scaleX: st === 'wait' ? 0 : 1, opacity: st === 'wait' ? 0 : 1 }}
                  transition={{ duration: live ? STAGE_MS[i] / 1000 : 0.4, ease: live ? 'linear' : EASE }}
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
                    transition={{ duration: 0.25 }}
                  >
                    {st === 'wait' ? (
                      <Pending rows={i === 2 ? 2 : 3} />
                    ) : i === 0 ? (
                      <IntentOut ex={ex} live={live} />
                    ) : i === 1 ? (
                      <PlannerOut ex={ex} live={live} done={st === 'done'} />
                    ) : i === 2 ? (
                      <RendererOut ex={ex} live={live} />
                    ) : (
                      <NarratorOut ex={ex} live={live} done={st === 'done'} half={half} />
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
