import React from 'react';
import useTutorStore from '../../store/tutorStore';

const ArtifactDebugPanel = () => {
  const { 
    timeline,
    canvasObjects,
    canvasConnections,
    activeScene,
    artifacts,
    activeArtifactId,
    canvasLayout
  } = useTutorStore();

  const activeArtifact = artifacts?.find(a => a.id === activeArtifactId || a.dbId === activeArtifactId);

  return (
    <div className="absolute top-4 right-4 z-[9999] bg-black/80 text-green-400 p-4 rounded border border-green-500/30 font-mono text-xs w-[350px] pointer-events-none select-none backdrop-blur-md shadow-2xl">
      <div className="flex items-center justify-between border-b border-green-500/30 pb-2 mb-2">
        <h3 className="font-bold uppercase tracking-widest text-green-300">Artifact Debug Panel</h3>
        <span className="animate-pulse h-2 w-2 bg-green-500 rounded-full"></span>
      </div>
      
      <div className="space-y-1 opacity-90">
        <div className="flex justify-between">
          <span>Active Scene ID:</span>
          <span className="text-white truncate max-w-[150px]">{activeScene?.id || 'null'}</span>
        </div>
        <div className="flex justify-between">
          <span>Active Artifact ID:</span>
          <span className="text-white truncate max-w-[150px]">{activeArtifactId || 'null'}</span>
        </div>
        <div className="flex justify-between">
          <span>Persisted DB ID:</span>
          <span className="text-white truncate max-w-[150px]">{activeArtifact?.dbId || 'null'}</span>
        </div>
        
        <div className="my-2 border-t border-green-500/20"></div>
        
        <div className="flex justify-between">
          <span>Canvas Layout:</span>
          <span className="text-blue-300">{canvasLayout}</span>
        </div>
        
        <div className="my-2 border-t border-green-500/20"></div>
        
        <div className="flex justify-between">
          <span>Timeline items:</span>
          <span className="text-yellow-300">{timeline?.timeline?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Store canvasObjects:</span>
          <span className="text-pink-300">{canvasObjects?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Store canvasConnections:</span>
          <span className="text-purple-300">{canvasConnections?.length || 0}</span>
        </div>
        
        <div className="my-2 border-t border-green-500/20"></div>
        
        <div className="flex justify-between">
          <span>Renderer:</span>
          <span className="text-orange-300">{timeline?.renderer || 'default'}</span>
        </div>
      </div>
    </div>
  );
};

export default ArtifactDebugPanel;
