export const DOMAIN_KEYWORDS = {
  general: [],
};

export const DOMAIN_NODE_TEMPLATES = {
  general: [
    'hook', 'prior_knowledge_bridge', 'concept', 'intuition',
    'step_by_step', 'worked_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  general: `
ANIMATION STRATEGY — GENERAL:
  Primitives: rect, circle, arrow, text, badge
  Layout rules:
    - Step-by-step sequential build.
  MINIMUM STEPS: 10
`,
};
export const DOMAIN_MIN_STEPS = {
  general: { default: 10 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {
  general: [
    { id: 'center_hub', shape: 'circle', x: 400, y: 300, r: 40, color: '#6366f1', label: 'Concept', appearsAtStep: 0 },
  ],
};
