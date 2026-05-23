import { childLogger } from './logger.js';

const log = childLogger({ subsystem: 'container' });

/**
 * ResourceContainer — Centralized Infrastructure Registry.
 * Enforces Kernel ownership of all infrastructure clients.
 * Subsystems must RESOLVE resources rather than instantiating them.
 */
class ResourceContainer {
  private static instance: ResourceContainer;
  private resources: Map<string, any> = new Map();

  private constructor() {
    log.info('Infrastructure Resource Container initialized.');
  }

  public static getInstance(): ResourceContainer {
    if (!ResourceContainer.instance) {
      ResourceContainer.instance = new ResourceContainer();
    }
    return ResourceContainer.instance;
  }

  /**
   * Register a managed infrastructure resource
   */
  public register<T>(name: string, resource: T) {
    this.resources.set(name, resource);
    log.debug(`Resource registered: ${name}`);
  }

  /**
   * Resolve a managed resource. 
   * VIRTUALIZATION: This allows us to intercept and proxy resource access.
   */
  public resolve<T>(name: string): T {
    if (!this.resources.has(name)) {
      // LOG-INTEGRITY: Detect unmanaged access attempts
      log.error(`ROGUE ACCESS DETECTED: Attempted to resolve unmanaged resource: ${name}`);
      throw new Error(`Infrastructure Resource [${name}] not found in container. This indicates a rogue dependency bypass.`);
    }
    return this.resources.get(name) as T;
  }

  public has(name: string): boolean {
    return this.resources.has(name);
  }
}

export const container = ResourceContainer.getInstance();
