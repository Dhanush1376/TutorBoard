/**
 * RendererPool v1.0 — Dynamic Renderer Lifecycle Manager
 *
 * Replaces the static RENDERER_MAP with a dynamic pool that can:
 * - Instantiate renderers on demand (lazy-load heavy ones)
 * - Cache renderer instances to avoid re-initialization overhead
 * - Recycle containers when switching between renderer types
 * - Pre-warm renderers during lesson generation for instant activation
 * - Report renderer capabilities (animation, interaction, 3D)
 */

import React from 'react';
import { D3Renderer } from '../renderers/D3Renderer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RendererType = string;

export interface RendererCapabilities {
  supportsAnimation: boolean;
  supportsInteraction: boolean;
  supports3D: boolean;
  supportsResize: boolean;
  requiresWebGL: boolean;
  maxEntities: number;          // Estimated cap before performance degrades
  preloadTimeMs: number;        // Estimated init time for preload scheduling
  supportedTopics?: string[];   // For AI routing
}

export interface RendererRegistration {
  type: RendererType;
  component: LazyComponent | React.ComponentType<any> | null;
  capabilities: RendererCapabilities;
  topicPatterns: string[];     // Regex patterns for auto-matching
  priority: number;            // Higher = preferred when multiple match
}

export interface RendererInstance {
  type: RendererType;
  instance: any;                // D3Renderer | MatterRenderer | etc.
  container: HTMLDivElement | null;
  isActive: boolean;
  lastUsed: number;
  capabilities: RendererCapabilities;
}

type LazyComponent = React.LazyExoticComponent<React.ComponentType<any>>;

// ─── Capability Profiles ────────────────────────────────────────────────────

const CAPABILITIES: Record<RendererType, RendererCapabilities> = {
  d3: {
    supportsAnimation: true,
    supportsInteraction: true,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 500,
    preloadTimeMs: 50,
  },
  katex: {
    supportsAnimation: false,
    supportsInteraction: false,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 50,
    preloadTimeMs: 100,
  },
  desmos: {
    supportsAnimation: true,
    supportsInteraction: true,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 20,
    preloadTimeMs: 200,
  },
  matter: {
    supportsAnimation: true,
    supportsInteraction: true,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 100,
    preloadTimeMs: 300,
  },
  three: {
    supportsAnimation: true,
    supportsInteraction: true,
    supports3D: true,
    supportsResize: true,
    requiresWebGL: true,
    maxEntities: 200,
    preloadTimeMs: 500,
  },
  monaco: {
    supportsAnimation: false,
    supportsInteraction: true,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 1,
    preloadTimeMs: 400,
  },
  simulator: {
    supportsAnimation: true,
    supportsInteraction: true,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 50,
    preloadTimeMs: 200,
  },
  narrative: {
    supportsAnimation: true,
    supportsInteraction: false,
    supports3D: false,
    supportsResize: true,
    requiresWebGL: false,
    maxEntities: 10,
    preloadTimeMs: 50,
  },
};

// ─── Topic → Renderer Resolution ────────────────────────────────────────────

const TOPIC_RENDERER_MAP: Record<string, RendererType> = {
  'cinematic': 'd3',
  'simulator': 'simulator',
  'matter': 'matter',
  'physics': 'matter',
  'mechanics': 'matter',
  'narrative': 'narrative',
  'history': 'd3',
  'social': 'd3',
  'biology': 'd3',
  'chemistry': 'd3',
  'statistics': 'd3',
  'stats': 'd3',
  'data': 'd3',
  'math': 'katex',
  'equation': 'katex',
  'katex': 'katex',
  'calculus': 'katex',
  'desmos': 'desmos',
  'graph': 'desmos',
  'algorithm': 'd3',
  'dsa': 'd3',
  'sorting': 'd3',
  'searching': 'd3',
  'd3': 'd3',
  'three': 'three',
  '3d': 'three',
  'advanced': 'three',
  'programming': 'monaco',
  'code': 'monaco',
  'software': 'monaco',
  'computer_science': 'monaco',
};

// ─── Lazy Component Imports ─────────────────────────────────────────────────

const LAZY_COMPONENTS: Partial<Record<RendererType, LazyComponent>> = {
  matter:    React.lazy(() => import('../components/renderers/MatterRenderer')),
  narrative: React.lazy(() => import('../components/renderers/NarrativeRenderer')),
  desmos:    React.lazy(() => import('../components/renderers/DesmosRenderer')),
  three:     React.lazy(() => import('../components/renderers/ThreeRenderer')),
  monaco:    React.lazy(() => import('../components/renderers/MonacoRenderer')),
  simulator: React.lazy(() => import('../components/renderers/SimulatorRenderer')),
};

// ─── DSA Detection ──────────────────────────────────────────────────────────

const DSA_KEYWORDS = [
  'algorithm', 'dsa', 'sorting', 'searching', 'sort', 'search',
  'binary', 'linear', 'bubble', 'merge', 'quick', 'insertion', 'selection',
  'array', 'tree', 'graph', 'stack', 'queue', 'linked', 'heap', 'bfs', 'dfs', 'traversal',
];

// ─── RendererPool Class ─────────────────────────────────────────────────────

export class RendererPool {
  private instances: Map<RendererType, RendererInstance> = new Map();
  private preloadPromises: Map<RendererType, Promise<void>> = new Map();
  
  // ─── NEW: Plugin Registry ────────────────────────────────────────────────
  private static registry: Map<string, RendererRegistration> = new Map();

  static register(name: string, config: RendererRegistration): void {
    RendererPool.registry.set(name, config);
    // Add to capabilities map for fallback
    CAPABILITIES[config.type] = config.capabilities;
  }

  static unregister(name: string): void {
    RendererPool.registry.delete(name);
  }

  static getRegistry(): Map<string, RendererRegistration> {
    return RendererPool.registry;
  }

  /**
   * AI-driven renderer selection based on capability requirements.
   */
  static selectBestRenderer(requirements: Partial<RendererCapabilities>, fallback: RendererType = 'd3'): RendererType {
    let bestMatch: string | null = null;
    let highestScore = -1;

    for (const [name, config] of RendererPool.registry.entries()) {
      let score = config.priority || 0;
      let failsRequirement = false;

      // Check strict requirements
      if (requirements.requiresWebGL && !config.capabilities.requiresWebGL) failsRequirement = true;
      if (requirements.supports3D && !config.capabilities.supports3D) failsRequirement = true;
      
      if (failsRequirement) continue;

      // Score preferences
      if (requirements.supportsAnimation && config.capabilities.supportsAnimation) score += 5;
      if (requirements.supportsInteraction && config.capabilities.supportsInteraction) score += 5;
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = config.type;
      }
    }

    return bestMatch || fallback;
  }

  // ── Resolution ─────────────────────────────────────────────────────────

  /**
   * Resolve a topic/type string to a concrete RendererType.
   */
  resolveType(type: string): RendererType {
    const lower = type.toLowerCase();
    return TOPIC_RENDERER_MAP[lower] || 'd3';
  }

  /**
   * Check if a timeline represents DSA content (used for specialized panels).
   */
  isDSAContent(timeline: any): boolean {
    if (!timeline) return false;
    const rendererType = (timeline.renderer || '').toLowerCase();
    if (rendererType === 'd3') return true;
    if (DSA_KEYWORDS.some(k => rendererType.includes(k))) return true;
    const title = (timeline.title || timeline.topic || '').toLowerCase();
    if (DSA_KEYWORDS.some(k => title.includes(k))) return true;
    const elements = timeline.elements || timeline.objects || [];
    if (elements.some((e: any) => (e.type || '').toLowerCase() === 'array' && Array.isArray(e.values))) return true;
    return false;
  }

  // ── Instance Management ────────────────────────────────────────────────

  /**
   * Get or create a D3Renderer instance for a given container element.
   */
  getD3Renderer(container: HTMLDivElement, width?: number, height?: number): D3Renderer {
    const existing = this.instances.get('d3');
    if (existing?.instance && existing.isActive) {
      return existing.instance as D3Renderer;
    }

    const renderer = new D3Renderer(container, width, height);
    this.instances.set('d3', {
      type: 'd3',
      instance: renderer,
      container,
      isActive: true,
      lastUsed: Date.now(),
      capabilities: CAPABILITIES.d3,
    });

    return renderer;
  }

  /**
   * Register a specialized renderer instance (physics, equation, graph, code).
   */
  registerInstance(type: RendererType, instance: any, container?: HTMLDivElement): void {
    this.instances.set(type, {
      type,
      instance,
      container: container || null,
      isActive: true,
      lastUsed: Date.now(),
      capabilities: CAPABILITIES[type] || CAPABILITIES.d3,
    });
  }

  /**
   * Get an existing renderer instance by type.
   */
  getInstance(type: RendererType): any | null {
    const entry = this.instances.get(type);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry.instance;
    }
    return null;
  }

  /**
   * Get the React lazy component for a renderer type (for dynamic imports).
   */
  getLazyComponent(type: RendererType): LazyComponent | null {
    return LAZY_COMPONENTS[type] || null;
  }

  // ── Capabilities ───────────────────────────────────────────────────────

  /**
   * Get the capability profile for a renderer type.
   */
  getCapabilities(type: RendererType): RendererCapabilities {
    return CAPABILITIES[type] || CAPABILITIES.d3;
  }

  /**
   * Check if a specific capability is supported.
   */
  supportsCapability(type: RendererType, capability: keyof RendererCapabilities): boolean {
    const caps = CAPABILITIES[type];
    if (!caps) return false;
    return !!caps[capability];
  }

  // ── Preloading ─────────────────────────────────────────────────────────

  /**
   * Pre-load a renderer module so it's ready for instant activation.
   * Returns a promise that resolves when the module is loaded.
   */
  async warmup(type: RendererType): Promise<void> {
    // D3 and KaTeX are already bundled
    if (type === 'd3' || type === 'katex') return;

    // Check if already preloading
    const existing = this.preloadPromises.get(type);
    if (existing) return existing;

    const importMap: Partial<Record<RendererType, () => Promise<any>>> = {
      matter:    () => import('../components/renderers/MatterRenderer'),
      narrative: () => import('../components/renderers/NarrativeRenderer'),
      desmos:    () => import('../components/renderers/DesmosRenderer'),
      three:     () => import('../components/renderers/ThreeRenderer'),
      monaco:    () => import('../components/renderers/MonacoRenderer'),
      simulator: () => import('../components/renderers/SimulatorRenderer'),
    };

    const importer = importMap[type];
    if (!importer) return;

    const promise = importer()
      .then(() => {
        console.log(`[RendererPool] ✅ Warmed up: ${type}`);
      })
      .catch((err) => {
        console.warn(`[RendererPool] ⚠️ Failed to warm up ${type}:`, err.message);
      });

    this.preloadPromises.set(type, promise);
    return promise;
  }

  /**
   * Warm up all renderers that might be needed for a timeline.
   */
  async warmupForTimeline(timeline: any): Promise<void> {
    const type = this.resolveType(timeline?.renderer || '');
    const promises: Promise<void>[] = [this.warmup(type)];

    // Also warm up secondary renderers that steps might need
    const steps = timeline?.steps || timeline?.timeline || [];
    const neededTypes = new Set<RendererType>();
    for (const step of steps) {
      if (step.renderer) neededTypes.add(this.resolveType(step.renderer));
      if (step.commands) {
        for (const cmd of step.commands) {
          if (cmd.cmd === 'equation') neededTypes.add('katex');
          if (cmd.cmd === 'graph') neededTypes.add('desmos');
          if (cmd.cmd === 'code') neededTypes.add('monaco');
          if (cmd.cmd === 'physics_body') neededTypes.add('matter');
        }
      }
    }

    for (const t of neededTypes) {
      promises.push(this.warmup(t));
    }

    await Promise.allSettled(promises);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Deactivate a renderer and clean up its resources.
   */
  deactivate(type: RendererType): void {
    const entry = this.instances.get(type);
    if (!entry) return;

    entry.isActive = false;

    // Call destroy if the renderer supports it
    if (typeof entry.instance?.destroy === 'function') {
      entry.instance.destroy();
    }

    this.instances.delete(type);
  }

  /**
   * Deactivate all renderers.
   */
  destroyAll(): void {
    for (const [type] of this.instances) {
      this.deactivate(type);
    }
    this.preloadPromises.clear();
  }

  /**
   * Get active instance count (for diagnostics).
   */
  getActiveCount(): number {
    return Array.from(this.instances.values()).filter(i => i.isActive).length;
  }

  /**
   * Release a specific renderer instance back to the pool (deactivating it).
   */
  release(type: RendererType): void {
    this.deactivate(type);
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const rendererPool = new RendererPool();
