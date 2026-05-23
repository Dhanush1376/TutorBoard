export const generateMathFallback = (topicStr) => {
  const elements = [];
  const connections = [];

  if (topicStr.includes('pythagoras') || topicStr.includes('triangle')) {
    elements.push(
      { id: 'tri_1', type: 'triangle', label: 'Right Triangle', x: 0.5, y: 0.5, color: 'blue' },
      { id: 'eq_1', type: 'equation', label: 'a² + b² = c²', x: 0.5, y: 0.2, color: 'white' },
      { id: 'text_a', type: 'text', label: 'a', x: 0.4, y: 0.5, color: 'gray' },
      { id: 'text_b', type: 'text', label: 'b', x: 0.5, y: 0.6, color: 'gray' },
      { id: 'text_c', type: 'text', label: 'c', x: 0.6, y: 0.4, color: 'gray' }
    );
  } else if (topicStr.includes('circle') || topicStr.includes('area')) {
    elements.push(
      { id: 'circ_1', type: 'circle', label: 'Circle', x: 0.5, y: 0.5, color: 'red' },
      { id: 'eq_area', type: 'equation', label: 'A = πr²', x: 0.5, y: 0.2, color: 'white' },
      { id: 'text_r', type: 'text', label: 'r', x: 0.5, y: 0.5, color: 'gray' }
    );
  }

  return { elements, connections };
};
