/**
 * Provider fallback vs streaming: once tokens have reached the caller, a failure
 * must not fall through to the next provider (that streamed a second answer
 * after the first — duplicated text in the chat). Before any token, fallback
 * still works. A cancelled request never falls back.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const calls = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-gemini';
  process.env.OPENROUTER_API_KEY = 'test-openrouter';
  process.env.CHAT_ANSWER_HEDGE_MS = '150';
  return { providers: [] as string[], impl: null as any };
});

vi.mock('../utils/ai/providerFactory.js', () => ({
  createProviderClient: vi.fn(),
  calculateCost: () => ({ costCents: 0 }),
  estimateCost: () => 0,
  executeProviderRequest: vi.fn(async (_client: any, provider: string, params: any, signal?: AbortSignal) => {
    calls.providers.push(provider);
    return calls.impl(provider, params, signal);
  }),
}));

import { requestCompletion } from '../utils/ai/llmClient.js';
import { circuitBreaker } from '../engine/core/circuitBreaker.js';

const fail = (status = 500) => Object.assign(new Error(`provider ${status}`), { status });

beforeEach(() => {
  calls.providers = [];
  for (const p of ['google', 'openrouter', 'groq']) circuitBreaker.reset(p);
});

describe('streaming fallback', () => {
  it('falls back to the next provider when the first fails before streaming anything', async () => {
    calls.impl = async (provider: string, params: any) => {
      if (provider === 'google') throw fail(500);
      params.onStream?.('hello');
      return { content: 'hello', usage: null };
    };
    const tokens: string[] = [];
    const res = await requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: (t) => tokens.push(t), taskType: 'final_answer' });
    expect(res.content).toBe('hello');
    expect(calls.providers).toEqual(['google', 'openrouter']);
    expect(tokens.join('')).toBe('hello');
  });

  it('does NOT fall back after tokens were streamed — the failure surfaces as interrupted', async () => {
    calls.impl = async (provider: string, params: any) => {
      params.onStream?.('first half ');
      if (provider === 'google') throw fail(500);
      params.onStream?.('SECOND ANSWER');
      return { content: 'SECOND ANSWER', usage: null };
    };
    const tokens: string[] = [];
    await expect(
      requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: (t) => tokens.push(t), taskType: 'final_answer' })
    ).rejects.toThrow(/STREAM_INTERRUPTED/);
    expect(calls.providers).toEqual(['google']);
    expect(tokens.join('')).toBe('first half ');
  });

  it('a cancelled request never tries another provider', async () => {
    const controller = new AbortController();
    calls.impl = async () => {
      controller.abort();
      throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' });
    };
    await expect(
      requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: () => {}, signal: controller.signal, taskType: 'final_answer' })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls.providers).toEqual(['google']);
  });
});

/** A provider that stays silent until `signal` aborts (thinking for ever / overloaded). */
const silentUntilAborted = (signal?: AbortSignal) => new Promise((_, reject) => {
  const stop = () => reject(Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' }));
  if (signal?.aborted) stop(); else signal?.addEventListener('abort', stop, { once: true });
});

describe('a chat answer that does not start (hedged)', () => {
  it('starts the next provider alongside a silent one; the first to stream wins and the other is stopped', async () => {
    let googleAborted = false;
    calls.impl = async (provider: string, params: any, signal?: AbortSignal) => {
      if (provider === 'google') {
        signal?.addEventListener('abort', () => { googleAborted = true; }, { once: true });
        return silentUntilAborted(signal);
      }
      params.onStream?.('fast ');
      params.onStream?.('answer');
      return { content: 'fast answer', usage: null };
    };
    const tokens: string[] = [];
    const started = Date.now();
    const res = await requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: (t) => tokens.push(t), taskType: 'final_answer' });
    expect(res.content).toBe('fast answer');
    expect(tokens.join('')).toBe('fast answer'); // one answer, never two
    expect(googleAborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('a provider that starts in time is used alone — no second provider is called', async () => {
    calls.impl = async (provider: string, params: any) => {
      params.onStream?.(`from ${provider}`);
      return { content: `from ${provider}`, usage: null };
    };
    const tokens: string[] = [];
    await requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: (t) => tokens.push(t), taskType: 'final_answer' });
    await new Promise((r) => setTimeout(r, 300)); // past the hedge delay
    expect(calls.providers).toEqual(['google']);
    expect(tokens.join('')).toBe('from google');
  });

  it('once the slow provider streams first, the backup is stopped and its text never reaches the chat', async () => {
    calls.impl = async (provider: string, params: any, signal?: AbortSignal) => {
      if (provider === 'google') {
        await new Promise((r) => setTimeout(r, 200)); // starts just after the hedge
        params.onStream?.('google answer');
        return { content: 'google answer', usage: null };
      }
      await new Promise((r) => setTimeout(r, 400));
      if (signal?.aborted) throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' });
      params.onStream?.('BACKUP');
      return { content: 'BACKUP', usage: null };
    };
    const tokens: string[] = [];
    const res = await requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: (t) => tokens.push(t), taskType: 'final_answer' });
    await new Promise((r) => setTimeout(r, 400));
    expect(res.content).toBe('google answer');
    expect(tokens.join('')).toBe('google answer');
  });

  it('Stop ends every attempt', async () => {
    const controller = new AbortController();
    calls.impl = async (_p: string, _params: any, signal?: AbortSignal) => silentUntilAborted(signal);
    const run = requestCompletion({ messages: [{ role: 'user', content: 'q' }], onStream: () => {}, signal: controller.signal, taskType: 'final_answer' });
    setTimeout(() => controller.abort(), 250);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
  });
});
