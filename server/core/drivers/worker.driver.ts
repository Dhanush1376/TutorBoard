import { InfrastructureDriver, SubsystemStatus } from '../kernel.js';
import { workerManager } from '../../services/workers/worker.manager.js';
import { runtimeState } from '../runtimeState.js';

export class WorkerDriver implements InfrastructureDriver {
  public name = 'workers';
  public description = 'Background worker orchestration and execution';
  public priority = 100; // Load last
  public critical = false;
  public dependencies = ['queues', 'mongodb'];

  async init(): Promise<void> {
    // ISSUE #1: Slow startup optimization. 
    // We call start() and let it handle its own internal concurrency.
    await workerManager.start();
  }

  async shutdown(): Promise<void> {
    await workerManager.stop();
  }

  async checkHealth(): Promise<{ status: SubsystemStatus; details?: string }> {
    const cap = runtimeState.getCapability('workers');
    if (!cap) return { status: 'PENDING' };

    const statusMap: Record<string, SubsystemStatus> = {
      healthy: 'READY',
      degraded: 'DEGRADED',
      unhealthy: 'FAILED'
    };

    return { 
      status: statusMap[cap.status] || 'FAILED', 
      details: cap.details 
    };
  }
}
