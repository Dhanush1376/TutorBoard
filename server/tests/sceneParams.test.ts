import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateScene } from '../engine/scene/index.js';
import { evaluateParams, prepareParams, resolveParams } from '../engine/scene/params.js';
import { dimOf, formatDim, parseUnit, type Dim } from '../engine/scene/units.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
const msgs = (input: unknown) => { const r = validateScene(input); return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`); };
type Ent = { id: string; [k: string]: unknown };
const ent = (scene: { entities: Ent[] }, id: string) => scene.entities.find((e) => e.id === id)!;

const M: Dim = [1, 0, 0, 0, 0, 0];
const V: Dim = [1, 0, -1, 0, 0, 0];
const ACC: Dim = [1, 0, -2, 0, 0, 0];

describe('units', () => {
  it('reads SI units and their combinations', () => {
    expect(parseUnit('m/s^2').dim).toEqual(ACC);
    expect(parseUnit('N').dim).toEqual(parseUnit('kg·m/s²').dim);
    expect(parseUnit('1/s').dim).toEqual([0, 0, -1, 0, 0, 0]);
    expect(parseUnit('N/m').dim).toEqual([0, 1, -2, 0, 0, 0]);
    expect(parseUnit('km').scale).toBe(1000);
    expect(parseUnit('deg').angle).toBe('deg');
    expect(() => parseUnit('furlong')).toThrow(/unknown unit/);
  });

  it('works out the dimension of an expression and finds what does not add up', () => {
    const idents = { v0: V, theta0: [0, 0, 0, 0, 0, 0] as Dim, g: ACC };
    expect(dimOf('v0^2*sin(2*theta0)/g', idents).dim).toEqual(M);
    expect(dimOf('v0 + g', idents).problems[0]).toMatch(/can't add m\/s\^2 to m\/s/);
    expect(dimOf('sin(v0)', idents).problems[0]).toMatch(/dimensionless argument/);
    expect(dimOf('sqrt(k/mass)', { k: parseUnit('N/m').dim, mass: parseUnit('kg').dim }).dim).toEqual([0, 0, -1, 0, 0, 0]);
    expect(dimOf('x*tan(theta0)', idents, M).dim).toEqual(M);
    expect(formatDim(ACC)).toBe('m/s^2');
  });
});

describe('parameters', () => {
  it('validates the projectile golden at its defaults and over every slider', () => {
    const r = validateScene(fixture('projectile-sliders.json'));
    if (!r.ok) throw new Error(r.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    expect(r.warnings).toEqual([]);
    const s = r.scene as unknown as { entities: Ent[]; params: unknown[]; bindings: { id: string; field: string }[] };
    expect(s.params).toHaveLength(3);
    expect(s.bindings.map((b) => `${b.id}.${b.field}`)).toEqual(expect.arrayContaining(['traj.expr', 'traj.domain.1', 'apex.at.0', 'apex.at.1', 'land.at.0', 'launch.angleDeg', 'launch.magnitude', 'eq.latex', 'flight.text']));
    // the numbers are computed, not written by the model: R = v0² sin 2θ / g
    expect((ent(s, 'land').at as number[])[0]).toBeCloseTo(400 / 9.8, 6);
    expect(ent(s, 'apex').label).toBe('max height 10.2 m');
    expect(ent(s, 'flight').text).toBe('in the air for 2.89 s');
  });

  it('moves everything that depends on a slider, and only that (metamorphic)', () => {
    const golden = fixture('projectile-sliders.json');
    const a = resolveParams(golden, {}) as { entities: Ent[] };
    const b = resolveParams(golden, { v0: 10, theta0: 60 }) as { entities: Ent[] };
    const R = (100 * Math.sin((2 * Math.PI) / 3)) / 9.8;
    expect((ent(b, 'land').at as number[])[0]).toBeCloseTo(R, 6);
    expect(ent(b, 'land').label).toBe(`range ${R.toFixed(1)} m`);
    expect(ent(b, 'launch').angleDeg).toBe(60);
    // the vector's tip follows its new angle and length (it is stored resolved)
    const to = ent(b, 'launch').to as number[];
    expect(Math.atan2(to[1], to[0]) * 180 / Math.PI).toBeCloseTo(60, 6);
    expect(Math.hypot(to[0], to[1])).toBeCloseTo(5, 6);
    expect(ent(b, 'traj').expr).not.toBe(ent(a, 'traj').expr);
    // unbound entities are untouched
    expect(ent(b, 'ball')).toEqual(ent(a, 'ball'));

    const spring = fixture('spring-oscillator.json');
    const s1 = resolveParams(spring, { A: 0.1 }) as { entities: Ent[] };
    const s2 = resolveParams(spring, { A: 0.3 }) as { entities: Ent[] };
    expect(ent(s1, 'period').x).toBe(ent(s2, 'period').x); // amplitude does not change the period
    const s3 = resolveParams(spring, { mass: 4 }) as { entities: Ent[] };
    expect(ent(s3, 'period').x as number).toBeCloseTo(2 * (ent(s1, 'period').x as number), 6); // 4× the mass, 2× the period
  });

  it('clamps values to the slider range', () => {
    const p = prepareParams(fixture('projectile-sliders.json'))!;
    expect(evaluateParams(p.params, p.derived, { v0: 999 }).display.get('v0')).toBe(25);
  });

  it('rejects a scene that only holds at the default values', () => {
    const golden = fixture('projectile-sliders.json');
    golden.params[0].max = 40; // at 40 m/s the apex flies off the 35 m tall space
    const e = msgs(golden);
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]).toMatch(/with launch speed v₀ = 40 m\/s \(its maximum\).*outside space "field"/);
  });

  it('round-trips: a validated scene (with its bindings) validates again, as doubt branches do', () => {
    const r1 = validateScene(fixture('spring-oscillator.json'));
    expect(r1.ok).toBe(true);
    const r2 = validateScene(r1.ok ? r1.scene : null);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.scene.bindings).toEqual(r1.scene.bindings);
    const moved = resolveParams(r1.ok ? r1.scene : {}, { k: 80 }) as { entities: Ent[] };
    expect(ent(moved, 'period').label).toBe(`T = ${(2 * Math.PI / Math.sqrt(80)).toFixed(2)} s`);
  });
});

describe('parameter errors the model gets back', () => {
  const base = () => fixture('projectile-sliders.json');

  it('wants SI units and non-reserved ids', () => {
    const s = base();
    s.params[0].unit = 'km/h';
    s.params[1].id = 'theta';
    const e = msgs(s).join('\n');
    expect(e).toMatch(/params\[0\]\.unit: use SI units/);
    expect(e).toMatch(/params\[1\]\.id: "theta" is reserved/);
  });

  it('catches a derived quantity in the wrong unit', () => {
    const s = base();
    s.derived[1].unit = 's';
    expect(msgs(s)[0]).toMatch(/derived\[1\]\.unit: "H" = .* works out in m .* but its unit "s" is s/);
  });

  it('catches a formula whose terms do not share a unit', () => {
    const s = base();
    s.entities[0].expr = 'x*tan(theta0) - g*x/(2*v0^2)'; // second term is dimensionless
    expect(msgs(s)[0]).toMatch(/entities\[0\]\.expr: in .*can't subtract dimensionless from m/);
  });

  it('catches a plot that is not in the y axis unit', () => {
    const s = base();
    s.entities[0].expr = 'v0*x/g';
    expect(msgs(s)[0]).toMatch(/works out in m·s but the y axis of "field" is in m/);
  });

  it('catches coordinates in the wrong unit, unknown names and templates', () => {
    const s = base();
    s.entities[3].at = ['=T', '=H']; // a time on the x axis (metres)
    s.entities[5].latex = 'R = {{Range}}';
    s.entities[4].at = ['=R + speed', 0];
    const e = msgs(s).join('\n');
    expect(e).toMatch(/entities\[3\]\.at\.0: =T works out in s but the x axis of "field" is in m/);
    expect(e).toMatch(/\{\{Range\}\} is not a parameter/);
    expect(e).toMatch(/entities\[4\]\.at\.0: can't read "=R \+ speed"/);
  });

  it('refuses parameters inside geometry written by intent', () => {
    const s = base();
    s.entities[3].at = { from: [0, 0], angleDeg: '=theta0', length: 5 };
    expect(msgs(s)[0]).toMatch(/can't go inside a geometry-by-intent object/);
  });

  it('leaves scenes without parameters exactly as before', () => {
    const plain = fixture('projectile-45.json');
    expect(prepareParams(plain)).toBeNull();
    expect(resolveParams(plain)).toBe(plain);
  });
});
