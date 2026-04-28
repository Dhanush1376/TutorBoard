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

  createArray(id: string, values: (number | string)[]) {
    const totalWidth = values.length * this.CELL_WIDTH + (values.length - 1) * this.CELL_GAP;
    // Center the array horizontally
    const startX = `calc(50% - ${totalWidth / 2}px)`;

    const arrayGroup = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(0, ${this.ARRAY_Y})`);

    // Create a container that will be centered via CSS or JS. 
    // Since SVG calc() transform isn't broadly supported, we'll calculate absolute if we know container width,
    // or just use 50% with text-anchor. Let's use standard group translation.
    // Assuming a 800px wide default for centering purposes, or we can just translate dynamically.
    // For simplicity, we'll center relative to 800px width.
    const offsetX = 400 - (totalWidth / 2);
    arrayGroup.attr('transform', `translate(${offsetX}, ${this.ARRAY_Y})`);

    const cells = arrayGroup.selectAll('g.cell')
      .data(values)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('id', (d, i) => `${id}-cell-${i}`)
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

    // Store array metadata on the node for pointer calculations
    (arrayGroup.node() as any)._arrayData = { offsetX, cellWidth: this.CELL_WIDTH, cellGap: this.CELL_GAP };
  }

  createPointer(id: string, atIndex: number, label: string, color: string = '#ef4444') {
    const arrayGroup = this.svg.select('g[id^="array"]'); // Assumes first array if not specified
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData;
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

  updatePointer(id: string, atIndex: number) {
    // Handled by GSAP usually, but if called directly:
    const arrayGroup = this.svg.select('g[id^="array"]');
    if (arrayGroup.empty()) return;

    const meta = (arrayGroup.node() as any)._arrayData;
    const x = meta.offsetX + (atIndex * (meta.cellWidth + meta.cellGap)) + (meta.cellWidth / 2);
    const y = this.ARRAY_Y + this.CELL_HEIGHT + 20;

    // This is instant. GSAP will animate this in the executor.
    this.svg.select(`#${id}`)
      .attr('transform', `translate(${x}, ${y})`);
  }

  highlightCell(id: string, color: string, duration: number = 0) {
    // If GSAP is handling color, we might not use this, but it's good for immediate updates
    const rect = this.svg.select(`#${id} rect.cell-bg`);
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

    const compGroup = this.svg.append('g')
      .attr('id', 'comparator')
      .attr('transform', `translate(400, ${this.ARRAY_Y - 80})`);

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

  annotate(id: string, text: string) {
    this.removeElement(`annotation-${id}`);
    const target = this.svg.select(`#${id}`);
    if (target.empty()) return;

    // Get transform
    const transformStr = target.attr('transform');
    // Basic extraction
    let x = 400;
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

  removeElement(id: string) {
    this.svg.select(`#${id}`).remove();
  }
}
