/**
 * Domain checks — deterministic science/maths checks that run after the
 * structural validation of a scene.
 *
 * Each check owns one entity type and answers "is this drawing true?", not
 * "is this JSON well formed?" (validate.ts does that). Errors go back to the
 * model as repair instructions, so a plot that is never on screen or a carbon
 * with five bonds never reaches the learner. Adding a domain = adding an entry
 * to CHECKS; the validator and repair loop need no changes.
 */
import { checkCircuit, solveDC } from './circuits.js';
import { layoutCompartment } from './compartments.js';
import { checkLogic, checkTruthTable } from './logic.js';
import { checkMolecule, formulaMismatch, lonePairsOn, moleculePart, reactionBalance, type MolPart } from './chem.js';
import { compileExpr, curveFns, exprError, frameDistance, samplePlot, sampleCurve } from './expr.js';
import type { EntityT, SceneT, SpaceT } from './schema.js';

export type DomainIssue = { path: string; message: string; severity: 'error' | 'warning' };
type Ctx = { scene: SceneT; spaces: Map<string, SpaceT> };
type EntityOf<T extends EntityT['type']> = Extract<EntityT, { type: T }>;
type Check<T extends EntityT['type']> = { type: T; id: string; run: (e: EntityOf<T>, path: string, ctx: Ctx) => DomainIssue[] };

const scaleOpts = (space: SpaceT) => ({ xLog: space.xScale === 'log', yLog: space.yScale === 'log' });
/** How far a point may sit from its curve, as a share of the frame (about 6 px on a 400 px axis). */
const ON_CURVE = 0.015;
const fmtN = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(2) : String(Math.round(v * 1000) / 1000));

/** The drawn pieces of a plot or curve in domain units, or null if it can't be evaluated. */
function drawnSegments(e: EntityT, space: SpaceT): [number, number][][] | null {
  try {
    if (e.type === 'plot') return samplePlot(compileExpr(e.expr), (e.domain ?? space.x) as [number, number], space.y, scaleOpts(space)).segments;
    if (e.type === 'curve') {
      const c = curveFns(e);
      return sampleCurve(c.fx, c.fy, c.t, space.x, space.y, scaleOpts(space)).segments;
    }
  } catch { /* reported by the entity's own check */ }
  return null;
}

const plotOnScreen: Check<'plot'> = {
  type: 'plot',
  id: 'plot-on-screen',
  run(e, path, { spaces }) {
    const why = exprError(e.expr);
    if (why) return [{ path: `${path}.expr`, severity: 'error', message: `can't evaluate "${e.expr}": ${why}. Write a function of x with + - * / ^ ( ), numbers, pi, and sin cos tan sqrt exp ln log abs (angles in radians, or 45deg)` }];
    const space = spaces.get(e.space);
    if (!space || space.kind !== 'cartesian') return [];
    const domain = (e.domain ?? space.x) as [number, number];
    if (e.domain && e.domain[0] >= e.domain[1]) return []; // validate.ts reports it
    const s = samplePlot(compileExpr(e.expr), domain, space.y, scaleOpts(space));
    if (!s.segments.length) {
      return [{ path, severity: 'error', message: `"${e.id}" (${e.expr}) never appears inside space "${space.id}" (y from ${space.y[0]} to ${space.y[1]} over x ${domain[0]}…${domain[1]}) — compute a few values of the function and set the space's y range to contain them` }];
    }
    if (s.visible < 0.15) {
      return [{ path, severity: 'warning', message: `only ${Math.round(s.visible * 100)}% of "${e.id}" is inside the visible y range — the learner sees a short stub; widen the space's y range or narrow the domain` }];
    }
    return [];
  },
};

const moleculeStructure: Check<'molecule'> = {
  type: 'molecule',
  id: 'molecule-valence',
  run(e, path) {
    const issues: DomainIssue[] = checkMolecule(e, path);
    if (e.label) {
      const mismatch = formulaMismatch(e, e.label);
      if (mismatch) issues.push({ path: `${path}.label`, severity: 'error', message: mismatch });
    }
    return issues;
  },
};

const curveOnScreen: Check<'curve'> = {
  type: 'curve',
  id: 'curve-on-screen',
  run(e, path, { spaces }) {
    let c: ReturnType<typeof curveFns>;
    try { c = curveFns(e); } catch (err) {
      return [{ path, severity: 'error', message: `can't evaluate curve "${e.id}": ${(err as Error).message}. Write x and y as functions of t (or r as a function of θ), and t as numbers or constants like "2pi"` }];
    }
    const space = spaces.get(e.space);
    if (!space) return [];
    const s = sampleCurve(c.fx, c.fy, c.t, space.x, space.y, scaleOpts(space));
    if (!s.segments.length) return [{ path, severity: 'error', message: `curve "${e.id}" never appears inside space "${space.id}" (x ${space.x[0]}…${space.x[1]}, y ${space.y[0]}…${space.y[1]}) — evaluate it at a few t and size the space to contain it` }];
    if (s.visible < 0.5) return [{ path, severity: 'warning', message: `only ${Math.round(s.visible * 100)}% of curve "${e.id}" is inside space "${space.id}" — widen the space` }];
    return [];
  },
};

const areaBounds: Check<'area'> = {
  type: 'area',
  id: 'area-bounds',
  run(e, path, { scene, spaces }) {
    const plot = scene.entities.find((x) => x.id === e.plot);
    const space = spaces.get(e.space);
    if (!plot || plot.type !== 'plot' || !space) return [];
    const pd = (plot.domain ?? space.x) as [number, number];
    const d = e.domain ?? pd;
    if (d[0] < pd[0] - 1e-9 || d[1] > pd[1] + 1e-9) return [{ path: `${path}.domain`, severity: 'error', message: `the area runs over x ${d[0]}…${d[1]} but "${plot.id}" is only drawn over ${pd[0]}…${pd[1]}` }];
    if (typeof e.to === 'number' && (e.to < space.y[0] || e.to > space.y[1])) return [{ path: `${path}.to`, severity: 'warning', message: `y = ${e.to} is outside the space; the shading is cut at its edge` }];
    return [];
  },
};

const reflineInside: Check<'refline'> = {
  type: 'refline',
  id: 'refline-inside',
  run(e, path, { spaces }) {
    const space = spaces.get(e.space);
    if (!space) return [];
    const [v, r, axis] = e.x !== undefined ? [e.x, space.x, 'x'] as const : [e.y!, space.y, 'y'] as const;
    if (v < r[0] || v > r[1]) return [{ path, severity: 'error', message: `${axis} = ${v} is outside space "${space.id}" (${axis} from ${r[0]} to ${r[1]}) — the line would not be seen` }];
    return [];
  },
};

const LABEL_EXTREMUM = /\b(max(imum)?|min(imum)?|vertex|apex|peak|turning|highest|lowest)\b/i;
const LABEL_ROOT = /\b(roots?|zeros?|x-intercepts?)\b/i;
const LABEL_ON = /\b(intercepts?|intersections?|crosses|meets|half-life|halfway)\b/i;

/**
 * A point named as a root, a maximum, an intercept… (or given "on") must sit
 * on its curve — and a maximum/minimum/vertex must be a turning point.
 * Models round and guess these values; the curve itself is the authority.
 */
const pointOnCurve: Check<'point'> = {
  type: 'point',
  id: 'point-on-curve',
  run(e, path, { scene, spaces }) {
    const space = spaces.get(e.space);
    if (!space) return [];
    const label = e.label ?? '';
    const claimsOn = !!e.on || LABEL_EXTREMUM.test(label) || LABEL_ROOT.test(label) || LABEL_ON.test(label);
    if (!claimsOn) return [];
    const curves = scene.entities.filter((x) => (x.type === 'plot' || x.type === 'curve') && x.space === e.space && (!e.on || x.id === e.on));
    if (!curves.length) return [];
    const at = e.at as [number, number];
    // off the axes, the drawn curve is clipped there: "outside space" (insideSpace) is the real message
    if (at[0] < space.x[0] || at[0] > space.x[1] || at[1] < space.y[0] || at[1] > space.y[1]) return [];
    let best: { c: EntityT; d: number } | null = null;
    for (const c of curves) {
      const segs = drawnSegments(c, space);
      if (!segs) continue;
      const d = frameDistance(at, segs, space.x, space.y, scaleOpts(space));
      if (!best || d < best.d) best = { c, d };
    }
    if (!best) return [];
    const what = e.on ? `"on": "${e.on}"` : `its label "${label}"`;
    if (best.d > ON_CURVE) {
      const hints = curves.filter((c): c is EntityOf<'plot'> => c.type === 'plot').map((c) => `${c.id}(${fmtN(at[0])}) = ${fmtN(compileExpr(c.expr)(at[0]))}`);
      return [{ path: `${path}.at`, severity: 'error', message: `point "${e.id}" at [${at.map(fmtN).join(', ')}] is not on ${e.on ? `"${e.on}"` : 'any curve in its space'}, though ${what} says it is${hints.length ? ` — ${hints.join('; ')}` : ''}. Compute the point from the function` }];
    }
    if (best.c.type !== 'plot') return [];
    const plot = best.c;
    const f = compileExpr(plot.expr);
    const ySpan = space.y[1] - space.y[0];
    if (LABEL_ROOT.test(label) && space.yScale !== 'log' && Math.abs(f(at[0])) > ON_CURVE * ySpan) {
      return [{ path: `${path}.at`, severity: 'error', message: `point "${e.id}" is labelled a root but ${plot.id}(${fmtN(at[0])}) = ${fmtN(f(at[0]))}, not 0` }];
    }
    if (LABEL_EXTREMUM.test(label)) {
      const dom = (plot.domain ?? space.x) as [number, number];
      const h = (dom[1] - dom[0]) * 0.01;
      if (at[0] - h > dom[0] && at[0] + h < dom[1]) {
        const y = f(at[0]), l = f(at[0] - h), r = f(at[0] + h);
        const tol = Math.abs(ySpan) * 1e-4;
        const turning = (l <= y + tol && r <= y + tol) || (l >= y - tol && r >= y - tol);
        if (!turning) {
          // where the curve really turns: a slope sign change in a fine scan
          const N = 400;
          let found: number | null = null;
          for (let i = 1; i < N - 1 && found === null; i++) {
            const xs = [i - 1, i, i + 1].map((k) => dom[0] + ((dom[1] - dom[0]) * k) / (N - 1));
            const [a, b, c] = xs.map(f);
            if (![a, b, c].every(Number.isFinite) || (b - a) * (c - b) >= 0) continue;
            // narrow it down (ternary search on the bracket) so the repair hint is exact
            const isMax = b > a;
            let lo = xs[0], hi = xs[2];
            for (let k = 0; k < 60; k++) {
              const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
              if ((f(m1) < f(m2)) === isMax) lo = m1; else hi = m2;
            }
            found = (lo + hi) / 2;
          }
          return [{ path: `${path}.at`, severity: 'error', message: `point "${e.id}" is labelled "${label}" but ${plot.id} is not turning at x = ${fmtN(at[0])}${found !== null ? ` — it turns at x ≈ ${fmtN(found)}, y ≈ ${fmtN(f(found))}` : ' (it has no turning point in its domain)'}` }];
        }
      }
    }
    return [];
  },
};

/** A dot or body drawn outside its space is off the axes (or off the board); the learner never sees it where it should be. */
const insideSpace = (type: 'point' | 'body'): Check<'point' | 'body'> => ({
  type,
  id: `${type}-inside-space`,
  run(e, path, { spaces }) {
    const space = spaces.get(e.space);
    if (!space) return [];
    const [x, y] = e.at as [number, number];
    const out = (v: number, [a, b]: [number, number]) => v < a - (b - a) * 0.03 || v > b + (b - a) * 0.03;
    if (!out(x, space.x as [number, number]) && !out(y, space.y as [number, number])) return [];
    return [{ path: `${path}.at`, severity: 'error', message: `"${e.id}" at [${fmtN(x)}, ${fmtN(y)}] is outside space "${space.id}" (x ${space.x[0]}…${space.x[1]}, y ${space.y[0]}…${space.y[1]}) — move it or widen the space` }];
  },
});

/** Atoms and charge are conserved: the reaction balances with its coefficients. */
const reactionBalances: Check<'reaction'> = {
  type: 'reaction',
  id: 'reaction-balance',
  run(e, path, { scene }) {
    const side = (list: typeof e.reactants) => list.map((r) => {
      const id = typeof r === 'string' ? r : r.id;
      const mol = scene.entities.find((x) => x.id === id);
      return mol?.type === 'molecule' ? { mol, n: typeof r === 'string' ? 1 : r.n, id } : null;
    });
    const left = side(e.reactants), right = side(e.products);
    if ([...left, ...right].some((x) => !x)) return []; // validate.ts reports the bad reference
    const why = reactionBalance(left as NonNullable<typeof left[number]>[], right as NonNullable<typeof right[number]>[]);
    return why ? [{ path, severity: 'error', message: why }] : [];
  },
};

/**
 * Electron-pushing arrows mean something: electrons leave a lone pair or a
 * bond (an atom only for a single electron) and arrive at an atom or a bond.
 */
const curlyArrows: Check<'curly'> = {
  type: 'curly',
  id: 'curly-arrow-semantics',
  run(e, path, { scene }) {
    const resolve = (ref: string): { mol: Extract<EntityT, { type: 'molecule' }>; part: MolPart } | 'not-molecule' | null => {
      const dot = ref.indexOf('.');
      if (dot < 0) return 'not-molecule';
      const ent = scene.entities.find((x) => x.id === ref.slice(0, dot));
      if (!ent) return null;
      if (ent.type !== 'molecule') return 'not-molecule';
      const part = moleculePart(ent, ref.slice(dot + 1));
      return part ? { mol: ent, part } : null;
    };
    const from = resolve(e.from), to = resolve(e.to);
    const out: DomainIssue[] = [];
    const name = (r: { mol: { atoms: { el: string; id?: string }[] } }, i: number) => `${r.mol.atoms[i].el}${r.mol.atoms[i].id ? ` "${r.mol.atoms[i].id}"` : ''}`;
    if (from === 'not-molecule') out.push({ path: `${path}.from`, severity: 'error', message: 'a curly arrow starts inside a molecule: "mol.lp-O" (a lone pair) or "mol.C1-Br" (a bond)' });
    if (to === 'not-molecule') out.push({ path: `${path}.to`, severity: 'error', message: 'a curly arrow ends at an atom "mol.C1" or a bond "mol.C1-C2" of a molecule' });
    if (from && from !== 'not-molecule') {
      if (from.part.kind === 'atom' && e.electrons === 2) {
        const i = from.part.i;
        out.push({ path: `${path}.from`, severity: 'error', message: `electrons move from a lone pair or a bond, not from an atom — ${lonePairsOn(from.mol, i) ? `use "${e.from.split('.')[0]}.lp-${from.mol.atoms[i].id}"` : `${name(from, i)} has no lone pair declared (add "lonePairs") — or start at one of its bonds`}` });
      }
      if (from.part.kind === 'lp' && !lonePairsOn(from.mol, from.part.i)) {
        out.push({ path: `${path}.from`, severity: 'error', message: `${name(from, from.part.i)} has no lone pair: declare it in "lonePairs" (or give the atom its negative charge)` });
      }
    }
    if (to && to !== 'not-molecule' && to.part.kind === 'lp') {
      out.push({ path: `${path}.to`, severity: 'error', message: 'electrons arrive at an atom (a new bond or a new lone pair there) or at a bond (it becomes a double bond) — not at a lone pair' });
    }
    if (from && to && from !== 'not-molecule' && to !== 'not-molecule' && from.mol === to.mol && from.part.kind === 'lp' && to.part.kind === 'atom' && from.part.i === to.part.i) {
      out.push({ path, severity: 'error', message: 'an arrow from an atom\'s own lone pair back to that atom moves nothing' });
    }
    return out;
  },
};

/**
 * Biology that a diagram must not contradict: structures that a kind of cell
 * doesn't have, structures that only exist inside another, and (warnings) the
 * structures that define the kind of cell being drawn. Matched on the labels
 * the model wrote, so they apply to any diagram, not to stored pictures.
 */
const KINDS: { kind: RegExp; name: string; forbid: [RegExp, string][]; expect: [RegExp, string][] }[] = [
  {
    kind: /\b(prokaryot\w*|bacteri\w*|e\.? ?coli|archae\w*)\b/i, name: 'a prokaryotic cell',
    forbid: [
      [/\bnucleus\b|\bnuclear\b/i, 'has no nucleus — its DNA lies in the nucleoid'],
      [/\bmitochondri\w*/i, 'has no mitochondria'], [/\bchloroplasts?\b/i, 'has no chloroplasts'],
      [/\bendoplasmic|\b(rough|smooth) er\b|\bgolgi\b|\blysosomes?\b/i, 'has no membrane-bound organelles'],
    ],
    expect: [[/\bnucleoid\b|\bdna\b|\bchromosome\b/i, 'its DNA (nucleoid)'], [/\bribosomes?\b/i, 'ribosomes'], [/\bmembrane\b/i, 'a cell membrane']],
  },
  {
    kind: /\banimal cell\b|\b(human|muscle|nerve|liver|blood) cell\b|\bneurons?\b/i, name: 'an animal cell',
    forbid: [[/\bcell wall\b/i, 'has no cell wall'], [/\bchloroplasts?\b/i, 'has no chloroplasts'], [/\bcentral vacuole\b/i, 'has no large central vacuole']],
    expect: [[/\bnucleus\b/i, 'a nucleus'], [/\bmembrane\b/i, 'a cell membrane']],
  },
  {
    kind: /\bplant cell\b|\b(leaf|mesophyll|palisade|guard) cell\b/i, name: 'a plant cell',
    forbid: [[/\bcentrioles?\b/i, 'has no centrioles']],
    expect: [[/\bcell wall\b/i, 'a cell wall'], [/\bchloroplasts?\b/i, 'chloroplasts'], [/\bvacuole\b/i, 'a vacuole'], [/\bnucleus\b/i, 'a nucleus'], [/\bmembrane\b/i, 'a cell membrane']],
  },
];
/** Structures that only exist inside another one. */
const INSIDE: [RegExp, RegExp, string][] = [
  [/\bnucleolus\b/i, /\bnucleus\b/i, 'the nucleus'],
  [/\bchromatin\b/i, /\bnucleus\b|\bnucleoid\b/i, 'the nucleus'],
  [/\bcristae?\b/i, /\bmitochondri\w*/i, 'a mitochondrion'],
  [/\bthylakoids?\b|\bgran(a|um)\b|\bstroma\b/i, /\bchloroplasts?\b/i, 'a chloroplast'],
  [/\bmatrix\b/i, /\bmitochondri\w*/i, 'a mitochondrion'],
];

const compartmentDiagram: Check<'compartment'> = {
  type: 'compartment',
  id: 'compartment-labels-and-structure',
  run(e, path) {
    const out: DomainIssue[] = [];
    // label coverage: every part labelled once, every label placed beside the diagram with its own leader
    const seen = new Map<string, number>();
    e.parts.forEach((p, k) => {
      const key = p.label.trim().toLowerCase();
      if (seen.has(key)) out.push({ path: `${path}.parts[${k}].label`, severity: 'error', message: `"${p.label}" labels two parts (parts[${seen.get(key)}] too) — draw copies with "count", or name them apart` });
      else seen.set(key, k);
    });
    const lay = layoutCompartment(e);
    lay.issues.forEach((m) => out.push({ path, severity: 'error', message: m }));
    const placed = new Set(lay.leaders.map((l) => l.id));
    e.parts.forEach((p, k) => { if (!placed.has(p.id) && !lay.issues.length) out.push({ path: `${path}.parts[${k}]`, severity: 'error', message: `"${p.label}" has no label on the diagram` }); });

    // structure: what the kind of cell can't have, and what must sit inside what
    const whole = `${e.label ?? ''} ${e.id}`;
    const kind = KINDS.find((k) => k.kind.test(whole));
    if (kind) {
      e.parts.forEach((p, k) => {
        const bad = kind.forbid.find(([re]) => re.test(p.label));
        if (bad) out.push({ path: `${path}.parts[${k}]`, severity: 'error', message: `"${e.label ?? e.id}" is ${kind.name}, which ${bad[1]} — remove "${p.label}"` });
      });
      for (const [re, what] of kind.expect) {
        if (!e.parts.some((p) => re.test(p.label))) out.push({ path: `${path}.parts`, severity: 'warning', message: `${kind.name} is usually drawn with ${what} — add it unless the lesson leaves it out on purpose` });
      }
    }
    const byId = new Map(e.parts.map((p) => [p.id, p]));
    e.parts.forEach((p, k) => {
      const rule = INSIDE.find(([re]) => re.test(p.label));
      if (!rule) return;
      // any ancestor may be the container (a nucleolus inside the nucleus inside the cell)
      let ok = false;
      for (let up = p.in; up && byId.has(up); up = byId.get(up)!.in) if (rule[1].test(byId.get(up)!.label)) { ok = true; break; }
      if (!ok) out.push({ path: `${path}.parts[${k}].in`, severity: 'error', message: `"${p.label}" is inside ${rule[2]} — set "in" to that part` });
    });
    return out;
  },
};

/** A circuit must be closed, not short a battery, and have one consistent solution. */
const circuitSound: Check<'circuit'> = {
  type: 'circuit',
  id: 'circuit-solvable',
  run(e, path) {
    const issues = checkCircuit(e);
    if (issues.length) return issues.map((i) => ({ path: i.comp ? `${path}.components[${e.components.findIndex((c) => c.id === i.comp)}]` : path, severity: 'error' as const, message: i.message }));
    try { solveDC(e); } catch (err) { return [{ path, severity: 'error', message: (err as Error).message }]; }
    return [];
  },
};

/** A logic circuit must be wired up and loop-free; any truth table in the scene for it must match. */
const logicSound: Check<'logic'> = {
  type: 'logic',
  id: 'logic-and-truth-tables',
  run(e, path, { scene }) {
    const issues: DomainIssue[] = checkLogic(e).map((message) => ({ path, severity: 'error', message }));
    if (issues.length) return issues;
    scene.entities.forEach((t, i) => {
      if (t.type !== 'table' || !t.columns) return;
      for (const m of checkTruthTable(e, t.columns, t.rows)) issues.push({ path: `entities[${i}].rows`, severity: 'error', message: `truth table "${t.id}" disagrees with "${e.id}": ${m}` });
    });
    return issues;
  },
};

const CHECKS = [plotOnScreen, curveOnScreen, areaBounds, reflineInside, pointOnCurve, insideSpace('point'), insideSpace('body'), moleculeStructure, reactionBalances, curlyArrows, compartmentDiagram, circuitSound, logicSound] as Check<EntityT['type']>[];

/** Every domain check that applies to the scene's entities. */
export function runDomainChecks(scene: SceneT): DomainIssue[] {
  const ctx: Ctx = { scene, spaces: new Map(scene.spaces.map((s) => [s.id, s])) };
  const out: DomainIssue[] = [];
  scene.entities.forEach((e, i) => {
    for (const c of CHECKS) if (c.type === e.type) out.push(...c.run(e, `entities[${i}]`, ctx));
  });
  return out;
}

/** The checks that exist, by entity type — for docs and the capability report. */
export const DOMAIN_CHECKS = CHECKS.map((c) => ({ id: c.id, type: c.type }));
