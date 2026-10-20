import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coerceScene } from '../engine/scene/coerce.js';
import { validateScene } from '../engine/scene/index.js';

const golden = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));

describe('cut-and-rearrange: move shapes, unroll a pie (live: "area of a circle" had no way to show the slices laid out)', () => {
  it('the two area goldens validate with no warnings', () => {
    for (const f of ['circle-area.json', 'parallelogram-area.json']) {
      const r = validateScene(golden(f));
      expect(r.ok, f).toBe(true);
      if (r.ok) expect(r.warnings, f).toEqual([]);
    }
  });

  it('rearrange only lays out a pie', () => {
    const s = golden('parallelogram-area.json');
    s.beats[2].actions.push({ do: 'rearrange', target: 'cut' });
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /rearrange lays out a pie's slices/.test(e.message))).toBe(true);
  });

  it('a move needs somewhere to go', () => {
    const s = golden('parallelogram-area.json');
    s.beats[2].actions[2] = { do: 'move', target: 'cut' };
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /move needs "to"/.test(e.message))).toBe(true);
  });

  it('understands rotate/shift/unroll in the words models use', () => {
    const { value } = coerceScene({
      beats: [{ title: 't', narration: 'n', actions: [
        { do: 'rotate', target: 'tri', angle: 90, pivot: [1, 1] },
        { do: 'shift', target: 'tri', offset: [3, 0] },
        { do: 'unroll', target: 'disc', as: 'rectangle' },
        { do: 'rearrange', target: 'disc', to: 'whole' },
      ] }],
    }) as { value: any };
    expect(value.beats[0].actions).toEqual([
      { do: 'move', target: 'tri', turn: 90, about: [1, 1] },
      { do: 'move', target: 'tri', by: [3, 0] },
      { do: 'rearrange', target: 'disc', into: 'strip' },
      { do: 'rearrange', target: 'disc', into: 'circle' },
    ]);
  });
});
