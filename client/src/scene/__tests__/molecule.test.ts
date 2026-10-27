import { describe, expect, it } from 'vitest';
import { moleculeLayout } from '../geometry';
import type { EntityOf } from '../types';

type Bond = [number, number, number];
const mol = (els: string[], bonds: Bond[]): EntityOf<'molecule'> =>
  ({ id: 'm', type: 'molecule', atoms: els.map((el) => ({ el })), bonds } as EntityOf<'molecule'>);

const ring6: Bond[] = [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1]];
const benzene = () => mol([...'CCCCCC', ...'HHHHHH'], [...ring6, ...[0, 1, 2, 3, 4, 5].map((i) => [i, 6 + i, 1] as Bond)]);
const toluene = () => mol(
  [...'CCCCCC', 'H', 'C', ...'HHHH', ...'HHH'],
  [...ring6, [0, 6, 1], [1, 7, 1], [2, 8, 1], [3, 9, 1], [4, 10, 1], [5, 11, 1], [7, 12, 1], [7, 13, 1], [7, 14, 1]],
);
const naphthalene = () => mol([...'CCCCCCCCCC'], [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1], [5, 6, 1], [6, 7, 2], [7, 8, 1], [8, 9, 2], [9, 0, 1]]);
const cyclohexane = () => mol(
  [...'CCCCCC', ...'HHHHHHHHHHHH'],
  [...ring6.map(([a, b]) => [a, b, 1] as Bond), ...Array.from({ length: 12 }, (_, k) => [Math.floor(k / 2), 6 + k, 1] as Bond)],
);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Every bond drawn at its length (±2%), no two atoms overlapping. */
const expectClean = (m: EntityOf<'molecule'>) => {
  const g = moleculeLayout(m);
  for (const [a, b] of m.bonds) {
    const want = m.atoms[a].el === 'H' || m.atoms[b].el === 'H' ? 150 : 165;
    expect(Math.abs(dist(g.pos[a], g.pos[b]) - want) / want, `bond ${a}-${b}`).toBeLessThan(0.02);
  }
  for (let i = 0; i < g.pos.length; i++) for (let j = i + 1; j < g.pos.length; j++) {
    expect(dist(g.pos[i], g.pos[j]), `atoms ${i} and ${j} overlap`).toBeGreaterThan(g.radius[i] + g.radius[j]);
  }
  return g;
};

describe('molecule layout', () => {
  it('draws benzene as a regular hexagon with hydrogens straight out', () => {
    const g = expectClean(benzene());
    const ring = g.pos.slice(0, 6);
    const c = { x: ring.reduce((s, p) => s + p.x, 0) / 6, y: ring.reduce((s, p) => s + p.y, 0) / 6 };
    for (const p of ring) expect(dist(p, c)).toBeCloseTo(165, 0); // hexagon circumradius = side
    // each H on the line from the centre through its carbon
    for (let i = 0; i < 6; i++) expect(dist(g.pos[6 + i], c)).toBeCloseTo(165 + 150, 0);
  });

  it('puts the methyl group of toluene on the carbon it is bonded to, pointing out of the ring', () => {
    const g = expectClean(toluene());
    const c = { x: g.pos.slice(0, 6).reduce((s, p) => s + p.x, 0) / 6, y: g.pos.slice(0, 6).reduce((s, p) => s + p.y, 0) / 6 };
    expect(dist(g.pos[7], c)).toBeCloseTo(165 + 165, 0);
  });

  it('fuses naphthalene into two flat hexagons sharing one edge', () => {
    const g = expectClean(naphthalene());
    // the second ring opens away from the first: its far atoms are farther from ring A's centre than ring A's atoms
    const a = g.pos.slice(0, 6);
    const ca = { x: a.reduce((s, p) => s + p.x, 0) / 6, y: a.reduce((s, p) => s + p.y, 0) / 6 };
    for (const i of [6, 7, 8, 9]) expect(dist(g.pos[i], ca)).toBeGreaterThan(200);
  });

  it('fans the two hydrogens of each CH₂ in cyclohexane without collisions', () => {
    expectClean(cyclohexane());
  });

  it('leaves acyclic molecules on the VSEPR path (water stays bent)', () => {
    const g = moleculeLayout(mol(['O', 'H', 'H'], [[0, 1, 1], [0, 2, 1]]));
    expect(g.pos[1].y).toBeCloseTo(g.pos[2].y, 6); // symmetric
    expect(g.pos[1].x).not.toBe(g.pos[2].x);
  });
});
