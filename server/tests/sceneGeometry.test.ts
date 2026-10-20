import { describe, expect, it } from 'vitest';
import { angleAt, resolveGeometry } from '../engine/scene/resolveGeometry.js';
import { validateScene } from '../engine/scene/index.js';

/** A block on a 30° ramp, written by intent (the case the model got wrong with coordinates). */
const ramp = (extra: Record<string, unknown>[] = []) => ({
  version: '1',
  title: 'Block on a 30° ramp',
  domain: 'physics',
  spaces: [{ id: 'field', kind: 'cartesian', x: [0, 10], y: [0, 6] }],
  entities: [
    // declared before the ramp on purpose: forward references must resolve
    { id: 'Wpar', type: 'vector', space: 'field', from: 'block', along: 'ramp', toward: 'from', magnitude: 2, label: 'W∥' },
    { id: 'N', type: 'vector', space: 'field', from: 'block', perp: 'ramp', side: 'left', magnitude: 2, label: 'N' },
    { id: 'W', type: 'vector', space: 'field', from: 'block', angleDeg: -90, magnitude: 3, label: 'W' },
    { id: 'ramp', type: 'line', space: 'field', from: [0, 0], angleDeg: 30, length: 10 },
    { id: 'ground', type: 'line', space: 'field', from: [0, 0], to: [10, 0] },
    { id: 'block', type: 'body', space: 'field', at: { along: 'ramp', t: 0.5 } },
    { id: 'theta', type: 'angle', space: 'field', vertex: [0, 0], from: [10, 0], to: { from: [0, 0], angleDeg: 30, length: 3 }, degrees: 30 },
    ...extra,
  ],
  beats: [{ title: 'The ramp', narration: 'A block on a 30° ramp.', actions: [{ do: 'create', target: ['ground', 'ramp', 'block', 'theta', 'W', 'N', 'Wpar'] }] }],
});

const byId = (scene: any, id: string) => scene.entities.find((e: any) => e.id === id);
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2));

describe('geometry by intent', () => {
  it('turns lines, points and vectors written by intent into coordinates', () => {
    const { value, issues } = resolveGeometry(ramp());
    expect(issues).toEqual([]);
    close(byId(value, 'ramp').to, [8.66, 5]);
    close(byId(value, 'block').at, [4.33, 2.5]);
    // down the slope, toward the ramp's foot
    close(byId(value, 'Wpar').to, [4.33 - 1.732, 2.5 - 1]);
    // out of the surface (counter-clockwise from the ramp's direction)
    close(byId(value, 'N').to, [4.33 - 1, 2.5 + 1.732]);
    close(byId(value, 'W').to, [4.33, -0.5]);
    expect(byId(value, 'Wpar').along).toBeUndefined();
  });

  it('validates the whole scene and keeps declared angles honest', () => {
    const r = validateScene(ramp());
    expect(r.ok).toBe(true);
    const off = ramp();
    (byId(off, 'ramp') as any).angleDeg = undefined;
    (byId(off, 'ramp') as any).to = [8, 4.15]; // the coordinates a model wrote: 27.4°
    (byId(off, 'theta') as any).to = 'ramp_end';
    off.entities.push({ id: 'ramp_end', type: 'point', space: 'field', at: [8, 4.15] });
    const bad = validateScene(off);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const issue = bad.errors.find((e) => e.path.endsWith('.degrees'));
      expect(issue?.message).toMatch(/27\.4°.*says 30°/);
      expect(issue?.message).toMatch(/angleDeg/);
    }
  });

  it('reads a stated angle from the label too', () => {
    const s = ramp();
    delete (byId(s, 'theta') as any).degrees;
    (byId(s, 'theta') as any).label = 'θ = 45°';
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].path).toMatch(/entities\[6\]\.label/);
  });

  it('places points relative to polygon vertices', () => {
    const { value, issues } = resolveGeometry({
      entities: [
        { id: 'tri', type: 'polygon', space: 's', points: [[0, 0], [4, 0], [0, 3]], vertexLabels: ['A', 'B', 'C'] },
        { id: 'p', type: 'point', space: 's', at: { from: 'tri.B', angleDeg: 90, length: 2 } },
      ],
    });
    expect(issues).toEqual([]);
    close(byId(value, 'p').at, [4, 2]);
  });

  it('says exactly what is missing when a reference does not exist', () => {
    const s = ramp([{ id: 'F', type: 'vector', space: 'field', from: 'block', along: 'slope', magnitude: 1 }]);
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ path: 'entities[7].along', message: '"slope" is not a line or vector of this scene' });
  });

  it('measures angles between rays', () => {
    expect(angleAt([0, 0], [1, 0], [0, 1])).toBeCloseTo(90);
    expect(angleAt([0, 0], [10, 0], [8, 4.15])).toBeCloseTo(27.42, 1);
  });

  it('puts forces written in newtons on one common drawing scale', () => {
    const s = ramp();
    (byId(s, 'W') as any).magnitude = 19.6; // the model wrote the force, not a drawing length
    (byId(s, 'N') as any).magnitude = 17;
    const { value } = resolveGeometry(s);
    const len = (v: any) => Math.hypot(v.to[0] - v.from[0], v.to[1] - v.from[1]);
    const W = byId(value, 'W'), N = byId(value, 'N');
    expect(len(W)).toBeCloseTo(0.3 * Math.hypot(10, 6), 1); // longest ≈ 30% of the space's diagonal
    expect(len(N) / len(W)).toBeCloseTo(17 / 19.6, 2); // ratios kept
    expect((W.to[0] - W.from[0])).toBeCloseTo(0, 5); // still straight down
  });

  it('draws spaces holding vectors or angles at true shape unless told otherwise', () => {
    const r = validateScene(ramp());
    expect(r.ok && r.scene.spaces[0].equalAspect).toBe(true);
    const flat = ramp();
    (flat.spaces[0] as any).equalAspect = false;
    const f = validateScene(flat);
    expect(f.ok && f.scene.spaces[0].equalAspect).toBe(false);
  });

  it('leaves scenes without intent forms untouched', () => {
    const plain = { entities: [{ id: 'l', type: 'line', from: 'boxA', to: 'boxB' }, { id: 'v', type: 'vector', space: 's', from: [0, 0], to: [1, 1] }] };
    expect(resolveGeometry(plain)).toEqual({ value: plain, issues: [] });
  });
});
