export const DOMAIN_KEYWORDS = {
  business: [
    ['porter five forces', 3], ['swot analysis', 3], ['pestle analysis', 3],
    ['value chain', 3], ['business model canvas', 3], ['balanced scorecard', 3],
    ['cash flow statement', 3], ['income statement', 3], ['balance sheet', 3],
    ['net present value', 3], ['internal rate of return', 3], ['wacc', 3],
    ['supply chain management', 3], ['operations management', 3],
    ['human resource management', 3], ['organizational behavior', 3],
    ['entrepreneurship', 2], ['venture capital', 3], ['startup', 2],
    ['marketing mix', 3], ['brand equity', 3], ['customer lifetime value', 3],
    ['bba', 3], ['mba', 3], ['cfa', 3],
    ['marketing', 1], ['finance', 1], ['accounting', 1], ['strategy', 1],
    ['management', 1], ['revenue', 1], ['profit', 1], ['stakeholder', 1],
    ['leadership', 1], ['negotiation', 1], ['investment', 1],
  ],
  economics: [
    ['supply and demand', 3], ['price elasticity', 3], ['consumer surplus', 3],
    ['producer surplus', 3], ['market equilibrium', 3], ['deadweight loss', 3],
    ['gdp calculation', 3], ['inflation rate', 2], ['unemployment rate', 2],
    ['monetary policy', 3], ['fiscal policy', 3], ['quantitative easing', 3],
    ['phillips curve', 3], ['laffer curve', 3], ['is lm model', 3],
    ['game theory', 3], ['nash equilibrium', 3], ['prisoner dilemma', 3],
    ['comparative advantage', 3], ['trade deficit', 2], ['exchange rate', 2],
    ['supply', 1], ['demand', 1], ['inflation', 1], ['gdp', 1],
    ['market', 1], ['trade', 1], ['micro', 1], ['macro', 1],
    ['utility', 1], ['production', 1], ['consumption', 1], ['elasticity', 1],
    ['opportunity cost', 2], ['externality', 2], ['public good', 2],
  ],
  aviation_maritime: [
    ['instrument flight rules', 3], ['visual flight rules', 3],
    ['air traffic control', 3], ['instrument landing system', 3],
    ['angle of attack', 3], ['bernoulli lift', 3], ['stall speed', 3],
    ['weight and balance', 3], ['flight plan', 2], ['metar', 3], ['notam', 3],
    ['colregs', 3], ['beaufort scale', 3], ['tide calculation', 3],
    ['celestial navigation', 3], ['dead reckoning', 3],
    ['aircraft', 1], ['pilot', 1], ['navigation', 1], ['altitude', 1],
    ['thrust', 1], ['lift', 1], ['drag', 1], ['runway', 1],
    ['nautical', 1], ['vessel', 1], ['tide', 1], ['cockpit', 1],
    ['fuel', 1], ['engine', 1], ['atc', 2],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  business: [
    'scenario_hook', 'concept', 'framework', 'case_study',
    'worked_example', 'visual', 'common_pitfall',
    'real_world_application', 'result',
  ],
  economics: [
    'scenario_hook', 'concept', 'model', 'graph_intuition',
    'worked_example', 'visual', 'policy_implication',
    'real_world_application', 'result',
  ],
  aviation_maritime: [
    'scenario_hook', 'concept', 'physical_intuition',
    'procedure_walkthrough', 'visual', 'safety_critical',
    'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  business: `
ANIMATION STRATEGY — BUSINESS:
  Primitives: rect (process boxes), arrow (flow), badge (KPIs), text (labels)
  Layout rules:
    - SWOT: 4-quadrant rect layout.
    - Processes: sequential rect boxes with arrow connectors.
  MINIMUM STEPS: framework=10 | process=10
`,
  economics: `
ANIMATION STRATEGY — ECONOMICS:
  Primitives: path (curves), arrow (shifts), circle (equilibrium), badge (values)
  Layout rules:
    - Supply/Demand: rect axes, path=curves.
    - Game theory: 2×2 rect matrix with payoffs.
  MINIMUM STEPS: supply-demand=12 | game theory=10
`,
  aviation_maritime: `
ANIMATION STRATEGY — AVIATION & MARITIME:
  Primitives: path (flight path), arrow (forces), circle (instruments), badge (values)
  Layout rules:
    - Navigation: simplified map rect, path=route.
    - Instruments: circle gauges with animated needles.
  MINIMUM STEPS: forces=10 | navigation=12
`,
};
export const DOMAIN_MIN_STEPS = {
  business: { framework: 10, process: 10, case: 12, financial: 10, default: 8 },
  economics: { supply: 12, gdp: 8, market: 10, game: 10, default: 8 },
  aviation_maritime: { force: 10, navigation: 12, instrument: 10, weather: 10, rule: 8, default: 8 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {};
