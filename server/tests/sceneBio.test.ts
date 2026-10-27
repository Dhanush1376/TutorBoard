import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutCompartment, type Compartment } from '../engine/scene/compartments.js';
import { validateScene } from '../engine/scene/index.js';
import { examplesFor, guessDomain } from '../engine/scene/prompt.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));
const cellOf = (name: string, id: string) => fixture(name).entities.find((e: { id: string }) => e.id === id) as Compartment;
const sceneWith = (comp: object) => ({
  version: '1', title: 'Cell', domain: 'biology',
  entities: [comp],
  beats: [{ title: 'Show', narration: 'Look.', actions: [{ do: 'create', target: (comp as { id: string }).id }] }],
});
const errs = (comp: object) => { const r = validateScene(sceneWith(comp)); return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`); };
const warns = (comp: object) => { const r = validateScene(sceneWith(comp)); return r.warnings.map((w) => w.message); };

describe('compartment layout', () => {
  for (const [file, id] of [['plant-cell.json', 'cell'], ['prokaryote-eukaryote.json', 'bact'], ['prokaryote-eukaryote.json', 'animal']] as const) {
    it(`${file} ${id}: every part inside its parent, nothing overlapping, one leader per part`, () => {
      const c = cellOf(file, id);
      const lay = layoutCompartment(c);
      expect(lay.issues).toEqual([]);
      const centre = lay.root.at[0];
      // bodies (not membranes): inside the parent's region, clear of siblings
      const bodies = [...lay.parts.values()].filter((p) => p.shape !== 'membrane');
      for (const p of bodies) {
        const parent = p.parent === c.id ? { at: [centre], rx: lay.root.rx, ry: lay.root.ry } : lay.parts.get(p.parent!)!;
        for (const a of p.at) {
          const dx = (a.x - parent.at[0].x) / parent.rx, dy = (a.y - parent.at[0].y) / parent.ry;
          expect(Math.hypot(dx, dy), `${p.id} inside ${p.parent}`).toBeLessThan(1);
        }
      }
      const discs = bodies.flatMap((p) => p.at.map((a) => ({ id: p.id, parent: p.parent, ...a, r: Math.max(p.rx, p.ry) })));
      for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
        const a = discs[i], b = discs[j];
        if (a.parent !== b.parent) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} vs ${b.id}`).toBeGreaterThan(a.r + b.r);
      }
      // labels: one per part, a row apart in each column, leaders never crossing
      expect(lay.leaders.map((l) => l.id).sort()).toEqual(c.parts.map((p) => p.id).sort());
      for (const side of ['left', 'right'] as const) {
        const ys = lay.leaders.filter((l) => l.side === side).map((l) => l.y).sort((a, b) => a - b);
        for (let k = 1; k < ys.length; k++) expect(ys[k] - ys[k - 1]).toBeGreaterThanOrEqual(25.5);
      }
    });
  }

  it('labels a nested part in the other column from its container', () => {
    const lay = layoutCompartment(cellOf('plant-cell.json', 'cell'));
    const side = (id: string) => lay.leaders.find((l) => l.id === id)!.side;
    expect(side('nucleolus')).not.toBe(side('nucleus'));
  });

  it('reports what does not fit instead of drawing it on top of something', () => {
    const crowded: Compartment = { id: 'c', label: 'Crowded cell', size: 'sm', parts: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, label: `part ${i}`, size: 'lg' as const })) };
    expect(layoutCompartment(crowded).issues.join('\n')).toMatch(/no room for "part \d+" inside "Crowded cell"/);
    // more labels than two columns hold (the schema stops at 24 parts; the layout reports it whatever the count)
    const manyLabels: Compartment = { id: 'c', size: 'sm', parts: Array.from({ length: 34 }, (_, i) => ({ id: `p${i}`, label: `structure ${i}`, shape: 'dot' as const, size: 'xs' as const })) };
    expect(layoutCompartment(manyLabels).issues.join('\n')).toMatch(/labels on the (left|right) don't fit/);
  });
});

describe('compartments in validateScene', () => {
  const animal = () => ({
    id: 'cell', type: 'compartment', label: 'Animal cell', parts: [
      { id: 'mem', label: 'cell membrane', shape: 'membrane' },
      { id: 'nuc', label: 'nucleus', size: 'md' },
      { id: 'ncl', label: 'nucleolus', in: 'nuc', size: 'sm' },
      { id: 'mito', label: 'mitochondrion', shape: 'bean', size: 'xs', count: 2 },
    ],
  });

  it('accepts the goldens and a correct animal cell', () => {
    expect(validateScene(fixture('plant-cell.json')).ok).toBe(true);
    expect(validateScene(fixture('prokaryote-eukaryote.json')).ok).toBe(true);
    expect(errs(animal())).toEqual([]);
    expect(warns(animal())).toEqual([]);
  });

  it('refuses structures a kind of cell does not have', () => {
    const a = animal();
    a.parts.push({ id: 'wall', label: 'cell wall', shape: 'membrane' });
    expect(errs(a)[0]).toMatch(/"Animal cell" is an animal cell, which has no cell wall — remove "cell wall"/);
    const bact = { id: 'b', type: 'compartment', label: 'E. coli bacterium', parts: [{ id: 'mem', label: 'cell membrane', shape: 'membrane' }, { id: 'n', label: 'nucleus' }, { id: 'r', label: 'ribosomes', shape: 'dot', size: 'xs', count: 3 }, { id: 'dna', label: 'nucleoid' }] };
    expect(errs(bact)[0]).toMatch(/prokaryotic cell, which has no nucleus — its DNA lies in the nucleoid/);
  });

  it('wants a nucleolus inside the nucleus', () => {
    const a = animal();
    delete (a.parts[2] as { in?: string }).in;
    expect(errs(a)[0]).toMatch(/parts\[2\]\.in: "nucleolus" is inside the nucleus — set "in" to that part/);
  });

  it('warns when a defining structure is missing', () => {
    const plant = { id: 'p', type: 'compartment', label: 'Plant cell', shape: 'rect', parts: [{ id: 'nuc', label: 'nucleus' }, { id: 'mem', label: 'cell membrane', shape: 'membrane' }] };
    const w = warns(plant).join('\n');
    expect(w).toMatch(/plant cell is usually drawn with a cell wall/);
    expect(w).toMatch(/chloroplasts/);
  });

  it('catches label and nesting mistakes', () => {
    const a = animal();
    a.parts.push({ id: 'mito2', label: 'Mitochondrion', shape: 'bean', size: 'xs' });
    expect(errs(a).join('\n')).toMatch(/"Mitochondrion" labels two parts .* draw copies with "count"/);
    const b = animal();
    b.parts[2].in = 'nope';
    expect(errs(b)[0]).toMatch(/"nope" is not a part of "cell"/);
    const c = animal();
    c.parts[2].in = 'mem';
    expect(errs(c).join('\n')).toMatch(/"mem" is a membrane/);
    const d = animal();
    d.parts[1] = { ...d.parts[1], in: 'ncl' } as typeof d.parts[1];
    expect(errs(d).join('\n')).toMatch(/ends up inside itself/);
  });

  it('makes parts addressable and checks the references', () => {
    const s = sceneWith(animal());
    (s.beats[0].actions as object[]).push({ do: 'highlight', target: 'cell.nuc', state: 'insight' }, { do: 'annotate', target: 'cell.mito', text: 'energy' });
    expect(validateScene(s).ok).toBe(true);
    (s.beats[0].actions as object[]).push({ do: 'highlight', target: 'cell.golgi', state: 'insight' });
    const r = validateScene(s);
    expect(r.ok ? [] : r.errors.map((e) => e.message)).toEqual([expect.stringMatching(/"cell" has no part "golgi"/)]);
  });

  it('reads the usual ways of writing parts', () => {
    const r = validateScene(sceneWith({ id: 'cell', type: 'cell_diagram', label: 'Animal cell', organelles: [
      { id: 'mem', name: 'cell membrane', shape: 'cell membrane' },
      { id: 'nuc', name: 'nucleus', size: 'md' },
      { id: 'ncl', name: 'nucleolus', parent: 'nuc', size: 'sm' },
    ] }));
    expect(r.ok).toBe(true);
    if (r.ok && r.scene.entities[0].type === 'compartment') {
      expect(r.scene.entities[0].parts.map((p) => [p.id, p.label, p.in ?? null, p.shape])).toEqual([
        ['mem', 'cell membrane', null, 'membrane'], ['nuc', 'nucleus', null, 'round'], ['ncl', 'nucleolus', 'nuc', 'round'],
      ]);
    }
  });
});

describe('biology in the planner', () => {
  it('recognises biology questions without stealing maths or chemistry', () => {
    expect(guessDomain('Explain the parts of a plant cell')).toBe('biology');
    expect(guessDomain('How does photosynthesis work?')).toBe('biology');
    expect(guessDomain('Find the root of x^2 - 4')).toBe('math');
    expect(guessDomain('How does an electrochemical cell make a voltage?')).toBe('chemistry');
  });
  it('shows the labelled-cell example for structure questions', () => {
    expect((examplesFor('Draw a bacterial cell and label its parts')[0] as { title: string }).title).toBe('Inside a plant cell: where photosynthesis happens');
  });
});
