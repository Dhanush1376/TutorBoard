/**
 * Computed machine-learning traces — the same `compute` route as algorithms.ts.
 *
 * Every number on the board comes from running the method: gradient-descent
 * steps from the objective's slope, k-means assignments and means, confusion
 * counts and metrics from the labels, least-squares coefficients, perceptron
 * updates. When the model supplies no data, a dataset is generated from a
 * seed (so a lesson is reproducible) and the board says plainly that it is
 * illustrative, not measured.
 */
import { caption, num, type Act, type Ctx, type Gen, type GenBeat, type Loose } from './computeKit.js';
import { compileExpr } from './expr.js';

const fmt = (v: number) => {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2);
  return String(Number(v.toPrecision(3)));
};
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Numbers as read aloud: a real minus sign, negatives in brackets when they follow an operator. */
const sgn = (v: number, digits = 3) => { const t = String(Number(v.toPrecision(digits))); return v < 0 ? `(−${t.slice(1)})` : t; };
const minus = (t: string) => t.replace(/(^|[^\w])-(?=\d)/g, '$1−');
/** "x^2 - 4x + 5" → "x² − 4x + 5" for narration (plots keep the expression). */
const pretty = (src: string) => src.replace(/\^2(?!\d)/g, '²').replace(/\^3(?!\d)/g, '³').replace(/\*/g, '·').replace(/ - /g, ' − ');
const f4 = (v: number) => minus(String(Number(v.toPrecision(4))));
const TONES = ['info', 'accent', 'success', 'primary', 'danger'];

/** Small seeded PRNG (mulberry32) and normal samples, so generated data is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}

/** A tidy axis range around values (10 % margin, rounded outward). */
function axis(values: number[], pad = 0.1): [number, number] {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const m = (hi - lo) * pad;
  const step = 10 ** Math.floor(Math.log10(hi - lo)) / 2;
  return [Math.floor((lo - m) / step) * step, Math.ceil((hi + m) / step) * step];
}

const ILLUSTRATIVE = 'Illustrative data — generated for this lesson, not measured';

/** The space to draw in: the scene's own if it has one with this id, otherwise one sized to the data. */
function spaceFor(ctx: Ctx, xs: number[], ys: number[], labels: { x?: string; y?: string } = {}): { id: string; space?: Loose; ranges: { x: [number, number]; y: [number, number] } } {
  const existing = (ctx.scene.spaces ?? []).find((s: Loose) => s?.id === ctx.target);
  if (existing) return { id: ctx.target, ranges: { x: existing.x, y: existing.y } };
  const x = axis(xs), y = axis(ys);
  return { id: ctx.target, space: { id: ctx.target, kind: 'cartesian', x, y, axes: true, grid: true, ...(labels.x ? { xLabel: labels.x } : {}), ...(labels.y ? { yLabel: labels.y } : {}) }, ranges: { x, y } };
}

/** Points given as [[x, y], …] (optionally with labels), or generated from args.generate. */
function pointsOf(ctx: Ctx, opts: { labelled?: boolean; maxN: number }): { pts: { x: number; y: number; label?: string }[]; illustrative: boolean } {
  const given = ctx.args.points;
  if (Array.isArray(given) && given.length) {
    if (given.length > opts.maxN) ctx.fail(`${given.length} points; at most ${opts.maxN}`);
    const pts = given.map((p: unknown, i: number) => {
      const q = Array.isArray(p) ? { x: num(p[0]), y: num(p[1]), label: p[2] } : (p as Loose) ?? {};
      const x = num(q.x ?? q.at?.[0]), y = num(q.y ?? q.at?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) ctx.fail(`point ${i} isn't a pair of numbers`);
      const label = q.label ?? q.cls ?? q.class;
      if (opts.labelled && label === undefined) ctx.fail(`point ${i} needs a label: [x, y, "A"]`);
      return { x, y, ...(label !== undefined ? { label: String(label) } : {}) };
    });
    return { pts, illustrative: false };
  }
  const g = (ctx.args.generate ?? {}) as Loose;
  const n = Math.min(opts.maxN, Math.max(6, Math.round(num(g.n) || 24)));
  const k = Math.min(5, Math.max(2, Math.round(num(g.clusters ?? g.classes) || 2)));
  const spread = num(g.spread) || 0.8;
  const r = rng(Math.round(num(g.seed) || 7));
  const centres = Array.from({ length: k }, (_, i) => ({ x: 2 + 6 * Math.cos((2 * Math.PI * i) / k), y: 2 + 6 * Math.sin((2 * Math.PI * i) / k) }));
  // listed group by group, so "start on the first k points" starts in one corner and the centroids visibly travel
  const pts = Array.from({ length: n }, (_, i) => {
    const c = centres[Math.min(k - 1, Math.floor((i * k) / n))];
    return { x: r2(c.x + r.normal() * spread * 1.5), y: r2(c.y + r.normal() * spread * 1.5), label: opts.labelled ? String.fromCharCode(65 + (i % k)) : undefined };
  });
  return { pts, illustrative: true };
}

const noteFor = (ctx: Ctx, space: string): { entity: Loose; layout: Loose } => ({
  entity: { id: `${ctx.target}-note`, type: 'text', text: ILLUSTRATIVE, role: 'caption', tone: 'muted' },
  layout: { rel: 'below', id: `${ctx.target}-note`, of: space, gap: 'sm' },
});

// ── gradient descent ─────────────────────────────────────────────────────────

function gradientDescent(ctx: Ctx): Gen {
  const src = String(ctx.args.f ?? ctx.args.objective ?? ctx.args.expr ?? '');
  if (!src) ctx.fail('gradient descent needs the objective: "args": { "f": "x^2 - 4x + 5", "x0": 0, "lr": 0.1 }');
  let f: (x: number) => number, df: (x: number) => number;
  try { f = compileExpr(src); } catch (e) { ctx.fail(`can't evaluate f(x) = ${src}: ${(e as Error).message}`); }
  if (ctx.args.df) {
    try { df = compileExpr(String(ctx.args.df)); } catch (e) { ctx.fail(`can't evaluate f'(x) = ${ctx.args.df}: ${(e as Error).message}`); }
  } else df = (x) => { const h = 1e-5 * (1 + Math.abs(x)); return (f!(x + h) - f!(x - h)) / (2 * h); };
  const x0 = num(ctx.args.x0 ?? ctx.args.start), lr = num(ctx.args.lr ?? ctx.args.learningRate ?? 0.1);
  const steps = Math.round(num(ctx.args.steps ?? 6));
  if (!Number.isFinite(x0)) ctx.fail('gradient descent needs a starting point "x0"');
  if (!(lr > 0)) ctx.fail('the learning rate "lr" must be a positive number');
  if (!(steps >= 1 && steps <= 12)) ctx.fail('"steps" is 1 to 12');
  const path: { x: number; y: number; g: number }[] = [{ x: x0, y: f!(x0), g: df!(x0) }];
  if (!Number.isFinite(path[0].y) || !Number.isFinite(path[0].g)) ctx.fail(`f or its slope isn't defined at x0 = ${x0}`);
  let diverged = false;
  for (let k = 0; k < steps; k++) {
    const p = path[path.length - 1];
    const x = p.x - lr * p.g;
    const y = f!(x), g = df!(x);
    if (!Number.isFinite(y) || !Number.isFinite(g) || Math.abs(x) > 1e6) { diverged = true; break; }
    path.push({ x, y, g });
    if (Math.abs(x) > 50 * (1 + Math.abs(x0))) { diverged = true; break; }
  }
  // draw the curve over the path, and a little past it so the bowl is visible
  const xs = path.map((p) => p.x);
  const lo = Math.min(...xs), hi = Math.max(...xs), w = Math.max(1, hi - lo);
  const sampleX = Array.from({ length: 41 }, (_, i) => lo - w * 0.35 + (w * 1.7 * i) / 40);
  const sp = spaceFor(ctx, sampleX, [...sampleX.map((x) => f!(x)).filter(Number.isFinite), ...path.map((p) => p.y)], { x: 'x', y: 'f(x)' });
  const T = ctx.target, F = `${T}-f`, B = `${T}-ball`, S = `${T}-state`;
  const cap = caption(S, `x = ${fmt(x0)}, f(x) = ${fmt(path[0].y)}, slope = ${fmt(path[0].g)}`, { rel: 'below', id: S, of: sp.id, gap: 'md' });
  const beats: GenBeat[] = [{
    title: `Start at x = ${fmt(x0)}`,
    narration: `f(x) = ${pretty(src)}. At x = ${minus(fmt(x0))} the value is ${f4(path[0].y)} and the slope is ${minus(fmt(path[0].g))}. Each step moves x by −(learning rate × slope), with rate ${fmt(lr)}.`,
    actions: [{ do: 'create', target: F, effect: 'draw' }, { do: 'create', target: [B, S], effect: 'pop' }],
  }];
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k];
    const delta = -lr * a.g;
    beats.push({
      title: `Step ${k}`,
      narration: `The slope is ${minus(fmt(a.g))}, so x moves by −${fmt(lr)} × ${sgn(a.g)} = ${delta > 0 ? '+' : ''}${minus(fmt(delta))}: x = ${minus(fmt(b.x))}. f ${b.y < a.y ? 'drops' : 'rises'} from ${f4(a.y)} to ${f4(b.y)}.`,
      actions: [{ do: 'move', target: B, to: [b.x, b.y] }, { do: 'set', target: S, text: `step ${k}: x = ${fmt(b.x)}, f(x) = ${fmt(b.y)}, slope = ${fmt(b.g)}` }],
    });
  }
  const last = path[path.length - 1];
  const growing = path.length > 2 && Math.abs(path[path.length - 1].x - path[path.length - 2].x) > Math.abs(path[1].x - path[0].x) * 1.5;
  beats.push(diverged || growing
    ? { title: 'The steps blow up', narration: `The steps get longer instead of shorter: a learning rate of ${fmt(lr)} overshoots this curve's valley every time. A smaller rate would settle.`, actions: [{ do: 'highlight', target: B, state: 'error' }] }
    : { title: Math.abs(last.g) < 0.05 * (Math.abs(path[0].g) + 1e-9) ? 'Nearly flat: converged' : `After ${path.length - 1} steps`, narration: `Now x = ${minus(fmt(last.x))} where the slope is only ${minus(fmt(last.g))}${Math.abs(last.g) < 1e-2 ? ' — flat, the bottom of the valley' : ''}. f fell from ${f4(path[0].y)} to ${f4(last.y)}, and the steps shrank as the slope did.`, actions: [{ do: 'highlight', target: B, state: 'found' }] });
  return {
    beats,
    spaces: sp.space ? [sp.space] : [],
    entities: [
      { id: F, type: 'plot', space: sp.id, expr: src, label: `f(x) = ${src}`, tone: 'info' },
      { id: B, type: 'body', space: sp.id, at: [x0, path[0].y] },
      cap.entity,
    ],
    layout: [...(sp.space ? [{ rel: 'place', id: sp.id, region: 'center' }] : []), cap.layout],
    data: 'given',
  };
}

// ── k-means ──────────────────────────────────────────────────────────────────

function kmeans(ctx: Ctx): Gen {
  const { pts, illustrative } = pointsOf(ctx, { maxN: 60 });
  const k = Math.round(num(ctx.args.k ?? 3));
  if (!(k >= 2 && k <= 5 && k <= pts.length)) ctx.fail(`"k" is 2 to 5 (and at most the number of points, ${pts.length})`);
  // farthest-first by default: point 0, then each next centroid on the point farthest from those chosen
  const farthest = (): number[] => {
    const chosen = [0];
    while (chosen.length < k) {
      let best = -1, far = -1;
      pts.forEach((p, i) => {
        const d = Math.min(...chosen.map((j) => Math.hypot(p.x - pts[j].x, p.y - pts[j].y)));
        if (d > far) { far = d; best = i; }
      });
      chosen.push(best);
    }
    return chosen;
  };
  const init = Array.isArray(ctx.args.init) ? ctx.args.init.map(num) : farthest();
  if (init.length !== k || init.some((i: number) => !Number.isInteger(i) || i < 0 || i >= pts.length)) ctx.fail(`"init" lists ${k} point indices`);
  let cent = init.map((i: number) => ({ x: pts[i].x, y: pts[i].y }));
  const sp = spaceFor(ctx, pts.map((p) => p.x), pts.map((p) => p.y), { x: 'x₁', y: 'x₂' });
  const T = ctx.target, S = `${T}-state`;
  const cIds = cent.map((_: unknown, j: number) => `${T}-c${j + 1}`);
  const scatter = (id: string, assign?: number[]): Loose => ({
    id, type: 'scatter', space: sp.id,
    // listed cluster by cluster, so the colours stay with the clusters from one iteration to the next
    points: (assign ? [...pts.keys()].sort((a, b) => assign[a] - assign[b]) : [...pts.keys()]).map((i) => ({ at: [pts[i].x, pts[i].y], cls: assign ? `c${assign[i] + 1}` : 'data' })),
  });
  const entities: Loose[] = [scatter(`${T}-data`)];
  const cap = caption(S, `${pts.length} points, k = ${k}`, { rel: 'below', id: S, of: sp.id, gap: 'md' });
  const note = illustrative ? noteFor(ctx, S) : null;
  const beats: GenBeat[] = [{
    title: `${pts.length} unlabelled points`,
    narration: `${pts.length} points with no labels${illustrative ? ' (generated for this lesson)' : ''}. k-means will look for ${k} groups.`,
    actions: [{ do: 'create', target: [`${T}-data`, S, ...(note ? [note.entity.id] : [])], effect: 'fade' }],
  }];
  cIds.forEach((id: string, j: number) => entities.push({ id, type: 'point', space: sp.id, at: [cent[j].x, cent[j].y], tone: TONES[j], label: `centroid ${j + 1}` }));
  beats.push({ title: `${k} starting centroids`, narration: Array.isArray(ctx.args.init) ? `Start the ${k} centroids on points ${init.join(', ')} (k-means needs a starting guess; a different one can give a different answer).` : `Start one centroid on the first point, then each next one on the point farthest from those already chosen — spreading them out avoids a poor start.`, actions: [{ do: 'create', target: cIds, effect: 'pop' }] });
  let assign = pts.map(() => -1);
  let prevId = `${T}-data`;
  for (let it = 1; it <= 8; it++) {
    const next = pts.map((p) => cent.reduce((best: number, c: { x: number; y: number }, j: number) => (Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(p.x - cent[best].x, p.y - cent[best].y) ? j : best), 0));
    const changed = next.filter((v, i) => v !== assign[i]).length;
    if (it > 1 && changed === 0) break;
    assign = next;
    const moved: Act[] = [];
    const newCent = cent.map((c: { x: number; y: number }, j: number) => {
      const mine = pts.filter((_, i) => assign[i] === j);
      return mine.length ? { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length } : c;
    });
    const shift = Math.max(...newCent.map((c: { x: number; y: number }, j: number) => Math.hypot(c.x - cent[j].x, c.y - cent[j].y)));
    newCent.forEach((c: { x: number; y: number }, j: number) => moved.push({ do: 'move', target: cIds[j], to: [c.x, c.y], ...(j ? { with: 'previous' } : {}) }));
    const id = `${T}-it${it}`;
    entities.push(scatter(id, assign));
    beats.push({
      title: `Iteration ${it}`,
      narration: `${it === 1 ? 'Colour each point by its nearest centroid.' : `${changed} point${changed === 1 ? '' : 's'} switch to a nearer centroid.`} Then move each centroid to the mean of its points (the biggest move is ${fmt(shift)}).`,
      actions: [{ do: 'remove', target: prevId, effect: 'fade' }, { do: 'create', target: id, effect: 'fade', with: 'previous' }, ...moved, { do: 'set', target: S, text: `iteration ${it}: ${it === 1 ? 'all points assigned' : `${changed} changed`}, centroids moved ≤ ${fmt(shift)}` }],
    });
    cent = newCent;
    prevId = id;
  }
  const inertia = pts.reduce((s, p, i) => s + (p.x - cent[assign[i]].x) ** 2 + (p.y - cent[assign[i]].y) ** 2, 0);
  const sizes = cent.map((_: unknown, j: number) => assign.filter((a) => a === j).length);
  beats.push({ title: 'No point moves: converged', narration: `Another pass changes nothing, so k-means has converged: clusters of ${sizes.join(', ')} points, total squared distance to the centroids ${fmt(inertia)}${illustrative ? ' on this illustrative data' : ''}.`, actions: [{ do: 'set', target: S, text: `converged: clusters of ${sizes.join(', ')}, total squared distance ${fmt(inertia)}` }] });
  return {
    beats, spaces: sp.space ? [sp.space] : [], entities: [...entities, cap.entity, ...(note ? [note.entity] : [])],
    layout: [...(sp.space ? [{ rel: 'place', id: sp.id, region: 'center' }] : []), cap.layout, ...(note ? [note.layout] : [])],
    data: illustrative ? 'illustrative' : 'given',
  };
}

// ── confusion matrix ─────────────────────────────────────────────────────────

function confusionMatrix(ctx: Ctx): Gen {
  const actual = Array.isArray(ctx.args.actual) ? ctx.args.actual.map(String) : null;
  const predicted = Array.isArray(ctx.args.predicted) ? ctx.args.predicted.map(String) : null;
  if (!actual || !predicted || !actual.length) ctx.fail('a confusion matrix needs "args": { "actual": [labels], "predicted": [labels] }');
  if (actual!.length !== predicted!.length) ctx.fail(`"actual" has ${actual!.length} labels but "predicted" has ${predicted!.length}`);
  if (actual!.length > 500) ctx.fail('at most 500 labels');
  const classes: string[] = Array.isArray(ctx.args.classes) ? ctx.args.classes.map(String) : [...new Set([...actual!, ...predicted!])].sort();
  if (classes.length < 2 || classes.length > 6) ctx.fail(`2 to 6 classes; found ${classes.length}`);
  const ci = new Map(classes.map((c, i) => [c, i]));
  const M = classes.map(() => classes.map(() => 0));
  actual!.forEach((a, i) => {
    const r = ci.get(a), c = ci.get(predicted![i]);
    if (r === undefined || c === undefined) ctx.fail(`label "${r === undefined ? a : predicted![i]}" isn't one of ${classes.join(', ')}`);
    M[r!][c!]++;
  });
  const T = ctx.target, S = `${T}-metrics`;
  const n = actual!.length;
  const correct = classes.reduce((s, _, i) => s + M[i][i], 0);
  const table = { id: T, type: 'table', columns: ['actual ↓ / predicted →', ...classes], rows: classes.map((c) => [c, ...classes.map(() => 0)]), label: `${n} predictions` };
  const cell = (r: number, c: number) => `${T}.r${r}c${c + 1}`;
  const beats: GenBeat[] = [{ title: 'Rows: truth, columns: prediction', narration: `Each of the ${n} predictions lands in one cell: its row is the true class, its column the predicted one. The diagonal holds the correct ones.`, actions: [{ do: 'create', target: T, effect: 'fade' }] }];
  classes.forEach((c, r) => {
    const total = M[r].reduce((s, v) => s + v, 0);
    const wrong = classes.map((d, j) => (j !== r && M[r][j] ? `${M[r][j]} as ${d}` : '')).filter(Boolean);
    beats.push({
      title: `Actual ${c}: ${total}`,
      narration: `Of the ${total} that really are ${c}, ${M[r][r]} ${M[r][r] === 1 ? 'was' : 'were'} predicted ${c}${wrong.length ? `; ${wrong.join(', ')}` : ' — none missed'}.`,
      actions: classes.map((_, j) => ({ do: 'set', target: cell(r, j), value: M[r][j] })),
    });
  });
  const acc = correct / n;
  let metrics = `accuracy = ${correct}/${n} = ${fmt(acc)}`;
  let narr = `Correct predictions sit on the diagonal: ${correct} of ${n}, accuracy ${fmt(acc)}.`;
  if (classes.length === 2) {
    const pos = ci.get(String(ctx.args.positive ?? classes[1]));
    if (pos === undefined) ctx.fail(`"positive" must be one of ${classes.join(', ')}`);
    const neg = 1 - pos!;
    const tp = M[pos!][pos!], fp = M[neg][pos!], fn = M[pos!][neg];
    const precision = tp / (tp + fp || NaN), recall = tp / (tp + fn || NaN);
    const f1 = (2 * precision * recall) / (precision + recall);
    metrics += `, precision = ${tp}/${tp + fp} = ${fmt(precision)}, recall = ${tp}/${tp + fn} = ${fmt(recall)}, F1 = ${fmt(f1)}`;
    narr += ` Taking ${classes[pos!]} as positive: precision ${tp}/${tp + fp} = ${fmt(precision)} (how many "${classes[pos!]}" calls were right), recall ${tp}/${tp + fn} = ${fmt(recall)} (how many real ${classes[pos!]} were found).`;
  } else {
    narr += ` Recall per class: ${classes.map((c, r) => `${c} ${M[r][r]}/${M[r].reduce((s, v) => s + v, 0)}`).join(', ')}.`;
  }
  const diag = classes.map((_, i) => cell(i, i));
  const off = classes.flatMap((_, r) => classes.map((__, c) => (r !== c && M[r][c] ? cell(r, c) : ''))).filter(Boolean);
  beats.push({ title: `Accuracy ${fmt(acc)}`, narration: narr, actions: [{ do: 'highlight', target: diag, state: 'found' }, ...(off.length ? [{ do: 'highlight', target: off.slice(0, 12), state: 'error' }] : []), { do: 'create', target: S, effect: 'fade' }] });
  return { beats, entities: [table, { id: S, type: 'text', text: metrics, role: 'caption' }], layout: [{ rel: 'below', id: S, of: T, gap: 'md' }], data: 'given' };
}

// ── linear regression ────────────────────────────────────────────────────────

function linearRegression(ctx: Ctx): Gen {
  const { illustrative } = pointsOf(ctx, { maxN: 40 });
  let { pts } = pointsOf(ctx, { maxN: 40 });
  if (illustrative) {
    // a line plus noise, from the seed: slope and intercept the lesson can recover
    const g = (ctx.args.generate ?? {}) as Loose;
    const r = rng(Math.round(num(g.seed) || 11));
    const slope = Number.isFinite(num(g.slope)) ? num(g.slope) : 1.5, icpt = Number.isFinite(num(g.intercept)) ? num(g.intercept) : 2;
    const n = Math.min(40, Math.max(5, Math.round(num(g.n) || 12)));
    pts = Array.from({ length: n }, (_, i) => { const x = r2(1 + (9 * i) / (n - 1)); return { x, y: r2(slope * x + icpt + r.normal() * (num(g.noise) || 1.2)) }; });
  }
  if (pts.length < 3) ctx.fail('at least 3 points');
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  if (sxx < 1e-12) ctx.fail('all points share one x: no line through them has a slope');
  const m = sxy / sxx, c = my - m * mx;
  const ssr = pts.reduce((s, p) => s + (p.y - (m * p.x + c)) ** 2, 0), sst = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const R2 = sst > 0 ? 1 - ssr / sst : 1;
  const sp = spaceFor(ctx, pts.map((p) => p.x), [...pts.map((p) => p.y), ...pts.map((p) => m * p.x + c)], { x: 'x', y: 'y' });
  const T = ctx.target, P = `${T}-points`, L = `${T}-fit`, S = `${T}-state`;
  const showRes = n <= 12;
  const res = showRes ? pts.map((p, i) => ({ id: `${T}-r${i}`, type: 'line', space: sp.id, from: [p.x, p.y], to: [p.x, m * p.x + c], dashed: true, tone: 'danger' })) : [];
  const note = illustrative ? noteFor(ctx, S) : null;
  const cap = caption(S, `y = ${fmt(m)}x ${c < 0 ? '−' : '+'} ${fmt(Math.abs(c))}, R² = ${fmt(R2)}`, { rel: 'below', id: S, of: sp.id, gap: 'md' });
  const beats: GenBeat[] = [
    { title: `${n} points`, narration: `${n} (x, y) pairs${illustrative ? ', generated for this lesson around a straight line with noise' : ''}. Which straight line fits them best?`, actions: [{ do: 'create', target: [P, ...(note ? [note.entity.id] : [])], effect: 'fade' }] },
    { title: 'Least squares', narration: `The best line makes the squared vertical gaps as small as possible. That has an exact answer: slope = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)² = ${fmt(sxy)} / ${fmt(sxx)} = ${fmt(m)}, intercept = ȳ − slope·x̄ = ${fmt(c)}.`, actions: [{ do: 'create', target: L, effect: 'draw' }] },
    ...(showRes ? [{ title: 'The gaps it minimises', narration: `Each dashed segment is one residual. Their squares add up to ${fmt(ssr)} — no other line does better.`, actions: [{ do: 'create', target: res.map((r) => r.id).slice(0, 12), effect: 'draw' }] }] : []),
    { title: `R² = ${fmt(R2)}`, narration: `R² = 1 − ${fmt(ssr)} / ${fmt(sst)} = ${fmt(R2)}: the line explains ${Math.round(R2 * 100)}% of the variation in y${illustrative ? ' (of this illustrative data)' : ''}.`, actions: [{ do: 'create', target: S, effect: 'fade' }, { do: 'highlight', target: L, state: 'found' }] },
  ];
  return {
    beats, spaces: sp.space ? [sp.space] : [],
    entities: [{ id: P, type: 'scatter', space: sp.id, points: pts.map((p) => ({ at: [p.x, p.y] })) }, { id: L, type: 'plot', space: sp.id, expr: `${Number(m.toPrecision(8))}*x + ${Number(c.toPrecision(8))}`, label: 'best fit', tone: 'accent' }, ...res, cap.entity, ...(note ? [note.entity] : [])],
    layout: [...(sp.space ? [{ rel: 'place', id: sp.id, region: 'center' }] : []), cap.layout, ...(note ? [note.layout] : [])],
    data: illustrative ? 'illustrative' : 'given',
  };
}

// ── perceptron ───────────────────────────────────────────────────────────────

function perceptron(ctx: Ctx): Gen {
  const { pts, illustrative } = pointsOf(ctx, { labelled: true, maxN: 40 });
  const labels = [...new Set(pts.map((p) => p.label!))].sort();
  if (labels.length !== 2) ctx.fail(`a perceptron separates two classes; the labels are ${labels.join(', ')}`);
  const yOf = (p: { label?: string }) => (p.label === labels[1] ? 1 : -1);
  const lr = num(ctx.args.lr ?? 1) || 1;
  const sp = spaceFor(ctx, pts.map((p) => p.x), pts.map((p) => p.y), { x: 'x₁', y: 'x₂' });
  const T = ctx.target, P = `${T}-points`, S = `${T}-state`;
  let w = [0, 0], b = 0;
  const lineFor = (id: string, tone: string): Loose | null => {
    // w1·x + w2·y + b = 0, clipped to the space
    const [x0, x1] = sp.ranges.x, [y0, y1] = sp.ranges.y;
    const cand: [number, number][] = [];
    if (Math.abs(w[1]) > 1e-9) for (const x of [x0, x1]) { const y = -(w[0] * x + b) / w[1]; if (y >= y0 && y <= y1) cand.push([x, y]); }
    if (Math.abs(w[0]) > 1e-9) for (const y of [y0, y1]) { const x = -(w[1] * y + b) / w[0]; if (x >= x0 && x <= x1) cand.push([x, y]); }
    const uniq = cand.filter((p, i) => cand.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) === i);
    if (uniq.length < 2) return null;
    return { id, type: 'line', space: sp.id, from: uniq[0].map(r2), to: uniq[1].map(r2), tone };
  };
  const note = illustrative ? noteFor(ctx, S) : null;
  const entities: Loose[] = [{ id: P, type: 'scatter', space: sp.id, points: [...pts].sort((a, c) => yOf(a) - yOf(c)).map((p) => ({ at: [p.x, p.y], cls: p.label })) }];
  const beats: GenBeat[] = [{ title: 'Two labelled classes', narration: `${pts.length} points labelled ${labels[0]} or ${labels[1]}${illustrative ? ' (generated for this lesson)' : ''}. A perceptron looks for a straight line w₁x₁ + w₂x₂ + b = 0 with each class on its own side.`, actions: [{ do: 'create', target: [P, S, ...(note ? [note.entity.id] : [])], effect: 'fade' }] }];
  let prevLine: string | null = null;
  let mistakesLast = -1;
  for (let ep = 1; ep <= 8; ep++) {
    let mistakes = 0;
    for (const p of pts) {
      const y = yOf(p);
      if (y * (w[0] * p.x + w[1] * p.y + b) <= 0) { w = [w[0] + lr * y * p.x, w[1] + lr * y * p.y]; b += lr * y; mistakes++; }
    }
    mistakesLast = mistakes;
    const id = `${T}-line${ep}`;
    const ln = lineFor(id, mistakes ? 'warning' : 'success');
    const acts: Act[] = [];
    if (prevLine) acts.push({ do: 'remove', target: prevLine, effect: 'fade' });
    if (ln) { entities.push(ln); acts.push({ do: 'create', target: id, effect: 'draw', ...(prevLine ? { with: 'previous' } : {}) }); prevLine = id; }
    acts.push({ do: 'set', target: S, text: `epoch ${ep}: ${mistakes} mistake${mistakes === 1 ? '' : 's'}, w = (${fmt(w[0])}, ${fmt(w[1])}), b = ${fmt(b)}` });
    const wb = `w = (${minus(fmt(w[0]))}, ${minus(fmt(w[1]))}), b = ${minus(fmt(b))}`;
    beats.push({ title: `Epoch ${ep}: ${mistakes} mistake${mistakes === 1 ? '' : 's'}`, narration: mistakes ? `${ep === 1 ? 'Go through the points; each one on the wrong side nudges the line towards it: w += label × point, b += label. ' : ''}${mistakes} nudge${mistakes === 1 ? '' : 's'} this pass; now ${wb}.` : `A full pass with no mistakes: every point is on its own side of ${wb}, so the perceptron stops.`, actions: acts });
    if (!mistakes) break;
  }
  if (mistakesLast) beats.push({ title: 'Still not separated', narration: `After 8 passes there are still ${mistakesLast} mistakes. If no straight line separates the classes, a perceptron never settles.`, actions: [{ do: 'highlight', target: P, state: 'error' }] });
  return {
    beats, spaces: sp.space ? [sp.space] : [],
    entities: [...entities, { id: S, type: 'text', text: 'w = (0, 0), b = 0', role: 'caption' }, ...(note ? [note.entity] : [])],
    layout: [...(sp.space ? [{ rel: 'place', id: sp.id, region: 'center' }] : []), { rel: 'below', id: S, of: sp.id, gap: 'md' }, ...(note ? [note.layout] : [])],
    data: illustrative ? 'illustrative' : 'given',
  };
}

export const ML_ALGORITHMS: Record<string, (ctx: Ctx) => Gen> = {
  gradientdescent: gradientDescent, gd: gradientDescent,
  kmeans: kmeans, kmeansclustering: kmeans,
  confusionmatrix: confusionMatrix,
  linearregression: linearRegression, leastsquares: linearRegression, regression: linearRegression,
  perceptron,
};
export const ML_NAMES = ['gradient-descent', 'k-means', 'confusion-matrix', 'linear-regression', 'perceptron'];
