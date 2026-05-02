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
    const nodes = [...(storeState.canvasObjects || [])];
    const edges = [...(storeState.canvasConnections || [])];

    // --- Phase 4: D3 DOM Crawling ---
    // In DSA/Algorithm mode, visuals are in the D3 SVG, not the Zustand store.
    const d3Svg = document.querySelector('svg#teaching-canvas-svg') || document.querySelector('.infinite-canvas-content svg');
    if (d3Svg) {
      console.log('[Snapshot] 🕵️ Crawling D3 SVG for rendered state...');
      
      // 1. Find Arrays
      d3Svg.querySelectorAll('g[id*="array"]').forEach(group => {
        const id = group.getAttribute('id');
        const cells = Array.from(group.querySelectorAll('g.cell')).map(cell => ({
          id: cell.getAttribute('id'),
          value: cell.querySelector('text')?.textContent,
          color: cell.querySelector('rect.cell-bg')?.getAttribute('fill')
        }));
        
        nodes.push({
          id,
          type: 'array',
          values: cells.map(c => c.value),
          cellData: cells,
          _rendered: true
        });
      });

      // 2. Find Pointers
      d3Svg.querySelectorAll('g[id*="pointer"]').forEach(group => {
        const id = group.getAttribute('id');
        const label = group.querySelector('text')?.textContent;
        nodes.push({ id, type: 'pointer', label, _rendered: true });
      });

      // 3. Find Generic Shapes (D3Renderer uses g.shape)
      d3Svg.querySelectorAll('g.shape').forEach(group => {
        const id = group.getAttribute('id');
        const type = group.getAttribute('data-type') || 'shape';
        const label = group.querySelector('text')?.textContent;
        const rect = group.querySelector('rect, circle, ellipse, polygon');
        
        nodes.push({
          id,
          type,
          label,
          x: rect?.getAttribute('x') || rect?.getAttribute('cx'),
          y: rect?.getAttribute('y') || rect?.getAttribute('cy'),
          color: rect?.getAttribute('fill'),
          _rendered: true
        });
      });

      // 4. Find Comparators & Results
      const comparator = d3Svg.querySelector('#comparator');
      if (comparator) {
        nodes.push({ 
          id: 'comparator', 
          type: 'comparator',
          text: comparator.querySelector('text')?.textContent || '', 
          _rendered: true 
        });
      }

      const resultBanner = d3Svg.querySelector('#result-banner');
      if (resultBanner) {
        nodes.push({ 
          id: 'result-banner', 
          type: 'result_banner',
          text: resultBanner.querySelector('text')?.textContent || '', 
          _rendered: true 
        });
      }
    }

    return {
      nodes,
      edges,
      pointers: nodes.filter(n => n.type === 'pointer' || n.id?.includes('pointer')),
      highlights: storeState.timeline?.steps?.[storeState.currentStepIndex]?.highlightIds || [],
      textOverlays: nodes.filter(n => n.type === 'text_overlay' || n.id?.includes('text')),
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
