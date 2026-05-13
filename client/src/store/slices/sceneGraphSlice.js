import { applyDelta } from '../../utils/sceneGraphUtils';

export const createSceneGraphSlice = (set, get) => ({
  // ─── State ───
  activeSceneGraph: null,       // current SceneGraph JSON
  sceneGraphHistory: [],        // undo stack (in-session, not DB)
  redoStack: [],
  selectedElementIds: [],
  hoveredElementId: null,

  // ─── Actions ───
  
  /** Set the active scene graph and manage history */
  setSceneGraph: (graph) => set(state => {
    // If we're setting a whole new graph (e.g. from server), reset undo/redo
    // or if it's an update, push to history
    const history = state.activeSceneGraph 
      ? [...state.sceneGraphHistory, state.activeSceneGraph].slice(-30)
      : state.sceneGraphHistory;
      
    state.activeSceneGraph = graph;
    state.sceneGraphHistory = history;
    state.redoStack = [];
  }),

  /** Apply a delta locally for immediate feedback */
  applyDeltaClient: (delta) => {
    const current = get().activeSceneGraph;
    if (!current) return;
    const patched = applyDelta(current, delta);
    get().setSceneGraph(patched);
  },

  /** Local undo */
  undoSceneGraph: () => set(state => {
    const history = [...state.sceneGraphHistory];
    const prev = history.pop();
    if (!prev) return;
    
    state.redoStack = [state.activeSceneGraph, ...state.redoStack];
    state.activeSceneGraph = prev;
    state.sceneGraphHistory = history;
  }),

  /** Local redo */
  redoSceneGraph: () => set(state => {
    const [next, ...rest] = state.redoStack;
    if (!next) return;
    
    state.sceneGraphHistory = [...state.sceneGraphHistory, state.activeSceneGraph];
    state.activeSceneGraph = next;
    state.redoStack = rest;
  }),

  /** Interaction Actions */
  selectElements: (ids) => set({ selectedElementIds: Array.isArray(ids) ? ids : [ids] }),
  hoverElement: (id) => set({ hoveredElementId: id }),
  clearSelection: () => set({ selectedElementIds: [], hoveredElementId: null }),

  /** Sync with Artifact (Update the sceneGraph inside an artifact object) */
  updateArtifactSceneGraph: (artifactId, newSceneGraph) => {
    set(state => {
      const artifact = state.artifacts.find(a => a.id === artifactId || a.dbId === artifactId);
      if (artifact) {
        artifact.sceneGraph = newSceneGraph;
        artifact.content = JSON.stringify(newSceneGraph);
        artifact.version = newSceneGraph.version || (artifact.version + 1);
      }
      
      // If this is the active artifact, update the activeSceneGraph too
      if (state.activeArtifactId === artifactId || (artifact && state.activeArtifactId === artifact.id)) {
        state.activeSceneGraph = newSceneGraph;
      }
    });
  }
});
