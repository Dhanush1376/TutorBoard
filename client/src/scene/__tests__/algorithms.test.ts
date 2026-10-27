/**
 * Computed traces in the real engine (jsdom): DP table cells fill in, clearing
 * a table clears its cells, and pointer callouts that come back to a cell are
 * still there in the beat they belong to.
 */
import { describe, expect, it } from 'vitest';
import binary from '../../../../server/engine/scene/fixtures/binary-search-computed.json';
import km from '../../../../server/engine/scene/fixtures/kmeans-computed.json';
import lcs from '../../../../server/engine/scene/fixtures/lcs-computed.json';
import { normalizeScene } from '../normalize';
import { SceneEngine } from '../engine';

const mount = async (scene: unknown) => {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 1600 });
  Object.defineProperty(host, 'clientHeight', { value: 900 });
  document.body.appendChild(host);
  const engine = new SceneEngine(host);
  await engine.load(scene);
  return { host, engine };
};
const visibleNotes = (host: HTMLElement) => [...host.querySelectorAll('g.overlay > g')]
  .filter((g) => Number((g as SVGGElement).style.opacity || g.getAttribute('opacity') || 1) > 0.5)
  .map((g) => g.textContent?.trim());

describe('computed traces in the engine', () => {
  it('fills the LCS table cell by cell; the answer cell ends at 4', async () => {
    const { engine } = await mount(lcs);
    const dp = engine.builts.get('dp')!;
    const cells = dp.extra!.cells as Map<string, SVGTextElement>;
    engine.seekBeat(engine.beatCount - 1, 'end');
    expect(cells.get('r7c7')!.textContent).toBe('4');
    expect(cells.get('r1c5')!.textContent).toBe('1'); // A meets the first A of BDCABA
    // before its row is computed, a cell shows the placeholder
    engine.seekBeat(1, 'end');
    expect(cells.get('r7c7')!.textContent).toBe('·');
  });

  it('keeps a pointer callout that returns to a cell (lo on 23 in step 2, "lo = mid = hi" in step 3)', async () => {
    const { host, engine } = await mount(binary);
    engine.seekBeat(3, 'end');
    expect(visibleNotes(host)).toEqual(expect.arrayContaining(['lo', 'mid', 'hi']));
    engine.seekBeat(4, 'end');
    expect(visibleNotes(host)).toEqual(['lo = mid = hi']);
  });

  it('moves a point to each "to" in turn, not by the sum of its moves (arrays have an .at() method)', async () => {
    const scene = {
      version: '1', title: 'Two moves', domain: 'math',
      spaces: [{ id: 's', kind: 'cartesian', x: [0, 10], y: [-1, 1] }],
      entities: [{ id: 'p', type: 'point', space: 's', at: [0, 0] }],
      beats: [
        { title: 'a', narration: 'a', actions: [{ do: 'create', target: 'p' }, { do: 'move', target: 'p', to: [4, 0] }] },
        { title: 'b', narration: 'b', actions: [{ do: 'move', target: 'p', to: [8, 0] }] },
      ],
    };
    const { engine } = await mount(scene);
    const dx = () => Number(/matrix\(1 0 0 1 ([-\d.]+)/.exec(engine.builts.get('p')!.root.getAttribute('transform') ?? '')?.[1] ?? 0);
    engine.seekBeat(0, 'end');
    const four = dx();
    engine.seekBeat(1, 'end');
    expect(dx()).toBeCloseTo(2 * four, 3);
  });

  it('lands each k-means centroid on its computed mean', async () => {
    const { engine } = await mount(km);
    engine.seekBeat(engine.beatCount - 1, 'end');
    const scene = normalizeScene(km);
    for (const id of ['km-c1', 'km-c2', 'km-c3']) {
      const last = scene.beats.flatMap((b) => b.actions).filter((a) => a.do === 'move' && a.target === id).at(-1) as { to: [number, number] } | undefined;
      if (!last) continue;
      const map = engine.spaceMap('km')!;
      const start = (scene.entities.find((e) => e.id === id) as { at: [number, number] }).at;
      const want = map.toPx(last.to).x - map.toPx(start).x;
      const got = Number(/matrix\(1 0 0 1 ([-\d.]+)/.exec(engine.builts.get(id)!.root.getAttribute('transform') ?? '')?.[1] ?? 0);
      expect(got, id).toBeCloseTo(want, 1);
    }
  });
});
