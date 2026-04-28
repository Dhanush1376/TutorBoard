import gsap from 'gsap';
import { D3Renderer } from '../renderers/D3Renderer';

export interface Command {
  cmd: string;
  id?: string;
  duration?: number;
  delay?: number;
  ms?: number;
  text?: string;
  left?: string | number;
  right?: string | number;
  op?: string;
  color?: string;
  atIndex?: number;
  label?: string;
  values?: (string | number)[];
  id1?: string;
  id2?: string;
  target?: string;
  [key: string]: any;
}

export class GSAPExecutor {
  private masterTimeline: gsap.core.Timeline | null = null;

  constructor() {
    this.masterTimeline = gsap.timeline({ paused: true });
  }

  public executeStep(script: Command[], renderer: D3Renderer, onNarrate: (text: string) => void) {
    this.kill();
    this.masterTimeline = gsap.timeline({ paused: false });

    let currentCursor = 0;

    for (const action of script) {
      const position = currentCursor + ((action.delay || 0) / 1000);

      switch (action.cmd) {
        case 'array':
          this.masterTimeline.call(() => {
            renderer.createArray(action.id!, action.values!);
          }, [], position);
          break;

        case 'pointer':
          this.masterTimeline.call(() => {
            renderer.createPointer(action.id!, action.atIndex!, action.label || '', action.color);
          }, [], position);
          break;

        case 'compare':
          this.masterTimeline.call(() => {
            renderer.createComparator(action.left!, action.right!, action.op!);
          }, [], position);
          break;

        case 'narrate':
          this.masterTimeline.call(() => {
            if (action.text) onNarrate(action.text);
          }, [], position);
          break;

        case 'annotate':
          this.masterTimeline.call(() => {
            renderer.annotate(action.id || action.target!, action.text!);
          }, [], position);
          break;

        case 'remove_annotation':
        case 'remove':
          this.masterTimeline.call(() => {
            renderer.removeElement(action.id || action.target || `annotation-${action.target}`);
          }, [], position);
          break;

        case 'highlight':
          const color = action.color || '#fef08a';
          const dur = (action.duration || 500) / 1000;
          // Target the rect inside the cell
          this.masterTimeline.to(`#${action.id} rect.cell-bg`, {
            fill: color,
            duration: dur,
            ease: 'power2.inOut'
          }, position);
          
          currentCursor = position + dur;
          break;

        case 'swap': {
          const swapDur = (action.duration || 1000) / 1000;
          const nestedTl = gsap.timeline();
          
          // Get elements BEFORE adding to timeline
          const el1 = document.getElementById(action.id1!);
          const el2 = document.getElementById(action.id2!);
          if (!el1 || el2 === null) break;

          const bbox1 = (el1 as any).getBBox ? (el1 as any).getBBox() : el1.getBoundingClientRect();
          const bbox2 = (el2 as any).getBBox ? (el2 as any).getBBox() : el2.getBoundingClientRect();
          const x1 = typeof bbox1.x === 'number' ? bbox1.x : bbox1.left;
          const x2 = typeof bbox2.x === 'number' ? bbox2.x : bbox2.left;
          const dx = x2 - x1;

          nestedTl
            .to(el1, { x: `+=${dx}`, y: '-=60', duration: swapDur/2, ease: 'sine.out' }, 0)
            .to(el1, { y: '+=60', duration: swapDur/2, ease: 'sine.in' }, swapDur/2)
            .to(el2, { x: `-=${dx}`, y: '+=60', duration: swapDur/2, ease: 'sine.out' }, 0)
            .to(el2, { y: '-=60', duration: swapDur/2, ease: 'sine.in' }, swapDur/2);

          this.masterTimeline.add(nestedTl, position);
          currentCursor = position + swapDur;
          break;
        }

        case 'update_pointer':
        case 'move_pointer': {
          const moveDur = (action.duration || 400) / 1000;
          this.masterTimeline.call(() => {
            renderer.updatePointer(action.id!, action.atIndex!, action.targetArrayId);
          }, [], position);
          // Then animate the translation — renderer updates the transform attribute
          currentCursor = position + moveDur;
          break;
        }

        case 'wait':
          const waitSecs = (action.ms || action.duration || 1000) / 1000;
          currentCursor = position + waitSecs;
          break;
          
        case 'camera':
          // Extensible for future camera panning
          break;
      }
    }
    
    return this.masterTimeline;
  }

  public pause() {
    this.masterTimeline?.pause();
  }

  public resume() {
    this.masterTimeline?.resume();
  }

  public kill() {
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
  }
}
