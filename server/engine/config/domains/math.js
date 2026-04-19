export const DOMAIN_KEYWORDS = {
  mathematics: [
    ['differential equation', 3], ['partial derivative', 3], ['riemann integral', 3],
    ['fourier transform', 3], ['laplace transform', 3], ['linear algebra', 3],
    ['set theory', 3], ['number theory', 3], ['complex analysis', 3],
    ['abstract algebra', 3], ['group theory', 3], ['ring theory', 3],
    ['combinatorics', 2], ['permutation', 2], ['combination', 2],
    ['probability distribution', 3], ['bayes theorem', 3],
    ['calculus', 2], ['derivative', 2], ['integral', 2], ['limit', 2],
    ['matrix', 2], ['vector', 2], ['eigenvalue', 3], ['eigenvector', 3],
    ['theorem', 1], ['proof', 1], ['algebra', 1], ['geometry', 1],
    ['trigonometry', 2], ['function', 1], ['series', 1],
    ['polynomial', 2], ['determinant', 2], ['gradient', 2],
    ['topology', 3], ['manifold', 3], ['differential geometry', 3],
    ['modular arithmetic', 3], ['prime', 1], ['factorization', 2],
    ['statistics', 1], ['hypothesis testing', 3], ['confidence interval', 3],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  mathematics: [
    'hook', 'prior_knowledge_bridge', 'concept', 'geometric_intuition',
    'proof_sketch', 'worked_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  mathematics: `
ANIMATION STRATEGY — MATHEMATICS:
  Primitives: polygon, axes, dot, circle, line (connection), text, arc
  Layout rules:
    - Geometry: ALWAYS draw explicit shapes using 'polygon' with precise 'points' (e.g., [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2]] for a right triangle). DO NOT string circles together as a flowchart.
    - Graphing/Functions: Use 'axes' for the background coordinate system.
    - Equations: Center label prominently.
    - Connections: Use "type": "line" for non-directional geometric edges.
  MINIMUM STEPS: calculus=12 | geometry=8 | matrices=10 | statistics=8
`,
};
export const DOMAIN_MIN_STEPS = {
  mathematics: { calculus: 12, geometry: 10, matrix: 10, statistics: 8, probability: 10, default: 8 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {
  mathematics: [
    { id: 'xaxis', shape: 'line', x1: 50, y1: 350, x2: 750, y2: 350, color: '#ffffff40', appearsAtStep: 0 },
    { id: 'yaxis', shape: 'line', x1: 400, y1: 50, x2: 400, y2: 550, color: '#ffffff40', appearsAtStep: 0 },
  ],
};
