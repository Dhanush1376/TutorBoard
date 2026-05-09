import * as d3 from 'd3';
import gsap from 'gsap';


export class D3Renderer {
  private container: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private mainLayer: d3.Selection<SVGGElement, unknown, null, undefined>;

  // Layout constants
  private readonly CELL_WIDTH = 54;
  private readonly CELL_HEIGHT = 54;
  private readonly CELL_GAP = 10;
  private currentWidth = 800;
  private currentHeight = 600;
  private nextY = 160;
  private resizeObserver: ResizeObserver | null = null;
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  public onInteraction?: (id: string, type: string) => void;

  constructor(containerElement: HTMLDivElement, initialWidth?: number, initialHeight?: number) {
    this.container = d3.select(containerElement);
    this.container.selectAll('*').remove();
    
    if (initialWidth) this.currentWidth = initialWidth;
    if (initialHeight) this.currentHeight = initialHeight;

    const svg = this.container.append('svg')
      .attr('id', 'teaching-canvas-svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.currentWidth} ${this.currentHeight}`)
      .style('overflow', 'visible')
      .style('display', 'block');

    // INFRA-05: We use a fixed logical coordinate system (800x600).
    // The CSS transform: scale() in FixedTeachingStage handles visual fitting.
    // We observe the container only to ensure we can initialize, not to update our internal logic.
    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        // Update logical width based on aspect ratio, keeping height baseline at 600
        const aspect = entry.contentRect.width / entry.contentRect.height;
        this.currentWidth = 600 * aspect;
        this.currentHeight = 600;
        
        // Update SVG ViewBox
        svg.attr('viewBox', `0 0 ${this.currentWidth} ${this.currentHeight}`);
      }
    });
    this.resizeObserver.observe(containerElement);

    // SaaS-Quality Definitions
    const defs = svg.append('defs');
    
    // Glossy overlay for 3D cells
    const cellGradient = defs.append('linearGradient')
      .attr('id', 'cell-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    cellGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255, 255, 255, 0.12)');
    cellGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(255, 255, 255, 0.0)');

    // Neon Glow filter
    const glowFilter = defs.append('filter')
      .attr('id', 'neon-glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Chart Bar Gradient
    const barGradient = defs.append('linearGradient')
      .attr('id', 'bar-gradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    barGradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--text-secondary, rgba(0,0,0,0.2))');
    barGradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--text-primary)');

    // ── Interactive Zoom Layer ──────────────────────────────────────────
    // This group holds all generated visuals, allowing pan/zoom on items 
    // without affecting the global canvas grid or gradients.
    this.mainLayer = svg.append('g').attr('class', 'visuals-layer');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4])
      .on('zoom', (event) => {
        this.mainLayer.attr('transform', event.transform);
      });

    this.zoomBehavior = zoom;

    // Attach zoom to SVG
    (svg as any).call(zoom);
    
    // Initial zoom state
    (svg as any).call(zoom.transform, d3.zoomIdentity);
  }

  public resetView() {
    if (this.zoomBehavior) {
      this.svg.transition()
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(this.zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  public destroy() {
    this.resizeObserver?.disconnect();
  }

  public resize(width: number, height: number) {
    const aspect = width / height;
    this.currentWidth = 600 * aspect;
    this.currentHeight = 600;
    this.svg.attr('viewBox', `0 0 ${this.currentWidth} ${this.currentHeight}`);
  }

  private get ARRAY_Y() {
    return this.nextY;
  }

  private get svg() {
    return this.container.select('svg');
  }

  getElement(id: string): Element | null {
    const node = this.container.node();
    return node ? node.querySelector(`#${CSS.escape(id)}`) : null;
  }

  clear() {
    this.mainLayer.selectAll('*').remove();
    this.nextY = 160; // Reset for next step
  }

  private getWidth(): number {
    return this.currentWidth;
  }

  private getHeight(): number {
    return this.currentHeight;
  }

  private animate(selector: string, stagger = 0.05) {
    gsap.fromTo(this.mainLayer.selectAll(selector).nodes(), 
      { opacity: 0, scale: 0.8, y: 15 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, stagger, ease: 'back.out(1.4)' }
    );
  }

  createArray(id: string, values: (number | string)[]) {
    const containerWidth = this.getWidth() || 800;
    
    // Bug 07 Fix: Responsive CELL_WIDTH
    const cellWidth = Math.min(58, (containerWidth - 120) / values.length);
    const cellGap = 10;
    
    const totalWidth = values.length * cellWidth + (values.length - 1) * cellGap;
    const offsetX = (containerWidth / 2) - (totalWidth / 2);
    const currentY = this.nextY;

    const arrayGroup = this.mainLayer.append('g')
      .attr('id', id)
      .attr('transform', `translate(${offsetX}, ${currentY})`);

    const cells = arrayGroup.selectAll('g.cell')
      .data(values)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('id', (d, i) => `${id}[${i}]`)
      .attr('transform', (d, i) => `translate(${i * (cellWidth + cellGap)}, 0)`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        const cellId = `${id}[${values.indexOf(d)}]`;
        this.onInteraction?.(cellId, 'cell');
        
        // Visual feedback
        gsap.to(event.currentTarget, {
          scale: 1.1,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out'
        });
      });

    cells.append('rect')
      .attr('width', cellWidth)
      .attr('height', this.CELL_HEIGHT)
      .attr('rx', 10)
      .attr('fill', 'rgba(255, 255, 255, 0.03)')
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('stroke-width', 1)
      .attr('class', 'cell-bg shadow-premium')
      .style('filter', 'drop-shadow(0 12px 32px rgba(0,0,0,0.25))'); 
      
    // Glossy Overlay
    cells.append('rect')
      .attr('width', cellWidth)
      .attr('height', this.CELL_HEIGHT)
      .attr('rx', 12)
      .attr('fill', 'url(#cell-gradient)')
      .style('pointer-events', 'none');

    // Value Text
    cells.append('text')
      .attr('x', cellWidth / 2)
      .attr('y', this.CELL_HEIGHT / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${Math.min(15, cellWidth / 3)}px`)
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-primary)')
      .text(d => d);

    // Index Text below
    cells.append('text')
      .attr('x', cellWidth / 2)
      .attr('y', this.CELL_HEIGHT + 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-tertiary)')
      .attr('letter-spacing', '0.05em')
      .attr('opacity', 0.4)
      .text((d, i) => i);

    this.animate(`#${id} .cell`, 0.06);

    // Store metadata for pointers and boundaries
    (arrayGroup.node() as any)._arrayData = { offsetX, cellWidth, cellGap, y: currentY };
    
    // Advance Y for next array
    this.nextY += this.CELL_HEIGHT + 60;
  }

  createPointer(id: string, atIndex: number, label: string, color: string = 'var(--accent-danger, #ef4444)', targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.mainLayer.select(`#${targetArrayId}`) 
      : this.mainLayer.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10, y: 120 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = meta.y + this.CELL_HEIGHT + 40; // index labels take space now

    const pointerGroup = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(${x}, ${y})`);

    // Arrow pointing up
    pointerGroup.append('path')
      .attr('d', 'M -10 15 L 0 0 L 10 15 Z')
      .attr('fill', color);

    pointerGroup.append('text')
      .attr('x', 0)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', 'bold')
      .attr('fill', color)
      .text(label);
  }

  updatePointer(id: string, atIndex: number, targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.mainLayer.select(`#${targetArrayId}`) 
      : this.mainLayer.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10, y: 120 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = meta.y + this.CELL_HEIGHT + 40;

    this.mainLayer.select(`#${id}`)
      .transition()
      .duration(300)
      .attr('transform', `translate(${x}, ${y})`);
  }

  highlightCell(id: string, color: string, duration: number = 0) {
    const group = this.mainLayer.select(`#${CSS.escape(id)}`);
    const rect = group.select('.cell-bg');
    if (!rect.empty()) {
      // Color transition via GSAP for better smoothness than D3 transitions
      gsap.to(rect.node(), {
        fill: color,
        duration: duration > 0 ? duration / 1000 : 0.3,
        ease: 'power2.out'
      });

      // Scale pop animation for visual emphasis
      gsap.fromTo(group.node(), 
        { scale: 1 }, 
        { scale: 1.08, yoyo: true, repeat: 1, duration: 0.15, ease: 'back.out(2)' }
      );

      // Add breathing pulse-glow
      rect.classed('pulse-glow', true);
    }
  }

  createComparator(left: string | number, right: string | number, op: string) {
    this.removeElement('comparator');
    const containerWidth = this.getWidth();

    const compGroup = this.mainLayer.append('g')
      .attr('id', 'comparator')
      .attr('transform', `translate(${containerWidth / 2}, ${this.ARRAY_Y - 80})`);

    compGroup.append('rect')
      .attr('x', -70)
      .attr('y', -24)
      .attr('width', 140)
      .attr('height', 48)
      .attr('rx', 24)
      .attr('fill', 'var(--bg-tertiary)')
      .attr('stroke', 'var(--border-strong)')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))');

    compGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '16px')
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('font-weight', '700')
      .attr('fill', 'var(--text-primary)')
      .text(`${left} ${op} ${right}`);

    // ─── Entrance Animation (GSAP) ───
    gsap.from('#comparator', {
      opacity: 0,
      scale: 0.5,
      y: -50,
      duration: 0.5,
      ease: 'back.out(1.7)'
    });
  }

  createTimeline(id: string, events: { date: string; label: string; description?: string }[]) {
    const width = this.getWidth();
    const height = 400;
    const padding = 100;
    const timelineY = height / 2;

    const group = this.mainLayer.append('g')
      .attr('id', id)
      .attr('transform', `translate(0, 0)`);

    // Main line
    group.append('line')
      .attr('x1', padding)
      .attr('y1', timelineY)
      .attr('x2', width - padding)
      .attr('y2', timelineY)
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    const xScale = d3.scalePoint()
      .domain(events.map(e => e.date))
      .range([padding, width - padding]);

    const eventGroups = group.selectAll('g.event')
      .data(events)
      .enter()
      .append('g')
      .attr('class', 'event')
      .attr('transform', d => `translate(${xScale(d.date)}, ${timelineY})`);

    eventGroups.append('circle')
      .attr('r', 8)
      .attr('fill', 'var(--accent-primary)')
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 0 8px var(--accent-primary))');

    eventGroups.append('text')
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-primary)')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))')
      .text(d => d.date);

    // Add Interactive Tooltips
    eventGroups.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('r', 12)
        .attr('filter', 'drop-shadow(0 0 10px var(--accent-primary))');
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('r', 8)
        .attr('filter', 'none');
    });

    this.animate(`#${id} .event`, 0.1);
  }

  createChart(id: string, data: { label: string; value: number }[], type: 'bar' | 'line' = 'bar') {
    const width = this.getWidth();
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    const x = d3.scaleBand()
      .range([margin.left, width - margin.right])
      .domain(data.map(d => d.label))
      .padding(0.3);

    const y = d3.scaleLinear()
      .range([height - margin.bottom, margin.top])
      .domain([0, d3.max(data, d => d.value) || 100]);

    const group = this.mainLayer.append('g').attr('id', id);

    if (type === 'bar') {
      group.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'chart-bar')
        .attr('data-type', 'bar')
        .attr('x', d => x(d.label)!)
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.value))
        .attr('fill', 'url(#bar-gradient)')
        .attr('rx', 6)
        .style('filter', 'drop-shadow(0 6px 12px rgba(59,130,246,0.3))')
        .on('mouseenter', function(event, d) {
          gsap.to(this, { fill: 'var(--accent-primary)', filter: 'brightness(1.2)', duration: 0.2 });
        })
        .on('mouseleave', function(event, d) {
          gsap.to(this, { fill: 'var(--accent-secondary)', filter: 'none', duration: 0.2 });
        });
    } else {
      const line = d3.line<any>()
        .x(d => x(d.label)! + x.bandwidth() / 2)
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      group.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-primary)')
        .attr('stroke-width', 4)
        .style('filter', 'url(#neon-glow)')
        .attr('d', line);
    }

    // Axes
    group.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    group.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y));
  }

  createTree(id: string, data: any) {
    const width = this.getWidth();
    const height = 500;
    const margin = { top: 40, right: 90, bottom: 40, left: 90 };

    const treemap = d3.tree().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    const nodes = treemap(d3.hierarchy(data));

    const group = this.mainLayer.append('g')
      .attr('id', id)
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const paths = group.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-primary)')
      .attr('stroke-width', 3)
      .style('filter', 'url(#neon-glow)')
      .attr('d', (d: any) => `M${d.x},${d.y}C${d.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${d.parent.y}`);

    // Path drawing animation (SaaS Quality)
    paths.each(function() {
      const pathNode = this as SVGPathElement;
      const length = pathNode.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', length + ' ' + length)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(800)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    });

    const node = group.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('data-type', 'tree-node')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d: any) => {
        this.onInteraction?.(d.data.id || d.data.name, 'tree-node');
        gsap.to(event.currentTarget, { scale: 1.1, duration: 0.1, yoyo: true, repeat: 1 });
      });

    node.append('circle')
      .attr('r', 20)
      .attr('fill', 'var(--bg-secondary)')
      .attr('stroke', 'var(--border-strong)')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 8px 12px rgba(0,0,0,0.5))')
      .on('mouseenter', function() {
        d3.select(this).transition().duration(200).attr('stroke-width', 4).attr('r', 22);
      })
      .on('mouseleave', function() {
        d3.select(this).transition().duration(200).attr('stroke-width', 3).attr('r', 20);
      });

    node.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-primary)')
      .text((d: any) => d.data.name || d.data.value);

    // Staggered node appearance
    this.animate(`#${id} .node`, 0.15);
  }

  annotate(id: string, text: string) {
    this.removeElement(`annotation-${id}`);
    const target = this.svg.select(`#${id}`);
    if (target.empty()) return;

    const transformStr = target.attr('transform');
    let x = this.getWidth() / 2;
    let y = this.ARRAY_Y;

    if (transformStr) {
      const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transformStr);
      if (match) {
        x = parseFloat(match[1]);
        y = parseFloat(match[2]);
      }
    }

    const annoGroup = this.svg.append('g')
      .attr('id', `annotation-${id}`)
      .attr('transform', `translate(${x}, ${y - 40})`);

    annoGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-family', 'sans-serif')
      .attr('fill', 'var(--text-secondary)')
      .text(text);
  }

  drawBoundary(atIndex: number, label?: string, targetArrayId?: string, endIndex?: number) {
    if (endIndex !== undefined && endIndex !== null) {
      this.createRange(`range-${atIndex}-${endIndex}`, atIndex, endIndex, label, 'var(--accent-primary)', targetArrayId);
      return;
    }

    const arrayGroup = targetArrayId 
      ? this.svg.select(`#${targetArrayId}`) 
      : this.svg.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10, y: 120 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) - (meta.cellGap / 2);
    
    const boundaryId = `boundary-${atIndex}`;
    this.removeElement(boundaryId);

    const group = this.svg.append('g').attr('id', boundaryId);

    group.append('line')
      .attr('x1', x)
      .attr('y1', meta.y - 20)
      .attr('x2', x)
      .attr('y2', meta.y + this.CELL_HEIGHT + 40)
      .attr('stroke', 'var(--accent-danger, #f43f5e)')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '4 2');

    if (label) {
      group.append('text')
        .attr('x', x)
        .attr('y', meta.y - 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', 'var(--accent-danger, #f43f5e)')
        .text(label);
    }
  }

  /**
   * Bug 07 Fix: Create a dashed rectangle around a range of cells.
   */
  createRange(id: string, startIndex: number, endIndex: number, label?: string, color: string = 'var(--accent-primary)', targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.svg.select(`#${targetArrayId}`) 
      : this.svg.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10, y: 120 };
    const x1 = meta.offsetX + (startIndex * (meta.cellWidth + meta.cellGap)) - (meta.cellGap / 2);
    const x2 = meta.offsetX + (endIndex * (meta.cellWidth + meta.cellGap)) + meta.cellWidth + (meta.cellGap / 2);
    const width = x2 - x1;

    this.removeElement(id);
    const group = this.mainLayer.append('g').attr('id', id);

    group.append('rect')
      .attr('x', x1)
      .attr('y', meta.y - 15)
      .attr('width', width)
      .attr('height', this.CELL_HEIGHT + 55)
      .attr('rx', 12)
      .attr('fill', `${color}08`) // Very subtle background
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8 4')
      .attr('opacity', 0)
      .transition().duration(400).attr('opacity', 1);

    if (label) {
      group.append('text')
        .attr('x', x1 + width / 2)
        .attr('y', meta.y - 25)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('text-transform', 'uppercase')
        .attr('letter-spacing', '0.1em')
        .attr('fill', color)
        .text(label);
    }
  }

  /**
   * Swaps the text content of two cell elements after the arc animation finishes.
   * Keeps D3's rendered labels in sync with the new logical order.
   */
  swapCells(id1: string, id2: string) {
    const cell1 = this.svg.select(`#${CSS.escape(id1)}`);
    const cell2 = this.svg.select(`#${CSS.escape(id2)}`);
    if (cell1.empty() || cell2.empty()) return;

    const text1 = cell1.select('text').text();
    const text2 = cell2.select('text').text();
    cell1.select('text').text(text2);
    cell2.select('text').text(text1);
  }

  showResult(text: string) {
    this.removeElement('step-result');
    const width = this.getWidth();
    const height = this.getHeight();

    const group = this.mainLayer.append('g')
      .attr('id', 'step-result')
      .attr('transform', `translate(${width / 2}, ${height - 100})`);

    // Banner Background
    group.append('rect')
      .attr('x', -160)
      .attr('y', -21)
      .attr('width', 320)
      .attr('height', 42)
      .attr('rx', 21)
      .attr('fill', 'rgba(16, 185, 129, 0.1)') // emerald-500/10
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.3))');

    // Text
    group.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-family', 'var(--font-sans)')
      .attr('font-weight', '600')
      .attr('fill', '#10b981')
      .text(text);

    // Animation
    gsap.from('#step-result', {
      opacity: 0,
      y: '+=30',
      duration: 0.6,
      ease: 'power3.out'
    });
  }

  removeElement(id: string) {
    this.mainLayer.select(`#${CSS.escape(id)}`).remove();
  }
}

