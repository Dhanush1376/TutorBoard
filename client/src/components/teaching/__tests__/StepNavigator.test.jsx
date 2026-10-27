import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepNavigator from '../StepNavigator';

const steps = [
  { title: 'The equation', narration: 'Start from the implicit equation.' },
  { title: 'Symmetry', narration: 'The curve is mirrored about the y-axis.' },
  { title: 'Upper branch', narration: 'The positive root draws the lobes.' },
];

describe('StepNavigator — slim step strip', () => {
  it('marks done and current steps, with no text shown until the learner looks', () => {
    render(<StepNavigator steps={steps} totalSteps={3} currentStepIndex={1} onGoToStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Step 1: The equation (done)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 2: Symmetry' })).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('The curve is mirrored about the y-axis')).not.toBeInTheDocument();
  });

  it('hovering a step peeks its title and one-line summary; clicking jumps to it', () => {
    const onGoToStep = vi.fn();
    render(<StepNavigator steps={steps} totalSteps={3} currentStepIndex={0} onGoToStep={onGoToStep} />);
    const third = screen.getByRole('button', { name: 'Step 3: Upper branch' });
    fireEvent.mouseEnter(third);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Upper branch');
    expect(screen.getByRole('tooltip')).toHaveTextContent('The positive root draws the lobes');
    fireEvent.click(third);
    expect(onGoToStep).toHaveBeenCalledWith(2);
  });

  it('renders nothing for a single-step lesson', () => {
    const { container } = render(<StepNavigator steps={[{ title: 'Only' }]} totalSteps={1} currentStepIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
