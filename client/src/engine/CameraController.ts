/**
 * CameraController — smart, smooth camera for the canvas engine.
 *
 * All camera motion is tweened INSIDE the master timeline (pausable,
 * scrubbable, speed-scaled) and applied through d3.zoom's transform API, so
 * programmatic moves and user pan/zoom share one source of truth and never
 * fight or jump.
 */

import * as d3 from 'd3';
import gsap from 'gsap';

type TL = gsap.core.Timeline;

export interface CameraTransform {
  x: number;
  y: number;
  k: number;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const FOCUS_FILL = 0.72;      // focused content fills ~72% of the viewport
const VISIBLE_MARGIN = 30;    // px margin when checking visibility

export class CameraController {
  /** Live mirror of the actual camera; user zoom updates it too. */
  private state: CameraTransform = { x: 0, y: 0, k: 1 };

  constructor(
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>,
    private getViewport: () => { width: number; height: number }
  ) {
    // Track user-driven zoom so timeline tweens start from reality.
    this.zoomBehavior.on('zoom.camera', (event) => {
      this.state.x = event.transform.x;
      this.state.y = event.transform.y;
      this.state.k = event.transform.k;
    });
  }

  getState(): CameraTransform {
    return { ...this.state };
  }

  private apply(): void {
    const t = d3.zoomIdentity.translate(this.state.x, this.state.y).scale(this.state.k);
    // Write through the behavior so its internal state stays consistent.
    this.svg.call(this.zoomBehavior.transform as any, t);
  }

  /** Tween the camera to a target transform inside the timeline. */
  tweenTo(tl: TL, target: CameraTransform, at: number, duration: number = 0.9): number {
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target.k));
    tl.to(this.state, {
      x: target.x,
      y: target.y,
      k,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => this.apply(),
    }, at);
    return duration;
  }

  /** Compute the transform that centers a bbox at the given zoom. */
  transformForBBox(bbox: BBox, zoom?: number): CameraTransform {
    const { width, height } = this.getViewport();
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    const fitK = Math.min(
      (width * FOCUS_FILL) / Math.max(bbox.w, 1),
      (height * FOCUS_FILL) / Math.max(bbox.h, 1)
    );
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom ?? Math.min(fitK, 1.8)));
    return { x: width / 2 - k * cx, y: height / 2 - k * cy, k };
  }

  /** FocusOn (Manim) — smoothly zoom/pan so the bbox fills the view. */
  focusOn(tl: TL, bbox: BBox, at: number, opts: { zoom?: number; duration?: number } = {}): number {
    return this.tweenTo(tl, this.transformForBBox(bbox, opts.zoom), at, opts.duration ?? 0.9);
  }

  /** Is the bbox fully visible under the current camera (with margin)? */
  isVisible(bbox: BBox): boolean {
    const { width, height } = this.getViewport();
    const { x, y, k } = this.state;
    const sx = x + k * bbox.x;
    const sy = y + k * bbox.y;
    const sw = k * bbox.w;
    const sh = k * bbox.h;
    return (
      sx >= -VISIBLE_MARGIN &&
      sy >= -VISIBLE_MARGIN &&
      sx + sw <= width + VISIBLE_MARGIN &&
      sy + sh <= height + VISIBLE_MARGIN
    );
  }

  /**
   * Ensure a bbox is visible: no-op when it already is (avoids gratuitous
   * camera motion), zoom-to-fit when it isn't. Visibility is evaluated at
   * play time, not compile time, so earlier moves are accounted for.
   */
  ensureVisible(tl: TL, getBBox: () => BBox | null, at: number, opts: { duration?: number } = {}): number {
    const duration = opts.duration ?? 0.8;
    // Proxy tween pattern: decide at play time whether to move.
    const proxy = { t: 0 };
    let from: CameraTransform | null = null;
    let to: CameraTransform | null = null;
    tl.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onStart: () => {
        const bbox = getBBox();
        from = { ...this.state };
        to = bbox && !this.isVisible(bbox) ? this.transformForBBox(bbox) : null;
      },
      onUpdate: () => {
        if (!from || !to) return;
        this.state.x = from.x + (to.x - from.x) * proxy.t;
        this.state.y = from.y + (to.y - from.y) * proxy.t;
        this.state.k = from.k + (to.k - from.k) * proxy.t;
        this.apply();
      },
    }, at);
    return duration;
  }

  /** Reset to identity (optionally inside a timeline). */
  reset(tl?: TL, at: number = 0, duration: number = 0.75): number {
    if (tl) {
      return this.tweenTo(tl, { x: 0, y: 0, k: 1 }, at, duration);
    }
    this.svg.transition()
      .duration(duration * 1000)
      .ease(d3.easeCubicInOut)
      .call(this.zoomBehavior.transform as any, d3.zoomIdentity);
    return duration;
  }

  destroy(): void {
    this.zoomBehavior.on('zoom.camera', null);
  }
}
