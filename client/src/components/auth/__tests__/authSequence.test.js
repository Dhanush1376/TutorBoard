// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { AUTH_SUBJECTS, TIMELINE, at } from '../authSequence';
import { build, fill } from '../../../pages/Marketing/particleShapes';

describe('sign-in film', () => {
  it('has twelve subjects, each with a pace of its own', () => {
    expect(AUTH_SUBJECTS).toHaveLength(12);
    expect(new Set(AUTH_SUBJECTS.map((s) => s.style))).toEqual(new Set(['drift', 'burst', 'swirl', 'snap']));
    const morphs = AUTH_SUBJECTS.map((s) => s.morph);
    expect(Math.min(...morphs)).toBeLessThan(1); // fast cuts
    expect(Math.max(...morphs)).toBeGreaterThan(2.2); // slow dissolves
  });

  it('opens on the galaxy, names every subject in order, and loops back', () => {
    const named = [];
    for (let t = 0; t < TIMELINE.total * 2; t += 0.05) {
      const s = at(t).subject;
      if (named[named.length - 1] !== s) named.push(s);
    }
    const subjects = AUTH_SUBJECTS.map((_, i) => i);
    // galaxy, 12 subjects, back into the galaxy (which is where the next loop opens)
    expect(named).toEqual([-1, ...subjects, -1, ...subjects, -1]);
  });

  it('blends smoothly: no jumps in the mix or the galaxy fade', () => {
    let prev = at(0);
    for (let t = 0.01; t < TIMELINE.total; t += 0.01) {
      const now = at(t);
      if (now.kind === prev.kind && now.from === prev.from) {
        expect(Math.abs(now.mix - prev.mix)).toBeLessThan(0.12);
        expect(Math.abs(now.open - prev.open)).toBeLessThan(0.05);
      }
      expect(now.mix).toBeGreaterThanOrEqual(0);
      expect(now.mix).toBeLessThanOrEqual(1);
      prev = now;
    }
  });

  it('every shape puts every particle somewhere sensible, at any moment', () => {
    const n = 2000;
    const shapes = AUTH_SUBJECTS.map((s) => s.shape);
    const data = build(n, shapes);
    const out = new Float32Array(n * 3);
    shapes.forEach((shape, s) => {
      for (const t of [0, 1.7, 13.3]) {
        fill(shape, data.params[s], t, out, n);
        let worst = 0;
        for (let i = 0; i < out.length; i += 1) worst = Number.isFinite(out[i]) ? Math.max(worst, Math.abs(out[i])) : Infinity;
        expect(worst, `${AUTH_SUBJECTS[s].name} at t=${t}`).toBeLessThan(4.5);
      }
    });
  });
});
