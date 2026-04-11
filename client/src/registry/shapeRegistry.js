/**
 * Shape Registry — The visual contract for TutorBoard
 * 
 * This registry defines all available shapes, their AI-facing names,
 * and the properties they require.
 */

export const SHAPE_REGISTRY = {
  // --- Geometric / Basic ---
  orb: {
    aliases: ['circle', 'node'],
    description: 'Concepts, entities, planets, or nodes.',
    props: ['label', 'color', 'scale']
  },
  rect: {
    aliases: ['block', 'rectangle', 'box', 'step_box'],
    description: 'Containers, code blocks, or UI state.',
    props: ['label', 'color', 'scale']
  },
  dot: {
    aliases: ['point', 'data_dot', 'scatter'],
    description: 'Tiny dots for scatter plots or graph points.',
    props: ['label', 'color']
  },
  
  // --- Complex / Domain Specific ---
  polygon: {
    aliases: ['triangle', 'shape', 'math_shape'],
    description: 'Custom geometry. Requires normalized points.',
    props: ['points', 'label', 'color'],
    required: ['points']
  },
  array: {
    aliases: ['data_block', 'datablock'],
    description: 'Horizontal list for sorting or memory. Requires values.',
    props: ['values', 'label', 'color'],
    required: ['values']
  },
  axes: {
    aliases: ['plot', 'cartesian', 'graph_bg'],
    description: 'X/Y coordinate background for plots.',
    props: ['label', 'color']
  },
  
  // --- UI / Logic ---
  pointer: {
    aliases: ['indicator', 'cursor'],
    description: 'An arrow pointing at something with a small label.',
    props: ['label', 'color']
  },
  codeline: {
    aliases: ['code', 'formula', 'snippet'],
    description: 'Monospaced text line for code or math.',
    props: ['label', 'code']
  },
  badge: {
    aliases: ['tag', 'metric'],
    description: 'Small rounded pill for metadata or names.',
    props: ['label', 'color']
  },
  comparator: {
    aliases: ['logic', 'comparison'],
    description: 'Comparison bubble (e.g. A > B).',
    props: ['leftVal', 'rightVal', 'operator', 'result']
  },
  swapbridge: {
    aliases: ['swap_arc'],
    description: 'Animated arc indicating an element swap.',
    props: ['color']
  }
};

export const CONNECTION_TYPES = {
  arrow: 'Default directed connection.',
  line: 'Raw geometric edge without arrowhead (for geometry proofs).'
};
