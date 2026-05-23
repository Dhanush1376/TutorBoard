export const generateScienceFallback = (topicStr) => {
  const elements = [];
  const connections = [];

  if (topicStr.includes('atom') || topicStr.includes('molecule')) {
    elements.push(
      { id: 'nucleus', type: 'circle', label: 'Nucleus', x: 0.5, y: 0.5, color: 'purple' },
      { id: 'electron_1', type: 'circle', label: 'e-', x: 0.3, y: 0.5, color: 'yellow' },
      { id: 'electron_2', type: 'circle', label: 'e-', x: 0.7, y: 0.5, color: 'yellow' }
    );
    connections.push(
      { id: 'orbit_1', from: 'nucleus', to: 'electron_1', type: 'line', label: 'orbit' },
      { id: 'orbit_2', from: 'nucleus', to: 'electron_2', type: 'line', label: 'orbit' }
    );
  } else if (topicStr.includes('force') || topicStr.includes('motion')) {
    elements.push(
      { id: 'box', type: 'rect', label: 'Mass', x: 0.5, y: 0.5, color: 'blue' },
      { id: 'force_arrow', type: 'arrow', label: 'F', x: 0.7, y: 0.5, color: 'red' }
    );
  }

  return { elements, connections };
};
