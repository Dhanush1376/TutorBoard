import { useEffect } from 'react';
import useSocket from './useSocket';
import useTutorStore from '../store/tutorStore';

/**
 * useArtifactSocket
 * 
 * Handles real-time artifact generation and editing events from the server.
 */
export const useArtifactSocket = () => {
  const { on } = useSocket();
  const setSceneGraph = useTutorStore(state => state.setSceneGraph);
  const updateArtifactSceneGraph = useTutorStore(state => state.updateArtifactSceneGraph);
  const addArtifact = useTutorStore(state => state.addArtifact);

  useEffect(() => {
    // 1. Initial Scene Graph Ready
    const cleanupReady = on('artifact:scene_graph_ready', (data) => {
      const { artifactId, sceneGraph, artifactClass, type, title, content, version } = data;
      
      // Update store with the new artifact
      addArtifact({
        id: `art-${artifactId}`,
        dbId: artifactId,
        type,
        artifactClass,
        title,
        content,
        sceneGraph,
        version
      });
      
      // Also set it as the active scene graph for interaction
      if (sceneGraph) {
        setSceneGraph(sceneGraph);
      }
    });

    // 2. Incremental Delta Applied
    const cleanupDelta = on('artifact:delta', (data) => {
      if (!data || !data.artifactId || !data.delta) return;
      
      const store = useTutorStore.getState();
      const artifact = store.artifacts.find(a => a.id === data.artifactId || a.dbId === data.artifactId);
      
      if (artifact) {
        // If sceneGraph is missing, initialize it before patching
        const currentGraph = artifact.sceneGraph || { elements: [], connections: [] };
        const patched = applyDelta(currentGraph, data.delta);
        updateArtifactSceneGraph(data.artifactId, patched);
      }
    });

    // 3. Generation Progress
    const cleanupProgress = on('artifact:generation_progress', (data) => {
      const { stage, message, artifactClass } = data;
      console.log(`[ArtifactSocket] Progress (${stage}): ${message}`);
      // This could be wired to a global progress bar or status indicator
    });

    return () => {
      cleanupReady();
      cleanupDelta();
      cleanupProgress();
    };
  }, [on, setSceneGraph, updateArtifactSceneGraph, addArtifact]);
};
