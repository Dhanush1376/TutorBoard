import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ParamPanel from '../ParamPanel';

/** A stand-in engine: the panel only needs paramState and setParams. */
const fakeEngine = () => {
  const values = { v0: 20, theta0: 45, g: 9.8 };
  const engine = {
    get paramState() {
      return {
        params: [
          { id: 'v0', label: 'launch speed', value: 20, min: 5, max: 25, step: 0.5, unit: 'm/s' },
          { id: 'theta0', label: 'launch angle', value: 45, min: 15, max: 75, step: 1, unit: 'deg' },
          { id: 'g', label: 'gravity g', value: 9.8, min: 9.8, max: 9.8, unit: 'm/s^2' },
        ],
        derived: [{ id: 'R', label: 'range', unit: 'm', digits: 1, value: (values.v0 ** 2 * Math.sin((2 * values.theta0 * Math.PI) / 180)) / 9.8 }],
        values: { ...values },
      };
    },
    setParams: vi.fn(async (v) => { Object.assign(values, v); }),
  };
  return engine;
};

describe('ParamPanel', () => {
  it('reports the values once the board shows them', async () => {
    const onChange = vi.fn();
    render(<ParamPanel engine={fakeEngine()} onChange={onChange} />);
    await act(async () => { fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '10' } }); });
    expect(onChange).toHaveBeenLastCalledWith({ v0: 10, theta0: 45, g: 9.8 });
  });

  it('shows a slider per adjustable parameter, constants and derived values as readouts', () => {
    render(<ParamPanel engine={fakeEngine()} />);
    expect(screen.getAllByRole('slider')).toHaveLength(2); // g is fixed: no slider
    expect(screen.getByText('45°')).toBeInTheDocument();
    expect(screen.getByText('9.8 m/s²')).toBeInTheDocument();
    expect(screen.getByText('40.8 m')).toBeInTheDocument();
  });

  it('sends a moved slider to the engine and shows the new derived value', async () => {
    const engine = fakeEngine();
    render(<ParamPanel engine={engine} />);
    await act(async () => { fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '10' } }); });
    expect(engine.setParams).toHaveBeenCalledWith({ v0: 10 });
    expect(screen.getByText('10.2 m')).toBeInTheDocument();
    expect(screen.getByText('10.0 m/s')).toBeInTheDocument();
  });

  it('renders nothing for a lesson without sliders', () => {
    const { container } = render(<ParamPanel engine={{ paramState: { params: [], derived: [], values: {} }, setParams: vi.fn() }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
