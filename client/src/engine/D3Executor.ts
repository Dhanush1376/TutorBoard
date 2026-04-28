import { GSAPInterpreter, Command } from './GSAPInterpreter';
import { D3Renderer } from '../renderers/D3Renderer';

export class D3Executor {
  private interpreter: GSAPInterpreter;
  private renderer: D3Renderer | null = null;
  private onNarrate: (text: string) => void;

  constructor(onNarrate: (text: string) => void) {
    this.interpreter = new GSAPInterpreter();
    this.onNarrate = onNarrate;
  }

  public setRenderer(renderer: D3Renderer) {
    this.renderer = renderer;
  }

  public playStep(script: Command[]) {
    if (!this.renderer) {
      console.warn('[GSAPExecutor] Cannot play step: renderer not initialized.');
      return;
    }
    
    // Clear the previous stage for a fresh setup if the script begins with scene setup.
    // Usually, the step defines the current state. Wait, if it's just delta animations,
    // we shouldn't clear(). 
    // The prompt says: "builds a GSAP timeline that executes them in sequence."
    // We will let the interpreter handle it.
    this.interpreter.executeStep(script, this.renderer, this.onNarrate);
  }

  public pause() {
    this.interpreter.pause();
  }

  public resume() {
    this.interpreter.resume();
  }

  public kill() {
    this.interpreter.kill();
  }
}
