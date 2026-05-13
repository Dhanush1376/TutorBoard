import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { sceneGraphToFlow } from '../../../../utils/sceneGraphAdapters';

export default function FlowRenderer({ sceneGraph, onElementClick, onElementMove }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => sceneGraphToFlow(sceneGraph),
    [sceneGraph]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync when scene graph updates (e.g. from AI edits or server updates)
  useEffect(() => {
    const { nodes: n, edges: e } = sceneGraphToFlow(sceneGraph);
    setNodes(n);
    setEdges(e);
  }, [sceneGraph, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-[#0f172a] rounded-lg overflow-hidden border border-slate-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onElementClick?.(node.id)}
        onNodeDragStop={(_, node) => onElementMove?.(node.id, node.position)}
        fitView
        colorMode="dark"
        style={{ background: '#0f172a' }}
      >
        <Background color="#1e293b" gap={24} />
        <Controls className="bg-slate-900 border-slate-700 fill-slate-400" />
        <MiniMap 
          nodeStrokeWidth={3} 
          zoomable 
          pannable 
          maskColor="rgba(15, 23, 42, 0.7)"
          style={{ background: '#1e293b' }}
        />
        <Panel position="top-right" className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-md text-[10px] text-slate-400 uppercase tracking-widest">
          {sceneGraph.artifactClass || 'Visual Engine'}
        </Panel>
      </ReactFlow>
    </div>
  );
}
