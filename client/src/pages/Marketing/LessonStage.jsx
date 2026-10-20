import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import {
  EASE,
  EASE_IN_OUT,
  SPRING,
  MockFrame,
  LiveDot,
  Chip,
  Rolling,
  Cursor,
  offsetIn,
  useResizeTick,
  useSequence,
  useTypewriter,
} from './kit';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

/* ── The lesson the stage walks through: why we have seasons ──────── */

export const SEASONS = [
  { theta: 90, tilt: false, month: 'Mar', north: 'spring', title: 'The orbit', note: 'Earth circles the Sun once a year.' },
  { theta: 90, tilt: true, month: 'Mar', north: 'spring', title: 'The tilt', note: 'Its axis leans 23.4°, always toward the same point in space.', callout: '23.4° tilt' },
  { theta: 0, tilt: true, month: 'Jun', north: 'summer', title: 'June', note: 'In June, the north leans toward the Sun.', callout: 'north · summer' },
  { theta: 0, tilt: true, rays: true, month: 'Jun', north: 'summer', title: 'Direct light', note: 'Direct light packs more energy into every square metre.', callout: 'north · summer' },
  { theta: -180, tilt: true, month: 'Dec', north: 'winter', title: 'December', note: 'Six months on, the north leans away. Winter there.', callout: 'north · winter' },
  { theta: -180, tilt: true, month: 'Dec', north: 'winter', title: 'The swap', note: 'Same tilt, other side of the orbit: the south gets summer.', callout: 'south · summer', accent: true },
];

const SUN = { x: 260, y: 118 };
const RX = 200;
const RY = 74;
const TILT = (23.4 * Math.PI) / 180;
const rad = (deg) => (deg * Math.PI) / 180;
const orbitX = (t) => SUN.x + RX * Math.cos(rad(t));
const orbitY = (t) => SUN.y + RY * Math.sin(rad(t));
// Nearer the viewer (bottom of the ellipse) reads slightly larger.
const earthR = (t) => 15 + 6 * ((Math.sin(rad(t)) + 1) / 2);
const MONTHS = [
  { m: 'Mar', x: SUN.x, y: SUN.y + RY + 34, anchor: 'middle' },
  { m: 'Jun', x: SUN.x + RX + 29, y: SUN.y + 4, anchor: 'start' },
  { m: 'Sep', x: SUN.x, y: SUN.y - RY - 26, anchor: 'middle' },
  { m: 'Dec', x: SUN.x - RX - 29, y: SUN.y + 4, anchor: 'end' },
];

/**
 * Earth on its orbit, lit on the side facing the Sun, axis fixed at 23.4°.
 * `rewind` makes moves run backwards round the orbit, as a scrubbed timeline would.
 */
export function SeasonsViz({ state, drawKey = 0, ring = false, rewind = false }) {
  const theta = useMotionValue(state.theta);
  // Direction is read when a move starts; flipping it mid-move must not restart the move.
  const rewindRef = useRef(rewind);
  useLayoutEffect(() => {
    rewindRef.current = rewind;
  });

  useEffect(() => {
    const now = theta.get();
    let to = state.theta;
    if (rewindRef.current) while (to < now - 1) to += 360;
    else while (to > now + 1) to -= 360;
    if (Math.abs(to - now) < 1) return undefined;
    const controls = animate(theta, to, { duration: 1.5, ease: EASE_IN_OUT });
    return () => controls.stop();
  }, [state.theta, theta]);

  const ex = useTransform(theta, orbitX);
  const ey = useTransform(theta, orbitY);
  const r = useTransform(theta, earthR);
  const lit = useTransform(theta, (t) => {
    const R = earthR(t);
    const a = Math.atan2(SUN.y - orbitY(t), SUN.x - orbitX(t));
    const p = (k) => `${(R * Math.cos(a + k)).toFixed(2)} ${(R * Math.sin(a + k)).toFixed(2)}`;
    return `M ${p(-Math.PI / 2)} A ${R.toFixed(2)} ${R.toFixed(2)} 0 0 1 ${p(Math.PI / 2)} Z`;
  });
  const axis = (sign, extra = 7) => (t) => sign * (earthR(t) + extra);
  const nx = useTransform(theta, (t) => -Math.sin(TILT) * axis(1)(t));
  const ny = useTransform(theta, (t) => -Math.cos(TILT) * axis(1)(t));
  const sx = useTransform(theta, (t) => Math.sin(TILT) * axis(1)(t));
  const sy = useTransform(theta, (t) => Math.cos(TILT) * axis(1)(t));
  const ringR = useTransform(theta, (t) => earthR(t) + 9);

  const cx = orbitX(state.theta);
  const cy = orbitY(state.theta);
  const cr = earthR(state.theta);
  // Below the Sun there is no room above Earth, so the label sits beside it.
  const beside = Math.sin(rad(state.theta)) > 0.5;

  return (
    <svg viewBox="0 0 520 236" className="block h-auto w-full overflow-visible" role="img" aria-label="Earth orbiting the Sun with its tilted axis">
      <defs>
        <marker id="ray-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-accent)' }} />
        </marker>
      </defs>

      {/* orbit */}
      <motion.ellipse
        key={`orbit-${drawKey}`}
        cx={SUN.x}
        cy={SUN.y}
        rx={RX}
        ry={RY}
        fill="none"
        strokeWidth="1.2"
        style={{ stroke: 'var(--mk-line-strong)' }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.3, ease: EASE }}
      />
      {MONTHS.map((mo) => (
        <text
          key={mo.m}
          x={mo.x}
          y={mo.y}
          textAnchor={mo.anchor}
          fontFamily={MONO}
          fontSize="11"
          style={{ fill: mo.m === state.month ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'fill .4s' }}
        >
          {mo.m}
        </text>
      ))}

      {/* sun */}
      <motion.circle
        cx={SUN.x}
        cy={SUN.y}
        style={{ fill: 'none', stroke: 'var(--mk-accent)' }}
        strokeWidth="1"
        initial={{ r: 26, opacity: 0.45 }}
        animate={{ r: [26, 46], opacity: [0.45, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <circle cx={SUN.x} cy={SUN.y} r="36" style={{ fill: 'var(--mk-accent-soft)' }} />
      <circle cx={SUN.x} cy={SUN.y} r="24" style={{ fill: 'var(--mk-accent)' }} />
      <text x={SUN.x} y={SUN.y + 4} textAnchor="middle" fontFamily={MONO} fontSize="10" style={{ fill: 'var(--bg-primary)' }}>
        sun
      </text>

      {/* direct light, June */}
      <AnimatePresence>
        {state.rays &&
          [-8, 0, 8].map((dy, i) => (
            <motion.line
              key={`ray-${dy}`}
              x1={SUN.x + 30}
              y1={SUN.y + dy}
              x2={orbitX(0) - earthR(0) - 4}
              y2={SUN.y + dy}
              strokeWidth="1.3"
              markerEnd="url(#ray-head)"
              style={{ stroke: 'var(--mk-accent)' }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.12 }}
            />
          ))}
      </AnimatePresence>

      {/* earth */}
      <motion.g style={{ x: ex, y: ey }}>
        <motion.circle cx="0" cy="0" r={r} strokeWidth="1.2" style={{ fill: 'rgba(var(--text-primary-rgb),0.1)', stroke: 'var(--text-primary)' }} />
        <motion.path d={lit} style={{ fill: 'var(--mk-accent)', fillOpacity: 0.6 }} />
        <motion.g initial={false} animate={{ opacity: state.tilt ? 1 : 0 }} transition={{ duration: 0.6 }}>
          <motion.line x1={nx} y1={ny} x2={sx} y2={sy} strokeWidth="1.4" strokeLinecap="round" style={{ stroke: 'var(--text-primary)' }} />
          <motion.circle cx={nx} cy={ny} r="2.6" style={{ fill: 'var(--text-primary)' }} />
        </motion.g>
        <AnimatePresence>
          {ring && (
            <motion.circle
              key="ring"
              cx="0"
              cy="0"
              r={ringR}
              fill="none"
              strokeWidth="1.2"
              strokeDasharray="3 4"
              style={{ stroke: 'var(--text-primary)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
      </motion.g>

      {/* what this moment means */}
      <AnimatePresence mode="wait">
        {state.callout && (
          <motion.text
            key={`${state.callout}-${state.month}`}
            x={beside ? cx + cr + 12 : cx}
            y={beside ? cy + 4 : cy - cr - 16}
            textAnchor={beside ? 'start' : 'middle'}
            fontFamily={MONO}
            fontSize="11"
            style={{ fill: state.accent ? 'var(--mk-accent)' : 'var(--text-primary)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            {state.callout}
          </motion.text>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────── */

function SceneBar({ children }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[var(--mk-line)] px-3.5 font-mono text-[10.5px] text-[var(--text-tertiary)]">
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Rolling value={value} className="text-[var(--text-primary)]" />
    </span>
  );
}

function TutorMark() {
  return (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)]">
      <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-[var(--text-primary)]" />
    </span>
  );
}

export function NarrationBar({ text, progress, time }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-full border border-[var(--mk-line)] bg-[var(--mk-surface)] py-1.5 pl-1.5 pr-3.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--text-primary)]">
        <span className="flex gap-[3px]">
          <span className="h-[9px] w-[2.5px] rounded-full bg-[var(--bg-primary)]" />
          <span className="h-[9px] w-[2.5px] rounded-full bg-[var(--bg-primary)]" />
        </span>
      </span>
      <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={text}
            className="absolute inset-0 truncate text-[12.5px] leading-5 text-[var(--text-primary)]"
            initial={{ y: 12, opacity: 0, filter: 'blur(4px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: -12, opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {text}
          </motion.p>
        </AnimatePresence>
      </div>
      <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)] @sm:inline">{time}</span>
      <motion.span
        className="absolute bottom-0 left-0 h-px bg-[var(--text-primary)]"
        initial={false}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.8, ease: EASE }}
      />
    </div>
  );
}

function SendButton({ innerRef, ready, pressed }) {
  return (
    <motion.span
      ref={innerRef}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]"
      animate={{ opacity: ready ? 1 : 0.22, scale: pressed ? 0.86 : 1 }}
      transition={{ duration: 0.18 }}
    >
      <ArrowUp size={14} strokeWidth={2.2} />
    </motion.span>
  );
}

function Composer({ inputRef, sendRef, text, placeholder, caret, pressed, compact = false }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[14px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] pl-3.5 pr-1.5 ${compact ? 'h-10' : 'h-12'}`}
    >
      <div ref={inputRef} className="flex min-w-0 flex-1 items-center text-[13px]">
        {text ? (
          <span className="truncate text-[var(--text-primary)]">{text}</span>
        ) : (
          <span className="truncate text-[var(--text-tertiary)]">{placeholder}</span>
        )}
        {caret && <span className="mk-caret ml-px inline-block h-[15px] w-px shrink-0 bg-[var(--text-primary)]" />}
      </div>
      <SendButton innerRef={sendRef} ready={!!text} pressed={pressed} />
    </div>
  );
}

/* ── Scene 1 · Ask: a different subject every loop ────────────────── */

const QUESTIONS = [
  {
    q: 'Why do we have seasons?',
    topic: 'earth science',
    visual: 'orbit + sunlight',
    reply: 'It is the tilt, not the distance. Let me draw the orbit.',
    preview: 'orbit',
  },
  {
    q: 'How does photosynthesis work?',
    topic: 'biology',
    visual: 'process diagram',
    reply: 'Light in, sugar out. Let me draw the leaf.',
    preview: 'leaf',
  },
  {
    q: 'What actually causes inflation?',
    topic: 'economics',
    visual: 'supply + demand',
    reply: 'More money chasing the same goods. Let me plot it.',
    preview: 'curves',
  },
  {
    q: 'Why did the Roman Empire split?',
    topic: 'history',
    visual: 'timeline',
    reply: 'Too big to rule from one city. Let me lay out the timeline.',
    preview: 'timeline',
  },
  {
    q: 'Why is binary search so fast?',
    topic: 'algorithms',
    visual: 'list + pointers',
    reply: 'It halves the problem every step. Let me draw it.',
    preview: 'cells',
  },
];

function MiniPreview({ kind }) {
  const draw = (d = 0) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.8, ease: EASE, delay: 0.35 + d },
  });
  const ink = { fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
  const faint = { ...ink, style: { stroke: 'var(--mk-line-strong)' } };
  const dot = (x, y, r, accent, d) => (
    <motion.circle
      cx={x}
      cy={y}
      r={r}
      style={{ fill: accent ? 'var(--mk-accent)' : 'var(--text-primary)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.6 + d }}
    />
  );
  return (
    <svg viewBox="0 0 170 44" className="mt-3 h-11 w-[170px] overflow-visible">
      {kind === 'orbit' && (
        <>
          <motion.ellipse cx="80" cy="22" rx="62" ry="15" {...faint} {...draw()} />
          {dot(80, 22, 6, true, 0)}
          {dot(142, 22, 4.5, false, 0.2)}
          <motion.path d="M140 13 L144 31" {...ink} {...draw(0.4)} />
        </>
      )}
      {kind === 'leaf' && (
        <>
          <motion.path d="M10 36 C 12 14, 44 6, 70 8 C 66 30, 40 40, 10 36 Z" {...ink} {...draw()} />
          <motion.path d="M10 36 C 30 26, 48 18, 66 10" {...faint} {...draw(0.2)} />
          {dot(140, 12, 6, true, 0)}
          <motion.path d="M130 16 L 84 22 M132 22 L 88 30" {...ink} strokeDasharray="2 4" {...draw(0.3)} />
        </>
      )}
      {kind === 'curves' && (
        <>
          <motion.path d="M10 4 L10 40 L160 40" {...faint} {...draw()} />
          <motion.path d="M20 36 L150 8" {...ink} {...draw(0.1)} />
          <motion.path d="M20 8 L150 36" {...ink} {...draw(0.2)} />
          {dot(85, 22, 4, true, 0.3)}
        </>
      )}
      {kind === 'timeline' && (
        <>
          <motion.path d="M6 30 L164 30" {...faint} {...draw()} />
          {[
            [20, '27 BC'],
            [70, '285'],
            [110, '395'],
            [150, '476'],
          ].map(([x, label], i) => (
            <g key={label}>
              {dot(x, 30, i === 2 ? 4.5 : 3.5, i === 2, i * 0.12)}
              <motion.text
                x={x}
                y="18"
                textAnchor="middle"
                fontFamily={MONO}
                fontSize="9"
                style={{ fill: i === 2 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.12 }}
              >
                {label}
              </motion.text>
            </g>
          ))}
        </>
      )}
      {kind === 'cells' &&
        [3, 8, 12, 19, 27, 34, 46].map((v, i) => (
          <motion.g key={v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.35 + i * 0.05 }}>
            <rect
              x={4 + i * 23}
              y="10"
              width="20"
              height="22"
              rx="5"
              strokeWidth="1.1"
              style={{ fill: i === 3 ? 'var(--mk-accent-soft)' : 'var(--mk-surface)', stroke: i === 3 ? 'var(--mk-accent)' : 'var(--mk-line-strong)' }}
            />
            <text x={14 + i * 23} y="25" textAnchor="middle" fontFamily={MONO} fontSize="9" style={{ fill: 'var(--text-primary)' }}>
              {v}
            </text>
          </motion.g>
        ))}
    </svg>
  );
}

function AskScene({ active }) {
  // idle · typing · reach for send · press · sent · reading · answer
  const { phase, cycle } = useSequence([900, 2200, 800, 260, 700, 1700, 3200], active, 6);
  const Q = QUESTIONS[cycle % QUESTIONS.length];
  const typed = useTypewriter(Q.q, phase === 1, phase >= 2);
  const sent = phase >= 4;
  const root = useRef(null);
  const input = useRef(null);
  const send = useRef(null);
  const intent = [
    ['intent', 'explain'],
    ['topic', Q.topic],
    ['visual', Q.visual],
  ];

  return (
    <div ref={root} className="absolute inset-0 flex flex-col">
      <div className="mk-dots relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 flex flex-col gap-3 p-4 @md:p-6">
          <AnimatePresence>
            {sent && (
              <motion.div
                key={`q-${cycle}`}
                className="ml-auto max-w-[80%] rounded-[16px] rounded-br-[5px] bg-[var(--text-primary)] px-3.5 py-2 text-[13px] leading-[1.45] text-[var(--bg-primary)]"
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
                style={{ transformOrigin: 'bottom right' }}
              >
                {Q.q}
              </motion.div>
            )}
            {phase >= 5 && (
              <motion.div
                key={`a-${cycle}`}
                className="flex max-w-[94%] gap-2.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <TutorMark />
                <div className="min-w-0 pt-[3px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {phase === 5 ? (
                      <motion.p key="reading" className="mk-shimmer text-[13px] leading-[1.45]" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        Reading your question…
                      </motion.p>
                    ) : (
                      <motion.p
                        key="reply"
                        className="text-[13px] leading-[1.45] text-[var(--text-primary)]"
                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.5, ease: EASE }}
                      >
                        {Q.reply}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {intent.map(([k, v], i) => (
                      <motion.span
                        key={k}
                        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: 0.45, ease: EASE, delay: 0.25 + i * 0.18 }}
                      >
                        <Chip>
                          <span className="text-[var(--text-tertiary)]">{k}</span>
                          {v}
                        </Chip>
                      </motion.span>
                    ))}
                  </div>
                  {phase === 6 && <MiniPreview kind={Q.preview} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="border-t border-[var(--mk-line)] p-3 @md:p-4">
        <Composer
          inputRef={input}
          sendRef={send}
          text={sent ? '' : typed}
          placeholder="Ask about anything…"
          caret={!sent && phase <= 3}
          pressed={phase === 3}
        />
      </div>
      <Cursor
        container={root}
        target={phase >= 2 ? send : input}
        anchor={phase >= 2 ? { x: 0.55, y: 0.6 } : { x: 0.72, y: -1.6 }}
        pressed={phase === 3}
        visible={phase >= 1 && phase <= 4}
      />
    </div>
  );
}

/* ── Scene 2 · Plan ───────────────────────────────────────────────── */

const PLAN = [
  { title: 'Earth’s yearly orbit', time: '0:00' },
  { title: 'The 23.4° tilt', time: '0:14' },
  { title: 'Direct versus slanted light', time: '0:36' },
  { title: 'Why the hemispheres swap', time: '1:02' },
];

function PlanGlyph({ i, drawn }) {
  const draw = { pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0.25 };
  const t = { duration: 0.7, ease: EASE };
  const s = { fill: 'none', strokeWidth: 1.3, strokeLinecap: 'round', style: { stroke: 'var(--text-primary)' } };
  const accent = { ...s, style: { stroke: 'var(--mk-accent)' } };
  return (
    <svg viewBox="0 0 34 22" className="h-[22px] w-[34px] shrink-0">
      {i === 0 && (
        <>
          <motion.ellipse cx={17} cy={11} rx={14} ry={6} {...s} initial={false} animate={draw} transition={t} />
          <circle cx={17} cy={11} r={2.4} style={{ fill: 'var(--mk-accent)', opacity: drawn ? 1 : 0.25, transition: 'opacity .4s' }} />
        </>
      )}
      {i === 1 && (
        <>
          <motion.circle cx={17} cy={11} r={6} {...s} initial={false} animate={draw} transition={t} />
          <motion.path d="M13.5 2 L20.5 20" {...accent} initial={false} animate={draw} transition={{ ...t, delay: 0.2 }} />
        </>
      )}
      {i === 2 && (
        <>
          <motion.path d="M3 18 L31 18" {...s} initial={false} animate={draw} transition={t} />
          <motion.path d="M8 3 L8 15 M14 3 L14 15 M24 4 L30 15" {...accent} initial={false} animate={draw} transition={{ ...t, delay: 0.15 }} />
        </>
      )}
      {i === 3 && (
        <>
          <motion.circle cx={17} cy={11} r={7.5} {...s} initial={false} animate={draw} transition={t} />
          <path d="M17 3.5 A 7.5 7.5 0 0 1 17 18.5 Z" style={{ fill: 'var(--mk-accent)', opacity: drawn ? 0.7 : 0, transition: 'opacity .5s' }} />
        </>
      )}
    </svg>
  );
}

function StatusMark({ state }) {
  return (
    <span className="relative grid h-4 w-4 shrink-0 place-items-center">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'drafting' && (
          <motion.svg key="spin" viewBox="0 0 16 16" className="h-4 w-4" exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.2 }}>
            <circle cx="8" cy="8" r="6" fill="none" strokeWidth="1.4" style={{ stroke: 'var(--mk-line-strong)' }} />
            <motion.circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="10 40"
              style={{ stroke: 'var(--text-primary)', transformBox: 'view-box', transformOrigin: '8px 8px' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
          </motion.svg>
        )}
        {state === 'done' && (
          <motion.svg key="done" viewBox="0 0 16 16" className="h-4 w-4" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
            <circle cx="8" cy="8" r="7" style={{ fill: 'var(--text-primary)' }} />
            <motion.path
              d="M5 8.2 L7.1 10.2 L11 6"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: 'var(--bg-primary)' }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}

function PlanScene({ active }) {
  // header · four scenes resolve in turn · hand-off to the renderer · hold
  const { phase } = useSequence([700, 850, 850, 850, 850, 700, 2600], active, 6);
  const resolved = Math.max(0, Math.min(phase - 1, PLAN.length));

  return (
    <div className="absolute inset-0 flex flex-col">
      <SceneBar>
        <span>lesson plan</span>
        <span>
          <Rolling value={resolved} className="text-[var(--text-primary)]" /> / {PLAN.length} scenes
        </span>
      </SceneBar>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-5 @md:px-6 @md:pt-6">
        <p className="text-[12px] font-medium text-[var(--text-tertiary)]">Earth science · ~2 min</p>
        <h4 className="mt-1.5 text-[19px] font-[450] tracking-[-0.025em] text-[var(--text-primary)] @md:text-[22px]">Why we have seasons</h4>
        <div className="relative mt-4 h-px w-full bg-[var(--mk-line)]">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[var(--text-primary)]"
            initial={false}
            animate={{ width: `${(resolved / PLAN.length) * 100}%` }}
            transition={{ duration: 0.7, ease: EASE }}
          />
        </div>
        <ul className="mt-1">
          {PLAN.map((row, i) => {
            const state = i < phase - 1 ? 'done' : i === phase - 1 ? 'drafting' : 'queued';
            return (
              <motion.li
                key={row.title}
                className="flex items-center gap-3 border-b border-[var(--mk-line)] py-2.5 @md:py-3"
                initial={false}
                animate={{ opacity: state === 'queued' ? 0.28 : 1 }}
                transition={{ duration: 0.4 }}
              >
                <span className="w-5 font-mono text-[10px] text-[var(--text-tertiary)]">{String(i + 1).padStart(2, '0')}</span>
                <PlanGlyph i={i} drawn={state === 'done'} />
                <span className={`min-w-0 flex-1 truncate text-[13px] @md:text-[13.5px] ${state === 'drafting' ? 'mk-shimmer' : 'text-[var(--text-primary)]'}`}>
                  {row.title}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">{row.time}</span>
                <StatusMark state={state} />
              </motion.li>
            );
          })}
        </ul>
        <div className="mt-auto pt-3">
          <AnimatePresence>
            {phase >= 5 && (
              <motion.div
                className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--mk-line)] bg-[var(--mk-sunken)] px-3 py-2.5 font-mono text-[10.5px] text-[var(--text-secondary)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <LiveDot label="Rendering scene 01" />
                <span className="relative h-px w-16 overflow-hidden bg-[var(--mk-line-strong)] @md:w-24">
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-[var(--text-primary)]"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.6, ease: [0.4, 0, 0.2, 1] }}
                  />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Scene 3 · Draw ───────────────────────────────────────────────── */

function DrawScene({ active }) {
  const { phase, cycle } = useSequence([1900, 2100, 2300, 2100, 2500, 3200], active, 5);
  const s = SEASONS[phase];

  return (
    <div className="absolute inset-0 flex flex-col">
      <SceneBar>
        <span>earth science</span>
        <span className="flex items-center gap-4">
          <Stat label="month" value={s.month} />
          <span className="hidden @sm:inline-flex">
            <Stat label="north" value={s.north} />
          </span>
        </span>
      </SceneBar>
      <div className="mk-dots relative flex flex-1 items-center justify-center px-[4%]">
        <div className="w-full max-w-[540px]">
          <SeasonsViz state={s} drawKey={cycle} />
        </div>
      </div>
      <div className="p-3 @md:p-4">
        <NarrationBar text={s.note} progress={(phase + 1) / SEASONS.length} time={`0:${String(phase * 11).padStart(2, '0')}`} />
      </div>
    </div>
  );
}

/* ── Scene 4 · Explore ────────────────────────────────────────────── */

const FOLLOW_UP = 'so is it winter in Australia?';
const DRAG = { duration: 1.2, ease: [0.65, 0, 0.35, 1] };
const REWIND_TO = 2;

function ExploreScene({ active }) {
  // reach for playhead · drag back · release · reach for input · type · send · answer
  const { phase } = useSequence([1000, 1250, 700, 750, 1600, 280, 3600], active, 6);
  const [shown, setShown] = useState(SEASONS.length - 1);
  const root = useRef(null);
  const trackRef = useRef(null);
  const input = useRef(null);
  const send = useRef(null);
  const [track, setTrack] = useState(null);
  const tick = useResizeTick(root);

  useLayoutEffect(() => {
    if (root.current && trackRef.current) setTrack(offsetIn(trackRef.current, root.current));
  }, [tick]);

  // While the playhead is dragged back, the canvas rewinds scene by scene.
  useEffect(() => {
    if (phase === 0) setShown(SEASONS.length - 1);
    if (phase !== 1) return undefined;
    const id = setInterval(() => setShown((s) => (s > REWIND_TO ? s - 1 : s)), 300);
    return () => clearInterval(id);
  }, [phase]);

  const pct = phase >= 1 ? (REWIND_TO / (SEASONS.length - 1)) * 100 : 100;
  const typed = useTypewriter(FOLLOW_UP, phase === 4, phase === 5);
  const asked = phase >= 6;
  const cursorProps =
    phase <= 2 && track
      ? {
          point: { x: track.x + (track.w * pct) / 100, y: track.y + track.h / 2 },
          transition: phase === 1 ? DRAG : undefined,
        }
      : { target: phase === 5 ? send : input, anchor: phase === 5 ? { x: 0.55, y: 0.6 } : { x: 0.35, y: 0.55 } };

  return (
    <div ref={root} className="absolute inset-0 flex flex-col">
      <div className="mk-dots relative flex-1 overflow-hidden">
        <div className="absolute inset-x-[5%] top-[5%]">
          <div className="mx-auto max-w-[470px]">
            <SeasonsViz state={SEASONS[shown]} ring={asked} rewind={phase >= 1 && phase <= 2} />
          </div>
        </div>
        <AnimatePresence>
          {asked && (
            <motion.div
              className="absolute inset-x-3 bottom-3 rounded-[14px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] p-3 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)] @md:bottom-4 @md:left-auto @md:right-4 @md:w-[64%]"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={SPRING}
            >
              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--text-tertiary)]">
                <span>answer · pinned to 0:22</span>
                <span className="text-[var(--mk-accent)]">● june</span>
              </div>
              <motion.p
                className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--text-primary)]"
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
              >
                Yes. In June the south leans away from the Sun, so Australia has its winter.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-[var(--mk-line)] px-4 pb-2 pt-3 @md:px-5">
        <div className="flex items-center justify-between font-mono text-[10px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-2">
            <Rolling value={String(shown + 1).padStart(2, '0')} className="text-[var(--text-primary)]" />
            <span>/ 06</span>
            <span className="hidden @sm:inline">· {SEASONS[shown].title}</span>
          </span>
          <span>{phase >= 1 ? 'rewound' : 'end of lesson'}</span>
        </div>
        <div ref={trackRef} className="relative mt-2 h-5">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--mk-line-strong)]" />
          {SEASONS.map((_, i) => (
            <span
              key={i}
              className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-[var(--mk-line-strong)]"
              style={{ left: `${(i / (SEASONS.length - 1)) * 100}%` }}
            />
          ))}
          <motion.div
            className="absolute left-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-[var(--text-primary)]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={phase === 1 ? DRAG : { duration: 0.8, ease: EASE }}
          />
          <motion.div
            className="absolute top-1/2 -ml-[7px] -mt-[7px] h-[14px] w-[14px] rounded-full border-[1.5px] border-[var(--text-primary)] bg-[var(--mk-surface)]"
            initial={false}
            animate={{ left: `${pct}%`, scale: phase === 1 ? 1.2 : 1 }}
            transition={{ left: phase === 1 ? DRAG : { duration: 0.8, ease: EASE }, scale: { duration: 0.2 } }}
          />
        </div>
      </div>

      <div className="px-3 pb-3 @md:px-4 @md:pb-4">
        <Composer
          compact
          inputRef={input}
          sendRef={send}
          text={asked ? '' : typed}
          placeholder="Ask about this moment…"
          caret={phase === 4 || phase === 5}
          pressed={phase === 5}
        />
      </div>

      <Cursor container={root} {...cursorProps} pressed={phase === 1 || phase === 5} visible={phase <= 5} />
    </div>
  );
}

/* ── Stage ────────────────────────────────────────────────────────── */

const SCENES = [AskScene, PlanScene, DrawScene, ExploreScene];
const LABELS = ['new session', 'planning lesson', 'seasons · live', 'seasons · rewind'];

export default function LessonStage({ step, active, className = '', bodyClassName = 'aspect-[1/1.08] sm:aspect-[6/5]' }) {
  const Scene = SCENES[step];
  return (
    <MockFrame
      label={`tutorboard — ${LABELS[step]}`}
      meta={<LiveDot on={active} label={<span className="hidden sm:inline">live</span>} />}
      className={className}
      bodyClassName={bodyClassName}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={step}
          className="absolute inset-0"
          initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.985 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)', scale: 1.01 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <Scene active={active} />
        </motion.div>
      </AnimatePresence>
    </MockFrame>
  );
}
