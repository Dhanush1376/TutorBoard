import {
  neuron,
  lattice,
  prism,
  saturn,
  terrain,
  colosseum,
  market,
  gears,
  lorenz,
  book,
  network,
} from './authShapes';

/*
 * The sign-in film's running order. Twelve unique subjects completely distinct
 * from the landing page, rendered in deep anatomical/physical detail:
 *
 *   Biology: Neuron with signal pulse down axon
 *   Chemistry: NaCl salt crystal lattice
 *   Physics: White light refracting into a spectrum through a prism
 *   Astronomy: Saturn with cloud bands and Cassini ring divisions
 *   Geography: Mountain range contour map with flowing river
 *   History: Roman Colosseum with tiered arches & arena
 *   Medicine: Beating anatomical heart with synchronized ECG trace
 *   Economics: Supply & demand equilibrium market curves
 *   Engineering: Three meshing mechanical gears with rotating teeth
 *   Mathematics: Lorenz strange attractor chaotic system
 *   Literature: Open leather-bound book with turning curling page
 *   Computer Science: Deep neural network with forward-flowing signal pulses
 *
 * All transitions use gentle, silky smooth dissolves ('drift' / 'dissolve')
 * to eliminate jarring bursts, snaps, or harsh camera jerks.
 */

export const AUTH_SUBJECTS = [
  { name: 'Biology', shape: neuron, concept: 'Action potential flowing down the axon of a neuron', hold: 3.5, morph: 1.8, style: 'drift' },
  { name: 'Chemistry', shape: lattice, concept: 'NaCl ionic crystal lattice showing sodium and chloride bonds', hold: 3.2, morph: 1.6, style: 'drift' },
  { name: 'Physics', shape: prism, concept: 'Dispersion of white light refracted into a continuous spectrum', hold: 3.4, morph: 1.7, style: 'drift' },
  { name: 'Astronomy', shape: saturn, concept: 'Rotating Kerr black hole with gravitationally lensed accretion disk', hold: 3.5, morph: 1.8, style: 'drift' },
  { name: 'Geography', shape: terrain, concept: 'Alpine stratovolcano mountain massif with carved ravines and lava flows', hold: 3.6, morph: 1.8, style: 'drift' },
  { name: 'History', shape: colosseum, concept: 'Roman Colosseum with subterranean hypogeum and 3 tiers of arches', hold: 3.4, morph: 1.7, style: 'drift' },
  { name: 'Economics', shape: market, concept: 'Market equilibrium intersecting supply and demand curves', hold: 3.3, morph: 1.7, style: 'drift' },
  { name: 'Engineering', shape: gears, concept: 'Three mechanical spur gears interlocking with synchronous teeth', hold: 3.5, morph: 1.8, style: 'drift' },
  { name: 'Mathematics', shape: lorenz, concept: 'Golden ratio logarithmic spiral and geometric stellated icosahedron', hold: 3.5, morph: 1.8, style: 'drift' },
  { name: 'Literature', shape: book, concept: 'Open manuscript with rows of text and curling turned pages', hold: 3.5, morph: 1.8, style: 'drift' },
  { name: 'Computer science', shape: network, concept: 'Deep neural network with forward-propagating signal pulses', hold: 3.5, morph: 1.8, style: 'drift' },
];

const easeSine = (f) => 0.5 - 0.5 * Math.cos(Math.PI * f);
const easeSmoother = (f) => f * f * f * (f * (f * 6 - 15) + 10);

// Smooth, fluid transitions with subtle flutter and zero harsh camera snapping
const STYLES = {
  drift: { ease: easeSine, burst: 0.38, swirl: 0.25, stagger: 0.35, whip: 0.2, pull: 0.03 },
  swirl: { ease: easeSmoother, burst: 0.45, swirl: 1.2, stagger: 0.3, whip: 0.3, pull: 0.04 },
  dissolve: { ease: easeSine, burst: 0.25, swirl: 0.1, stagger: 0.4, whip: 0.1, pull: 0.02 },
};
export const styleOf = (name) => STYLES[name] || STYLES.drift;

/** The whole loop as back-to-back segments, in seconds. */
function buildTimeline() {
  const segs = [];
  let t = 0;
  const push = (seg) => {
    segs.push({ ...seg, start: t });
    t += seg.dur;
  };
  const last = AUTH_SUBJECTS.length - 1;
  push({ kind: 'galaxy', dur: 3.2, from: 0, style: 'drift' });
  push({ kind: 'open', dur: 2.6, from: 0, style: 'drift' });
  AUTH_SUBJECTS.forEach((s, i) => {
    push({ kind: 'hold', dur: s.hold, from: i, style: s.style });
    if (i < last) push({ kind: 'morph', dur: AUTH_SUBJECTS[i + 1].morph, from: i, to: i + 1, style: AUTH_SUBJECTS[i + 1].style });
  });
  push({ kind: 'close', dur: 2.8, from: last, style: 'drift' });
  return { segs, total: t };
}

export const TIMELINE = buildTimeline();

/**
 * Where the loop is at time `time` (seconds, any size):
 * which shapes are on screen, how far the change between them has gone,
 * how open the galaxy is, and which subject the caption should name.
 */
export function at(time) {
  const { segs, total } = TIMELINE;
  const t = ((time % total) + total) % total;
  let seg = segs[segs.length - 1];
  for (const s of segs) {
    if (t < s.start + s.dur) {
      seg = s;
      break;
    }
  }
  const progress = Math.min(1, Math.max(0, (t - seg.start) / seg.dur));
  const style = styleOf(seg.style);
  const out = { kind: seg.kind, from: seg.from, to: seg.to ?? seg.from, mix: 0, open: 0, subject: seg.from, style: seg.style, progress };
  if (seg.kind === 'galaxy') {
    out.open = 1;
    out.subject = -1;
  } else if (seg.kind === 'open') {
    out.open = 1 - easeSine(progress);
    out.subject = progress < 0.5 ? -1 : seg.from;
  } else if (seg.kind === 'close') {
    out.open = easeSine(progress);
    out.subject = progress < 0.5 ? seg.from : -1;
  } else if (seg.kind === 'morph') {
    out.mix = Math.min(1, Math.max(0, style.ease(progress)));
    out.subject = out.mix < 0.5 ? seg.from : seg.to;
  }
  return out;
}
