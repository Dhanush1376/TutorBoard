/**
 * Chat pipeline integrity: one submission → one conversation, one user message,
 * one assistant answer — under retries, duplicates, races, failures, Stop and
 * persistence errors. The model is mocked; Mongo is the in-memory server.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

const llm = vi.hoisted(() => ({ impl: null as null | ((p: any) => Promise<any>), calls: 0 }));

vi.mock('../utils/ai/llmClient.js', () => ({
  requestCompletion: vi.fn(async (p: any) => {
    llm.calls++;
    if (!llm.impl) throw new Error('no llm impl');
    return llm.impl(p);
  }),
  getTextModel: () => 'test-model',
  resolveModelId: (m?: string) => m || 'test-model',
}));
vi.mock('../services/chat/planner.service.js', () => ({
  default: {
    generatePlan: vi.fn(async () => ({
      teaching_mode: 'explain', complexity: 'beginner', topic: 'Test',
      tools: { rag: false, web_search: false },
      visualization: { generate: false, type: 'none', necessity: 'none' },
      artifacts: { generate: false, type: 'none' },
    })),
  },
}));
vi.mock('../services/chat/orchestrator.js', () => ({
  default: { execute: vi.fn(async () => ({ narration: { narrations: [] }, visualScript: null, sceneV2: null, sceneBranch: null, metadata: { stages: {} } })) },
}));
vi.mock('../engine/core/vectorStore.js', () => ({
  default: { addMemory: vi.fn(async () => {}), getContextForTopic: vi.fn(async () => '') },
}));
vi.mock('../utils/ai/webSearchService.js', () => ({ searchWeb: vi.fn(async () => []) }));

import chatService from '../services/chat/chat.service.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import SessionLedger from '../models/SessionLedger.js';
import sessionRepository from '../repositories/session.repository.js';
import { classifyChatError, toChatClientError } from '../services/chat/chatErrors.js';

/** A StreamLifecycleManager stand-in that records what the client would receive. */
function fakeStream() {
  const controller = new AbortController();
  const events: any[] = [];
  return {
    events,
    controller,
    closed: false,
    get signal() { return controller.signal; },
    setSessionId: vi.fn(),
    send(chunk: any) { if (!this.closed) events.push(chunk); },
    close(meta?: any) { if (!this.closed) { events.push({ type: 'metadata', data: meta }); events.push({ type: 'end' }); } this.closed = true; },
    error(err: any) { events.push({ type: 'error', code: toChatClientError(err).code }); this.closed = true; },
    text() { return events.filter((e) => e.type === 'chunk').map((e) => e.content).join(''); },
  };
}

/** Streams `answer` token by token, like a provider. */
const streaming = (answer: string) => async (p: any) => {
  for (const t of answer.match(/.{1,4}/gs) || []) p.onStream?.(t);
  return { content: answer, _meta: { tokens_in: 1, tokens_out: 1 } };
};

const send = (over: Partial<Parameters<typeof chatService.processMessage>[0]> & { stream?: any } = {}) => {
  const stream = over.stream ?? fakeStream();
  const { stream: _s, ...rest } = over as any;
  const run = chatService.processMessage({
    userId: undefined,
    sessionId: 'session-key-1',
    userMessage: 'What is a heap?',
    mode: 'explain',
    requestId: 'req-1',
    streamManager: stream as any,
    ...rest,
  });
  return { stream, run };
};

const counts = async () => ({
  sessions: await ChatSession.countDocuments(),
  user: await ChatMessage.countDocuments({ role: 'user' }),
  assistant: await ChatMessage.countDocuments({ role: 'assistant' }),
});

beforeEach(async () => {
  llm.impl = streaming('A heap is a tree-shaped priority queue.');
  llm.calls = 0;
  await Promise.all([ChatSession.init(), ChatMessage.init(), SessionLedger.init()]);
});

describe('conversation and message identity', () => {
  it('a first message creates one conversation, one user message and one completed answer', async () => {
    const { stream, run } = send();
    await run;
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 1 });

    const meta = stream.events.find((e) => e.type === 'meta');
    const session: any = await ChatSession.findOne().lean();
    expect(meta.sessionId).toBe(session._id.toString()); // client learns the canonical id first
    expect(stream.events.at(-1).type).toBe('end');
    const answer: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    expect(answer.status).toBe('completed');
    expect(answer.requestId).toBe('req-1');
    expect(stream.text()).toBe(answer.content);
  });

  it('a follow-up with the same conversation key lands in the same conversation', async () => {
    await send().run;
    await send({ requestId: 'req-2', userMessage: 'And a min-heap?' }).run;
    expect(await counts()).toEqual({ sessions: 1, user: 2, assistant: 2 });
  });

  it('a follow-up with the server id lands in the same conversation, with history as context', async () => {
    const first = send();
    await first.run;
    const id = first.stream.events.find((e) => e.type === 'meta').sessionId;
    let context: any[] = [];
    llm.impl = async (p) => { context = p.messages; return streaming('Yes.')(p); };
    await send({ sessionId: id, requestId: 'req-2', userMessage: 'Again?' }).run;
    expect(await counts()).toEqual({ sessions: 1, user: 2, assistant: 2 });
    // system + earlier user + earlier answer + this question, each exactly once
    expect(context.filter((m) => m.role === 'user').map((m) => m.content)).toEqual(['What is a heap?', 'Again?']);
  });

  it('repeating a completed request replays it without a second model call or new messages', async () => {
    await send().run;
    const again = send();
    await again.run;
    expect(llm.calls).toBe(1);
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 1 });
    expect(again.stream.text()).toBe('A heap is a tree-shaped priority queue.');
    expect(again.stream.events.find((e) => e.type === 'message_ids')).toBeTruthy();
  });

  it('two different submissions create two distinct user messages', async () => {
    await send({ requestId: 'a' }).run;
    await send({ requestId: 'b' }).run;
    expect(await counts()).toEqual({ sessions: 1, user: 2, assistant: 2 });
  });

  it('concurrent first messages on the same key never create two conversations', async () => {
    await Promise.all([send({ requestId: 'a' }).run, send({ requestId: 'b' }).run, send({ requestId: 'c' }).run]);
    expect((await counts()).sessions).toBe(1);
    expect((await counts()).user).toBe(3);
  });

  it('a duplicate of an in-flight request is rejected and saves nothing twice', async () => {
    let release!: () => void;
    llm.impl = (p) => new Promise((r) => { release = () => r(streaming('ok')(p)); });
    const first = send();
    await vi.waitFor(() => expect(llm.calls).toBe(1));
    await expect(send().run).rejects.toMatchObject({ chatCode: 'DUPLICATE_IN_PROGRESS' });
    release();
    await first.run;
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 1 });
  });

  it('long answers (over 10k characters) are saved', async () => {
    llm.impl = streaming('x'.repeat(25000));
    await send().run;
    const answer: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    expect(answer.content.length).toBe(25000);
  });
});

describe('ownership', () => {
  it('an unknown ObjectId is a miss — no conversation is created with a client-chosen id', async () => {
    const ghost = new mongoose.Types.ObjectId().toString();
    await expect(send({ sessionId: ghost }).run).rejects.toMatchObject({ code: 'SESSION_2001' });
    expect(await counts()).toEqual({ sessions: 0, user: 0, assistant: 0 });
  });

  it("another user's conversation cannot be written to", async () => {
    const owner = new mongoose.Types.ObjectId().toString();
    const other = new mongoose.Types.ObjectId().toString();
    const first = send({ userId: owner });
    await first.run;
    const id = first.stream.events.find((e) => e.type === 'meta').sessionId;
    await expect(send({ userId: other, sessionId: id, requestId: 'x' }).run).rejects.toMatchObject({ code: 'SESSION_2001' });
    await expect(send({ userId: undefined, sessionId: id, requestId: 'y' }).run).rejects.toMatchObject({ code: 'SESSION_2001' });
    expect((await counts()).user).toBe(1);
  });

  it('a regenerate cannot target a message from another conversation', async () => {
    const a = send({ sessionId: 'key-a', requestId: 'a1' });
    await a.run;
    const foreign: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    await send({ sessionId: 'key-b', requestId: 'b1' }).run;
    await send({ sessionId: 'key-b', requestId: 'b2', isRegenerate: true, originalMessageId: foreign._id.toString() }).run;
    const untouched: any = await ChatMessage.findById(foreign._id).lean();
    expect(untouched.metadata.versions || []).toHaveLength(0);
  });
});

describe('failures and recovery', () => {
  it('a provider failure saves the question once, no answer, and a retry re-uses the question', async () => {
    llm.impl = async () => { const e: any = new Error('upstream 503'); e.status = 503; throw e; };
    await expect(send().run).rejects.toThrow();
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 0 });
    const ledger: any = await SessionLedger.findOne().lean();
    expect(ledger.status).toBe('failed');
    expect(ledger.errorCode).toBe('PROVIDER_UNAVAILABLE');

    llm.impl = streaming('Recovered answer.');
    await send().run; // same requestId = explicit retry
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 1 });
  });

  it('an empty provider answer is a failure, never an empty saved message', async () => {
    llm.impl = async () => ({ content: '', _meta: {} });
    await expect(send().run).rejects.toMatchObject({ chatCode: 'EMPTY_RESPONSE' });
    expect((await counts()).assistant).toBe(0);
  });

  it('a non-streamed answer (cache hit / fallback) is still delivered and saved', async () => {
    llm.impl = async () => ({ content: 'Whole answer at once.', _meta: {} });
    const { stream, run } = send();
    await run;
    expect(stream.text()).toBe('Whole answer at once.');
    expect((await counts()).assistant).toBe(1);
  });

  it('Stop mid-answer keeps the partial text as cancelled, and it is not fed back as context', async () => {
    const stream = fakeStream();
    llm.impl = async (p) => {
      p.onStream('Half an ');
      p.onStream('answer');
      stream.controller.abort();
      const e = new Error('Request was aborted.'); e.name = 'APIUserAbortError'; throw e;
    };
    await expect(send({ stream }).run).rejects.toThrow();
    const partial: any = await ChatMessage.findOne({ role: 'assistant' }).lean();
    expect(partial.status).toBe('cancelled');
    expect(partial.content).toBe('Half an answer');
    expect(((await SessionLedger.findOne().lean()) as any).status).toBe('aborted');

    let context: any[] = [];
    llm.impl = async (p) => { context = p.messages; return streaming('Full.')(p); };
    await send({ requestId: 'req-2', userMessage: 'Try again please' }).run;
    expect(context.some((m) => m.content === 'Half an answer')).toBe(false);
  });

  it('late tokens after Stop are not sent to the client', async () => {
    const stream = fakeStream();
    llm.impl = async (p) => {
      p.onStream('before ');
      stream.controller.abort();
      p.onStream('after');
      return { content: 'before after', _meta: {} };
    };
    await expect(send({ stream }).run).rejects.toMatchObject({ chatCode: 'CANCELLED' });
    expect(stream.text()).toBe('before ');
  });

  it('an answer that generated but failed to save is saved on retry without regenerating', async () => {
    const original = sessionRepository.addMessage.bind(sessionRepository);
    const spy = vi.spyOn(sessionRepository, 'addMessage').mockImplementation(async (sessionId: string, message: any) => {
      if (message.role === 'assistant') throw Object.assign(new Error('write conflict'), { name: 'MongoServerError' });
      return original(sessionId, message);
    });
    await expect(send().run).rejects.toMatchObject({ chatCode: 'PERSISTENCE_FAILED' });
    expect(llm.calls).toBe(1);
    spy.mockRestore();

    const retry = send();
    await retry.run;
    expect(llm.calls).toBe(1); // no second generation
    expect(await counts()).toEqual({ sessions: 1, user: 1, assistant: 1 });
    expect(retry.stream.text()).toBe('A heap is a tree-shaped priority queue.');
  });
});

describe('history ordering', () => {
  it('messages with identical timestamps keep a stable order', async () => {
    const session: any = await ChatSession.create({ title: 't' });
    const ts = new Date();
    const docs = await ChatMessage.insertMany(
      Array.from({ length: 6 }, (_, i) => ({ sessionId: session._id, role: i % 2 ? 'assistant' : 'user', content: `m${i}`, timestamp: ts }))
    );
    const page = await sessionRepository.getMessages(session._id, 1, 50);
    expect(page.map((m: any) => m._id.toString())).toEqual(docs.map((d: any) => d._id.toString()));
    const p1 = await sessionRepository.getMessages(session._id, 1, 3);
    const p2 = await sessionRepository.getMessages(session._id, 2, 3);
    expect(new Set([...p1, ...p2].map((m: any) => m.content)).size).toBe(6); // no duplicates, no gaps
  });
});

describe('error classification', () => {
  it.each([
    [{ status: 429 }, 'RATE_LIMITED'],
    [{ status: 503 }, 'PROVIDER_UNAVAILABLE'],
    [{ status: 401 }, 'NOT_CONFIGURED'],
    [{ message: 'SYSTEM_NOT_CONFIGURED: No AI provider keys found' }, 'NOT_CONFIGURED'],
    [{ name: 'AbortError', message: 'aborted' }, 'CANCELLED'],
    [{ message: 'Request timed out' }, 'PROVIDER_TIMEOUT'],
    [{ message: 'STREAM_INTERRUPTED: socket hang up' }, 'STREAM_INTERRUPTED'],
    [{ name: 'MongoServerError', message: 'E11000' }, 'PERSISTENCE_FAILED'],
    [{ message: 'weird' }, 'INTERNAL'],
  ])('%o → %s', (err, code) => {
    expect(classifyChatError(Object.assign(new Error((err as any).message || 'x'), err))).toBe(code);
  });

  it('never forwards raw provider or database text to the client', () => {
    const leaky = Object.assign(new Error('401 Incorrect API key provided: sk-live-abc123'), { status: 401 });
    const safe = toChatClientError(leaky);
    expect(safe.message).not.toContain('sk-');
    expect(safe.retryable).toBe(false);
  });
});
