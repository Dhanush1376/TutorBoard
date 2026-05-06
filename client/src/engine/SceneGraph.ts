/**
 * SceneGraph v1.0 — Declarative Entity-Component Graph
 *
 * Tracks all renderable objects in a teaching scene with:
 * - Typed entity registry (position, scale, opacity, color, data)
 * - Parent-child hierarchies for grouped elements
 * - Diff-based updates (only re-render what changed)
 * - Serializable for session persistence
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntityType =
  | 'array' | 'pointer' | 'boundary' | 'range'
  | 'comparator' | 'annotation' | 'result'
  | 'tree' | 'chart' | 'timeline'
  | 'equation' | 'graph' | 'code'
  | 'physics_body' | 'force_vector'
  | 'narrative_block' | 'label' | 'connector'
  | 'custom';

export interface EntityTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface EntityStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: string | number;
  filter?: string;
  className?: string;
}

export interface SceneEntity {
  id: string;
  type: EntityType;
  transform: EntityTransform;
  style: EntityStyle;
  data: Record<string, any>;         // Type-specific data (values, label, events, etc.)
  parentId: string | null;
  childIds: string[];
  zIndex: number;
  visible: boolean;
  interactive: boolean;
  rendererHint?: string;             // Which renderer should draw this
  tags: string[];                    // For querying (e.g. ['step-3', 'highlight'])
  
  // NEW: Animation state per entity
  animation?: {
    timeline: string | null;         // GSAP timeline ID
    state: 'idle' | 'playing' | 'paused' | 'completed';
    progress: number;                // 0-1
  };
  
  // NEW: Interaction metadata
  interaction?: {
    draggable: boolean;
    clickable: boolean;
    hoverEffect: string | null;
    tooltip: string | null;
  };
  
  // NEW: Renderer portability
  preferredRenderer?: string | null; // Override for this specific entity

  createdAt: number;
  updatedAt: number;
}

export interface EntityDiff {
  entityId: string;
  changes: Partial<Omit<SceneEntity, 'id' | 'createdAt'>>;
  type: 'create' | 'update' | 'remove';
}

export interface SceneGraphSnapshot {
  entities: Record<string, SceneEntity>;
  rootIds: string[];
  timestamp: number;
  stepIndex: number;
  cameras?: CameraState[];           // NEW: viewport states
  timelines?: TimelineRef[];         // NEW: animation timeline references
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface TimelineRef {
  id: string;
  state: 'idle' | 'playing' | 'paused' | 'completed';
  progress: number;
}

// ─── Default Transforms ─────────────────────────────────────────────────────

const DEFAULT_TRANSFORM: EntityTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

const DEFAULT_STYLE: EntityStyle = {};

// ─── SceneGraph Class ───────────────────────────────────────────────────────

export class SceneGraph {
  private entities: Map<string, SceneEntity> = new Map();
  private rootIds: Set<string> = new Set();
  private pendingDiffs: EntityDiff[] = [];
  private listeners: Set<(diffs: EntityDiff[]) => void> = new Set();
  private batchDepth: number = 0;

  // ── Entity CRUD ─────────────────────────────────────────────────────────

  /**
   * Create a new entity in the scene graph.
   */
  addEntity(
    id: string,
    type: EntityType,
    options: {
      transform?: Partial<EntityTransform>;
      style?: EntityStyle;
      data?: Record<string, any>;
      parentId?: string | null;
      zIndex?: number;
      visible?: boolean;
      interactive?: boolean;
      rendererHint?: string;
      tags?: string[];
    } = {}
  ): SceneEntity {
    if (this.entities.has(id)) {
      console.warn(`[SceneGraph] Entity "${id}" already exists. Use updateEntity() instead.`);
      return this.entities.get(id)!;
    }

    const now = Date.now();
    const entity: SceneEntity = {
      id,
      type,
      transform: { ...DEFAULT_TRANSFORM, ...(options.transform || {}) },
      style: { ...DEFAULT_STYLE, ...(options.style || {}) },
      data: options.data || {},
      parentId: options.parentId || null,
      childIds: [],
      zIndex: options.zIndex ?? 0,
      visible: options.visible ?? true,
      interactive: options.interactive ?? false,
      rendererHint: options.rendererHint,
      tags: options.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.entities.set(id, entity);

    // Register with parent or as root
    if (entity.parentId && this.entities.has(entity.parentId)) {
      const parent = this.entities.get(entity.parentId)!;
      parent.childIds.push(id);
      parent.updatedAt = now;
    } else {
      this.rootIds.add(id);
    }

    this._emitDiff({ entityId: id, changes: { ...entity }, type: 'create' });
    return entity;
  }

  /**
   * Update specific properties of an existing entity.
   * Only changed fields trigger a diff emission.
   */
  updateEntity(
    id: string,
    changes: {
      transform?: Partial<EntityTransform>;
      style?: Partial<EntityStyle>;
      data?: Record<string, any>;
      zIndex?: number;
      visible?: boolean;
      interactive?: boolean;
      tags?: string[];
    }
  ): SceneEntity | null {
    const entity = this.entities.get(id);
    if (!entity) {
      console.warn(`[SceneGraph] Cannot update: entity "${id}" not found.`);
      return null;
    }

    const diffChanges: Partial<SceneEntity> = {};
    const now = Date.now();

    if (changes.transform) {
      entity.transform = { ...entity.transform, ...changes.transform };
      diffChanges.transform = entity.transform;
    }
    if (changes.style) {
      entity.style = { ...entity.style, ...changes.style };
      diffChanges.style = entity.style;
    }
    if (changes.data) {
      entity.data = { ...entity.data, ...changes.data };
      diffChanges.data = entity.data;
    }
    if (changes.zIndex !== undefined) {
      entity.zIndex = changes.zIndex;
      diffChanges.zIndex = changes.zIndex;
    }
    if (changes.visible !== undefined) {
      entity.visible = changes.visible;
      diffChanges.visible = changes.visible;
    }
    if (changes.interactive !== undefined) {
      entity.interactive = changes.interactive;
      diffChanges.interactive = changes.interactive;
    }
    if (changes.tags) {
      entity.tags = changes.tags;
      diffChanges.tags = changes.tags;
    }

    entity.updatedAt = now;
    diffChanges.updatedAt = now;

    if (Object.keys(diffChanges).length > 1) { // > 1 because updatedAt is always set
      this._emitDiff({ entityId: id, changes: diffChanges, type: 'update' });
    }

    return entity;
  }

  /**
   * Remove an entity and all its children recursively.
   */
  removeEntity(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Recursively remove children first
    for (const childId of [...entity.childIds]) {
      this.removeEntity(childId);
    }

    // Detach from parent
    if (entity.parentId) {
      const parent = this.entities.get(entity.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter(cid => cid !== id);
        parent.updatedAt = Date.now();
      }
    } else {
      this.rootIds.delete(id);
    }

    this.entities.delete(id);
    this._emitDiff({ entityId: id, changes: {}, type: 'remove' });
    return true;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getEntity(id: string): SceneEntity | null {
    return this.entities.get(id) || null;
  }

  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }

  getChildren(id: string): SceneEntity[] {
    const entity = this.entities.get(id);
    if (!entity) return [];
    return entity.childIds
      .map(cid => this.entities.get(cid))
      .filter(Boolean) as SceneEntity[];
  }

  getRootEntities(): SceneEntity[] {
    return Array.from(this.rootIds)
      .map(id => this.entities.get(id))
      .filter(Boolean) as SceneEntity[];
  }

  getEntitiesByType(type: EntityType): SceneEntity[] {
    return Array.from(this.entities.values()).filter(e => e.type === type);
  }

  getEntitiesByTag(tag: string): SceneEntity[] {
    return Array.from(this.entities.values()).filter(e => e.tags.includes(tag));
  }

  getAllEntities(): SceneEntity[] {
    return Array.from(this.entities.values());
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Get entities sorted by zIndex for draw-order rendering.
   */
  getDrawOrder(): SceneEntity[] {
    return Array.from(this.entities.values())
      .filter(e => e.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  // ── Batch Operations ────────────────────────────────────────────────────

  /**
   * Begin a batch operation. Diffs are collected but not emitted
   * until `endBatch()` is called. Supports nesting.
   */
  beginBatch(): void {
    this.batchDepth++;
  }

  /**
   * End a batch operation and flush all collected diffs.
   */
  endBatch(): void {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth === 0 && this.pendingDiffs.length > 0) {
      const diffs = [...this.pendingDiffs];
      this.pendingDiffs = [];
      for (const listener of this.listeners) {
        listener(diffs);
      }
    }
  }

  // ── Snapshot / Restore ──────────────────────────────────────────────────

  /**
   * Capture a serializable snapshot of the entire graph.
   */
  captureSnapshot(stepIndex: number = 0): SceneGraphSnapshot {
    const entities: Record<string, SceneEntity> = {};
    for (const [id, entity] of this.entities) {
      entities[id] = {
        ...entity,
        transform: { ...entity.transform },
        style: { ...entity.style },
        data: JSON.parse(JSON.stringify(entity.data)),
        childIds: [...entity.childIds],
        tags: [...entity.tags],
      };
    }
    return {
      entities,
      rootIds: Array.from(this.rootIds),
      timestamp: Date.now(),
      stepIndex,
    };
  }

  /**
   * Restore a previously captured snapshot, replacing the current graph.
   */
  restoreSnapshot(snapshot: SceneGraphSnapshot): void {
    this.beginBatch();

    // Remove all current entities
    for (const id of this.entities.keys()) {
      this._emitDiff({ entityId: id, changes: {}, type: 'remove' });
    }

    this.entities.clear();
    this.rootIds.clear();

    // Recreate from snapshot
    for (const [id, entity] of Object.entries(snapshot.entities)) {
      this.entities.set(id, {
        ...entity,
        transform: { ...entity.transform },
        style: { ...entity.style },
        data: JSON.parse(JSON.stringify(entity.data)),
        childIds: [...entity.childIds],
        tags: [...entity.tags],
      });
      this._emitDiff({ entityId: id, changes: { ...entity }, type: 'create' });
    }

    this.rootIds = new Set(snapshot.rootIds);

    this.endBatch();
  }

  // ── Clear ───────────────────────────────────────────────────────────────

  /**
   * Remove all entities from the graph.
   */
  clear(): void {
    this.beginBatch();
    for (const id of [...this.entities.keys()]) {
      this.removeEntity(id);
    }
    this.endBatch();
  }

  // ── Event System ────────────────────────────────────────────────────────

  /**
   * Subscribe to diff updates. Returns an unsubscribe function.
   */
  onDiff(listener: (diffs: EntityDiff[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private _emitDiff(diff: EntityDiff): void {
    if (this.batchDepth > 0) {
      this.pendingDiffs.push(diff);
    } else {
      for (const listener of this.listeners) {
        listener([diff]);
      }
    }
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  /**
   * Tag all entities belonging to a specific step for easy cleanup.
   */
  tagStep(stepIndex: number, entityIds: string[]): void {
    const tag = `step-${stepIndex}`;
    this.beginBatch();
    for (const id of entityIds) {
      const entity = this.entities.get(id);
      if (entity && !entity.tags.includes(tag)) {
        entity.tags.push(tag);
        entity.updatedAt = Date.now();
        this._emitDiff({ entityId: id, changes: { tags: entity.tags }, type: 'update' });
      }
    }
    this.endBatch();
  }

  /**
   * Remove all entities tagged with a specific step.
   */
  clearStep(stepIndex: number): void {
    const tag = `step-${stepIndex}`;
    const toRemove = this.getEntitiesByTag(tag).map(e => e.id);
    this.beginBatch();
    for (const id of toRemove) {
      this.removeEntity(id);
    }
    this.endBatch();
  }
}
