import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expandComputed } from '../engine/scene/algorithms.js';
import { validateScene } from '../engine/scene/index.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
type Beat = { title: string; narration: string; actions: { do: string; target?: unknown; value?: unknown; i?: number; j?: number; text?: string }[] };

/** A scene with one entity, an intro beat and a computed beat. */
const sceneFor = (entity: object | null, compute: object, extra: object[] = []) => ({
  version: '1', title: 'Trace', domain: 'algorithms',
  entities: [...(entity ? [entity] : [{ id: 'note', type: 'text', text: 'Watch.' }]), ...extra],
  beats: [
    { title: 'Set up', narration: 'Here it is.', actions: [{ do: 'create', target: entity ? (entity as { id: string }).id : 'note' }] },
    { title: 'Run', narration: 'computed', compute },
  ],
});
const run = (entity: object | null, compute: object) => {
  const r = validateScene(sceneFor(entity, compute));
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  return r.scene as unknown as { beats: Beat[]; entities: { id: string; type: string; values?: unknown[]; rows?: unknown[][] }[] };
};
const errs = (entity: object | null, compute: object) => { const r = validateScene(sceneFor(entity, compute)); return r.ok ? [] : r.errors.map((e) => e.message); };
const arr = (values: (number | string)[]) => ({ id: 'a', type: 'array', values });

/** Replay the swaps of a trace on the starting values. */
const replaySwaps = (start: (number | string)[], beats: Beat[]) => {
  const v = [...start];
  for (const b of beats) for (const x of b.actions) if (x.do === 'swap') [v[x.i!], v[x.j!]] = [v[x.j!], v[x.i!]];
  return v;
};

describe('computed traces', () => {
  it('expands nothing in a scene without compute beats', () => {
    const plain = fixture('bubble-sort.json');
    expect(expandComputed(plain).value).toBe(plain);
  });

  it('binary search: the looks a real binary search makes', () => {
    const s = run(arr([3, 8, 12, 15, 23, 31, 42]), { algorithm: 'binary-search', target: 'a', args: { find: 23 } });
    const titles = s.beats.map((b) => b.title);
    expect(titles.slice(1)).toEqual(['Run', 'Step 1: check index 3', 'Step 2: check index 5', 'Step 3: found it']);
    expect(s.beats.at(-1)!.narration).toMatch(/found at index 4 after 3 looks/);
    // missing values end with lo > hi
    const miss = run(arr([1, 3, 5, 7]), { algorithm: 'binary_search', target: 'a', args: { find: 4 } });
    expect(miss.beats.at(-1)!.narration).toMatch(/lo = 2 is past hi = 1.*4 is not in the array/);
  });

  it('binary search refuses an unsorted array', () => {
    expect(errs(arr([5, 1, 4]), { algorithm: 'binary-search', target: 'a', args: { find: 4 } })[0]).toMatch(/needs a sorted array; "a" has 5 before 1/);
  });

  it('sliding window: [2, 1, 5, 1, 3, 2] with k = 3 peaks at 9', () => {
    const s = run(arr([2, 1, 5, 1, 3, 2]), { algorithm: 'sliding-window', target: 'a', args: { k: 3 } });
    expect(s.beats.map((b) => b.narration).join(' ')).toMatch(/2 \+ 1 \+ 5 = 8.*8 − 2 \+ 1 = 7.*7 − 1 \+ 3 = 9.*9 − 5 \+ 2 = 6/);
    expect(s.beats.at(-1)!.title).toBe('Largest sum: 9');
  });

  it('sliding window: longest run without repeats on a string', () => {
    const s = run(arr('abcabcbb'.split('')), { algorithm: 'sliding-window', target: 'a', args: { mode: 'longest-unique' } });
    expect(s.beats.at(-1)!.narration).toMatch(/abc, length 3/);
  });

  it('sorts: every algorithm leaves the array sorted, with real swaps', () => {
    const start = [5, 1, 4, 2, 8, 3];
    for (const algorithm of ['bubble-sort', 'insertion-sort', 'selection-sort']) {
      const s = run(arr(start), { algorithm, target: 'a' });
      expect(replaySwaps(start, s.beats), algorithm).toEqual([1, 2, 3, 4, 5, 8]);
    }
    // bubble sort stops early when a pass swaps nothing
    const nearly = run(arr([1, 2, 4, 3]), { algorithm: 'bubble-sort', target: 'a' });
    expect(nearly.beats.at(-1)!.title).toBe('Pass 2: no swaps');
  });

  it('BFS and DFS visit in the order the algorithms do', () => {
    const g = fixture('graph-search-computed.json').entities[0];
    const bfs = run(g, { algorithm: 'bfs', target: 'g', args: { start: 'A' } });
    expect(bfs.beats.at(-1)!.narration).toMatch(/Visit order: A, B, C, D, E, F\./);
    const dfs = run(g, { algorithm: 'dfs', target: 'g', args: { start: 'A' } });
    expect(dfs.beats.filter((b) => b.title.startsWith('Visit')).map((b) => b.title.slice(6).split(' ')[0])).toEqual(['A', 'B', 'D', 'C', 'E', 'F']);
    expect(bfs.entities.find((e) => e.id === 'g-queue')?.type).toBe('queue');
  });

  it('Dijkstra: final distances match a hand computation, and it rejects negative weights', () => {
    const roads = fixture('dijkstra-computed.json').entities[0];
    const s = run(roads, { algorithm: 'dijkstra', target: 'roads', args: { start: 'A' } });
    expect(s.beats.at(-1)!.narration).toBe('Every reachable node is settled: A 0, B 3, C 1, D 8, E 11.');
    // the distance cells that changed, in order
    const sets = s.beats.flatMap((b) => b.actions.filter((x) => x.do === 'set').map((x) => `${x.target}=${x.value}`));
    expect(sets).toEqual(['roads-dist[1]=4', 'roads-dist[2]=1', 'roads-dist[1]=3', 'roads-dist[3]=9', 'roads-dist[3]=8', 'roads-dist[4]=11']);
    const neg = JSON.parse(JSON.stringify(roads));
    neg.edges[0].weight = -2;
    expect(errs(neg, { algorithm: 'dijkstra', target: 'roads', args: { start: 'A' } })[0]).toMatch(/non-negative weights; A–B weighs -2/);
  });

  it('DP: fibonacci, coin change, LCS and knapsack compute the right answers', () => {
    const fib = run(null, { algorithm: 'fibonacci', target: 'f', args: { n: 10 } });
    expect(fib.beats.at(-1)!.title).toBe('F(10) = 55');
    const coins = run(null, { algorithm: 'coin-change', target: 'dp', args: { coins: [1, 3, 4], amount: 6 } });
    expect(coins.beats.at(-1)!.narration).toMatch(/fewest coins that make 6 is 2/); // 3 + 3, not the greedy 4 + 1 + 1
    const l = run(null, { algorithm: 'lcs', target: 't', args: { a: 'ABCBDAB', b: 'BDCABA' } });
    expect(l.beats.at(-1)!.title).toBe('Length 4: BCBA');
    expect(l.entities.find((e) => e.id === 't')!.rows).toHaveLength(8);
    const k = run(null, { algorithm: 'knapsack', target: 'k', args: { weights: [1, 3, 4, 5], values: [1, 4, 5, 7], capacity: 7 } });
    expect(k.beats.at(-1)!.narration).toMatch(/value 9 within capacity 7, taking items 2 and 3/);
  });

  it('fits long traces into the lesson by merging steps, and says when it cannot', () => {
    const fib = run(null, { algorithm: 'fibonacci', target: 'f', args: { n: 20 } }); // 21 steps for ≤ 11 beats
    expect(fib.beats.length).toBeLessThanOrEqual(12);
    expect(fib.beats.at(-1)!.title).toMatch(/F\(20\) = 6765/);
    expect(errs(arr(Array.from({ length: 40 }, (_, i) => i)), { algorithm: 'binary-search', target: 'a', args: { find: 3 } })[0]).toMatch(/at most 32/);
  });

  it('explains what it can run when the algorithm is unknown', () => {
    expect(errs(arr([1, 2]), { algorithm: 'bogosort', target: 'a' })[0]).toMatch(/isn't an algorithm TutorBoard can run; use one of binary-search, sliding-window/);
    expect(errs(null, { algorithm: 'bfs', target: 'nope', args: { start: 'A' } })[0]).toMatch(/"nope" is not an entity/);
  });

  it('keeps the beat\'s own actions and title, and validates like any scene', () => {
    const s = validateScene({
      ...sceneFor(arr([4, 2, 9]), { algorithm: 'insertion-sort', target: 'a' }),
      beats: [{ title: 'Sort these', narration: 'computed', actions: [{ do: 'create', target: 'a' }], compute: { algorithm: 'insertion-sort', target: 'a' } }],
    });
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.scene.beats[0].title).toBe('Sort these');
      expect(s.scene.beats[0].actions[0]).toMatchObject({ do: 'create', target: 'a' });
      expect(s.scene.beats.every((b) => !('compute' in b))).toBe(true);
    }
  });
});
