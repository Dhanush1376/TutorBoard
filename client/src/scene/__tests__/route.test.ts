import { describe, expect, it } from 'vitest';
import { along, obstaclesFor, orthogonal, roundedPath, routeConnector } from '../route';
import type { Box, Pt } from '../types';

const box = (x: number, y: number, w = 100, h = 60): Box => ({ x, y, w, h });
const inside = (p: Pt, r: Box, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
const samples = (at: (u: number) => Pt, n = 80) => Array.from({ length: n + 1 }, (_, i) => at(i / n));

describe('connector routing', () => {
  it('draws a straight line when nothing is in the way', () => {
    const r = routeConnector(box(0, 0), box(300, 0), []);
    expect(r.kind).toBe('straight');
    expect(r.at(0).x).toBeCloseTo(108);
    expect(r.end.x).toBeCloseTo(292);
  });

  it('bends gently around a single box in the way', () => {
    const a = box(0, 0), b = box(400, 0), wall = box(200, 10, 40, 40);
    const r = routeConnector(a, b, [wall]);
    expect(r.kind).toBe('curve');
    expect(samples(r.at).some((p) => inside(p, wall, 4))).toBe(false);
  });

  it('finds a right-angled path through a channel when no curve gets around', () => {
    // the heart-diagram case: from the bottom right, up the gap between two columns, into the top left
    const left = [box(0, 0), box(0, 90), box(0, 180), box(0, 270)];
    const right = [box(300, 0), box(300, 90), box(300, 180), box(300, 270)];
    const from = box(480, 380, 140, 80), to = left[0];
    const obstacles = obstaclesFor(from, to, [...left, ...right, from]);
    expect(obstacles).not.toContain(to);
    const r = routeConnector(from, to, obstacles);
    expect(r.kind).toBe('orthogonal');
    for (const p of samples(r.at, 200)) for (const o of obstacles) expect(inside(p, o, 2)).toBe(false);
    // ends just outside both boxes
    expect(inside(r.at(0), from)).toBe(false);
    expect(inside(r.end, to)).toBe(false);
    expect(Math.hypot(r.end.x - (to.x + to.w), r.end.y - (to.y + to.h / 2))).toBeLessThan(80);
  });

  it('returns null from the grid search when the target is walled in', () => {
    const to = box(200, 200, 40, 40);
    const walls = [box(150, 150, 140, 20), box(150, 270, 140, 20), box(150, 150, 20, 140), box(270, 150, 20, 140)];
    expect(orthogonal(box(0, 0), to, walls)).toBeNull();
    // …and the router still returns something drawable
    expect(routeConnector(box(0, 0), to, walls).d).toMatch(/^M/);
  });

  it('rounds corners and walks a polyline by length', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(roundedPath(pts)).toBe('M0.0,0.0 L86.0,0.0 Q100.0,0.0 100.0,14.0 L100.0,100.0');
    expect(along(pts, 0.5)).toEqual({ x: 100, y: 0 });
    expect(along(pts, 0.75)).toEqual({ x: 100, y: 50 });
  });
});
