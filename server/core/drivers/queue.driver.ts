import { InfrastructureDriver, SubsystemStatus } from '../kernel.js';
import { queueService } from '../../services/queue/queue.service.js';
import { container } from '../container.js';

export class QueueDriver implements InfrastructureDriver {
  public name = 'queues';
  public description = 'Distributed job processing and background tasks (BullMQ)';
  public priority = 40;
  public critical = true;
  public dependencies = ['redis'];

  async init(): Promise<void> {
    // KERNEL-02: Explicitly activate the service only when the driver is initialized by the kernel.
    await queueService.activate();
  }

  async shutdown(): Promise<void> {
    // Handled by lifecycle/runtimeState cleanup registered in queue.service.ts
  }

  async checkHealth(): Promise<{ status: SubsystemStatus; details?: string }> {
    if (!container.has('redis-main')) {
      return { status: 'DEGRADED', details: 'Running in DEGRADED mode (No Redis)' };
    }

    try {
      const health = await queueService.checkHealth();
      return { 
        status: health.status === 'online' ? 'READY' : 'DEGRADED', 
        details: `Active Queues: ${Object.keys(health.queues).length}` 
      };
    } catch (err: any) {
      return { status: 'FAILED', details: err.message };
    }
  }
}
