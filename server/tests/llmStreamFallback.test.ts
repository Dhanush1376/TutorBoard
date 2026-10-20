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
