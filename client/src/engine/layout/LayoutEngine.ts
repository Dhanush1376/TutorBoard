/**
 * LayoutEngine — automatic placement, collision detection, and text metrics
 * for the logical SVG canvas.
 *
 * Every visual element claims a padded bounding box. New elements ask for a
 * desired position; if it collides with an existing claim or leaves the safe
 * area, the engine searches nearby free space (expanding ring search) and
 * returns the closest collision-free spot. Zones reserve bands of the canvas
 * (title strip, result banner) so ambient UI never collides with content.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceOptions {
  /** Extra empty space required around the element (px, logical units). */
  padding?: number;
  /** Which zone the element belongs to. Content avoids reserved bands. */
  zone?: 'content' | 'header' | 'footer' | 'overlay';
  /** Preferred search direction when the desired spot is taken. */
  prefer?: 'down' | 'up' | 'right' | 'left';
  /** If true the rect is registered exactly where requested (no search). */
  fixed?: boolean;
}

const DEFAULT_PADDING = 12;
const SAFE_MARGIN = 24;
const HEADER_BAND = 72;   // reserved strip at the top (comparator / titles)
const FOOTER_BAND = 76;   // reserved strip at the bottom (result banner)

let sharedCtx: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  sharedCtx = canvas.getContext('2d');
  return sharedCtx;
}

export class LayoutEngine {
  private claims: Map<string, Rect> = new Map();
  private rowCursorY: number;

  constructor(public width: number = 800, public height: number = 600) {
    this.rowCursorY = HEADER_BAND + SAFE_MARGIN;
  }

  // ── Viewport ─────────────────────────────────────────────────────────────

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** The area content may occupy (excludes reserved bands + margins). */
  get safeArea(): Rect {
    return {
      x: SAFE_MARGIN,
      y: HEADER_BAND,
      w: this.width - SAFE_MARGIN * 2,
      h: this.height - HEADER_BAND - FOOTER_BAND,
    };
  }

  get headerArea(): Rect {
    return { x: SAFE_MARGIN, y: 8, w: this.width - SAFE_MARGIN * 2, h: HEADER_BAND - 8 };
  }

  get footerArea(): Rect {
    return { x: SAFE_MARGIN, y: this.height - FOOTER_BAND, w: this.width - SAFE_MARGIN * 2, h: FOOTER_BAND - 8 };
  }

  // ── Claims ───────────────────────────────────────────────────────────────

  claim(id: string, rect: Rect): void {
    this.claims.set(id, { ...rect });
  }

  release(id: string): void {
    this.claims.delete(id);
  }

  releaseByPrefix(prefix: string): void {
    for (const key of [...this.claims.keys()]) {
      if (key.startsWith(prefix)) this.claims.delete(key);
    }
  }

  reset(): void {
    this.claims.clear();
    this.rowCursorY = HEADER_BAND + SAFE_MARGIN;
  }

  getClaim(id: string): Rect | null {
    return this.claims.get(id) || null;
  }

  /** Union bounding box of everything currently claimed. */
  getContentBBox(): Rect | null {
    if (this.claims.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of this.claims.values()) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // ── Collision ────────────────────────────────────────────────────────────

  private rectsOverlap(a: Rect, b: Rect, pad: number): boolean {
    return (
      a.x - pad < b.x + b.w &&
      a.x + a.w + pad > b.x &&
      a.y - pad < b.y + b.h &&
      a.y + a.h + pad > b.y
    );
  }

  /** Does this rect collide with any existing claim (excluding `ignoreId`)? */
  collides(rect: Rect, pad: number = DEFAULT_PADDING, ignoreId?: string): boolean {
    for (const [id, claimed] of this.claims) {
      if (id === ignoreId) continue;
      if (this.rectsOverlap(rect, claimed, pad)) return true;
    }
    return false;
  }

  private insideArea(rect: Rect, area: Rect): boolean {
    return (
      rect.x >= area.x &&
      rect.y >= area.y &&
      rect.x + rect.w <= area.x + area.w &&
      rect.y + rect.h <= area.y + area.h
    );
  }

  clampToArea(rect: Rect, area: Rect): Rect {
    const x = Math.min(Math.max(rect.x, area.x), Math.max(area.x, area.x + area.w - rect.w));
    const y = Math.min(Math.max(rect.y, area.y), Math.max(area.y, area.y + area.h - rect.h));
    return { x, y, w: rect.w, h: rect.h };
  }

  // ── Placement ────────────────────────────────────────────────────────────

  /**
   * Find a collision-free position for a rect of size (w, h), as close to the
   * desired position as possible, register it under `id`, and return it.
   */
  place(id: string, desired: Rect, opts: PlaceOptions = {}): Rect {
    const pad = opts.padding ?? DEFAULT_PADDING;
    const area =
      opts.zone === 'header' ? this.headerArea :
      opts.zone === 'footer' ? this.footerArea :
      opts.zone === 'overlay' ? { x: 0, y: 0, w: this.width, h: this.height } :
      this.safeArea;

    // Remove any stale claim so an element can be re-placed.
    this.claims.delete(id);

    if (opts.fixed) {
      const fixedRect = this.clampToArea(desired, area);
      this.claim(id, fixedRect);
      return fixedRect;
    }

    const base = this.clampToArea(desired, area);
    if (!this.collides(base, pad)) {
      this.claim(id, base);
      return base;
    }

    // Expanding ring search around the desired spot.
    const STEP = 18;
    const MAX_RING = 24;
    const directionBias = opts.prefer === 'up' ? -1 : 1;
    let best: Rect | null = null;
    let bestDist = Infinity;

    for (let ring = 1; ring <= MAX_RING && !best; ring++) {
      const offsets: Array<[number, number]> = [];
      const d = ring * STEP;
      // vertical first (biased), then horizontal, then diagonals
      offsets.push([0, d * directionBias], [0, -d * directionBias]);
      offsets.push([d, 0], [-d, 0]);
      offsets.push([d, d * directionBias], [-d, d * directionBias]);
      offsets.push([d, -d * directionBias], [-d, -d * directionBias]);

      for (const [dx, dy] of offsets) {
        const candidate: Rect = { x: base.x + dx, y: base.y + dy, w: desired.w, h: desired.h };
        if (!this.insideArea(candidate, area)) continue;
        if (this.collides(candidate, pad)) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          best = candidate;
          bestDist = dist;
        }
      }
    }

    const finalRect = best || base;
    if (!best && import.meta.env?.DEV) {
      console.warn(`[LayoutEngine] No free space for "${id}" — accepting overlap at clamped position.`);
    }
    this.claim(id, finalRect);
    return finalRect;
  }

  /**
   * Stack allocator for full-width structures (arrays, charts). Returns a Y
   * position that doesn't collide with previous rows, wrapping back to the
   * top of the safe area if the canvas is full.
   */
  allocateRow(id: string, w: number, h: number, opts: { gap?: number } = {}): Rect {
    const gap = opts.gap ?? 44;
    const area = this.safeArea;
    const x = area.x + Math.max(0, (area.w - w) / 2);

    let y = this.rowCursorY;
    let rect: Rect = { x, y, w, h };
    let guard = 0;
    while (this.collides(rect, 8) && guard < 40) {
      y += Math.max(24, h / 2);
      if (y + h > area.y + area.h) y = area.y; // wrap to top and squeeze in
      rect = { x, y, w, h };
      guard++;
    }
    rect = this.clampToArea(rect, area);
    this.claim(id, rect);
    this.rowCursorY = Math.max(this.rowCursorY, rect.y + h + gap);
    if (this.rowCursorY > area.y + area.h - h) {
      this.rowCursorY = area.y; // future rows search from the top again
    }
    return rect;
  }

  // ── Auditing (used by tests / dev overlays) ──────────────────────────────

  /** Return every pair of claimed rects that overlap (should be empty). */
  auditOverlaps(pad: number = 0): Array<[string, string]> {
    const ids = [...this.claims.keys()];
    const collisions: Array<[string, string]> = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.claims.get(ids[i])!;
        const b = this.claims.get(ids[j])!;
        if (this.rectsOverlap(a, b, pad)) collisions.push([ids[i], ids[j]]);
      }
    }
    return collisions;
  }

  // ── Text metrics ─────────────────────────────────────────────────────────

  measureText(
    text: string,
    fontSize: number = 14,
    fontWeight: string | number = 400,
    fontFamily: string = 'Inter, system-ui, sans-serif'
  ): { width: number; height: number } {
    const ctx = measureCtx();
    if (!ctx) {
      return { width: text.length * fontSize * 0.6, height: fontSize * 1.3 };
    }
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    return { width: metrics.width, height: fontSize * 1.3 };
  }

  /** Greedy word wrap. Returns the lines and the widest line's width. */
  wrapText(
    text: string,
    maxWidth: number,
    fontSize: number = 14,
    fontWeight: string | number = 400,
    maxLines: number = 3
  ): { lines: string[]; width: number } {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.measureText(candidate, fontSize, fontWeight).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);

    // If we ran out of lines, ellipsize the last one.
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length && lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 1 && this.measureText(last + '…', fontSize, fontWeight).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last + '…';
    }

    const width = Math.max(...lines.map(l => this.measureText(l, fontSize, fontWeight).width), 0);
    return { lines, width };
  }
}
