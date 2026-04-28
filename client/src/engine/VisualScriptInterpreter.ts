import { GSAPExecutor, Command } from './GSAPExecutor';
import { D3Renderer } from '../renderers/D3Renderer';

export class VisualScriptInterpreter {
  private executor: GSAPExecutor;
  private renderer: D3Renderer | null = null;
  private onNarrate: (text: string) => void;

  constructor(onNarrate: (text: string) => void) {
    this.executor = new GSAPExecutor();
    this.onNarrate = onNarrate;
  }

  public setRenderer(renderer: D3Renderer) {
    this.renderer = renderer;
  }

  public playStep(script: Command[]) {
    if (!this.renderer) {
      console.warn('[VisualScriptInterpreter] Cannot play step: renderer not initialized.');
      return;
    }
    
    // Default behavior is to clear the renderer before a new step sequence
    // to prevent element stacking/ghosting.
    this.clear();
    this.executor.executeStep(script, this.renderer, this.onNarrate);
  }

  public playDelta(script: Command[]) {
    if (!this.renderer) {
      console.warn('[VisualScriptInterpreter] Cannot play delta: renderer not initialized.');
      return;
    }
    
    // Surgical intervention: DO NOT clear the renderer.
    // Run the script directly on top of the existing canvas state.
    this.executor.executeStep(script, this.renderer, this.onNarrate);
  }

  public clear() {
    this.executor.kill();
    this.renderer?.clear();
  }

  public pause() {
    this.executor.pause();
  }

  public resume() {
    this.executor.resume();
  }

  public kill() {
    this.executor.kill();
  }
}
