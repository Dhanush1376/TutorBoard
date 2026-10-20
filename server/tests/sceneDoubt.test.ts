import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestCompletion = vi.fn();
vi.mock('../utils/ai/llmClient.js', () => ({ requestCompletion: (...args: unknown[]) => requestCompletion(...args) }));

const { planDoubt, answerOnBoard, mergeBranch, onBoardAt, toDeltaPath, buildDoubtMessages } = await import('../engine/scene/doubt.js');
const { validateScene } = await import('../engine/scene/index.js');

const lesson = (() => {
  const r = validateScene(JSON.parse(readFileSync(new URL('../engine/scene/fixtures/bubble-sort.json', import.meta.url), 'utf8')));
  if (!r.ok) throw new Error('fixture invalid');
  return r.scene;
})();
const reply = (o: unknown) => ({ content: typeof o === 'string' ? o : JSON.stringify(o), _meta: { model_used: 'test-model' } });
const doubtBeat = (target: string) => ({
  title: 'Why did they swap?',
  narration: 'Five is bigger than one, so the larger value moves right.',
  actions: [{ do: 'highlight', target, state: 'comparing', hold: false }],
});

describe('doubts on a v2 lesson', () => {
  beforeEach(() => requestCompletion.mockReset());

  it('knows what is on the board at a beat', () => {
    const at0 = onBoardAt(lesson, 0).map((r) => r.id);
    const at1 = onBoardAt(lesson, 1).map((r) => r.id);
    expect(at0).toContain('arr');
    expect(at1.length).toBeGreaterThanOrEqual(at0.length);
    const user = buildDoubtMessages('why?', lesson, 1)[1].content as string;
    expect(user).toMatch(/at beat 2 of 4/);
    expect(user).toMatch(/QUESTION: why\?/);
  });

  it('merges the lesson up to the current beat with the doubt beats', () => {
    const merged = mergeBranch(lesson, 1, { entities: [{ id: 'note', type: 'text', text: 'hi' }], beats: [doubtBeat('arr[0]')] });
    expect(merged.beats).toHaveLength(3);
    expect(merged.entities.at(-1)).toMatchObject({ id: 'note' });
  });

  it('maps repair paths from the merged scene back into the doubt JSON', () => {
    const off = { beats: 2, entities: 3, layout: 1 };
    expect(toDeltaPath('beats[3].actions[0].target', off)).toBe('beats[1].actions[0].target');
    expect(toDeltaPath('entities[4].type', off)).toBe('entities[1].type');
    expect(toDeltaPath('beats[1].title', off)).toBe('beats[1].title'); // the lesson's own beat: unchanged
  });

  it('returns a validated branch: lesson beats 0..N + the doubt beats', async () => {
    requestCompletion.mockResolvedValueOnce(reply({ kind: 'branch', answer: 'Because 5 > 1.', beats: [doubtBeat('arr[0]')] }));
    const r = await planDoubt('Why did 5 and 1 swap?', lesson, 1, { model: 'm' });
    expect(r.ok && r.kind).toBe('branch');
    if (r.ok && r.kind === 'branch') {
      expect(r.from).toBe(1);
      expect(r.beats).toBe(1);
      expect(r.scene.beats).toHaveLength(3);
      expect(r.scene.beats[2].title).toBe('Why did they swap?');
      expect(r.answer).toBe('Because 5 > 1.');
    }
  });

  it('starts from the lesson moment the question is about ("from", 1-based), not only the current beat', async () => {
    requestCompletion.mockResolvedValueOnce(reply({ kind: 'branch', from: 1, answer: 'x', beats: [doubtBeat('arr[0]')] }));
    const r = await planDoubt('What did the array look like at the start?', lesson, 3, { model: 'm' });
    expect(r.ok && r.kind).toBe('branch');
    if (r.ok && r.kind === 'branch') {
      expect(r.from).toBe(0);
      expect(r.scene.beats).toHaveLength(2); // lesson beat 1 + the answer
    }
    expect(requestCompletion.mock.calls[0][0].messages[1].content).toMatch(/LESSON BEATS:\n {2}1\. /);
  });

  it('sends errors back with paths into the doubt JSON and accepts the repair', async () => {
    requestCompletion
      .mockResolvedValueOnce(reply({ kind: 'branch', answer: 'x', beats: [doubtBeat('arr[9]')] }))
      .mockResolvedValueOnce(reply({ kind: 'branch', answer: 'x', beats: [doubtBeat('arr[1]')] }));
    const r = await planDoubt('Why?', lesson, 1, { model: 'm' });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    const repair = requestCompletion.mock.calls[1][0].messages.at(-1).content as string;
    expect(repair).toMatch(/beats\[0\]\.actions\[0\]/);
    expect(repair).not.toMatch(/beats\[2\]/);
  });

  it('answers with the fast model and falls back to the main model if it cannot', async () => {
    const bad = reply({ kind: 'branch', answer: 'x', beats: [doubtBeat('arr[9]')] });
    requestCompletion
      .mockResolvedValueOnce(bad).mockResolvedValueOnce(bad) // fast model: first try + one repair
      .mockResolvedValueOnce(reply({ kind: 'branch', answer: 'x', beats: [doubtBeat('arr[1]')] }));
    const r = await answerOnBoard('Why?', lesson, 1, {});
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
    const models = requestCompletion.mock.calls.map((c) => c[0].model);
    expect(models[0]).toBe(models[1]);
    expect(models[2]).not.toBe(models[0]);
  });

  it('recognises a question about something else', async () => {
    requestCompletion.mockResolvedValueOnce(reply({ kind: 'new-topic', answer: 'That is about photosynthesis.' }));
    const r = await planDoubt('How do plants make food?', lesson, 2, { model: 'm' });
    expect(r.ok && r.kind).toBe('new-topic');
  });

  it('refuses a lesson scene that is not valid, without calling the model', async () => {
    const r = await planDoubt('why?', { version: '1', title: 'x', beats: 'nope' }, 0, { model: 'm' });
    expect(r.ok).toBe(false);
    expect(requestCompletion).not.toHaveBeenCalled();
  });
});
