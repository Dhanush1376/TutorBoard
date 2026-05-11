import { runtimeState, RuntimeCapability } from './runtimeState.js';
import { eventBus, RUNTIME_EVENTS } from './eventBus.js';
import { childLogger } from './logger.js';

const log = childLogger({ subsystem: 'capability-engine' });

/**
 * Capability Engine — Manages the live runtime dependency graph.
 * Features:
 * - Event-driven state propagation
 * - Dependency-aware health scoring
 * - Automatic degradation of dependent subsystems
 */
class CapabilityEngine {
  private static instance: CapabilityEngine;

  private constructor() {
    log.info('Capability Engine active. Monitoring infrastructure state graph.');
    
    // Subscribe to raw capability changes to calculate propagation
    runtimeState.on('capabilityChanged', (cap) => this.handleStateChange(cap));
  }

  public static getInstance(): CapabilityEngine {
    if (!CapabilityEngine.instance) {
      CapabilityEngine.instance = new CapabilityEngine();
    }
    return CapabilityEngine.instance;
  }

  /**
   * React to state changes and propagate degradation down the graph
   */
  private handleStateChange(cap: RuntimeCapability) {
    log.debug(`State change detected: ${cap.name} is now ${cap.status} (${cap.mode})`);

    // 1. Find all subsystems that depend on this one
    const allCaps = runtimeState.listCapabilities();
    const dependents = allCaps.filter(c => c.dependencies?.includes(cap.name));

    for (const dependent of dependents) {
      this.evaluatePropagation(dependent, cap);
    }
  }

  /**
   * Calculate if degradation should propagate to a dependent subsystem
   */
  private evaluatePropagation(dependent: RuntimeCapability, upstream: RuntimeCapability) {
    if (upstream.status === 'unhealthy' || !upstream.ready) {
      log.warn(`Propagating DEGRADATION: Upstream ${upstream.name} is ${upstream.status}. Impacting ${dependent.name}.`);
      
      // If a critical dependency is lost, the dependent might need to degrade
      if (dependent.status === 'healthy') {
        runtimeState.setCapability({
          ...dependent,
          status: 'degraded',
          ready: true, // Still "ready" but in degraded mode
          details: `${dependent.details} | DEGRADED: Dependency ${upstream.name} is ${upstream.status}`
        });
        
        eventBus.notify(RUNTIME_EVENTS.INFRA_DEGRADED, { 
          name: dependent.name, 
          reason: `Upstream dependency ${upstream.name} failure` 
        });
      }
    } else if (upstream.status === 'healthy' && dependent.status === 'degraded') {
      // Check if ALL dependencies are now healthy to recover
      const allReady = dependent.dependencies?.every(depName => {
        const d = runtimeState.getCapability(depName);
        return d && d.ready && d.status === 'healthy';
      });

      if (allReady) {
        log.info(`Propagating RECOVERY: All dependencies for ${dependent.name} are now healthy.`);
        runtimeState.setCapability({
          ...dependent,
          status: 'healthy',
          details: dependent.details?.split(' | DEGRADED')[0] || 'Recovered'
        });
        
        eventBus.notify(RUNTIME_EVENTS.INFRA_RECOVERED, { name: dependent.name });
      }
    }
  }

  /**
   * Get a snapshot of the live capability graph
   */
  public getGraph() {
    return runtimeState.listCapabilities().map(c => ({
      id: c.name,
      status: c.status,
      mode: c.mode,
      ready: c.ready,
      dependencies: c.dependencies || []
    }));
  }
}

export const capabilityEngine = CapabilityEngine.getInstance();
