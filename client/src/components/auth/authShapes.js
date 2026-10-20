import { TAU, mat, emit, onSphere, mulberry32 } from '../../pages/Marketing/particleShapes';

/*
 * The sign-in film's twelve subjects. Deliberately different concepts from the
 * landing page (which has DNA, an atom, field lines, orbits, a globe, the
 * pyramids, a bar chart and a surface), drawn in more detail.
 *
 * Every generator has the landing page's shape: init() gives each particle a
 * home (four numbers in P), pos() places it at time t. One particle in seven is
 * amber, and it always becomes the part that matters.
 *
 * Shapes are drawn to read face-on: the camera only sways a little.
 */

const rnd = mulberry32(90210);
const gaussR = (R) => (R() + R() + R() - 1.5) * 1.15;

/** Line segments, picked by length so particles spread evenly along them. */
function segmentSet(list) {
  const segs = list.map(([a, b, r0, r1]) => ({ a, b, r0, r1, len: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) }));
  const cum = [];
  let total = 0;
  for (const s of segs) {
    total += s.len;
    cum.push(total);
  }
  return {
    segs,
    pick(R) {
      const x = R() * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < x) lo = mid + 1;
        else hi = mid;
      }
      return segs[lo];
    },
  };
}

/** A point on a segment, inside its (tapering) tube. */
function onSegment(seg, R, P, o) {
  const s = R();
  const r = (seg.r0 + (seg.r1 - seg.r0) * s) * Math.sqrt(R());
  const [jx, jy, jz] = onSphere(R, r);
  P[o + 1] = seg.a[0] + (seg.b[0] - seg.a[0]) * s + jx;
  P[o + 2] = seg.a[1] + (seg.b[1] - seg.a[1]) * s + jy;
  P[o + 3] = seg.a[2] + (seg.b[2] - seg.a[2]) * s + jz;
}

/* ── Biology: a neuron, and a nerve impulse running down its axon ─────── */

const SOMA = [-1.0, 0, 0];
const neuronAxon = (s) => [-0.6 + s * 2.8, -0.05 * Math.sin(s * Math.PI) + 0.12 * Math.sin(s * 3.5), 0.08 * Math.sin(s * 4)];
const SHEATHS = [0, 1, 2, 3, 4, 5].map((k) => [0.08 + k * 0.145, 0.08 + k * 0.145 + 0.11]);
const inSheath = (s) => SHEATHS.some(([a, b]) => s >= a && s <= b);
const DENDRITES = (() => {
  const out = [];
  const grow = (from, ang, len, r, depth, tilt) => {
    const to = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len, from[2] + tilt * len];
    out.push([from, to, r, r * 0.6]);
    if (depth >= 2) return;
    const kids = rnd() < 0.5 ? 2 : 3;
    for (let k = 0; k < kids; k += 1) grow(to, ang + (k - (kids - 1) / 2) * 0.55 + (rnd() - 0.5) * 0.3, len * 0.68, r * 0.6, depth + 1, (rnd() - 0.5) * 0.4);
  };
  for (const deg of [80, 115, 145, 180, 215, 245, 280]) {
    const a = (deg * Math.PI) / 180;
    grow([SOMA[0] + Math.cos(a) * 0.42, SOMA[1] + Math.sin(a) * 0.42, 0], a, 0.58 + rnd() * 0.14, 0.06, 0, (rnd() - 0.5) * 0.4);
  }
  // Axon terminals, arborizing into synaptic boutons
  const end = neuronAxon(1);
  for (let k = 0; k < 6; k += 1) {
    const a = (k - 2.5) * 0.38;
    out.push([end, [end[0] + Math.cos(a) * 0.48, end[1] + Math.sin(a) * 0.48, (k - 2.5) * 0.06], 0.03, 0.02]);
  }
  return segmentSet(out);
})();
const BULBS = [0, 1, 2, 3, 4, 5].map((k) => {
  const end = neuronAxon(1);
  const a = (k - 2.5) * 0.38;
  return [end[0] + Math.cos(a) * 0.5, end[1] + Math.sin(a) * 0.5, (k - 2.5) * 0.06];
});
const M_NEURON = mat(['z', -0.48], ['y', 0.12]);

export const neuron = {
  init(i, key, R, P, o) {
    const b = R();
    if (key) {
      if (b < 0.32) {
        // nucleus inside soma
        const [x, y, z] = onSphere(R, 0.22 * Math.cbrt(R()));
        P[o] = 4;
        P[o + 1] = SOMA[0] + x;
        P[o + 2] = SOMA[1] + y;
        P[o + 3] = SOMA[2] + z;
      } else {
        // the action potential impulse: travelling down the axon with high visibility
        P[o] = 5;
        P[o + 1] = gaussR(R) * 0.035;
        P[o + 2] = R() * TAU;
        P[o + 3] = 0.5 + R() * 0.5;
      }
      return;
    }
    if (b < 0.24) {
      // soma (cell body) shell and interior
      const [x, y, z] = onSphere(R, 0.44 * (0.85 + R() * 0.18));
      P[o] = 1;
      P[o + 1] = SOMA[0] + x * 1.1;
      P[o + 2] = SOMA[1] + y * 1.05;
      P[o + 3] = SOMA[2] + z;
    } else if (b < 0.58) {
      P[o] = 2;
      onSegment(DENDRITES.pick(R), R, P, o);
    } else if (b < 0.88) {
      // axon: cylindrical tube with distinct myelin sheath segments
      const s = R();
      const r = inSheath(s) ? 0.095 : 0.035;
      const a = R() * TAU;
      const [x, y, z] = neuronAxon(s);
      P[o] = 3;
      P[o + 1] = x;
      P[o + 2] = y + Math.cos(a) * r;
      P[o + 3] = z + Math.sin(a) * r;
    } else {
      const bulb = BULBS[Math.floor(R() * BULBS.length)];
      const [x, y, z] = onSphere(R, 0.08);
      P[o] = 2;
      P[o + 1] = bulb[0] + x;
      P[o + 2] = bulb[1] + y;
      P[o + 3] = bulb[2] + z;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];
    if (kind === 5) {
      const s = Math.min(1, Math.max(0, ((t * 0.35) % 1.25) - 0.12 + P[o + 1]));
      const [x, y, z] = neuronAxon(s);
      const r = 0.14 * P[o + 3];
      emit(out, k, x, y + Math.cos(P[o + 2]) * r, z + Math.sin(P[o + 2]) * r, M_NEURON);
      return;
    }
    let x = P[o + 1];
    let y = P[o + 2];
    const z = P[o + 3];
    if (kind === 2) y += 0.02 * Math.sin(t * 1.1 + x * 2.3);
    if (kind === 1 || kind === 4) {
      const s = 1 + 0.03 * Math.sin(t * 1.6);
      x = SOMA[0] + (x - SOMA[0]) * s;
      y = SOMA[1] + (y - SOMA[1]) * s;
    }
    emit(out, k, x, y, z, M_NEURON);
  },
};

/* ── Chemistry: a salt crystal (NaCl), turning ────────────────────────── */

const LAT_N = 4;
const LAT_GAP = 0.78;
const latPos = (n) => (n - (LAT_N - 1) / 2) * LAT_GAP;
const M_LATTICE = mat(['x', 0.48], ['z', 0.1]);

export const lattice = {
  init(i, key, R, P, o) {
    const site = () => [Math.floor(R() * LAT_N), Math.floor(R() * LAT_N), Math.floor(R() * LAT_N)];
    let [a, b, c] = site();
    if (key) {
      // sodium: the small ions, on every other site
      while ((a + b + c) % 2 === 0) [a, b, c] = site();
      const [x, y, z] = onSphere(R, 0.1 * (0.8 + R() * 0.25));
      P[o] = 0;
      P[o + 1] = latPos(a) + x;
      P[o + 2] = latPos(b) + y;
      P[o + 3] = latPos(c) + z;
      return;
    }
    if (R() < 0.55) {
      // chloride: the large ions
      while ((a + b + c) % 2 === 1) [a, b, c] = site();
      const [x, y, z] = onSphere(R, 0.19 * (0.8 + R() * 0.22));
      P[o] = 0;
      P[o + 1] = latPos(a) + x;
      P[o + 2] = latPos(b) + y;
      P[o + 3] = latPos(c) + z;
      return;
    }
    // bonds between neighbours
    const axis = Math.floor(R() * 3);
    const d = [0, 0, 0];
    d[axis] = 1;
    if ([a, b, c][axis] === LAT_N - 1) [a, b, c][axis] -= 1;
    const p = [a, b, c];
    p[axis] = Math.min(p[axis], LAT_N - 2);
    const s = 0.2 + R() * 0.6;
    P[o] = 1;
    P[o + 1] = latPos(p[0] + d[0] * s) + (R() - 0.5) * 0.016;
    P[o + 2] = latPos(p[1] + d[1] * s) + (R() - 0.5) * 0.016;
    P[o + 3] = latPos(p[2] + d[2] * s) + (R() - 0.5) * 0.016;
  },
  pos(P, o, t, out, k) {
    const a = t * 0.2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // ions shiver with heat; bonds hold still
    const j = P[o] === 0 ? 0.01 * Math.sin(t * 7 + o * 0.13) : 0;
    const x = P[o + 1] + j;
    const z = P[o + 3];
    emit(out, k, x * c + z * s, P[o + 2] + j, -x * s + z * c, M_LATTICE);
  },
};

/* ── Physics: white light through a prism, split into a spectrum ──────── */

const TRI = [[0, 1.25], [-1.3, -0.85], [1.3, -0.85]];
const PRISM_D = 0.65;
const PRISM_EDGES = (() => {
  const e = [];
  // Triangular faces front & back
  for (const z of [-PRISM_D, PRISM_D]) {
    for (let i = 0; i < 3; i += 1) {
      e.push([[...TRI[i], z], [...TRI[(i + 1) % 3], z], 0.02, 0.02]);
    }
  }
  // 3 horizontal corner edges joining front to back
  for (let i = 0; i < 3; i += 1) {
    e.push([[...TRI[i], -PRISM_D], [...TRI[i], PRISM_D], 0.02, 0.02]);
  }
  return segmentSet(e);
})();

// Left refracting face
const onLeftFace = (s) => [TRI[1][0] + (TRI[0][0] - TRI[1][0]) * s, TRI[1][1] + (TRI[0][1] - TRI[1][1]) * s];
// Right refracting face
const onRightFace = (s) => [TRI[2][0] + (TRI[0][0] - TRI[2][0]) * s, TRI[2][1] + (TRI[0][1] - TRI[2][1]) * s];

const P_IN = onLeftFace(0.42);
const P_OUT = onRightFace(0.38);
const BEAM_FROM = [-2.85, -0.22];
const RAYS = 7;
// Spectrum fan angles: straight horizontal dispersion fanning upwards/downwards
const rayDir = (r) => {
  // r from 0 (red) to 6 (violet)
  const a = (10 - r * 6.0) * (Math.PI / 180);
  return [Math.cos(a), Math.sin(a)];
};
// Clean, direct perspective with gentle tilt: prism is immediately understood
const M_PRISM = mat(['y', -0.15], ['x', 0.06]);

export const prism = {
  init(i, key, R, P, o) {
    if (key) {
      // Spectrum rays: amber/accent particles highlight the separated spectral beams
      P[o] = 5;
      P[o + 1] = Math.floor(R() * RAYS);
      P[o + 2] = R();
      P[o + 3] = gaussR(R) * 0.02;
      return;
    }
    const b = R();
    if (b < 0.44) {
      // Defined edges of the glass prism
      P[o] = 1;
      onSegment(PRISM_EDGES.pick(R), R, P, o);
    } else if (b < 0.6) {
      // Glass face surface shimmer: on left, right, and bottom rectangular faces
      const face = Math.floor(R() * 3);
      const u = R();
      const z = (R() * 2 - 1) * PRISM_D;
      let pt;
      if (face === 0) pt = onLeftFace(u);
      else if (face === 1) pt = onRightFace(u);
      else pt = [TRI[1][0] + (TRI[2][0] - TRI[1][0]) * u, TRI[1][1]];
      P[o] = 2;
      P[o + 1] = pt[0];
      P[o + 2] = pt[1];
      P[o + 3] = z;
    } else if (b < 0.82) {
      // Incoming collimated white light beam from the left
      P[o] = 3;
      P[o + 1] = R();
      P[o + 2] = gaussR(R) * 0.022;
      P[o + 3] = gaussR(R) * 0.022;
    } else {
      // Refracted beam inside the glass
      P[o] = 4;
      P[o + 1] = R();
      P[o + 2] = gaussR(R) * 0.03;
      P[o + 3] = gaussR(R) * 0.03;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];
    if (kind === 1 || kind === 2) {
      emit(out, k, P[o + 1], P[o + 2], P[o + 3], M_PRISM);
      return;
    }
    if (kind === 3 || kind === 4) {
      const s = (P[o + 1] + t * 0.35) % 1;
      const [a, b] = kind === 3 ? [BEAM_FROM, P_IN] : [P_IN, P_OUT];
      emit(out, k, a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s + P[o + 2], P[o + 3], M_PRISM);
      return;
    }
    // The spectrum: 7 distinct rays fanning out smoothly to the right
    const s = (P[o + 2] + t * 0.35) % 1;
    const rayIdx = P[o + 1];
    const [dx, dy] = rayDir(rayIdx);
    const len = 0.15 + 2.3 * s;
    const spread = (rayIdx - 3) * 0.035;
    emit(
      out,
      k,
      P_OUT[0] + dx * len,
      P_OUT[1] + dy * len + P[o + 3] * (1 + s * 1.5),
      spread * (1 + s * 1.2) + P[o + 3] * 0.5,
      M_PRISM,
    );
  },
};

/* ── Astronomy: Gargantua (Interstellar Kerr Black Hole & Lensed Accretion Disk) ── */

// 16° inclination angle matching Interstellar's cinematic perspective
const M_BLACKHOLE = mat(['x', 0.28], ['y', 0.08]);
const RS = 0.52; // Schwarzschild radius (Event horizon shadow)
const R_PHOTON = 0.82; // Relativistic photon sphere (~1.5 Rs)
const R_ISCO = 1.05; // Innermost Stable Circular Orbit
const R_DISK_MAX = 4.2; // Vast, expansive accretion disk spanning the width of the canvas

export const blackhole = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden/amber relativistic photon sphere & Doppler-boosted inner accretion hotspot
      const roll = R();
      if (roll < 0.45) {
        // Photon sphere: razor-sharp ring of trapped light wrapping the shadow
        P[o] = 3;
        P[o + 1] = R_PHOTON + (R() - 0.5) * 0.03;
        P[o + 2] = R() * TAU;
        P[o + 3] = (R() - 0.5) * 0.015;
      } else {
        // High-velocity relativistic inner accretion stream
        P[o] = 4;
        const r = R_ISCO + Math.pow(R(), 2.0) * 1.2;
        P[o + 1] = r;
        P[o + 2] = R() * TAU;
        P[o + 3] = (R() - 0.5) * 0.03;
      }
      return;
    }

    const b = R();
    if (b < 0.62) {
      // 1. Vast horizontal accretion disk:
      // Spans wide across the viewport with infinite-feeling gradient falloff
      const u = R();
      // Power curve gives dense glowing core near ISCO and vast sprawling cosmic disk reaching outwards
      const r = R_ISCO + Math.pow(u, 1.2) * (R_DISK_MAX - R_ISCO);
      const theta = R() * TAU;
      // Disk flare expands naturally with radius
      const flare = 0.01 + 0.035 * (r - R_ISCO);
      P[o] = 0;
      P[o + 1] = r;
      P[o + 2] = theta;
      P[o + 3] = gaussR(R) * flare;
    } else if (b < 0.90) {
      // 2. Gravitational Lensing Halo (The Interstellar vertical halo circle):
      // The rear accretion disk bent over and under the black hole by extreme curvature
      const u = R();
      const r = R_ISCO + Math.pow(u, 1.3) * (R_DISK_MAX * 0.85 - R_ISCO);
      const angle = R() * TAU;
      const side = R() < 0.5 ? 1 : -1;
      P[o] = 1;
      P[o + 1] = r;
      P[o + 2] = angle;
      P[o + 3] = side;
    } else {
      // 3. Frame-dragging infalling plasma spirals near the event horizon (no white core inside horizon)
      P[o] = 5;
      P[o + 1] = RS * 1.05 + R() * (R_ISCO - RS * 1.05);
      P[o + 2] = R() * TAU;
      P[o + 3] = (R() - 0.5) * 0.04;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];

    if (kind === 0) {
      // Vast horizontal accretion disk with Keplerian differential rotation
      const r = P[o + 1];
      const omega = 1.6 / Math.pow(r, 1.25);
      const angle = P[o + 2] + t * omega;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = P[o + 3];

      // Iconic Interstellar cross:
      // The front half of the horizontal disk (z > -0.05) crosses directly in front of the
      // black hole shadow as an uninterrupted bright beam.
      // Only the rear half of the disk behind the horizon (z <= -0.05) is occluded by the shadow.
      if (z <= -0.05 && Math.hypot(x, y) < RS * 1.05) {
        // Rear disk light is gravitationally lensed over the top and bottom into the halo
        const side = y >= 0 ? 1 : -1;
        emit(out, k, x, side * (RS * 1.08 + Math.abs(y)), z, M_BLACKHOLE);
        return;
      }

      emit(out, k, x, y, z, M_BLACKHOLE);
      return;
    }

    if (kind === 1) {
      // Gravitational lensing halo (Interstellar vertical arch above and below the event horizon)
      const r = P[o + 1];
      const omega = 1.6 / Math.pow(r, 1.25);
      const theta = P[o + 2] + t * omega;

      // Relativistic impact parameter deflection
      const lensedR = Math.sqrt(r * r * 0.38 + R_PHOTON * R_PHOTON * 1.8);
      const side = P[o + 3];
      const archPhi = theta;
      const lx = Math.cos(archPhi) * lensedR;
      const ly = Math.abs(Math.sin(archPhi)) * lensedR * 0.98 * side;
      const lz = -0.15 - Math.abs(Math.sin(archPhi)) * 0.28;
      emit(out, k, lx, ly, lz, M_BLACKHOLE);
      return;
    }

    if (kind === 3) {
      // Photon sphere: circular ring of trapped light at 1.5 Rs
      const r = P[o + 1];
      const omega = 2.8;
      const angle = P[o + 2] + t * omega;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r * 0.98;
      const z = P[o + 3];
      emit(out, k, x, y, z, M_BLACKHOLE);
      return;
    }

    if (kind === 4) {
      // Ultra-relativistic inner accretion rim
      const r = P[o + 1];
      const omega = 2.1 / Math.sqrt(r);
      const angle = P[o + 2] + t * omega;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = P[o + 3];
      emit(out, k, x, y, z, M_BLACKHOLE);
      return;
    }

    // Infalling spiral plasma plunging towards the horizon
    const baseR = P[o + 1];
    const plunge = (P[o + 2] + t * 0.8) % 1;
    const r = Math.max(RS * 1.02, baseR - plunge * 0.28);
    const omega = 3.8 / Math.pow(r, 1.15);
    const angle = P[o + 2] + t * omega;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = P[o + 3] * (1 - plunge);
    emit(out, k, x, y, z, M_BLACKHOLE);
  },
};

export const saturn = blackhole;

/* ── Geography: Alpine Stratovolcano Mountain Massif ───────────────────── */

// High-detail realistic mountain elevation model:
// Multi-frequency fractal noise (FBM), arêtes (sharp glacial/volcanic knife-edge ridges),
// steep volcanic throat, alpine cirques, and dendritic erosion valleys.
const mountainH = (x, z) => {
  const r2 = x * x + z * z;
  const r = Math.sqrt(r2);
  const ang = Math.atan2(z, x);

  // Natural organic island/massif boundary perimeter
  const maxR = 2.15 + 0.24 * Math.sin(3 * ang + 0.6) + 0.16 * Math.cos(5 * ang - 0.3) + 0.08 * Math.sin(7 * ang);
  if (r >= maxR) return 0;

  // Primary volcanic cone profile: steep bell-shaped peak
  const cone = 2.2 / (1 + r2 * 1.35);

  // Summit caldera depression
  const caldera = 0.52 * Math.exp(-r2 / 0.11);

  // Sharp dendritic mountain ridges (arêtes) radiating outwards from the peak
  const ridge1 = 0.28 * Math.pow(Math.abs(Math.sin(3 * ang + 0.3)), 2.8) * Math.exp(-r / 1.7);
  const ridge2 = 0.18 * Math.pow(Math.abs(Math.cos(4 * ang - 0.5)), 3.2) * Math.exp(-r / 1.5);
  const ridge3 = 0.12 * Math.sin(7 * ang) * Math.exp(-r / 1.2);

  // Fractal terrain octaves: rugged rock faces and crags
  const fbm1 = 0.09 * Math.sin(4.2 * x + 1.2) * Math.cos(4.8 * z - 0.6);
  const fbm2 = 0.045 * Math.sin(8.5 * x - 2.1 * z) * Math.cos(7.8 * z + 3.1 * x);
  const fbm3 = 0.02 * Math.sin(17.0 * x) * Math.sin(16.5 * z);

  // Erosion slope gullies running downhill
  const gullies = -0.06 * Math.pow(Math.abs(Math.sin(6 * ang + 0.8)), 1.8) * Math.exp(-r / 1.8);

  const rawHeight = cone - caldera + ridge1 + ridge2 + ridge3 + fbm1 + fbm2 + fbm3 + gullies;

  // Smooth natural falloff at the perimeter skirts into the base plain
  const edgeDist = Math.max(0, (maxR - r) / maxR);
  const coastFade = Math.sin(Math.min(1, edgeDist * 1.6) * Math.PI * 0.5);

  return Math.max(0, rawHeight * coastFade);
};

// Natural downhill flowing lava rivers carving down through the mountain's steep ravines
const LAVA_CHANNELS = [
  // Channel 1: Front-left ravine
  (() => {
    const pts = [];
    let x = 0.06;
    let z = 0.10;
    for (let s = 0; s < 250 && Math.hypot(x, z) < 2.0; s += 1) {
      pts.push([x, mountainH(x, z), z]);
      const e = 0.01;
      const gx = (mountainH(x + e, z) - mountainH(x - e, z)) / (2 * e);
      const gz = (mountainH(x, z + e) - mountainH(x, z - e)) / (2 * e);
      const g = Math.hypot(gx, gz) + 0.35;
      x += (-gx / g) * 0.024 + 0.003;
      z += (-gz / g) * 0.024 + 0.007;
    }
    return pts;
  })(),
  // Channel 2: West rocky flank
  (() => {
    const pts = [];
    let x = -0.12;
    let z = 0.04;
    for (let s = 0; s < 230 && Math.hypot(x, z) < 2.0; s += 1) {
      pts.push([x, mountainH(x, z), z]);
      const e = 0.01;
      const gx = (mountainH(x + e, z) - mountainH(x - e, z)) / (2 * e);
      const gz = (mountainH(x, z + e) - mountainH(x, z - e)) / (2 * e);
      const g = Math.hypot(gx, gz) + 0.35;
      x += (-gx / g) * 0.024 - 0.007;
      z += (-gz / g) * 0.024 + 0.005;
    }
    return pts;
  })(),
  // Channel 3: East gully
  (() => {
    const pts = [];
    let x = 0.12;
    let z = -0.07;
    for (let s = 0; s < 210 && Math.hypot(x, z) < 2.0; s += 1) {
      pts.push([x, mountainH(x, z), z]);
      const e = 0.01;
      const gx = (mountainH(x + e, z) - mountainH(x - e, z)) / (2 * e);
      const gz = (mountainH(x, z + e) - mountainH(x, z - e)) / (2 * e);
      const g = Math.hypot(gx, gz) + 0.35;
      x += (-gx / g) * 0.024 + 0.008;
      z += (-gz / g) * 0.024 - 0.006;
    }
    return pts;
  })(),
];

// 26° alpine perspective angle
const M_TERRAIN = mat(['x', 0.44], ['y', 0.22]);

export const terrain = {
  init(i, key, R, P, o) {
    if (key) {
      // Glowing volcanic phenomena: molten lava rivers, incandescent caldera lake, airborne ejecta
      const roll = R();
      if (roll < 0.6) {
        // Multi-stream glowing lava rivers running down the mountain ravines
        P[o] = 2;
        P[o + 1] = Math.floor(R() * LAVA_CHANNELS.length);
        P[o + 2] = R();
        P[o + 3] = gaussR(R) * 0.03;
      } else if (roll < 0.82) {
        // Glowing molten lava lake churning inside the summit caldera
        const rad = Math.sqrt(R()) * 0.26;
        const ang = R() * TAU;
        P[o] = 3;
        P[o + 1] = Math.cos(ang) * rad;
        P[o + 2] = Math.sin(ang) * rad;
        P[o + 3] = R();
      } else {
        // Fiery volcanic eruption spatter / incandescent ejecta fountain
        const ang = R() * TAU;
        const speed = 0.2 + R() * 0.55;
        P[o] = 4;
        P[o + 1] = Math.cos(ang) * speed * 0.35;
        P[o + 2] = Math.sin(ang) * speed * 0.35;
        P[o + 3] = R();
      }
      return;
    }

    // Realistic mountain surface:
    // High-density natural surface scatter capturing peaks, razor ridgelines, scree slopes, and valleys
    let x;
    let z;
    let h;
    const roll = R();

    if (roll < 0.45) {
      // Alpine ridgelines & steep crag faces (densely seeded along primary elevation gradients)
      const ang = (Math.floor(R() * 6) * (TAU / 6) + (R() - 0.5) * 0.35);
      const rad = 0.08 + Math.pow(R(), 0.75) * 1.85;
      x = Math.cos(ang) * rad + gaussR(R) * 0.06;
      z = Math.sin(ang) * rad + gaussR(R) * 0.06;
      h = mountainH(x, z);
      P[o] = 1;
    } else {
      // Natural surface point cloud distributed smoothly across the mountain body
      const ang = R() * TAU;
      const rad = Math.sqrt(R()) * 2.1;
      x = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
      h = mountainH(x, z);
      P[o] = 0;
    }

    P[o + 1] = x;
    P[o + 2] = h;
    P[o + 3] = z;
  },
  pos(P, o, t, out, k) {
    let x;
    let y;
    let z;
    const kind = P[o];
    if (kind === 2) {
      // Downhill flowing lava streams
      const chan = LAVA_CHANNELS[P[o + 1]];
      const f = ((P[o + 2] + t * 0.11) % 1) * (chan.length - 1);
      const a = chan[Math.floor(f)];
      const b = chan[Math.min(chan.length - 1, Math.floor(f) + 1)];
      const s = f - Math.floor(f);
      x = a[0] + (b[0] - a[0]) * s + P[o + 3];
      z = a[2] + (b[2] - a[2]) * s + P[o + 3] * 0.8;
      y = mountainH(x, z) + 0.045;
    } else if (kind === 3) {
      // Molten lava pool surging inside caldera
      x = P[o + 1];
      z = P[o + 2];
      y = mountainH(x, z) + 0.03 + 0.02 * Math.sin(t * 3.5 + P[o + 3] * 6);
    } else if (kind === 4) {
      // Airborne eruption lava fountain leaping from summit crater
      const phase = (P[o + 3] + t * 0.55) % 1;
      const h = Math.sin(phase * Math.PI) * 0.65;
      x = P[o + 1] * (0.5 + phase * 0.8);
      z = P[o + 2] * (0.5 + phase * 0.8);
      y = mountainH(0, 0) + 0.12 + h;
    } else {
      [x, y, z] = [P[o + 1], P[o + 2], P[o + 3]];
    }
    // Gentle panoramic breathing
    const a = 0.07 * Math.sin(t * 0.2);
    const c = Math.cos(a);
    const s = Math.sin(a);
    emit(out, k, x * c + z * s, y - 0.78, -x * s + z * c, M_TERRAIN);
  },
};

/* ── History: the Colosseum ───────────────────────────────────────────── */

const COL_A = 2.1;
const COL_B = 1.55;
const TIER_H = 0.38;
const FLOOR = -0.7;
const ARCHES = 36;
const AVG_R = (COL_A + COL_B) / 2;
// The outer wall is broken/stepped on one side, exactly matching the iconic modern Rome Colosseum
const broken = (theta, tier) => tier >= 2 && Math.cos(theta - 2.1) > 0.8;
// Classic 30° aerial oblique amphitheater perspective showing the oval arena, inner corridors & outer arcades
const M_COL = mat(['x', 0.48], ['y', 0.32]);

export const colosseum = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden hypogeum arena floor: elliptical wooden stage with subterranean tunnel walls
      const a = R() * TAU;
      const r = Math.sqrt(R()) * 0.44;
      const grid = R() < 0.55;
      P[o] = 3;
      P[o + 1] = grid ? Math.round(Math.cos(a) * r * 8) / 8 : Math.cos(a) * r;
      P[o + 2] = FLOOR + 0.02;
      P[o + 3] = (Math.sin(a) * r * COL_B) / COL_A;
      return;
    }
    const b = R();
    if (b < 0.52) {
      // Arches: pillars and round arch heads across 3 outer tiers
      let tier;
      let theta;
      do {
        tier = Math.floor(R() * 3);
        theta = ((Math.floor(R() * ARCHES) + 0.5) / ARCHES) * TAU;
      } while (broken(theta, tier + 1));
      const hw = ((TAU / ARCHES) * AVG_R * 0.6) / 2;
      const spring = FLOOR + tier * TIER_H + TIER_H - hw - 0.03;
      const u = R();
      let dx;
      let y;
      if (u < 0.32) [dx, y] = [-hw, FLOOR + tier * TIER_H + (u / 0.32) * (spring - FLOOR - tier * TIER_H)];
      else if (u < 0.64) [dx, y] = [hw, FLOOR + tier * TIER_H + ((u - 0.32) / 0.32) * (spring - FLOOR - tier * TIER_H)];
      else {
        const a = ((u - 0.64) / 0.36) * Math.PI;
        [dx, y] = [-Math.cos(a) * hw, spring + Math.sin(a) * hw];
      }
      const th = theta + dx / AVG_R;
      P[o] = 0;
      P[o + 1] = Math.cos(th) * COL_A;
      P[o + 2] = y;
      P[o + 3] = Math.sin(th) * COL_B;
    } else if (b < 0.68) {
      // Entablature cornice rings wrapping around between tiers
      let level;
      let theta;
      do {
        level = Math.floor(R() * 5);
        theta = R() * TAU;
      } while (broken(theta, level));
      const y = level < 4 ? FLOOR + level * TIER_H : FLOOR + 3 * TIER_H + 0.24;
      P[o] = 0;
      P[o + 1] = Math.cos(theta) * COL_A;
      P[o + 2] = y + (R() - 0.5) * 0.01;
      P[o + 3] = Math.sin(theta) * COL_B;
    } else if (b < 0.78) {
      // Inner concentric portico gallery colonnade
      const theta = R() * TAU;
      const tier = Math.floor(R() * 2);
      const rScale = 0.82;
      P[o] = 0;
      P[o + 1] = Math.cos(theta) * COL_A * rScale;
      P[o + 2] = FLOOR + tier * TIER_H + R() * TIER_H * 0.85;
      P[o + 3] = Math.sin(theta) * COL_B * rScale;
    } else {
      // Cavea spectator seating tiers descending to the arena podium
      const row = Math.floor(R() * 10);
      const f = row / 9;
      const sc = 0.78 - f * 0.32;
      const theta = R() * TAU;
      P[o] = 0;
      P[o + 1] = Math.cos(theta) * COL_A * sc;
      P[o + 2] = FLOOR + 1.8 * TIER_H * (1 - f) + 0.05;
      P[o + 3] = Math.sin(theta) * COL_B * sc;
    }
  },
  pos(P, o, t, out, k) {
    let x = P[o + 1];
    let y = P[o + 2];
    let z = P[o + 3];
    if (P[o] === 3) {
      x *= COL_A;
      z *= COL_B;
    }
    // Gentle panoramic view pan
    const a = 0.08 * Math.sin(t * 0.18);
    const c = Math.cos(a);
    const s = Math.sin(a);
    emit(out, k, x * c + z * s, y, -x * s + z * c, M_COL);
  },
};

/* ── Medicine: a beating heart, its great vessels, its ECG trace ──────── */

const M_HEART = mat(['y', -0.22], ['x', 0.12], ['z', -0.06]);
const FLAT = mat();

// Anatomical heart model matching human cardiac anatomy in reference illustration:
// Left ventricle (inferior apex pointed down-left), right ventricle (anterior broad),
// interventricular sulcus groove with descending coronary artery path,
// right & left auricles (atrial appendages), and aortic arch with brachiocephalic branches.
const heartSurface = (theta, phi, R) => {
  // phi in [-1, 1]: -1 is apex (tapered bottom-left tip), +1 is cardiac base (root of vessels)
  // theta in [0, TAU]: cross-sectional rotation
  const y = phi * 1.32 - 0.12;

  // Vertical envelope: sharp tapered apex at bottom, maximum muscular girth at ventricles, gentle atrial taper
  const t = (phi + 1) * 0.5; // [0, 1] from apex to base
  // Envelope shape: bulbous muscular ventricles that taper into a sharp apex at t=0
  const envelope = Math.pow(Math.sin(t * Math.PI * 0.85 + 0.15), 0.72) * 1.15;

  // Asymmetry & ventricles:
  // Left ventricle is thicker, muscular, pushed down-left; right ventricle forms anterior face
  // Interventricular groove (sulcus) indent running diagonally from base to near apex
  const sulcusAngle = 1.15 + 0.35 * (1 - t);
  const distToSulcus = Math.abs(Math.sin((theta - sulcusAngle) * 0.5));
  const sulcusDent = 1.0 - 0.18 * Math.exp(-Math.pow((theta - sulcusAngle) / 0.45, 2));

  // Cross-sectional contour:
  // - Right atrium & ventricle bulge on the right (theta ~ -0.2 to 0.8)
  // - Left ventricle forms prominent lateral curve on left (theta ~ 2.4 to 3.8)
  // - Posterior wall is flatter
  const lateralBulge = 1.0 + 0.28 * Math.cos(theta - 0.4) - 0.14 * Math.cos(2 * theta + 0.3) + 0.08 * Math.sin(3 * theta);

  // Atrial appendages (auricles) near the top base
  const auricleTop = t > 0.7 ? 0.15 * Math.sin((t - 0.7) / 0.3 * Math.PI) * Math.max(0, Math.cos(theta - 0.8)) : 0;

  const r = Math.max(0.04, envelope * lateralBulge * sulcusDent + auricleTop);

  // Apex tilt: in anatomical position the apex points down, forward and to the left (cardiac axis ~45°)
  const apexTiltX = -0.38 * Math.pow(1 - t, 1.4);
  const apexTiltZ = 0.18 * Math.pow(1 - t, 1.2);

  const x = Math.cos(theta) * r * 1.18 + apexTiltX;
  const z = Math.sin(theta) * r * 0.92 + apexTiltZ;
  return [x, y, z];
};

// Realistic P-Q-R-S-T cardiac cycle waveform with arterial BP dicrotic notch
const ecg = (x) => {
  const p = 0.15 * Math.exp(-(((x - 0.14) / 0.032) ** 2));
  const q = -0.12 * Math.exp(-(((x - 0.24) / 0.012) ** 2));
  const r = 1.25 * Math.exp(-(((x - 0.27) / 0.015) ** 2));
  const s = -0.32 * Math.exp(-(((x - 0.30) / 0.014) ** 2));
  const t = 0.28 * Math.exp(-(((x - 0.44) / 0.048) ** 2));
  const bpNotch = 0.1 * Math.exp(-(((x - 0.58) / 0.024) ** 2));
  return p + q + r + s + t + bpNotch;
};

const beat = (t) => {
  const c = (t * 1.2) % 1;
  return Math.exp(-(((c - 0.12) / 0.045) ** 2)) + 0.5 * Math.exp(-(((c - 0.3) / 0.055) ** 2));
};

const bezier = (p0, p1, p2, p3, s) => {
  const u = 1 - s;
  return [0, 1, 2].map((d) => u * u * u * p0[d] + 3 * u * u * s * p1[d] + 3 * u * s * s * p2[d] + s * s * s * p3[d]);
};

// Anatomical great vessels precisely mirroring reference illustration:
// 1. Aorta Arch: massive red arch rising from heart base, curving over pulmonary trunk to left
// 2. Three supra-aortic branches ascending from arch (brachiocephalic trunk, left common carotid, left subclavian)
// 3. Pulmonary Trunk: main blue artery branching left and right across anterior aorta
// 4. Superior Vena Cava (SVC): vertical venous cylinder on right with right pulmonary artery crossing behind
// 5. Left & right pulmonary veins exiting posterior-laterally
const VESSELS = [
  // Main Aortic Arch: emerges central-left, arches prominently up and backward-left
  { pts: [[-0.08, 0.72, 0.05], [-0.12, 1.48, 0.02], [-0.28, 1.62, -0.15], [-0.58, 1.05, -0.25]], r: 0.185 },

  // Aortic branch 1: Brachiocephalic artery trunk (rightmost of the three, thickest)
  { pts: [[-0.28, 1.48, -0.05], [-0.35, 1.95, -0.06]], r: 0.075 },

  // Aortic branch 2: Left common carotid artery (middle branch)
  { pts: [[-0.18, 1.55, -0.08], [-0.20, 1.98, -0.08]], r: 0.065 },

  // Aortic branch 3: Left subclavian artery (leftmost branch)
  { pts: [[-0.05, 1.53, -0.12], [-0.04, 1.96, -0.12]], r: 0.065 },

  // Pulmonary Trunk: emerges anteriorly from right ventricle, crosses in front of ascending aorta
  { pts: [[0.12, 0.65, 0.28], [0.15, 0.95, 0.28], [0.24, 1.22, 0.22], [0.38, 1.28, 0.12]], r: 0.165 },

  // Left Pulmonary Artery branch (heading toward viewer's left behind aorta)
  { pts: [[0.35, 1.22, 0.15], [0.65, 1.18, 0.05]], r: 0.11 },

  // Right Pulmonary Artery branch (heading rightward under aortic arch)
  { pts: [[0.18, 1.15, 0.24], [0.02, 1.18, 0.18], [-0.22, 1.14, 0.08], [-0.42, 1.08, 0.02]], r: 0.11 },

  // Superior Vena Cava (SVC): straight vertical venous trunk on anatomical right (viewer's left/back)
  { pts: [[-0.65, 0.7, 0.05], [-0.68, 1.62, 0.02]], r: 0.135 },

  // Left Pulmonary Veins (dual red vessels projecting laterally from left atrium)
  { pts: [[0.72, 0.62, -0.12], [0.95, 0.68, -0.18]], r: 0.075 },
  { pts: [[0.70, 0.44, -0.14], [0.92, 0.48, -0.20]], r: 0.075 },
];

// Coronary arteries & veins (sulcus vessels branching across the myocardium as shown in illustration)
const CORONARY_PATHS = [
  // Anterior interventricular artery (LAD) traversing the diagonal sulcus down to the apex
  [
    [0.05, 0.62, 0.42],
    [-0.04, 0.25, 0.48],
    [-0.15, -0.12, 0.45],
    [-0.26, -0.52, 0.38],
    [-0.38, -0.92, 0.15],
  ],
  // Diagonal branch off LAD
  [
    [-0.04, 0.25, 0.48],
    [0.22, 0.08, 0.42],
    [0.42, -0.15, 0.32],
  ],
  // Right coronary artery (RCA) curving along coronary sulcus (atrioventricular groove)
  [
    [-0.12, 0.58, 0.36],
    [-0.38, 0.42, 0.28],
    [-0.55, 0.22, 0.15],
    [-0.62, -0.05, 0.02],
  ],
  // Circumflex branch curving laterally around left margin
  [
    [0.18, 0.54, 0.32],
    [0.48, 0.42, 0.22],
    [0.68, 0.25, 0.05],
    [0.72, -0.05, -0.12],
  ],
];

export const heart = {
  init(i, key, R, P, o) {
    if (key) {
      // Key amber particles: either coronary sulcus vessels or ECG line
      if (R() < 0.35) {
        // Dynamic amber ECG trace line below the heart
        P[o] = 1;
        P[o + 1] = R(); // position across horizontal axis
        P[o + 2] = (R() - 0.5) * 0.025; // jitter
        P[o + 3] = R();
        return;
      }
      // Amber coronary arterial tree highlights on heart surface (matching red/amber vessels in illustration)
      const path = CORONARY_PATHS[Math.floor(R() * CORONARY_PATHS.length)];
      const maxSeg = Math.max(0, path.length - 2);
      const seg = Math.min(maxSeg, Math.floor(R() * (path.length - 1)));
      const frac = R();
      const p0 = path[seg];
      const p1 = path[seg + 1] || p0;
      const jitter = (R() - 0.5) * 0.03;
      P[o] = 3;
      P[o + 1] = p0[0] + (p1[0] - p0[0]) * frac + jitter;
      P[o + 2] = p0[1] + (p1[1] - p0[1]) * frac + jitter;
      P[o + 3] = p0[2] + (p1[2] - p0[2]) * frac + jitter;
      return;
    }

    const b = R();
    if (b < 0.28) {
      // Great vascular trunks (Aorta, Brachiocephalic, Pulmonary Trunk, SVC)
      const v = VESSELS[Math.floor(R() * VESSELS.length)];
      const s = R();
      let pt;
      if (v.pts.length === 2) {
        pt = [
          v.pts[0][0] + (v.pts[1][0] - v.pts[0][0]) * s,
          v.pts[0][1] + (v.pts[1][1] - v.pts[0][1]) * s,
          v.pts[0][2] + (v.pts[1][2] - v.pts[0][2]) * s,
        ];
      } else {
        pt = bezier(...v.pts, s);
      }
      const [jx, jy, jz] = onSphere(R, v.r * (0.82 + R() * 0.26));
      P[o] = 2;
      P[o + 1] = pt[0] + jx;
      P[o + 2] = pt[1] + jy;
      P[o + 3] = pt[2] + jz;
      return;
    }

    // Main muscular myocardium cardiac body
    const phi = R() * 2 - 1;
    const theta = R() * TAU;
    const [x, y, z] = heartSurface(theta, phi, R);
    const interior = R() < 0.18 ? 0.78 + R() * 0.22 : 1;
    P[o] = 0;
    P[o + 1] = x * interior;
    P[o + 2] = y * interior;
    P[o + 3] = z * interior;
  },
  pos(P, o, t, out, k) {
    if (P[o] === 1) {
      // Live moving ECG / arterial blood-pressure trace below the heart
      const u = P[o + 1];
      const traceCycle = (u * 2 - t * 0.6 + 10) % 1;
      const waveY = ecg(traceCycle);
      const isPulseHead = Math.abs(traceCycle - 0.27) < 0.04;
      const glowY = isPulseHead ? 0.08 * Math.sin(t * 8) : 0;
      emit(out, k, -2.4 + u * 4.8, -1.82 + waveY * 1.1 + glowY + P[o + 2], 0.8, FLAT);
      return;
    }

    // Muscular systolic pump contraction: powerful squeeze and ventricular wringing
    const pump = 1 + 0.09 * beat(t);
    const twist = 0.06 * beat(t);

    if (P[o] === 2) {
      // Great vessels expand slightly during systolic pulse wave
      const vesselPulse = 1 + 0.04 * beat(t);
      emit(out, k, P[o + 1] * vesselPulse, P[o + 2] * (1 + 0.03 * beat(t)) + 0.04, P[o + 3] * vesselPulse, M_HEART);
      return;
    }

    let x = P[o + 1] * pump;
    let y = P[o + 2] * pump + 0.04;
    let z = P[o + 3] * pump;

    // Torsional twisting of ventricular apex during systole (apex rotates clockwise)
    const apexFactor = Math.max(0, 0.4 - y * 0.5);
    const effTwist = twist * (1 + apexFactor);
    const cosT = Math.cos(effTwist);
    const sinT = Math.sin(effTwist);
    const rx = x * cosT - z * sinT;
    const rz = x * sinT + z * cosT;
    emit(out, k, rx, y, rz, M_HEART);
  },
};

/* ── Economics: supply and demand, the market finding its price ──────── */

const ECO_O = [-2.1, -1.35];
const QMAX = 4.2;
const PMAX = 3.0;
// Dynamic demand shifts oscillating back and forth as market conditions adjust
const demandShift = (t) => 0.65 * Math.sin(t * 1.2);
const demandP = (q, d) => 2.85 - 0.65 * (q - d);
const supplyP = (q) => 0.35 + 0.58 * q;
const equilibrium = (t) => {
  const d = demandShift(t);
  const q = (2.85 + 0.65 * d - 0.35) / 1.23;
  return [q, supplyP(q)];
};
// Direct face-on flat XY coordinate plane: instantly reads as standard economic chart
const M_ECO = mat();
const chart = (q, p) => [ECO_O[0] + q, ECO_O[1] + p];

export const market = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden amber highlight: equilibrium point, pulsating intersection rings, and market clearance signals
      const b = R();
      if (b < 0.45) {
        // Glowing equilibrium point (Q*, P*)
        P[o] = 5;
        P[o + 1] = R();
        P[o + 2] = R();
        P[o + 3] = R();
      } else if (b < 0.75) {
        // Active trade transactions: energetic pulses flowing towards the equilibrium
        P[o] = 6;
        P[o + 1] = R() < 0.5 ? 1 : 2; // on demand curve or supply curve
        P[o + 2] = R(); // phase along curve
        P[o + 3] = 0.5 + R() * 0.5; // speed
      } else {
        // Dynamic dashed equilibrium projection lines to axes
        P[o] = 7;
        P[o + 1] = R();
        P[o + 2] = R();
        P[o + 3] = R();
      }
      return;
    }
    const b = R();
    P[o + 1] = R();
    P[o + 2] = R();
    P[o + 3] = (R() - 0.5) * 0.02;
    if (b < 0.22) P[o] = 0; // axes, ticks, arrowheads
    else if (b < 0.52) P[o] = 1; // demand curve (D)
    else if (b < 0.82) P[o] = 2; // supply curve (S)
    else P[o] = 3; // consumer & producer surplus fills
  },
  pos(P, o, t, out, k) {
    const kind = P[o];
    const u = P[o + 1];
    const v = P[o + 2];
    const d = demandShift(t);
    const [qe, pe] = equilibrium(t);
    let q;
    let p;
    let z = P[o + 3];

    if (kind === 0) {
      // Coordinate axes and ticks
      const part = Math.floor(v * 10);
      if (part < 4) [q, p] = [u * QMAX, 0]; // Quantity axis
      else if (part < 8) [q, p] = [0, u * PMAX]; // Price axis
      else if (part === 8) {
        // Axis tick marks
        const tick = Math.floor(u * 8);
        [q, p] = (u * 16) % 2 < 1 ? [(tick + 1) * 0.5, -0.06 * ((u * 50) % 1)] : [-0.06 * ((u * 50) % 1), (tick + 1) * 0.38];
      } else {
        // Axis arrowheads
        const s = u * 0.18;
        [q, p] = v < 0.95 ? [QMAX - s, (v < 0.925 ? 1 : -1) * s * 0.6] : [(v < 0.975 ? 1 : -1) * s * 0.6, PMAX - s];
      }
    } else if (kind === 1 || kind === 2) {
      // Curves with gentle wave shimmer
      // Flow along curve to give constant lively vitality
      const flow = (u + t * 0.08) % 1;
      q = 0.2 + flow * 3.8;
      p = kind === 1 ? demandP(q, d) : supplyP(q);
      if (p < 0.05 || p > PMAX) [q, p] = [qe, pe];
    } else if (kind === 3) {
      // Surplus shading
      q = u * qe;
      if (v < 0.5) {
        const top = demandP(q, d);
        p = pe + (v / 0.5) * Math.max(0, top - pe);
      } else {
        const bottom = supplyP(q);
        p = bottom + ((v - 0.5) / 0.5) * Math.max(0, pe - bottom);
      }
      z -= 0.05;
    } else if (kind === 5) {
      // Pulsating amber equilibrium point (Q*, P*) expanding and contracting with market shifts
      const pulse = 0.14 + 0.05 * Math.sin(t * 4);
      const [x, y, zz] = onSphereFrom(u, v, P[o + 3], pulse);
      const [cx, cy] = chart(qe, pe);
      emit(out, k, cx + x, cy + y, zz, M_ECO);
      return;
    } else if (kind === 6) {
      // Active transactions streaming down the curves towards equilibrium
      const curveType = P[o + 1];
      const speed = P[o + 3];
      const prog = (P[o + 2] + t * 0.45 * speed) % 1;
      q = 0.2 + prog * 3.8;
      p = curveType === 1 ? demandP(q, d) : supplyP(q);
      if (p < 0.05 || p > PMAX) [q, p] = [qe, pe];
      const [cx, cy] = chart(q, p);
      emit(out, k, cx, cy, 0.08, M_ECO);
      return;
    } else {
      // Dashed guide lines projecting to Price and Quantity axes
      const s = (Math.floor(u * 11) + v * 0.6) / 11;
      [q, p] = P[o + 3] < 0.5 ? [s * qe, pe] : [qe, s * pe];
      z = 0;
    }
    const [x, y] = chart(q, p);
    emit(out, k, x, y, z, M_ECO);
  },
};
function onSphereFrom(u, v, w, r) {
  const y = u * 2 - 1;
  const a = v * TAU;
  const s = Math.sqrt(1 - y * y);
  const rr = r * Math.cbrt(w);
  return [s * Math.cos(a) * rr, y * rr, s * Math.sin(a) * rr];
}

/* ── Mathematics: The Klein Bottle & Möbius Topology ────────────────────── */

/* ── Mathematics: Golden Ratio (Phi) Spiral & Stellated Icosahedron ─────── */

const PHI = (1 + Math.sqrt(5)) / 2; // ~1.6180339887
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5° in radians

// 12 vertices of an icosahedron based on golden rectangles
const ICOSA_VERTS = [
  [-1,  PHI, 0], [ 1,  PHI, 0], [-1, -PHI, 0], [ 1, -PHI, 0],
  [0, -1,  PHI], [0,  1,  PHI], [0, -1, -PHI], [0,  1, -PHI],
  [ PHI, 0, -1], [ PHI, 0,  1], [-PHI, 0, -1], [-PHI, 0,  1],
].map(v => {
  const len = Math.hypot(...v);
  return [v[0] / len * 1.5, v[1] / len * 1.5, v[2] / len * 1.5];
});

// 30 edges of the golden icosahedron
const ICOSA_EDGES = (() => {
  const edges = [];
  for (let i = 0; i < 12; i += 1) {
    for (let j = i + 1; j < 12; j += 1) {
      const d = Math.hypot(
        ICOSA_VERTS[i][0] - ICOSA_VERTS[j][0],
        ICOSA_VERTS[i][1] - ICOSA_VERTS[j][1],
        ICOSA_VERTS[i][2] - ICOSA_VERTS[j][2]
      );
      // In normalized golden icosahedron, edges have distance ~1.05
      if (Math.abs(d - 1.57) < 0.15) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
})();

const M_MATH_PHI = mat(['x', 0.38], ['y', 0.25], ['z', -0.1]);

export const lorenz = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden spiral logarithmic stream tracing the 3D Fibonacci spiral outward
      P[o] = 2;
      P[o + 1] = Math.pow(R(), 0.7); // parameter along the spiral [0, 1]
      P[o + 2] = R() < 0.5 ? 1 : -1; // upper or lower spiral arm
      P[o + 3] = (R() - 0.5) * 0.02;
      return;
    }

    const b = R();
    if (b < 0.55) {
      // 1. Logarithmic 3D Fermat/Fibonacci Phyllotaxis disk (sunflower seed geometry)
      const n = i;
      const r = Math.sqrt(R()) * 2.1;
      const theta = R() * TAU;
      P[o] = 0;
      P[o + 1] = r;
      P[o + 2] = theta;
      P[o + 3] = (R() - 0.5) * 0.04;
    } else if (b < 0.85) {
      // 2. Golden Icosahedron wireframe cage surrounding the spiral
      P[o] = 1;
      P[o + 1] = Math.floor(R() * ICOSA_EDGES.length);
      P[o + 2] = R(); // along edge
      P[o + 3] = (R() - 0.5) * 0.03;
    } else {
      // 3. Central golden node core
      P[o] = 3;
      const [sx, sy, sz] = onSphere(R, 0.28 * Math.cbrt(R()));
      P[o + 1] = sx;
      P[o + 2] = sy;
      P[o + 3] = sz;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];

    if (kind === 2) {
      // Dynamic golden spiral arm expanding outward at logarithmic rate
      const cycle = (P[o + 1] + t * 0.25) % 1;
      const theta = cycle * Math.PI * 4.0;
      const r = 0.25 + Math.pow(cycle, 1.3) * 1.85;
      const sign = P[o + 2];
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = Math.sin(cycle * Math.PI) * 0.35 * sign + P[o + 3];
      emit(out, k, x, y, z, M_MATH_PHI);
      return;
    }

    if (kind === 0) {
      // Phyllotaxis golden spiral disk rotating with harmonic precession
      const r = P[o + 1];
      const spin = t * (0.35 / (0.6 + r * 0.5));
      const theta = P[o + 2] + spin;
      // Dome/curvature of the phyllotaxis spiral: gentle bell curve
      const y = Math.exp(-r * r * 0.8) * 0.45 - 0.25 + P[o + 3];
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      emit(out, k, x, y, z, M_MATH_PHI);
      return;
    }

    if (kind === 1) {
      // 30 edges of the golden icosahedron
      const edge = ICOSA_EDGES[P[o + 1] % ICOSA_EDGES.length] || [0, 1];
      const frac = P[o + 2];
      const v0 = ICOSA_VERTS[edge[0]];
      const v1 = ICOSA_VERTS[edge[1]];
      const x = v0[0] + (v1[0] - v0[0]) * frac;
      const y = v0[1] + (v1[1] - v0[1]) * frac;
      const z = v0[2] + (v1[2] - v0[2]) * frac;

      // Slow 3D counter-rotation of the icosahedron cage
      const rot = t * 0.18;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const rx = x * c - z * s;
      const rz = x * s + z * c;
      emit(out, k, rx, y, rz, M_MATH_PHI);
      return;
    }

    // Kind 3: Central core
    const rot = t * 0.3;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const x = P[o + 1] * c - P[o + 3] * s;
    const z = P[o + 1] * s + P[o + 3] * c;
    emit(out, k, x, P[o + 2], z, M_MATH_PHI);
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
  // Turn each gear so a tooth of one sits in a gap of the next.
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
const M_GEARS = mat(['y', 0.45], ['x', -0.2]);

export const gears = {
  init(i, key, R, P, o) {
    const g = key ? 2 : R() < 0.62 ? 0 : 1;
    const G = GEARS[g];
    const b = R();
    P[o] = g;
    P[o + 1] = R() * TAU;
    P[o + 3] = (R() < 0.5 ? -1 : 1) * GEAR_Z;
    if (b < 0.5) P[o + 2] = -1; // the toothed rim
    else if (b < 0.64) P[o + 2] = G.R * 0.7; // inner rim
    else if (b < 0.78) {
      // five spokes
      P[o + 1] = (Math.floor(R() * 5) / 5) * TAU + (R() - 0.5) * 0.05;
      P[o + 2] = 0.22 * GEAR_SCALE + R() * (G.R * 0.7 - 0.22 * GEAR_SCALE);
    } else if (b < 0.9) P[o + 2] = 0.18 * GEAR_SCALE + (R() - 0.5) * 0.02; // hub
    else {
      // the teeth's sides, joining front and back
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
    emit(out, k, G.x + Math.cos(a) * r + 0.3, G.y + Math.sin(a) * r - 0.14, P[o + 3], M_GEARS);
  },
};

/* ── Literature: an open book, a page turning ─────────────────────────── */

const PAGE_W = 1.95;
const PAGE_D = 2.6;
const ROWS = 14;
const pageY = (x) => 0.36 * (1 - Math.exp(-Math.abs(x) * 3.2)) - 0.03 * Math.abs(x);
const wordAt = (row, x) => {
  const h = Math.sin(row * 12.9898 + Math.floor(x * 7) * 78.233) * 43758.5453;
  return h - Math.floor(h) > 0.22;
};
const rowZ = (row) => -PAGE_D / 2 + 0.28 + row * ((PAGE_D - 0.56) / (ROWS - 1));
const M_BOOK = mat(['x', 0.92], ['y', 0.1]);

export const book = {
  init(i, key, R, P, o) {
    if (key) {
      // the turning page: its text and its outline
      P[o] = 3;
      if (R() < 0.6) {
        const row = Math.floor(R() * ROWS);
        let u;
        do u = 0.12 + R() * 0.8;
        while (!wordAt(row + 40, u * PAGE_W) && R() < 0.95);
        P[o + 1] = u;
        P[o + 2] = rowZ(row);
      } else {
        const e = R();
        P[o + 1] = e < 0.5 ? R() : e < 0.75 ? 1 : R();
        P[o + 2] = e < 0.5 ? (R() < 0.5 ? -PAGE_D / 2 : PAGE_D / 2) : (R() - 0.5) * PAGE_D;
        if (e >= 0.75) P[o + 1] = R() < 0.5 ? 0.02 : 1;
      }
      return;
    }
    const b = R();
    const side = R() < 0.5 ? -1 : 1;
    if (b < 0.62) {
      // lines of text, word by word
      const row = Math.floor(R() * ROWS);
      let x;
      do x = (0.12 + R() * 0.8) * PAGE_W;
      while (!wordAt(row + (side > 0 ? 0 : 20), x) && R() < 0.95);
      P[o] = 0;
      P[o + 1] = side * x;
      P[o + 2] = pageY(x) + 0.005;
      P[o + 3] = rowZ(row) + (R() - 0.5) * 0.035;
    } else if (b < 0.8) {
      // page edges
      const e = R();
      const x = e < 0.6 ? R() * PAGE_W : PAGE_W;
      const z = e < 0.6 ? (R() < 0.5 ? -1 : 1) * PAGE_D / 2 : (R() - 0.5) * PAGE_D;
      P[o] = 0;
      P[o + 1] = side * x;
      P[o + 2] = pageY(x);
      P[o + 3] = z;
    } else if (b < 0.92) {
      // the block of pages at each side
      const x = PAGE_W - R() * 0.02;
      P[o] = 0;
      P[o + 1] = side * x;
      P[o + 2] = pageY(x) - R() * 0.32;
      P[o + 3] = (R() - 0.5) * PAGE_D;
    } else {
      // the cover, a little larger than the pages
      const x = R() * (PAGE_W + 0.12);
      const e = R() < 0.5;
      P[o] = 0;
      P[o + 1] = side * (e ? x : PAGE_W + 0.12);
      P[o + 2] = -0.34;
      P[o + 3] = e ? (R() < 0.5 ? -1 : 1) * (PAGE_D / 2 + 0.1) : (R() - 0.5) * (PAGE_D + 0.2);
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] !== 3) {
      emit(out, k, P[o + 1], P[o + 2] - 0.1, P[o + 3], M_BOOK);
      return;
    }
    // Turn right to left, then back left to right smoothly
    const cycle = t * 0.22;
    const n = Math.floor(cycle);
    const c = cycle - n;
    // Smooth cosine flip with hold at the edges
    const f = c < 0.12 ? 0 : c > 0.88 ? 1 : 0.5 - 0.5 * Math.cos(((c - 0.12) / 0.76) * Math.PI);
    const turned = n % 2 === 0 ? f : 1 - f;
    const u = P[o + 1]; // distance from spine [0 to 1]
    const z = P[o + 2]; // position along page height

    // Arch angle: the page arcs upward as it turns
    const theta = turned * Math.PI;
    // Aerodynamic page curl: outer edge bends and lifts with parabolic curl
    const midTurn = Math.sin(theta);
    const curl = midTurn * 0.45 * Math.sin(u * Math.PI * 0.85);
    const archY = midTurn * 0.75 * Math.sin(u * Math.PI * 0.5);
    const pageAngle = theta - midTurn * 0.4 * (1 - u);

    const r = u * PAGE_W;
    const px = Math.cos(pageAngle) * r;
    const py = pageY(px) + Math.sin(pageAngle) * r * 0.88 + archY + curl;
    // Gentle page corner curl flutter along Z
    const pz = z + midTurn * 0.18 * (u ** 2) * Math.sin(z * 1.5 + t * 2.5);

    emit(out, k, px, py - 0.1, pz, M_BOOK);
  },
};

/* ── Computer science: a neural network, signals flowing through ─────── */

const NET_LAYERS = [4, 7, 7, 7, 3];
const NET_NODES = [];
NET_LAYERS.forEach((count, l) => {
  for (let j = 0; j < count; j += 1) {
    NET_NODES.push({ l, x: -2.3 + l * 1.15, y: (j - (count - 1) / 2) * 0.48, z: Math.sin(j * 1.7 + l) * 0.18 });
  }
});
const NET_EDGES = [];
NET_NODES.forEach((a, ai) => NET_NODES.forEach((b, bi) => b.l === a.l + 1 && NET_EDGES.push([ai, bi])));
const M_NET = mat(['y', -0.38], ['x', 0.14]);

export const network = {
  init(i, key, R, P, o) {
    if (key) {
      P[o] = 2;
      P[o + 1] = Math.floor(R() * NET_EDGES.length);
      P[o + 2] = R();
      P[o + 3] = 0.3 + R() * 0.35;
    } else if (R() < 0.42) {
      const [x, y, z] = onSphere(R, 0.13 * (0.85 + R() * 0.2));
      P[o] = -(Math.floor(R() * NET_NODES.length) + 1);
      P[o + 1] = x;
      P[o + 2] = y;
      P[o + 3] = z;
    } else {
      P[o] = 1;
      P[o + 1] = Math.floor(R() * NET_EDGES.length);
      P[o + 2] = R();
      P[o + 3] = (R() - 0.5) * 0.015;
    }
  },
  pos(P, o, t, out, k) {
    if (P[o] < 0) {
      const id = -P[o] - 1;
      const n = NET_NODES[id];
      const pulse = 1 + 0.15 * Math.max(0, Math.sin(t * 2.4 - n.l * 1.1));
      emit(out, k, n.x + P[o + 1] * pulse, n.y + P[o + 2] * pulse, n.z + P[o + 3] * pulse, M_NET);
      return;
    }
    const [ai, bi] = NET_EDGES[P[o + 1]];
    const a = NET_NODES[ai];
    const b = NET_NODES[bi];
    const signal = P[o] === 2;
    const f = signal ? (P[o + 2] + t * P[o + 3]) % 1 : P[o + 2];
    const j = signal ? 0 : P[o + 3];
    emit(out, k, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + j, a.z + (b.z - a.z) * f, M_NET);
  },
};
