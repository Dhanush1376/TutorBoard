import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coerceScene, parseModelJSON, restoreLatex } from '../engine/scene/coerce.js';
import { validateScene } from '../engine/scene/index.js';
import { strictParseJSON } from '../engine/core/utils/jsonUtils.js';

const golden = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));

describe('coercion — the slips that cost repair rounds in the first live run', () => {
  it('maps an unknown highlight state to the nearest real one', () => {
    const s = golden('bubble-sort.json');
    s.beats[2].actions[0].state = 'highlighted';
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.scene.beats[2].actions[0] as { state: string }).state).toBe('active');
      expect(r.warnings.some((w) => /"highlighted" → "active"/.test(w.message))).toBe(true);
    }
  });

  it('drops a space used as a create target (spaces appear with their entities)', () => {
    const s = golden('projectile-45.json');
    s.beats[0].actions.unshift({ do: 'create', target: 'field' });
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene.beats[0].actions[0]).toMatchObject({ do: 'create', target: 'ball' });
  });

  it('splits a list target on a single-target action into separate actions', () => {
    const s = golden('water-molecule.json');
    s.beats[2].actions.push({ do: 'unannotate', target: ['h2o.H1', 'h2o.H2'] });
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tail = r.scene.beats[2].actions.slice(-2);
      expect(tail).toEqual([
        { do: 'unannotate', target: 'h2o.H1' },
        { do: 'unannotate', target: 'h2o.H2', with: 'previous' },
      ]);
    }
  });
});

describe('coercion — aliases and gaps', () => {
  it('understands common entity and action aliases', () => {
    const { value, fixes } = coerceScene({
      title: 'x', domain: 'math',
      entities: [{ id: 'e', type: 'equation', text: 'a^2+b^2=c^2' }, { id: 't', type: 'heading', text: 'Hi' }],
      beats: [{ title: 'a', actions: [{ do: 'show', targets: ['e', 't'] }, { do: 'pulse', target: 'e' }] }],
    }) as { value: any; fixes: unknown[] };
    expect(value.version).toBe('1');
    expect(value.entities[0]).toMatchObject({ type: 'math', latex: 'a^2+b^2=c^2' });
    expect(value.entities[1]).toMatchObject({ type: 'text', role: 'title' });
    expect(value.beats[0].narration).toBe('a');
    expect(value.beats[0].actions[0]).toMatchObject({ do: 'create', target: ['e', 't'] });
    expect(value.beats[0].actions[1]).toMatchObject({ do: 'highlight', hold: false, state: 'active' });
    expect(fixes.length).toBeGreaterThan(4);
  });

  it('turns bare region names into placements and relation aliases into relations', () => {
    const { value } = coerceScene({ layout: [{ rel: 'left', id: 'a' }, { rel: 'under', id: 'b', of: 'a' }, { rel: 'center', id: 'c' }] }) as { value: any };
    expect(value.layout).toEqual([
      { rel: 'place', id: 'a', region: 'left' },
      { rel: 'below', id: 'b', of: 'a' },
      { rel: 'place', id: 'c', region: 'center' },
    ]);
  });

  it('leaves valid golden scenes untouched', () => {
    for (const f of ['bubble-sort.json', 'stack-vs-queue.json', 'triangle-angle-sum.json', 'projectile-45.json', 'water-molecule.json', 'neural-network.json']) {
      expect(coerceScene(golden(f)).fixes).toEqual([]);
    }
  });
});

describe('coercion — slips seen with low reasoning effort (docs/eval/runs/flash36-low)', () => {
  const heapScene = () => {
    const s = golden('heap-insert.json');
    // the model creates n5 in a beat but never declares it
    const tree = s.entities.find((e: { type: string }) => e.type === 'tree');
    tree.nodes = tree.nodes.filter((n: { id: string }) => n.id !== 'n5');
    return s;
  };

  it('declares a heap node the beats create, with its heap-index parent and the pushed value', () => {
    const r = validateScene(heapScene());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tree = r.scene.entities.find((e) => e.type === 'tree') as { nodes: { id: string; value: unknown; parent?: string }[] };
      expect(tree.nodes.find((n) => n.id === 'n5')).toEqual({ id: 'n5', value: 3, parent: 'n2' });
      expect(r.warnings.some((w) => /declared "n5"/.test(w.message))).toBe(true);
    }
  });

  it('leaves an undeclared node in a non-heap tree for the model to fix', () => {
    const s = heapScene();
    const tree = s.entities.find((e: { type: string }) => e.type === 'tree');
    tree.nodes[1].parent = 'n2'; // no longer heap-indexed
    tree.nodes.find((n: { id: string }) => n.id === 'n2').parent = 'n0';
    expect(validateScene(s).ok).toBe(false);
  });

  it('makes duplicate polygon vertex labels unique', () => {
    const s = golden('triangle-angle-sum.json');
    const poly = s.entities.find((e: { type: string }) => e.type === 'polygon');
    const { value } = coerceScene({ ...s, entities: [{ ...poly, vertexLabels: ['', '', 'A'] }] }) as { value: any };
    expect(value.entities[0].vertexLabels).toEqual(['B', 'C', 'A']);
  });

  it('decodes entities and actions written as JSON strings', () => {
    const s = golden('triangle-angle-sum.json');
    s.entities = s.entities.map((e: unknown, i: number) => (i % 2 ? JSON.stringify(e) : e));
    s.beats[0].actions = s.beats[0].actions.map((a: unknown) => JSON.stringify(a));
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene).toEqual((validateScene(golden('triangle-angle-sum.json')) as { scene: unknown }).scene);
  });

  it('maps annotate sides top/bottom to above/below', () => {
    const s = golden('water-molecule.json');
    s.beats[1].actions.push({ do: 'annotate', target: 'h2o.O', text: 'oxygen', side: 'top' });
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene.beats[1].actions.at(-1)).toMatchObject({ side: 'above' });
  });

  it('repairs or drops a "set" with nothing to set', () => {
    const { value, fixes } = coerceScene({
      beats: [{ title: 't', narration: 'n', actions: [
        { do: 'set', target: 'dot', to: [1, 2] },
        { do: 'set', target: 'arr[2]', label: '7' },
        { do: 'set', target: 'msg', label: 'done' },
        { do: 'set', target: 'arr[0]', state: 'sorted' },
        { do: 'set', target: 'grad' },
      ] }],
    }) as { value: any; fixes: unknown[] };
    expect(value.beats[0].actions).toEqual([
      { do: 'move', target: 'dot', to: [1, 2] },
      { do: 'set', target: 'arr[2]', label: '7', value: '7' },
      { do: 'set', target: 'msg', label: 'done', text: 'done' },
      { do: 'highlight', target: 'arr[0]', state: 'sorted' },
    ]);
    expect(fixes.length).toBe(5);
  });
});

describe('over-escaped LaTeX (docs/eval/runs/full-48/math-4)', () => {
  it('collapses a doubled backslash before a spacing command, not a real line break', async () => {
    const { restoreLatex: fix } = await import('../engine/scene/coerce.js');
    expect(fix('\\int_0^2 x\\\\,dx')).toBe('\\int_0^2 x\\,dx');
    expect(fix('a \\\\ b')).toBe('a \\\\ b'); // matrix row break stays
    expect(fix("v_2'\\\\\\frac12 mv^2")).toBe("v_2'\\\\\\frac12 mv^2"); // a line break, then \frac: untouched
  });
});

describe('LaTeX that collides with JSON escapes', () => {
  it('parses "\\alpha"-style invalid escapes instead of failing', () => {
    const raw = '{"latex": "\\alpha + \\sqrt{2}"}';
    expect(parseModelJSON(raw, strictParseJSON)).toEqual({ latex: '\\alpha + \\sqrt{2}' });
  });

  it('restores \\frac, \\theta, \\beta, \\rho, \\nabla eaten as control characters', () => {
    const eaten = JSON.parse('"\\frac{1}{2} \\theta \\beta \\rho \\nabla"');
    expect(restoreLatex(eaten)).toBe('\\frac{1}{2} \\theta \\beta \\rho \\nabla');
    const r = coerceScene({ entities: [{ id: 'm', type: 'math', latex: eaten }] }) as { value: any; fixes: unknown[] };
    expect(r.value.entities[0].latex).toBe('\\frac{1}{2} \\theta \\beta \\rho \\nabla');
  });
});
