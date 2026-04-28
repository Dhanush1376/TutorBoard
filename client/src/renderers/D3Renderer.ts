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

  private getWidth() {
    const node = this.container.node();
    return node ? node.getBoundingClientRect().width : 800;
  }

  createArray(id: string, values: (number | string)[]) {
    const totalWidth = values.length * this.CELL_WIDTH + (values.length - 1) * this.CELL_GAP;
    const containerWidth = this.getWidth();
    const offsetX = (containerWidth / 2) - (totalWidth / 2);

    const arrayGroup = this.svg.append('g')
      .attr('id', id)
      .attr('transform', `translate(${offsetX}, ${this.ARRAY_Y})`);

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

  removeElement(id: string) {
    this.svg.select(`#${id}`).remove();
  }
}
