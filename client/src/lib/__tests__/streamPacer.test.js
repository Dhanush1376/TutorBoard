import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamPacer } from '../streamPacer';

describe('createStreamPacer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reveals a burst over several frames, in order, without losing text', () => {
    const out = [];
    const pacer = createStreamPacer((t) => out.push(t));
    const burst = 'A binary heap is a complete binary tree stored in an array.';
    pacer.push(burst);
    vi.advanceTimersByTime(0);
    expect(out.length).toBe(1);
    expect(out[0].length).toBeLessThan(burst.length); // not dumped all at once
    vi.advanceTimersByTime(1000);
    expect(out.join('')).toBe(burst);
    expect(out.length).toBeGreaterThan(3);
  });

  it('drains any backlog in about a fifth of a second', () => {
    const out = [];
    const pacer = createStreamPacer((t) => out.push(t));
    pacer.push('x'.repeat(5000));
    vi.advanceTimersByTime(260);
    expect(pacer.pending).toBe(0);
    expect(out.join('').length).toBe(5000);
  });

  it('never holds the tail of a burst waiting for the next chunk', () => {
    const out = [];
    const pacer = createStreamPacer((t) => out.push(t));
    pacer.push('last words.');
    vi.advanceTimersByTime(500); // no more chunks arrive
    expect(out.join('')).toBe('last words.');
  });

  it('flush reveals everything now; cancel drops what is queued and ignores late text', () => {
    const out = [];
    const pacer = createStreamPacer((t) => out.push(t));
    pacer.push('hello world, this is queued');
    pacer.flush();
    expect(out.join('')).toBe('hello world, this is queued');

    const out2 = [];
    const stopped = createStreamPacer((t) => out2.push(t));
    stopped.push('partial answer that');
    stopped.cancel();
    stopped.push(' arrives late');
    vi.advanceTimersByTime(1000);
    expect(out2.join('')).toBe('');
  });

  it('never splits an emoji across frames', () => {
    const out = [];
    const pacer = createStreamPacer((t) => out.push(t), { minChars: 1, drainFrames: 1000 });
    pacer.push('ab😀cd');
    vi.advanceTimersByTime(1000);
    expect(out.join('')).toBe('ab😀cd');
    expect(out.every((piece) => !/[\uD800-\uDBFF]$/.test(piece))).toBe(true);
  });
});
