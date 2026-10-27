/**
 * A guest's chats are never lost: their guest identity does not expire.
 *  - a token past its expiry still opens the same conversations, and is renewed
 *  - an active guest's token is renewed for the SAME guest id
 *  - a forged token is still refused
 *  - every conversation is reachable page by page (none hidden past page 1)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import sessionRoutes from '../routes/session.js';
import { GUEST_COOKIE_NAME } from '../utils/auth/guestToken.js';

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/sessions', sessionRoutes);
});

/** A guest token signed by the server, issued `ageDays` ago, lasting `lifeDays`. */
const tokenFor = (guestId: string, ageDays: number, lifeDays = 30) => {
  const iat = Math.floor(Date.now() / 1000) - ageDays * 86400;
  return jwt.sign({ guestId, type: 'guest', jti: `jti-${guestId}-${ageDays}`, iat, exp: iat + lifeDays * 86400 }, process.env.JWT_SECRET as string, { algorithm: 'HS256' });
};

const chatOf = async (guestId: string, title: string) => {
  const s: any = await ChatSession.create({ guestId, userId: null, title, lastUpdated: new Date() });
  await ChatMessage.create({ sessionId: s._id, role: 'user', content: `About ${title}`, guestId });
  return s;
};

const list = (cookie: string, page = 1) =>
  request(app).get(`/api/sessions?page=${page}&limit=15`).set('Cookie', cookie);

describe('guest chats are never lost', () => {
  it('an expired guest token still opens the same chats, and comes back renewed for the same guest', async () => {
    const guestId = 'gst_expired_guest';
    await chatOf(guestId, 'Binary heaps');
    const expired = tokenFor(guestId, 45); // issued 45 days ago, expired after 30

    const res = await list(`${GUEST_COOKIE_NAME}=${expired}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: any) => s.title)).toEqual(['Binary heaps']);

    const renewed = res.headers['x-guest-token'];
    expect(renewed).toBeTruthy();
    const decoded: any = jwt.decode(renewed);
    expect(decoded.guestId).toBe(guestId); // same identity, not a new one
    expect(decoded.exp * 1000).toBeGreaterThan(Date.now() + 300 * 86400 * 1000);
    expect(String(res.headers['set-cookie'])).toContain(GUEST_COOKIE_NAME);
  });

  it('a fresh token is not re-issued on every request', async () => {
    const res = await list(`${GUEST_COOKIE_NAME}=${tokenFor('gst_fresh_guest', 0, 400)}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-guest-token']).toBeUndefined();
  });

  it('a forged token is refused, and reaches nobody\'s chats', async () => {
    await chatOf('gst_victim', 'Private');
    const forged = jwt.sign({ guestId: 'gst_victim', type: 'guest', jti: 'x' }, 'not-the-server-secret', { algorithm: 'HS256' });
    const res = await list(`${GUEST_COOKIE_NAME}=${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_GUEST_TOKEN');
  });

  it('every one of a guest\'s chats is reachable — none is dropped past the first page', async () => {
    const guestId = 'gst_many_chats';
    for (let i = 0; i < 20; i++) await chatOf(guestId, `Chat ${i}`);
    const cookie = `${GUEST_COOKIE_NAME}=${tokenFor(guestId, 0, 400)}`;
    const first = await list(cookie, 1);
    expect(first.body.sessions).toHaveLength(15);
    expect(first.body.pagination.hasMore).toBe(true);
    const second = await list(cookie, 2);
    const titles = [...first.body.sessions, ...second.body.sessions].map((s: any) => s.title);
    expect(new Set(titles).size).toBe(20);
  });
});
