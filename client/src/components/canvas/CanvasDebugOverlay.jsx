import React from 'react';
import useTutorStore from '../../store/tutorStore';

export default function CanvasDebugOverlay({ elements, timeline, currentStepIndex }) {
  const { machineState } = useTutorStore();

  const nodeCount = elements?.length || 0;
  const edgeCount = elements?.filter(e => e.type === 'edge' || e.from)?.length || 0;
  const animCount = timeline?.[currentStepIndex]?.animation?.actions?.length || 0;

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#0f0',
      padding: '10px 15px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 9999,
      pointerEvents: 'none',
      border: '1px solid #0f0'
    }}>
      <div style={{ marginBottom: 5, borderBottom: '1px solid #333', paddingBottom: 5 }}>🔧 <b>Engine Debug</b></div>
      <div>Machine State: {machineState}</div>
      <div>Nodes: {nodeCount}</div>
      <div>Edges: {edgeCount}</div>
      <div>Step: {currentStepIndex + 1} / {timeline?.length || 1}</div>
      <div>Active Anims: {animCount}</div>
    </div>
  );
}
