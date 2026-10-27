/**
 * Persistence of Engine v2 lessons, for every domain: a validated scene is
 * saved the way the chat saves it (artifact metadata + canvas snapshot in
 * MongoDB), read back, and must be the same lesson — the same scene, bindings,
 * derived quantities and provenance, and valid again without changes. Slider
 * values saved with the position give the same board as moving the sliders.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Artifact from '../models/Artifact.js';
import { validateScene } from '../engine/scene/index.js';
import { sceneToTimeline } from '../engine/scene/lesson.js';
import { resolveParams } from '../engine/scene/params.js';

const dir = new URL('../engine/scene/fixtures/', import.meta.url);
const goldens = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const valid = (name: string) => {
  const r = validateScene(JSON.parse(readFileSync(new URL(name, dir), 'utf8')));
  if (!r.ok) throw new Error(`${name}: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.scene;
};

describe('lessons survive saving and reopening', () => {
  it('covers every domain', () => {
    const domains = new Set(goldens.map((f) => valid(f).domain));
    expect([...domains].sort()).toEqual(expect.arrayContaining(['algorithms', 'biology', 'chemistry', 'data-structures', 'geometry', 'math', 'ml', 'physics']));
  });

  it.each(goldens)('%s: stored and read back unchanged, and still valid', async (name) => {
    const scene = valid(name);
    const t = sceneToTimeline(scene);
    const a = await Artifact.create({
      guestId: 'g-roundtrip', sessionId: 's-roundtrip', type: 'visual', title: t.title.slice(0, 200),
      content: JSON.stringify({ renderer: 'scene-v2', sceneV2: t.sceneV2, steps: t.steps }),
      sceneGraph: { steps: t.steps },
      metadata: { rendererType: 'scene-v2', sceneV2: t.sceneV2 },
    });
    const back: any = await Artifact.findById(a.id).lean();
    // what the client gets back (metadata, and the JSON content) is the lesson that was validated
    expect(back.metadata.sceneV2).toEqual(JSON.parse(JSON.stringify(t.sceneV2)));
    expect(JSON.parse(back.content).sceneV2).toEqual(back.metadata.sceneV2);
    expect(back.sceneGraph.steps).toHaveLength(scene.beats.length);
    // validating the stored lesson again changes nothing (computed beats are not recomputed twice, bindings kept)
    const again = validateScene(back.metadata.sceneV2);
    expect(again.ok ? [] : again.errors.map((e) => e.message)).toEqual([]);
    if (again.ok) expect(JSON.parse(JSON.stringify(again.scene))).toEqual(back.metadata.sceneV2);
  });

  it.each(goldens.filter((f) => valid(f).params?.length))('%s: saved slider values give the same board as the sliders', async (name) => {
    const scene = valid(name) as any;
    const values = Object.fromEntries(scene.params.filter((p: any) => p.max > p.min).map((p: any) => [p.id, p.min + (p.max - p.min) / 3]));
    const a = await Artifact.create({ guestId: 'g-params', sessionId: 's', type: 'visual', title: 't', content: '{}', metadata: { sceneV2: scene } });
    await Artifact.updateOne({ _id: a.id }, { $set: { lessonProgress: { step: 0, totalSteps: scene.beats.length, savedAt: 1, params: values } } });
    const back: any = await Artifact.findById(a.id).lean();
    expect(back.lessonProgress.params).toEqual(values);
    const reopened = resolveParams(back.metadata.sceneV2, back.lessonProgress.params);
    const moved = resolveParams(scene, values);
    expect(reopened).toEqual(moved);
    expect(JSON.stringify(moved)).not.toEqual(JSON.stringify(resolveParams(scene))); // the values actually move something
  });
});
