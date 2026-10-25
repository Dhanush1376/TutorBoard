/**
 * Engine v2 — plays a Scene Language v1 scene.
 *
 *   simulate → measure → solve layout → build SVG → compile one GSAP timeline
 *
 * The host gives a container and the insets its own UI covers (header,
 * control bar, side panel); the camera fits the scene into what's left.
 */
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { TextPlugin } from 'gsap/TextPlugin';
import { BeatTiming, compileScene } from './compile';
import { makeSpace, SpaceMap } from './geometry';
import { fitTransform, Layout, solveLayout } from './layout';
import { measureScene } from './measure';
import { normalizeScene } from './normalize';
import { buildBoard, domLatexSize } from './render/board';
import { buildSpace, buildSpatial } from './render/spatial';
import { el, installDefs } from './render/svg';
import type { BuildCtx, Built } from './render/types';
import { simulate } from './simulate';
import type { Box, Insets, Pt, Scene } from './types';
import { parseRef } from './types';

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin, TextPlugin);

export type EngineOptions = {
  insets?: Partial<Insets>;
  /** called when playback enters a beat */
  onBeat?: (index: number, beat: BeatTiming) => void;
  /** called when a beat's animation and reading time have finished */
  onBeatEnd?: (index: number) => void;
  /** called when user pan/zoom navigation updates */
  onNavChange?: (t: { x: number; y: number; scale: number }) => void;
};

let uidCounter = 0;

export class SceneEngine {
  readonly host: HTMLElement;
  private opts: EngineOptions;
  private svg?: SVGSVGElement;
  private navGroup?: SVGGElement;
  private camera?: SVGGElement;
  private fitWorld?: Box;
  public navTransform = { x: 0, y: 0, scale: 1 };
  private currentNav = { x: 0, y: 0, scale: 1 };
  private navTween?: gsap.core.Tween;
  private tl?: gsap.core.Timeline;
  private scene?: Scene;
  private uid = `tb${++uidCounter}`;
  private current = -1;
  private stopAt: number | null = null;
  /** bumps on every load: a slower, older load must not land after a newer one */
  private loadSeq = 0;
  beats: BeatTiming[] = [];
  layout?: Layout;
  builts = new Map<string, Built>();

  constructor(host: HTMLElement, opts: EngineOptions = {}) {
    this.host = host;
    this.opts = opts;
  }

  get beatCount() { return this.beats.length; }
  get beatIndex() { return this.current; }
  get duration() { return this.tl?.duration() ?? 0; }
  get time() { return this.tl?.time() ?? 0; }
  get playing() { return !!this.tl && !this.tl.paused(); }

  /**
   * Build everything for `scene`. Safe to call again: the previous drawing
   * stays on screen until the new one is complete, then they swap in the
   * same frame (no flash while fonts load).
   */
  async load(input: Scene | unknown) {
    const seq = ++this.loadSeq;
    const scene = normalizeScene(input);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try { await (document as Document & { fonts: FontFaceSet }).fonts.ready; } catch { /* measure with fallbacks */ }
    }
    const sim = simulate(scene);
    const latex = scene.entities.flatMap((e) => (e.type === 'math' ? [e.latex] : []));
    if (latex.length && typeof document !== 'undefined' && 'fonts' in document) {
      latex.forEach((l) => domLatexSize(l)); // triggers the KaTeX font loads
      try { await (document as Document & { fonts: FontFaceSet }).fonts.ready; } catch { /* measure anyway */ }
    }
    if (seq !== this.loadSeq) return null; // a newer load took over while fonts loaded
    const previous = this.svg;
    this.tl?.kill();
    this.tl = undefined;
    this.builts = new Map();
    this.beats = [];
    this.scene = scene;
    const sizes = measureScene(scene, sim, domLatexSize);
    const layout = solveLayout(sizes, scene.layout, [...scene.spaces.map((s) => s.id), ...scene.entities.map((e) => e.id)]);
    this.layout = layout;

    const W = this.host.clientWidth || 1200;
    const H = this.host.clientHeight || 720;
    const ins = { top: 24, right: 24, bottom: 24, left: 24, ...this.opts.insets };
    const view: Box = { x: ins.left, y: ins.top, w: Math.max(200, W - ins.left - ins.right), h: Math.max(160, H - ins.top - ins.bottom) };

    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'data-engine': 'v2' });
    svg.style.display = 'block';
    svg.style.overflow = 'visible';
    this.host.appendChild(svg);
    this.svg = svg;
    installDefs(svg, this.uid);
    const navGroup = el('g', { class: 'scene-nav' }, svg);
    this.navGroup = navGroup;
    this.applyNavTransform(false);
    const camera = el('g', { class: 'camera' }, navGroup);
    const spaceLayer = el('g', { class: 'spaces' }, camera);
    const entityLayer = el('g', { class: 'entities' }, camera);
    const attachedLayer = el('g', { class: 'attached' }, camera);
    const overlay = el('g', { class: 'overlay' }, camera);

    const spaces = new Map<string, SpaceMap>();
    const spaceBuilts = new Map<string, Built>();
    const ctx: BuildCtx = {
      scene, svg, uid: this.uid, layer: spaceLayer, boxes: layout.boxes, sizes, spaces, sim,
      anchor: (ref) => this.anchor(ref),
    };
    for (const s of scene.spaces) {
      const box = layout.boxes.get(s.id);
      if (!box) continue;
      const map = makeSpace(s, box);
      spaces.set(s.id, map);
      spaceBuilts.set(s.id, buildSpace(ctx, s, map));
    }
    ctx.layer = entityLayer;
    const attached: typeof scene.entities = [];
    for (const e of scene.entities) {
      if ((e.type === 'line' || e.type === 'arrow' || e.type === 'angle') && !('space' in e && e.space)) { attached.push(e); continue; }
      const b = 'space' in e && e.space ? buildSpatial(ctx, e) : buildBoard(ctx, e);
      if (b) this.builts.set(e.id, b);
      else if (e.type === 'group') this.builts.set(e.id, { entity: e, root: el('g', {}, entityLayer), fx: el('g', {}, entityLayer), box: { x: 0, y: 0, w: 0, h: 0 } });
    }
    ctx.layer = attachedLayer;
    for (const e of attached) {
      const b = buildSpatial(ctx, e);
      if (b) this.builts.set(e.id, b);
    }
    // spaces' line/angle entities with coordinates were built above via buildSpatial too
    // hosts can tell which entity was clicked ("ask about this")
    for (const [id, b] of this.builts) b.root.setAttribute('data-entity', id);

    const world = this.worldBox(layout.world);
    const { tl, beats } = compileScene({ scene, sim, builts: this.builts, spaceBuilts, svg, uid: this.uid, overlay, camera, view, world });
    // callouts and connectors exist now — make sure the opening frame has room for them
    let fitWorld = world;
    try {
      const ob = overlay.getBBox();
      if (ob.width > 0) {
        const x0 = Math.min(world.x, ob.x), y0 = Math.min(world.y, ob.y);
        fitWorld = { x: x0, y: y0, w: Math.max(world.x + world.w, ob.x + ob.width) - x0, h: Math.max(world.y + world.h, ob.y + ob.height) - y0 };
        const f = fitTransform(fitWorld, view, 1.6, 18, 1.18);
        gsap.set(camera, { x: f.x, y: f.y, scale: f.scale });
      }
    } catch { /* getBBox unavailable (non-rendered host) — keep the layout fit */ }
    this.camera = camera;
    this.fitWorld = fitWorld;
    this.tl = tl;
    this.beats = beats;
    tl.eventCallback('onUpdate', () => this.tick());
    this.current = -1;
    previous?.remove();
    return { beats, layout };
  }

  /**
   * Swap in a longer version of the scene that is playing (beats streamed in
   * while the model writes) without disturbing playback: same time, same
   * beat, still playing if it was.
   */
  async extend(input: Scene | unknown) {
    const t = this.time;
    const wasPlaying = this.playing;
    const stopAt = this.stopAt;
    const current = this.current;
    if (!(await this.load(input)) || !this.tl) return;
    this.tl.seek(Math.min(t, this.tl.duration()), false);
    this.current = current;
    this.stopAt = stopAt;
    if (wasPlaying) this.tl.play();
  }

  /** Play from the current position through the end of the lesson. */
  play() {
    if (!this.tl) return;
    this.stopAt = null;
    if (this.tl.progress() >= 1) this.tl.seek(0);
    this.tl.play();
  }

  /** Play beat `i` from its start and stop at its end. */
  playBeat(i: number) {
    if (!this.tl || !this.beats[i]) return;
    this.tl.pause();
    this.tl.seek(this.beats[i].start, false);
    this.stopAt = this.beats[i].end;
    this.current = i;
    this.opts.onBeat?.(i, this.beats[i]);
    this.tl.play();
  }

  pause() { this.tl?.pause(); }

  /** Continue a paused beat up to its end (`play()` would run on through the lesson). */
  resume() {
    if (this.tl && this.stopAt !== null) this.tl.play();
  }

  /** New room for the scene (host resized, side panel opened): smoothly glide camera into new room. */
  async setInsets(insets: Partial<Insets>) {
    this.opts = { ...this.opts, insets: { ...this.opts.insets, ...insets } };
    if (!this.camera || !this.fitWorld) {
      await this.refit();
      return;
    }
    const W = this.host.clientWidth || 1200;
    const H = this.host.clientHeight || 720;
    const ins = { top: 24, right: 24, bottom: 24, left: 24, ...this.opts.insets };
    const view: Box = { x: ins.left, y: ins.top, w: Math.max(200, W - ins.left - ins.right), h: Math.max(160, H - ins.top - ins.bottom) };
    const f = fitTransform(this.fitWorld, view, 1.6, 18, 1.18);
    gsap.to(this.camera, {
      x: f.x,
      y: f.y,
      scale: f.scale,
      duration: 0.45,
      ease: 'power3.out',
    });
  }

  /** Rebuild for the host's current size, keeping time, beat and play state. */
  async refit() {
    if (this.scene) await this.extend(this.scene);
  }

  /** Jump to the end state of beat `i` (or its start). */
  seekBeat(i: number, where: 'start' | 'end' = 'end') {
    if (!this.tl || !this.beats[i]) return;
    this.tl.pause();
    this.stopAt = null;
    this.tl.seek(where === 'end' ? this.beats[i].animEnd : this.beats[i].start, false);
    this.current = i;
    this.opts.onBeat?.(i, this.beats[i]);
  }

  next() { this.playBeat(Math.min(this.beats.length - 1, this.current + 1)); }
  prev() { this.seekBeat(Math.max(0, this.current - 1)); }
  replay() { this.playBeat(Math.max(0, this.current)); }
  setSpeed(x: number) { this.tl?.timeScale(x); }

  public setNavTransform(t: { x: number; y: number; scale: number }, animated = false, duration = 0.5) {
    this.navTransform = t;
    this.opts.onNavChange?.(t);
    if (!this.navGroup) return;

    if (this.navTween) {
      this.navTween.kill();
      this.navTween = undefined;
    }

    if (animated) {
      this.navTween = gsap.to(this.currentNav, {
        x: t.x,
        y: t.y,
        scale: t.scale,
        duration,
        ease: 'power3.out',
        onUpdate: () => {
          this.navGroup?.setAttribute(
            'transform',
            `translate(${this.currentNav.x}, ${this.currentNav.y}) scale(${this.currentNav.scale})`
          );
        },
        onComplete: () => {
          this.navTween = undefined;
        },
      });
    } else {
      this.currentNav = { ...t };
      this.navGroup.setAttribute('transform', `translate(${t.x}, ${t.y}) scale(${t.scale})`);
    }
  }

  public applyNavTransform(animated = false) {
    this.setNavTransform(this.navTransform, animated);
  }

  public resetNav(animated = true) {
    this.setNavTransform({ x: 0, y: 0, scale: 1 }, animated, 0.55);
  }

  public zoomBy(factor: number, cx?: number, cy?: number, animated = true) {
    const prev = this.navTransform;
    const nextScale = Math.min(4.0, Math.max(0.4, Number((prev.scale * factor).toFixed(3))));
    if (Math.abs(nextScale - prev.scale) < 1e-4) return;
    const W = this.host.clientWidth || 800;
    const H = this.host.clientHeight || 600;
    const centerX = cx ?? W / 2;
    const centerY = cy ?? H / 2;
    const ratio = nextScale / prev.scale;
    const nextX = centerX - (centerX - prev.x) * ratio;
    const nextY = centerY - (centerY - prev.y) * ratio;
    this.setNavTransform({ x: nextX, y: nextY, scale: nextScale }, animated, 0.4);
  }

  destroy() { this.teardown(); }

  private teardown() {
    this.navTween?.kill();
    this.navTween = undefined;
    this.camera = undefined;
    this.fitWorld = undefined;
    this.tl?.kill();
    this.tl = undefined;
    this.svg?.remove();
    this.svg = undefined;
    this.navGroup = undefined;
    this.builts.clear();
    this.beats = [];
  }

  private tick() {
    const t = this.tl!.time();
    if (this.stopAt !== null && t >= this.stopAt - 1e-3) {
      this.tl!.pause();
      this.tl!.seek(this.stopAt, false);
      const i = this.current;
      this.stopAt = null;
      this.opts.onBeatEnd?.(i);
      return;
    }
    const idx = this.beats.findIndex((b) => t >= b.start && t < b.end);
    if (idx >= 0 && idx !== this.current) {
      if (this.current >= 0) this.opts.onBeatEnd?.(this.current);
      this.current = idx;
      this.opts.onBeat?.(idx, this.beats[idx]);
    }
  }

  /** World point for "tri.A", "h2o.O", "g.n3" or an entity id. */
  private anchor(ref: string): Pt | null {
    const { base, part } = parseRef(ref);
    const b = this.builts.get(base);
    if (!b) return null;
    if (part !== undefined) return b.part?.(part)?.at ?? null;
    return { x: b.box.x + b.box.w / 2, y: b.box.y + b.box.h / 2 };
  }

  /** Layout world plus everything drawn in spaces (spaces can be overdrawn by labels). */
  private worldBox(layoutWorld: Box): Box {
    let x0 = layoutWorld.x, y0 = layoutWorld.y, x1 = layoutWorld.x + layoutWorld.w, y1 = layoutWorld.y + layoutWorld.h;
    for (const b of this.builts.values()) {
      if (!b.box.w && !b.box.h) continue;
      x0 = Math.min(x0, b.box.x); y0 = Math.min(y0, b.box.y);
      x1 = Math.max(x1, b.box.x + b.box.w); y1 = Math.max(y1, b.box.y + b.box.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
}
