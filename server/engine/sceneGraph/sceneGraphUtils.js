import crypto from 'crypto';

/**
 * Generate a stable element ID
 * @param {string} prefix 
 * @returns {string}
 */
export const makeId = (prefix = 'el') => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

/**
 * Apply a JSON patch (delta) to a scene graph
 * @param {Object} sceneGraph 
 * @param {Object} delta 
 * @returns {Object} Updated scene graph
 */
export function applyDelta(sceneGraph, delta) {
  const graph = structuredClone(sceneGraph);

  if (!delta || !delta.ops) return graph;

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

/**
 * Resolve a natural language reference to element IDs
 * @param {string} ref 
 * @param {Object} sceneGraph 
 * @returns {Array} Matching elements
 */
export function resolveReference(ref, sceneGraph) {
  if (!ref || !sceneGraph || !sceneGraph.elements) return [];
  
  const r = ref.toLowerCase();
  return sceneGraph.elements.filter(el => {
    if (el.label?.toLowerCase().includes(r)) return true;
    if (el.tags?.some(t => t.toLowerCase().includes(r))) return true;
    if (el.subtype?.toLowerCase().includes(r)) return true;
    if (el.style?.fill && r.includes(el.style.fill.toLowerCase())) return true;
    return false;
  });
}
