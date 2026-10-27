import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateScene } from '../engine/scene/index.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
type Act = { do: string; target?: unknown; to?: number[]; text?: string; value?: unknown };
type Out = {
  beats: { title: string; narration: string; actions: Act[] }[];
  entities: { id: string; type: string; text?: string; points?: { at: number[]; cls?: string }[]; expr?: string }[];
  spaces: { id: string; x: number[]; y: number[] }[];
  provenance?: { algorithm: string; data: string }[];
};
const run = (compute: object): Out => {
  const r = validateScene({ version: '1', title: 'ML', domain: 'ml', entities: [], beats: [{ title: 'Run', narration: 'computed', compute }] });
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  return r.scene as unknown as Out;
};
const errs = (compute: object) => {
  const r = validateScene({ version: '1', title: 'ML', domain: 'ml', entities: [], beats: [{ title: 'Run', narration: 'computed', compute }] });
  return r.ok ? [] : r.errors.map((e) => e.message);
};
const moves = (s: Out, id: string) => s.beats.flatMap((b) => b.actions.filter((a) => a.do === 'move' && a.target === id).map((a) => a.to!));

describe('gradient descent', () => {
  it('follows x ← x − lr·f′(x) exactly', () => {
    const s = run({ algorithm: 'gradient-descent', target: 'gd', args: { f: 'x^2 - 4x + 5', x0: 0, lr: 0.25, steps: 4 } });
    const xs = moves(s, 'gd-ball').map((p) => p[0]);
    // f′(x) = 2x − 4: 0 → 1 → 1.5 → 1.75 → 1.875
    [1, 1.5, 1.75, 1.875].forEach((x, i) => expect(xs[i]).toBeCloseTo(x, 6));
    moves(s, 'gd-ball').forEach(([x, y]) => expect(y).toBeCloseTo(x * x - 4 * x + 5, 6));
    expect(s.spaces[0].id).toBe('gd'); // a space sized to the path was created
  });

  it('changes with the learning rate, and says when it diverges (metamorphic)', () => {
    const slow = moves(run({ algorithm: 'gradient-descent', target: 'gd', args: { f: 'x^2 - 4x + 5', x0: 0, lr: 0.1, steps: 3 } }), 'gd-ball').map((p) => p[0]);
    expect(slow[0]).toBeCloseTo(0.4, 6);
    const wild = run({ algorithm: 'gradient-descent', target: 'gd', args: { f: 'x^2', x0: 1, lr: 1.1, steps: 6 } });
    expect(wild.beats.at(-1)!.title).toBe('The steps blow up');
  });

  it('refuses what it cannot run', () => {
    expect(errs({ algorithm: 'gradient-descent', target: 'gd', args: { f: 'x^^2', x0: 0 } })[0]).toMatch(/can't evaluate f\(x\)/);
    expect(errs({ algorithm: 'gradient-descent', target: 'gd', args: { f: 'x^2', x0: 0, lr: -1 } })[0]).toMatch(/learning rate "lr" must be a positive number/);
  });
});

describe('k-means', () => {
  const pts = [[1, 1], [1.5, 2], [2, 1], [8, 8], [9, 8.5], [8.5, 9], [1, 8], [1.5, 9], [2, 8.5]];

  it('converges to the means of the true groups on given data, with no illustrative marker', () => {
    const s = run({ algorithm: 'k-means', target: 'km', args: { k: 3, points: pts, init: [0, 3, 6] } });
    const finals = ['km-c1', 'km-c2', 'km-c3'].map((id) => moves(s, id).at(-1)!);
    expect(finals[0][0]).toBeCloseTo(1.5, 6);
    expect(finals[0][1]).toBeCloseTo(4 / 3, 6);
    expect(finals[1][0]).toBeCloseTo(8.5, 6);
    expect(finals[1][1]).toBeCloseTo(8.5, 6);
    expect(s.entities.some((e) => e.id === 'km-note')).toBe(false);
    expect(s.provenance).toEqual([expect.objectContaining({ algorithm: 'k-means', data: 'given' })]);
    expect(s.beats.at(-1)!.narration).toMatch(/clusters of 3, 3, 3 points/);
  });

  it('marks generated data as illustrative, on the board and in the record', () => {
    const s = run({ algorithm: 'k-means', target: 'km', args: { k: 3, generate: { clusters: 3, n: 24, seed: 7 } } });
    expect(s.entities.find((e) => e.id === 'km-note')!.text).toMatch(/Illustrative data — generated for this lesson, not measured/);
    expect(s.beats.some((b) => b.actions.some((a) => Array.isArray(a.target) && (a.target as string[]).includes('km-note')))).toBe(true);
    expect(s.provenance![0].data).toBe('illustrative');
    expect(s.beats.at(-1)!.narration).toMatch(/clusters of 8, 8, 8 points/); // farthest-first finds the three generated groups
    // reproducible: the same seed gives the same points
    const again = run({ algorithm: 'k-means', target: 'km', args: { k: 3, generate: { clusters: 3, n: 24, seed: 7 } } });
    expect(again.entities.find((e) => e.id === 'km-data')!.points).toEqual(s.entities.find((e) => e.id === 'km-data')!.points);
  });

  it('keeps cluster colours stable: each iteration lists points cluster by cluster', () => {
    const s = run({ algorithm: 'k-means', target: 'km', args: { k: 3, points: pts, init: [0, 1, 2] } });
    for (const e of s.entities.filter((x) => /km-it\d/.test(x.id))) {
      const cls = e.points!.map((p) => p.cls!);
      expect(cls).toEqual([...cls].sort());
    }
  });
});

describe('confusion matrix', () => {
  it('counts the cells and computes the metrics from the labels', () => {
    const s = validateScene(fixture('confusion-matrix-computed.json'));
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const out = s.scene as unknown as Out;
    expect(out.entities.find((e) => e.id === 'cm-metrics')!.text).toBe('accuracy = 17/20 = 0.85, precision = 6/7 = 0.857, recall = 6/8 = 0.75, F1 = 0.8');
    const sets = out.beats.flatMap((b) => b.actions.filter((a) => a.do === 'set')).map((a) => `${a.target}=${a.value}`);
    expect(sets).toEqual(['cm.r0c1=11', 'cm.r0c2=1', 'cm.r1c1=2', 'cm.r1c2=6']); // ham row, then spam row
  });

  it('refuses mismatched label lists', () => {
    expect(errs({ algorithm: 'confusion-matrix', target: 'cm', args: { actual: ['a', 'b'], predicted: ['a'] } })[0]).toMatch(/"actual" has 2 labels but "predicted" has 1/);
  });
});

describe('linear regression and the perceptron', () => {
  it('fits the exact least-squares line', () => {
    const s = run({ algorithm: 'linear-regression', target: 'lr', args: { points: [[1, 2], [2, 4.1], [3, 5.9], [4, 8.2], [5, 9.8]] } });
    const fit = s.entities.find((e) => e.id === 'lr-fit')!;
    const [m, c] = fit.expr!.split('*x + ').map(Number);
    expect(m).toBeCloseTo(1.97, 6); // Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² = 19.7/10
    expect(c).toBeCloseTo(0.09, 6); // ȳ − m·x̄ = 6 − 1.97·3
    expect(s.beats.at(-1)!.title).toMatch(/R² = 0\.99/);
  });

  it('stops once every point is on its own side, with a boundary that separates them', () => {
    const scene = fixture('perceptron-computed.json');
    const r = validateScene(scene);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.scene as unknown as Out;
    expect(out.beats.at(-1)!.title).toMatch(/0 mistakes/);
    const nums = (/w = \((−?[\d.]+), (−?[\d.]+)\), b = (−?[\d.]+)/.exec(out.beats.at(-1)!.narration) ?? []).slice(1).map((t) => Number(t.replace('−', '-')));
    const [w1, w2, b] = nums;
    for (const [x, y, lab] of scene.beats[0].compute.args.points as [number, number, string][]) {
      expect(Math.sign(w1 * x + w2 * y + b), `${x},${y}`).toBe(lab === 'B' ? 1 : -1);
    }
  });
});
