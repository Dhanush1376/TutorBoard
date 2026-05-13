/**
 * Generate a stable element ID (Client-side)
 */
export const makeId = (prefix = 'el') => `${prefix}_${Math.random().toString(36).substring(2, 10)}`;

/**
 * Apply a JSON patch (delta) to a scene graph
 */
export function applyDelta(sceneGraph, delta) {
  if (!sceneGraph) return sceneGraph;
  const graph = structuredClone(sceneGraph);

  if (!delta || !delta.ops) return graph;
  if (!graph.elements) graph.elements = [];
  if (!graph.connections) graph.connections = [];

  for (const op of delta.ops) {
    switch (op.type) {
      case 'update_element': {
        const el = graph.elements.find(e => e.id === op.id);
        if (el) Object.assign(el, op.changes);
        break;
      }
      case 'add_element': {
        const newId = op.element.id || makeId();
        graph.elements.push({ ...op.element, id: newId });
        break;
      }
      case 'remove_element': {
        graph.elements = graph.elements.filter(e => e.id !== op.id);
        graph.connections = graph.connections.filter(
          c => c.source !== op.id && c.target !== op.id
        );
        break;
      }
      case 'add_connection': {
        const newId = op.connection.id || makeId('edge');
        graph.connections.push({ ...op.connection, id: newId });
        break;
      }
      case 'remove_connection': {
        graph.connections = graph.connections.filter(c => c.id !== op.id);
        break;
      }
      case 'update_connection': {
        const conn = graph.connections.find(c => c.id === op.id);
        if (conn) Object.assign(conn, op.changes);
        break;
      }
      case 'update_layout': {
        graph.layout = { ...graph.layout, ...op.changes };
        break;
      }
      case 'update_theme': {
        graph.theme = { ...graph.theme, ...op.changes };
        break;
      }
    }
  }

  graph.version = (graph.version || 1) + 1;
  return graph;
}
