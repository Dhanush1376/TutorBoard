import { staticFile } from 'remotion';
import manifestJson from '../../public/capture/manifest.json';
import timelineJson from '../timeline.json';

export type Rect = { x: number; y: number; w: number; h: number };
export type Cell = Rect & { id: string; text?: string };

type Manifest = {
  fps: number;
  question: string;
  doubt: string;
  shots: Record<string, { frames: number }>;
  rects: Record<string, any>;
  data: {
    lesson?: { title: string; steps: { title: string; narration: string }[] };
    doubt?: { answer: string; followUp?: string };
  };
};

export const manifest = manifestJson as unknown as Manifest;
export const timeline = timelineJson as any;

/** Path of a captured frame (clamped to the shot's range) or a named still. */
export const shotFrame = (shot: string, i: number) => {
  const n = manifest.shots[shot]?.frames ?? 1;
  const k = Math.max(0, Math.min(n - 1, Math.round(i)));
  return staticFile(`capture/${shot}/${String(k).padStart(4, '0')}.jpg`);
};
export const still = (name: string) => staticFile(`capture/stills/${name}.jpg`);

export const rect = (key: string, fallback: Rect): Rect => {
  const r = manifest.rects[key];
  return r && typeof r.x === 'number' ? r : fallback;
};

export const cells = (key: string): Cell[] => (manifest.rects[key]?.cells ?? []) as Cell[];

export const centerOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Union rect of several rects. */
export const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w));
  const y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
};

/** Frame of a subject-montage shot (capture-subjects.mjs), clamped to range. */
export const subjectFrame = (key: string, shot: 'typing' | 'payoff', i: number, frames: number) => {
  const k = Math.max(0, Math.min(Math.max(0, frames - 1), Math.round(i)));
  return staticFile(`capture/subjects/${key}/${shot}/${String(k).padStart(4, '0')}.jpg`);
};
