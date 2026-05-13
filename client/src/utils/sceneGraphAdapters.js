/**
 * Adapters to convert generic SceneGraph JSON into specific library formats
 */

/**
 * Convert SceneGraph to React Flow nodes and edges
 */
export function sceneGraphToFlow(sceneGraph) {
  if (!sceneGraph || !sceneGraph.elements) return { nodes: [], edges: [] };

  const nodes = sceneGraph.elements
    .filter(el => el.type !== 'edge' && el.type !== 'connection')
    .map(el => ({
      id: el.id,
      type: el.subtype === 'group' ? 'group' : 'default',
      position: el.position || { x: 0, y: 0 },
      data: {
        label: el.label,
        subtype: el.subtype,
        tags: el.tags,
        elementId: el.id,
      },
      style: {
        background: el.style?.fill || '#1e40af',
        color: el.style?.textColor || '#ffffff',
        border: `2px solid ${el.style?.stroke || '#3b82f6'}`,
        borderRadius: el.style?.borderRadius ?? 8,
        fontSize: el.style?.fontSize || 13,
        fontWeight: el.style?.fontWeight || '500',
        width: el.dimensions?.width || 160,
        height: el.dimensions?.height || 'auto',
        padding: '10px 14px',
        opacity: el.style?.opacity ?? 1,
      },
      parentNode: el.parentId,
    }));

  const edges = (sceneGraph.connections || []).map(conn => ({
    id: conn.id,
    source: conn.source,
    target: conn.target,
    label: conn.label || '',
    animated: conn.style?.animated || false,
    style: {
      stroke: conn.style?.strokeColor || '#64748b',
      strokeWidth: conn.style?.strokeWidth || 2,
    },
    markerEnd: conn.style?.arrowType !== 'none'
      ? { type: 'arrowclosed', color: conn.style?.strokeColor || '#64748b' }
      : undefined,
  }));

  return { nodes, edges };
}

/**
 * Future: Convert SceneGraph to Konva/Canvas format
 */
export function sceneGraphToKonva(sceneGraph) {
  // Placeholder for Phase 2.4
  return sceneGraph.elements;
}
