/**
 * CanvasStateSnapshot v2.0
 * 
 * Specialized AI-facing utility for capturing the rendered board state.
 * Unlike uiSlice.takeSnapshot (which persists store data for users), 
 * this utility performs deep D3 DOM crawling to capture algorithmic visuals 
 * (arrays, trees, pointers) that exist only in the SVG layer.
 * 
 * Used exclusively by the DeltaAgent to provide context-aware doubt responses.
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
    // Only what the student is looking at: when the current step declares its
    // visible set, drop every other lesson element. Sending all of them made
    // the DeltaAgent annotate objects from earlier steps that weren't on screen.
    const step = storeState.timeline?.steps?.[storeState.currentStepIndex];
    const visible: string[] | undefined = step?.objectIds?.length ? step.objectIds : step?.objects;
    const allObjects = storeState.canvasObjects || [];
    const nodes: any[] = Array.isArray(visible) && visible.length > 0
      ? allObjects.filter((o: any) => visible.includes(String(o.id)))
      : [...allObjects];
    const edges = [...(storeState.canvasConnections || [])];

    // --- Phase 4: D3 DOM Crawling ---
    // In DSA/Algorithm mode, visuals are in the D3 SVG, not the Zustand store.
    const d3Svg = document.querySelector('svg#teaching-canvas-svg')
      || document.querySelector('.infinite-canvas-content svg')
      || (document.querySelector('svg .canvas-main-layer') as SVGGElement | null)?.ownerSVGElement;
    if (d3Svg) {
      import.meta.env.DEV && console.log('[Snapshot] 🕵️ Crawling D3 SVG for rendered state...');
      
      // 1. Find Arrays
      // (cells carry ids like "arr[0]", so exclude them from the array match)
      d3Svg.querySelectorAll('g[id*="array"]:not(.cell)').forEach(group => {
        const id = group.getAttribute('id');
        const cells = Array.from(group.querySelectorAll('g.cell')).map(cell => ({
          id: cell.getAttribute('id'),
          value: cell.querySelector('text')?.textContent,
          color: cell.querySelector('rect.cell-bg')?.getAttribute('fill')
        }));
        
        const rendered = { values: cells.map(c => c.value), cellData: cells, _rendered: true };
        // Store objects are frozen (immer) — replace, never mutate.
        const at = nodes.findIndex((n: any) => String(n.id) === id);
        if (at >= 0) nodes[at] = { ...nodes[at], ...rendered };
        else nodes.push({ id, type: 'array', ...rendered });
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

      // Keep only what is actually drawn on the board. Lesson elements that
      // the canvas renders as narration (text/rect in DSA scenes) are not on
      // screen; offering them let the DeltaAgent anchor callouts to nothing.
      const onBoard = nodes.filter((n: any) =>
        n._rendered || (n.id && d3Svg.querySelector(`#${CSS.escape(String(n.id))}`)));
      if (onBoard.length > 0) nodes.splice(0, nodes.length, ...onBoard);
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
