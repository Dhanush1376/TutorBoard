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
      // Static randomized base distance along the ray so the end fades naturally without a cut edge
      P[o + 2] = R();
      // Jitter & maximum ray span variation (gives natural organic beam termination)
      P[o + 3] = gaussR(R) * 0.018;
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
      // Flow along the incoming and internal beams seamlessly from edge to edge
      const s = (P[o + 1] + t * 0.35) % 1;
      const [a, b] = kind === 3 ? [BEAM_FROM, P_IN] : [P_IN, P_OUT];
      emit(out, k, a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s + P[o + 2], P[o + 3], M_PRISM);
      return;
    }
    // The spectrum: 7 distinct rays fanning out smoothly to the right.
    // Rays start exactly at the prism surface (len starts at 0.0) without any gap.
    // Particles move along the beam with varied static max bounds so ends dissolve/taper
    // instead of creating an artificial circular cutting edge.
    const baseDist = P[o + 2];
    const s = (baseDist + t * 0.35) % 1;
    const rayIdx = P[o + 1];
    const [dx, dy] = rayDir(rayIdx);
    
    // Smooth tapering length: spans from 0.0 (right on the surface of the prism)
    // up to 2.45 with subtle per-particle feathering so the tail ends softly and naturally
    const maxReach = 2.45 + P[o + 3] * 6.0;
    const len = s * maxReach;
    const spread = (rayIdx - 3) * 0.035;
    
    emit(
      out,
      k,
      P_OUT[0] + dx * len,
      P_OUT[1] + dy * len + P[o + 3] * (0.8 + s * 1.4),
      spread * (0.8 + s * 1.2) + P[o + 3] * 0.4,
      M_PRISM,
    );
  },
};

/* ── Astronomy: Gargantua (Interstellar Kerr Black Hole & Lensed Accretion Disk) ── */

// ── Interstellar Gargantua: Thorne General Relativity Model ──
// Accretion disk inclined at ~17° to line of sight.
// In Thorne & Double Negative's Interstellar renderer (DNGR):
// 1. Primary image: The flat horizontal disk (y = 0, z > 0 in front; z < 0 behind) sweeps across.
// 2. Gravitational Lensing (Upper & Lower images): Light from the disk BEHIND the black hole
//    is bent by spacetime curvature over the top (upper arch) and under the bottom (lower arch).
// 3. Spacetime coordinates: The lensed arches naturally meet the primary disk at the left and right flanks.
// 4. Relativistic Doppler Beaming: Approaching matter (left flank) is blue-shifted/brighter,
//    receding matter (right flank) is red-shifted/dimmer.
const M_BLACKHOLE = mat(['x', 0.30], ['y', 0.08]);
const RS = 0.68;        // Event horizon shadow radius (clean central circular void)
const R_ISCO = 0.96;    // Innermost stable circular orbit (bright photon ring)
const R_DISK_MAX = 4.2; // Outer accretion disk radius

export const blackhole = {
  init(i, key, R, P, o) {
    if (key) {
      // Relativistic amber hotspots: concentrated on the inner ISCO photon ring
      // and Doppler-boosted approaching flank
      const roll = R();
      if (roll < 0.65) {
        // Glowing inner ISCO photon ring
        P[o] = 0;
        P[o + 1] = R_ISCO + Math.pow(R(), 2.8) * 0.35;
        P[o + 2] = R() * TAU;
        P[o + 3] = (R() - 0.5) * 0.015;
      } else {
        // Lensed upper/lower halo ring highlights
        P[o] = 1;
        P[o + 1] = R_ISCO + Math.pow(R(), 1.8) * 0.95;
        P[o + 2] = R() * TAU;
        P[o + 3] = R() < 0.5 ? 1 : -1;
      }
      return;
    }

    const b = R();
    if (b < 0.60) {
      // 1. Broad horizontal accretion disk
      const u = R();
      const r = R_ISCO + Math.pow(u, 1.35) * (R_DISK_MAX - R_ISCO);
      const theta = R() * TAU;
      const flare = 0.005 + 0.022 * (r - R_ISCO);
      P[o] = 0;
      P[o + 1] = r;
      P[o + 2] = theta;
      P[o + 3] = gaussR(R) * flare;
    } else if (b < 0.92) {
      // 2. Gravitational lensing halo (the rear accretion disk lensed around the event horizon)
      const u = R();
      const r = R_ISCO + Math.pow(u, 1.45) * (R_DISK_MAX * 0.85 - R_ISCO);
      const theta = R() * TAU;
      const side = R() < 0.5 ? 1 : -1;
      P[o] = 1;
      P[o + 1] = r;
      P[o + 2] = theta;
      P[o + 3] = side;
    } else {
      // 3. Relativistic infalling plasma spiral crossing the photon sphere into the event horizon
      P[o] = 2;
      P[o + 1] = RS * 1.02 + R() * (R_ISCO - RS * 1.02);
      P[o + 2] = R() * TAU;
      P[o + 3] = (R() - 0.5) * 0.012;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];

    if (kind === 0) {
      // Primary horizontal accretion disk with differential Keplerian rotation
      const r = P[o + 1];
      const omega = 1.85 / Math.pow(r, 1.25);
      const angle = P[o + 2] + t * omega;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = P[o + 3];

      // Behind the black hole (z < 0), rays that hit the event horizon are absorbed.
      // Rays outside the horizon (r > RS) continue cleanly.
      // If behind the event horizon shadow sphere, smoothly conceal it:
      if (z < -0.05 && (x * x + y * y) < (RS * 1.02) ** 2) {
        // Drop within event horizon shadow void (absorbed by singularity)
        emit(out, k, 0, 0, 0, M_BLACKHOLE);
        return;
      }

      emit(out, k, x, y, z, M_BLACKHOLE);
      return;
    }

    if (kind === 1) {
      // Gravitationally Lensed Images (the iconic Interstellar upper and lower arches)
      // Light emitted from the accretion disk behind the black hole (z < 0)
      // travels along curved geodesics around the sphere toward the observer.
      const r = P[o + 1];
      const omega = 1.85 / Math.pow(r, 1.25);
      const angle = P[o + 2] + t * omega;
      const side = P[o + 3]; // +1 = upper arch (deflected up), -1 = lower arch (deflected down)

      // Angle phi sweeps along the visible semi-circle arch
      const phi = angle;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      // In Einstein's deflection, the lensed image of radius r appears at apparent radius:
      // haloR = RS + (r - RS) * deflection_compression
      const haloR = RS * 1.14 + (r - R_ISCO) * 0.52;

      // Symmetrical circular arch surrounding the event horizon:
      const x = cosP * haloR;
      // Arch rises over the top (or under bottom) and cleanly connects to the horizontal disk at the flanks (|cosP| ~ 1)
      const y = Math.abs(sinP) * haloR * side;
      // Positioned in the plane of the black hole
      const z = -0.15;

      emit(out, k, x, y, z, M_BLACKHOLE);
      return;
    }

    // Infalling plasma spiral (kind === 2)
    const baseR = P[o + 1];
    const plunge = (P[o + 2] + t * 0.85) % 1;
    const r = Math.max(RS * 1.01, baseR - plunge * 0.22);
    const omega = 3.6 / Math.pow(r, 1.15);
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
        // Volcanic eruption: incandescent ballistic bombs, billowing ash fountain, and expanding umbrella cloud
        const ang = R() * TAU;
        // Directional ejection velocity with angular dispersion (fountain fan)
        const speed = 0.35 + R() * 0.75;
        // Radial spread and vertical loft capability
        const loft = 0.7 + R() * 0.9;
        P[o] = 4;
        P[o + 1] = Math.cos(ang) * speed;
        P[o + 2] = Math.sin(ang) * speed;
        P[o + 3] = loft;
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
      // Powerful, grounded volcanic eruption:
      // High-velocity vertical magma thrust from the crater vent, forming a dense,
      // coherent volcanic column that decelerates and fountains naturally back down onto the cone.
      // Zero floating sprinkles or artificial wind drift.
      const phase = (Math.abs(P[o + 1]) * 1.8 + t * 0.45) % 1;
      const loft = P[o + 3];

      // Vertical trajectory: rapid explosive upward surge from vent, smooth apex, gravity return
      const vy = Math.sin(phase * Math.PI);
      const yEjecta = mountainH(0, 0) + 0.05 + vy * (0.62 * loft);

      // Radial column expansion: tight compact core at the vent, expanding only at apex
      const radial = (0.04 + 0.18 * Math.pow(phase, 1.8)) * (0.8 + 0.4 * loft);
      const ang = Math.atan2(P[o + 2], P[o + 1]);

      x = Math.cos(ang) * radial;
      z = Math.sin(ang) * radial;
      y = yEjecta;
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
    // History Colosseum scaled big (1.45x) for grand, imposing presence
    const zoom = 1.45;
    x *= zoom;
    y = (y - 0.08) * zoom;
    z *= zoom;

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

/* ── Economics: 3D Global Trade Network & Flowing Capital Arcs ───────── */

const GLOBE_R = 1.62; // Zoomed in (~1.20x) for enhanced clarity and presence
// Key global financial centres [latitude, longitude in radians]
// New York (40.7°N, -74.0°W), London (51.5°N, -0.1°W), Tokyo (35.7°N, 139.7°E),
// Singapore (1.3°N, 103.8°E), Frankfurt (50.1°N, 8.7°E), Hong Kong (22.3°N, 114.2°E),
// Sydney (-33.8°S, 151.2°E), São Paulo (-23.5°S, -46.6°W)
const HUBS = [
  { name: 'NYC', lat: 40.7 * (Math.PI / 180), lon: -74.0 * (Math.PI / 180) },
  { name: 'LON', lat: 51.5 * (Math.PI / 180), lon: -0.1 * (Math.PI / 180) },
  { name: 'TYO', lat: 35.7 * (Math.PI / 180), lon: 139.7 * (Math.PI / 180) },
  { name: 'SGP', lat: 1.3 * (Math.PI / 180), lon: 103.8 * (Math.PI / 180) },
  { name: 'FRA', lat: 50.1 * (Math.PI / 180), lon: 8.7 * (Math.PI / 180) },
  { name: 'HKG', lat: 22.3 * (Math.PI / 180), lon: 114.2 * (Math.PI / 180) },
  { name: 'SYD', lat: -33.8 * (Math.PI / 180), lon: 151.2 * (Math.PI / 180) },
  { name: 'SAO', lat: -23.5 * (Math.PI / 180), lon: -46.6 * (Math.PI / 180) },
];

// Major global financial capital trade corridors:
const TRADE_ROUTES = [
  [0, 1], // NYC <-> London
  [1, 4], // London <-> Frankfurt
  [4, 5], // Frankfurt <-> Hong Kong
  [0, 2], // NYC <-> Tokyo
  [1, 3], // London <-> Singapore
  [2, 5], // Tokyo <-> Hong Kong
  [3, 6], // Singapore <-> Sydney
  [0, 7], // NYC <-> São Paulo
  [5, 3], // Hong Kong <-> Singapore
];

const latLonToSphere = (lat, lon, r = GLOBE_R) => {
  const cosLat = Math.cos(lat);
  return [r * cosLat * Math.sin(lon), r * Math.sin(lat), r * cosLat * Math.cos(lon)];
};

// Hub 3D positions on the sphere surface:
const HUB_POS = HUBS.map(h => latLonToSphere(h.lat, h.lon, GLOBE_R));

// Precalculate great circle geodesics with high arch for each route:
const ROUTES_DATA = TRADE_ROUTES.map(([aIdx, bIdx]) => {
  const A = HUB_POS[aIdx];
  const B = HUB_POS[bIdx];
  const dot = (A[0] * B[0] + A[1] * B[1] + A[2] * B[2]) / (GLOBE_R * GLOBE_R);
  const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
  return { aIdx, bIdx, A, B, ang };
});

// Earth's natural cross-axis tilt: ~23.4° (0.41 rad) on Z combined with gentle forward tilt on X
const M_ECO = mat(['z', -0.38], ['x', 0.28], ['y', 0.12]);

export const market = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden financial capital stream:
      // High-frequency financial transactions streaming dynamically along global trade corridors
      // and pulsing at major exchange hubs
      const roll = R();
      if (roll < 0.65) {
        // High-speed transaction packets traveling along trade corridor arcs
        P[o] = 3;
        P[o + 1] = Math.floor(R() * ROUTES_DATA.length); // route index
        P[o + 2] = R(); // progress along arc
        P[o + 3] = (R() - 0.5) * 0.025; // slight lateral jitter
      } else {
        // Pulsing glowing financial capital at trade exchange hubs
        P[o] = 4;
        P[o + 1] = Math.floor(R() * HUBS.length); // hub index
        P[o + 2] = R() * TAU; // angle
        P[o + 3] = Math.pow(R(), 0.5); // radius spread
      }
      return;
    }

    const b = R();
    if (b < 0.48) {
      // 1. Globe latitude and longitude coordinate grid (graticule):
      // Equator, parallels (±20°, ±40°, ±60°), and meridians
      P[o] = 0;
      if (R() < 0.5) {
        // Parallels (latitude rings)
        const lats = [-60, -40, -20, 0, 20, 40, 60].map(deg => deg * (Math.PI / 180));
        const lat = lats[Math.floor(R() * lats.length)];
        const lon = R() * TAU;
        P[o + 1] = lat;
        P[o + 2] = lon;
        P[o + 3] = (R() - 0.5) * 0.015;
      } else {
        // Meridians (longitude rings)
        const lon = (Math.floor(R() * 12) / 12) * TAU;
        const lat = (R() * 2 - 1) * (Math.PI * 0.42);
        P[o + 1] = lat;
        P[o + 2] = lon;
        P[o + 3] = (R() - 0.5) * 0.015;
      }
    } else if (b < 0.78) {
      // 2. Continental clusters / economic landmass point cloud
      // Seeded near global hubs with slight regional dispersion
      P[o] = 1;
      const hubIdx = Math.floor(R() * HUBS.length);
      const h = HUBS[hubIdx];
      const dLat = (R() - 0.5) * 0.45;
      const dLon = (R() - 0.5) * 0.65;
      P[o + 1] = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, h.lat + dLat));
      P[o + 2] = h.lon + dLon;
      P[o + 3] = (R() - 0.5) * 0.02;
    } else {
      // 3. Trade route arch bridges (parabolic arches rising above the globe)
      P[o] = 2;
      P[o + 1] = Math.floor(R() * ROUTES_DATA.length);
      P[o + 2] = R(); // static position along corridor arc
      P[o + 3] = (R() - 0.5) * 0.02;
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];
    // Globe rotates smoothly around its polar axis
    const rot = t * 0.22;

    if (kind === 0 || kind === 1) {
      // Latitude / Longitude lines & Continental Hub mass on the globe
      const lat = P[o + 1];
      const lon = P[o + 2] + rot;
      const r = GLOBE_R + P[o + 3];
      const cosLat = Math.cos(lat);
      const x = r * cosLat * Math.sin(lon);
      const y = r * Math.sin(lat);
      const z = r * cosLat * Math.cos(lon);
      emit(out, k, x, y, z, M_ECO);
      return;
    }

    if (kind === 2) {
      // Trade corridor structural arch
      const route = ROUTES_DATA[P[o + 1]];
      const s = P[o + 2];
      // Great circle slerp interpolation between Hub A and Hub B
      const sinTotal = Math.sin(route.ang);
      const wA = Math.sin((1 - s) * route.ang) / (sinTotal || 1);
      const wB = Math.sin(s * route.ang) / (sinTotal || 1);
      
      // Parabolic altitude arch: peaks at s = 0.5, rising cleanly above globe surface
      const archAlt = Math.sin(s * Math.PI) * 0.32;
      const unitR = GLOBE_R + archAlt;

      let px = route.A[0] * wA + route.B[0] * wB;
      let py = route.A[1] * wA + route.B[1] * wB;
      let pz = route.A[2] * wA + route.B[2] * wB;
      const len = Math.hypot(px, py, pz) || 1;
      px = (px / len) * unitR;
      py = (py / len) * unitR;
      pz = (pz / len) * unitR;

      // Apply polar rotation
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const rx = px * cosR + pz * sinR;
      const rz = -px * sinR + pz * cosR;

      emit(out, k, rx, py + P[o + 3], rz, M_ECO);
      return;
    }

    if (kind === 3) {
      // Golden financial transaction packets actively streaming along the trade arches
      const route = ROUTES_DATA[P[o + 1]];
      const s = (P[o + 2] + t * 0.45) % 1;
      
      const sinTotal = Math.sin(route.ang);
      const wA = Math.sin((1 - s) * route.ang) / (sinTotal || 1);
      const wB = Math.sin(s * route.ang) / (sinTotal || 1);
      
      const archAlt = Math.sin(s * Math.PI) * 0.34;
      const unitR = GLOBE_R + archAlt;

      let px = route.A[0] * wA + route.B[0] * wB;
      let py = route.A[1] * wA + route.B[1] * wB;
      let pz = route.A[2] * wA + route.B[2] * wB;
      const len = Math.hypot(px, py, pz) || 1;
      px = (px / len) * unitR;
      py = (py / len) * unitR;
      pz = (pz / len) * unitR;

      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const rx = px * cosR + pz * sinR;
      const rz = -px * sinR + pz * cosR;

      emit(out, k, rx, py, rz, M_ECO);
      return;
    }

    // Kind 4: Financial Exchange Hub pulse (New York, London, Tokyo, Singapore)
    const hub = HUBS[P[o + 1]];
    const lon = hub.lon + rot;
    const base = latLonToSphere(hub.lat, lon, GLOBE_R);
    
    // Pulsing radial beacon of market activity
    const pulse = 0.05 + 0.03 * Math.sin(t * 3.5 + P[o + 1]);
    const ang = P[o + 2];
    const rSpread = P[o + 3] * pulse;
    
    emit(out, k, base[0] + Math.cos(ang) * rSpread, base[1] + Math.sin(ang) * rSpread, base[2], M_ECO);
  },
};
function onSphereFrom(u, v, w, r) {
  const y = u * 2 - 1;
  const a = v * TAU;
  const s = Math.sqrt(1 - y * y);
  const rr = r * Math.cbrt(w);
  return [s * Math.cos(a) * rr, y * rr, s * Math.sin(a) * rr];
}

/* ── Mathematics: Geometric Drafting Compass & Ruler Drawing a Circle ── */

const COMPASS_RADIUS = 1.35; // Radius of the circle being drawn
const COMPASS_CENTER = [0.0, -0.30]; // Center point of the circle
const COMPASS_LEG_LEN = 2.45; // Length of the compass legs
const RULER_LEN = 4.2; // Length of the drafting straightedge/ruler
const RULER_H = 0.55; // Width of the ruler

// Gentle 3D perspective angle so the compass stands upright above the drawing plane
const M_COMPASS = mat(['x', 0.42], ['y', 0.12]);

export const lorenz = {
  init(i, key, R, P, o) {
    if (key) {
      // Golden Amber Accent Particles:
      // The sharp pencil lead drawing tip, active drawn circumference trail,
      // and ruler millimeter tick markings
      const roll = R();
      if (roll < 0.55) {
        // Glowing pencil tip & recently drawn arc trail
        P[o] = 4;
        P[o + 1] = R(); // progress along the currently drawn arc
        P[o + 2] = (R() - 0.5) * 0.02; // radial jitter
        P[o + 3] = (R() - 0.5) * 0.015;
      } else {
        // Golden ruler measurement graduation ticks
        P[o] = 5;
        const tickIdx = Math.floor(R() * 21);
        P[o + 1] = -RULER_LEN / 2 + (tickIdx / 20) * RULER_LEN; // x along ruler
        P[o + 2] = R(); // fraction along tick height
        P[o + 3] = tickIdx % 5 === 0 ? 0.16 : 0.09; // major vs minor tick length
      }
      return;
    }

    const b = R();
    if (b < 0.28) {
      // 1. Compass Legs (Left needle pivot leg and Right pencil leg)
      P[o] = 0;
      P[o + 1] = R() < 0.5 ? 0 : 1; // 0: needle leg, 1: pencil leg
      P[o + 2] = R(); // position along leg [0 = hinge/apex, 1 = tip]
      P[o + 3] = (R() - 0.5) * 0.025; // leg thickness
    } else if (b < 0.38) {
      // 2. Compass Top Hinge Knurled Wheel & Spindle
      P[o] = 1;
      const part = R();
      if (part < 0.4) {
        // Top knurled handle grip
        P[o + 1] = 0;
        P[o + 2] = R(); // height along handle
        P[o + 3] = R() * TAU; // cylinder angle
      } else {
        // Central pivot circular joint
        P[o + 1] = 1;
        P[o + 2] = R() * 0.12; // radius
        P[o + 3] = R() * TAU; // angle
      }
    } else if (b < 0.68) {
      // 3. The Geometric Circle being drawn on the paper
      P[o] = 2;
      P[o + 1] = R() * TAU; // angle around the circle
      P[o + 2] = (R() - 0.5) * 0.02; // line thickness
      P[o + 3] = (R() - 0.5) * 0.01;
    } else {
      // 4. Wooden / Brass Drafting Straightedge (Ruler) underneath
      P[o] = 3;
      const edge = R();
      if (edge < 0.65) {
        // Top and bottom bevel edges of ruler
        P[o + 1] = (R() - 0.5) * RULER_LEN;
        P[o + 2] = edge < 0.325 ? -RULER_H / 2 : RULER_H / 2;
        P[o + 3] = (R() - 0.5) * 0.015;
      } else {
        // Inner body surface shimmer of the ruler
        P[o + 1] = (R() - 0.5) * (RULER_LEN - 0.1);
        P[o + 2] = (R() - 0.5) * (RULER_H - 0.08);
        P[o + 3] = (R() - 0.5) * 0.015;
      }
    }
  },
  pos(P, o, t, out, k) {
    const kind = P[o];

    // Compass rotates continuously drawing the circle:
    // Angle theta sweeps around the circle from 0 to 2*PI
    const drawSpeed = 0.55;
    const theta = (t * drawSpeed) % TAU;

    // Needle pivot point stays anchored at circle center on the drawing plane
    const pivot = [COMPASS_CENTER[0], COMPASS_CENTER[1], 0.0];

    // Pencil tip rotates on the perimeter at radius COMPASS_RADIUS
    const pencilTip = [
      COMPASS_CENTER[0] + Math.cos(theta) * COMPASS_RADIUS,
      COMPASS_CENTER[1] + Math.sin(theta) * COMPASS_RADIUS,
      0.0,
    ];

    // Compass apex hinge point above the center between the needle and pencil
    // By Pythagorean theorem: legLen^2 = halfSpan^2 + hingeHeight^2
    const halfSpan = COMPASS_RADIUS / 2;
    const hingeHeight = Math.sqrt(Math.max(0.4, COMPASS_LEG_LEN ** 2 - halfSpan ** 2));
    const hinge = [
      (pivot[0] + pencilTip[0]) / 2,
      (pivot[1] + pencilTip[1]) / 2,
      hingeHeight,
    ];

    if (kind === 0) {
      // Compass Legs (0: Needle leg from hinge to pivot, 1: Pencil leg from hinge to pencilTip)
      const isPencil = P[o + 1] === 1;
      const s = P[o + 2]; // 0 at hinge, 1 at tip
      const start = hinge;
      const end = isPencil ? pencilTip : pivot;
      const thick = P[o + 3];

      const x = start[0] + (end[0] - start[0]) * s + thick;
      const y = start[1] + (end[1] - start[1]) * s;
      const z = start[2] + (end[2] - start[2]) * s + thick;
      emit(out, k, x, y, z, M_COMPASS);
      return;
    }

    if (kind === 1) {
      // Compass Hinge Joint & Top Knurled Turning Handle
      const part = P[o + 1];
      if (part === 0) {
        // Vertical handle on top of hinge
        const hFrac = P[o + 2];
        const ang = P[o + 3];
        const handleR = 0.045;
        const x = hinge[0] + Math.cos(ang) * handleR;
        const y = hinge[1] + Math.sin(ang) * handleR;
        const z = hinge[2] + 0.06 + hFrac * 0.45;
        emit(out, k, x, y, z, M_COMPASS);
        return;
      }
      // Circular joint ring
      const r = P[o + 2];
      const ang = P[o + 3];
      const x = hinge[0] + Math.cos(ang) * r;
      const y = hinge[1] + Math.sin(ang) * r;
      const z = hinge[2];
      emit(out, k, x, y, z, M_COMPASS);
      return;
    }

    if (kind === 2) {
      // The Circle drawn on the page (full perimeter)
      const ang = P[o + 1];
      const r = COMPASS_RADIUS + P[o + 2];
      const x = COMPASS_CENTER[0] + Math.cos(ang) * r;
      const y = COMPASS_CENTER[1] + Math.sin(ang) * r;
      emit(out, k, x, y, 0.005, M_COMPASS);
      return;
    }

    if (kind === 3) {
      // Drafting Straightedge / Ruler positioned below the circle
      const rx = P[o + 1];
      const ry = -1.55 + P[o + 2]; // Resting at bottom of drawing
      emit(out, k, rx, ry, -0.015, M_COMPASS);
      return;
    }

    if (kind === 4) {
      // Golden Amber: Pencil drawing arc trailing immediately behind the pencil tip
      const trailSpan = 1.4; // Trail angle in radians
      const s = P[o + 1];
      const trailAngle = theta - s * trailSpan;
      const r = COMPASS_RADIUS + P[o + 2];
      const x = COMPASS_CENTER[0] + Math.cos(trailAngle) * r;
      const y = COMPASS_CENTER[1] + Math.sin(trailAngle) * r;
      const z = 0.02 + s * 0.01;
      emit(out, k, x, y, z, M_COMPASS);
      return;
    }

    // Kind 5: Golden Ruler Millimeter Ticks
    const tickX = P[o + 1];
    const s = P[o + 2];
    const tickLen = P[o + 3];
    const rulerTopY = -1.55 + RULER_H / 2;
    const tickY = rulerTopY - s * tickLen;
    emit(out, k, tickX, tickY, 0.01, M_COMPASS);
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
    // Normal page turning: The page turns smoothly from right to left around the spine.
    // The page maintains its exact width and height — no distortion, expansion, or shrinking.
    const cycle = t * 0.22;
    const n = Math.floor(cycle);
    const c = cycle - n;
    // Smooth cosine turn with pause when resting on either side
    const f = c < 0.14 ? 0 : c > 0.86 ? 1 : 0.5 - 0.5 * Math.cos(((c - 0.14) / 0.72) * Math.PI);
    const turned = n % 2 === 0 ? f : 1 - f;
    const u = P[o + 1]; // distance from spine [0 to 1]
    const z = P[o + 2]; // position along page height

    // Normal hinge angle turning around the spine from 0 (flat on right) to PI (flat on left)
    const angle = turned * Math.PI;
    const r = u * PAGE_W; // Exact constant page width

    // Clean, natural turning arc:
    // px sweeps from +r to -r
    const px = Math.cos(angle) * r;
    // py lifts smoothly in a semicircle during the turn, and sits flush on the book surface at the rest positions
    const midTurn = Math.sin(angle);
    const restY = pageY(px);
    const py = restY + midTurn * (Math.sin(angle) * r * 0.75);

    emit(out, k, px, py - 0.1, z, M_BOOK);
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
