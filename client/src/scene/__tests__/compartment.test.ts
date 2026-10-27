/**
 * Labelled compartment diagrams in the real engine (jsdom): every part drawn and
 * labelled, parts addressable for highlights and callouts.
 */
import { describe, expect, it } from 'vitest';
import plant from '../../../../server/engine/scene/fixtures/plant-cell.json';
import compare from '../../../../server/engine/scene/fixtures/prokaryote-eukaryote.json';
import { SceneEngine } from '../engine';

const mount = async (scene: unknown) => {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 1600 });
  Object.defineProperty(host, 'clientHeight', { value: 900 });
  document.body.appendChild(host);
  const engine = new SceneEngine(host);
  await engine.load(scene);
  return { host, engine };
};

describe('compartment diagrams', () => {
  it('draws one label per part, with its leader', async () => {
    const { host } = await mount(plant);
    const g = host.querySelector('[data-entity="cell"]')!;
    const labels = [...g.querySelectorAll('text')].map((t) => t.textContent);
    for (const p of plant.entities[0].parts as { label: string }[]) expect(labels, p.label).toContain(p.label);
    expect(g.querySelectorAll('polyline').length).toBeGreaterThanOrEqual((plant.entities[0] as { parts: unknown[] }).parts.length);
    // copies: four chloroplasts drawn, one labelled
    expect(labels.filter((t) => t === 'chloroplast')).toHaveLength(1);
  });

  it('makes each part addressable, inside the diagram', async () => {
    const { engine } = await mount(plant);
    const cell = engine.builts.get('cell')!;
    for (const id of ['wall', 'membrane', 'vacuole', 'nucleus', 'nucleolus', 'chloroplast', 'mito', 'golgi']) {
      const part = cell.part!(id);
      expect(part, id).not.toBeNull();
      expect(part!.at.x).toBeGreaterThanOrEqual(cell.box.x);
      expect(part!.at.x).toBeLessThanOrEqual(cell.box.x + cell.box.w);
    }
    // the nucleolus sits inside the nucleus
    const nuc = cell.part!('nucleus')!, ncl = cell.part!('nucleolus')!;
    expect(Math.hypot(ncl.at.x - nuc.at.x, ncl.at.y - nuc.at.y)).toBeLessThan(nuc.box.w / 2);
  });

  it('plays every beat: highlights on parts of two diagrams at once', async () => {
    const { engine } = await mount(compare);
    for (let i = 0; i < engine.beatCount; i++) expect(() => engine.seekBeat(i, 'end')).not.toThrow();
    expect(engine.builts.get('bact')!.part!('nucleoid')).not.toBeNull();
    expect(engine.builts.get('animal')!.part!('envelope')).not.toBeNull();
  });
});
