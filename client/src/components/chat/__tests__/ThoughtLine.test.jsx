/**
 * ThoughtLine shows exactly the status it is given: no timer advances it, no
 * default steps are invented, and the status line is announced politely.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import ThoughtLine from '../ThoughtLine';

afterEach(() => vi.useRealTimers());

describe('ThoughtLine', () => {
  it('never advances on its own', () => {
    vi.useFakeTimers();
    render(<ThoughtLine label="Searching the web…" steps={[{ id: 'web', label: 'Searching the web', status: 'active' }]} />);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(screen.getByRole('status')).toHaveTextContent('Searching the web…');
    expect(screen.queryByText(/Polishing answer|Finding solution|Analyzing problem|Finalizing/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(1);
  });

  it('with no stages reported, shows no step list at all', () => {
    render(<ThoughtLine label="Getting started…" />);
    expect(screen.queryByTestId('progress-steps')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Getting started…');
  });

  it('marks done, active and failed stages distinctly, with no elapsed clock', () => {
    render(
      <ThoughtLine
        label="Finishing your visual walkthrough…"
        steps={[
          { id: 'web', label: 'Searched the web · 2 sources', status: 'done' },
          { id: 'writing', label: 'Wrote the explanation', status: 'done' },
          { id: 'lesson', label: 'Preparing your interactive visualization', status: 'active' },
        ]}
      />
    );
    const items = screen.getAllByRole('listitem', { hidden: true });
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual(['done', 'done', 'active']);
    expect(document.querySelector('.thought-line__timer')).toBeNull();
  });

  it('the step list opens from the status line', () => {
    render(<ThoughtLine label="Writing your explanation…" steps={[{ id: 'writing', label: 'Writing your explanation', status: 'active' }]} />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
