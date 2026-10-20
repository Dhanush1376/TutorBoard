import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateScene } from '../engine/scene/index.js';
import { sceneToTimeline } from '../engine/scene/lesson.js';

const golden = () => JSON.parse(readFileSync(new URL('../engine/scene/fixtures/bubble-sort.json', import.meta.url), 'utf8'));
const check = { question: 'Which pair is compared next?', choices: ['5 and 4', '1 and 4', '4 and 2'], answer: 0 };

describe('check beats (predict the next step)', () => {
  it('accepts a check and hands it to the lesson UI with its step', () => {
    const r = validateScene(golden());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.beats[1].check?.answer).toBe(0);
      expect(sceneToTimeline(r.scene).steps[1].check?.choices).toHaveLength(3);
    }
  });

  it('refuses a check on the last beat — there is nothing left to predict', () => {
    const s = golden();
    s.beats.at(-1).check = check;
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].path).toBe(`beats[${s.beats.length - 1}].check`);
  });

  it('refuses an answer that is not one of the choices', () => {
    const s = golden();
    s.beats[0].check = { ...check, answer: 3 };
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].path).toBe('beats[0].check.answer');
  });

  it('takes loosely written checks: answer as text, options/prompt aliases, choice objects', () => {
    const s = golden();
    s.beats[0].quiz = { prompt: 'Which pair first?', options: [{ text: '5 and 1' }, { text: '1 and 4' }], answer: '5 and 1' };
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene.beats[0].check).toEqual({ question: 'Which pair first?', choices: ['5 and 1', '1 and 4'], answer: 0 });
  });
});
