/**
 * Lesson readiness and position rules: a lesson starts only on real content,
 * reopens at the step the learner last viewed (or the first step when the
 * lesson changed), and is complete only once its last step has played.
 */
import { describe, it, expect } from 'vitest';
import { isPlayableLesson, hasCanvasContent, resolveStartStep, isLessonComplete, newerPosition } from '../lessonProgress';

const v2 = (n) => ({ renderer: 'scene-v2', sceneV2: { beats: Array.from({ length: n }, (_, i) => ({ id: `b${i}` })) }, steps: Array.from({ length: n }, (_, i) => ({ title: `Step ${i + 1}` })) });

describe('isPlayableLesson / hasCanvasContent', () => {
  it('an Engine v2 lesson needs at least one step', () => {
    expect(isPlayableLesson(v2(3))).toBe(true);
    expect(isPlayableLesson(v2(0))).toBe(false);
    expect(isPlayableLesson({ renderer: 'scene-v2', steps: [{ title: 'x' }] })).toBe(false); // no scene
  });

  it('the empty placeholder step ([{}]) is not content', () => {
    expect(isPlayableLesson({ renderer: 'd3', steps: [{}] })).toBe(false);
    expect(hasCanvasContent({ scene: { renderer: 'd3', steps: [{}] }, canvasObjects: [], canvasSteps: [{}] })).toBe(false);
    expect(hasCanvasContent({ scene: null, canvasObjects: [{ id: 'n1' }] })).toBe(true);
    expect(hasCanvasContent({ scene: v2(2) })).toBe(true);
  });
});

describe('resolveStartStep', () => {
  it('no saved position: the first step', () => {
    expect(resolveStartStep(null, 5)).toEqual({ step: 0, completed: false, changed: false });
  });

  it('an unfinished lesson reopens at the step last viewed', () => {
    expect(resolveStartStep({ step: 3, totalSteps: 5, completed: false }, 5)).toEqual({ step: 3, completed: false, changed: false });
  });

  it('a completed lesson reopens at its final step', () => {
    expect(resolveStartStep({ step: 4, totalSteps: 5, completed: true }, 5)).toEqual({ step: 4, completed: true, changed: false });
  });

  it('a lesson that changed since starts over, and says so', () => {
    expect(resolveStartStep({ step: 3, totalSteps: 5 }, 7)).toEqual({ step: 0, completed: false, changed: true });
  });

  it('never points past the end', () => {
    expect(resolveStartStep({ step: 9 }, 5).step).toBe(4);
  });
});

describe('isLessonComplete', () => {
  const base = { currentStepIndex: 4, totalSteps: 5 };
  it('only once the last step has played', () => {
    expect(isLessonComplete({ ...base, stepPlayback: { index: 4, animDone: false } })).toBe(false); // just shown
    expect(isLessonComplete({ ...base, stepPlayback: { index: 4, animDone: true } })).toBe(true);
  });
  it('not while more steps are still streaming in, nor for a single-step lesson', () => {
    expect(isLessonComplete({ ...base, stepPlayback: { index: 4, animDone: true }, streaming: true })).toBe(false);
    expect(isLessonComplete({ currentStepIndex: 0, totalSteps: 1, stepPlayback: { index: 0, animDone: true } })).toBe(false);
  });
  it('not on an earlier step', () => {
    expect(isLessonComplete({ currentStepIndex: 3, totalSteps: 5, stepPlayback: { index: 3, animDone: true } })).toBe(false);
  });
});

describe('newerPosition', () => {
  it('keeps the position saved later', () => {
    const a = { step: 1, savedAt: 10 };
    const b = { step: 4, savedAt: 20 };
    expect(newerPosition(a, b)).toBe(b);
    expect(newerPosition(b, a)).toBe(b);
    expect(newerPosition(null, a)).toBe(a);
  });
});
