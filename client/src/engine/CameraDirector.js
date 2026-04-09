/**
 * CameraDirector — Cinematic Camera Control System
 *
 * Controls the scene like a camera director:
 *   - Auto-focus: pan to active elements per step
 *   - Auto-zoom: zoom into important regions
 *   - Parallax: slight depth effect during transitions
 *   - Smooth transitions: never abrupt, always eased
 *
 * Works by calling InfiniteCanvas.centerOn() / zoomIn via a canvas ref.
 *
 * camera behaviors:
 *   focus  → pan to highlight zone
 *   zoom   → scale in on important region  
 *   pan    → smooth translate between steps
 *   reset  → return to neutral view
 *
 * @module CameraDirector
 */

// ─── Canvas constants (must match CanvasRenderer) ────────────────────────────
const CW = 800;
const CH = 600;
const CANVAS_CENTER = { x: CW / 2, y: CH / 2 };

// ─── Camera behavior presets ─────────────────────────────────────────────────

/**
 * @typedef {Object} CameraCommand
 * @property {'focus'|'zoom'|'pan'|'reset'|'wide'} type
 * @property {number} [x]          - World X to center on
 * @property {number} [y]          - World Y to center on
 * @property {number} [zoom]       - Target zoom scale (null = keep current)
 * @property {number} [duration]   - Transition duration ms
 * @property {string} [easing]     - CSS easing string
 */

// ─── Domain zoom preferences ─────────────────────────────────────────────────

const DOMAIN_ZOOM_PREFS = {
  dsa:              { default: 1.0, focus: 1.1, wide: 0.85 },
  mathematics:      { default: 1.0, focus: 1.05, wide: 0.9 },
  physics:          { default: 0.95, focus: 1.0, wide: 0.85 },
  biology:          { default: 1.0, focus: 1.1, wide: 0.8 },
  chemistry:        { default: 1.0, focus: 1.15, wide: 0.85 },
  medicine:         { default: 0.95, focus: 1.0, wide: 0.8 },
  computer_science: { default: 1.0, focus: 1.05, wide: 0.85 },
  engineering:      { default: 0.95, focus: 1.0, wide: 0.85 },
  history:          { default: 0.9, focus: 0.95, wide: 0.8 },
  general:          { default: 1.0, focus: 1.05, wide: 0.85 },
};

// ─── Focus intensity → zoom delta ────────────────────────────────────────────

const FOCUS_ZOOM_DELTA = {
  1: 0,      // no zoom change
  2: 0,      // no zoom change
  3: 0.05,   // subtle zoom in
  4: 0.08,   // moderate
  5: 0.12,   // dramatic
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA DIRECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class CameraDirector {
  constructor() {
    /** @type {string} */
    this.domain = 'general';
    /** @type {number} */
    this.speed = 1;
    /** @type {{ x: number, y: number, zoom: number }} */
    this._lastPosition = { x: CANVAS_CENTER.x, y: CANVAS_CENTER.y, zoom: 1.0 };
    /** @type {Object|null} Canvas ref wrapper with centerOn / fitToContent methods */
    this._canvasRef = null;
    /** @type {boolean} Is user currently dragging (suppress camera) */
    this._userInteracting = false;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._cameraTimer = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._interactionTimer = null;
  }

  // ─── Configuration ─────────────────────────────────────────────────────

  /**
   * Attach the InfiniteCanvas ref directly.
   * @param {Object} canvasRef
   */
  attach(canvasRef) {
    this._canvasRef = canvasRef;
  }

  setDomain(domain) {
    this.domain = domain || 'general';
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  /**
   * Signal that the user is manually interacting — suppress camera.
   * @param {boolean} interacting
   */
  setUserInteracting(interacting) {
    this._userInteracting = interacting;
    
    // If interaction stopped, start a cooldown to re-enable camera
    if (!interacting) {
      if (this._interactionTimer) clearTimeout(this._interactionTimer);
      this._interactionTimer = setTimeout(() => {
        this._userInteracting = false;
        this._interactionTimer = null;
      }, 3000); // 3-second cooldown
    } else {
      // If we resumed interaction, clear the cooldown
      if (this._interactionTimer) clearTimeout(this._interactionTimer);
    }
  }

  // ─── Core: Direct camera ───────────────────────────────────────────────

  /**
   * Execute a camera command on the attached InfiniteCanvas.
   * @param {CameraCommand} cmd
   */
  execute(cmd) {
    if (!this._canvasRef || !this._canvasRef.current || this._userInteracting) return;

    const canvas = this._canvasRef.current;
    const duration = (cmd.duration || 600) / this.speed;

    // Apply CSS transition on the canvas content
    this._setTransition(duration, cmd.easing || 'cubic-bezier(0.25, 0.8, 0.25, 1)');

    switch (cmd.type) {
      case 'focus':
        if (cmd.x != null && cmd.y != null) {
          canvas.centerOn(cmd.x, cmd.y, cmd.zoom ?? this._lastPosition.zoom);
          this._lastPosition = { x: cmd.x, y: cmd.y, zoom: cmd.zoom ?? this._lastPosition.zoom };
        }
        break;

      case 'zoom':
        if (cmd.zoom != null) {
          canvas.centerOn(
            this._lastPosition.x,
            this._lastPosition.y,
            cmd.zoom,
          );
          this._lastPosition.zoom = cmd.zoom;
        }
        break;

      case 'pan':
        if (cmd.x != null && cmd.y != null) {
          const prefs = DOMAIN_ZOOM_PREFS[this.domain] || DOMAIN_ZOOM_PREFS.general;
          canvas.centerOn(cmd.x, cmd.y, cmd.zoom ?? prefs.default);
          this._lastPosition = { x: cmd.x, y: cmd.y, zoom: cmd.zoom ?? prefs.default };
        }
        break;

      case 'wide':
        canvas.fitToContent(CW, CH);
        const widePrefs = DOMAIN_ZOOM_PREFS[this.domain] || DOMAIN_ZOOM_PREFS.general;
        this._lastPosition.zoom = widePrefs.wide;
        break;

      case 'reset':
        canvas.fitToContent(CW, CH);
        this._lastPosition = { x: CANVAS_CENTER.x, y: CANVAS_CENTER.y, zoom: 1.0 };
        break;
    }
  }

  // ─── High-level: Direct from step data ────────────────────────────────

  /**
   * Direct the camera for a new step — the primary entry point.
   *
   * @param {Object} step - Step from timeline
   * @param {Object[]} objects - All scene objects
   * @param {Set<string>} highlightIds - Currently highlighted IDs
   * @param {Set<string>} newIds - Newly appearing IDs
   * @param {{ x: number, y: number }|null} focusPoint - Pre-calculated centroid of new objects
   * @param {number} focusIntensity - 1-5 from narrative analysis
   */
  directStep(step, objects, highlightIds, newIds, focusPoint, focusIntensity = 2) {
    if (!this._canvasRef || !this._canvasRef.current || this._userInteracting) return;

    // Clear any pending camera command
    if (this._cameraTimer) clearTimeout(this._cameraTimer);

    // Delay camera move slightly — let shape entrance animations start first
    const delay = 120 / this.speed;

    this._cameraTimer = setTimeout(() => {
      const command = this._buildCommand(step, objects, highlightIds, newIds, focusPoint, focusIntensity);
      if (command) this.execute(command);
    }, delay);
  }

  /**
   * Reset camera to overview (e.g., on new session or step 0).
   */
  resetToOverview() {
    if (this._cameraTimer) clearTimeout(this._cameraTimer);
    this._cameraTimer = setTimeout(() => {
      this.execute({ type: 'wide', duration: 700 });
    }, 200);
  }

  /**
   * Smoothly return to the default view for this domain.
   */
  returnToDefault() {
    const prefs = DOMAIN_ZOOM_PREFS[this.domain] || DOMAIN_ZOOM_PREFS.general;
    this.execute({
      type: 'focus',
      x: CANVAS_CENTER.x,
      y: CANVAS_CENTER.y,
      zoom: prefs.default,
      duration: 600,
    });
  }

  destroy() {
    if (this._cameraTimer) clearTimeout(this._cameraTimer);
    this._canvas = null;
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  /**
   * Build the optimal camera command for a step.
   */
  _buildCommand(step, objects, highlightIds, newIds, focusPoint, focusIntensity) {
    const prefs = DOMAIN_ZOOM_PREFS[this.domain] || DOMAIN_ZOOM_PREFS.general;
    const zoomDelta = FOCUS_ZOOM_DELTA[focusIntensity] || 0;

    // Strategy 1: Focus on explicitly highlighted objects
    if (highlightIds.size > 0) {
      const highlightCentroid = this._getCentroid(
        objects.filter(o => highlightIds.has(o.id))
      );
      if (highlightCentroid) {
        return {
          type: 'focus',
          x: highlightCentroid.x,
          y: highlightCentroid.y,
          zoom: Math.min(1.6, prefs.focus + zoomDelta),
          duration: 550,
          easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
        };
      }
    }

    // Strategy 2: Focus on new objects
    if (focusPoint && newIds.size > 0 && newIds.size <= 6) {
      return {
        type: 'pan',
        x: Math.max(80, Math.min(CW - 80, focusPoint.x)),
        y: Math.max(60, Math.min(CH - 60, focusPoint.y)),
        zoom: prefs.default + zoomDelta * 0.6,
        duration: 500,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      };
    }

    // Strategy 3: Many new objects — show wide view
    if (newIds.size > 6) {
      return {
        type: 'wide',
        duration: 600,
      };
    }

    // Strategy 4: Step has explicit camera hint
    if (step?.cameraFocus) {
      const { x, y, zoom } = step.cameraFocus;
      return {
        type: 'focus',
        x: x ?? CANVAS_CENTER.x,
        y: y ?? CANVAS_CENTER.y,
        zoom: zoom ?? prefs.default,
        duration: 550,
      };
    }

    // Strategy 5: No focus needed — subtle return towards center
    if (this._hasDriftedFar()) {
      return {
        type: 'pan',
        x: CANVAS_CENTER.x,
        y: CANVAS_CENTER.y,
        zoom: prefs.default,
        duration: 700,
      };
    }

    return null; // No camera move needed
  }

  /**
   * Get centroid of an object list.
   * @param {Object[]} objs
   * @returns {{ x: number, y: number } | null}
   */
  _getCentroid(objs) {
    if (!objs.length) return null;
    let sx = 0, sy = 0, count = 0;
    for (const o of objs) {
      const x = parseFloat(o.x ?? o.cx ?? o.x1) || 0;
      const y = parseFloat(o.y ?? o.cy ?? o.y1) || 0;
      if (x > 0 || y > 0) { sx += x; sy += y; count++; }
    }
    if (!count) return null;
    return { x: sx / count, y: sy / count };
  }

  /**
   * Apply a smooth CSS transition to the canvas content element.
   * This is the cinematic "camera" smooth motion.
   * @param {number} durationMs
   * @param {string} easing
   */
  _setTransition(durationMs, easing) {
    const canvas = this._canvasRef?.current;
    if (!canvas || !canvas.setTransition) return;
    canvas.setTransition(durationMs, easing);
  }

  /**
   * Check if camera has drifted far from center (to decide if gentle return is warranted).
   */
  _hasDriftedFar() {
    const dx = Math.abs(this._lastPosition.x - CANVAS_CENTER.x);
    const dy = Math.abs(this._lastPosition.y - CANVAS_CENTER.y);
    return dx > 150 || dy > 100;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const cameraDirector = new CameraDirector();
export default cameraDirector;
