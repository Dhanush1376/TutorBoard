/**
 * Retention: conversations and their learning data are kept until the learner
 * deletes them. No timer may delete them; disposable data keeps its expiry.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import SessionLedger from '../models/SessionLedger.js';
import EngineSessionState from '../models/EngineSessionState.js';
import { removeConversationExpiry } from '../core/migrations/removeConversationExpiry.js';

const quiet = { info: () => {}, warn: () => {} };
const ttlIndexes = (schema: mongoose.Schema) =>
  schema.indexes().filter(([, opts]) => opts && typeof (opts as any).expireAfterSeconds === 'number');
const pathTtl = (schema: mongoose.Schema) =>
  Object.values(schema.paths).filter((p: any) => typeof p.options?.index === 'object' && typeof p.options.index.expireAfterSeconds === 'number');

describe('schemas', () => {
  it('conversation data has no expiry index', () => {
    for (const model of [ChatSession, ChatMessage, Artifact]) {
      expect(ttlIndexes(model.schema), model.modelName).toEqual([]);
      expect(pathTtl(model.schema), model.modelName).toEqual([]);
    }
  });

  it('disposable data keeps its expiry (request ledger, live engine state)', () => {
    expect(ttlIndexes(SessionLedger.schema).length).toBeGreaterThan(0);
    expect(pathTtl(EngineSessionState.schema).length).toBeGreaterThan(0);
  });
});

describe('removeConversationExpiry migration', () => {
  const seedOldDatabase = async () => {
    // what an older deployment left behind: a 90-day TTL on conversations
    await ChatSession.collection.createIndex({ lastUpdated: 1 }, { name: 'lastUpdated_1', expireAfterSeconds: 90 * 24 * 3600 });
    await ChatMessage.collection.createIndex({ createdAt: 1 }, { name: 'stray_ttl', expireAfterSeconds: 3600 });
    await SessionLedger.collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 24 * 3600 });
    const yearOld = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const s: any = await ChatSession.create({ title: 'old but wanted', lastUpdated: yearOld });
    await ChatSession.collection.updateOne({ _id: s._id }, { $set: { lastUpdated: yearOld } });
    await ChatMessage.create({ sessionId: s._id, role: 'user', content: 'kept' });
    return s;
  };

  it('dry run reports but changes nothing', async () => {
    await seedOldDatabase();
    const report = await removeConversationExpiry(mongoose.connection, { dryRun: true, log: quiet });
    expect(report.map((r) => `${r.collection}.${r.index}`).sort()).toEqual(['chatmessages.stray_ttl', 'chatsessions.lastUpdated_1']);
    expect(report.every((r) => !r.dropped)).toBe(true);
    const still = await ChatSession.collection.indexes();
    expect(still.some((i) => i.name === 'lastUpdated_1')).toBe(true);
  });

  it('drops only conversation expiry indexes, keeps every document, and is idempotent', async () => {
    const s = await seedOldDatabase();
    const report = await removeConversationExpiry(mongoose.connection, { log: quiet });
    expect(report.filter((r) => r.dropped)).toHaveLength(2);

    const sessionIdx = await ChatSession.collection.indexes();
    const messageIdx = await ChatMessage.collection.indexes();
    expect(sessionIdx.some((i) => typeof i.expireAfterSeconds === 'number')).toBe(false);
    expect(messageIdx.some((i) => typeof i.expireAfterSeconds === 'number')).toBe(false);
    // disposable data untouched
    const ledgerIdx = await SessionLedger.collection.indexes();
    expect(ledgerIdx.some((i) => typeof i.expireAfterSeconds === 'number')).toBe(true);

    // documents are all still there, including a year-old conversation
    expect(await ChatSession.countDocuments({ _id: s._id })).toBe(1);
    expect(await ChatMessage.countDocuments({ sessionId: s._id })).toBe(1);

    // second run: nothing to do
    expect(await removeConversationExpiry(mongoose.connection, { log: quiet })).toEqual([]);
  });

  it('is a no-op on a fresh database', async () => {
    await ChatSession.init();
    expect(await removeConversationExpiry(mongoose.connection, { log: quiet })).toEqual([]);
  });
});

describe('explicit deletion still works', () => {
  it('deleting a conversation removes its messages and artifacts (and only those)', async () => {
    const { deleteSession } = await import('../controllers/session.controller.js');
    const userId = new mongoose.Types.ObjectId();
    const mine: any = await ChatSession.create({ userId, title: 'mine' });
    const other: any = await ChatSession.create({ userId, title: 'other' });
    await ChatMessage.create({ sessionId: mine._id, role: 'user', content: 'a' });
    await ChatMessage.create({ sessionId: other._id, role: 'user', content: 'b' });

    let status = 200;
    const res: any = { status(c: number) { status = c; return res; }, json() { return res; } };
    await deleteSession({ params: { id: mine._id.toString() }, user: { _id: userId }, headers: {}, body: {}, query: {} } as any, res);

    expect(status).toBe(200);
    expect(await ChatSession.countDocuments({ _id: mine._id })).toBe(0);
    expect(await ChatMessage.countDocuments({ sessionId: mine._id })).toBe(0);
    expect(await ChatSession.countDocuments({ _id: other._id })).toBe(1);
    expect(await ChatMessage.countDocuments({ sessionId: other._id })).toBe(1);
  });
});
