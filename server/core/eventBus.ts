import { EventEmitter } from 'events';

/**
 * EventBus — Centralized internal communication hub for runtime orchestration.
 * Enables decoupling between subsystems (e.g., Workers responding to Postgres degradation).
 */
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Emit an orchestration event with consistent structure
   */
  public notify(event: string, payload: any = {}) {
    this.emit(event, {
      timestamp: new Date().toISOString(),
      ...payload
    });
  }
}

export const eventBus = EventBus.getInstance();

// Core Orchestration Events
export const RUNTIME_EVENTS = {
  // Lifecycle
  BOOTSTRAP_STARTED: 'runtime:bootstrap:started',
  BOOTSTRAP_COMPLETED: 'runtime:bootstrap:completed',
  SHUTDOWN_STARTED: 'runtime:shutdown:started',
  
  // Infrastructure
  INFRA_CONNECTED: 'infra:connected',
  INFRA_DISCONNECTED: 'infra:disconnected',
  INFRA_DEGRADED: 'infra:degraded',
  INFRA_RECOVERED: 'infra:recovered',
  
  // Capabilities
  CAPABILITY_CHANGED: 'capability:changed',
  
  // Workers
  WORKER_STARTED: 'worker:started',
  WORKER_PAUSED: 'worker:paused',
  WORKER_RESUMED: 'worker:resumed',
  WORKER_ERROR: 'worker:error'
};
