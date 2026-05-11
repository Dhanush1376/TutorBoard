import { childLogger } from './logger.js';
import { lifecycle } from './lifecycle.js';
import { runtimeState, SubsystemStatus as StateStatus } from './runtimeState.js';
import { eventBus, RUNTIME_EVENTS } from './eventBus.js';
import { startupManager, StartupPhase } from './startupManager.js';

const log = childLogger({ subsystem: 'kernel' });

export type SubsystemStatus = 'PENDING' | 'INITIALIZING' | 'READY' | 'DEGRADED' | 'FAILED' | 'DISABLED';

/**
 * InfrastructureDriver Contract — Every subsystem must adhere to this
 * to be managed by the Runtime Kernel.
 */
export interface InfrastructureDriver {
  name: string;
  description: string;
  priority: number; 
  critical: boolean;
  dependencies: string[];
  init: () => Promise<void>;
  shutdown: () => Promise<void>;
  checkHealth: () => Promise<{ status: SubsystemStatus; details?: string }>;
}

/**
 * Runtime Kernel — The central "nervous system" of the TutorBoard backend.
 * Features:
 * - Topological dependency resolution
 * - Ownership enforcement (Drivers cannot self-register)
 * - Event-driven capability propagation
 * - Cascading lifecycle management
 */
class Kernel {
  private static instance: Kernel;
  private drivers: Map<string, InfrastructureDriver> = new Map();
  private status: Map<string, SubsystemStatus> = new Map();
  private initialized = false;

  private constructor() {
    log.info('Runtime Kernel initialized. Centralizing subsystem ownership.');
  }

  public static getInstance(): Kernel {
    if (!Kernel.instance) {
      Kernel.instance = new Kernel();
    }
    return Kernel.instance;
  }

  /**
   * Register an infrastructure driver. 
   * KERNEL-OWNERSHIP: Only the kernel should handle registration.
   */
  public registerDriver(driver: InfrastructureDriver) {
    if (this.initialized) {
      throw new Error(`Cannot register driver ${driver.name} after kernel bootstrap`);
    }
    
    if (this.drivers.has(driver.name)) {
      log.warn(`Driver ${driver.name} is already registered. Skipping duplicate.`);
      return;
    }

    this.drivers.set(driver.name, driver);
    this.status.set(driver.name, 'PENDING');
    
    // Register with legacy lifecycle for backward compatibility
    lifecycle.registerSubsystem(driver.name, {
      description: driver.description,
      dependencies: driver.dependencies
    });
    
    log.debug(`Kernel registered driver: ${driver.name}`);
  }

  /**
   * Main Boot Sequence with Topological Ordering
   */
  public async boot() {
    if (this.initialized) return;
    
    log.info('Kernel Boot Sequence Initiated (Event-Driven Mode)');
    eventBus.notify(RUNTIME_EVENTS.BOOTSTRAP_STARTED);

    // 1. Resolve Dependencies (Topological Sort)
    const sortedDrivers = this.topologicalSort(Array.from(this.drivers.values()));
    log.info(`Resolved bootstrap order: ${sortedDrivers.map(d => d.name).join(' -> ')}`);

    // 2. Convert to StartupPhases
    const phases: StartupPhase[] = sortedDrivers.map(driver => ({
      name: driver.name,
      critical: driver.critical,
      dependencies: driver.dependencies,
      run: async () => {
        this.status.set(driver.name, 'INITIALIZING');
        try {
          log.info(`Kernel: Initializing ${driver.name}...`);
          await driver.init();
          
          const health = await driver.checkHealth();
          this.updateSubsystemState(driver.name, health.status, health.details);
          
          // Register cleanup hook
          runtimeState.registerCleanup(driver.name, () => driver.shutdown());
          
          log.info(`Kernel: Subsystem ${driver.name} reached status ${health.status}`);
        } catch (err: any) {
          log.error(`Kernel: Subsystem ${driver.name} failed during initialization: ${err.message}`);
          this.updateSubsystemState(driver.name, 'FAILED', err.message);
          if (driver.critical) throw err;
        }
      }
    }));

    // 3. Execute via StartupManager
    await startupManager.run(phases);

    this.initialized = true;
    eventBus.notify(RUNTIME_EVENTS.BOOTSTRAP_COMPLETED);
    log.info('Kernel: Boot Sequence Completed Successfully.');
  }

  /**
   * Topological Sort implementation to resolve dependency order
   */
  private topologicalSort(drivers: InfrastructureDriver[]): InfrastructureDriver[] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const result: InfrastructureDriver[] = [];

    const visit = (driver: InfrastructureDriver) => {
      if (stack.has(driver.name)) {
        throw new Error(`Circular dependency detected in kernel drivers: ${driver.name}`);
      }
      if (visited.has(driver.name)) return;

      stack.add(driver.name);

      // Visit dependencies first
      driver.dependencies.forEach(depName => {
        const depDriver = this.drivers.get(depName);
        if (depDriver) {
          visit(depDriver);
        } else {
          log.warn(`Driver ${driver.name} has missing dependency: ${depName}`);
        }
      });

      stack.delete(driver.name);
      visited.add(driver.name);
      result.push(driver);
    };

    // Sort by priority first to handle cases where there are no dependencies
    const sortedByPriority = [...drivers].sort((a, b) => a.priority - b.priority);
    sortedByPriority.forEach(d => visit(d));

    return result;
  }

  /**
   * Update state and propagate capability changes via EventBus
   */
  private updateSubsystemState(name: string, status: SubsystemStatus, details?: string) {
    this.status.set(name, status);
    const driver = this.drivers.get(name);
    
    const cap = {
      name,
      mode: status === 'DISABLED' ? 'DISABLED' : (status === 'READY' || status === 'DEGRADED' ? 'REAL' : 'MOCKED'),
      status: status === 'READY' ? 'healthy' : (status === 'DEGRADED' ? 'degraded' : 'unhealthy'),
      ready: status === 'READY' || (status === 'DEGRADED' && !driver?.critical),
      details: details || `Status: ${status}`,
      dependencies: driver?.dependencies || [],
      timestamp: new Date().toISOString()
    };

    // Update Central Capability Engine (runtimeState)
    runtimeState.setCapability(cap as any);
    
    // Emit Structured Events for Reactive Subsystems
    if (status === 'READY') {
      eventBus.notify(RUNTIME_EVENTS.INFRA_CONNECTED, { name, mode: cap.mode });
    } else if (status === 'DEGRADED') {
      eventBus.notify(RUNTIME_EVENTS.INFRA_DEGRADED, { name, details });
    } else if (status === 'FAILED') {
      eventBus.notify(RUNTIME_EVENTS.INFRA_DISCONNECTED, { name, details });
    }

    eventBus.notify(RUNTIME_EVENTS.CAPABILITY_CHANGED, { 
      name, 
      status, 
      ready: cap.ready,
      mode: cap.mode 
    });
  }

  public getStatus(name: string): SubsystemStatus {
    return this.status.get(name) || 'PENDING';
  }
}

export const kernel = Kernel.getInstance();
