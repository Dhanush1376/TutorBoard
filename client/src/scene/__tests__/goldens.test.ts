/**
 * Render smoke test (checklist 6.1): every golden scene builds in the real
 * engine, every beat can be played to its end, and nothing on the board overlaps.
 * Runs in jsdom — no browser — so CI catches engine regressions on every push.
 */
import { describe, expect, it } from 'vitest';
import { SceneEngine } from '../engine';
import { overlapping } from '../layout';
import { normalizeScene } from '../normalize';

const fixtures = import.meta.glob('../../../../server/engine/scene/fixtures/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const goldens = Object.entries(fixtures).map(([p, s]) => [p.split('/').pop()!, s] as const);

describe('golden scenes render', () => {
  it('finds the golden scenes', () => {
    expect(goldens.length).toBeGreaterThanOrEqual(8);
  });

  it.each(goldens)('%s builds, plays every beat and keeps the board clear', async (_name, raw) => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 1600 });
    Object.defineProperty(host, 'clientHeight', { value: 900 });
    document.body.appendChild(host);
    const engine = new SceneEngine(host);
    const scene = normalizeScene(raw);
    const loaded = await engine.load(scene);
    expect(loaded).not.toBeNull();
    expect(engine.beatCount).toBe(scene.beats.length);
    expect(host.querySelector('svg[data-engine="v2"]')).not.toBeNull();
    // every entity drew something and is addressable for "ask about this"
    for (const e of scene.entities) {
      if (e.type === 'group') continue;
      expect(host.querySelector(`[data-entity="${e.id}"]`), e.id).not.toBeNull();
    }
    // play each beat to its end state (seeking runs every tween's setup)
    for (let i = 0; i < engine.beatCount; i++) {
      expect(() => engine.seekBeat(i, 'end')).not.toThrow();
      expect(engine.beatIndex).toBe(i);
    }
    const overlaps = overlapping(engine.layout!.boxes, -2)
      .filter(([a, b]) => !(scene.layout ?? []).some((r) => r.rel === 'inside' && ((r.id === a && r.of === b) || (r.id === b && r.of === a))));
    expect(overlaps).toEqual([]);
    engine.destroy();
    host.remove();
  });
});
