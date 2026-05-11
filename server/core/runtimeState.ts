import { EventEmitter } from 'events';

export type RuntimeMode = 'REAL' | 'MOCKED' | 'DISABLED' | 'DEGRADED' | 'OFFLINE';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'disabled';

export interface RuntimeCapability {
  name: string;
  mode: RuntimeMode;
  status: HealthStatus;
  ready: boolean;
  details?: string;
  dependencies?: string[];
  updatedAt: string;
}

class RuntimeStateManager extends EventEmitter {
  private capabilities = new Map<string, RuntimeCapability>();
  private cleanupHooks: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private lifecycleState: string = 'INITIALIZING';

  setLifecycleState(state: string) {
    this.lifecycleState = state;
    this.emit('lifecycleChanged', state);
  }

  getLifecycleState() {
    return this.lifecycleState;
  }

  setCapability(input: Omit<RuntimeCapability, 'updatedAt'>) {
    const capability: RuntimeCapability = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    
    const previous = this.capabilities.get(input.name);
    this.capabilities.set(input.name, capability);

    // Only emit if something actually changed to prevent loops
    if (!previous || previous.ready !== capability.ready || previous.status !== capability.status || previous.mode !== capability.mode) {
      this.emit('capabilityChanged', capability);
      this.emit(`capability:${input.name}`, capability);
    }
  }

  getCapability(name: string) {
    return this.capabilities.get(name) || null;
  }

  listCapabilities() {
    return Array.from(this.capabilities.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  isReady(required: string[]) {
    return required.every((name) => this.capabilities.get(name)?.ready);
  }

  /**
   * Topological Health Scoring — Calculates a weighted stability score for the entire system.
   */
  getHealthScore() {
    const caps = Array.from(this.capabilities.values());
    if (caps.length === 0) return 100; // Assume perfect if nothing registered yet

    // Criticality Weights
    const weights: Record<string, number> = {
      mongodb: 30,
      redis: 30,
      postgres: 15,
      queues: 15,
      workers: 10
    };

    let totalWeight = 0;
    let earnedWeight = 0;

    caps.forEach(cap => {
      const weight = weights[cap.name] || 5;
      totalWeight += weight;

      if (cap.status === 'healthy') {
        earnedWeight += weight;
      } else if (cap.status === 'degraded') {
        earnedWeight += (weight * 0.5);
      }
    });

    return Math.round((earnedWeight / totalWeight) * 100);
  }

  getStabilityReport() {
    const score = this.getHealthScore();
    let status: 'STABLE' | 'DEGRADED' | 'UNSTABLE' | 'FAILED' = 'STABLE';
    
    if (score < 30) status = 'FAILED';
    else if (score < 60) status = 'UNSTABLE';
    else if (score < 90) status = 'DEGRADED';

    return {
      score,
      status,
      activeCapabilities: this.capabilities.size,
      unhealthy: Array.from(this.capabilities.values())
        .filter(c => c.status === 'unhealthy')
        .map(c => c.name),
      timestamp: new Date().toISOString()
    };
  }

  registerCleanup(name: string, fn: () => Promise<void> | void) {
    this.cleanupHooks = this.cleanupHooks.filter((hook) => hook.name !== name);
    this.cleanupHooks.push({ name, fn });
  }

  async cleanup(reverse = true) {
    const hooks = reverse ? [...this.cleanupHooks].reverse() : [...this.cleanupHooks];
    console.log(`[RuntimeState] Starting cleanup of ${hooks.length} hooks...`);
    const results = [];
    for (const hook of hooks) {
      try {
        console.log(`[RuntimeState] Executing cleanup hook: ${hook.name}`);
        await hook.fn();
        console.log(`[RuntimeState] Cleanup hook ${hook.name} completed.`);
        results.push({ name: hook.name, ok: true });
      } catch (err: any) {
        console.error(`[RuntimeState] Cleanup hook ${hook.name} failed:`, err.message);
        results.push({ name: hook.name, ok: false, error: err.message });
      }
    }
    console.log('[RuntimeState] Cleanup finished.');
    return results;
  }
}

export const runtimeState = new RuntimeStateManager();
