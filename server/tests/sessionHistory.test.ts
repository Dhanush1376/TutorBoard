/**
 * Conversation history endpoints: only the caller's conversations, newest
 * first, each with its latest messages in order — fetched in one query.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import { getSessions, getSession, saveSession } from '../controllers/session.controller.js';

const call = async (handler: any, req: any) => {
  let status = 200;
  let body: any;
  const res: any = {
    status(code: number) { status = code; return res; },
    json(b: any) { body = b; return res; },
    end() { return res; },
  };
  await handler({ query: {}, params: {}, body: {}, ...req }, res);
  return { status, body };
};

const seed = async (userId: any, title: string, minutesAgo: number, n: number) => {
  const s: any = await ChatSession.create({ userId, title, lastUpdated: new Date(Date.now() - minutesAgo * 60000) });
  const base = Date.now() - 3600000;
  await ChatMessage.insertMany(Array.from({ length: n }, (_, i) => ({
    sessionId: s._id, role: i % 2 ? 'assistant' : 'user', content: `${title}-${i}`, timestamp: new Date(base + i * 1000),
  })));
  return s;
};

describe('GET /api/sessions', () => {
  it("returns only the caller's conversations, newest first, with their latest 50 messages in order", async () => {
    const me = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    await seed(me, 'older', 30, 3);
    await seed(me, 'newer', 5, 60);
    await seed(other, 'theirs', 1, 2);
    const deleted = await seed(me, 'deleted', 0, 2);
    await ChatSession.updateOne({ _id: deleted._id }, { isDeleted: true });

    // req.user._id as a string (some auth paths) must still match
    const { body } = await call(getSessions, { user: { _id: me.toString() } });
    expect(body.sessions.map((s: any) => s.title)).toEqual(['newer', 'older']);
    const newer = body.sessions[0];
    expect(newer.messages).toHaveLength(50);
    expect(newer.messages[0].content).toBe('newer-10');
    expect(newer.messages.at(-1).content).toBe('newer-59');
    expect(body.pagination).toMatchObject({ total: 2, hasMore: false });
  });

  it('pages without duplicating or skipping conversations', async () => {
    const me = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) await seed(me, `s${i}`, i, 1);
    const p1 = await call(getSessions, { user: { _id: me }, query: { page: '1', limit: '2' } });
    const p2 = await call(getSessions, { user: { _id: me }, query: { page: '2', limit: '2' } });
    const p3 = await call(getSessions, { user: { _id: me }, query: { page: '3', limit: '2' } });
    const titles = [...p1.body.sessions, ...p2.body.sessions, ...p3.body.sessions].map((s: any) => s.title);
    expect(titles).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(p3.body.pagination.hasMore).toBe(false);
  });
});

describe('GET /api/sessions/:id', () => {
  it("returns 404 for another user's conversation and for malformed ids", async () => {
    const me = new mongoose.Types.ObjectId();
    const theirs = await seed(new mongoose.Types.ObjectId(), 'theirs', 0, 2);
    expect((await call(getSession, { user: { _id: me }, params: { id: theirs._id.toString() } })).status).toBe(404);
    expect((await call(getSession, { user: { _id: me }, params: { id: 'not-an-id' } })).status).toBe(404);
  });
});

describe('POST /api/sessions', () => {
  it('clips an over-long title instead of rejecting the whole save', async () => {
    const me = new mongoose.Types.ObjectId();
    const s = await seed(me, 'mine', 0, 1);
    const res = await call(saveSession, { user: { _id: me }, body: { sessionId: s._id.toString(), title: 'Q '.repeat(300) } });
    expect(res.status).toBe(200);
    expect(((await ChatSession.findById(s._id).lean()) as any).title.length).toBeLessThanOrEqual(200);
  });

  it('never writes chat messages from the client copy', async () => {
    const me = new mongoose.Types.ObjectId();
    const s = await seed(me, 'mine', 0, 2);
    const original: any = await ChatMessage.findOne({ sessionId: s._id, role: 'assistant' }).lean();
    await call(saveSession, {
      user: { _id: me },
      body: {
        sessionId: s._id.toString(),
        title: 'renamed',
        messages: [
          { id: original._id.toString(), role: 'assistant', content: 'overwritten by client' },
          { id: 'local-1', role: 'user', content: 'client-only duplicate' },
        ],
      },
    });
    expect(await ChatMessage.countDocuments({ sessionId: s._id })).toBe(2);
    expect(((await ChatMessage.findById(original._id).lean()) as any).content).toBe(original.content);
    expect(((await ChatSession.findById(s._id).lean()) as any).title).toBe('renamed');
  });

  it("cannot create a conversation with a client-chosen ObjectId or touch someone else's", async () => {
    const me = new mongoose.Types.ObjectId();
    const ghost = new mongoose.Types.ObjectId().toString();
    expect((await call(saveSession, { user: { _id: me }, body: { sessionId: ghost, title: 'x' } })).status).toBe(404);
    expect(await ChatSession.countDocuments({ _id: ghost })).toBe(0);

    const theirs = await seed(new mongoose.Types.ObjectId(), 'theirs', 0, 1);
    await call(saveSession, { user: { _id: me }, body: { sessionId: theirs._id.toString(), title: 'hijack' } });
    expect(((await ChatSession.findById(theirs._id).lean()) as any).title).toBe('theirs');
  });
});
