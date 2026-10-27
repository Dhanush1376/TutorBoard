/**
 * Lesson progress (PATCH /api/artifact/:id/progress): the owner's last viewed
 * step is saved on the lesson's artifact, a late or stale save never overwrites
 * a newer one, a position from a lesson that has since changed is refused, and
 * nobody else can read or write it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import Artifact from '../models/Artifact.js';
import artifactRoutes from '../routes/artifact.routes.js';
import { generateGuestToken, GUEST_COOKIE_NAME } from '../utils/auth/guestToken.js';

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/artifact', artifactRoutes);
});

const guest = () => {
  const { guestId, token } = generateGuestToken();
  return { guestId, cookie: `${GUEST_COOKIE_NAME}=${token}` };
};

const lesson = (guestId: string, steps = 5) => Artifact.create({
  guestId, sessionId: 'session-1', type: 'visual', title: 'Circle area',
  content: '{}', sceneGraph: { steps: Array.from({ length: steps }, (_, i) => ({ title: `Step ${i + 1}` })) },
});

const save = (id: string, cookie: string, body: any) =>
  request(app).patch(`/api/artifact/${id}/progress`).set('Cookie', cookie).send(body);

describe('lesson progress', () => {
  it('saves the last viewed step and returns it with the artifact', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    const res = await save(a.id, g.cookie, { step: 3, totalSteps: 5, savedAt: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.lessonProgress).toMatchObject({ step: 3, totalSteps: 5, completed: false, savedAt: 1000 });

    const got = await request(app).get(`/api/artifact/${a.id}`).set('Cookie', g.cookie);
    expect(got.body.lessonProgress).toMatchObject({ step: 3, totalSteps: 5 });
  });

  it('a completed lesson keeps its final step', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    const res = await save(a.id, g.cookie, { step: 4, totalSteps: 5, completed: true, savedAt: 2000 });
    expect(res.body.lessonProgress).toMatchObject({ step: 4, completed: true });
  });

  it('a save that arrives after a newer one does not overwrite it', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    await save(a.id, g.cookie, { step: 4, totalSteps: 5, savedAt: 3000 });
    const late = await save(a.id, g.cookie, { step: 1, totalSteps: 5, savedAt: 2500 });
    expect(late.status).toBe(200);
    expect(late.body.stale).toBe(true);
    expect(late.body.lessonProgress.step).toBe(4);
    const stored: any = await Artifact.findById(a.id).lean();
    expect(stored.lessonProgress.step).toBe(4);
  });

  it('a position taken on a different version of the lesson is refused', async () => {
    const g = guest();
    const a = await lesson(g.guestId, 5);
    const res = await save(a.id, g.cookie, { step: 6, totalSteps: 8, savedAt: 4000 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LESSON_CHANGED');
  });

  it('clamps a step past the end to the last step', async () => {
    const g = guest();
    const a = await lesson(g.guestId, 5);
    const res = await save(a.id, g.cookie, { step: 40, totalSteps: 5, savedAt: 5000 });
    expect(res.body.lessonProgress.step).toBe(4);
  });

  it('only the owner can save it', async () => {
    const owner = guest();
    const other = guest();
    const a = await lesson(owner.guestId);
    expect((await save(a.id, other.cookie, { step: 2, totalSteps: 5, savedAt: 6000 })).status).toBe(403);
    expect((await request(app).patch(`/api/artifact/${a.id}/progress`).send({ step: 2, totalSteps: 5, savedAt: 6000 })).status).toBe(403);
    const stored: any = await Artifact.findById(a.id).lean();
    expect(stored.lessonProgress).toBeNull();
  });

  it('keeps the slider values with the position, and returns them with the artifact', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    const res = await save(a.id, g.cookie, { step: 2, totalSteps: 5, savedAt: 7000, params: { v0: 12.5, theta0: 30 } });
    expect(res.status).toBe(200);
    expect(res.body.lessonProgress.params).toEqual({ v0: 12.5, theta0: 30 });
    const got = await request(app).get(`/api/artifact/${a.id}`).set('Cookie', g.cookie);
    expect(got.body.lessonProgress.params).toEqual({ v0: 12.5, theta0: 30 });
    // a later save with other values replaces them; an older one does not
    await save(a.id, g.cookie, { step: 2, totalSteps: 5, savedAt: 8000, params: { v0: 20, theta0: 45 } });
    await save(a.id, g.cookie, { step: 2, totalSteps: 5, savedAt: 7500, params: { v0: 5, theta0: 15 } });
    const stored: any = await Artifact.findById(a.id).lean();
    expect(stored.lessonProgress.params).toEqual({ v0: 20, theta0: 45 });
  });

  it('refuses slider values that are not plain numbers under parameter names', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    expect((await save(a.id, g.cookie, { step: 1, totalSteps: 5, savedAt: 9, params: { v0: 'fast' } })).status).toBe(400);
    expect((await save(a.id, g.cookie, { step: 1, totalSteps: 5, savedAt: 9, params: { '$where': 1 } })).status).toBe(400);
    expect((await save(a.id, g.cookie, { step: 1, totalSteps: 5, savedAt: 9, params: { 'a.b': 1 } })).status).toBe(400);
    const many = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`p${i}`, i]));
    expect((await save(a.id, g.cookie, { step: 1, totalSteps: 5, savedAt: 9, params: many })).status).toBe(400);
  });

  it('rejects a malformed position', async () => {
    const g = guest();
    const a = await lesson(g.guestId);
    expect((await save(a.id, g.cookie, { step: -1, totalSteps: 5, savedAt: 1 })).status).toBe(400);
    expect((await save(a.id, g.cookie, { step: 1, totalSteps: 5 })).status).toBe(400);
  });
});
