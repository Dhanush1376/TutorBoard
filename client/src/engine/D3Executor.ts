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
    
    // Default behavior is to clear the renderer before a new step sequence
    // to prevent element stacking/ghosting.
    this.clear();
    this.interpreter.executeStep(script, this.renderer, this.onNarrate);
  }

  public clear() {
    this.interpreter.kill();
    this.renderer?.clear();
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
