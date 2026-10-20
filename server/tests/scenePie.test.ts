import { describe, expect, it } from 'vitest';
import { validateScene } from '../engine/scene/index.js';

const pieScene = (pie: Record<string, unknown>, actions: unknown[] = []) => ({
  version: '1',
  title: 'Three quarters',
  domain: 'math',
  entities: [{ id: 'pizza', ...pie }],
  beats: [
    { title: 'Cut into 4', narration: 'Four equal slices; three are shaded.', actions: [{ do: 'create', target: 'pizza' }] },
    ...(actions.length ? [{ title: 'The last slice', narration: 'One slice is left.', actions }] : []),
  ],
});

describe('pie (fractions, percentages, probability)', () => {
  it('accepts a pie and its slices as parts', () => {
    const r = validateScene(pieScene({ type: 'pie', slices: 4, shaded: 3 }, [{ do: 'highlight', target: 'pizza.s3', state: 'comparing', hold: true }]));
    expect(r.ok).toBe(true);
  });

  it('refuses slices that do not exist', () => {
    const r = validateScene(pieScene({ type: 'pie', slices: 4, shaded: [0, 5] }, [{ do: 'highlight', target: 'pizza.s4', state: 'comparing' }]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths).toContain('entities[0].shaded[1]');
      expect(paths.some((p) => p.startsWith('beats[1].actions[0]'))).toBe(true);
    }
  });

  it('understands "pizza" / "fraction" written as fractions', () => {
    const r = validateScene(pieScene({ type: 'pizza', denominator: 8, numerator: 3 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene.entities[0]).toMatchObject({ type: 'pie', slices: 8, shaded: 3 });
  });
});
