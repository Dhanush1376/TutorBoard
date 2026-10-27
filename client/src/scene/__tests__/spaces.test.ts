import { describe, expect, it } from 'vitest';
import { logTicks, makeSpace } from '../geometry';
import type { Space } from '../types';

const box = { x: 0, y: 0, w: 820, h: 480 };
const space = (extra: Partial<Space> = {}) =>
  ({ id: 's', kind: 'cartesian', x: [0, 10], y: [1, 1000], axes: false, grid: false, equalAspect: false, xScale: 'linear', yScale: 'log', ...extra }) as Space;

describe('log spaces', () => {
  it('puts each decade the same distance apart', () => {
    const m = makeSpace(space(), box);
    const ys = [1, 10, 100, 1000].map((v) => m.toPx([0, v]).y);
    const gaps = ys.slice(1).map((y, i) => ys[i] - y);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 6);
    expect(ys[0]).toBeCloseTo(m.inner.y + m.inner.h, 6); // bottom of the frame
    expect(m.log).toEqual({ x: false, y: true });
  });

  it('ticks at decades, with 2× and 5× when the range is short', () => {
    expect(logTicks(1, 1000)).toEqual([1, 10, 100, 1000]);
    expect(logTicks(1, 50)).toEqual([1, 2, 5, 10, 20, 50]);
    expect(logTicks(1e-6, 1e6).length).toBeLessThanOrEqual(8);
  });

  it('keeps linear spaces exactly as before', () => {
    const m = makeSpace(space({ yScale: 'linear', y: [0, 10] }), box);
    expect(m.toPx([5, 5]).y).toBeCloseTo(m.inner.y + m.inner.h / 2, 6);
    expect(m.log).toEqual({ x: false, y: false });
  });
});
