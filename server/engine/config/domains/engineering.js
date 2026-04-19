export const DOMAIN_KEYWORDS = {
  engineering: [
    ['free body diagram', 3], ['stress strain', 3], ['factor of safety', 3],
    ['finite element', 3], ['control system', 3], ['pid controller', 3],
    ['signal processing', 3], ['fourier analysis', 2],
    ['mechanical engineering', 3], ['civil engineering', 3],
    ['electrical engineering', 3], ['electronics engineering', 3],
    ['thermodynamic cycle', 3], ['carnot cycle', 3], ['rankine cycle', 3],
    ['fluid dynamics', 3], ['bernoulli', 2], ['reynolds number', 3],
    ['moment of inertia', 3], ['shear force', 3], ['bending moment', 3],
    ['circuit analysis', 3], ['kirchhoff', 2], ['thevenin', 3],
    ['cad', 2], ['manufacturing', 1], ['welding', 2], ['turbine', 2],
    ['voltage', 1], ['current', 1], ['resistance', 1], ['sensor', 1],
    ['motor', 1], ['hydraulic', 1], ['pneumatic', 2],
    ['tolerance', 2], ['material science', 3], ['yield strength', 3],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  engineering: [
    'problem_statement', 'concept', 'physical_intuition',
    'formula_derivation', 'worked_example', 'visual',
    'design_consideration', 'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  engineering: `
ANIMATION STRATEGY — ENGINEERING:
  Primitives: rect (components), arrow (forces/flow), circle (joints), badge (values)
  Layout rules:
    - Mechanics: force arrows pointing from/to central object.
    - Control systems: block diagram rects with arrow signals.
  MINIMUM STEPS: circuit=12 | structures=10
`,
};
