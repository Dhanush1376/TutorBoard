import { describe, expect, it } from 'vitest';
import { mathRuns, mathText } from '../render/svg';

const flat = (s: string) => mathRuns(s).map((r) => (r.shift > 0 ? `^(${r.text})` : r.shift < 0 ? `_(${r.text})` : r.text)).join('');

describe('labels written in LaTeX (seen in docs/eval/runs/flash36-low/phy-3)', () => {
  it('turns commands into symbols and functions into words', () => {
    expect(flat('mg \\sin\\theta')).toBe('mg sin θ');
    expect(flat('mg \\cos\\theta')).toBe('mg cos θ');
    expect(flat('\\theta = 30^\\circ')).toBe('θ = 30°');
    expect(flat('\\Delta x \\approx 2\\pi r')).toBe('Δ x ≈ 2π r');
  });

  it('makes real subscripts and superscripts', () => {
    expect(flat('F_N')).toBe('F_(N)');
    expect(flat('F_g = mg')).toBe('F_(g) = mg');
    expect(flat('v_{0}^2')).toBe('v_(0)^(2)');
    expect(flat('x^{n+1}')).toBe('x^(n+1)');
    expect(flat('$E = mc^2$')).toBe('E = mc^(2)');
    expect(flat('\\(v_0\\)')).toBe('v_(0)');
  });

  it('flattens fractions, roots and text wrappers', () => {
    expect(flat('\\frac{1}{2}mv^2')).toBe('1/2mv^(2)');
    expect(flat('\\sqrt{2gh}')).toBe('√(2gh)');
    expect(flat('\\vec{F}_{net}')).toBe('F_(net)');
    expect(flat('\\text{slope}')).toBe('slope');
    // over-escaped (docs/eval/runs/flash36-low-v2/phy-3)
    expect(flat('\\\\mathbf{F}_{net}')).toBe('F_(net)');
  });

  it('renders tspans with shifted baselines, and plain labels as plain text', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const t = mathText(svg, 'F_N', { size: 20 });
    const spans = t.querySelectorAll('tspan');
    expect(spans).toHaveLength(2);
    expect(spans[1].getAttribute('dy')).toBe('6.4');
    expect(spans[1].getAttribute('font-size')).toBe('14.4');
    expect(t.textContent).toBe('FN');
    const plain = mathText(svg, 'Normal force', {});
    expect(plain.querySelector('tspan')).toBeNull();
    expect(plain.textContent).toBe('Normal force');
  });
});
