import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatIssuesForRepair, validateScene } from '../engine/scene/index.js';

const FIXTURES = new URL('../engine/scene/fixtures/', import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));

/** A minimal valid scene to mutate in tests. */
const base = () => ({
  version: '1',
  title: 'Test',
  domain: 'algorithms',
  entities: [{ id: 'arr', type: 'array', values: [3, 1, 2] }],
  beats: [{ title: 'Show', narration: 'Here is the array.', actions: [{ do: 'create', target: 'arr' }] }],
});

const errorsOf = (input: unknown, opts?: Parameters<typeof validateScene>[1]) => {
  const r = validateScene(input, opts);
  return r.ok ? [] : r.errors;
};

describe('Scene Language v1 — golden scenes', () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));

  it('ships the golden scenes', () => {
    expect(files.sort()).toEqual([
      'area-under-curve.json', 'beam-computed.json', 'benzene-to-toluene.json', 'binary-search-computed.json', 'bubble-sort.json',
      'circle-area.json', 'circuit-computed.json', 'confusion-matrix-computed.json', 'dijkstra-computed.json', 'gradient-descent-computed.json', 'graph-search-computed.json',
      'heap-insert.json', 'incline-forces.json', 'kmeans-computed.json', 'lcs-computed.json', 'logic-computed.json',
      'methane-combustion.json', 'neural-network.json', 'parallelogram-area.json', 'parametric-polar.json', 'perceptron-computed.json', 'plant-cell.json', 'projectile-45.json', 'projectile-sliders.json', 'prokaryote-eukaryote.json', 'radioactive-decay.json', 'rc-charging-computed.json',
      'sliding-window-computed.json', 'sn2-mechanism.json', 'spring-oscillator.json', 'stack-vs-queue.json', 'triangle-angle-sum.json', 'water-molecule.json',
    ]);
  });

  it.each(files)('%s is valid with no warnings', (f) => {
    const r = validateScene(fixture(f));
    if (!r.ok) throw new Error(formatIssuesForRepair(r.errors));
    expect(r.warnings).toEqual([]);
  });
});

describe('Scene Language v1 — schema', () => {
  it('accepts a minimal scene and applies defaults', () => {
    const r = validateScene(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.spaces).toEqual([]);
      expect(r.scene.beats[0].pace).toBe('normal');
    }
  });

  it('rejects unknown entity types with a path', () => {
    const s = base();
    (s.entities[0] as any).type = 'hologram';
    const errs = errorsOf(s);
    expect(errs[0].path).toBe('entities[0].type');
  });

  it('rejects ids that are not identifiers', () => {
    const s = base();
    s.entities[0].id = '1 bad id';
    expect(errorsOf(s).some((e) => e.path === 'entities[0].id')).toBe(true);
  });

  it('rejects unknown actions', () => {
    const s = base();
    (s.beats[0].actions[0] as any).do = 'explode';
    expect(errorsOf(s)[0].path).toBe('beats[0].actions[0].do');
  });
});

describe('Scene Language v1 — semantics', () => {
  it('flags duplicate ids', () => {
    const s = base();
    s.entities.push({ id: 'arr', type: 'array', values: [1] });
    expect(errorsOf(s).map((e) => e.message).join()).toMatch(/duplicate id "arr"/);
  });

  it('flags references to missing entities', () => {
    const s = base();
    s.beats[0].actions.push({ do: 'highlight', target: 'ghost', state: 'active' } as any);
    expect(errorsOf(s).some((e) => e.path === 'beats[0].actions[1].target' && /"ghost" is not an entity/.test(e.message))).toBe(true);
  });

  it('simulates data-structure operations to catch out-of-range indices', () => {
    const s = base();
    s.beats[0].actions.push({ do: 'delete', target: 'arr', at: 0 } as any, { do: 'swap', target: 'arr', i: 0, j: 2 } as any);
    const errs = errorsOf(s);
    expect(errs.some((e) => e.path === 'beats[0].actions[2].j' && /2 elements/.test(e.message))).toBe(true);
  });

  it('checks [index] references against the simulated length', () => {
    const s = base();
    s.beats[0].actions.push({ do: 'highlight', target: 'arr[3]', state: 'active' } as any);
    expect(errorsOf(s).some((e) => /out of range/.test(e.message))).toBe(true);
  });

  it('suggests the right operation for queues and stacks', () => {
    const s = base();
    s.entities = [{ id: 'q', type: 'queue', values: ['A'] } as any];
    s.beats[0].actions = [{ do: 'create', target: 'q' }, { do: 'pop', target: 'q' } as any];
    expect(errorsOf(s).map((e) => e.message).join()).toMatch(/use "dequeue"/);
  });

  it('catches popping an empty stack', () => {
    const s = base();
    s.entities = [{ id: 'st', type: 'stack', values: [] } as any];
    s.beats[0].actions = [{ do: 'create', target: 'st' }, { do: 'pop', target: 'st' } as any];
    expect(errorsOf(s).map((e) => e.message).join()).toMatch(/empty/);
  });

  it('requires a space for domain-unit entities', () => {
    const s = base();
    s.entities.push({ id: 'p', type: 'point', at: [1, 2] } as any);
    expect(errorsOf(s).some((e) => e.path === 'entities[1].space')).toBe(true);
  });

  it('validates named parts', () => {
    const s = fixture('triangle-angle-sum.json');
    s.entities[1].vertex = 'tri.D';
    expect(errorsOf(s).map((e) => e.message).join()).toMatch(/no part "D".*"A", "B", "C"/);
  });

  it('validates network layer parts', () => {
    const s = fixture('neural-network.json');
    s.beats[3].actions[0].target = 'net.L3n5';
    expect(errorsOf(s).some((e) => /no part "L3n5"/.test(e.message))).toBe(true);
  });

  it('validates tree structure', () => {
    const s = base();
    s.entities = [{ id: 't', type: 'tree', nodes: [{ id: 'a', value: 1 }, { id: 'b', value: 2, parent: 'zz' }] } as any];
    s.beats[0].actions = [{ do: 'create', target: 't' }];
    expect(errorsOf(s).some((e) => /parent "zz"/.test(e.message))).toBe(true);
  });

  it('validates exchange targets', () => {
    const s = fixture('heap-insert.json');
    s.beats[2].actions[1] = { do: 'exchange', a: 'heap.n5', b: 'arr[2]' };
    const msgs = errorsOf(s).map((e) => e.message).join(' | ');
    expect(msgs).toMatch(/must belong to the same entity/);
  });

  it('lets single tree nodes appear later', () => {
    const r = validateScene(fixture('heap-insert.json'));
    expect(r.ok).toBe(true);
  });

  it('validates molecule bonds', () => {
    const s = fixture('water-molecule.json');
    s.entities[1].bonds.push([0, 7, 1]);
    expect(errorsOf(s).some((e) => /atom index out of range/.test(e.message))).toBe(true);
  });

  it('auto-creates entities used before they appear, with a warning', () => {
    const s = base();
    s.entities.push({ id: 'cap', type: 'text', text: 'hi' } as any);
    s.beats[0].actions.push({ do: 'set', target: 'cap', text: 'hello' } as any);
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.beats[0].actions.map((a) => a.do)).toEqual(['create', 'create', 'set']);
      expect(r.warnings.some((w) => /used before being created/.test(w.message))).toBe(true);
    }
  });

  it('reports use-before-create as an error when autofix is off', () => {
    const s = base();
    s.entities.push({ id: 'cap', type: 'text', text: 'hi' } as any);
    s.beats[0].actions.push({ do: 'set', target: 'cap', text: 'hello' } as any);
    expect(errorsOf(s, { autofix: false }).some((e) => /used before it is created/.test(e.message))).toBe(true);
  });

  it('warns about beats that change nothing', () => {
    const s = base();
    s.beats.push({ title: 'Pause', narration: 'Think about it.', actions: [{ do: 'wait' } as any] });
    const r = validateScene(s);
    expect(r.ok && r.warnings.some((w) => w.path === 'beats[1]')).toBe(true);
  });

  it('formats issues for a repair prompt', () => {
    const text = formatIssuesForRepair([{ path: 'beats[0].actions[1].target', message: '"x" is not an entity in this scene' }]);
    expect(text).toBe('- beats[0].actions[1].target: "x" is not an entity in this scene');
  });
});
