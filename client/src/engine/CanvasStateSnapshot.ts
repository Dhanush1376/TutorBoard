/**
 * CanvasStateSnapshot v2.0
 * 
 * Purpose: Capture the CURRENT rendered state of the canvas in a clean, serializable structure.
 * Extract ONLY data (no DOM nodes, no GSAP instances).
 */

export interface CanvasSnapshot {
  nodes: any[];
  edges: any[];
  pointers: any[];
  highlights: string[];
  textOverlays: any[];
  currentStepIndex: number;

  topic: string;
  timestamp: number;
}

export class CanvasStateSnapshot {
  /**
   * Captures the current snapshot from the Zustand store.
   * Note: This assumes it's called from a context where useTutorStore is accessible or passed.
   */
  static capture(storeState: any): CanvasSnapshot {
    return {
      nodes: storeState.canvasObjects || [],
      
      edges: storeState.canvasConnections || [],
      
      pointers: storeState.canvasObjects?.filter((obj: any) => 
        obj.type === 'pointer' || obj.id?.includes('pointer')
      ) || [],
      
      highlights: storeState.timeline?.steps?.[storeState.currentStepIndex]?.highlightIds || [],
      
      textOverlays: storeState.canvasObjects?.filter((obj: any) => 
        obj.type === 'text_overlay' || obj.shape === 'text'
      ) || [],
      
      currentStepIndex: storeState.currentStepIndex || 0,
      topic: storeState.topic || storeState.timeline?.title || 'Current Lesson',
      timestamp: Date.now()

    };
  }

  /**
   * Serializes the snapshot for LLM consumption.
   */
  static stringify(snapshot: CanvasSnapshot): string {
    return JSON.stringify(snapshot, (key, value) => {
      // Filter out heavy or non-serializable fields if they leaked in
      if (key === 'element' || key === 'ref' || key === 'gsap') return undefined;
      return value;
    }, 2);
  }
}

export default CanvasStateSnapshot;
