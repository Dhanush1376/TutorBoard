import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckCard from '../CheckCard';
import { awaitingCheck, checkKey } from '../../../lib/teaching';

const check = {
  question: '3 sits under 7. What must happen next?',
  choices: ['3 swaps with 7', '3 swaps with 9', 'Nothing'],
  answer: 0,
  explain: 'A parent must be smaller than its child.',
};

describe('CheckCard — predict the next step', () => {
  it('a right answer says so and lets the learner continue', () => {
    const onAnswer = vi.fn();
    const onContinue = vi.fn();
    render(<CheckCard check={check} onAnswer={onAnswer} onContinue={onContinue} onExplain={vi.fn()} />);
    expect(screen.queryByText('Continue')).not.toBeInTheDocument(); // nothing to continue before answering
    fireEvent.click(screen.getByText('3 swaps with 7'));
    expect(onAnswer).toHaveBeenCalledWith(0, true);
    expect(screen.getByText('Right!')).toBeInTheDocument();
    expect(screen.getByText(check.explain)).toBeInTheDocument();
    expect(screen.queryByText('Show me on the board')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('a wrong answer shows the right one and offers the explanation on the board', () => {
    const onAnswer = vi.fn();
    const onExplain = vi.fn();
    render(<CheckCard check={check} onAnswer={onAnswer} onContinue={vi.fn()} onExplain={onExplain} />);
    fireEvent.click(screen.getByText('3 swaps with 9'));
    expect(onAnswer).toHaveBeenCalledWith(1, false);
    expect(screen.getByText(/Not quite — it's “3 swaps with 7”/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Nothing')); // answers are final
    expect(onAnswer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Show me on the board'));
    expect(onExplain).toHaveBeenCalled();
  });

  it('coming back to an answered check shows the answer, not a fresh question', () => {
    render(<CheckCard check={check} answered={2} onContinue={vi.fn()} />);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
  });
});

describe('awaitingCheck', () => {
  const lesson = { title: 'Heap insert', steps: [{}, { check }, {}] };
  it('holds the lesson only at an unanswered check', () => {
    expect(awaitingCheck(lesson, 0, {})).toBe(false);
    expect(awaitingCheck(lesson, 1, {})).toBe(true);
    expect(awaitingCheck(lesson, 1, { [checkKey(lesson, 1)]: 0 })).toBe(false);
  });
});
