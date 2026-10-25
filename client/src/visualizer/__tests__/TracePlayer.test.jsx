import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { instrumentJavaScript } from '../adapters/jsInstrument';
import { runInstrumented } from '../adapters/jsRecorder';
import { assertTrace } from '../traceModel';

const explain = vi.hoisted(() => vi.fn());
vi.mock('../runTrace', () => ({ explainStep: explain }));
const { default: TracePlayer } = await import('../ui/TracePlayer');

async function traceOf(source) {
  const r = await runInstrumented(instrumentJavaScript(source).code, { patchPromises: false });
  return assertTrace({ version: 1, language: 'javascript', mode: 'instrumented', source, steps: r.steps, stdout: r.stdout, error: r.error, truncated: r.truncated, maxSteps: 1000, notes: r.notes });
}

/** The player as the modal uses it: it owns nothing but the index. */
function Player({ trace, start = 0, onIndex }) {
  const [index, setIndex] = useState(start);
  return (
    <TracePlayer
      trace={trace}
      index={index}
      onIndex={(i) => {
        onIndex?.(i);
        setIndex(i);
      }}
    />
  );
}

const SUM = 'function add(a, b) {\n  return a + b;\n}\nlet total = 0;\nfor (let i = 1; i <= 2; i++) {\n  total = add(total, i);\n}\nconsole.log(total);\n';
let sum;
beforeAll(async () => {
  sum = await traceOf(SUM);
});

const stepNo = () => Number(screen.getByRole('slider', { name: 'Steps' }).getAttribute('aria-valuenow'));

describe('playback controls', () => {
  it('next, previous, first and last move through the recorded steps', () => {
    render(<Player trace={sum} />);
    expect(stepNo()).toBe(1);
    expect(screen.getByRole('button', { name: /First step/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next step/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next step/ }));
    expect(stepNo()).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: /Previous step/ }));
    expect(stepNo()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Last step' }));
    expect(stepNo()).toBe(sum.steps.length);
    expect(screen.getByText('Program finished')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /First step/ }));
    expect(stepNo()).toBe(1);
  });

  it('plays to the end, pauses, and replays from the start', () => {
    vi.useFakeTimers();
    try {
      render(<Player trace={sum} />);
      fireEvent.click(screen.getByRole('button', { name: 'Play (space)' }));
      // one step per 750 ms at 1× (each step's timer is set once the previous one has rendered)
      act(() => vi.advanceTimersByTime(760));
      act(() => vi.advanceTimersByTime(760));
      expect(stepNo()).toBe(3);
      fireEvent.click(screen.getByRole('button', { name: 'Pause (space)' }));
      act(() => vi.advanceTimersByTime(5000));
      expect(stepNo()).toBe(3); // paused means paused
      fireEvent.click(screen.getByRole('button', { name: 'Last step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Replay from the start' }));
      expect(stepNo()).toBe(1);
      act(() => vi.advanceTimersByTime(760));
      expect(stepNo()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the timeline is a keyboard slider', () => {
    render(<Player trace={sum} />);
    const slider = screen.getByRole('slider', { name: 'Steps' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(stepNo()).toBe(2);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(stepNo()).toBe(sum.steps.length);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(stepNo()).toBe(1);
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^Step 1 of \d+, line 4$/);
  });

  it('says what the step did and what happens next, from the trace', () => {
    const at = sum.steps.findIndex((s) => s.line === 5);
    render(<Player trace={sum} start={at} />);
    const step = screen.getByRole('region', { name: `Step ${at + 1}` });
    expect(within(step).getByText('Runs line 5')).toBeInTheDocument();
    expect(within(step).getByText(/The loop runs its body: next is line 6/)).toBeInTheDocument();
  });
});

describe('views', () => {
  it('tabs switch with arrow keys and show calls with what they returned', () => {
    render(<Player trace={sum} start={sum.steps.length - 1} />);
    const tablist = screen.getByRole('tablist', { name: 'Walkthrough views' });
    expect(within(tablist).queryByRole('tab', { name: 'Event loop' })).toBeNull(); // nothing asynchronous here
    within(tablist).getByRole('tab', { name: 'Variables' }).focus();
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Variables' }));
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(within(tablist).getByRole('tab', { name: 'Calls' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('add(0, 1)')).toBeInTheDocument();
    expect(within(panel).getByText('add(1, 2)')).toBeInTheDocument();
    expect(within(panel).getAllByText('→ 3').length).toBeGreaterThan(0);
  });

  it('a variable shows its history, and a past value jumps to its step', () => {
    const onIndex = vi.fn();
    render(<Player trace={sum} start={sum.steps.length - 1} onIndex={onIndex} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Variables' }));
    fireEvent.click(screen.getByRole('button', { name: 'total' }));
    expect(screen.getByText(/total over time · 3 values/i)).toBeInTheDocument();
    const firstOne = screen.getAllByRole('button', { name: /^Step \d+: 1, line \d+$/ })[0];
    fireEvent.click(firstOne);
    const target = sum.steps.findIndex((s) => s.frames[0].locals.some((l) => l.name === 'total' && l.value.v === 1));
    expect(onIndex).toHaveBeenLastCalledWith(target);
  });

  it('the tutor sends the step\'s recorded facts at the chosen depth', async () => {
    explain.mockResolvedValueOnce({ answer: 'total becomes 3 because add returned 3.' });
    render(<Player trace={sum} start={sum.steps.length - 2} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Explain this step/ })));
    expect(explain).toHaveBeenCalledTimes(1);
    const sent = explain.mock.calls[0][0];
    expect(sent).toMatchObject({ language: 'javascript', level: 'simple', step: { index: sum.steps.length - 2, line: sum.steps[sum.steps.length - 2].line } });
    expect(sent.step.variables).toContain('total = 3');
    expect(screen.getByText('total becomes 3 because add returned 3.')).toBeInTheDocument();
  });

  it('shows the event loop for code that schedules work', async () => {
    const t = await traceOf('setTimeout(function later() {\n  let x = 1;\n}, 500);\nconsole.log("now");\n');
    render(<Player trace={t} start={1} />);
    expect(screen.getByRole('tab', { name: 'Event loop' })).toHaveAttribute('aria-selected', 'true'); // opens there
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('setTimeout → later · at 500 ms')).toBeInTheDocument();
  });

  it('a run that failed before its first step shows the error and the output', () => {
    const failed = { ...sum, steps: [], stdout: '', error: { kind: 'compile', message: 'SyntaxError: Unexpected token', line: 2 } };
    render(<Player trace={failed} />);
    expect(screen.getByText('SyntaxError: Unexpected token')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
  });
});
