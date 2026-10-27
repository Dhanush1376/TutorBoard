/**
 * Computed algorithm traces — the model chooses the algorithm and the input,
 * TutorBoard runs a reference implementation and writes the beats.
 *
 * A beat may say `"compute": { "algorithm": "binary-search", "target": "arr", "args": { "find": 23 } }`
 * instead of (or after) its own actions. `expandComputed` replaces that beat
 * with the trace: every comparison, swap, pointer, queue operation and table
 * cell comes from running the algorithm on the entity's actual values, and the
 * narration states the real numbers. Preconditions (a sorted array for binary
 * search, non-negative weights for Dijkstra) and sizes are checked, so a trace
 * is never made up and never too long to teach.
 *
 * The output is ordinary Scene Language (actions on entity ids), validated like
 * any other scene; saved lessons need nothing new to play.
 */
import { LIMITS } from './schema.js';

import { caption, ComputeError, hl, list, MAX_TARGETS, num, range, type Act, type Ctx, type Gen, type GenBeat, type Issue, type Loose } from './computeKit.js';
import { ENG_ALGORITHMS, ENG_NAMES } from './eng.js';
import { ML_ALGORITHMS, ML_NAMES } from './ml.js';

/** Callouts that follow pointers: unannotate last beat's, annotate this beat's (merging names on one cell). */
class Pointers {
  private shown = new Set<string>();
  constructor(private target: string) {}
  move(at: Record<string, number | undefined>, side: Record<string, 'above' | 'below'> = {}): Act[] {
    const byCell = new Map<number, string[]>();
    for (const [name, i] of Object.entries(at)) if (i !== undefined) byCell.set(i, [...(byCell.get(i) ?? []), name]);
    const out: Act[] = [...this.shown].map((ref) => ({ do: 'unannotate', target: ref }));
    this.shown.clear();
    for (const [i, names] of byCell) {
      const ref = `${this.target}[${i}]`;
      out.push({ do: 'annotate', target: ref, text: names.join(' = '), side: side[names[0]] ?? 'above' });
      this.shown.add(ref);
    }
    return out;
  }
  clear(): Act[] {
    const out = [...this.shown].map((ref) => ({ do: 'unannotate', target: ref }));
    this.shown.clear();
    return out;
  }
}

const arrayOf = (ctx: Ctx, numeric = false): (string | number)[] => {
  const e = ctx.entity;
  if (!e) ctx.fail(`"${ctx.target}" is not an entity in this scene — declare the array first`);
  if (e!.type !== 'array') ctx.fail(`this algorithm runs on an array; "${ctx.target}" is a ${e!.type}`);
  const vals = (e!.values ?? []) as (string | number)[];
  if (!vals.length) ctx.fail(`"${ctx.target}" is empty`);
  if (numeric && vals.some((v) => Number.isNaN(num(v)))) ctx.fail(`"${ctx.target}" must hold numbers`);
  return vals;
};
const limit = (ctx: Ctx, what: string, n: number, max: number) => { if (n > max) ctx.fail(`${what} is ${n}; computed traces take at most ${max} — use a smaller input`); };

// ── searching ────────────────────────────────────────────────────────────────

function binarySearch(ctx: Ctx): Gen {
  const a = arrayOf(ctx, true).map(num);
  limit(ctx, 'the array length', a.length, 32);
  for (let i = 1; i < a.length; i++) if (a[i] < a[i - 1]) ctx.fail(`binary search needs a sorted array; "${ctx.target}" has ${a[i - 1]} before ${a[i]} — sort it first (or use a sorting algorithm)`);
  const find = num(ctx.args.find ?? ctx.args.value ?? ctx.args.key);
  if (Number.isNaN(find)) ctx.fail('binary search needs "args": { "find": <number> }');
  const T = ctx.target, S = `${T}-state`;
  const cap = caption(S, `lo = 0, hi = ${a.length - 1}`, { rel: 'below', id: S, of: T, gap: 'lg' });
  const ptr = new Pointers(T);
  const beats: GenBeat[] = [{
    title: `Search for ${find}`,
    narration: `The array is sorted, so one look at the middle rules out half of it. Start with the whole array: lo = 0, hi = ${a.length - 1}.`,
    actions: [{ do: 'create', target: S, effect: 'fade' }, ...ptr.move({ lo: 0, hi: a.length - 1 })],
  }];
  let lo = 0, hi = a.length - 1, step = 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const out = [...range(0, lo - 1), ...range(hi + 1, a.length - 1)].map((i) => `${T}[${i}]`);
    const acts: Act[] = [{ do: 'clear', target: T }, ...hl(out, 'eliminated'), { do: 'highlight', target: `${T}[${mid}]`, state: 'comparing' }, ...ptr.move({ lo, mid, hi })];
    const head = `mid = (${lo} + ${hi}) / 2 = ${mid}, and ${T}[${mid}] = ${a[mid]}.`;
    if (a[mid] === find) {
      acts.push({ do: 'highlight', target: `${T}[${mid}]`, state: 'found' }, { do: 'set', target: S, text: `found ${find} at index ${mid} after ${step} look${step > 1 ? 's' : ''}` });
      beats.push({ title: `Step ${step}: found it`, narration: `${head} That is ${find}: found at index ${mid} after ${step} look${step > 1 ? 's' : ''}.`, actions: acts });
      return { beats, entities: [cap.entity], layout: [cap.layout] };
    }
    const right = a[mid] < find;
    const next = right ? { lo: mid + 1, hi } : { lo, hi: mid - 1 };
    acts.push({ do: 'set', target: S, text: `lo = ${lo}, hi = ${hi}, mid = ${mid}: ${a[mid]} ${right ? '<' : '>'} ${find} → ${right ? `lo = ${mid + 1}` : `hi = ${mid - 1}`}` });
    beats.push({
      title: `Step ${step}: check index ${mid}`,
      narration: `${head} ${a[mid]} is ${right ? 'less' : 'greater'} than ${find}, so ${find} can only be to the ${right ? 'right' : 'left'}: ${right ? `lo = ${mid + 1}` : `hi = ${mid - 1}`}.`,
      actions: acts,
    });
    ({ lo, hi } = next);
    step++;
  }
  beats.push({
    title: `${find} is not there`,
    narration: `Now lo = ${lo} is past hi = ${hi}: nothing is left to search, so ${find} is not in the array — found out with ${step - 1} look${step > 2 ? 's' : ''}.`,
    actions: [{ do: 'clear', target: T }, ...hl(range(0, a.length - 1).map((i) => `${T}[${i}]`), 'eliminated'), ...ptr.clear(), { do: 'set', target: S, text: `lo = ${lo} > hi = ${hi}: not found` }],
  });
  return { beats, entities: [cap.entity], layout: [cap.layout] };
}

// ── sliding window / two pointers ────────────────────────────────────────────

function slidingWindow(ctx: Ctx): Gen {
  const T = ctx.target, S = `${T}-state`;
  const ptr = new Pointers(T);
  const mode = String(ctx.args.mode ?? (ctx.args.k !== undefined ? 'max-sum' : 'longest-unique'));
  if (mode === 'longest-unique') {
    const a = arrayOf(ctx).map(String);
    limit(ctx, 'the length', a.length, 16);
    const cap = caption(S, 'window: empty', { rel: 'below', id: S, of: T, gap: 'lg' });
    const beats: GenBeat[] = [{ title: 'Grow a window of distinct values', narration: 'The right edge moves one step at a time. When it brings in a repeat, the left edge moves past the earlier copy, so the window never holds a duplicate.', actions: [{ do: 'create', target: S, effect: 'fade' }] }];
    const last = new Map<string, number>();
    let left = 0, best = 0, bestL = 0;
    for (let right = 0; right < a.length; right++) {
      const c = a[right];
      let moved = '';
      if (last.has(c) && last.get(c)! >= left) { moved = ` "${c}" is already in the window at ${last.get(c)}, so the left edge jumps to ${last.get(c)! + 1}.`; left = last.get(c)! + 1; }
      last.set(c, right);
      const len = right - left + 1;
      const grew = len > best;
      if (grew) { best = len; bestL = left; }
      beats.push({
        title: `Right edge at ${right}: "${c}"`,
        narration: `Add "${c}".${moved} The window ${a.slice(left, right + 1).join('')} has length ${len}${grew ? ` — the longest so far` : `; the best is still ${best}`}.`,
        actions: [{ do: 'clear', target: T }, ...hl(range(0, left - 1).map((i) => `${T}[${i}]`), 'eliminated'), ...hl(range(left, right).map((i) => `${T}[${i}]`), 'active'), ...ptr.move({ L: left, R: right }), { do: 'set', target: S, text: `window [${left}..${right}] = ${a.slice(left, right + 1).join('')}, length ${len}, best ${best}` }],
      });
    }
    beats.push({ title: `Longest: ${best}`, narration: `The longest stretch without a repeat is ${a.slice(bestL, bestL + best).join('')}, length ${best}.`, actions: [{ do: 'clear', target: T }, ...ptr.clear(), ...hl(range(bestL, bestL + best - 1).map((i) => `${T}[${i}]`), 'found')] });
    return { beats, entities: [cap.entity], layout: [cap.layout] };
  }
  const a = arrayOf(ctx, true).map(num);
  limit(ctx, 'the length', a.length, 24);
  const k = num(ctx.args.k ?? ctx.args.size);
  if (!Number.isInteger(k) || k < 1 || k > a.length) ctx.fail(`a fixed window needs "args": { "k": <whole number from 1 to ${a.length}> }`);
  if (k > MAX_TARGETS) ctx.fail(`a window of ${k} is too wide to show; at most ${MAX_TARGETS}`);
  const goal = mode === 'min-sum' ? 'min' : 'max';
  const cap = caption(S, '', { rel: 'below', id: S, of: T, gap: 'lg' });
  let sum = a.slice(0, k).reduce((s, v) => s + v, 0);
  let best = sum, bestAt = 0;
  const show = (i: number): Act[] => [{ do: 'clear', target: T }, ...hl(range(i, i + k - 1).map((j) => `${T}[${j}]`), 'active'), ...ptr.move({ start: i, end: i + k - 1 })];
  const beats: GenBeat[] = [{
    title: `First window of ${k}`,
    narration: `Add up the first ${k}: ${a.slice(0, k).join(' + ')} = ${sum}. From here the window slides: add the value that enters, subtract the one that leaves — no re-adding.`,
    actions: [{ do: 'create', target: S, effect: 'fade' }, ...show(0), { do: 'set', target: S, text: `sum = ${sum}, ${goal} so far = ${best}` }],
  }];
  for (let i = 1; i + k <= a.length; i++) {
    const out = a[i - 1], inn = a[i + k - 1];
    sum = sum - out + inn;
    const better = goal === 'max' ? sum > best : sum < best;
    if (better) { best = sum; bestAt = i; }
    beats.push({
      title: `Slide to ${i}..${i + k - 1}`,
      narration: `${sum + out - inn} − ${out} + ${inn} = ${sum}.${better ? ` A new ${goal}imum.` : ` The ${goal}imum stays ${best}.`}`,
      actions: [...show(i), { do: 'highlight', target: `${T}[${i - 1}]`, state: 'eliminated', hold: false }, { do: 'set', target: S, text: `sum = ${sum}, ${goal} so far = ${best}` }],
    });
  }
  beats.push({ title: `${goal === 'max' ? 'Largest' : 'Smallest'} sum: ${best}`, narration: `The ${goal === 'max' ? 'largest' : 'smallest'} window sum is ${best}, at indices ${bestAt} to ${bestAt + k - 1}: ${a.slice(bestAt, bestAt + k).join(' + ')}.`, actions: [{ do: 'clear', target: T }, ...ptr.clear(), ...hl(range(bestAt, bestAt + k - 1).map((j) => `${T}[${j}]`), 'found')] });
  return { beats, entities: [cap.entity], layout: [cap.layout] };
}

// ── sorting ──────────────────────────────────────────────────────────────────

function sortNumbersOrText(ctx: Ctx) {
  const raw = arrayOf(ctx);
  const numeric = raw.every((v) => !Number.isNaN(num(v)));
  const a = raw.map((v) => (numeric ? num(v) : String(v)));
  limit(ctx, 'the array length', a.length, 12);
  return { a, gt: (x: number | string, y: number | string) => (numeric ? (x as number) > (y as number) : String(x) > String(y)) };
}

function bubbleSort(ctx: Ctx): Gen {
  const { a, gt } = sortNumbersOrText(ctx);
  const T = ctx.target, n = a.length;
  const beats: GenBeat[] = [];
  for (let p = 0; p < n - 1; p++) {
    const acts: Act[] = [];
    const swaps: string[] = [];
    for (let j = 0; j < n - 1 - p; j++) {
      acts.push({ do: 'highlight', target: [`${T}[${j}]`, `${T}[${j + 1}]`], state: 'comparing', hold: false });
      if (gt(a[j], a[j + 1])) {
        swaps.push(`${a[j]}↔${a[j + 1]}`);
        acts.push({ do: 'swap', target: T, i: j, j: j + 1 });
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
      }
    }
    if (!swaps.length) {
      acts.push(...hl(range(0, n - 1 - p).map((i) => `${T}[${i}]`), 'sorted'));
      beats.push({ title: `Pass ${p + 1}: no swaps`, narration: `Pass ${p + 1} compares every neighbouring pair and swaps nothing, so the array is already sorted: ${a.join(', ')}.`, actions: acts });
      return { beats };
    }
    acts.push({ do: 'highlight', target: `${T}[${n - 1 - p}]`, state: 'sorted' });
    beats.push({ title: `Pass ${p + 1}`, narration: `Compare neighbours left to right and swap when the left one is bigger: ${list(swaps)}. ${a[n - 1 - p]} has bubbled to its final place.`, actions: acts });
  }
  beats[beats.length - 1].actions.push({ do: 'highlight', target: `${T}[0]`, state: 'sorted' });
  beats[beats.length - 1].narration += ` Sorted: ${a.join(', ')}.`;
  return { beats };
}

function insertionSort(ctx: Ctx): Gen {
  const { a, gt } = sortNumbersOrText(ctx);
  const T = ctx.target, n = a.length;
  const beats: GenBeat[] = [{ title: 'One sorted card', narration: `On its own, ${a[0]} is a sorted list. Each next value is slid left into place among the sorted ones.`, actions: [{ do: 'highlight', target: `${T}[0]`, state: 'sorted' }] }];
  for (let i = 1; i < n; i++) {
    const v = a[i];
    const acts: Act[] = [{ do: 'highlight', target: `${T}[${i}]`, state: 'active' }];
    const passed: (string | number)[] = [];
    let j = i;
    while (j > 0 && gt(a[j - 1], a[j])) {
      passed.push(a[j - 1]);
      acts.push({ do: 'swap', target: T, i: j - 1, j });
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      j--;
    }
    acts.push(...hl(range(0, i).map((x) => `${T}[${x}]`), 'sorted'));
    beats.push({ title: `Insert ${v}`, narration: passed.length ? `${v} moves left past ${list(passed)}, which are bigger, and stops at index ${j}.` : `${v} is not smaller than ${a[i - 1]}, so it stays at index ${i}.`, actions: acts });
  }
  beats[beats.length - 1].narration += ` Sorted: ${a.join(', ')}.`;
  return { beats };
}

function selectionSort(ctx: Ctx): Gen {
  const { a, gt } = sortNumbersOrText(ctx);
  const T = ctx.target, n = a.length;
  const beats: GenBeat[] = [];
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) if (gt(a[m], a[j])) m = j;
    const acts: Act[] = [...hl(range(i, n - 1).map((x) => `${T}[${x}]`), 'comparing', false), { do: 'highlight', target: `${T}[${m}]`, state: 'pivot' }];
    if (m !== i) acts.push({ do: 'swap', target: T, i, j: m });
    const v = a[m];
    [a[i], a[m]] = [a[m], a[i]];
    acts.push({ do: 'highlight', target: `${T}[${i}]`, state: 'sorted' });
    beats.push({ title: `Place index ${i}`, narration: m === i ? `The smallest of the rest is ${v}, already at index ${i}.` : `The smallest of the rest is ${v} at index ${m}; swap it into index ${i}.`, actions: acts });
  }
  beats[beats.length - 1].actions.push({ do: 'highlight', target: `${T}[${n - 1}]`, state: 'sorted' });
  beats[beats.length - 1].narration += ` The last value is in place too: ${a.join(', ')}.`;
  return { beats };
}

// ── graphs ───────────────────────────────────────────────────────────────────

const graphOf = (ctx: Ctx) => {
  const e = ctx.entity;
  if (!e) ctx.fail(`"${ctx.target}" is not an entity in this scene — declare the graph first`);
  if (e!.type !== 'graph' && e!.type !== 'tree') ctx.fail(`this algorithm runs on a graph or tree; "${ctx.target}" is a ${e!.type}`);
  const nodes = (e!.nodes ?? []) as { id: string; value?: string | number; parent?: string }[];
  limit(ctx, 'the number of nodes', nodes.length, 12);
  const edges = (e!.type === 'tree'
    ? nodes.filter((n) => n.parent).map((n) => ({ from: n.parent!, to: n.id }))
    : (e!.edges ?? [])) as { from: string; to: string; weight?: string | number }[];
  const directed = e!.type === 'tree' || !!e!.directed;
  const adj = new Map<string, { to: string; w: number; raw?: string | number }[]>(nodes.map((n) => [n.id, []]));
  for (const ed of edges) {
    adj.get(ed.from)?.push({ to: ed.to, w: num(ed.weight), raw: ed.weight });
    if (!directed) adj.get(ed.to)?.push({ to: ed.from, w: num(ed.weight), raw: ed.weight });
  }
  const start = String(ctx.args.start ?? ctx.args.source ?? nodes[0]?.id);
  if (!adj.has(start)) ctx.fail(`start node "${start}" is not in "${ctx.target}" (nodes: ${nodes.map((n) => n.id).join(', ')})`);
  const name = (id: string) => String(nodes.find((n) => n.id === id)?.value ?? id);
  return { nodes, adj, start, name, T: ctx.target };
};

function traverse(ctx: Ctx, kind: 'bfs' | 'dfs'): Gen {
  const { nodes, adj, start, name, T } = graphOf(ctx);
  const F = `${T}-${kind === 'bfs' ? 'queue' : 'stack'}`, O = `${T}-order`;
  const box: Loose = kind === 'bfs' ? { id: F, type: 'queue', values: [], label: 'queue' } : { id: F, type: 'stack', values: [], label: 'stack' };
  const cap = caption(O, 'visited: —', { rel: 'below', id: O, of: F, gap: 'md' });
  const put = (id: string): Act => (kind === 'bfs' ? { do: 'enqueue', target: F, value: name(id) } : { do: 'push', target: F, value: name(id) });
  const order: string[] = [];
  const seen = new Set([start]);
  const beats: GenBeat[] = [{
    title: `Start at ${name(start)}`,
    narration: kind === 'bfs'
      ? `Breadth-first search uses a queue: first in, first out, so nodes are visited in rings around ${name(start)}. Neighbours are taken in the order the edges are listed.`
      : `Depth-first search uses a stack: last in, first out, so it follows one path as deep as it goes before backing up. Neighbours are taken in the order the edges are listed.`,
    actions: [{ do: 'create', target: [F, O], effect: 'fade' }, put(start), { do: 'highlight', target: `${T}.${start}`, state: 'comparing' }],
  }];
  const frontier = [start];
  while (frontier.length) {
    const u = kind === 'bfs' ? frontier.shift()! : frontier.pop()!;
    const acts: Act[] = [{ do: kind === 'bfs' ? 'dequeue' : 'pop', target: F }];
    if (kind === 'dfs' && order.includes(u)) {
      // a stale entry: popped and skipped in the same beat as the next real visit
      beats[beats.length - 1].actions.push(...acts);
      beats[beats.length - 1].narration += ` ${name(u)} comes off the stack again but is already visited, so it is skipped.`;
      continue;
    }
    order.push(u);
    acts.push({ do: 'highlight', target: `${T}.${u}`, state: 'visited' });
    const fresh = adj.get(u)!.map((x) => x.to).filter((v) => (kind === 'bfs' ? !seen.has(v) : !order.includes(v)));
    const pushOrder = kind === 'dfs' ? [...fresh].reverse() : fresh;
    for (const v of pushOrder) {
      seen.add(v);
      frontier.push(v);
      acts.push(put(v), { do: 'highlight', target: `${T}.${v}`, state: 'comparing' });
    }
    acts.push({ do: 'set', target: O, text: `visited: ${order.map(name).join(' → ')}` });
    beats.push({
      title: `Visit ${name(u)}`,
      narration: `Take ${name(u)} from the ${kind === 'bfs' ? 'front of the queue' : 'top of the stack'} and visit it.${fresh.length ? ` ${kind === 'bfs' ? 'Its new neighbour' : 'Its unvisited neighbour'}${fresh.length > 1 ? 's' : ''} ${list(fresh.map(name))} ${kind === 'bfs' ? (fresh.length > 1 ? 'join the back' : 'joins the back') : fresh.length > 1 ? `go on the stack (${name(fresh[0])} on top)` : 'goes on the stack'}.` : ' It has no new neighbours.'}`,
      actions: acts,
    });
  }
  const unreached = nodes.filter((n) => !order.includes(n.id)).map((n) => name(n.id));
  beats[beats.length - 1].narration += ` Visit order: ${order.map(name).join(', ')}.${unreached.length ? ` ${list(unreached)} can't be reached from ${name(start)}.` : ''}`;
  return { beats, entities: [box, cap.entity], layout: [{ rel: 'right-of', id: F, of: T, gap: 'xl' }, cap.layout] };
}

function dijkstra(ctx: Ctx): Gen {
  const { nodes, adj, start, name, T } = graphOf(ctx);
  for (const [u, es] of adj) for (const e of es) {
    if (Number.isNaN(e.w)) ctx.fail(`Dijkstra needs a number weight on every edge; ${name(u)}–${name(e.to)} has ${e.raw === undefined ? 'none' : `"${e.raw}"`}`);
    if (e.w < 0) ctx.fail(`Dijkstra needs non-negative weights; ${name(u)}–${name(e.to)} weighs ${e.w} (use Bellman–Ford for negative edges)`);
  }
  const N = `${T}-nodes`, D = `${T}-dist`;
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const dist = new Map(nodes.map((n) => [n.id, n.id === start ? 0 : Infinity]));
  const show = (d: number) => (Number.isFinite(d) ? d : '∞');
  const entities = [
    { id: N, type: 'array', values: nodes.map((n) => name(n.id)), indices: false, label: 'node' },
    { id: D, type: 'array', values: nodes.map((n) => show(dist.get(n.id)!)), indices: false, label: 'shortest distance so far' },
  ];
  const beats: GenBeat[] = [{
    title: `Distances from ${name(start)}`,
    narration: `${name(start)} is 0 away from itself; every other node starts at infinity. Repeatedly settle the closest unsettled node and try to shorten the paths through it.`,
    actions: [{ do: 'create', target: [N, D], effect: 'fade' }, { do: 'highlight', target: [`${T}.${start}`, `${D}[${idx.get(start)}]`], state: 'active' }],
  }];
  const settled = new Set<string>();
  for (;;) {
    let u: string | null = null;
    for (const n of nodes) if (!settled.has(n.id) && Number.isFinite(dist.get(n.id)!) && (u === null || dist.get(n.id)! < dist.get(u)!)) u = n.id;
    if (u === null) break;
    settled.add(u);
    const du = dist.get(u)!;
    const acts: Act[] = [{ do: 'highlight', target: [`${T}.${u}`, `${D}[${idx.get(u)}]`], state: 'visited' }];
    const notes: string[] = [];
    for (const { to: v, w } of adj.get(u)!) {
      if (settled.has(v)) continue;
      const nd = du + w;
      if (nd < dist.get(v)!) {
        notes.push(`${name(v)}: ${du} + ${w} = ${nd} < ${show(dist.get(v)!)} → ${nd}`);
        dist.set(v, nd);
        acts.push({ do: 'set', target: `${D}[${idx.get(v)}]`, value: nd }, { do: 'highlight', target: [`${T}.${v}`, `${D}[${idx.get(v)}]`], state: 'comparing' });
      } else notes.push(`${name(v)}: ${du} + ${w} = ${nd}, no better than ${show(dist.get(v)!)}`);
    }
    beats.push({
      title: `Settle ${name(u)} at ${du}`,
      narration: `${name(u)} is the closest unsettled node, ${du} away, so that distance is final.${notes.length ? ` Through it: ${notes.join('; ')}.` : ' It offers no shorter paths.'}`,
      actions: acts,
    });
  }
  const unreached = nodes.filter((n) => !settled.has(n.id)).map((n) => name(n.id));
  beats.push({
    title: 'Shortest distances',
    narration: `Every reachable node is settled: ${nodes.filter((n) => settled.has(n.id)).map((n) => `${name(n.id)} ${dist.get(n.id)}`).join(', ')}.${unreached.length ? ` ${list(unreached)} can't be reached.` : ''}`,
    actions: hl(nodes.filter((n) => settled.has(n.id)).map((n) => `${D}[${idx.get(n.id)}]`), 'found'),
  });
  return { beats, entities, layout: [{ rel: 'below', id: N, of: T, gap: 'lg' }, { rel: 'below', id: D, of: N, gap: 'sm' }] };
}

// ── dynamic programming ──────────────────────────────────────────────────────

function fibonacci(ctx: Ctx): Gen {
  const n = num(ctx.args.n);
  if (!Number.isInteger(n) || n < 2) ctx.fail('fibonacci needs "args": { "n": <whole number ≥ 2> }');
  limit(ctx, 'n', n, 20);
  const T = ctx.target;
  const v = [0, 1];
  for (let i = 2; i <= n; i++) v[i] = v[i - 1] + v[i - 2];
  const own = !ctx.entity;
  const beats: GenBeat[] = [{ title: 'Base cases', narration: `F(0) = 0 and F(1) = 1. Every later value is the sum of the two before it, read from the table instead of recomputed.`, actions: [...(own ? [{ do: 'create', target: T, effect: 'fade' }] : []), { do: 'set', target: `${T}[0]`, value: 0 }, { do: 'set', target: `${T}[1]`, value: 1 }] }];
  for (let i = 2; i <= n; i++) {
    beats.push({ title: `F(${i})`, narration: `F(${i}) = F(${i - 1}) + F(${i - 2}) = ${v[i - 1]} + ${v[i - 2]} = ${v[i]}.`, actions: [...hl([`${T}[${i - 1}]`, `${T}[${i - 2}]`], 'comparing', false), { do: 'set', target: `${T}[${i}]`, value: v[i] }, { do: 'highlight', target: `${T}[${i}]`, state: 'active' }] });
  }
  beats.push({ title: `F(${n}) = ${v[n]}`, narration: `Each value was computed once: ${n - 1} additions instead of the exponential number a plain recursion makes. F(${n}) = ${v[n]}.`, actions: [{ do: 'highlight', target: `${T}[${n}]`, state: 'found' }] });
  return { beats, entities: own ? [{ id: T, type: 'array', values: Array.from({ length: n + 1 }, () => '·'), label: 'F(i)' }] : [] };
}

function coinChange(ctx: Ctx): Gen {
  const coins = (Array.isArray(ctx.args.coins) ? ctx.args.coins : []).map(num);
  const amount = num(ctx.args.amount);
  if (!coins.length || coins.some((c: number) => !Number.isInteger(c) || c < 1)) ctx.fail('coin change needs "args": { "coins": [whole numbers ≥ 1], "amount": n }');
  if (!Number.isInteger(amount) || amount < 1) ctx.fail('coin change needs a whole "amount" ≥ 1');
  limit(ctx, 'the amount', amount, 20);
  const T = ctx.target;
  const dp: number[] = [0];
  for (let i = 1; i <= amount; i++) {
    let best = Infinity;
    for (const c of coins) if (c <= i && dp[i - c] + 1 < best) best = dp[i - c] + 1;
    dp[i] = best;
  }
  const show = (x: number) => (Number.isFinite(x) ? x : '∞');
  const own = !ctx.entity;
  const beats: GenBeat[] = [{ title: 'Zero needs zero coins', narration: `dp[i] is the fewest coins (from ${coins.join(', ')}) that make i. dp[0] = 0; each later amount tries every coin as the last one: dp[i] = 1 + the best of dp[i − coin].`, actions: [...(own ? [{ do: 'create', target: T, effect: 'fade' }] : []), { do: 'set', target: `${T}[0]`, value: 0 }] }];
  for (let i = 1; i <= amount; i++) {
    const tries = coins.filter((c: number) => c <= i);
    const from = tries.map((c: number) => `${T}[${i - c}]`);
    beats.push({
      title: `Amount ${i}`,
      narration: tries.length
        ? `dp[${i}] = 1 + min(${tries.map((c: number) => `dp[${i - c}]`).join(', ')}) = 1 + min(${tries.map((c: number) => show(dp[i - c])).join(', ')}) = ${show(dp[i])}.`
        : `No coin is small enough for ${i}: dp[${i}] = ∞.`,
      actions: [...hl(from, 'comparing', false), { do: 'set', target: `${T}[${i}]`, value: show(dp[i]) }, { do: 'highlight', target: `${T}[${i}]`, state: 'active' }],
    });
  }
  beats.push({ title: Number.isFinite(dp[amount]) ? `${dp[amount]} coins` : 'Impossible', narration: Number.isFinite(dp[amount]) ? `The fewest coins that make ${amount} is ${dp[amount]}.` : `${amount} can't be made from ${coins.join(', ')}.`, actions: [{ do: 'highlight', target: `${T}[${amount}]`, state: Number.isFinite(dp[amount]) ? 'found' : 'error' }] });
  return { beats, entities: own ? [{ id: T, type: 'array', values: Array.from({ length: amount + 1 }, () => '·'), label: 'fewest coins for each amount' }] : [] };
}

/** A DP table entity: header row = columns; data rows start at r0. Cells are refs "t.r{row}c{col}". */
const cell = (T: string, r: number, c: number) => `${T}.r${r}c${c}`;

function lcs(ctx: Ctx): Gen {
  const A = String(ctx.args.a ?? ''), B = String(ctx.args.b ?? '');
  if (!A || !B) ctx.fail('LCS needs "args": { "a": "<string>", "b": "<string>" }');
  limit(ctx, 'the first string', A.length, 10);
  limit(ctx, 'the second string', B.length, 10);
  const T = ctx.target;
  const L = Array.from({ length: A.length + 1 }, () => Array(B.length + 1).fill(0));
  for (let i = 1; i <= A.length; i++) for (let j = 1; j <= B.length; j++) L[i][j] = A[i - 1] === B[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
  const table = { id: T, type: 'table', columns: ['', '∅', ...B.split('')], rows: [['∅', ...Array(B.length + 1).fill(0)], ...A.split('').map((ch) => [ch, 0, ...Array(B.length).fill('·')])], label: `LCS of ${A} and ${B}` };
  const beats: GenBeat[] = [{ title: 'Empty prefixes', narration: `Cell (row, column) is the longest common subsequence of the prefixes up to that row's and column's letters. With an empty prefix the answer is 0, so the first row and column are 0.`, actions: [{ do: 'create', target: T, effect: 'fade' }] }];
  for (let i = 1; i <= A.length; i++) {
    const acts: Act[] = [];
    const matches: string[] = [];
    for (let j = 1; j <= B.length; j++) {
      acts.push({ do: 'set', target: cell(T, i, j + 1), value: L[i][j] });
      if (A[i - 1] === B[j - 1]) { matches.push(`column ${j} (${B[j - 1]})`); acts.push({ do: 'highlight', target: cell(T, i, j + 1), state: 'insight' }); }
    }
    beats.push({ title: `Row ${i}: ${A[i - 1]}`, narration: matches.length ? `"${A[i - 1]}" matches at ${list(matches)}: there the value is the diagonal one plus 1. Everywhere else it is the larger of the cell above and the cell to the left.` : `"${A[i - 1]}" matches nothing in ${B}, so each cell copies the larger of the cell above and the cell to the left.`, actions: acts });
  }
  // walk back from the corner to read one LCS
  const path: string[] = [];
  let out = '';
  for (let i = A.length, j = B.length; i > 0 && j > 0;) {
    if (A[i - 1] === B[j - 1]) { out = A[i - 1] + out; path.push(cell(T, i, j + 1)); i--; j--; } else if (L[i - 1][j] >= L[i][j - 1]) i--; else j--;
  }
  beats.push({ title: `Length ${L[A.length][B.length]}: ${out || '(none)'}`, narration: `The bottom-right cell holds the answer, ${L[A.length][B.length]}. Walking back through the matching cells spells one longest common subsequence: ${out || 'none'}.`, actions: [{ do: 'clear', target: T }, ...hl([...path, cell(T, A.length, B.length + 1)], 'found')] });
  return { beats, entities: ctx.entity ? [] : [table] };
}

function knapsack(ctx: Ctx): Gen {
  const w = (Array.isArray(ctx.args.weights) ? ctx.args.weights : []).map(num);
  const v = (Array.isArray(ctx.args.values) ? ctx.args.values : []).map(num);
  const C = num(ctx.args.capacity);
  if (!w.length || w.length !== v.length || [...w, ...v].some((x: number) => !Number.isInteger(x) || x < 0)) ctx.fail('knapsack needs "args": { "weights": [...], "values": [...] } of the same length (whole numbers)');
  if (!Number.isInteger(C) || C < 1) ctx.fail('knapsack needs a whole "capacity" ≥ 1');
  limit(ctx, 'the capacity', C, 10);
  limit(ctx, 'the number of items', w.length, 6);
  const T = ctx.target, n = w.length;
  const K = Array.from({ length: n + 1 }, () => Array(C + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let c = 0; c <= C; c++) K[i][c] = Math.max(K[i - 1][c], w[i - 1] <= c ? K[i - 1][c - w[i - 1]] + v[i - 1] : -1);
  const table = { id: T, type: 'table', columns: ['items', ...range(0, C).map(String)], rows: [['none', ...Array(C + 1).fill(0)], ...w.map((wi: number, i: number) => [`+ #${i + 1} (w${wi}, $${v[i]})`, ...Array(C + 1).fill('·')])], label: `best value within each capacity` };
  const beats: GenBeat[] = [{ title: 'No items', narration: `Row "none": with no items the best value is 0 at every capacity. Each next row adds one item and asks, for every capacity, whether taking it beats leaving it.`, actions: [{ do: 'create', target: T, effect: 'fade' }] }];
  for (let i = 1; i <= n; i++) {
    const acts: Act[] = [];
    const took: number[] = [];
    for (let c = 0; c <= C; c++) {
      acts.push({ do: 'set', target: cell(T, i, c + 1), value: K[i][c] });
      if (K[i][c] !== K[i - 1][c]) { took.push(c); acts.push({ do: 'highlight', target: cell(T, i, c + 1), state: 'insight' }); }
    }
    beats.push({ title: `Item ${i}: weight ${w[i - 1]}, value ${v[i - 1]}`, narration: took.length ? `Taking item ${i} pays off at capacity ${list(took)}: its value ${v[i - 1]} plus the best of the rest in the remaining room beats the row above.` : `Item ${i} never beats leaving it out, so this row copies the one above.`, actions: acts });
  }
  const chosen: number[] = [];
  for (let i = n, c = C; i > 0; i--) if (K[i][c] !== K[i - 1][c]) { chosen.unshift(i); c -= w[i - 1]; }
  beats.push({ title: `Best value ${K[n][C]}`, narration: `The bottom-right cell is the answer: value ${K[n][C]} within capacity ${C}, taking item${chosen.length > 1 ? 's' : ''} ${list(chosen.map(String)) || 'none'}.`, actions: [{ do: 'clear', target: T }, { do: 'highlight', target: cell(T, n, C + 1), state: 'found' }] });
  return { beats, entities: ctx.entity ? [] : [table] };
}

// ── registry ─────────────────────────────────────────────────────────────────

const ALGORITHMS: Record<string, (ctx: Ctx) => Gen> = {
  binarysearch: binarySearch,
  slidingwindow: slidingWindow, twopointers: slidingWindow,
  bubblesort: bubbleSort, insertionsort: insertionSort, selectionsort: selectionSort,
  bfs: (c) => traverse(c, 'bfs'), breadthfirstsearch: (c) => traverse(c, 'bfs'),
  dfs: (c) => traverse(c, 'dfs'), depthfirstsearch: (c) => traverse(c, 'dfs'),
  dijkstra, shortestpath: dijkstra,
  fibonacci, fib: fibonacci,
  coinchange: coinChange, mincoins: coinChange,
  lcs, longestcommonsubsequence: lcs,
  knapsack, knapsack01: knapsack,
  ...ML_ALGORITHMS,
  ...ENG_ALGORITHMS,
};
/** The names the model may use (shown in prompts and errors). */
export const COMPUTED_ALGORITHMS = ['binary-search', 'sliding-window', 'bubble-sort', 'insertion-sort', 'selection-sort', 'bfs', 'dfs', 'dijkstra', 'fibonacci', 'coin-change', 'lcs', 'knapsack', ...ML_NAMES, ...ENG_NAMES];
const key = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fit a trace into `budget` beats: merge the neighbouring pair with the fewest actions until it fits (null if it can't). */
function fit(beats: GenBeat[], budget: number): GenBeat[] | null {
  const out = [...beats];
  while (out.length > budget) {
    let best = -1;
    for (let i = 0; i + 1 < out.length; i++) {
      const size = out[i].actions.length + out[i + 1].actions.length;
      const fits = size <= LIMITS.actionsPerBeat && out[i].narration.length + out[i + 1].narration.length < LIMITS.narration - 2;
      if (fits && (best < 0 || size < out[best].actions.length + out[best + 1].actions.length)) best = i;
    }
    if (best < 0) return null;
    const [a, b] = out.splice(best, 2);
    out.splice(best, 0, { title: `${a.title} · ${b.title}`.slice(0, LIMITS.title), narration: `${a.narration} ${b.narration}`, actions: [...a.actions, ...b.actions] });
  }
  return out;
}

/**
 * Replace every `compute` beat with its computed trace. Returns the expanded
 * scene, or issues (bad algorithm, bad input, trace too long) with the beat's path.
 */
export function expandComputed(input: unknown): { value: unknown; issues: Issue[]; computed: { beat: number; algorithm: string; target: string; beats: number }[] } {
  const scene = input as Loose;
  const computed: { beat: number; algorithm: string; target: string; beats: number }[] = [];
  if (!scene || typeof scene !== 'object' || !Array.isArray(scene.beats) || !scene.beats.some((b: Loose) => b && (b.compute || b.run))) return { value: input, issues: [], computed };
  const out: Loose = { ...scene, spaces: [...(scene.spaces ?? [])], entities: [...(scene.entities ?? [])], layout: [...(scene.layout ?? [])], beats: [] as Loose[], provenance: [...(scene.provenance ?? [])] };
  const issues: Issue[] = [];
  const plainBeats = scene.beats.filter((b: Loose) => !(b && (b.compute || b.run))).length;
  const computeBeats = scene.beats.length - plainBeats;
  scene.beats.forEach((beat: Loose, bi: number) => {
    const spec = beat?.compute ?? beat?.run;
    if (!spec) { out.beats.push(beat); return; }
    const path = `beats[${bi}].compute`;
    const name = key(spec.algorithm ?? spec.name);
    const run = ALGORITHMS[name];
    if (!run) { issues.push({ path: `${path}.algorithm`, message: `"${spec.algorithm ?? ''}" isn't an algorithm TutorBoard can run; use one of ${COMPUTED_ALGORITHMS.join(', ')} — or write the beats yourself` }); return; }
    const target = String(spec.target ?? spec.on ?? '');
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(target)) { issues.push({ path: `${path}.target`, message: 'name the entity the algorithm runs on (or, for fibonacci / coin-change / lcs / knapsack, the id of the table it builds)' }); return; }
    const ctx: Ctx = {
      scene, target, entity: (scene.entities ?? []).find((e: Loose) => e?.id === target), args: spec.args ?? {},
      fail: (msg: string) => { throw new ComputeError(msg); },
    };
    let gen: Gen;
    try { gen = run(ctx); } catch (e) {
      if (e instanceof ComputeError) { issues.push({ path, message: `${spec.algorithm}: ${e.message}` }); return; }
      throw e;
    }
    // room left in the lesson: the others' beats stay, the trace gets the rest
    const budget = Math.max(2, Math.floor((LIMITS.beats - plainBeats) / computeBeats));
    // the beat's own actions (if any) open the trace
    if (Array.isArray(beat.actions) && beat.actions.length) gen.beats[0].actions = [...beat.actions, ...gen.beats[0].actions];
    if (typeof beat.title === 'string' && beat.title) gen.beats[0].title = beat.title.slice(0, LIMITS.title);
    const fitted = fit(gen.beats, budget);
    if (!fitted) { issues.push({ path, message: `${spec.algorithm}: the trace needs ${gen.beats.length} steps but the lesson has room for ${budget} — use a smaller input or fewer other beats` }); return; }
    // spaces and entities it needs (state captions, queues, distance rows, DP tables, plots) unless the scene already has them
    const spaceIds = new Set(out.spaces.map((sp: Loose) => sp?.id));
    for (const sp of gen.spaces ?? []) if (!spaceIds.has(sp.id)) { out.spaces.push(sp); spaceIds.add(sp.id); }
    const ids = new Set(out.entities.map((e: Loose) => e?.id));
    for (const e of gen.entities ?? []) if (!ids.has(e.id)) { out.entities.push(e); ids.add(e.id); }
    const placed = new Set(out.layout.flatMap((r: Loose) => [r?.id, ...(Array.isArray(r?.ids) ? r.ids : [])]));
    for (const r of gen.layout ?? []) if (!placed.has(r.id)) out.layout.push(r);
    const slug = name.slice(0, 20);
    fitted.forEach((b, k) => out.beats.push({ id: `${slug}${bi}s${k + 1}`, title: b.title.slice(0, LIMITS.title), narration: b.narration.slice(0, LIMITS.narration), actions: b.actions, ...(beat.pace ? { pace: beat.pace } : {}) }));
    const algorithm = COMPUTED_ALGORITHMS.find((n) => key(n) === name) ?? name;
    computed.push({ beat: bi, algorithm, target, beats: fitted.length });
    // where the numbers came from: the lesson's own input, or data generated because none was given
    out.provenance.push({ algorithm, target, data: gen.data ?? 'given', beats: fitted.map((_, k) => `${slug}${bi}s${k + 1}`) });
  });
  return { value: out, issues, computed };
}
