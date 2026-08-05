/// <reference types="vite/client" />
/**
 * SceneOrchestrator v1.0 — The Central Scene Intelligence Engine
 *
 * Converts AI-generated Scene JSON into live, interactive teaching simulations.
 *
 * Pipeline: Scene JSON → SceneGraph → RendererPool → GSAPExecutor → 60fps Render
 *
 * API:
 *   loadScene(sceneJSON)     — Parse and prepare a full lesson scene
 *   playStep(index)          — Animate to a specific step
 *   playDelta(commands)      — Apply doubt-delta without destroying the scene
 *   seekTo(time)             — Scrub to a position in the master timeline
 *   pause() / resume()       — Playback control
 *   getSnapshot()            — Capture current state for persistence
 *   destroy()                — Full cleanup
 */

import { SceneGraph, SceneEntity, EntityType, SceneGraphSnapshot } from './SceneGraph';
import { RendererPool, RendererType, rendererPool as defaultPool } from './RendererPool';
import { GSAPExecutor } from './GSAPExecutor';
import { TransitionEngine } from './TransitionEngine';
import { Command, RendererSystem } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SceneDefinition {
  title: string;
  domain?: string;
  renderer: string;
  totalSteps: number;
  steps: SceneStep[];
  elements?: SceneElement[];
  objects?: SceneElement[];
  connections?: any[];
  learningNodes?: any[];
  difficulty?: string;
  professorNote?: string;
  memoryAnchor?: string;
  keyFormula?: string;
  mode?: string;
}

export interface SceneStep {
  title?: string;
  type?: string;
  narration?: string;
  explanation?: string;
  pedagogicalNarration?: string;
  commands?: Command[];
  objects?: string[];              // IDs of objects visible in this step
  durationMs?: number;
  duration?: number;
  variables?: Record<string, any>;
  activeStates?: string[];
  pseudocode?: string;
  keyFormula?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  interactiveControls?: any;
  transition?: 'crossfade' | 'slide' | 'zoom' | 'morph' | 'wipe';
  elements?: SceneElement[];
}

export interface SceneElement {
  id: string;
  type: string;
  values?: (string | number)[];
  label?: string;
  x?: number;
  y?: number;
  [key: string]: any;
}

export interface PlayOptions {
  animate?: boolean;
  duration?: number;
  onComplete?: () => void;
  onNarrate?: (text: string) => void;
}

export interface OrchestratorCallbacks {
  onStepChange?: (index: number, step: SceneStep) => void;
  onNarrate?: (text: string) => void;
  onSceneReady?: () => void;
  onProgress?: (time: number, totalTime: number) => void;
  onInteraction?: (entityId: string, event: string, data?: any) => void;
  onError?: (error: Error) => void;
}

// ─── SceneOrchestrator ──────────────────────────────────────────────────────

export class SceneOrchestrator {
  private sceneGraph: SceneGraph;
  private executor: GSAPExecutor;
  private transitionEngine: TransitionEngine;
  private pool: RendererPool;
  private callbacks: OrchestratorCallbacks;

  private scene: SceneDefinition | null = null;
  private renderers: RendererSystem | null = null;
  private container: HTMLElement | null = null;

  private currentStepIndex: number = -1;
  private stepSnapshots: Map<number, SceneGraphSnapshot> = new Map();
  private isPlaying: boolean = false;
  private isDestroyed: boolean = false;

  constructor(
    container?: HTMLElement,
    callbacks: OrchestratorCallbacks = {},
    pool?: RendererPool
  ) {
    this.container = container || null;
    this.callbacks = callbacks;
    this.pool = pool || defaultPool;
    this.sceneGraph = new SceneGraph();
    this.executor = new GSAPExecutor(container || undefined);
    this.transitionEngine = new TransitionEngine();
  }

  // ── Scene Loading ───────────────────────────────────────────────────────

  /**
   * Load a scene definition and prepare for playback.
   * This is called when `teaching:timeline` arrives from the server.
   */
  loadScene(sceneJSON: SceneDefinition): void {
    if (this.isDestroyed) return;

    this.scene = sceneJSON;
    this.currentStepIndex = -1;
    this.stepSnapshots.clear();
    this.sceneGraph.clear();

    if (import.meta.env.DEV) {
      console.log(
        `[SceneOrchestrator] 🎬 Loading scene: "${sceneJSON.title}" ` +
        `(${sceneJSON.totalSteps} steps, renderer: ${sceneJSON.renderer})`
      );
    }

    // Pre-warm the required renderer
    const rendererType = this.pool.resolveType(sceneJSON.renderer || 'cinematic');
    this.pool.warmup(rendererType).catch(() => {});

    // Also warm up any renderers that steps might need
    this.pool.warmupForTimeline(sceneJSON).catch(() => {});

    // Pre-populate the scene graph with initial elements
    const elements = sceneJSON.elements || sceneJSON.objects || [];
    for (const element of elements) {
      this._addElementToGraph(element);
    }

    this.callbacks.onSceneReady?.();
  }

  /**
   * Set the renderer system (D3, physics, equation, graph, code).
   * Called after the DOM containers are ready.
   */
  setRenderers(renderers: RendererSystem): void {
    this.renderers = renderers;
    if (this.renderers.d3) {
      this.renderers.d3.onInteraction = (id, type) => {
        this.callbacks.onInteraction?.(id, 'click', { type });
      };
    }
  }

  /**
   * Register a specialized renderer (physics, equation, graph, code).
   */
  registerRenderer(type: 'physics' | 'equation' | 'graph' | 'code' | 'd3', instance: any): void {
    if (!this.renderers) {
      this.renderers = { d3: null as any };
    }
    (this.renderers as any)[type] = instance;

    // Also register in the pool
    this.pool.registerInstance(type as RendererType, instance);
  }

  /**
   * Get a registered renderer by type.
   */
  getRenderer(type: keyof RendererSystem): any {
    return this.renderers ? (this.renderers as any)[type] : null;
  }

  // ── Step Playback ───────────────────────────────────────────────────────

  /**
   * Animate to a specific step. This is the primary navigation method.
   */
  playStep(index: number, options: PlayOptions = {}): void {
    if (this.isDestroyed || !this.scene) return;

    const steps = this.scene.steps || [];
    if (index < 0 || index >= steps.length) {
      console.warn(`[SceneOrchestrator] Step index ${index} out of range [0, ${steps.length - 1}]`);
      return;
    }

    const step = steps[index];
    const prevIndex = this.currentStepIndex;
    this.currentStepIndex = index;

    // Capture snapshot of current state before transitioning
    if (prevIndex >= 0 && !this.stepSnapshots.has(prevIndex)) {
      this.stepSnapshots.set(prevIndex, this.sceneGraph.captureSnapshot(prevIndex));
    }

    // Check if we have a cached snapshot for the target step
    const cachedSnapshot = this.stepSnapshots.get(index);

    // Emit narration
    const narrationText = step.narration || step.explanation || step.pedagogicalNarration || '';
    if (narrationText) {
      const narrator = options.onNarrate || this.callbacks.onNarrate;
      narrator?.(narrationText);
    }

    // Decide whether to transition or instant-switch.
    // A forward-adjacent step is a progressive REVEAL (draw the next commands on
    // top of the current frame) — a full-canvas crossfade there would flash the
    // whole scene each step, so skip the transition for adjacent forward moves
    // and reserve it for jumps / backward seeks.
    const isForwardAdjacent = index === prevIndex + 1;
    const shouldTransition = prevIndex !== index && !isForwardAdjacent && this.container && options.animate !== false;

    if (shouldTransition) {
      const transitionType = step.transition || this.transitionEngine.autoDetect(
        steps[prevIndex]?.type,
        step.type,
        index > prevIndex ? 'forward' : 'backward'
      );

      this.transitionEngine.transition(this.container!, transitionType, {
        onStart: () => {
          this.callbacks.onStepChange?.(index, step);
        },
        onMidpoint: () => {
          // onComplete threads through the executor — it fires when the
          // step's animation timeline actually finishes, not when the
          // visual transition does.
          this._executeStepLogic(index, step, prevIndex, cachedSnapshot, options);
        },
      });
    } else {
      this.callbacks.onStepChange?.(index, step);
      this._executeStepLogic(index, step, prevIndex, cachedSnapshot, options);
    }
  }

  /**
   * Promise form of playStep — resolves when the step's animation finishes.
   */
  playStepAsync(index: number, options: PlayOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      this.playStep(index, {
        ...options,
        onComplete: () => {
          options.onComplete?.();
          resolve();
        },
      });
    });
  }

  /**
   * Internal logic to execute a step after transition midpoint or instantly.
   */
  private _executeStepLogic(
    index: number,
    step: SceneStep,
    prevIndex: number,
    cachedSnapshot: SceneGraphSnapshot | undefined,
    options: PlayOptions
  ): void {
    if (!this.renderers) return;

    const commands = step.commands || this._buildCommandsFromStep(step, index);
    const isForwardAdjacent = index === prevIndex + 1;

    // Instant (no animation): rebuild the full cumulative state up to this step.
    if (options.animate === false) {
      this.executor.kill();
      this.renderers.d3?.clear?.();
      this._executeCumulativeInstant(index);
      options.onComplete?.();
      return;
    }

    this.executor.kill();

    const finish = () => {
      this.stepSnapshots.set(index, this.sceneGraph.captureSnapshot(index));
      options.onComplete?.();
    };

    if (isForwardAdjacent) {
      // Progressive reveal: draw only THIS step's new commands on top of the
      // existing frame — the previous steps stay on screen. (index 0 from a
      // fresh -1 start also lands here and simply draws step 0 onto an empty canvas.)
      this.executor.play(commands, this.renderers, finish);
    } else {
      // Jump or backward seek: clear, instantly rebuild everything before the
      // target step, then animate the target step so the destination is correct.
      this.renderers.d3?.clear?.();
      this._executeCumulativeInstant(index - 1);
      this.executor.play(commands, this.renderers, finish);
    }
  }

  /**
   * Instantly (no GSAP) execute the commands of every step from 0..uptoIndex.
   * Used to reconstruct cumulative scene state on a jump or backward seek.
   */
  private _executeCumulativeInstant(uptoIndex: number): void {
    if (!this.scene) return;
    const steps = this.scene.steps || [];
    for (let i = 0; i <= uptoIndex && i < steps.length; i++) {
      const cmds = steps[i].commands || this._buildCommandsFromStep(steps[i], i);
      if (cmds.length > 0) this._executeCommandsInstantly(cmds);
    }
  }

  /**
   * Apply delta commands WITHOUT clearing the existing scene.
   * Used for doubt-response visual updates.
   */
  playDelta(commands: Command[], onComplete?: () => void): void {
    if (this.isDestroyed || !this.renderers) return;

    if (import.meta.env.DEV) {
      console.log(`[SceneOrchestrator] 🎯 Playing delta: ${commands.length} commands`);
    }

    // Track new entities added by delta
    const deltaEntityIds: string[] = [];
    for (const cmd of commands) {
      if (cmd.id) deltaEntityIds.push(cmd.id);
    }

    this.executor.play(commands, this.renderers, () => {
      // Tag delta entities for easy cleanup later
      this.sceneGraph.tagStep(-1, deltaEntityIds); // -1 = delta
      onComplete?.();
    });
  }

  // ── Playback Controls ──────────────────────────────────────────────────

  pause(): void {
    this.isPlaying = false;
    this.executor.pause();
  }

  resume(): void {
    this.isPlaying = true;
    this.executor.resume();
  }

  resetCamera(): void {
    this.renderers?.d3?.resetView?.();
  }

  kill(): void {
    this.executor.kill();
  }

  setSpeed(speed: number): void {
    this.executor.setSpeed(speed);
  }

  /**
   * Seek to a specific time in the master timeline.
   */
  seekTo(time: number): void {
    this.executor.seekTo(time);
  }

  /**
   * Get the current playback progress as a ratio [0, 1].
   */
  getProgress(): number {
    return this.executor.getProgress();
  }

  // ── State Queries ──────────────────────────────────────────────────────

  /**
   * Get the current scene definition.
   */
  getScene(): SceneDefinition | null {
    return this.scene;
  }

  /**
   * Get the current step index.
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Get the current step data.
   */
  getCurrentStep(): SceneStep | null {
    if (!this.scene || this.currentStepIndex < 0) return null;
    return this.scene.steps[this.currentStepIndex] || null;
  }

  /**
   * Get total steps count.
   */
  getTotalSteps(): number {
    return this.scene?.totalSteps || this.scene?.steps?.length || 0;
  }

  /**
   * Get the scene graph for direct entity queries.
   */
  getSceneGraph(): SceneGraph {
    return this.sceneGraph;
  }

  /**
   * Capture a serializable snapshot of the current scene state.
   */
  getSnapshot(): SceneGraphSnapshot {
    return this.sceneGraph.captureSnapshot(this.currentStepIndex);
  }

  /**
   * Restore a previously captured snapshot.
   */
  restoreFromSnapshot(snapshot: SceneGraphSnapshot): void {
    this.sceneGraph.restoreSnapshot(snapshot);
    this.currentStepIndex = snapshot.stepIndex;
    this._renderCurrentState();
  }

  // ── Preloading ─────────────────────────────────────────────────────────

  /**
   * Preload the next step's assets while the current one is playing.
   */
  preloadStep(index: number): void {
    if (!this.scene || index < 0 || index >= this.scene.steps.length) return;

    const step = this.scene.steps[index];
    const commands = step.commands || this._buildCommandsFromStep(step, index);

    // Pre-parse commands to identify needed renderers
    for (const cmd of commands) {
      if (cmd.cmd === 'equation') this.pool.warmup('katex');
      if (cmd.cmd === 'graph') this.pool.warmup('desmos');
      if (cmd.cmd === 'code') this.pool.warmup('monaco');
      if (cmd.cmd === 'physics_body') this.pool.warmup('matter');
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Clear the current scene without destroying the orchestrator.
   */
  clear(): void {
    this.executor.kill();
    this.sceneGraph.clear();
    this.stepSnapshots.clear();
    this.renderers?.d3?.clear?.();
    (this.renderers?.physics as any)?.clear?.();
    this.currentStepIndex = -1;
    this.scene = null;
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  /**
   * Convert a SceneElement to a SceneGraph entity.
   */
  private _addElementToGraph(element: SceneElement): void {
    this.sceneGraph.addEntity(
      element.id,
      (element.type || 'custom') as EntityType,
      {
        transform: {
          x: element.x || 0,
          y: element.y || 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
        },
        data: { ...element },
        interactive: true,
        tags: [],
      }
    );
  }

  /**
   * Build commands from a step that doesn't have explicit commands.
   * This is the backward-compatibility bridge for existing timeline data.
   */
  private _buildCommandsFromStep(step: SceneStep, stepIndex: number): Command[] {
    if (!this.scene) return [];

    const commands: Command[] = [];
    const rootElements = this.scene.elements || this.scene.objects || [];
    const stepElements = step.elements || [];
    const elements = [...rootElements, ...stepElements];
    const stepObjects = step.objects || [];

    // Find elements that belong to this step
    for (const element of elements) {
      // 1. If explicit objects IDs are provided for this step, use them strictly
      if (stepObjects.length > 0) {
        if (!stepObjects.includes(element.id)) continue;
      } else {
        // 2. If no explicit objects list, default to elements belonging to step 0 (base state)
        // or the current step if it was tagged. This prevents all objects from rendering at once.
        const elementStep = element.step ?? 0;
        if (elementStep !== 0 && elementStep !== stepIndex) continue;
      }

      switch (element.type) {
        case 'array':
          commands.push({
            cmd: 'array',
            id: element.id,
            values: element.values || [],
          });
          break;

        case 'pointer':
          commands.push({
            cmd: 'pointer',
            id: element.id,
            atIndex: element.atIndex ?? 0,
            label: element.label || '',
            color: element.color,
            targetArrayId: element.targetArrayId,
          });
          break;

        case 'comparator':
          commands.push({
            cmd: 'compare',
            left: element.left,
            right: element.right,
            op: element.op || '==',
          });
          break;

        case 'tree':
          commands.push({
            cmd: 'tree',
            id: element.id,
            data: element.data,
          });
          break;

        case 'chart':
          commands.push({
            cmd: 'chart',
            id: element.id,
            data: element.data,
            type: element.chartType,
          });
          break;

        case 'timeline':
          commands.push({
            cmd: 'timeline',
            id: element.id,
            events: element.events,
          });
          break;

        case 'node':
        case 'edge':
        case 'orb':
        case 'badge':
        case 'block':
        case 'step':
        case 'callout':
          commands.push({
            cmd: element.type,
            id: element.id,
            ...element,
          });
          break;

        default:
          // For unknown types, try to create a generic narration
          if (element.text || element.content) {
            commands.push({
              cmd: 'narrate',
              text: element.text || element.content,
            });
          }
      }
    }

    // Add narration command
    const narration = step.narration || step.explanation || '';
    if (narration) {
      commands.unshift({ cmd: 'narrate', text: narration });
    }

    return commands;
  }

  /**
   * Clean up resources, halt running animations, and release memory.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isPlaying = false;
    
    // Kill any active GSAP animations
    if (this.executor) {
      this.executor.kill();
    }
    
    // Release all renderers that were registered in this orchestrator
    if (this.renderers && this.pool) {
      Object.keys(this.renderers).forEach((key) => {
        const type = this.pool.resolveType(key);
        this.pool.release(type);
        (this.renderers as any)[key] = null;
      });
    }

    // Clear state
    this.stepSnapshots.clear();
    this.sceneGraph.clear();
    this.scene = null;
    this.renderers = null;
    this.container = null;
    this.callbacks = {};
  }

  /**
   * Execute commands instantly without GSAP animation.
   */
  private _executeCommandsInstantly(commands: Command[]): void {
    if (!this.renderers) return;

    for (const cmd of commands) {
      const { d3, physics, equation, graph, code } = this.renderers;

      switch (cmd.cmd) {
        case 'array': d3?.createArray(cmd.id!, cmd.values!, cmd); break;
        case 'node':
        case 'orb':
        case 'badge':
        case 'block':
        case 'data_block':
        case 'group':
        case 'step':
        case 'callout': d3?.createNode(cmd.id!, cmd); break;
        case 'edge': d3?.createEdge(cmd.id!, cmd); break;
        case 'pointer': d3?.createPointer(cmd.id!, cmd.atIndex!, cmd.label || '', cmd.color, cmd.targetArrayId); break;
        case 'move_pointer': d3?.updatePointer(cmd.id!, cmd.atIndex!, cmd.targetArrayId); break;
        case 'draw_boundary': d3?.drawBoundary(cmd.atIndex!, cmd.label || '', cmd.targetArrayId, cmd.endIndex); break;
        case 'swap': d3?.swapCells(cmd.id1!, cmd.id2!); break;
        case 'remove': d3?.removeElement(cmd.id || cmd.target!); break;
        case 'tree': d3?.createTree(cmd.id!, cmd.data!, cmd); break;
        case 'chart': d3?.createChart(cmd.id!, cmd.data!, cmd.type as any); break;
        case 'timeline': d3?.createTimeline(cmd.id!, cmd.events!); break;
        case 'compare': d3?.createComparator(cmd.left!, cmd.right!, cmd.op!); break;
        case 'annotate': d3?.annotate(cmd.id || cmd.target!, cmd.text!); break;
        case 'result': d3?.showResult(cmd.text!); break;
        case 'equation': equation?.setFormula?.(cmd.formula || cmd.text || ''); break;
        case 'graph': graph?.setExpression?.(cmd.latex || cmd.formula || '', cmd.color); break;
        case 'code': code?.setCode?.(cmd.code || cmd.content || ''); break;
        case 'physics_body': physics?.addBody?.(cmd); break;
        case 'narrate': this.callbacks.onNarrate?.(cmd.text || ''); break;
        // Transient effects (highlight/pulse/shake/flash/camera/wait) leave
        // no persistent state — nothing to rebuild.
      }
    }
  }

  /**
   * Render the current scene graph state to all active renderers.
   * Used after snapshot restoration.
   */
  private _renderCurrentState(): void {
    // For now, we re-execute the current step's commands
    // In the future, this will use the SceneGraph diff system
    if (this.scene && this.currentStepIndex >= 0) {
      const step = this.scene.steps[this.currentStepIndex];
      const commands = step?.commands || this._buildCommandsFromStep(step, this.currentStepIndex);
      this._executeCommandsInstantly(commands);
    }
  }
}
