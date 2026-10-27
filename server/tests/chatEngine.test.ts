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
  process.env.CHAT_LEDGER_KEEPALIVE_MS = '50';
  return { planner: null as null | (() => Promise<any>), calls: 0, slowMs: 0, hangAfter: '' as string, orchestrateHang: false, orchestrateResult: null as any, orchestrateStartedAt: 0 };
});

vi.mock('../utils/ai/llmClient.js', () => ({
  requestCompletion: vi.fn(async (p: any) => {
    h.calls++;
    if (h.hangAfter) {
      p.onStream?.(h.hangAfter);
      await new Promise((_, reject) => {
        const fail = () => reject(Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' }));
        if (p.signal?.aborted) fail(); else p.signal?.addEventListener('abort', fail, { once: true });
      });
    }
    if (h.slowMs) await new Promise((r) => setTimeout(r, h.slowMs));
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
  default: {
    execute: vi.fn(() => {
      h.orchestrateStartedAt = Date.now();
      return h.orchestrateHang
        ? new Promise(() => { /* a visual lesson that takes a long time */ })
        : Promise.resolve(h.orchestrateResult || { narration: { narrations: [] }, visualScript: null, sceneV2: null, sceneBranch: null, metadata: { stages: {} } });
    }),
  },
}));
vi.mock('../engine/core/vectorStore.js', () => ({ default: { addMemory: vi.fn(async () => {}), getContextForTopic: vi.fn(async () => '') } }));
vi.mock('../utils/ai/webSearchService.js', () => ({ searchWeb: vi.fn(async () => []) }));

import { StreamLifecycleManager } from '../services/chat/stream.service.js';
import { generationRegistry, setCancellationRegistry, InMemoryCancellationRegistry } from '../services/chat/generationRegistry.js';
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
  h.slowMs = 0;
  h.hangAfter = '';
  h.orchestrateHang = false;
  h.orchestrateResult = null;
  h.orchestrateStartedAt = 0;
  await Promise.all([ChatMessage.init(), SessionLedger.init()]);
});

/** The SSE events a fake response received, in order. */
const events = (res: any) => res.chunks
  .filter((c: string) => c.startsWith('data: '))
  .map((c: string) => { try { return JSON.parse(c.slice(6)); } catch { return null; } })
  .filter(Boolean);
const progressOf = (res: any) => events(res).filter((e: any) => e.type === 'progress').map((e: any) => `${e.stage}:${e.state}`);

const plan = (over: any = {}) => ({
  teaching_mode: 'explain', complexity: 'intermediate', educational_intent: 'general inquiry',
  tools: { rag: false, web_search: false },
  visualization: { generate: false, type: 'none', necessity: 'none' },
  artifacts: { generate: false, type: 'none' },
  ...over,
});

describe('progress events', () => {
  it('report only the stages that really ran, each tagged with its request', async () => {
    h.planner = async () => plan();
    const res = fakeRes();
    await chatService.processMessage({ sessionId: 'key-p1', userMessage: 'What is a prime?', mode: 'explain', requestId: 'req-p1', streamManager: new StreamLifecycleManager(res, 'req-p1') });
    expect(progressOf(res)).toEqual(['planning:active', 'planning:done', 'writing:active', 'writing:done']);
    // no web search, memory or lesson was run, so none is reported
    expect(events(res).filter((e: any) => e.type === 'progress').every((e: any) => e.requestId === 'req-p1')).toBe(true);
  });

  it('a web search is reported while it runs and when it ends', async () => {
    h.planner = async () => plan({ tools: { rag: false, web_search: true } });
    const res = fakeRes();
    await chatService.processMessage({ sessionId: 'key-p2', userMessage: 'Latest news on Mars', mode: 'explain', requestId: 'req-p2', streamManager: new StreamLifecycleManager(res, 'req-p2') });
    const p = progressOf(res);
    expect(p).toContain('web:active');
    expect(p).toContain('web:done');
    expect(p.indexOf('web:done')).toBeLessThan(p.indexOf('writing:active'));
  });

  it('a lesson that could not be drawn ends as failed — never as done', async () => {
    h.planner = async () => plan({ visualization: { generate: true, type: 'd3', necessity: 'required' } });
    const res = fakeRes();
    await chatService.processMessage({ sessionId: 'key-p3', userMessage: 'Show me a heap', mode: 'explain', requestId: 'req-p3', streamManager: new StreamLifecycleManager(res, 'req-p3') });
    const p = progressOf(res);
    expect(p).toContain('lesson:active');
    expect(p).toContain('lesson:failed');
    expect(p).not.toContain('lesson:done');
  });

  it('a drawn lesson ends as done', async () => {
    h.planner = async () => plan({ visualization: { generate: true, type: 'd3', necessity: 'required' } });
    h.orchestrateResult = { narration: null, visualScript: { script: [{ cmd: 'node', id: 'a' }], renderer: 'd3' }, metadata: { stages: {} } };
    const res = fakeRes();
    await chatService.processMessage({ sessionId: 'key-p4', userMessage: 'Show me a heap', mode: 'explain', requestId: 'req-p4', streamManager: new StreamLifecycleManager(res, 'req-p4') });
    expect(progressOf(res)).toContain('lesson:done');
  });

  it('the answer goes out before the lesson: the lesson starts on the first token', async () => {
    h.planner = async () => plan({ visualization: { generate: true, type: 'd3', necessity: 'required' } });
    h.slowMs = 300; // time to first token
    const res = fakeRes();
    const started = Date.now();
    await chatService.processMessage({ sessionId: 'key-p5', userMessage: 'Show me a heap', mode: 'explain', requestId: 'req-p5', streamManager: new StreamLifecycleManager(res, 'req-p5') });
    expect(h.orchestrateStartedAt - started).toBeGreaterThanOrEqual(250);
    const ev = events(res);
    const firstChunk = ev.findIndex((e: any) => e.type === 'chunk');
    const lessonStart = ev.findIndex((e: any) => e.type === 'progress' && e.stage === 'lesson' && e.state === 'active');
    expect(firstChunk).toBeGreaterThan(-1);
    expect(lessonStart).toBeGreaterThan(firstChunk);
  });
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

describe('long generations', () => {
  it('keep their ledger entry fresh while running, so they never look abandoned', async () => {
    h.slowMs = 400;
    const run = chatService.processMessage({ sessionId: 'key-long', userMessage: 'A long lesson', mode: 'explain', requestId: 'req-long', streamManager: new StreamLifecycleManager(fakeRes(), 'req-long') });
    await new Promise((r) => setTimeout(r, 350)); // planner budget (200ms) passed; generation running
    const first: any = await SessionLedger.findOne({ requestId: 'req-long' }).lean();
    await new Promise((r) => setTimeout(r, 150));
    const later: any = await SessionLedger.findOne({ requestId: 'req-long' }).lean();
    expect(new Date(later.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime());
    await run;
    const done: any = await SessionLedger.findOne({ requestId: 'req-long' }).lean();
    expect(done.status).toBe('completed');
  });
});

describe('cancellation (Stop)', () => {
  /** Start a generation the way the stream controller does: registered for Stop. */
  const startRegistered = (requestId: string, owner: { userId?: string; guestId?: string }) => {
    const m = new StreamLifecycleManager(fakeRes(), requestId);
    const release = generationRegistry.register({
      requestId, userId: owner.userId || null, guestId: owner.guestId || null, startedAt: Date.now(), stop: () => m.stop(),
    });
    const run = chatService.processMessage({
      userId: owner.userId, guestId: owner.guestId, sessionId: `key-${requestId}`, userMessage: 'Explain recursion',
      mode: 'explain', requestId, streamManager: m,
    } as any).finally(release);
    return { m, run };
  };

  const settle = (p: Promise<unknown>) => p.then(() => 'resolved', (e) => e);

  it('aborts the model call, ends the stream, and saves the partial as cancelled — never completed', async () => {
    h.hangAfter = 'Recursion is when ';
    const owner = new mongoose.Types.ObjectId().toString();
    const { m, run } = startRegistered('req-stop', { userId: owner });
    await vi.waitFor(() => expect(h.calls).toBe(1));

    const res = await call(stopGeneration, { user: { _id: owner }, body: { requestId: 'req-stop' } });
    expect(res.body.status).toBe('stopped');
    const outcome: any = await settle(run);
    expect(outcome?.chatCode ?? outcome?.name).toMatch(/CANCELLED|AbortError|APIUserAbortError/);
    expect(m.signal.aborted).toBe(true);

    const answers: any[] = await ChatMessage.find({ role: 'assistant' }).lean();
    expect(answers).toHaveLength(1);
    expect(answers[0].status).toBe('cancelled');
    expect(answers[0].content).toBe('Recursion is when ');
    expect(await ChatMessage.countDocuments({ role: 'assistant', status: 'completed' })).toBe(0);
    expect(((await SessionLedger.findOne({ requestId: 'req-stop' }).lean()) as any).status).toBe('aborted');
    expect(generationRegistry.size()).toBe(0); // released
  });

  it('a Stop while the visual lesson is still being prepared ends promptly and is not saved as completed', async () => {
    h.orchestrateHang = true;
    const owner = new mongoose.Types.ObjectId().toString();
    const { run } = startRegistered('req-viz', { userId: owner });
    // text finishes; the lesson keeps "preparing"
    await vi.waitFor(async () => expect(((await SessionLedger.findOne({ requestId: 'req-viz' }).lean()) as any)?.status).toBe('streaming'));
    await new Promise((r) => setTimeout(r, 300));

    const started = Date.now();
    expect((await call(stopGeneration, { user: { _id: owner }, body: { requestId: 'req-viz' } })).body.status).toBe('stopped');
    const outcome: any = await settle(run);
    expect(Date.now() - started).toBeLessThan(2000); // did not wait out the lesson budget
    expect(outcome?.chatCode).toBe('CANCELLED');

    const answer: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    expect(answer.status).toBe('cancelled');
    expect(await ChatMessage.countDocuments({ role: 'assistant', status: 'completed' })).toBe(0);
  });

  it('a stopped answer is not sent back to the model as context for the next question', async () => {
    h.hangAfter = 'Half an answer';
    const owner = new mongoose.Types.ObjectId().toString();
    const { run } = startRegistered('req-ctx-1', { userId: owner });
    await vi.waitFor(() => expect(h.calls).toBe(1));
    await call(stopGeneration, { user: { _id: owner }, body: { requestId: 'req-ctx-1' } });
    await settle(run);

    h.hangAfter = '';
    const { requestCompletion } = await import('../utils/ai/llmClient.js');
    (requestCompletion as any).mockClear();
    await chatService.processMessage({ userId: owner, sessionId: 'key-req-ctx-1', userMessage: 'Try again', mode: 'explain', requestId: 'req-ctx-2', streamManager: new StreamLifecycleManager(fakeRes(), 'req-ctx-2') } as any);
    const sent = (requestCompletion as any).mock.calls.at(-1)[0].messages.map((x: any) => x.content);
    expect(sent.some((c: string) => c.includes('Half an answer'))).toBe(false);
  });

  it('the Stop endpoint goes through whichever registry is installed (multi-instance ready)', async () => {
    const calls: string[] = [];
    const shared = new InMemoryCancellationRegistry();
    const original = shared.requestStop.bind(shared);
    shared.requestStop = async (requestId, caller) => { calls.push(requestId); return original(requestId, caller); };
    setCancellationRegistry(shared);
    try {
      const stop = vi.fn();
      const release = generationRegistry.register({ requestId: 'r-shared', userId: 'u9', startedAt: Date.now(), stop });
      expect((await call(stopGeneration, { user: { _id: 'u9' }, body: { requestId: 'r-shared' } })).body.status).toBe('stopped');
      expect(calls).toEqual(['r-shared']);
      expect(stop).toHaveBeenCalledOnce();
      release();
    } finally {
      setCancellationRegistry(new InMemoryCancellationRegistry());
    }
  });
});
