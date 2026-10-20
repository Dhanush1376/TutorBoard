import { Easing, interpolate } from 'remotion';

// One easing language for the whole film: long, decisive ease-outs for things
// arriving, symmetric ease-in-outs for camera moves.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

/** 0→1 over [start, start+dur], clamped, eased. */
export const prog = (frame: number, start: number, dur: number, ease = easeOut) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

/** Fade in over `inDur` from `start`, fade out over `outDur` ending at `end`. */
export const window = (frame: number, start: number, end: number, inDur = 12, outDur = 12) =>
  Math.min(prog(frame, start, inDur), 1 - prog(frame, end - outDur, outDur, easeIn));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Piecewise keyframes: [[frame, value], ...] with an easing per segment. */
export const keys = (frame: number, pts: Array<[number, number]>, ease = easeInOut) => {
  if (frame <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [f1, v1] = pts[i];
    const [f0, v0] = pts[i - 1];
    if (frame <= f1) return lerp(v0, v1, ease((frame - f0) / Math.max(1, f1 - f0)));
  }
  return pts[pts.length - 1][1];
};

/** Deterministic pseudo-random in [0,1) for a seed. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
