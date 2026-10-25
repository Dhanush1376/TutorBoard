/**
 * Engine behaviour that makes chat feel like ChatGPT/Claude:
 *  - a dropped connection does not cancel the answer; only an explicit Stop does
 *  - Stop only works for the generation's owner
 *  - a slow planner never holds back the first token
 *  - a reopened conversation reports an answer still being generated
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';

const h = vi.hoisted(() => {
  process.env.CHAT_PLANNER_BUDGET_MS = '200';
  return { planner: null as null | (() => Promise<any>), calls: 0 };
});

vi.mock('../utils/ai/llmClient.js', () => ({
  requestCompletion: vi.fn(async (p: any) => {
    h.calls++;
    for (const t of ['Fast ', 'answer.']) p.onStream?.(t);
    return { content: 'Fast answer.', _meta: {} };
  }),
  getTextModel: () => 'test-model',
  resolveModelId: (m?: string) => m || 'test-model',
}));
vi.mock('../services/chat/planner.service.js', () => ({
  default: {
    generatePlan: vi.fn(() => (h.planner ? h.planner() : new Promise(() => { /* never resolves */ }))),
    getFallbackPlan: () => ({
      teaching_mode: 'explain', complexity: 'intermediate', educational_intent: 'general inquiry',
      tools: { rag: false, web_search: false },
      visualization: { generate: false, type: 'none', necessity: 'none' },
      artifacts: { generate: false, type: 'none' },
    }),
  },
}));
vi.mock('../services/chat/orchestrator.js', () => ({
  default: { execute: vi.fn(async () => ({ narration: { narrations: [] }, visualScript: null, sceneV2: null, sceneBranch: null, metadata: { stages: {} } })) },
}));
vi.mock('../engine/core/vectorStore.js', () => ({ default: { addMemory: vi.fn(async () => {}), getContextForTopic: vi.fn(async () => '') } }));
vi.mock('../utils/ai/webSearchService.js', () => ({ searchWeb: vi.fn(async () => []) }));

import { StreamLifecycleManager } from '../services/chat/stream.service.js';
import { generationRegistry } from '../services/chat/generationRegistry.js';
import chatService from '../services/chat/chat.service.js';
import ChatMessage from '../models/ChatMessage.js';
import ChatSession from '../models/ChatSession.js';
import SessionLedger from '../models/SessionLedger.js';
import { getSession } from '../controllers/session.controller.js';
import { stopGeneration } from '../controllers/chat.controller.js';

/** Minimal express Response for the SSE manager. */
function fakeRes() {
  const res: any = new EventEmitter();
  res.writable = true;
  res.chunks = [] as string[];
  res.writeHead = vi.fn();
  res.flushHeaders = vi.fn();
  res.write = vi.fn((c: string) => { res.chunks.push(c); return true; });
  res.end = vi.fn(() => { res.writable = false; });
  return res;
}

const call = async (handler: any, req: any) => {
  let status = 200;
  let body: any;
  const res: any = { status(c: number) { status = c; return res; }, json(b: any) { body = b; return res; } };
  await handler({ query: {}, params: {}, body: {}, headers: {}, ...req }, res);
  return { status, body };
};

beforeEach(async () => {
  h.planner = null;
  h.calls = 0;
  await Promise.all([ChatMessage.init(), SessionLedger.init()]);
});

describe('stream lifetime', () => {
  it('a dropped connection does not cancel the generation', () => {
    const res = fakeRes();
    const m = new StreamLifecycleManager(res, 'req-a');
    res.emit('close');
    expect(m.clientDisconnected).toBe(true);
    expect(m.signal.aborted).toBe(false);
    m.send({ type: 'chunk', content: 'after close' }); // silently dropped
    expect(res.chunks.some((c: string) => c.includes('after close'))).toBe(false);
  });

  it('an explicit stop cancels it', () => {
    const m = new StreamLifecycleManager(fakeRes(), 'req-b');
    m.stop();
    expect(m.signal.aborted).toBe(true);
  });

  it('an answer whose tab was closed is still completed and saved', async () => {
    const res = fakeRes();
    const m = new StreamLifecycleManager(res, 'req-c');
    res.emit('close'); // learner refreshed right away
    await chatService.processMessage({ sessionId: 'key-closed', userMessage: 'Hi', mode: 'explain', requestId: 'req-c', streamManager: m });
    const saved: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    expect(saved.content).toBe('Fast answer.');
    expect(saved.status).toBe('completed');
  });
});

describe('POST /api/chat/stop', () => {
  it('stops only the owner\'s generation', async () => {
    const stop = vi.fn();
    const unregister = generationRegistry.register({ requestId: 'r-user', userId: 'u1', startedAt: Date.now(), stop });
    expect((await call(stopGeneration, { user: { _id: 'u2' }, body: { requestId: 'r-user' } })).status).toBe(403);
    expect((await call(stopGeneration, { body: { requestId: 'r-user' } })).status).toBe(403);
    expect(stop).not.toHaveBeenCalled();
    expect((await call(stopGeneration, { user: { _id: 'u1' }, body: { requestId: 'r-user' } })).body.status).toBe('stopped');
    expect(stop).toHaveBeenCalledOnce();
    unregister();
  });

  it('a guest must be the same verified guest', async () => {
    const stop = vi.fn();
    const unregister = generationRegistry.register({ requestId: 'r-guest', userId: null, guestId: 'g1', startedAt: Date.now(), stop });
    expect((await call(stopGeneration, { guestId: 'g2', body: { requestId: 'r-guest' } })).status).toBe(403);
    expect((await call(stopGeneration, { guestId: 'g1', body: { requestId: 'r-guest' } })).body.status).toBe('stopped');
    unregister();
  });

  it('a guest without an identity must name the conversation', async () => {
    const stop = vi.fn();
    const unregister = generationRegistry.register({ requestId: 'r-anon', userId: null, sessionKey: 'key-1', startedAt: Date.now(), stop });
    expect((await call(stopGeneration, { body: { requestId: 'r-anon' } })).status).toBe(403);
    expect((await call(stopGeneration, { body: { requestId: 'r-anon', sessionId: 'key-2' } })).status).toBe(403);
    expect((await call(stopGeneration, { body: { requestId: 'r-anon', sessionId: 'key-1' } })).body.status).toBe('stopped');
    unregister();
  });

  it('a duplicate request cannot take over the original\'s entry', async () => {
    const original = vi.fn();
    const un1 = generationRegistry.register({ requestId: 'r-dup', userId: 'u1', startedAt: Date.now(), stop: original });
    const un2 = generationRegistry.register({ requestId: 'r-dup', userId: 'u1', startedAt: Date.now(), stop: vi.fn() });
    un2(); // the duplicate finishing must not unregister the original
    await call(stopGeneration, { user: { _id: 'u1' }, body: { requestId: 'r-dup' } });
    expect(original).toHaveBeenCalledOnce();
    un1();
  });

  it('stopping an answer that already finished is a no-op', async () => {
    expect((await call(stopGeneration, { user: { _id: 'u1' }, body: { requestId: 'gone' } })).body.status).toBe('not_found');
  });
});

describe('time to first token', () => {
  it('a planner that never answers does not hold the answer back', async () => {
    const res = fakeRes();
    const started = Date.now();
    await chatService.processMessage({ sessionId: 'key-slow', userMessage: 'Why is the sky blue?', mode: 'explain', requestId: 'req-slow', streamManager: new StreamLifecycleManager(res, 'req-slow') });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(res.chunks.join('')).toContain('Fast ');
  });
});

describe('resume after reload', () => {
  it('reports an answer still being generated, and stops reporting it once done', async () => {
    const userId = new mongoose.Types.ObjectId();
    const s: any = await ChatSession.create({ userId, title: 'x' });
    await SessionLedger.create({ sessionId: s._id, requestId: 'r-live', status: 'streaming' });
    const live = await call(getSession, { user: { _id: userId }, params: { id: s._id.toString() } });
    expect(live.body.pendingRequest).toMatchObject({ requestId: 'r-live', status: 'streaming' });

    await SessionLedger.updateOne({ sessionId: s._id, requestId: 'r-live' }, { status: 'completed' });
    const done = await call(getSession, { user: { _id: userId }, params: { id: s._id.toString() } });
    expect(done.body.pendingRequest).toBeNull();
  });
});
