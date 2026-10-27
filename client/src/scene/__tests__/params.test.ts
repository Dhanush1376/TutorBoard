/**
 * Sliders end to end in the real engine (jsdom): moving a parameter redraws
 * every bound entity at the same moment of the lesson.
 */
import { describe, expect, it } from 'vitest';
import projectile from '../../../../server/engine/scene/fixtures/projectile-sliders.json';
import spring from '../../../../server/engine/scene/fixtures/spring-oscillator.json';
import { SceneEngine } from '../engine';

const mount = () => {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 1600 });
  Object.defineProperty(host, 'clientHeight', { value: 900 });
  document.body.appendChild(host);
  return { host, engine: new SceneEngine(host) };
};
const centre = (engine: SceneEngine, id: string) => {
  const b = engine.builts.get(id)!.box;
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};

describe('parameters in the engine', () => {
  it('opens a lesson with the slider values it was left at (clamped), and a new lesson at its defaults', async () => {
    const { engine } = mount();
    await engine.load(projectile, { v0: 10, theta0: 200 });
    expect(engine.paramState.values).toEqual({ v0: 10, theta0: 75, g: 9.8 });
    const left = centre(engine, 'land');
    const { engine: fresh } = mount();
    await fresh.load(projectile);
    await fresh.setParams({ v0: 10, theta0: 75 });
    expect(centre(fresh, 'land')).toEqual(left); // same board as moving the sliders by hand
    await engine.load(spring);
    expect(Object.values(engine.paramState.values)).toEqual(engine.paramState.params.map((p) => p.value));
  });

  it('exposes the sliders and the derived values', async () => {
    const { engine } = mount();
    await engine.load(projectile);
    const st = engine.paramState;
    expect(st.params.map((p) => p.id)).toEqual(['v0', 'theta0', 'g']);
    expect(st.values).toEqual({ v0: 20, theta0: 45, g: 9.8 });
    expect(st.derived.find((d) => d.id === 'R')!.value).toBeCloseTo(400 / 9.8, 6);
  });

  it('moves the landing point and rewrites its label, staying on the same beat', async () => {
    const { host, engine } = mount();
    await engine.load(projectile);
    engine.seekBeat(3, 'end');
    const before = centre(engine, 'land');
    await engine.setParams({ v0: 10 });
    expect(engine.beatIndex).toBe(3);
    const after = centre(engine, 'land');
    expect(after.x).toBeLessThan(before.x); // a quarter of the range: R ∝ v0²
    expect(engine.paramState.derived.find((d) => d.id === 'R')!.value).toBeCloseTo(100 / 9.8, 6);
    expect(host.querySelector('[data-entity="flight"]')!.textContent).toContain(`${(20 * Math.sin(Math.PI / 4) / 9.8).toFixed(2)} s`);
  });

  it('keeps the learner\'s values while the same lesson is rebuilt, and resets them for a new one', async () => {
    const { engine } = mount();
    await engine.load(spring);
    await engine.setParams({ mass: 4 });
    await engine.refit();
    expect(engine.paramState.values.mass).toBe(4);
    await engine.load(projectile);
    await engine.load(spring);
    expect(engine.paramState.values.mass).toBe(1);
  });
});
