export const DOMAIN_KEYWORDS = {
  arts: [
    ['color theory', 3], ['golden ratio', 3], ['gestalt principles', 3],
    ['typography hierarchy', 3], ['grid system', 3], ['ui ux design', 3],
    ['user experience', 2], ['interaction design', 3], ['visual design', 2],
    ['adobe illustrator', 2], ['figma', 2], ['sketch', 2],
    ['film theory', 3], ['cinematography', 3], ['mise en scene', 3],
    ['music composition', 3], ['art history', 3], ['modernism', 2], ['postmodernism', 2],
    ['design', 1], ['color', 1], ['composition', 1], ['typography', 1],
    ['animation', 1], ['photography', 1], ['architecture', 1],
    ['sculpture', 1], ['painting', 1], ['illustration', 1],
    ['fashion', 1], ['interior design', 2], ['graphic design', 2],
  ],
  music: [
    ['music theory', 3], ['circle of fifths', 3], ['chord progression', 3],
    ['counterpoint', 3], ['figured bass', 3], ['voice leading', 3],
    ['sonata form', 3], ['rondo form', 3], ['theme and variation', 3],
    ['time signature', 2], ['key signature', 2], ['tempo marking', 2],
    ['dynamics', 2], ['articulation', 2], ['phrasing', 2],
    ['tonic', 2], ['dominant', 2], ['subdominant', 2], ['cadence', 2],
    ['major scale', 2], ['minor scale', 2], ['mode', 2], ['interval', 2],
    ['orchestration', 3], ['instrumentation', 2], ['arranging', 2],
    ['mixing', 2], ['mastering', 2], ['daw', 2], ['midi', 2],
    ['jazz harmony', 3], ['blues scale', 3], ['improvisation', 2],
    ['rhythm', 1], ['melody', 1], ['harmony', 1], ['notation', 1],
    ['solfege', 3], ['ear training', 3], ['sight reading', 3],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  arts: [
    'aesthetic_hook', 'concept', 'technique_breakdown',
    'worked_example', 'visual', 'style_analysis',
    'real_world_application', 'result',
  ],
  music: [
    'listening_hook', 'concept', 'theory_foundation', 'ear_training',
    'worked_example', 'visual', 'composition_exercise',
    'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  arts: `
ANIMATION STRATEGY — ARTS & DESIGN:
  Primitives: rect (composition zones), circle (focal points), text (typography)
  Layout rules:
    - Composition: overlay grid/rule-of-thirds on rect canvas.
    - UX: wireframe-style rect components.
  MINIMUM STEPS: color theory=10 | composition=10
`,
  music: `
ANIMATION STRATEGY — MUSIC:
  Primitives: rect (staff), circle (notes), text (labels), path (staff lines)
  Layout rules:
    - Circle of Fifths: arc segments with labels.
    - Staff: 5 horizontal lines, circles as notes.
  MINIMUM STEPS: music theory=10 | harmony=10
`,
};
export const DOMAIN_MIN_STEPS = {
  arts: { color: 10, typo: 8, composition: 10, flow: 12, default: 8 },
  music: { staff: 10, fifth: 10, chord: 10, rhythm: 8, default: 8 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {};
