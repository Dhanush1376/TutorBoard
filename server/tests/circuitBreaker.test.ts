import { describe, expect, it } from 'vitest';
import { circuitBreaker, retryAfterMs, withCircuitBreaker } from '../engine/core/circuitBreaker.js';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('circuit breaker and rate limits', () => {
  it('reads how long a provider asked us to wait', () => {
    expect(retryAfterMs(fail(429, 'Rate limit reached ... Please try again in 4.59s. Need more tokens?'))).toBe(4590);
    expect(retryAfterMs(fail(429, 'try again in 250ms'))).toBe(250);
    expect(retryAfterMs(Object.assign(fail(429, 'slow down'), { headers: { 'retry-after': '3' } }))).toBe(3000);
    expect(retryAfterMs(fail(429, '429 status code (no body)'))).toBeNull();
  });

  it('blocks a provider only as long as a short rate limit asks, not for the full cooldown', async () => {
    const id = 'test-short';
    await expect(withCircuitBreaker(id, async () => { throw fail(429, 'try again in 4.59s'); })).rejects.toThrow();
    const wait = circuitBreaker.retryInMs(id);
    expect(wait).toBeGreaterThan(4000);
    expect(wait).toBeLessThanOrEqual(5100);
  });

  it('keeps the long cooldown when the limit gives no hint', async () => {
    const id = 'test-long';
    await expect(withCircuitBreaker(id, async () => { throw fail(429, '429 status code (no body)'); })).rejects.toThrow();
    expect(circuitBreaker.retryInMs(id)).toBeGreaterThan(50000);
  });

  it('does not count a malformed request or a cancelled call against the provider', async () => {
    const id = 'test-request';
    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(id, async () => { throw fail(400, 'bad request'); })).rejects.toThrow();
    }
    await expect(withCircuitBreaker(id, async () => { throw Object.assign(new Error('Request was aborted.'), { name: 'AbortError' }); })).rejects.toThrow();
    expect(circuitBreaker.isAvailable(id)).toBe(true);
  });
});
