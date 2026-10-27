/**
 * Saving the learner's place in a lesson: debounced (one write for a burst of
 * step changes, none per frame), flushed when leaving the lesson, never for a
 * lesson still streaming, and a stale save adopts the server's newer position.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('zustand/middleware', () => ({ persist: (config) => config, createJSONStorage: vi.fn() }));
const patch = vi.fn();
vi.mock('../../services/api', () => ({
  default: { patch: (...a) => patch(...a) },
  BASE_URL: '',
  getAuthHeaders: () => ({}),
}));

import useTutorStore from '../../store/tutorStore';
import useLessonProgress from '../useLessonProgress';

const initialState = useTutorStore.getState();
const S = () => useTutorStore.getState();

const scene = (over = {}) => ({
  id: 'scene-1', title: 'Circle area', renderer: 'scene-v2', artifactId: 'art-1',
  sceneV2: { beats: [{}, {}, {}, {}, {}] },
  steps: [1, 2, 3, 4, 5].map((n) => ({ title: `Step ${n}` })),
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  patch.mockReset();
  patch.mockResolvedValue({ data: { ok: true, stale: false } });
  useTutorStore.setState(initialState, true);
  useTutorStore.setState({
    activeScene: scene(), totalSteps: 5, currentStepIndex: 0, sceneBranch: null,
    stepPlayback: { index: 0, animDone: false, voiceDone: false }, lessonPositions: {},
  });
});
afterEach(() => vi.useRealTimers());

const go = (step, animDone = false) => act(() => {
  useTutorStore.setState({ currentStepIndex: step, stepPlayback: { index: step, animDone, voiceDone: animDone } });
});

describe('useLessonProgress', () => {
  it('saves slider values with the position, even at the first step', async () => {
    renderHook(() => useLessonProgress());
    act(() => S().rememberLessonParams('art-1', { v0: 12 }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][1]).toMatchObject({ step: 0, totalSteps: 5, params: { v0: 12 } });
    act(() => S().rememberLessonParams('art-1', { v0: 12 })); // same values: nothing new to write
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch).toHaveBeenCalledOnce();
    act(() => S().rememberLessonParams('art-1', { v0: 8 }));
    go(2);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch.mock.calls.at(-1)[1]).toMatchObject({ step: 2, params: { v0: 8 } });
  });

  it('a position from the server brings its slider values', () => {
    act(() => S().rememberLessonPosition('art-9', { step: 1, totalSteps: 3, savedAt: 5, params: { k: 40 } }));
    expect(S().lessonParams['art-9']).toEqual({ k: 40 });
  });

  it('skimming through steps is saved once, with the last viewed step', async () => {
    renderHook(() => useLessonProgress());
    go(1); go(2); go(3);
    expect(patch).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][0]).toBe('/api/artifact/art-1/progress');
    expect(patch.mock.calls[0][1]).toMatchObject({ step: 3, totalSteps: 5, completed: false });
    expect(S().lessonPositions['art-1'].step).toBe(3); // remembered at once for this session
  });

  it('the lesson is completed only once its last step has played', async () => {
    renderHook(() => useLessonProgress());
    go(4, false);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch.mock.calls.at(-1)[1].completed).toBe(false);
    go(4, true);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch.mock.calls.at(-1)[1]).toMatchObject({ step: 4, completed: true });
  });

  it('opening a lesson at its first step writes nothing', async () => {
    renderHook(() => useLessonProgress());
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(patch).not.toHaveBeenCalled();
  });

  it('a lesson still streaming in, or not saved yet, is not written', async () => {
    useTutorStore.setState({ activeScene: scene({ streaming: true }) });
    const { rerender } = renderHook(() => useLessonProgress());
    go(2);
    await act(async () => { vi.advanceTimersByTime(1000); });
    act(() => useTutorStore.setState({ activeScene: scene({ artifactId: null }) }));
    rerender();
    go(3);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(patch).not.toHaveBeenCalled();
  });

  it('leaving the lesson writes the pending position right away', async () => {
    const { unmount } = renderHook(() => useLessonProgress());
    go(2);
    unmount();
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][1].step).toBe(2);
  });

  it('when the server already has a newer position, that one is kept', async () => {
    patch.mockResolvedValue({ data: { ok: true, stale: true, lessonProgress: { step: 4, totalSteps: 5, completed: true, savedAt: Date.now() + 60000 } } });
    renderHook(() => useLessonProgress());
    go(1);
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { await Promise.resolve(); });
    expect(S().lessonPositions['art-1']).toMatchObject({ step: 4, completed: true });
  });

  it('a failed write keeps the lesson usable and is sent again at the next save point', async () => {
    patch.mockRejectedValueOnce(new Error('offline'));
    const { unmount } = renderHook(() => useLessonProgress());
    go(2);
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { await Promise.resolve(); });
    expect(S().currentStepIndex).toBe(2);
    unmount(); // leaving the lesson is a save point
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[1][1].step).toBe(2);
  });
});
