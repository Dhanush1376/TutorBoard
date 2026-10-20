import { TAU, mat, emit, onSphere } from './particleShapes';

/*
 * Four more subjects for the sign-in panel's loop (same generator shape as the
 * eight in particleShapes.js). Amber, again, is the part that matters: the
 * heartbeat trace, the notes at the loudest points of each string, the page
 * being turned, the signals moving through the network.
 */

/* ── Medicine: a beating heart and its ECG trace ──────────────────────── */

const FLAT = mat();
const M_HEART = mat(['y', -0.25]);
// The classic heart curve, scaled to about the size of the other subjects.
const heartXY = (a) => [
  (16 * Math.sin(a) ** 3) / 17,
  (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + 0.18,
];
// One heartbeat on a 0–1 cycle: a small P wave, the tall QRS spike, a T wave.
const ecg = (x) =>
  0.12 * Math.exp(-(((x - 0.18) / 0.035) ** 2)) -
  0.12 * Math.exp(-(((x - 0.3) / 0.012) ** 2)) +
  0.95 * Math.exp(-(((x - 0.33) / 0.014) ** 2)) -
  0.25 * Math.exp(-(((x - 0.36) / 0.014) ** 2)) +
  0.22 * Math.exp(-(((x - 0.55) / 0.05) ** 2));
const beat = (t) => {
  const c = (t * 1.15) % 1;
  return Math.exp(-(((c - 0.08) / 0.05) ** 2)) + 0.55 * Math.exp(-(((c - 0.28) / 0.06) ** 2));
};

export const heart = {
  init(i, key, R, P, o) {
    if (key) {
      P[o] = 1;
      P[o + 1] = R();
      P[o + 2] = (R() - 0.5) * 0.03;
      return;
    }
    // Mostly a shell, some volume: rounder through the middle, thin at the point.
    P[o] = 0;
    P[o + 1] = R() * TAU;
    P[o + 2] = (R() * 2 - 1) * (R() < 0.8 ? 1 : 0.6);
    P[o + 3] = R() < 0.82 ? 1 : 0.55 + R() * 0.4;
  },
  pos(P, o, t, out, k) {
    if (P[o] === 1) {
      // The trace runs across in front of the heart, scrolling with time.
      const u = P[o + 1];
      const x = -2.7 + u * 5.4;
      const y = -1.85 + ecg((u * 2 - t * 0.55 + 10) % 1) * 1.05 + P[o + 2];
      emit(out, k, x, y, 0.9, FLAT);
      return;
    }
    const s = (1 + 0.075 * beat(t)) * P[o + 3];
    const z = P[o + 2];
    const depth = Math.sqrt(Math.max(0, 1 - z * z));
    const [hx, hy] = heartXY(P[o + 1]);
    emit(out, k, hx * depth * s * 1.55, hy * depth * s * 1.55 + 0.25, z * 0.75 * s, M_HEART);
  },
};

/* ── Music: six strings, each sounding its own harmonic ───────────────── */

const M_STRINGS = mat(['x', 0.42], ['y', -0.32], ['z', 0.08]);
const STRINGS = 6;
const LENGTH = 5.4;

export const strings = {
  init(i, key, R, P, o) {
    const s = Math.floor(R() * STRINGS);
    P[o] = s;
    if (key) {
      // Notes: gathered round the antinodes, where the string swings the most.
      const n = s + 1;
      const node = Math.floor(R() * n);
      P[o + 1] = Math.min(1, Math.max(0, (node + 0.5) / n + (R() - 0.5) * 0.06));
      P[o + 2] = 1;
      P[o + 3] = (R() - 0.5) * 0.12;
    } else {
      P[o + 1] = R();
      P[o + 2] = 0;
      P[o + 3] = (R() - 0.5) * 0.025;
    }
  },
  pos(P, o, t, out, k) {
    const s = P[o];
    const u = P[o + 1];
    const n = s + 1;
    // Standing wave: fixed at both ends, n loops, each string at its own pitch.
    const amp = 0.32 / Math.sqrt(n);
    const y0 = (s - (STRINGS - 1) / 2) * 0.48;
    const swing = Math.sin(n * Math.PI * u) * Math.cos(t * (2.2 + n * 0.9)) * amp;
    // Notes sit in a small cloud round the string; string particles barely off it.
    const off = P[o + 3];
    emit(out, k, -LENGTH / 2 + u * LENGTH, y0 + swing + off, P[o + 2] ? off * 0.6 : 0, M_STRINGS);
  },
};

/* ── Literature: an open book, one page turning ───────────────────────── */

const M_BOOK = mat(['x', 0.78], ['y', 0.12]);
const PAGE_W = 2.3;
const PAGE_D = 3.0;
// A page rises from the spine and lies flat towards its edge.
const pageY = (u, stack) => 0.42 * (1 - (1 - u) ** 2.4) + stack * 0.035;

export const book = {
  lift: 0.2,
  init(i, key, R, P, o) {
    if (key) {
      // The turning page.
      P[o] = 2;
      P[o + 1] = R();
      P[o + 2] = (R() - 0.5) * PAGE_D;
      return;
    }
    const b = R();
    P[o] = R() < 0.5 ? -1 : 1;
    if (b < 0.72) {
      // Lines of text: rows across the page, with gaps between words.
      const row = Math.floor(R() * 15);
      P[o + 1] = 0.1 + R() * 0.84;
      P[o + 2] = -PAGE_D / 2 + 0.25 + row * ((PAGE_D - 0.5) / 14);
      P[o + 3] = 0;
    } else {
      // The stack of pages underneath, seen at the edge.
      P[o + 1] = 0.98 + R() * 0.02;
      P[o + 2] = (R() - 0.5) * PAGE_D;
      P[o + 3] = -Math.floor(R() * 6);
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] === 2) {
      // Turn from right to left, rest, then turn again.
      const c = (t * 0.22) % 1;
      const f = c < 0.6 ? 0.5 - 0.5 * Math.cos((c / 0.6) * Math.PI) : 1;
      const th = f * Math.PI;
      const r = P[o + 1] * PAGE_W;
      // The free edge lags behind the spine, so the page curls as it turns.
      const a = th - Math.sin(th) * 0.35 * P[o + 1];
      emit(out, k, Math.cos(a) * r, 0.45 + Math.sin(a) * r * 0.9, P[o + 2], M_BOOK);
      return;
    }
    const side = P[o];
    const u = P[o + 1];
    emit(out, k, side * u * PAGE_W, pageY(u, P[o + 3]), P[o + 2], M_BOOK);
  },
};

/* ── Computer science: a small neural network, signals moving through ── */

const M_NET = mat(['y', -0.42], ['x', 0.16]);
const LAYERS = [4, 6, 6, 3];
const NODES = [];
LAYERS.forEach((count, l) => {
  for (let j = 0; j < count; j += 1) {
    NODES.push({ l, x: -2.4 + l * 1.6, y: (j - (count - 1) / 2) * 0.62, z: ((j * 37) % 5) * 0.08 - 0.16 });
  }
});
const EDGES = [];
NODES.forEach((a, ai) => NODES.forEach((b, bi) => b.l === a.l + 1 && EDGES.push([ai, bi])));

export const network = {
  init(i, key, R, P, o) {
    if (key) {
      // Signals: each rides one connection at its own pace.
      P[o] = 2;
      P[o + 1] = Math.floor(R() * EDGES.length);
      P[o + 2] = R();
      P[o + 3] = 0.35 + R() * 0.4;
    } else if (R() < 0.42) {
      // A node: P[o] = -(node + 1), then the particle's offset inside it.
      const [x, y, z] = onSphere(R, 0.13 * Math.cbrt(R()));
      P[o] = -(Math.floor(R() * NODES.length) + 1);
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    } else {
      // A connection, drawn as a faint line of particles.
      P[o] = 1;
      P[o + 1] = Math.floor(R() * EDGES.length);
      P[o + 2] = R();
      P[o + 3] = (R() - 0.5) * 0.02;
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] < 0) {
      const id = -P[o] - 1;
      const n = NODES[id];
      const pulse = 1 + 0.12 * Math.sin(t * 3 + id);
      emit(out, k, n.x + P[o + 1] * pulse, n.y + P[o + 2] * pulse, n.z + P[o + 3] * pulse, M_NET);
      return;
    }
    const [ai, bi] = EDGES[P[o + 1]];
    const a = NODES[ai];
    const b = NODES[bi];
    const signal = P[o] === 2;
    const f = signal ? (P[o + 2] + t * P[o + 3]) % 1 : P[o + 2];
    const j = signal ? 0 : P[o + 3];
    emit(out, k, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + j, a.z + (b.z - a.z) * f, M_NET);
  },
};
