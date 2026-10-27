/**
 * Playback controls reflect what can actually be played: Play / Pause / Replay,
 * Previous and Next disabled at their ends, nothing to play for one step.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnifiedControlBar from '../UnifiedControlBar';

const bar = (props = {}) => {
  const handlers = { onPlay: vi.fn(), onPause: vi.fn(), onReplay: vi.fn(), onPrevStep: vi.fn(), onNextStep: vi.fn() };
  render(<UnifiedControlBar totalSteps={5} currentStepIndex={0} showDoubtInput={false} {...handlers} {...props} />);
  return handlers;
};

describe('UnifiedControlBar', () => {
  it('Play at the start; Previous disabled on the first step', () => {
    const h = bar();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(h.onPlay).toHaveBeenCalledOnce();
    expect(screen.getByTitle('Previous Step')).toBeDisabled();
    expect(screen.getByTitle('Next Step')).not.toBeDisabled();
  });

  it('Pause while playing; Resume when paused mid-lesson', () => {
    const h = bar({ isPlaying: true, currentStepIndex: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(h.onPause).toHaveBeenCalledOnce();
  });

  it('Resume when paused mid-lesson', () => {
    bar({ currentStepIndex: 2 });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('after the lesson is complete, the primary control is Replay', () => {
    const h = bar({ currentStepIndex: 4, isComplete: true });
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay lesson' }));
    expect(h.onReplay).toHaveBeenCalledOnce();
    expect(h.onPlay).not.toHaveBeenCalled();
    expect(screen.getByTitle('Next Step')).toBeDisabled();
  });

  it('at the last step but not finished playing, it is still Play — not Replay', () => {
    bar({ currentStepIndex: 4, isComplete: false });
    expect(screen.queryByRole('button', { name: 'Replay lesson' })).not.toBeInTheDocument();
  });

  it('a single-step lesson has nothing to play', () => {
    const h = bar({ totalSteps: 1 });
    const primary = screen.getByRole('button', { name: /single-step/ });
    expect(primary).toBeDisabled();
    fireEvent.click(primary);
    expect(h.onPlay).not.toHaveBeenCalled();
  });
});
