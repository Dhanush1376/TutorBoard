/**
 * Request progress: the chat status line shows only what the server reported,
 * a stage is ticked only once it is reported done, another request's events
 * cannot change it, and Stop / failure end it.
 */
import { describe, it, expect } from 'vitest';
import { createProgress, applyProgressEvent, endProgress, describeProgress, isLessonPreparing } from '../requestProgress';

const ev = (stage, state, extra = {}) => ({ type: 'progress', requestId: 'r1', stage, state, ...extra });
const run = (...events) => events.reduce((p, e) => applyProgressEvent(p, e), createProgress('r1'));

describe('describeProgress', () => {
  it('before the server reports anything, says it is getting started — no invented steps', () => {
    const view = describeProgress(createProgress('r1'));
    expect(view.label).toBe('Getting started…');
    expect(view.stages).toEqual([]);
  });

  it('follows the stages the server reports, in order', () => {
    expect(describeProgress(run(ev('planning', 'active'))).label).toBe('Planning your explanation…');
    expect(describeProgress(run(ev('planning', 'done'), ev('web', 'active'))).label).toBe('Searching the web…');
    expect(describeProgress(run(ev('planning', 'done'), ev('writing', 'active'))).label).toBe('Starting your explanation…');
    expect(describeProgress(run(ev('writing', 'active')), { hasText: true }).label).toBe('Writing your explanation…');
  });

  it('once the text is done but its visual is not, says the walkthrough is being finished', () => {
    const p = run(ev('writing', 'active'), ev('lesson', 'active'), ev('writing', 'done'));
    expect(describeProgress(p, { hasText: true }).label).toBe('Finishing your visual walkthrough…');
    expect(isLessonPreparing(p)).toBe(true);
  });

  it('ticks a stage only when it is reported done, and never lists the same stage twice', () => {
    const p = run(ev('web', 'active'), ev('web', 'active'), ev('web', 'done', { count: 3 }), ev('writing', 'active'));
    const { stages } = describeProgress(p, { hasText: true });
    expect(stages.map((s) => s.id)).toEqual(['web', 'writing']);
    expect(stages[0]).toMatchObject({ status: 'done', label: 'Searched the web · 3 sources' });
    expect(stages[1].status).toBe('active');
  });

  it('a failed visual is shown as failed, not done', () => {
    const p = run(ev('lesson', 'active'), ev('lesson', 'failed'));
    expect(describeProgress(p).stages[0]).toMatchObject({ id: 'lesson', status: 'failed' });
    expect(isLessonPreparing(p)).toBe(false);
  });

  it('does not list stages that were skipped or the internal planning step', () => {
    const p = run(ev('planning', 'active'), ev('planning', 'done'), ev('memory', 'skipped'));
    expect(describeProgress(p).stages).toEqual([]);
  });
});

describe('applyProgressEvent', () => {
  it('ignores events from another request', () => {
    const p = run(ev('writing', 'active'));
    const next = applyProgressEvent(p, { ...ev('lesson', 'active'), requestId: 'r0' });
    expect(next).toBe(p);
  });

  it('a late "active" never revives a finished stage', () => {
    const p = run(ev('writing', 'active'), ev('writing', 'done'));
    expect(applyProgressEvent(p, ev('writing', 'active'))).toBe(p);
  });

  it('ignores unknown stages and states', () => {
    const p = run();
    expect(applyProgressEvent(p, ev('polishing', 'active'))).toBe(p);
    expect(applyProgressEvent(p, ev('writing', 'thinking'))).toBe(p);
  });

  it('after Stop, nothing runs any more and later events change nothing', () => {
    const stopped = endProgress(run(ev('writing', 'active'), ev('lesson', 'active')), 'cancelled');
    expect(describeProgress(stopped)).toMatchObject({ label: 'Stopped', active: false, stages: [] });
    expect(applyProgressEvent(stopped, ev('lesson', 'done'))).toBe(stopped);
    expect(isLessonPreparing(stopped)).toBe(false);
  });
});
