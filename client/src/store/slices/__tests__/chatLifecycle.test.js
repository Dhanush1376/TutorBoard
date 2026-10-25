/**
 * Chat lifecycle in the store: one stable assistant message per stream, Stop
 * keeps what was seen, late chunks never revive a stopped answer, failures are
 * kept as failed (never as finished), retries drop the failed attempt, and a
 * background stream never writes into the conversation on screen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('zustand/middleware', () => ({ persist: (config) => config, createJSONStorage: vi.fn() }));

import useTutorStore from '../../tutorStore';
import { processSSEStream } from '../../../utils/sseStreamParser';
import { ChatRequestError, fromServerError, describeChatError } from '../../../lib/chatErrors';

const initialState = useTutorStore.getState();
const S = () => useTutorStore.getState();

beforeEach(() => {
  useTutorStore.setState(initialState, true);
  useTutorStore.setState({
    conversationSessions: {}, activeConversationSessionId: 'chat-a', conversationMessages: [],
    isStreaming: false, streamingContent: '', streamingMessageId: null, streamingSessionId: null,
    isWaitingForAI: false, waitingSessionId: null, lastAIError: null, sessionStates: {},
    chatSessionId: 'chat-a', sessionId: 'chat-a',
  });
});

const assistants = () => S().conversationMessages.filter((m) => m.role === 'assistant');

describe('streaming one answer', () => {
  it('streams into one stable message and completion does not append a second', () => {
    S().addUserMessage('q');
    S().startStreaming('asst-1', 'chat-a', 'tok');
    S().appendStreamChunk('Hel', 'chat-a', 'tok');
    S().appendStreamChunk('lo', 'chat-a', 'tok');
    expect(S().sessionStates['chat-a'].content).toBe('Hello');
    S().finishStreaming('Hello', 'chat-a', '', [], null, null, 10, 'tok');
    S().finishStreaming('Hello', 'chat-a', '', [], null, null, 10, 'tok'); // repeated completion callback
    expect(assistants()).toHaveLength(1);
    expect(assistants()[0].id).toBe('asst-1');
  });

  it('chunks from a stale stream token are dropped', () => {
    S().startStreaming('asst-1', 'chat-a', 'new');
    S().appendStreamChunk('stale', 'chat-a', 'old');
    expect(S().sessionStates['chat-a'].content).toBe('');
  });
});

describe('first message of a new chat', () => {
  it('is filed under the new conversation even if an old one is still marked active', () => {
    // e.g. a lesson's socket session left as the active conversation
    useTutorStore.setState({ activeConversationSessionId: 'stale-socket-session', chatSessionId: 'session-new', sessionId: 'session-new' });
    S().addUserMessage('Why is the sky blue?', 'session-new');
    S().setActiveConversationSession('session-new'); // what the view effect does next
    expect(S().conversationMessages.map((m) => m.content)).toEqual(['Why is the sky blue?']);
    expect(S().conversationSessions['stale-socket-session']?.orderedMessageIds?.length || 0).toBe(0);
  });
});

describe('follow-up after the server id arrives', () => {
  it('keeps the first exchange even if the new id was touched before the migration', () => {
    useTutorStore.setState({ activeConversationSessionId: 'session-tmp', chatSessionId: 'session-tmp', sessionId: 'session-tmp' });
    S().addUserMessage('What is a binary heap?', 'session-tmp');
    S().setWaitingForAI(true, 'mongo-id');           // something touches the new id first
    S().migrateSessionState('session-tmp', 'mongo-id');
    useTutorStore.setState({ chatSessionId: 'mongo-id', sessionId: 'mongo-id' }); // meta: the app adopts the server id
    S().startStreaming('a1', 'mongo-id', 't1');
    S().finishStreaming('A heap is…', 'mongo-id', '', [], null, null, 1, 't1');
    S().addUserMessage('And insertion?', 'mongo-id');
    S().setActiveConversationSession('mongo-id');
    expect(S().conversationMessages.map((m) => m.content)).toEqual(['What is a binary heap?', 'A heap is…', 'And insertion?']);
  });
});

describe('Stop', () => {
  it('keeps the partial answer, marked stopped, and late chunks cannot revive it', () => {
    S().addUserMessage('q');
    S().startStreaming('asst-1', 'chat-a', 'tok');
    S().appendStreamChunk('partial', 'chat-a', 'tok');
    S().abortStreaming('chat-a');
    S().appendStreamChunk(' LATE', 'chat-a', 'tok');
    S().finishStreaming('partial LATE', 'chat-a', '', [], null, null, 1, 'tok');

    expect(assistants()).toHaveLength(1);
    expect(assistants()[0].content).toBe('partial');
    expect(assistants()[0].status).toBe('cancelled');
    expect(S().isStreaming).toBe(false);
  });
});

describe('failure and retry', () => {
  it('a failed stream keeps streamed text as failed, records retry info, and clears loading', () => {
    S().addUserMessage('q');
    S().startStreaming('asst-1', 'chat-a', 'tok');
    S().appendStreamChunk('half', 'chat-a', 'tok');
    S().failStreaming({
      sessionId: 'chat-a', streamToken: 'tok', assistantMessageId: 'asst-1',
      error: { message: 'Interrupted', code: 'STREAM_INTERRUPTED', retryable: true, retry: { requestId: 'r1', userMessageId: 'u1', text: 'q' } },
    });
    expect(assistants()).toHaveLength(1);
    expect(assistants()[0].status).toBe('failed');
    expect(S().lastAIError).toMatchObject({ code: 'STREAM_INTERRUPTED', sessionId: 'chat-a', retry: { requestId: 'r1' } });
    expect(S().isStreaming).toBe(false);
    expect(S().isWaitingForAI).toBe(false);

    S().prepareRetry('r1', 'chat-a');
    expect(assistants()).toHaveLength(0);
    expect(S().conversationMessages.filter((m) => m.role === 'user')).toHaveLength(1); // the question is not duplicated
    expect(S().lastAIError).toBeNull();
  });

  it('a failure before any token leaves no empty assistant bubble', () => {
    S().addUserMessage('q');
    S().failStreaming({ sessionId: 'chat-a', error: { message: 'down', code: 'PROVIDER_UNAVAILABLE', retryable: true } });
    expect(assistants()).toHaveLength(0);
    expect(S().lastAIError.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('a failure in a background conversation does not touch the one on screen', () => {
    S().addUserMessage('on screen');
    S().startStreaming('asst-b', 'chat-b', 'tb');
    S().appendStreamChunk('background text', 'chat-b', 'tb');
    S().failStreaming({ sessionId: 'chat-b', streamToken: 'tb', assistantMessageId: 'asst-b', error: { message: 'x', code: 'INTERNAL', retryable: true } });
    expect(assistants()).toHaveLength(0);
    expect(S().lastAIError).toBeNull();
  });
});

describe('background streams', () => {
  it('a stream for another conversation never lands in the conversation on screen', () => {
    S().addUserMessage('question in A');
    S().startStreaming('asst-b', 'chat-b', 'tb');
    S().appendStreamChunk('answer for B', 'chat-b', 'tb');
    S().finishStreaming('answer for B', 'chat-b', '', [], null, null, 1, 'tb');
    expect(assistants()).toHaveLength(0);
    expect(S().sessionStates['chat-a']?.content || '').toBe('');
  });
});

describe('SSE parser', () => {
  const reader = (chunks) => {
    let i = 0;
    const enc = new TextEncoder();
    return { read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true }) };
  };

  it('propagates errors thrown by the handler instead of treating them as text', async () => {
    const onEvent = (type) => { if (type === 'error') throw new ChatRequestError('RATE_LIMITED'); };
    await expect(processSSEStream(reader(['data: {"type":"error","code":"RATE_LIMITED"}\n\n']), onEvent))
      .rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('reports the end event so a cut-off stream can be detected', async () => {
    const seen = [];
    await processSSEStream(reader(['data: {"type":"chunk","content":"a"}\n\n', 'event: end\ndata: {}\n\n']), (t) => seen.push(t));
    expect(seen).toEqual(['chunk', 'end']);
  });

  it('reassembles an event split across network chunks', async () => {
    const seen = [];
    await processSSEStream(reader(['data: {"type":"chu', 'nk","content":"héllo"}\n\n']), (t, d) => seen.push(d.content));
    expect(seen).toEqual(['héllo']);
  });
});

describe('chat errors', () => {
  it('maps server payloads to typed, retry-aware errors', () => {
    const e = fromServerError({ type: 'error', content: 'Busy.', code: 'RATE_LIMITED', retryable: true });
    expect(e).toMatchObject({ code: 'RATE_LIMITED', retryable: true, message: 'Busy.' });
    expect(fromServerError({ error: 'bad' }, 400)).toMatchObject({ code: 'INTERNAL' });
    expect(fromServerError({ code: 'ACCESS_DENIED' })).toMatchObject({ retryable: false });
    expect(describeChatError({ code: 'NETWORK' }).title).toBe('Connection lost');
  });
});
