import { describe, expect, it } from 'vitest';
import { overlapping, solveLayout, fitTransform } from '../layout';
import { measureScene } from '../measure';
import { normalizeScene } from '../normalize';
import { simulate } from '../simulate';
import type { Scene } from '../types';

const fixtures = import.meta.glob('../../../../server/engine/scene/fixtures/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const scenes = Object.entries(fixtures).map(([p, s]) => [p.split('/').pop()!, normalizeScene(s)] as const);

const laidOut = (scene: Scene) => {
  const sim = simulate(scene);
  const sizes = measureScene(scene, sim);
  return solveLayout(sizes, scene.layout, [...scene.spaces.map((s) => s.id), ...scene.entities.map((e) => e.id)]);
};

describe('simulate', () => {
  it('replays Bubble Sort to the sorted order and resolves index refs at each moment', () => {
    const scene = scenes.find(([n]) => n === 'bubble-sort.json')![1];
    const sim = simulate(scene);
    // the last recorded swap leaves the array sorted
    let last: string[] = sim.initial.get('arr')!;
    scene.beats.forEach((b, bi) => b.actions.forEach((_, ai) => { const op = sim.op(bi, ai); if (op && 'order' in op) last = op.order; }));
    expect(last.map((k) => sim.itemByKey(k)!.value)).toEqual([1, 2, 4, 5, 8]);
    // beat 2, first highlight targets arr[1] = 5 (after the first swap)
    expect(sim.itemByKey(sim.keyAt(2, 0, 'arr[1]')!)!.value).toBe(5);
  });

  it('gives pushed values their own items and tracks the max length', () => {
    const scene = scenes.find(([n]) => n === 'stack-vs-queue.json')![1];
    const sim = simulate(scene);
    expect(sim.items.get('st')!.map((i) => i.value)).toEqual(['A', 'B', 'C']);
    expect(sim.maxLen.get('st')).toBe(3);
    expect(sim.maxLen.get('qu')).toBe(3);
  });
});

describe('layout', () => {
  it.each(scenes)('%s lays out without overlaps', (_, scene) => {
    const { boxes } = laidOut(scene);
    const inside = new Set(scene.layout.filter((r) => r.rel === 'inside').map((r) => `${(r as { id: string }).id}|${(r as { of: string }).of}`));
    const bad = overlapping(boxes).filter(([a, b]) => !inside.has(`${a}|${b}`) && !inside.has(`${b}|${a}`));
    expect(bad).toEqual([]);
  });

  it('honours row, below and region placement', () => {
    const scene = normalizeScene({
      version: '1', title: 't', domain: 'general',
      entities: [
        { id: 'a', type: 'rect' }, { id: 'b', type: 'rect' }, { id: 'cap', type: 'text', text: 'caption' }, { id: 'tag', type: 'text', text: 'tag' },
      ],
      layout: [
        { rel: 'row', ids: ['a', 'b'], gap: 'lg' },
        { rel: 'below', id: 'cap', of: 'a' },
        { rel: 'place', id: 'tag', region: 'top-right' },
      ],
      beats: [{ title: 'x', narration: 'x', actions: [{ do: 'create', target: ['a', 'b', 'cap', 'tag'] }] }],
    });
    const { boxes } = laidOut(scene);
    const a = boxes.get('a')!, b = boxes.get('b')!, cap = boxes.get('cap')!, tag = boxes.get('tag')!;
    expect(b.x).toBeGreaterThan(a.x + a.w);                 // row: b right of a
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);            // same row
    expect(cap.y).toBeGreaterThan(a.y + a.h);               // below a
    expect(cap.x + cap.w / 2).toBeCloseTo(a.x + a.w / 2, 0); // centred under a
    expect(tag.y + tag.h).toBeLessThan(Math.min(a.y, b.y)); // top region
    expect(tag.x + tag.w).toBeCloseTo(b.x + b.w, 0);        // right-aligned to the centre block
  });

  it('fits any world into the view without exceeding the max zoom', () => {
    const t = fitTransform({ x: -100, y: -50, w: 200, h: 100 }, { x: 0, y: 0, w: 1000, h: 600 }, 1.3);
    expect(t.scale).toBe(1.3);
    expect(t.x).toBeCloseTo(500);
    const big = fitTransform({ x: 0, y: 0, w: 4000, h: 1000 }, { x: 0, y: 0, w: 1000, h: 600 }, 1.3);
    expect(big.scale).toBeLessThan(0.3);
  });
});
