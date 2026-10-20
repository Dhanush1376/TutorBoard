/*
 * The particle subjects shared by the landing hero (ParticleMorph.jsx) and the
 * sign-in panel (components/auth/AuthMorph.jsx). Each subject is a small
 * generator: it gives every particle a home in that shape and moves it over
 * time (the helix twists, electrons orbit, field lines flow).
 *
 * One particle in seven is amber, and in every shape it becomes the part that
 * matters: base pairs, the nucleus, the magnet, the star, the landmasses, the
 * capstone, the trend line, the path across the surface.
 */

export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const gauss = (R) => (R() + R() + R() - 1.5) * 1.15;
export const DEG = Math.PI / 180;

/** 3×3 rotation from a list of [axis, angle] steps applied in order. */
export function mat(...steps) {
  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (const [axis, a] of steps) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r =
      axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
    const n = new Array(9);
    for (let i = 0; i < 3; i += 1)
      for (let j = 0; j < 3; j += 1) n[i * 3 + j] = r[i * 3] * m[j] + r[i * 3 + 1] * m[3 + j] + r[i * 3 + 2] * m[6 + j];
    m = n;
  }
  return m;
}

export function emit(out, o, x, y, z, m) {
  out[o] = m[0] * x + m[1] * y + m[2] * z;
  out[o + 1] = m[3] * x + m[4] * y + m[5] * z;
  out[o + 2] = m[6] * x + m[7] * y + m[8] * z;
}

export function onSphere(R, r) {
  const u = R() * 2 - 1;
  const t = R() * TAU;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(t) * r, u * r, s * Math.sin(t) * r];
}

export const I = mat();

/* ── The eight subjects ───────────────────────────────────────────── */

const TURNS = Math.PI * 4.4;
const M_DNA = mat(['z', 0.38]);
const dna = {
  init(i, key, R, P, o) {
    if (key) {
      P[o] = 1;
      // Discrete rungs along the strand
      P[o + 1] = (Math.floor(R() * 32) + 0.5) / 32;
      P[o + 2] = R() * 2 - 1;
    } else {
      P[o] = 0;
      P[o + 1] = R();
      P[o + 2] = i % 2;
      P[o + 3] = (R() - 0.5) * 0.06;
    }
  },
  pos(P, o, t, out, k) {
    // Continuous flowing coordinate along the helix so it never terminates or breaks abruptly
    const flowSpeed = 0.04;
    let h = (P[o + 1] + t * flowSpeed) % 1;
    if (h < 0) h += 1;
    const twist = t * 0.45;
    let x;
    let z;
    if (P[o] === 1) {
      const a = h * TURNS + twist;
      x = Math.cos(a) * P[o + 2];
      z = Math.sin(a) * P[o + 2];
    } else {
      const a = h * TURNS + twist + P[o + 2] * Math.PI;
      x = Math.cos(a) * (1 + P[o + 3]);
      z = Math.sin(a) * (1 + P[o + 3]);
    }
    // Vertical span scaled to 3.8 to keep both ends inside the camera view and avoid harsh clipping
    emit(out, k, x, (h - 0.5) * 3.8, z, M_DNA);
  },
};

const M_RINGS = [0, 1, 2].map((r) => mat(['z', (r - 1) * 1.05], ['x', 0.38]));
const atom = {
  init(i, key, R, P, o) {
    if (key) {
      const [x, y, z] = onSphere(R, 0.5 * Math.cbrt(R()));
      P[o] = -1;
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    } else {
      // Two dense clumps per orbital read as electrons; the rest is the trail.
      const clump = R() < 0.42;
      P[o] = i % 3;
      P[o + 1] = clump ? Math.floor(R() * 2) * Math.PI + (R() - 0.5) * 0.45 : R() * TAU;
      P[o + 2] = (R() - 0.5) * 0.05;
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] < 0) {
      const s = 1 + 0.07 * Math.sin(t * 5 + o * 0.37);
      emit(out, k, P[o + 1] * s, P[o + 2] * s, P[o + 3] * s, I);
      return;
    }
    const ring = P[o];
    const a = P[o + 1] + t * (0.9 + ring * 0.3) * (ring === 1 ? -1 : 1);
    emit(out, k, Math.cos(a) * 2.15, Math.sin(a) * 0.72, P[o + 2], M_RINGS[ring]);
  },
};

const M_FIELD = mat(['x', 0.3], ['z', -0.12]);
const LINES = [1.0, 1.55, 2.1, 2.65];
const field = {
  init(i, key, R, P, o) {
    if (key) {
      P[o] = -1;
      P[o + 1] = (R() - 0.5) * 0.4;
      P[o + 2] = (R() - 0.5) * 1.7;
      P[o + 3] = (R() - 0.5) * 0.4;
    } else {
      P[o] = LINES[Math.floor(R() * LINES.length)];
      P[o + 1] = Math.floor(R() * 8) * (Math.PI / 4) + (R() - 0.5) * 0.04;
      P[o + 2] = R();
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] < 0) {
      emit(out, k, P[o + 1], P[o + 2], P[o + 3], M_FIELD);
      return;
    }
    // Dipole field line r = L·sin²θ, travelled from the north pole round to the south.
    const s = (P[o + 2] + t * 0.07) % 1;
    const th = 0.2 + s * (Math.PI - 0.4);
    const sn = Math.sin(th);
    const r = P[o] * sn * sn;
    const px = r * sn;
    emit(out, k, px * Math.cos(P[o + 1]), r * Math.cos(th), px * Math.sin(P[o + 1]), M_FIELD);
  },
};

const M_ORBIT = mat(['x', 0.42], ['z', -0.14]);
// Two worlds: an inner rocky planet, and an outer one with a moon.
const ORBITS = [
  { r: 1.35, speed: 0.75, start: 2.4, size: 0.13 },
  { r: 2.3, speed: 0.38, start: 0.75, size: 0.21 },
];
const orbit = {
  init(i, key, R, P, o) {
    const b = R();
    if (key) {
      const [x, y, z] = onSphere(R, 0.6 + (R() < 0.25 ? R() * 0.12 : 0));
      P[o] = 0;
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    } else if (b < 0.72) {
      const ring = R() < 0.4 ? 0 : 1;
      P[o] = 1 + ring;
      P[o + 1] = R() * TAU;
      P[o + 2] = ORBITS[ring].r + (R() - 0.5) * 0.06;
    } else if (b < 0.92) {
      const ring = R() < 0.35 ? 0 : 1;
      const [x, y, z] = onSphere(R, ORBITS[ring].size);
      P[o] = 3 + ring;
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    } else {
      const [x, y, z] = onSphere(R, 0.06);
      P[o] = 5;
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    }
  },
  pos(P, o, t, out, k) {
    const type = P[o];
    if (type === 0) {
      const s = 1 + 0.035 * Math.sin(t * 3 + o * 0.29);
      emit(out, k, P[o + 1] * s, P[o + 2] * s, P[o + 3] * s, M_ORBIT);
    } else if (type <= 2) {
      const a = P[o + 1] + t * 0.05;
      emit(out, k, Math.cos(a) * P[o + 2], 0, Math.sin(a) * P[o + 2], M_ORBIT);
    } else {
      const w = ORBITS[type === 3 ? 0 : 1];
      const a = w.start + t * w.speed;
      let cx = Math.cos(a) * w.r;
      let cz = Math.sin(a) * w.r;
      if (type === 5) {
        const m = t * 2.2;
        cx += Math.cos(m) * 0.42;
        cz += Math.sin(m) * 0.42;
      }
      emit(out, k, cx + P[o + 1], P[o + 2], cz + P[o + 3], M_ORBIT);
    }
  },
};

const M_GLOBE = mat(['z', 23.4 * DEG]);
/*
 * A coarse world map: for each 5° latitude band (north to south), the runs of
 * 5° longitude cells that are land. Column c covers lon −180 + 5c … −175 + 5c.
 */
const WORLD = [
  [],
  [[14, 22], [26, 34]],
  [[12, 22], [24, 34], [39, 40], [46, 48], [56, 58]],
  [[5, 8], [9, 24], [25, 35], [47, 49], [48, 66]],
  [[2, 24], [26, 34], [31, 32], [38, 72]],
  [[2, 16], [20, 24], [27, 31], [37, 72]],
  [[8, 16], [20, 25], [35, 36], [37, 39], [41, 72]],
  [[10, 25], [34, 36], [36, 64], [67, 70]],
  [[11, 25], [35, 64], [64, 65]],
  [[11, 23], [34, 37], [37, 43], [44, 46], [47, 63], [64, 66]],
  [[12, 21], [34, 36], [41, 45], [45, 60], [61, 62], [63, 65]],
  [[12, 20], [34, 42], [42, 47], [47, 60]],
  [[13, 17], [19, 20], [33, 42], [43, 47], [47, 53], [55, 60], [60, 61]],
  [[14, 18], [20, 22], [33, 43], [43, 47], [49, 53], [55, 58]],
  [[16, 18], [33, 44], [44, 46], [50, 52], [55, 57], [60, 61]],
  [[17, 19], [32, 45], [51, 52], [56, 57], [60, 62]],
  [[20, 24], [33, 45], [52, 53], [56, 57]],
  [[21, 26], [37, 44], [55, 56], [58, 60]],
  [[20, 28], [38, 44], [56, 59], [60, 61], [63, 66]],
  [[20, 29], [38, 44], [57, 59], [64, 66]],
  [[21, 29], [38, 44], [62, 65]],
  [[22, 29], [38, 43], [45, 46], [61, 66]],
  [[22, 28], [39, 43], [45, 46], [59, 67]],
  [[22, 27], [39, 42], [59, 67]],
  [[22, 26], [39, 42], [59, 66]],
  [[22, 25], [64, 66], [70, 71]],
  [[22, 24], [65, 66], [69, 71]],
  [[22, 23], [69, 70]],
  [[22, 23]],
  [],
  [[23, 24]],
  [[24, 27], [36, 72]],
  [[0, 26], [30, 72]],
  [[0, 72]],
  [[0, 72]],
  [[0, 72]],
];
const isLand = (lat, lon) => {
  const row = WORLD[Math.min(35, Math.max(0, Math.floor((90 - lat) / 5)))];
  const c = Math.floor((((lon + 180) % 360) + 360) % 360 / 5);
  return row.some(([a, b]) => c >= a && c < b);
};
/** A random point on land, area-weighted. */
function landPoint(R) {
  for (let tries = 0; tries < 60; tries += 1) {
    const lat = Math.asin(R() * 2 - 1) / DEG;
    const lon = R() * 360 - 180;
    if (isLand(lat, lon) && Math.abs(lat) < 84) return [lat, lon];
  }
  return [0, 20];
}
const globe = {
  init(i, key, R, P, o) {
    const b = R();
    if (key || b < 0.5) {
      // Continents: amber cities on ink landmasses.
      const [lat, lon] = landPoint(R);
      P[o] = key ? 2 : 1;
      P[o + 1] = lat + (R() - 0.5) * 1.6;
      P[o + 2] = lon + (R() - 0.5) * 1.6;
    } else if (b < 0.72) {
      P[o + 1] = R() * 180 - 90;
      P[o + 2] = Math.floor(R() * 12) * 30;
    } else if (b < 0.9) {
      P[o + 1] = [-60, -30, 0, 30, 60][Math.floor(R() * 5)];
      P[o + 2] = R() * 360;
    } else {
      // A thin atmosphere ring just outside the surface.
      P[o] = 3;
      P[o + 1] = R() * 180 - 90;
      P[o + 2] = R() * 360;
    }
  },
  pos(P, o, t, out, k) {
    const lat = P[o + 1] * DEG;
    const lon = (P[o + 2] + t * 14) * DEG;
    const r = P[o] === 3 ? 1.86 : P[o] >= 1 ? 1.72 : 1.7;
    const c = Math.cos(lat) * r;
    emit(out, k, c * Math.cos(lon), Math.sin(lat) * r, c * Math.sin(lon), M_GLOBE);
  },
};

const M_PYRAMID = mat(['y', -0.35], ['x', 0.16]);
// The Giza trio: Khufu, Khafre and Menkaure, on a field of sand.
const GIZA = [
  { x: 0.55, z: 0.2, s: 1 },
  { x: -1.35, z: -0.55, s: 0.78 },
  { x: -2.55, z: -1.15, s: 0.44 },
];
const pyramid = {
  lift: 0.45,
  init(i, key, R, P, o) {
    const b = R();
    if (!key && b < 0.12) {
      P[o] = -1;
      P[o + 1] = (R() - 0.5) * 6.2;
      P[o + 2] = (R() - 0.5) * 3.2;
      return;
    }
    const which = key ? 0 : b < 0.66 ? 0 : b < 0.9 ? 1 : 2;
    P[o] = Math.floor(R() * 4) + which * 4;
    // Stone courses below a capstone (the amber particles).
    P[o + 1] = key ? 0.8 + R() * 0.2 : (Math.floor(R() * 22) / 22) * 0.8;
    P[o + 2] = R() * 2 - 1;
  },
  pos(P, o, t, out, k) {
    if (P[o] < 0) {
      emit(out, k, P[o + 1], -1.2 + 0.02 * Math.sin(P[o + 1] * 3 + t * 0.6), P[o + 2], M_PYRAMID);
      return;
    }
    const g = GIZA[Math.floor(P[o] / 4)];
    const f = P[o] % 4;
    const h = P[o + 1];
    const w = 1.6 * g.s * (1 - h);
    const y = -1.2 + h * 2.35 * g.s + (h < 0.8 ? 0.012 * Math.sin(t * 2.2 + h * 60) : 0);
    const u = P[o + 2] * w;
    const x = f === 0 ? u : f === 1 ? w : f === 2 ? -u : -w;
    const z = f === 0 ? w : f === 1 ? -u : f === 2 ? -w : u;
    emit(out, k, x + g.x, y, z + g.z, M_PYRAMID);
  },
};

const M_BARS = mat(['y', -0.55], ['x', 0.32]);
const barHeight = (b, t) => {
  const xi = b % 4;
  const zi = Math.floor(b / 4);
  return (0.75 + xi * 0.58 + zi * 0.15) * (0.84 + 0.16 * Math.sin(t * 1.3 + b * 0.8));
};
const bars = {
  lift: 0.5,
  init(i, key, R, P, o) {
    if (key) {
      P[o] = -1;
      P[o + 1] = R();
      P[o + 2] = (R() - 0.5) * 0.03;
    } else {
      P[o] = Math.floor(R() * 12);
      P[o + 1] = Math.floor(R() * 12);
      P[o + 2] = R();
    }
  },
  pos(P, o, t, out, k) {
    const y0 = -1.35;
    if (P[o] < 0) {
      // Trend line riding just above the front row of bars.
      const s = P[o + 1] * 3;
      const a = Math.min(Math.floor(s), 2);
      const f = s - a;
      const top = barHeight(a, t) * (1 - f) + barHeight(a + 1, t) * f;
      emit(out, k, -1.575 + s * 1.05, y0 + top + 0.34 + P[o + 2], -1.35, M_BARS);
      return;
    }
    const b = P[o];
    const e = P[o + 1];
    const s = P[o + 2];
    const cx = -1.575 + (b % 4) * 1.05;
    const cz = -0.85 + Math.floor(b / 4) * 0.85;
    const H = barHeight(b, t);
    const hw = 0.25;
    let x;
    let y;
    let z;
    if (e < 4) {
      x = cx + (e % 2 ? hw : -hw);
      z = cz + (e < 2 ? hw : -hw);
      y = y0 + s * H;
    } else {
      const edge = e % 4;
      const along = (s * 2 - 1) * hw;
      y = e < 8 ? y0 + H : y0;
      x = cx + (edge < 2 ? along : edge === 2 ? hw : -hw);
      z = cz + (edge < 2 ? (edge === 0 ? hw : -hw) : along);
    }
    emit(out, k, x, y, z, M_BARS);
  },
};

const M_SURFACE = mat(['x', 0.62], ['y', 0.5]);
const surface = {
  lift: 0.35,
  init(i, key, R, P, o, grid) {
    if (key) {
      const u = -2.1 + R() * 4.2;
      P[o] = 1;
      P[o + 1] = u;
      P[o + 2] = u * 0.55;
    } else {
      const gi = i % (grid * grid);
      P[o] = 0;
      P[o + 1] = ((gi % grid) / (grid - 1)) * 4.4 - 2.2;
      P[o + 2] = (Math.floor(gi / grid) / (grid - 1)) * 4.4 - 2.2;
    }
  },
  pos(P, o, t, out, k) {
    const u = P[o + 1];
    const v = P[o + 2];
    const h = 0.62 * Math.sin(1.45 * u + t * 0.9) * Math.cos(1.45 * v) + P[o] * 0.05;
    emit(out, k, u, h, v, M_SURFACE);
  },
};

/* ── Engineering: three meshing gears ─────────────────────────────────── */

const GEAR_SCALE = 1.35;
const GEARS = (() => {
  const s = GEAR_SCALE;
  const a = { x: -1.0 * s, y: 0.32 * s, R: 1.0 * s, teeth: 16, h: 0.14 * s };
  const ab = -0.36;
  const b = { R: 0.6 * s, teeth: 10, h: 0.12 * s };
  b.x = a.x + (a.R + b.R) * Math.cos(ab);
  b.y = a.y + (a.R + b.R) * Math.sin(ab);
  const bc = 0.95;
  const c = { R: 0.45 * s, teeth: 8, h: 0.1 * s };
  c.x = b.x + (b.R + c.R) * Math.cos(bc);
  c.y = b.y + (b.R + c.R) * Math.sin(bc);
  a.phase = 0;
  b.phase = Math.PI / b.teeth + ab * (1 + a.teeth / b.teeth);
  c.phase = Math.PI / c.teeth + bc * (1 + b.teeth / c.teeth) + (b.phase - bc) * (b.teeth / c.teeth);
  return [a, b, c];
})();
const toothAt = (f) => {
  const x = f % 1;
  return x < 0.12 ? x / 0.12 : x < 0.42 ? 1 : x < 0.54 ? 1 - (x - 0.42) / 0.12 : 0;
};
const GEAR_Z = 0.16;
// Orient the gears so they face towards the viewer cleanly and straight, with a subtle diagonal tilt
const M_GEARS = mat(['y', 0.14], ['x', -0.08], ['z', 0.06]);

const gears = {
  init(i, key, R, P, o) {
    const g = key ? 2 : R() < 0.62 ? 0 : 1;
    const G = GEARS[g];
    const b = R();
    P[o] = g;
    P[o + 1] = R() * TAU;
    P[o + 3] = (R() < 0.5 ? -1 : 1) * GEAR_Z;
    if (b < 0.5) P[o + 2] = -1;
    else if (b < 0.64) P[o + 2] = G.R * 0.7;
    else if (b < 0.78) {
      P[o + 1] = (Math.floor(R() * 5) / 5) * TAU + (R() - 0.5) * 0.05;
      P[o + 2] = 0.22 * GEAR_SCALE + R() * (G.R * 0.7 - 0.22 * GEAR_SCALE);
    } else if (b < 0.9) P[o + 2] = 0.18 * GEAR_SCALE + (R() - 0.5) * 0.02;
    else {
      P[o + 2] = -2;
      P[o + 3] = (R() * 2 - 1) * GEAR_Z;
    }
  },
  pos(P, o, t, out, k) {
    const G = GEARS[P[o]];
    const turn = (t * 0.45 * GEARS[0].teeth) / G.teeth;
    const dir = P[o] === 1 ? -1 : 1;
    const phi = P[o + 1];
    let r = P[o + 2];
    if (r < 0) r = G.R - G.h / 2 + G.h * toothAt((phi * G.teeth) / TAU);
    const a = phi + dir * turn + G.phase;
    emit(out, k, G.x + Math.cos(a) * r + 0.42, G.y + Math.sin(a) * r + 0.12, P[o + 3], M_GEARS);
  },
};

export { gears };

/** Order matches HERO_SUBJECTS in Landing.jsx. */
export const SHAPES = [dna, atom, field, orbit, globe, pyramid, bars, gears, surface];

/** Particle homes for every shape in `shapes`, plus the opening galaxy. */
export function build(n, shapes = SHAPES) {
  const R = mulberry32(1729);
  const grid = Math.ceil(Math.sqrt(n));
  const params = shapes.map(() => new Float32Array(n * 4));
  const scatter = new Float32Array(n * 3);
  const rnd = new Float32Array(n);
  const accent = new Float32Array(n);
  // The opening is a spiral galaxy: (radius, angle, height) in its disc, or a
  // plain position for the background stars (kind 2). Each star also gets a
  // colour and a size, in the way real spirals look: an old gold bulge, young
  // blue-white arms with pink nebula knots, a faint glow between the arms.
  const gal = new Float32Array(n * 3);
  const galKind = new Float32Array(n);
  const galColor = new Float32Array(n * 3);
  const galSize = new Float32Array(n);
  const tint = (i, r, g, b, jitter = 0.08) => {
    galColor[i * 3] = Math.min(1, r + (R() - 0.5) * jitter);
    galColor[i * 3 + 1] = Math.min(1, g + (R() - 0.5) * jitter);
    galColor[i * 3 + 2] = Math.min(1, b + (R() - 0.5) * jitter);
  };
  for (let i = 0; i < n; i += 1) {
    rnd[i] = R();
    const g = R();
    if (g < 0.15) {
      // bulge
      const r = Math.abs(gauss(R)) * 0.42 + R() * 0.12;
      gal[i * 3] = r;
      gal[i * 3 + 1] = R() * TAU;
      gal[i * 3 + 2] = gauss(R) * 0.16 * Math.max(0.2, 1 - r);
      tint(i, 1.0, 0.84 - r * 0.15, 0.58 - r * 0.2);
      galSize[i] = 1.25 + R() * 0.5;
    } else if (g < 0.72) {
      // two grand arms, plus fainter spurs between them
      const spur = R() < 0.22;
      const arm = Math.floor(R() * 2) * Math.PI + (spur ? Math.PI / 2 : 0);
      const r = 0.45 + R() ** 1.35 * 6.2;
      const spread = (spur ? 0.22 : 0.1) + 0.14 / (r + 0.4);
      gal[i * 3] = r * (1 + gauss(R) * 0.04);
      gal[i * 3 + 1] = arm + Math.log(r + 1) * 2.7 + gauss(R) * spread;
      gal[i * 3 + 2] = gauss(R) * 0.05;
      const c = R();
      if (c < 0.1 && !spur) tint(i, 1.0, 0.5, 0.66, 0.12);
      else if (c < 0.28) tint(i, 1.0, 0.93, 0.78);
      else tint(i, 0.72, 0.84, 1.0);
      galSize[i] = spur ? 0.8 : 0.95 + (R() < 0.04 ? 1.4 : 0);
    } else if (g < 0.82) {
      // diffuse light between the arms
      gal[i * 3] = 0.5 + R() ** 0.8 * 5.5;
      gal[i * 3 + 1] = R() * TAU;
      gal[i * 3 + 2] = gauss(R) * 0.08;
      tint(i, 0.86, 0.78, 0.66);
      galSize[i] = 0.65;
    } else {
      // field stars, far behind
      galKind[i] = 2;
      gal[i * 3] = (R() - 0.5) * 18;
      gal[i * 3 + 1] = (R() - 0.5) * 11;
      gal[i * 3 + 2] = -1 - R() * 7;
      const c = R();
      if (c < 0.2) tint(i, 0.7, 0.8, 1.0);
      else if (c < 0.32) tint(i, 1.0, 0.78, 0.55);
      else tint(i, 0.95, 0.95, 0.92);
      galSize[i] = R() < 0.05 ? 2.4 : 0.6 + R() * 0.6;
    }
    const [x, y, z] = onSphere(R, 0.7 + R() * 1.1);
    scatter[i * 3] = x;
    scatter[i * 3 + 1] = y;
    scatter[i * 3 + 2] = z;
    const key = i % 4 === 0;
    accent[i] = key ? 1 : 0;
    shapes.forEach((shape, s) => shape.init(i, key, R, params[s], i * 4, grid));
  }
  return { n, params, scatter, rnd, accent, gal, galKind, galColor, galSize, from: new Float32Array(n * 3), to: new Float32Array(n * 3) };
}

export function fill(shape, P, t, out, n) {
  for (let i = 0; i < n; i += 1) shape.pos(P, i * 4, t, out, i * 3);
  // Bottom-heavy subjects (a pyramid, a bar chart, a surface) are raised to sit visually centred.
  if (shape.lift) for (let i = 0; i < n; i += 1) out[i * 3 + 1] += shape.lift;
}
