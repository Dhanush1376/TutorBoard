import * as d3 from 'd3';

export class D3Renderer {
  private container: d3.Selection<HTMLDivElement, unknown, null, undefined>;

  // Layout constants
  private readonly CELL_WIDTH = 60;
  private readonly CELL_HEIGHT = 60;
  private readonly CELL_GAP = 10;
  private readonly ARRAY_Y = 150;

  constructor(containerElement: HTMLDivElement) {
    this.container = d3.select(containerElement);
    // Ensure container has relative positioning for absolute children if needed,
    // though SVG is usually better. We will use a main SVG element.
    this.container.selectAll('*').remove();
    this.container.append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('overflow', 'visible');
  }

  private get svg() {
    return this.container.select('svg');
  }

  clear() {
    this.svg.selectAll('*').remove();
  }

  private getWidth(): number {
    const node = this.container.node();
    if (!node) return 800;
    const w = node.getBoundingClientRect().width;
    // Fallback to offsetWidth, then to a safe default
    return w > 0 ? w : (node as HTMLElement).offsetWidth || 800;
  }

  createArray(id: string, values: (number | string)[]) {
    const containerWidth = this.getWidth();
    
    // Defer one frame if container not yet painted (width is 0)
    if (containerWidth === 0) {
      requestAnimationFrame(() => this.createArray(id, values));
      return;
    }

    const totalWidth = values.length * this.CELL_WIDTH + (values.length - 1) * this.CELL_GAP;
    const offsetX = (containerWidth / 2) - (totalWidth / 2);

    const arrayGroup = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(${offsetX}, ${this.ARRAY_Y})`);

    const cells = arrayGroup.selectAll('g.cell')
      .data(values)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('id', (d, i) => `${id}[${i}]`)
      .attr('transform', (d, i) => `translate(${i * (this.CELL_WIDTH + this.CELL_GAP)}, 0)`);

    cells.append('rect')
      .attr('width', this.CELL_WIDTH)
      .attr('height', this.CELL_HEIGHT)
      .attr('rx', 8) // rounded corners
      .attr('fill', '#ffffff')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2)
      .attr('class', 'cell-bg');

    cells.append('text')
      .attr('x', this.CELL_WIDTH / 2)
      .attr('y', this.CELL_HEIGHT / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#1e293b')
      .text(d => d);

    // Staggered cell reveal — each cell fades in and slides up, 60ms apart
    cells.style('opacity', '0')
         .style('transform', 'translateY(20px)');

    // Use requestAnimationFrame to ensure DOM is ready before GSAP targets it
    requestAnimationFrame(() => {
      import('gsap').then((m) => {
        const gsap = m.gsap || m.default;
        if (!gsap) return;
        gsap.to(arrayGroup.selectAll('g.cell').nodes(), {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: 'back.out(1.4)',
          stagger: 0.06,
          clearProps: 'transform',
        });
      });
    });

    // Store array metadata on the node for pointer calculations
    (arrayGroup.node() as any)._arrayData = { offsetX, cellWidth: this.CELL_WIDTH, cellGap: this.CELL_GAP };
  }

  createPointer(id: string, atIndex: number, label: string, color: string = '#ef4444', targetArrayId?: string) {
    // Better selector: if targetArrayId is provided, use it, otherwise find any group with 'array' in id
    const arrayGroup = targetArrayId 
      ? this.svg.select(`#${targetArrayId}`) 
      : this.svg.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = this.ARRAY_Y + this.CELL_HEIGHT + 20;

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
      ? this.svg.select(`#${targetArrayId}`) 
      : this.svg.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = this.ARRAY_Y + this.CELL_HEIGHT + 20;

    this.svg.select(`#${id}`)
      .attr('transform', `translate(${x}, ${y})`);
  }

  highlightCell(id: string, color: string, duration: number = 0) {
    const rect = this.svg.select(`#${id}`).select('.cell-bg');
    if (!rect.empty()) {
      if (duration > 0) {
        rect.transition().duration(duration).attr('fill', color);
      } else {
        rect.attr('fill', color);
      }
    }
  }

  createComparator(left: string | number, right: string | number, op: string) {
    this.removeElement('comparator');
    const containerWidth = this.getWidth();

    const compGroup = this.svg.append('g')
      .attr('id', 'comparator')
      .attr('transform', `translate(${containerWidth / 2}, ${this.ARRAY_Y - 80})`);

    compGroup.append('rect')
      .attr('x', -75)
      .attr('y', -25)
      .attr('width', 150)
      .attr('height', 50)
      .attr('rx', 25)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2);

    compGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '18px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', 'bold')
      .attr('fill', '#334155')
      .text(`${left} ${op} ${right}`);
  }

  createTimeline(id: string, events: { date: string; label: string; description?: string }[]) {
    const width = this.getWidth();
    const height = 400;
    const padding = 100;
    const timelineY = height / 2;

    const group = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(0, 0)`);

    // Main line
    group.append('line')
      .attr('x1', padding)
      .attr('y1', timelineY)
      .attr('x2', width - padding)
      .attr('y2', timelineY)
      .attr('stroke', '#cbd5e1')
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
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    eventGroups.append('text')
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1e293b')
      .text(d => d.date);

    eventGroups.append('text')
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#64748b')
      .text(d => d.label);
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

    const group = this.svg.append('g').attr('id', id);

    if (type === 'bar') {
      group.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label)!)
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.value))
        .attr('fill', '#6366f1')
        .attr('rx', 4);
    } else {
      const line = d3.line<any>()
        .x(d => x(d.label)! + x.bandwidth() / 2)
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      group.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 3)
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

    const treemap = d3.tree().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const nodes = treemap(d3.hierarchy(data));

    const group = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    group.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2)
      .attr('d', (d: any) => `M${d.y},${d.x}C${(d.y + d.parent.y) / 2},${d.x} ${(d.y + d.parent.y) / 2},${d.parent.x} ${d.parent.y},${d.parent.x}`);

    const node = group.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.y}, ${d.x})`);

    node.append('circle')
      .attr('r', 20)
      .attr('fill', '#fff')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2);

    node.append('text')
      .attr('dy', '.35em')
      .attr('x', (d: any) => d.children ? -25 : 25)
      .attr('text-anchor', (d: any) => d.children ? 'end' : 'start')
      .text((d: any) => d.data.name || d.data.value);
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
      .attr('fill', '#64748b')
      .text(text);
  }

  drawBoundary(atIndex: number, label?: string, targetArrayId?: string) {
    const arrayGroup = targetArrayId 
      ? this.svg.select(`#${targetArrayId}`) 
      : this.svg.select('g[id*="array"]');
    
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData || { offsetX: 0, cellWidth: 60, cellGap: 10 };
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) - (meta.cellGap / 2);
    
    const boundaryId = `boundary-${atIndex}`;
    this.removeElement(boundaryId);

    const group = this.svg.append('g').attr('id', boundaryId);

    group.append('line')
      .attr('x1', x)
      .attr('y1', this.ARRAY_Y - 20)
      .attr('x2', x)
      .attr('y2', this.ARRAY_Y + this.CELL_HEIGHT + 20)
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '4 2');

    if (label) {
      group.append('text')
        .attr('x', x)
        .attr('y', this.ARRAY_Y - 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#f43f5e')
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

  removeElement(id: string) {
    this.svg.select(`#${id}`).remove();
  }
}

