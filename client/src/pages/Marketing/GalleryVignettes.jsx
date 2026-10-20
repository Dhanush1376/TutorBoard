import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion';
import { EASE, SPRING, useSequence } from './kit';

/*
 * The landing gallery's subject scenes. Each one is a short looping lesson with
 * named steps, so a card shows how an idea is built up, not just the end state.
 */

const MONO = 'JetBrains Mono, ui-monospace, monospace';
const SANS = 'Geist, Inter, sans-serif';
const ink = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
const faint = { ...ink, strokeWidth: 1.1, style: { stroke: 'var(--mk-line-strong)' } };
const accent = { ...ink, style: { stroke: 'var(--mk-accent)' } };
const lbl = (fill = 'var(--text-tertiary)', size = 11) => ({ fontFamily: MONO, fontSize: size, style: { fill } });
const show = (on, delay = 0) => ({
  initial: false,
  animate: { opacity: on ? 1 : 0 },
  transition: { duration: 0.5, ease: EASE, delay: on ? delay : 0 },
});
const draw = (on, delay = 0, duration = 0.8) => ({
  initial: false,
  animate: { pathLength: on ? 1 : 0, opacity: on ? 1 : 0 },
  transition: { duration: on ? duration : 0.3, ease: EASE, delay: on ? delay : 0 },
});

/** "02 · covalent bonds" in the corner, rolling as the lesson advances. */
function Steps({ steps, step, right }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center justify-between font-mono text-[10.5px] text-[var(--text-tertiary)]">
      <span className="relative h-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={step}
            className="block"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="text-[var(--text-primary)]">{String(step + 1).padStart(2, '0')}</span> · {steps[step]}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="flex items-center gap-2">
        {right}
        <span className="flex gap-1">
          {steps.map((s, i) => (
            <span key={s} className={`h-[3px] rounded-full transition-all duration-500 ${i === step ? 'w-4 bg-[var(--mk-accent)]' : i < step ? 'w-1.5 bg-[var(--text-tertiary)]' : 'w-1.5 bg-[var(--mk-line-strong)]'}`} />
          ))}
        </span>
      </span>
    </div>
  );
}

/* ── Chemistry: building a water molecule ─────────────────────────── */

const O = { x: 200, y: 108 };
const BOND = 62;
const HALF = (104.5 / 2) * (Math.PI / 180);
const SIDES = [-1, 1];
const H = SIDES.map((s) => ({ x: O.x + s * BOND * Math.sin(HALF), y: O.y + BOND * Math.cos(HALF) }));
const unit = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
};
const bondPair = H.map((h) => {
  const d = unit(O, h);
  const m = { x: (O.x + h.x) / 2, y: (O.y + h.y) / 2 };
  const n = { x: -d.y, y: d.x };
  return [
    { x: m.x + n.x * 4.5, y: m.y + n.y * 4.5 },
    { x: m.x - n.x * 4.5, y: m.y - n.y * 4.5 },
  ];
});
const LONE = [-125, -55].flatMap((deg) => {
  const a = (deg * Math.PI) / 180;
  const c = { x: O.x + Math.cos(a) * 43, y: O.y + Math.sin(a) * 43 };
  const n = { x: -Math.sin(a) * 5, y: Math.cos(a) * 5 };
  return [
    { x: c.x + n.x, y: c.y + n.y },
    { x: c.x - n.x, y: c.y - n.y },
  ];
});
const WATER_STEPS = ['valence electrons', 'covalent bonds', 'bond angle', 'polarity'];

export function WaterScene({ active }) {
  const { phase } = useSequence([1600, 1700, 1600, 1900, 2800], active, 4);
  const step = Math.min(phase, 3);
  const docked = phase >= 1;
  const gid = useId().replace(/:/g, '');

  return (
    <div className="absolute inset-0">
      <Steps steps={WATER_STEPS} step={step} right={<span>H₂O</span>} />
      <svg viewBox="0 0 400 240" className="absolute inset-x-[3%] bottom-0 top-8 h-[calc(100%-2rem)] w-[94%]">
        <defs>
          <radialGradient id={`cloud-${gid}`}>
            <stop offset="0%" stopColor="var(--mk-accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--mk-accent)" stopOpacity="0" />
          </radialGradient>
          <marker id={`dip-${gid}`} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-accent)' }} />
          </marker>
        </defs>

        {/* electron density pulled toward oxygen */}
        <motion.circle cx={O.x} cy={O.y} r="62" fill={`url(#cloud-${gid})`} {...show(phase >= 3)} />

        {H.map((h, i) => (
          <motion.line key={`b${i}`} x1={O.x} y1={O.y} x2={h.x} y2={h.y} {...ink} strokeWidth="2.2" {...draw(docked, 0.5, 0.5)} />
        ))}

        {/* angle and length */}
        <motion.path d={`M ${O.x - 24} ${O.y + 19} A 31 31 0 0 0 ${O.x + 24} ${O.y + 19}`} {...accent} strokeWidth="1.3" {...draw(phase >= 2, 0, 0.6)} />
        <motion.text x={O.x} y={O.y + 64} textAnchor="middle" {...lbl('var(--mk-accent)', 12)} {...show(phase >= 2, 0.3)}>
          104.5°
        </motion.text>
        <motion.text x={(O.x + H[0].x) / 2 - 30} y={(O.y + H[0].y) / 2 - 4} textAnchor="end" {...lbl('var(--text-secondary)', 10.5)} {...show(phase >= 2, 0.5)}>
          96 pm
        </motion.text>

        {/* oxygen */}
        <circle cx={O.x} cy={O.y} r="28" style={{ fill: 'var(--mk-surface)' }} />
        <circle cx={O.x} cy={O.y} r="28" strokeWidth="1.5" style={{ fill: 'var(--mk-accent-soft)', stroke: 'var(--mk-accent)' }} />
        <text x={O.x} y={O.y + 6} textAnchor="middle" fontFamily={SANS} fontSize="18" style={{ fill: 'var(--text-primary)' }}>
          O
        </text>

        {/* hydrogens fly in from either side */}
        {H.map((h, i) => (
          <motion.g key={`h${i}`} initial={false} animate={{ x: docked ? 0 : SIDES[i] * 120 }} transition={{ type: 'spring', stiffness: 70, damping: 15 }}>
            <circle cx={h.x} cy={h.y} r="16" strokeWidth="1.5" style={{ fill: 'var(--mk-surface)', stroke: 'var(--text-primary)' }} />
            <text x={h.x} y={h.y + 5} textAnchor="middle" fontFamily={SANS} fontSize="14" style={{ fill: 'var(--text-primary)' }}>
              H
            </text>
          </motion.g>
        ))}

        {/* oxygen's lone pairs */}
        {LONE.map((p, i) => (
          <motion.circle key={`l${i}`} cx={p.x} cy={p.y} r="3" style={{ fill: 'var(--text-primary)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + i * 0.08 }} />
        ))}

        {/* the bonding electrons: one from oxygen, one from hydrogen, ending up shared */}
        {H.map((h, i) => {
          const d = unit(O, h);
          const fromO = { x: O.x + d.x * 40, y: O.y + d.y * 40 };
          const fromH = { x: h.x + SIDES[i] * 120 - d.x * 24, y: h.y - d.y * 24 };
          return (
            <g key={`e${i}`}>
              <motion.circle
                r="3.2"
                initial={false}
                animate={{ cx: docked ? bondPair[i][0].x : fromO.x, cy: docked ? bondPair[i][0].y : fromO.y }}
                transition={{ duration: 0.9, ease: EASE, delay: docked ? 0.6 : 0 }}
                style={{ fill: docked ? 'var(--mk-accent)' : 'var(--text-primary)', transition: 'fill .4s' }}
              />
              <motion.circle
                r="3.2"
                initial={false}
                animate={{ cx: docked ? bondPair[i][1].x : fromH.x, cy: docked ? bondPair[i][1].y : fromH.y }}
                transition={{ type: 'spring', stiffness: 70, damping: 15 }}
                style={{ fill: docked ? 'var(--mk-accent)' : 'var(--text-primary)', transition: 'fill .4s' }}
              />
            </g>
          );
        })}

        {/* partial charges and the dipole */}
        <motion.text x={O.x + 48} y={O.y - 30} {...lbl('var(--mk-accent)', 13)} {...show(phase >= 3, 0.2)}>
          δ−
        </motion.text>
        {H.map((h, i) => (
          <motion.text key={`d${i}`} x={h.x + SIDES[i] * 26} y={h.y + 26} textAnchor="middle" {...lbl('var(--text-secondary)', 13)} {...show(phase >= 3, 0.35)}>
            δ+
          </motion.text>
        ))}
        <motion.line x1={O.x} y1="228" x2={O.x} y2={H[0].y + 6} {...accent} strokeWidth="1.6" markerEnd={`url(#dip-${gid})`} {...draw(phase >= 3, 0.5, 0.6)} />
        <motion.line x1={O.x - 6} y1="220" x2={O.x + 6} y2="220" {...accent} strokeWidth="1.6" {...draw(phase >= 3, 0.5, 0.3)} />
        <motion.text x={O.x + 12} y="224" {...lbl('var(--mk-accent)', 10.5)} {...show(phase >= 3, 0.8)}>
          μ = 1.85 D
        </motion.text>
      </svg>
    </div>
  );
}

/* ── Economics: a demand shock moves the equilibrium ──────────────── */

const AX = { x0: 54, y0: 214, x1: 376, y1: 22 };
const sY = (x) => 205 - 0.5926 * (x - 70);
const dY = (x, shift = 0) => 45 + 0.6957 * (x - 70 - shift);
const E1 = { x: 194.2, y: sY(194.2) };
const E2 = { x: 223.9, y: sY(223.9) };
const SHIFT = 55;
const MARKET_STEPS = ['axes', 'supply', 'equilibrium', 'demand shock', 'surplus'];

function Guides({ e, on, label, delay = 0 }) {
  return (
    <motion.g {...show(on, delay)}>
      <line x1={AX.x0} y1={e.y} x2={e.x} y2={e.y} {...faint} strokeDasharray="2 4" />
      <line x1={e.x} y1={e.y} x2={e.x} y2={AX.y0} {...faint} strokeDasharray="2 4" />
      <text x={AX.x0 - 6} y={e.y + 4} textAnchor="end" {...lbl('var(--text-secondary)', 10.5)}>
        P{label}
      </text>
      <text x={e.x} y={AX.y0 + 15} textAnchor="middle" {...lbl('var(--text-secondary)', 10.5)}>
        Q{label}
      </text>
    </motion.g>
  );
}

export function MarketScene({ active }) {
  const { phase } = useSequence([1100, 1000, 1700, 2300, 1800, 2800], active, 5);
  const step = Math.min(phase, 4);
  const shifted = phase >= 3;
  const d2At25 = 70 + SHIFT + (25 - 45) / 0.6957;

  return (
    <div className="absolute inset-0">
      <Steps steps={MARKET_STEPS} step={step} right={<span>market</span>} />
      <svg viewBox="0 0 400 240" className="absolute inset-x-[3%] bottom-0 top-8 h-[calc(100%-2rem)] w-[94%]">
        <defs>
          <marker id="mk-ax" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-line-strong)' }} />
          </marker>
        </defs>

        {/* surplus (drawn first, under everything) */}
        <motion.polygon
          points={`${AX.x0},${E2.y} ${E2.x},${E2.y} ${d2At25},25 ${AX.x0},25`}
          style={{ fill: 'var(--mk-accent-soft)' }}
          {...show(phase >= 4)}
        />
        <motion.polygon
          points={`${AX.x0},${E2.y} ${E2.x},${E2.y} 70,205 ${AX.x0},205`}
          style={{ fill: 'rgba(var(--text-primary-rgb),0.07)' }}
          {...show(phase >= 4, 0.2)}
        />
        <motion.text x="78" y="62" {...lbl('var(--mk-accent)', 10.5)} {...show(phase >= 4, 0.4)}>
          consumer surplus
        </motion.text>
        <motion.text x="62" y="186" {...lbl('var(--text-secondary)', 10.5)} {...show(phase >= 4, 0.55)}>
          producer surplus
        </motion.text>

        {/* axes */}
        <motion.path d={`M${AX.x0} ${AX.y0} L${AX.x0} ${AX.y1}`} {...faint} markerEnd="url(#mk-ax)" {...draw(true, 0, 0.6)} />
        <motion.path d={`M${AX.x0} ${AX.y0} L${AX.x1} ${AX.y0}`} {...faint} markerEnd="url(#mk-ax)" {...draw(true, 0.15, 0.6)} />
        <text x={AX.x0 + 8} y={AX.y1 + 6} {...lbl()}>price</text>
        <text x={AX.x1} y={AX.y0 - 8} textAnchor="end" {...lbl()}>quantity</text>

        {/* supply */}
        <motion.path d={`M70 ${sY(70)} L340 ${sY(340)}`} {...ink} {...draw(phase >= 1)} />
        <motion.text x="344" y={sY(340) + 2} {...lbl('var(--text-primary)', 12)} {...show(phase >= 1, 0.6)}>
          S
        </motion.text>

        {/* original demand: solid, then a ghost once demand moves */}
        <motion.path d={`M70 ${dY(70)} L300 ${dY(300)}`} {...(shifted ? faint : ink)} strokeDasharray={shifted ? '3 4' : undefined} {...draw(phase >= 2)} />
        <motion.text x="304" y={dY(300) + 4} {...lbl(shifted ? 'var(--text-tertiary)' : 'var(--text-primary)', 12)} {...show(phase >= 2, 0.6)}>
          D₁
        </motion.text>
        <Guides e={E1} on={phase >= 2} label="₁" delay={0.7} />
        <motion.circle cx={E1.x} cy={E1.y} r="5" style={{ fill: 'var(--text-primary)' }} {...show(phase >= 2, 0.7)} />

        {/* the shock */}
        <motion.g initial={false} animate={{ x: shifted ? SHIFT : 0, opacity: shifted ? 1 : 0 }} transition={{ x: { duration: 1.1, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.3 } }}>
          <path d={`M70 ${dY(70)} L300 ${dY(300)}`} {...ink} />
          <text x="304" y={dY(300) + 4} {...lbl('var(--text-primary)', 12)}>
            D₂
          </text>
        </motion.g>
        <motion.g {...show(shifted)}>
          <line x1="128" y1="84" x2="170" y2="84" {...accent} markerEnd="url(#mk-ax)" style={{ stroke: 'var(--mk-accent)' }} />
          <text x="128" y="76" {...lbl('var(--mk-accent)', 10.5)}>demand ↑</text>
        </motion.g>
        <Guides e={E2} on={shifted} label="₂" delay={1.2} />
        <motion.circle cx={E2.x} cy={E2.y} r="5.5" style={{ fill: 'var(--mk-accent)' }} {...show(shifted, 1.1)} />
        <motion.text x={E2.x + 10} y={E2.y - 8} {...lbl('var(--mk-accent)', 10.5)} {...show(shifted, 1.3)}>
          new equilibrium
        </motion.text>
      </svg>
    </div>
  );
}

/* ── Physics: a pendulum, with its numbers ────────────────────────── */

const PIV = { x: 150, y: 36 };
const ROD = 128;
const THETA0 = 28 * (Math.PI / 180);
const PERIOD = 2.01;
const GHOSTS = [0.16, 0.32, 0.48, 0.64];
const bobAt = (ph) => {
  const th = THETA0 * Math.cos(ph);
  return { x: PIV.x + ROD * Math.sin(th), y: PIV.y + ROD * Math.cos(th), th };
};

function Ghost({ ph, lag, i }) {
  const cx = useTransform(ph, (v) => bobAt(v - lag).x);
  const cy = useTransform(ph, (v) => bobAt(v - lag).y);
  return <motion.circle cx={cx} cy={cy} r={10 - i * 1.6} style={{ fill: 'var(--text-primary)', opacity: 0.16 - i * 0.03 }} />;
}

const PEND_STEPS = ['swing', 'angle', 'velocity', 'energy'];

export function PendulumScene({ active }) {
  const reduce = useReducedMotion();
  const ph = useMotionValue(0.6);
  const { phase } = useSequence([2000, 2000, 2000, 3600], active, 3);
  const step = Math.min(phase, 3);

  useEffect(() => {
    if (!active || reduce) return undefined;
    const c = animate(ph, ph.get() + Math.PI * 2, { duration: PERIOD, ease: 'linear', repeat: Infinity });
    return () => c.stop();
  }, [active, reduce, ph]);

  const bx = useTransform(ph, (v) => bobAt(v).x);
  const by = useTransform(ph, (v) => bobAt(v).y);
  const arc = useTransform(ph, (v) => {
    const { th } = bobAt(v);
    const r = 40;
    const ex = PIV.x + r * Math.sin(th);
    const ey = PIV.y + r * Math.cos(th);
    return `M ${PIV.x} ${PIV.y + r} A ${r} ${r} 0 0 ${th > 0 ? 0 : 1} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  });
  // Angular velocity is −θ₀·ω·sin(ωt); the arrow is tangent to the swing.
  const vx2 = useTransform(ph, (v) => {
    const { x, th } = bobAt(v);
    return x + Math.cos(th) * -Math.sin(v) * 48;
  });
  const vy2 = useTransform(ph, (v) => {
    const { y, th } = bobAt(v);
    return y - Math.sin(th) * -Math.sin(v) * 48;
  });
  const ke = useTransform(ph, (v) => 190 - 110 * Math.sin(v) ** 2);
  const pe = useTransform(ph, (v) => 190 - 110 * Math.cos(v) ** 2);
  const thetaText = useTransform(ph, (v) => `${((THETA0 * Math.cos(v) * 180) / Math.PI).toFixed(1).padStart(5, ' ')}°`);

  return (
    <div className="absolute inset-0">
      <Steps
        steps={PEND_STEPS}
        step={step}
        right={
          <span className="tabular-nums">
            θ =<motion.span className="text-[var(--text-primary)]">{thetaText}</motion.span>
          </span>
        }
      />
      <svg viewBox="0 0 400 240" className="absolute inset-x-[3%] bottom-0 top-8 h-[calc(100%-2rem)] w-[94%]">
        <defs>
          <marker id="pd-v" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" style={{ fill: 'var(--mk-accent)' }} />
          </marker>
        </defs>
        <line x1={PIV.x - 50} y1={PIV.y} x2={PIV.x + 50} y2={PIV.y} {...faint} strokeWidth="1.6" />
        <line x1={PIV.x} y1={PIV.y} x2={PIV.x} y2={PIV.y + ROD + 22} {...faint} strokeDasharray="2 4" />
        <path
          d={`M ${bobAt(Math.PI).x} ${bobAt(Math.PI).y} A ${ROD} ${ROD} 0 0 0 ${bobAt(0).x} ${bobAt(0).y}`}
          {...faint}
          strokeDasharray="1 5"
        />
        {GHOSTS.map((lag, i) => (
          <Ghost key={lag} ph={ph} lag={lag} i={i} />
        ))}
        <motion.line x1={PIV.x} y1={PIV.y} x2={bx} y2={by} {...ink} />
        <motion.path d={arc} {...accent} strokeWidth="1.3" {...show(phase >= 1)} />
        <motion.text x={PIV.x + 6} y={PIV.y + 60} {...lbl('var(--mk-accent)', 11)} {...show(phase >= 1, 0.2)}>
          θ
        </motion.text>
        <motion.circle cx={bx} cy={by} r="11" style={{ fill: 'var(--text-primary)' }} />
        <motion.line x1={bx} y1={by} x2={vx2} y2={vy2} {...accent} strokeWidth="1.8" markerEnd="url(#pd-v)" {...show(phase >= 2)} />
        <motion.text x="18" y="214" {...lbl('var(--mk-accent)', 10.5)} {...show(phase >= 2, 0.3)}>
          v is fastest at the bottom
        </motion.text>
        <circle cx={PIV.x} cy={PIV.y} r="3" style={{ fill: 'var(--text-primary)' }} />

        {/* energy: kinetic and potential trade off, the total never moves */}
        <motion.g {...show(phase >= 3)}>
          <line x1="300" y1="80" x2="372" y2="80" {...faint} strokeDasharray="3 4" />
          <text x="372" y="72" textAnchor="end" {...lbl()}>E total</text>
          <line x1="310" y1="190" x2="310" y2="80" {...faint} strokeWidth="16" style={{ stroke: 'var(--mk-ink-soft)' }} />
          <line x1="350" y1="190" x2="350" y2="80" {...faint} strokeWidth="16" style={{ stroke: 'var(--mk-ink-soft)' }} />
          <motion.line x1="310" y1="190" x2="310" y2={ke} strokeWidth="16" style={{ stroke: 'var(--mk-accent)' }} />
          <motion.line x1="350" y1="190" x2="350" y2={pe} strokeWidth="16" style={{ stroke: 'var(--text-primary)' }} />
          <text x="310" y="206" textAnchor="middle" {...lbl('var(--text-secondary)', 10.5)}>KE</text>
          <text x="350" y="206" textAnchor="middle" {...lbl('var(--text-secondary)', 10.5)}>PE</text>
        </motion.g>
        <text x="18" y="232" {...lbl('var(--text-tertiary)', 10.5)}>
          T = 2π√(L/g) = {PERIOD.toFixed(2)} s · L = 1.0 m
        </text>
      </svg>
    </div>
  );
}

/* ── Genetics: the double helix, read pair by pair ────────────────── */

const SEQ = 'ATGCGTACCGAT';
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const RUNG_X = Array.from({ length: SEQ.length }, (_, i) => 52 + i * 27);
const strandPath = (phase, sign) =>
  Array.from({ length: 67 }, (_, i) => {
    const x = 40 + i * 5;
    const y = 104 + sign * 46 * Math.sin((x - 40) / 27 + phase);
    return `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
  }).join(' ');

function BasePair({ phase, x, base }) {
  const y1 = useTransform(phase, (p) => 104 + 46 * Math.sin((x - 40) / 27 + p));
  const y2 = useTransform(phase, (p) => 104 - 46 * Math.sin((x - 40) / 27 + p));
  const facing = useTransform(phase, (p) => 0.25 + 0.75 * Math.abs(Math.cos((x - 40) / 27 + p)));
  const topY = useTransform([y1, y2], ([a, b]) => Math.min(a, b) - 9);
  const botY = useTransform([y1, y2], ([a, b]) => Math.max(a, b) + 17);
  const gc = base === 'G' || base === 'C';
  return (
    <g>
      <motion.line x1={x} x2={x} y1={y1} y2={y2} strokeWidth="3" strokeLinecap="round" style={{ stroke: gc ? 'var(--mk-accent)' : 'var(--text-secondary)', opacity: facing }} />
      <motion.g style={{ x, y: topY, opacity: facing }}>
        <text textAnchor="middle" {...lbl('var(--text-primary)', 10.5)}>
          {base}
        </text>
      </motion.g>
      <motion.g style={{ x, y: botY, opacity: facing }}>
        <text textAnchor="middle" {...lbl('var(--text-primary)', 10.5)}>
          {PAIR[base]}
        </text>
      </motion.g>
    </g>
  );
}

export function HelixScene({ active }) {
  const reduce = useReducedMotion();
  const phase = useMotionValue(0);
  const head = useMotionValue(0);
  const [reading, setReading] = useState(0);

  useEffect(() => {
    if (!active || reduce) return undefined;
    const a = animate(phase, phase.get() + Math.PI * 2, { duration: 7, ease: 'linear', repeat: Infinity });
    const b = animate(head, [0, SEQ.length - 1], { duration: 7.2, ease: 'linear', repeat: Infinity, repeatDelay: 0.6 });
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, reduce, phase, head]);

  useMotionValueEvent(head, 'change', (v) => {
    const k = Math.round(v);
    if (k !== reading) setReading(k);
  });

  const a = useTransform(phase, (p) => strandPath(p, 1));
  const b = useTransform(phase, (p) => strandPath(p, -1));
  const headX = useTransform(head, (v) => 52 + v * 27 - 11);
  const base = SEQ[reading];
  const gc = base === 'G' || base === 'C';

  return (
    <div className="absolute inset-0">
      <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center justify-between font-mono text-[10.5px] text-[var(--text-tertiary)]">
        <span>
          reading <span className="text-[var(--text-primary)]">{String(reading + 1).padStart(2, '0')}</span> / {SEQ.length}
        </span>
        <span className="relative h-4 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={reading} className="block" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.3 }}>
              <span className={gc ? 'text-[var(--mk-accent)]' : 'text-[var(--text-primary)]'}>
                {base}–{PAIR[base]}
              </span>{' '}
              · {gc ? 3 : 2} hydrogen bonds
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <svg viewBox="0 0 400 240" className="absolute inset-x-[3%] bottom-0 top-8 h-[calc(100%-2rem)] w-[94%]">
        <motion.rect y="36" width="22" height="146" rx="6" fill="none" strokeWidth="1.2" strokeDasharray="3 3" style={{ x: headX, stroke: 'var(--text-primary)' }} />
        {RUNG_X.map((x, i) => (
          <BasePair key={x} phase={phase} x={x} base={SEQ[i]} />
        ))}
        <motion.path d={a} {...ink} strokeWidth="2.2" />
        <motion.path d={b} {...ink} strokeWidth="2.2" />
        <text x="40" y="44" {...lbl()}>5′</text>
        <text x="40" y="176" {...lbl()}>3′</text>
        <g transform="translate(40 222)">
          <line x1="0" y1="-4" x2="14" y2="-4" strokeWidth="3" style={{ stroke: 'var(--text-secondary)' }} />
          <text x="20" y="0" {...lbl('var(--text-secondary)', 10.5)}>A–T · 2 H-bonds</text>
          <line x1="150" y1="-4" x2="164" y2="-4" strokeWidth="3" style={{ stroke: 'var(--mk-accent)' }} />
          <text x="170" y="0" {...lbl('var(--text-secondary)', 10.5)}>G–C · 3 H-bonds</text>
        </g>
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} />
      </svg>
    </div>
  );
}
