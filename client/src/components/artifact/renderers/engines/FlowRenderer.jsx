import React, { useRef, useMemo } from 'react';
import ReactFlow, { ReactFlowProvider, Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import useWindowSize from '../../../../../hooks/useWindowSize';

function FlowRendererInner({ sceneGraph }) {
  const containerRef = useRef(null);
  const { width, height } = useWindowSize();

  const { nodes, edges } = useMemo(() => {
    if (!sceneGraph) return { nodes: [], edges: [] };
    
    // Support multiple content structures based on the visual script output
    const elements = sceneGraph.elements || sceneGraph.objects || sceneGraph.nodes || [];
    const connections = sceneGraph.connections || sceneGraph.edges || [];

    const flowNodes = elements.map((el, i) => {
      // Coordinates come in as normalized (0-1), scale them.
      // Give fallback grid placement if x/y are missing
      const x = typeof el.x === 'number' ? el.x * 800 : (i % 3) * 200 + 100;
      const y = typeof el.y === 'number' ? el.y * 600 : Math.floor(i / 3) * 150 + 100;
      
      return {
        id: el.id || `node_${i}`,
        position: { x, y },
        data: { 
          label: (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {el.title && <strong style={{ fontSize: '14px', color: el.color || '#fff' }}>{el.title}</strong>}
              {(el.subtitle || el.label) && <span style={{ fontSize: '10px', opacity: 0.8 }}>{el.subtitle || el.label}</span>}
              {!el.title && !el.subtitle && !el.label && <span>{el.id}</span>}
            </div>
          )
        },
        type: 'default',
        style: {
          background: el.color ? `${el.color}20` : '#1e1e24',
          borderColor: el.color || '#333',
          color: '#fff',
          borderRadius: el.shape === 'circle' ? '50%' : '8px',
          borderWidth: el.glow || el.importance >= 4 ? '2px' : '1px',
          boxShadow: el.glow ? `0 0 15px ${el.color}40` : 'none',
          padding: '10px 15px',
          minWidth: '120px',
          textAlign: 'center'
        }
      };
    });

    const flowEdges = connections.map((conn, i) => ({
      id: conn.id || `edge_${i}`,
      source: conn.from || conn.source,
      target: conn.to || conn.target,
      label: conn.label,
      animated: conn.animated !== false,
      style: { stroke: conn.color || '#6366F1', strokeWidth: 2 }
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [sceneGraph]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '400px', background: '#050505' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ffffff" gap={20} size={1} opacity={0.05} />
        <Controls style={{ fill: '#fff' }} className="dark-controls" />
      </ReactFlow>
    </div>
  );
}

export default function FlowRenderer({ sceneGraph }) {
  return (
    <ReactFlowProvider>
      <FlowRendererInner sceneGraph={sceneGraph} />
    </ReactFlowProvider>
  );
}

