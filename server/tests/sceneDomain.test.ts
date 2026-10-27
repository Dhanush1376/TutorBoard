import { describe, expect, it } from 'vitest';
import { checkMolecule, findRings, formulaMismatch, formulaOf, maxBonds, parseFormula, type Mol } from '../engine/scene/chem.js';
import { DOMAIN_CHECKS } from '../engine/scene/domainChecks.js';
import { compileExpr, constantOf, curveFns, exprError, frameDistance, sampleCurve, samplePlot } from '../engine/scene/expr.js';
import { validateScene } from '../engine/scene/index.js';

// ── molecules built from connectivity, the way the model writes them ──
const C = (n: number) => Array.from({ length: n }, () => ({ el: 'C' }));
const H = (n: number) => Array.from({ length: n }, () => ({ el: 'H' }));
/** Benzene in Kekulé form; atoms 0–5 ring carbons, 6–11 hydrogens. */
const benzene = (): Mol => ({
  atoms: [...C(6), ...H(6)],
  bonds: [
    [0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1],
    ...Array.from({ length: 6 }, (_, i) => [i, 6 + i, 1] as [number, number, number]),
  ],
});
/** Toluene: benzene with CH₃ on ring carbon 1 instead of its hydrogen. */
const toluene = (): Mol => {
  const m = benzene();
  m.bonds = m.bonds.filter(([a, b]) => !(a === 1 && b === 7));
  m.atoms[7] = { el: 'C' }; // the old H on C1 becomes the methyl carbon
  m.bonds.push([1, 7, 1]);
  m.atoms.push(...H(3));
  m.bonds.push([7, 12, 1], [7, 13, 1], [7, 14, 1]);
  return m;
};

describe('safe expressions', () => {
  it('evaluates the forms models write, degrees included', () => {
    expect(compileExpr('x*tan(45deg) - 9.8*x^2/(2*20^2*cos(45deg)^2)')(10)).toBeCloseTo(10 - 9.8 * 100 / 400, 6);
    expect(compileExpr('2(x+1)(x-3)')(2)).toBe(-6);
    expect(compileExpr('sin(30°)')(0)).toBeCloseTo(0.5, 9);
    expect(compileExpr('πx')(1)).toBeCloseTo(Math.PI, 9);
    expect(compileExpr('y = -x^2')(3)).toBe(-9); // unary minus binds looser than ^
  });

  it('rejects what it cannot evaluate instead of drawing nothing', () => {
    expect(exprError('x +* 2')).toMatch(/operand/);
    expect(exprError('sin(x')).toMatch(/unbalanced/);
    expect(exprError('alert(1)')).toMatch(/unknown symbol/);
    expect(exprError('θ*2')).toMatch(/unexpected/);
    expect(exprError('x^2 + 1')).toBeNull();
  });

  it('breaks tan x at its poles instead of joining +∞ to −∞', () => {
    const s = samplePlot(compileExpr('tan(x)'), [-4, 4], [-6, 6]);
    // poles at ±π/2 inside [-4, 4]: three visible branches
    expect(s.segments.length).toBe(3);
    for (const b of [-Math.PI / 2, Math.PI / 2]) expect(s.breaks.some((x) => Math.abs(x - b) < 1e-3)).toBe(true);
    // no straight line across a pole: consecutive points in a segment never jump by most of the frame
    for (const seg of s.segments) for (let i = 1; i < seg.length; i++) expect(Math.abs(seg[i][1] - seg[i - 1][1])).toBeLessThan(6);
  });

  it('breaks jumps (floor) and reaches the frame edge where a curve leaves it', () => {
    const f = samplePlot(compileExpr('floor(x)'), [0, 3], [-1, 4]);
    expect(f.segments.length).toBe(3);
    const p = samplePlot(compileExpr('x^2'), [-3, 3], [0, 4]);
    const ys = p.segments.flat().map(([, y]) => y);
    expect(Math.max(...ys)).toBeCloseTo(4.08, 6); // cut at the edge (2% margin), not stopping a sample short
    expect(p.visible).toBeCloseTo(4 / 6, 1);
  });

  it('leaves a smooth curve in one piece', () => {
    expect(samplePlot(compileExpr('sin(x)'), [0, 10], [-1.5, 1.5]).segments.length).toBe(1);
  });
});

describe('chemistry', () => {
  it('derives valence from the group and the formal charge', () => {
    expect(maxBonds('C')).toBe(4);
    expect(maxBonds('N')).toBe(3);
    expect(maxBonds('N', 1)).toBe(4); // NH₄⁺
    expect(maxBonds('O', -1)).toBe(1); // OH⁻
    expect(maxBonds('O', 1)).toBe(3); // H₃O⁺
    expect(maxBonds('C', 1)).toBe(3); // carbocation
    expect(maxBonds('S')).toBe(6); // SF₆: period 3 may expand its octet
    expect(maxBonds('Cl', -1)).toBe(0);
    expect(maxBonds('Fe')).toBeNull(); // coordination varies: no rule
  });

  it('accepts benzene and toluene, and finds their one ring', () => {
    expect(checkMolecule(benzene(), 'm')).toEqual([]);
    expect(checkMolecule(toluene(), 'm')).toEqual([]);
    expect(findRings(12, benzene().bonds)).toEqual([expect.arrayContaining([0, 1, 2, 3, 4, 5])]);
    expect(formulaOf(benzene())).toBe('C6H6');
    expect(formulaOf(toluene())).toBe('C7H8');
  });

  it('rejects a carbon with five bonds (two double bonds next to each other in a ring)', () => {
    const m = benzene();
    m.bonds[1] = [1, 2, 2]; // C1 now has =C0, =C2 and –H
    const issues = checkMolecule(m, 'entities[0]');
    expect(issues.filter((i) => i.severity === 'error').map((i) => i.path)).toContain('entities[0].atoms[1]');
    expect(issues[0].message).toMatch(/5 bonds .* at most 4/);
  });

  it('asks for a charge on a four-bonded nitrogen, and accepts it with one', () => {
    const nh4: Mol = { atoms: [{ el: 'N' }, ...H(4)], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] };
    expect(checkMolecule(nh4, 'm')[0].message).toMatch(/charge/);
    nh4.atoms[0].charge = 1;
    expect(checkMolecule(nh4, 'm')).toEqual([]);
    expect(formulaOf(nh4)).toBe('H4N+');
  });

  it('flags duplicate bonds and missing hydrogens', () => {
    const m: Mol = { atoms: [{ el: 'C' }, ...H(3)], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 0, 1]] };
    const issues = checkMolecule(m, 'm');
    expect(issues.some((i) => i.severity === 'error' && /already bonded/.test(i.message))).toBe(true);
    const methyl: Mol = { atoms: [{ el: 'C' }, ...H(3)], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] };
    expect(checkMolecule(methyl, 'm')).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringMatching(/missing hydrogens/) })]);
  });

  it('finds the two rings of naphthalene, not the 10-atom envelope', () => {
    // two fused hexagons sharing the 0–5 bond
    const bonds: [number, number, number][] = [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1], [5, 6, 1], [6, 7, 1], [7, 8, 1], [8, 9, 1], [9, 0, 1]];
    const rings = findRings(10, bonds);
    expect(rings.map((r) => r.length).sort()).toEqual([6, 6]);
  });

  it('reads formula labels and compares them with the drawing', () => {
    expect(parseFormula('H₂O')?.counts.get('H')).toBe(2);
    expect(parseFormula('SO4^2-')?.charge).toBe(-2);
    expect(parseFormula('SO₄²⁻')?.counts.get('O')).toBe(4);
    expect(parseFormula('SO₄²⁻')?.charge).toBe(-2);
    expect(parseFormula('NH4+')?.counts.get('H')).toBe(4);
    expect(parseFormula('NH4+')?.charge).toBe(1);
    expect(parseFormula('Ca(OH)2')?.counts.get('O')).toBe(2);
    expect(parseFormula('Benzene')).toBeNull();
    expect(formulaMismatch(toluene(), 'C6H5CH3')).toBeNull();
    expect(formulaMismatch(benzene(), 'C6H5CH3')).toMatch(/C: label 7, drawn 6/);
  });
});

/** A one-beat scene around one entity. */
const sceneWith = (entity: object, spaces: object[] = []) => ({
  version: '1', title: 'Test', domain: 'chemistry', spaces,
  entities: [entity],
  beats: [{ title: 'Show', narration: 'Look.', actions: [{ do: 'create', target: (entity as { id: string }).id }] }],
});

describe('domain checks in validateScene', () => {
  it('registers a check per covered entity type', () => {
    expect(DOMAIN_CHECKS.map((c) => c.type).sort()).toEqual(['area', 'body', 'circuit', 'compartment', 'curly', 'curve', 'logic', 'molecule', 'plot', 'point', 'point', 'reaction', 'refline']);
  });

  it('passes a correct toluene and sends a broken ring back for repair', () => {
    const ok = validateScene(sceneWith({ id: 'tol', type: 'molecule', label: 'C7H8', ...toluene() }));
    expect(ok.ok).toBe(true);
    const bad = toluene();
    bad.bonds[0] = [0, 1, 3]; // triple bond inside the ring
    const r = validateScene(sceneWith({ id: 'tol', type: 'molecule', ...bad }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path.startsWith('entities[0].atoms['))).toBe(true);
  });

  it('keeps formal charges through validation', () => {
    const r = validateScene(sceneWith({ id: 'ion', type: 'molecule', atoms: [{ el: 'O', charge: -1 }, { el: 'H' }], bonds: [[0, 1, 1]] }));
    expect(r.ok).toBe(true);
    if (r.ok && r.scene.entities[0].type === 'molecule') expect(r.scene.entities[0].atoms[0].charge).toBe(-1);
  });

  it('rejects a plot that is never on screen, and one it cannot evaluate', () => {
    const space = { id: 'ax', kind: 'cartesian', x: [0, 10], y: [0, 5] };
    const off = validateScene(sceneWith({ id: 'f', type: 'plot', space: 'ax', expr: 'x + 100' }, [space]));
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.errors[0].message).toMatch(/never appears inside space "ax"/);
    const bad = validateScene(sceneWith({ id: 'f', type: 'plot', space: 'ax', expr: 'sin(θ)' }, [space]));
    expect(bad.ok).toBe(false);
    const fine = validateScene(sceneWith({ id: 'f', type: 'plot', space: 'ax', expr: 'x*tan(30deg)' }, [space]));
    expect(fine.ok).toBe(true);
  });
});

// ── Phase 2: plotting ──
const space = (extra: object = {}) => ({ id: 'ax', kind: 'cartesian', x: [-1, 5], y: [-2, 10], ...extra });
/** A scene with entities in one space, all created in one beat. */
const plotScene = (entities: object[], sp: object = space()) => ({
  version: '1', title: 'Plot', domain: 'math', spaces: [sp], entities,
  beats: [{ title: 'Show', narration: 'Look.', actions: [{ do: 'create', target: entities.map((e) => (e as { id: string }).id) }] }],
});
const errs = (input: unknown) => { const r = validateScene(input); return r.ok ? [] : r.errors.map((e) => e.message); };
const parabola = { id: 'f', type: 'plot', space: 'ax', expr: '(x-2)^2 - 1' }; // vertex (2, -1), roots 1 and 3

describe('plotting: sampling', () => {
  it('evaluates t and θ for parametric and polar forms, and constants like 2pi', () => {
    expect(compileExpr('cos(t)', 't')(0)).toBe(1);
    expect(compileExpr('1 + cos(θ)', 't')(0)).toBe(2);
    expect(compileExpr('2theta', 't')(1)).toBe(2);
    expect(exprError('t + 1')).toMatch(/unknown symbol/); // t is not a variable of y = f(x)
    expect(constantOf('2pi')).toBeCloseTo(2 * Math.PI, 12);
    expect(() => constantOf('x + 1')).toThrow(/constant/);
  });

  it('samples a log axis in log units, so a decay is smooth and stays exact', () => {
    const s = samplePlot(compileExpr('100*0.5^(x/10)'), [0, 50], [1, 200], { yLog: true });
    expect(s.segments.length).toBe(1);
    const seg = s.segments[0];
    expect(seg[seg.length - 1][1]).toBeCloseTo(100 * 0.5 ** 5, 3);
    // y ≤ 0 has no place on a log axis: the curve breaks rather than drawing junk
    expect(samplePlot(compileExpr('x'), [-5, 5], [0.1, 10], { yLog: true }).segments.every((g) => g.every(([x]) => x > 0))).toBe(true);
  });

  it('closes the unit circle and draws a cardioid through (2, 0)', () => {
    const c = curveFns({ x: 'cos(t)', y: 'sin(t)', t: [0, '2pi'] });
    const s = sampleCurve(c.fx, c.fy, c.t, [-1.5, 1.5], [-1.5, 1.5]);
    expect(s.segments.length).toBe(1);
    const seg = s.segments[0];
    expect(Math.hypot(seg[0][0] - seg[seg.length - 1][0], seg[0][1] - seg[seg.length - 1][1])).toBeLessThan(1e-9);
    for (const [x, y] of seg) expect(Math.hypot(x, y)).toBeCloseTo(1, 6);
    const p = curveFns({ r: '1 + cos(θ)', t: [0, '2pi'] });
    const ps = sampleCurve(p.fx, p.fy, p.t, [-1, 2.5], [-1.6, 1.6]);
    expect(frameDistance([2, 0], ps.segments, [-1, 2.5], [-1.6, 1.6])).toBeLessThan(1e-6);
  });

  it('clips a curve at the frame instead of drawing outside it', () => {
    const c = curveFns({ x: 't', y: 't^2', t: [-3, 3] });
    const s = sampleCurve(c.fx, c.fy, c.t, [-3, 3], [0, 4]);
    for (const seg of s.segments) for (const [, y] of seg) expect(y).toBeLessThanOrEqual(4 + 4 * 0.02 + 1e-9);
    expect(s.visible).toBeLessThan(1);
  });
});

describe('plotting: checks in validateScene', () => {
  it('accepts a correctly placed vertex and roots', () => {
    expect(errs(plotScene([parabola,
      { id: 'v', type: 'point', space: 'ax', at: [2, -1], label: 'vertex' },
      { id: 'r1', type: 'point', space: 'ax', at: [1, 0], label: 'root' },
      { id: 'r2', type: 'point', space: 'ax', at: [3, 0], label: 'x-intercept' }]))).toEqual([]);
  });

  it('sends a guessed vertex back with where the curve really turns', () => {
    const e = errs(plotScene([{ ...parabola, expr: '(x-2.4)^2 - 1' }, { id: 'v', type: 'point', space: 'ax', at: [2, -0.84], label: 'vertex' }]));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/not turning at x = 2 — it turns at x ≈ 2\.4/);
  });

  it('rejects a labelled root that is off the curve, with the function value', () => {
    const e = errs(plotScene([parabola, { id: 'r', type: 'point', space: 'ax', at: [1.5, 0], label: 'root' }]));
    expect(e[0]).toMatch(/not on any curve .* f\(1\.5\) = -0\.75/);
  });

  it('checks "on" against the named curve only', () => {
    const g = { id: 'g', type: 'plot', space: 'ax', expr: 'x' };
    expect(errs(plotScene([parabola, g, { id: 'p', type: 'point', space: 'ax', at: [3, 3], on: 'g' }]))).toEqual([]);
    expect(errs(plotScene([parabola, g, { id: 'p', type: 'point', space: 'ax', at: [3, 0], on: 'g' }]))[0]).toMatch(/not on "g"/);
    expect(errs(plotScene([parabola, { id: 'p', type: 'point', space: 'ax', at: [0, 0], on: 'nope' }]))[0]).toMatch(/not an entity/);
  });

  it('leaves unlabelled points alone', () => {
    expect(errs(plotScene([parabola, { id: 'p', type: 'point', space: 'ax', at: [4, 8], label: 'P' }]))).toEqual([]);
  });

  it('validates curves: one form, a usable t range, on screen', () => {
    expect(errs(plotScene([{ id: 'c', type: 'curve', space: 'ax', x: 'cos(t)', y: 'sin(t)', t: [0, '2pi'] }]))).toEqual([]);
    expect(errs(plotScene([{ id: 'c', type: 'curve', space: 'ax', x: 'cos(t)', y: 'sin(t)', r: '1', t: [0, 1] }]))[0]).toMatch(/not both/);
    expect(errs(plotScene([{ id: 'c', type: 'curve', space: 'ax', r: '2', t: ['2pi', 0] }]))[0]).toMatch(/start < end/);
    expect(errs(plotScene([{ id: 'c', type: 'curve', space: 'ax', x: 't + 50', y: 't', t: [0, 1] }]))[0]).toMatch(/never appears/);
  });

  it('validates areas and reference lines', () => {
    expect(errs(plotScene([parabola, { id: 'a', type: 'area', space: 'ax', plot: 'f', domain: [1, 3] }]))).toEqual([]);
    expect(errs(plotScene([{ ...parabola, domain: [0, 4] }, { id: 'a', type: 'area', space: 'ax', plot: 'f', domain: [1, 5] }]))[0]).toMatch(/only drawn over 0…4/);
    expect(errs(plotScene([parabola, { id: 'a', type: 'area', space: 'ax', plot: 'r' }, { id: 'r', type: 'refline', space: 'ax', y: 2 }]))[0]).toMatch(/bounded by plots/);
    expect(errs(plotScene([{ id: 'r', type: 'refline', space: 'ax', y: 50 }]))[0]).toMatch(/outside space/);
    expect(errs(plotScene([{ id: 'r', type: 'refline', space: 'ax', x: 1, y: 2 }]))[0]).toMatch(/exactly one/);
  });

  it('requires a positive range on a log axis', () => {
    expect(errs(plotScene([parabola], space({ yScale: 'log' })))[0]).toMatch(/log y axis needs a range above 0/);
    expect(errs(plotScene([{ id: 'f', type: 'plot', space: 'ax', expr: '10^x' }], space({ yScale: 'log', y: [0.1, 1e5] })))).toEqual([]);
  });

  it('coerces the usual mix-ups between plot and curve', () => {
    const asCurve = validateScene(plotScene([{ id: 'c', type: 'plot', space: 'ax', x: 'cos(t)', y: 'sin(t)', domain: [0, 6.28] }]));
    expect(asCurve.ok && asCurve.scene.entities[0].type).toBe('curve');
    const asPlot = validateScene(plotScene([{ id: 'c', type: 'curve', space: 'ax', expr: 'x' }]));
    expect(asPlot.ok && asPlot.scene.entities[0].type).toBe('plot');
  });
});
