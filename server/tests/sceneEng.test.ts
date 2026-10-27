import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCircuit, layoutCircuit, solveDC, thevenin, type Circuit, type Comp } from '../engine/scene/circuits.js';
import { si } from '../engine/scene/eng.js';
import { validateScene } from '../engine/scene/index.js';
import { checkLogic, checkTruthTable, evalLogic, type Logic } from '../engine/scene/logic.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
const circ = (components: Comp[], ground?: string): Circuit => ({ id: 'c', components, ...(ground ? { ground } : {}) });
const bat = (v: number, from = 'n0', to = 'n1'): Comp => ({ id: 'V1', kind: 'battery', from, to, value: v });
const res = (id: string, from: string, to: string, value: number): Comp => ({ id, kind: 'resistor', from, to, value });

describe('circuit solve (DC)', () => {
  it('series–parallel: 9 V into 1 kΩ + (2 kΩ ∥ 2 kΩ)', () => {
    const c = fixture('circuit-computed.json').entities[0] as Circuit;
    const dc = solveDC(c);
    expect(dc.i.get('V1')).toBeCloseTo(0.0045, 9);
    expect(dc.v.get('n2')).toBeCloseTo(4.5, 9);
    expect(dc.i.get('R2')).toBeCloseTo(0.00225, 9);
    expect(dc.i.get('R1')! - dc.i.get('R2')! - dc.i.get('R3')!).toBeCloseTo(0, 12); // KCL
  });

  it('meters: an ammeter in series reads the loop current, a voltmeter reads the drop without loading it', () => {
    const c = circ([bat(12), { id: 'A1', kind: 'ammeter', from: 'n1', to: 'n2' }, res('R1', 'n2', 'n3', 4), res('R2', 'n3', 'n0', 2), { id: 'VM', kind: 'voltmeter', from: 'n3', to: 'n0' }]);
    const dc = solveDC(c);
    expect(Math.abs(dc.i.get('A1')!)).toBeCloseTo(2, 9);
    expect(dc.drop.get('VM')).toBeCloseTo(4, 9);
    expect(dc.i.get('VM')).toBe(0);
  });

  it('an open switch stops the current; a capacitor carries none at steady state', () => {
    const open = circ([bat(5), { id: 'S1', kind: 'switch', from: 'n1', to: 'n2', closed: false }, res('R1', 'n2', 'n0', 10)]);
    expect(solveDC(open).i.get('R1')).toBe(0);
    const cap = circ([bat(5), res('R1', 'n1', 'n2', 10), { id: 'C1', kind: 'capacitor', from: 'n2', to: 'n0', value: 1e-6 }]);
    const dc = solveDC(cap);
    expect(dc.i.get('R1')).toBe(0);
    expect(dc.v.get('n2')).toBeCloseTo(5, 6);
  });

  it('doubling a resistor halves the current (metamorphic)', () => {
    const i1 = solveDC(circ([bat(6), res('R1', 'n1', 'n0', 3)])).i.get('R1')!;
    const i2 = solveDC(circ([bat(6), res('R1', 'n1', 'n0', 6)])).i.get('R1')!;
    expect(i2).toBeCloseTo(i1 / 2, 12);
  });

  it('refuses circuits that are not closed, shorted or contradictory', () => {
    const msgs = (c: Circuit) => checkCircuit(c).map((i) => i.message).join('\n');
    expect(msgs(circ([bat(9), res('R1', 'n1', 'n2', 10)]))).toMatch(/net "n2" only touches "R1": that terminal is dangling/);
    expect(msgs(circ([bat(9), { id: 'W', kind: 'wire', from: 'n1', to: 'n0' }, res('R1', 'n1', 'n0', 5)]))).toMatch(/"V1" is short-circuited/);
    expect(msgs(circ([res('R1', 'n1', 'n0', 5), res('R2', 'n1', 'n0', 5)]))).toMatch(/there is no battery/);
    expect(msgs(circ([bat(9), res('R1', 'n1', 'n1', 5), res('R2', 'n1', 'n0', 5)]))).toMatch(/both ends of "R1" are on net "n1"/);
    expect(msgs(circ([bat(9), { id: 'R1', kind: 'resistor', from: 'n1', to: 'n0' }]))).toMatch(/resistor "R1" needs a positive "value" in ohms/);
    const fight = circ([bat(9), { id: 'V2', kind: 'battery', from: 'n0', to: 'n1', value: 6 }, res('R1', 'n1', 'n0', 5)]);
    expect(() => solveDC(fight)).toThrow(/no consistent solution/);
  });

  it('Thévenin seen by a capacitor across half a divider: 5 V behind 500 Ω', () => {
    const c = circ([bat(10), res('R1', 'n1', 'n2', 1000), res('R2', 'n2', 'n0', 1000), { id: 'C1', kind: 'capacitor', from: 'n2', to: 'n0', value: 1e-3 }]);
    const th = thevenin(c, 'n0', 'n2');
    expect(th.voc).toBeCloseTo(5, 9);
    expect(th.rth).toBeCloseTo(500, 6);
  });
});

describe('schematic layout', () => {
  it('places every component, dots only where three conductors meet', () => {
    const parallel = layoutCircuit(fixture('circuit-computed.json').entities[0]);
    expect([...parallel.comps.keys()].sort()).toEqual(['R1', 'R2', 'R3', 'V1']);
    expect(parallel.dots).toHaveLength(2); // the top of R2 and its foot on the ground rail; R3 ends the ladder in corners
    const loop = layoutCircuit(fixture('rc-charging-computed.json').entities[0]);
    expect(loop.dots).toEqual([]);
    for (const l of [parallel, loop]) {
      const pts = [...l.wires.flat(), ...[...l.comps.values()].flatMap((p) => [p.a, p.b, ...p.leads.flat()])];
      expect(pts.every((p) => Number.isFinite(p.x) && p.x >= 0 && p.x <= l.w && p.y >= 0 && p.y <= l.h)).toBe(true);
    }
  });
});

describe('logic', () => {
  const xor: Logic = { id: 'l', inputs: ['A', 'B'], gates: [{ id: 'g', op: 'xor', in: ['A', 'B'] }], outputs: [{ id: 'Y', from: 'g' }] };

  it('evaluates gates', () => {
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].map(([A, B]) => evalLogic(xor, { A, B }).get('Y'))).toEqual([0, 1, 1, 0]);
  });

  it('refuses unwired, mis-sized and looping circuits', () => {
    const e = (l: Logic) => checkLogic(l).join('\n');
    expect(e({ ...xor, gates: [{ id: 'g', op: 'not', in: ['A', 'B'] }] })).toMatch(/NOT gate "g" takes 1 input, not 2/);
    expect(e({ ...xor, gates: [{ id: 'g', op: 'and', in: ['A', 'Z'] }] })).toMatch(/reads "Z", which is not an input or a gate/);
    expect(e({ ...xor, gates: [{ id: 'g', op: 'and', in: ['A', 'h'] }, { id: 'h', op: 'or', in: ['g', 'B'] }] })).toMatch(/feedback loop g → h → g/);
    expect(e({ ...xor, inputs: ['A', 'B', 'C'] })).toMatch(/input "C" isn't connected/);
  });

  it('catches a wrong row in a truth table, in a scene', () => {
    expect(checkTruthTable(xor, ['A', 'B', 'Y'], [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]])).toEqual(['row 4 (A=1, B=1): Y is 0, the table says 1']);
    const scene = {
      version: '1', title: 'XOR', domain: 'general',
      entities: [{ id: 'l', type: 'logic', ...xor }, { id: 'tt', type: 'table', columns: ['A', 'B', 'Y'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] }],
      beats: [{ title: 'Show', narration: 'Look.', actions: [{ do: 'create', target: ['l', 'tt'] }] }],
    };
    const r = validateScene(scene);
    expect(r.ok ? [] : r.errors.map((x) => x.message)).toEqual([expect.stringMatching(/truth table "tt" disagrees with "l": row 4 \(A=1, B=1\): Y is 0, the table says 1/)]);
  });
});

describe('engineering traces', () => {
  const beats = (name: string) => { const r = validateScene(fixture(name)); if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n')); return r.scene; };

  it('circuit-solve narrates the solved numbers', () => {
    const text = beats('circuit-computed.json').beats.map((b) => b.narration).join(' ');
    expect(text).toMatch(/9 V ÷ 4.5 mA = 2 kΩ/);
    expect(text).toMatch(/4.5 mA \(R1\) flows in and 2.25 mA \(R2\) \+ 2.25 mA \(R3\) flows out/);
    expect(text).toMatch(/supplies P = V × I = 40.5 mW/);
  });

  it('rc-charging: τ = RC and the 63% point on the curve', () => {
    const s = beats('rc-charging-computed.json');
    expect(s.beats.map((b) => b.narration).join(' ')).toMatch(/τ = R × C = 2 kΩ × 100 µF = 200 ms/);
    const p = s.entities.find((e) => e.id === 'rc-p63') as unknown as { at: number[] };
    expect(p.at[0]).toBeCloseTo(200, 6);
    expect(p.at[1]).toBeCloseTo(6 * (1 - Math.exp(-1)), 6);
  });

  it('truth-table fills every row from the gates', () => {
    const s = beats('logic-computed.json');
    const sets = s.beats.flatMap((b) => b.actions).filter((a) => a.do === 'set' && String(a.target).startsWith('vote-table.r') && String(a.target).endsWith('c3'));
    expect(sets.map((a) => (a as { value: number }).value)).toEqual([0, 0, 0, 1, 0, 1, 1, 1]); // majority of three
  });

  it('beam: reactions by moments, and the peak moment — with a uniform load, wL²/8', () => {
    const point = beats('beam-computed.json').beats.map((b) => b.narration).join(' ');
    expect(point).toMatch(/R_B = 3.333 kN.*R_A = 10 − 3.333 = 6.667 kN/);
    expect(point).toMatch(/13.33 kN·m at x = 2 m/);
    const r = validateScene({ version: '1', title: 'UDL', domain: 'physics', entities: [], beats: [{ title: 'b', narration: 'computed', compute: { algorithm: 'beam', target: 'b', args: { length: 4, udl: 5 } } }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene.beats.map((b) => b.narration).join(' ')).toMatch(/10 kN·m at x = 2 m/); // 5 × 4² / 8
    // moving the load changes the reactions (metamorphic)
    const moved = validateScene({ version: '1', title: 'P', domain: 'physics', entities: [], beats: [{ title: 'b', narration: 'computed', compute: { algorithm: 'beam', target: 'b', args: { length: 6, loads: [{ at: 3, F: 10 }] } } }] });
    expect(moved.ok && moved.scene.beats[1].narration).toMatch(/R_B = 5 kN/);
  });

  it('formats SI quantities', () => {
    expect(si(0.0045, 'A')).toBe('4.5 mA');
    expect(si(2200, 'Ω')).toBe('2.2 kΩ');
    expect(si(0.0001, 'F')).toBe('100 µF');
  });
});
