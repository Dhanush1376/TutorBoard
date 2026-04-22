import gsap from 'gsap';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/canvas';

/**
 * GSAPExecutor v1.0
 * 
 * Maps VisualScript commands to optimized GSAP tweens and timelines.
 */
export default class GSAPExecutor {
  constructor() {
    this.activeTimeline = null;
  }

  /**
   * Runs a set of actions within a GSAP timeline.
   * @param {Array} actions 
   */
  async run(actions) {
    this.killAll();
    
    const tl = gsap.timeline();
    this.activeTimeline = tl;

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
        default:
          console.warn(`[GSAPExecutor] Unsupported action: ${action.action}`);
      }
    });

    return tl;
  }

  killAll() {
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
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
