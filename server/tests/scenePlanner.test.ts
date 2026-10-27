import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestCompletion = vi.fn();
vi.mock('../utils/ai/llmClient.js', () => ({ requestCompletion: (...args: unknown[]) => requestCompletion(...args) }));

const { planScene } = await import('../engine/scene/planner.js');
const { buildPlannerMessages, guessDomain } = await import('../engine/scene/prompt.js');
const { readPartialScene } = await import('../engine/scene/progressive.js');

const golden = readFileSync(new URL('../engine/scene/fixtures/bubble-sort.json', import.meta.url), 'utf8');
const reply = (content: string) => ({ content, _meta: { model_used: 'test-model' } });

describe('scene planner', () => {
  beforeEach(() => requestCompletion.mockReset());

  it('returns a valid scene on the first try', async () => {
    requestCompletion.mockResolvedValueOnce(reply(golden));
    const r = await planScene('How does bubble sort work?');
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
    expect(requestCompletion).toHaveBeenCalledTimes(1);
  });

  it('feeds validation errors back and accepts the repaired scene', async () => {
    const broken = JSON.parse(golden);
    broken.beats[1].actions[3] = { do: 'swap', target: 'arr', i: 0, j: 9 };
    requestCompletion.mockResolvedValueOnce(reply(JSON.stringify(broken))).mockResolvedValueOnce(reply(golden));
    const r = await planScene('How does bubble sort work?');
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.repairs[0].some((i) => i.path === 'beats[1].actions[3].j')).toBe(true);
    const repairPrompt = requestCompletion.mock.calls[1][0].messages.at(-1).content;
    expect(repairPrompt).toMatch(/beats\[1\]\.actions\[3\]\.j: index 9 is out of range/);
  });

  it('starts over, shorter, when the answer was cut off at the output limit (full-48-part3/bio-2)', async () => {
    const cut = JSON.parse(golden);
    cut.beats = cut.beats.slice(0, 1); // parses and validates — but it's one beat of a lesson
    requestCompletion
      .mockResolvedValueOnce({ ...reply(JSON.stringify(cut)), finishReason: 'length' })
      .mockResolvedValueOnce(reply(golden));
    const r = await planScene('How does bubble sort work?');
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    const retry = requestCompletion.mock.calls[1][0].messages;
    expect(retry).toHaveLength(2); // no cut-off draft re-sent
    expect(retry[1].content).toMatch(/KEEP IT COMPACT/);
  });

  it('treats JSON mode refusing a cut-off reply as running out of room, not as a dead provider', async () => {
    requestCompletion
      .mockRejectedValueOnce(new Error("400 Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details."))
      .mockResolvedValueOnce(reply(golden));
    const r = await planScene('How does bubble sort work?');
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it('strips markdown fences around the JSON', async () => {
    requestCompletion.mockResolvedValueOnce(reply('```json\n' + golden + '\n```'));
    expect((await planScene('sort it')).ok).toBe(true);
  });

  it('gives up after the repair budget with the last errors', async () => {
    requestCompletion.mockResolvedValue(reply('{"version":"1","title":"x"}'));
    const r = await planScene('anything', { maxRepairs: 1 });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
    expect(requestCompletion).toHaveBeenCalledTimes(2);
  });

  it('streams valid partial scenes as beats close', async () => {
    const chunks = golden.match(/[\s\S]{1,40}/g)!;
    requestCompletion.mockImplementationOnce(async ({ onStream }: { onStream?: (t: string) => void }) => {
      for (const c of chunks) { onStream?.(c); await new Promise((r) => setTimeout(r, 6)); }
      return reply(golden);
    });
    const seen: number[] = [];
    const r = await planScene('bubble sort', { onPartial: (scene) => seen.push(scene.beats.length) });
    expect(r.ok).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).toEqual([...seen].sort((a, b) => a - b)); // only ever grows
    expect(seen.at(-1)).toBeLessThanOrEqual(4);
    if (r.ok) expect(r.firstBeatMs).toBeGreaterThanOrEqual(0);
  });

  it('reads the header and finished beats from a half-written scene', () => {
    const cut = golden.indexOf('"title": "Pass 1: 5 bubbles to the right"');
    const partial = readPartialScene(golden.slice(0, cut));
    expect(partial?.header.title).toBe('How Bubble Sort works on [5, 1, 4, 2, 8]');
    expect(partial?.beats.length).toBe(2);
    expect(readPartialScene('{"version": "1", "title": "x", "entities": [')).toBeNull();
  });

  it('picks a domain-matched example for the prompt', () => {
    expect(guessDomain('Why is a water molecule bent?')).toBe('chemistry');
    expect(guessDomain('Explain projectile motion')).toBe('physics');
    const system = buildPlannerMessages('Why is a water molecule bent?')[0].content;
    expect(system).toContain('"el":"O"');
    expect(system).toContain('format reference only');
  });

  it('shows tree questions the heap example (a tree that grows and exchanges nodes)', () => {
    for (const q of ['Visualize how a min-heap inserts 3 into [5, 9, 7, 12, 10]', 'Insert 7 into a binary search tree']) {
      expect(buildPlannerMessages(q)[0].content).toContain('"do":"exchange"');
    }
    expect(buildPlannerMessages('Stack vs queue')[0].content).not.toContain('"do":"exchange"');
  });

  it('shapes the lesson to the learner: smaller steps for beginners, sharper for advanced, unchanged otherwise', async () => {
    const { learnerLevelOf } = await import('../engine/scene/lesson.js');
    const user = (level?: 'beginner' | 'intermediate' | 'advanced') => buildPlannerMessages('How does BFS work?', level)[1].content;
    expect(user('beginner')).toMatch(/more, smaller beats/);
    expect(user('advanced')).toMatch(/3–4 beats/);
    expect(user('intermediate')).toBe(user());
    expect(learnerLevelOf({ level: 'beginner' })).toBe('beginner');
    expect(learnerLevelOf({ confusionIndex: 0.7 })).toBe('beginner');
    expect(learnerLevelOf({ style: 'high-level' })).toBe('advanced');
    expect(learnerLevelOf({})).toBe('intermediate');
  });

  it('shows slope and force questions the ramp example (geometry by intent)', () => {
    const system = buildPlannerMessages('Visualize the forces on a block sliding down a 30 degree ramp with friction')[0].content;
    expect(system).toContain('"perp":"slope"');
    expect(system).toMatch(/BY INTENT/);
  });
});
