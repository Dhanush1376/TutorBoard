import gsap from 'gsap';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/canvas';

/**
 * GSAPExecutor v1.0
 * 
 * Maps VisualScript commands to optimized GSAP tweens and timelines.
 */
export default class GSAPExecutor {
  constructor() {
    this.timeline = null;
    this.deltaTimeline = null;
  }

  /**
   * Runs a surgical visual intervention on a separate timeline 
   * to avoid interrupting the main lesson flow.
   */
  runDelta(actions) {
    if (!actions || actions.length === 0) return;
    
    // If a previous delta is running, kill it to prevent collision
    if (this.deltaTimeline) {
      this.deltaTimeline.kill();
    }

    this.deltaTimeline = gsap.timeline();
    this._executeActions(actions, this.deltaTimeline);
    return this.deltaTimeline;
  }

  /**
   * Runs a set of actions within a GSAP timeline.
   * @param {Array} actions 
   */
  async run(actions) {
    this.killAll();
    this.timeline = gsap.timeline();
    this._executeActions(actions, this.timeline);
    return this.timeline;
  }

  /**
   * Internal logic to map VisualScript actions to GSAP tweens.
   */
  _executeActions(actions, tl) {
    if (!Array.isArray(actions)) return;
    
    actions.forEach(action => {
      const target = `[data-element-id="${action.id}"]`;
      const duration = action.duration || 0.4;
      const delay = action.delay || 0;
      const ease = this.mapEase(action.easing);

      switch (action.action) {
        case 'fade_in':
          tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration, ease }, delay);
          break;
        case 'fade_out':
          tl.to(target, { opacity: 0, duration, ease }, delay);
          break;
        case 'scale_in':
          tl.fromTo(target, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration, ease }, delay);
          break;
        case 'scale_out':
          tl.to(target, { scale: 0, opacity: 0, duration, ease }, delay);
          break;
        case 'move':
          if (action.props) {
            tl.to(target, { 
              x: action.props.x !== undefined ? action.props.x * CANVAS_WIDTH : '+=0', 
              y: action.props.y !== undefined ? action.props.y * CANVAS_HEIGHT : '+=0', 
              duration, ease 
            }, delay);
          }
          break;
        case 'highlight':
          tl.to(target, { filter: 'brightness(1.5) saturate(1.2)', duration: duration/2, yoyo: true, repeat: 1, ease }, delay);
          break;
        case 'shake':
          tl.to(target, { x: '+=10', duration: 0.05, repeat: 5, yoyo: true, ease: 'linear' }, delay);
          break;
        case 'glow_pulse':
          tl.to(target, { filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.8))', duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' }, delay);
          break;
        case 'draw':
          tl.fromTo(target, { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration, ease }, delay);
          break;
        case 'pointer_move':
          // Special handling for the teacher's pointer
          const pointer = '[data-element-id="teacher-pointer"]';
          tl.to(pointer, { x: action.props.x * CANVAS_WIDTH, y: action.props.y * CANVAS_HEIGHT, duration, ease }, delay);
          break;
        // ─── Algorithm-specific Actions ─────────────────────────────────────
        case 'swap':
          if (action.props) {
            const fromEl = `[data-element-id="${action.props.fromId}"]`;
            const toEl   = `[data-element-id="${action.props.toId}"]`;
            tl.to(fromEl, { y: '-=35', duration: duration * 0.3, ease }, delay);
            tl.to(toEl,   { y: '+=35', duration: duration * 0.3, ease }, delay);
            tl.to(fromEl, { x: action.props.toX ?? '+=60', duration: duration * 0.4, ease }, delay + duration * 0.3);
            tl.to(toEl,   { x: action.props.fromX ?? '-=60', duration: duration * 0.4, ease }, delay + duration * 0.3);
            tl.to(fromEl, { y: '+=35', duration: duration * 0.3, ease }, delay + duration * 0.7);
            tl.to(toEl,   { y: '-=35', duration: duration * 0.3, ease }, delay + duration * 0.7);
          }
          break;
        case 'compare':
          if (action.props) {
            const elA = `[data-element-id="${action.props.a}"]`;
            const elB = `[data-element-id="${action.props.b}"]`;
            tl.to([elA, elB], {
              filter: 'brightness(1.4) saturate(1.3)',
              duration: 0.3, yoyo: true, repeat: 1, ease
            }, delay);
          }
          break;
        case 'eliminate':
          tl.to(target, { opacity: 0.2, filter: 'grayscale(0.8)', duration, ease }, delay);
          break;
        case 'activate':
          tl.to(target, {
            opacity: 1,
            filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(139,92,246,0.5))',
            duration, ease
          }, delay);
          break;
        case 'mark_sorted':
          tl.to(target, {
            filter: 'brightness(1.1) drop-shadow(0 0 6px rgba(34,197,94,0.4))',
            duration, ease
          }, delay);
          break;
        
        // ─── Master Delta New Schema Mappings ───────────────────────────────
        case 'highlightNode':
          tl.to(target, { filter: 'brightness(1.5) saturate(1.2)', duration: duration/2, yoyo: true, repeat: 1, ease }, delay);
          break;
        case 'movePointer':
          const ptr = '[data-element-id="teacher-pointer"]';
          tl.to(ptr, { x: action.props.x * CANVAS_WIDTH, y: action.props.y * CANVAS_HEIGHT, duration, ease }, delay);
          break;
        case 'showTextOverlay':
          // For now, highlight with text logging if we don't have a tooltip component ready
          console.log(`[VisualScript] Text Overlay: ${action.props.text}`);
          tl.to(target, { scale: 1.1, duration: 0.2, yoyo: true, repeat: 1 }, delay);
          break;
        case 'emphasizeEdge':
          tl.to(target, { strokeWidth: '+=2', filter: 'brightness(1.4)', duration, ease }, delay);
          break;
        case 'pulseElement':
          tl.to(target, { filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.8))', duration: 0.8, repeat: 3, yoyo: true, ease: 'sine.inOut' }, delay);
          break;

        default:
          console.warn(`[GSAPExecutor] Unsupported action: ${action.action}`);
      }
    });

    return tl;
  }

  killAll() {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    if (this.deltaTimeline) {
      this.deltaTimeline.kill();
      this.deltaTimeline = null;
    }
    gsap.killTweensOf('[data-element-id]');
  }


  mapEase(ease) {
    const eases = {
      'ease_out': 'power2.out',
      'ease_in': 'power2.in',
      'ease_in_out': 'power2.inOut',
      'spring': 'elastic.out(1, 0.5)',
      'bounce': 'bounce.out',
      'linear': 'none'
    };
    return eases[ease] || 'power2.out';
  }
}
