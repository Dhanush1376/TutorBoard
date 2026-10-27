import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkMolecule, moleculePart, reactionBalance, type Mol } from '../engine/scene/chem.js';
import { validateScene } from '../engine/scene/index.js';
import { examplesFor } from '../engine/scene/prompt.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
const msgs = (input: unknown) => { const r = validateScene(input); return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`); };

const mebr = (): Mol => ({
  atoms: [{ id: 'C', el: 'C' }, { id: 'Br', el: 'Br' }, { id: 'Ha', el: 'H' }, { id: 'Hb', el: 'H' }, { id: 'Hc', el: 'H' }],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1, 'wedge'], [0, 4, 1, 'dash']],
  lonePairs: [{ atom: 1, count: 3 }],
});
const mol = (atoms: string, bonds: Mol['bonds'] = [], extra: Partial<Mol> = {}): Mol => ({ atoms: [...atoms].map((el) => ({ el })), bonds, ...extra });

describe('molecule parts', () => {
  it('names atoms, bonds (either way round) and lone pairs', () => {
    const m = mebr();
    expect(moleculePart(m, 'C')).toEqual({ kind: 'atom', i: 0 });
    expect(moleculePart(m, 'C-Br')).toEqual({ kind: 'bond', a: 0, b: 1, k: 0 });
    expect(moleculePart(m, 'Br-C')).toEqual({ kind: 'bond', a: 1, b: 0, k: 0 });
    expect(moleculePart(m, 'lp-Br')).toEqual({ kind: 'lp', i: 1 });
    expect(moleculePart(m, 'Br-Ha')).toBeNull(); // not bonded
    expect(moleculePart(m, 'N')).toBeNull();
  });

  it('prefers an atom id that contains a hyphen over a bond reading', () => {
    const m: Mol = { atoms: [{ id: 'C-1', el: 'C' }, { id: 'C', el: 'C' }, { id: '1', el: 'H' }], bonds: [[0, 1, 1], [1, 2, 1]] };
    expect(moleculePart(m, 'C-1')).toEqual({ kind: 'atom', i: 0 });
  });
});

describe('stereo bonds', () => {
  it('accepts a wedge and a dash on a stereocentre', () => {
    expect(checkMolecule(mebr(), 'm')).toEqual([]);
  });

  it('rejects a wedge on a double bond and warns when the narrow end is not a stereocentre', () => {
    const m = mebr();
    m.bonds[2] = [0, 2, 2, 'wedge'];
    expect(checkMolecule(m, 'm').some((i) => i.severity === 'error' && /wedge bond .* order 2/.test(i.message))).toBe(true);
    const flipped = mebr();
    flipped.bonds[2] = [3, 0, 1, 'wedge']; // narrow end on the hydrogen
    expect(checkMolecule(flipped, 'm')).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringMatching(/list the stereocentre first/) })]);
  });
});

describe('reaction balance', () => {
  const ch4 = mol('CHHHH', [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]);
  const o2 = mol('OO', [[0, 1, 2]]);
  const co2 = mol('COO', [[0, 1, 2], [0, 2, 2]]);
  const h2o = mol('OHH', [[0, 1, 1], [0, 2, 1]]);

  it('balances CH4 + 2 O2 → CO2 + 2 H2O', () => {
    expect(reactionBalance([{ mol: ch4, n: 1, id: 'ch4' }, { mol: o2, n: 2, id: 'o2' }], [{ mol: co2, n: 1, id: 'co2' }, { mol: h2o, n: 2, id: 'h2o' }])).toBeNull();
  });

  it('says exactly what is off without the coefficients', () => {
    const why = reactionBalance([{ mol: ch4, n: 1, id: 'ch4' }, { mol: o2, n: 1, id: 'o2' }], [{ mol: co2, n: 1, id: 'co2' }, { mol: h2o, n: 1, id: 'h2o' }])!;
    expect(why).toMatch(/CH4 \(ch4\) \+ O2 \(o2\) → CO2 \(co2\) \+ H2O \(h2o\)/);
    expect(why).toMatch(/H: 4 on the left, 2 on the right/);
    expect(why).toMatch(/O: 2 on the left, 3 on the right/);
  });

  it('checks charge too', () => {
    const oh = mol('OH', [[0, 1, 1]]);
    oh.atoms[0].charge = -1;
    const water = mol('OHH', [[0, 1, 1], [0, 2, 1]]);
    const h = mol('H');
    expect(reactionBalance([{ mol: oh, n: 1, id: 'oh' }, { mol: h, n: 1, id: 'h' }], [{ mol: water, n: 1, id: 'w' }])).toMatch(/charge: -1 on the left, 0 on the right/);
  });
});

describe('chemistry in validateScene', () => {
  it('validates the SN2 and combustion goldens', () => {
    expect(msgs(fixture('sn2-mechanism.json'))).toEqual([]);
    expect(msgs(fixture('methane-combustion.json'))).toEqual([]);
  });

  it('rejects an unbalanced equation with the per-element difference', () => {
    const s = fixture('methane-combustion.json');
    s.entities[4].reactants = ['ch4', 'o2'];
    expect(msgs(s)[0]).toMatch(/entities\[4\]: .*doesn't balance — O: 2 on the left, 4 on the right/);
  });

  it('wants molecules on both sides of a reaction, each once', () => {
    const s = fixture('methane-combustion.json');
    s.entities[4].products = ['co2', 'tally'];
    expect(msgs(s).join('\n')).toMatch(/reactants and products are molecule entities .* "tally" is a table/);
    const t = fixture('methane-combustion.json');
    t.entities[4].products = ['co2', 'co2'];
    expect(msgs(t).join('\n')).toMatch(/"co2" appears twice/);
  });

  describe('curly arrows', () => {
    const withArrow = (arrow: object) => {
      const s = fixture('sn2-mechanism.json');
      s.entities[4] = { id: 'attack', type: 'curly', ...arrow };
      return msgs(s).join('\n');
    };
    it('start at electrons: a lone pair or a bond, not an atom', () => {
      expect(withArrow({ from: 'oh.O', to: 'mebr.C' })).toMatch(/not from an atom — use "oh.lp-O"/);
      expect(withArrow({ from: 'mebr.lp-C', to: 'oh.O' })).toMatch(/C "C" has no lone pair/);
      expect(withArrow({ from: 'oh.O', to: 'mebr.C', electrons: 1 })).toBe(''); // a single electron may leave an atom (radicals)
    });
    it('end at an atom or a bond', () => {
      expect(withArrow({ from: 'oh.lp-O', to: 'mebr.lp-Br' })).toMatch(/not at a lone pair/);
      expect(withArrow({ from: 'oh.lp-O', to: 'mebr.C-Br' })).toBe('');
    });
    it('only point inside molecules, at parts that exist', () => {
      expect(withArrow({ from: 'rx', to: 'mebr.C' })).toMatch(/starts inside a molecule/);
      expect(withArrow({ from: 'oh.lp-O', to: 'mebr.C-Ha' })).toBe('');
      expect(withArrow({ from: 'oh.lp-O', to: 'mebr.Br-Ha' })).toMatch(/has no part "Br-Ha" \(available: atom ids .*bonds like "C1-Br", lone pairs like "lp-O"\)/);
    });
    it('accept an anion\'s pair without declared lone pairs', () => {
      const s = fixture('sn2-mechanism.json');
      delete s.entities[0].lonePairs; // OH⁻: the charge implies the pair
      expect(msgs(s)).toEqual([]);
    });
  });

  it('lays out an unplaced reaction left to right and reads common names', () => {
    const s = fixture('methane-combustion.json');
    s.layout = [];
    s.entities.find((e: { id: string }) => e.id === 'rx').type = 'chemical_reaction';
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.layout).toContainEqual({ rel: 'row', ids: ['ch4', 'o2', 'rx', 'co2', 'h2o'], gap: 'xl' });
      expect(r.warnings.map((w) => w.message)).toEqual(expect.arrayContaining(['auto-fixed: "chemical_reaction" → "reaction"', 'auto-fixed: laid out in a row: ch4, o2, rx, co2, h2o']));
    }
  });
});

describe('planner examples for chemistry', () => {
  const title = (q: string) => (examplesFor(q)[0] as { title: string }).title;
  it('shows the mechanism example for mechanisms and the combustion example for equations', () => {
    expect(title('Visualize the mechanism of an SN1 reaction')).toBe('SN2: hydroxide replaces bromide');
    expect(title('Show how a nucleophile attacks bromoethane')).toBe('SN2: hydroxide replaces bromide');
    expect(title('Balance the chemical equation for burning propane')).toBe('Balancing methane burning in oxygen');
  });
  it('reads "wedge" as a stereo bond in chemistry and as a slope in physics', () => {
    expect(title('Draw 2-butanol with wedge and dash bonds to show its chiral centre')).not.toBe('Forces on a block on a 30° ramp');
    expect(title('A block slides down a wedge with friction')).toBe('Forces on a block on a 30° ramp');
  });
});
