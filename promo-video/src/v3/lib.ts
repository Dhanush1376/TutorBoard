import planJson from './plan.json';
import { Cam } from '../components/UIShot';
import { manifest } from '../lib/capture';
import { LessonState } from './ui/LessonUI';
import { HEIGHT, WIDTH } from '../theme';

export const plan = planJson as any;

/** Keep a magnified camera inside the 1920×1080 app (no empty margins). */
export const clampCam = (c: Cam): Cam => {
  if (c.z < 1) return c;
  const hw = WIDTH / 2 / c.z;
  const hh = HEIGHT / 2 / c.z;
  return { z: c.z, x: Math.min(WIDTH - hw, Math.max(hw, c.x)), y: Math.min(HEIGHT - hh, Math.max(hh, c.y)) };
};

/** Characters typed by `frame` for a per-character schedule. */
export const typedCount = (schedule: number[], frame: number) => {
  let k = 0;
  while (k < schedule.length && frame >= schedule[k]) k++;
  return k;
};

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Caret blink at ~1.9 Hz (the app's input caret). */
export const caretOn = (frame: number) => Math.floor(frame / 8) % 2 === 0;

const lesson = manifest.data.lesson!;

/** The Bubble Sort lesson exactly as the AI generated it for the captured run. */
export const bubbleBase: LessonState = {
  title: 'Bubble Sort Work on [5, 1, 4, 2, 8]',
  kind: 'ALGORITHM SESSION',
  guide: 'ALGORITHM GUIDE',
  steps: lesson.steps.map((s) => s.title),
  active: 0,
  explanation: lesson.steps[0].narration,
  playing: false,
  progress: 0,
  time: ['0:00', '0:32'],
  chatQuestion: manifest.question,
};
export const bubbleStep = (i: number): Pick<LessonState, 'active' | 'explanation'> => ({ active: i, explanation: lesson.steps[i].narration });
export const doubtData = { q: manifest.doubt, ...manifest.data.doubt! };
