/**
 * Chemistry in the real engine (jsdom): stereocentres drawn as a projection,
 * bonds and lone pairs addressable as parts, curly arrows anchored to them.
 */
import { describe, expect, it } from 'vitest';
import combustion from '../../../../server/engine/scene/fixtures/methane-combustion.json';
import sn2 from '../../../../server/engine/scene/fixtures/sn2-mechanism.json';
import { SceneEngine } from '../engine';
import { moleculeLayout } from '../geometry';
import type { EntityOf } from '../types';

const mount = async (scene: unknown) => {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 1600 });
  Object.defineProperty(host, 'clientHeight', { value: 900 });
  document.body.appendChild(host);
  const engine = new SceneEngine(host);
  await engine.load(scene);
  return { host, engine };
};
const deg = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

describe('stereocentres', () => {
  it('draws two plain bonds in a V and the wedge and dash below them', () => {
    const m = sn2.entities.find((e) => e.id === 'mebr') as unknown as EntityOf<'molecule'>;
    const g = moleculeLayout(m);
    const c = g.pos[0];
    // screen angles: plain Br and Ha up-left / up-right; wedge (Hb) down-left, dash (Hc) down-right
    expect(deg(c, g.pos[1])).toBeCloseTo(-150, 6);
    expect(deg(c, g.pos[2])).toBeCloseTo(-30, 6);
    expect(deg(c, g.pos[3])).toBeCloseTo(150, 6);
    expect(deg(c, g.pos[4])).toBeCloseTo(30, 6);
  });

  it('leaves a centre without stereo bonds as before (methane stays a cross)', () => {
    const m = combustion.entities.find((e) => e.id === 'ch4') as unknown as EntityOf<'molecule'>;
    const g = moleculeLayout(m);
    expect(g.pos.slice(1).map((p) => Math.round(deg(g.pos[0], p))).sort((a, b) => a - b)).toEqual([-90, 0, 90, 180]);
  });
});

describe('mechanism scenes', () => {
  it('exposes bonds (either way round) and lone pairs as parts', async () => {
    const { engine } = await mount(sn2);
    const mebr = engine.builts.get('mebr')!;
    const bond = mebr.part!('C-Br')!;
    expect(bond).not.toBeNull();
    expect(mebr.part!('Br-C')).toBe(bond);
    const c = mebr.part!('C')!.at, br = mebr.part!('Br')!.at;
    expect(bond.at.x).toBeCloseTo((c.x + br.x) / 2, 6); // the bond's middle
    expect(engine.builts.get('oh')!.part!('lp-O')).not.toBeNull();
    expect(engine.builts.get('br')!.part!('lp-Br')).not.toBeNull();
  });

  it('draws each curly arrow between its two anchors, and every beat plays', async () => {
    const { host, engine } = await mount(sn2);
    for (const id of ['attack', 'leave']) {
      expect(engine.builts.get(id), id).toBeTruthy();
      expect(host.querySelector(`[data-entity="${id}"] path`)!.getAttribute('d')).toMatch(/^M[\d.-]+,[\d.-]+ Q/);
    }
    for (let i = 0; i < engine.beatCount; i++) expect(() => engine.seekBeat(i, 'end')).not.toThrow();
  });

  it('writes coefficients and plus signs around the laid-out molecules', async () => {
    const { host } = await mount(combustion);
    const texts = [...host.querySelectorAll('[data-entity="rx"] text')].map((t) => t.textContent);
    expect(texts.filter((t) => t === '+')).toHaveLength(2);
    expect(texts.filter((t) => t === '2')).toHaveLength(2);
    expect(texts).toContain('spark');
  });
});
