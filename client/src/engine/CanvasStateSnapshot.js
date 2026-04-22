/**
 * CanvasStateSnapshot v1.0
 * 
 * Captures and restores the visual state of elements to ensure continuity 
 * during complex transitions or renderer switches.
 */
export default class CanvasStateSnapshot {
  constructor() {
    this.states = new Map();
  }

  /**
   * Captures the current DOM state of all canvas elements.
   */
  capture() {
    const elements = document.querySelectorAll('[data-element-id]');
    elements.forEach(el => {
      const id = el.getAttribute('data-element-id');
      const rect = el.getBoundingClientRect();
      this.states.set(id, {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
        opacity: window.getComputedStyle(el).opacity
      });
    });
  }

  get(id) {
    return this.states.get(id);
  }

  clear() {
    this.states.clear();
  }
}
