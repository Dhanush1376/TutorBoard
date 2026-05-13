import Artifact from '../../models/Artifact.js';
import { classifyArtifact } from '../../engine/agents/artifactClassifierAgent.js';
import { generateSceneGraph } from '../../engine/agents/sceneGraphAgent.js';
import { generateDelta as generateSceneGraphDelta } from '../../engine/agents/sceneGraphDeltaAgent.js';
import { applyDelta } from '../../engine/sceneGraph/sceneGraphUtils.js';
import { syncToDatabase } from '../utils.js';

/**
 * Artifact Handlers — Real-time generation and editing of visual artifacts
 */
export function registerArtifactHandlers(socket, machine, sessionId, requestId) {
  
  /**
   * artifact:generate
   * Triggered when the AI (or user) wants to create a new high-fidelity visual artifact.
   */
  socket.on('artifact:generate', async ({ instruction }) => {
    try {
      console.log(`[Socket] 🚀 Generating artifact: "${instruction.substring(0, 50)}..."`);
      socket.emit('artifact:generation_progress', { stage: 'classifying', message: 'Determining artifact type...' });

      // 1. Classify
      const classification = await classifyArtifact(instruction);
      const { artifactClass, isVisual, title } = classification;

      socket.emit('artifact:generation_progress', { 
        stage: 'generating', 
        message: `Designing ${artifactClass || 'artifact'}...`,
        artifactClass 
      });

      let sceneGraph = null;
      let content = '';
      let type = isVisual ? 'visual' : 'document';

      // 2. Generate
      if (isVisual) {
        sceneGraph = await generateSceneGraph(instruction, artifactClass);
        content = JSON.stringify(sceneGraph);
      } else {
        // Simple document generation fallback
        type = artifactClass === 'code' ? 'code' : 'document';
        // In a real implementation, we'd use a document agent here
        content = `Generating content for ${instruction}...`; 
      }

      // 3. Persist
      const artifact = await Artifact.create({
        userId: socket.user?.id || socket.user?._id || null,
        sessionId,
        type,
        artifactClass,
        title: title || 'New Artifact',
        content,
        sceneGraph,
        version: 1,
      });

      console.log(`[Socket] ✅ Artifact ready: ${artifact._id}`);
      
      socket.emit('artifact:scene_graph_ready', { 
        artifactId: artifact._id, 
        type: artifact.type,
        artifactClass: artifact.artifactClass,
        title: artifact.title,
        sceneGraph: artifact.sceneGraph,
        content: artifact.content,
        version: artifact.version
      });

    } catch (err) {
      console.error('[Socket:ArtifactGenerate] Error:', err);
      socket.emit('teaching:error', { message: 'Failed to generate visual artifact.' });
    }
  });

  /**
   * artifact:edit
   * Conversational editing of an existing visual artifact.
   */
  socket.on('artifact:edit', async ({ artifactId, instruction }) => {
    try {
      console.log(`[Socket] 🔧 Editing artifact ${artifactId}: "${instruction}"`);
      
      const artifact = await Artifact.findById(artifactId);
      if (!artifact) {
        return socket.emit('teaching:error', { message: 'Artifact not found.' });
      }

      if (!artifact.sceneGraph) {
        return socket.emit('teaching:error', { message: 'Only visual artifacts can be edited conversationally.' });
      }

      // 1. Generate delta
      const delta = await generateSceneGraphDelta(instruction, artifact.sceneGraph);

      // 2. Apply delta
      const newSceneGraph = applyDelta(artifact.sceneGraph, delta);

      // 3. Update model
      artifact.sceneGraph = newSceneGraph;
      artifact.content = JSON.stringify(newSceneGraph);
      artifact.editHistory.push({
        instruction,
        patchApplied: delta,
        previousVersion: artifact.version,
        timestamp: new Date()
      });

      await artifact.save();

      console.log(`[Socket] ✅ Delta applied to ${artifactId}, new version: ${artifact.version}`);

      socket.emit('artifact:delta_applied', {
        artifactId: artifact._id,
        delta,
        newSceneGraph,
        version: artifact.version,
        summary: delta.summary
      });

    } catch (err) {
      console.error('[Socket:ArtifactEdit] Error:', err);
      socket.emit('teaching:error', { message: 'Failed to apply edits to the artifact.' });
    }
  });
}
