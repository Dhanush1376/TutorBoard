export const generateProgrammingFallback = (topicStr) => {
  const elements = [];
  const connections = [];

  if (topicStr.includes('tree') || topicStr.includes('graph')) {
    elements.push(
      { id: 'node_a', type: 'circle', label: 'Root', x: 0.5, y: 0.2, color: 'blue' },
      { id: 'node_b', type: 'circle', label: 'L', x: 0.3, y: 0.5, color: 'green' },
      { id: 'node_c', type: 'circle', label: 'R', x: 0.7, y: 0.5, color: 'purple' }
    );
    connections.push(
      { id: 'edge_ab', from: 'node_a', to: 'node_b', type: 'arrow' },
      { id: 'edge_ac', from: 'node_a', to: 'node_c', type: 'arrow' }
    );
  } else if (topicStr.includes('array') || topicStr.includes('list')) {
    elements.push(
      { id: 'arr_1', type: 'rect', label: '[ 1, 2, 3 ]', x: 0.5, y: 0.5, color: 'orange' }
    );
  }

  return { elements, connections };
};
