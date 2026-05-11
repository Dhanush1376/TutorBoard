import { queueService, QUEUES } from '../queue/queue.service.js';
import { container } from '../../core/container.js';
import { childLogger } from '../../core/logger.js';
import { runtimeState } from '../../core/runtimeState.js';
import { lifecycle } from '../../core/lifecycle.js';
import { eventBus, RUNTIME_EVENTS } from '../../core/eventBus.js';

const log = childLogger({ subsystem: 'worker-manager' });

/**
 * WorkerManager — Orchestrates all background worker threads.
 * In production, these may run in separate processes/containers.
 * In development, we run them all in the same process for simplicity.
 */
interface WorkerDefinition {
  queue: string;
  processor: (job: any) => Promise<any>;
  dependencies: string[];
  concurrency?: number;
}

/**
 * WorkerManager — Orchestrates all background worker threads with dependency awareness.
 */
class WorkerManager {
  private started = false;
  private workerDefinitions: WorkerDefinition[] = [];

  constructor() {
    // Infrastructure awareness subscription
    runtimeState.on('capabilityChanged', (cap) => this.handleCapabilityChange(cap));
  }

  private handleCapabilityChange(cap: any) {
    if (!this.started) return;

    this.workerDefinitions.forEach(async (def) => {
      if (def.dependencies.includes(cap.name)) {
        const allReady = def.dependencies.every(dep => {
          const c = runtimeState.getCapability(dep);
          return c && c.ready;
        });

        if (allReady) {
          log.info(`Dependencies for ${def.queue} are healthy. Resuming worker.`);
          await queueService.resumeWorker(def.queue);
          lifecycle.updateTaskMetadata(`worker-${def.queue}`, { status: 'ACTIVE', missingDeps: [] });
        } else {
          const missing = def.dependencies.filter(dep => !runtimeState.getCapability(dep)?.ready);
          log.warn(`Dependency ${cap.name} state changed, but ${def.queue} still has missing dependencies: ${missing.join(', ')}. Ensuring paused.`);
          await queueService.pauseWorker(def.queue);
          lifecycle.updateTaskMetadata(`worker-${def.queue}`, { status: 'PAUSED', missingDeps: missing });
        }
        this.updateWorkerStatus();
      }
    });
  }

  async start(signal?: AbortSignal) {
    if (this.started) return;
    const pid = process.pid;
    
    if (process.env.ENABLE_WORKERS === 'false') {
      log.info(`Workers disabled via ENABLE_WORKERS=false [PID: ${pid}]`);
      return;
    }

    if (signal?.aborted) return;

    const supervisorId = `worker-supervisor-${pid}`;
    const supervisorSignal = lifecycle.registerAsyncTask({
      id: supervisorId,
      subsystem: 'worker-manager',
      description: 'Main Worker Supervisor',
    });

    log.info(`Initializing dependency-aware background workers... [PID: ${pid}]`);

    // 1. Agent Pipeline Worker (Requires Postgres for RAG)
    try {
      const { processAgentJob } = await import('../../workers/pipelineWorker.js');
      this.workerDefinitions.push({
        queue: QUEUES.AGENT_TASKS,
        processor: processAgentJob,
        dependencies: ['postgres', 'mongodb'],
        concurrency: 2
      });
    } catch (err: any) {
      log.error(`Failed to load Agent worker definition [PID: ${pid}]: ${err.message}`);
    }

    // 2. Notification Worker (Requires MongoDB)
    this.workerDefinitions.push({
      queue: QUEUES.NOTIFICATIONS,
      processor: async (job) => {
        log.info(`[NotificationWorker][PID: ${pid}] Processing ${job.name}...`);
        return { success: true };
      },
      dependencies: ['mongodb']
    });

    // Start all workers in parallel to avoid sequential blocking (ISSUE #1)
    await Promise.all(this.workerDefinitions.map(async (def) => {
      const workerTaskId = `worker-${def.queue}`;
      lifecycle.registerAsyncTask({
        id: workerTaskId,
        subsystem: 'worker-manager',
        description: `Worker: ${def.queue}`,
        parentTaskId: supervisorId,
        metadata: { status: 'STARTING' }
      });

      queueService.startWorker(def.queue, def.processor, { concurrency: def.concurrency });
      
      // Initial state check
      const missingDeps = def.dependencies.filter(dep => !runtimeState.getCapability(dep)?.ready);
      if (missingDeps.length > 0) {
        log.warn(`Worker for ${def.queue} starting in PAUSED state due to missing dependencies: ${missingDeps.join(', ')}`);
        await queueService.pauseWorker(def.queue);
        lifecycle.updateTaskMetadata(workerTaskId, { status: 'PAUSED', missingDeps });
      } else {
        lifecycle.updateTaskMetadata(workerTaskId, { status: 'ACTIVE', missingDeps: [] });
      }
    }));

    if (signal?.aborted || supervisorSignal.aborted) return;

    // 3. Managed Worker Heartbeat (Reactive to Redis readiness)
    const heartbeatId = `worker-heartbeat-${pid}`;
    const setupHeartbeat = () => {
      if (lifecycle.getTask(heartbeatId)) return; // Already setup

      const heartbeatSignal = lifecycle.registerAsyncTask({
        id: heartbeatId,
        subsystem: 'worker-manager',
        description: 'Managed worker heartbeat loop',
        parentTaskId: supervisorId
      });

      const heartbeat = async () => {
        log.info(`Worker heartbeat loop starting... [PID: ${pid}]`);
        while (!heartbeatSignal.aborted) {
          try {
            if (container.has('redis-main')) {
              const client = container.resolve('redis-main');
              await client.set(`worker:heartbeat:${pid}`, new Date().toISOString(), 'EX', 60);
              lifecycle.updateTaskMetadata(heartbeatId, { lastHeartbeat: new Date().toISOString(), status: 'HEALTHY' });
            }
          } catch (err) {
            log.warn(`Failed to send worker heartbeat [PID: ${pid}]. Infrastructure may be transiently unavailable.`);
            lifecycle.updateTaskMetadata(heartbeatId, { status: 'DEGRADED' });
          }
          
          await new Promise(resolve => {
            const t = setTimeout(resolve, 30000);
            heartbeatSignal.addEventListener('abort', () => {
              clearTimeout(t);
              resolve(true);
            }, { once: true });
          });
        }
        log.info(`Worker heartbeat loop terminated [PID: ${pid}]`);
      };
      
      heartbeat();
    };

    // If Redis is already ready, start now. Otherwise, wait for event.
    if (runtimeState.getCapability('redis')?.ready) {
      setupHeartbeat();
    } else {
      log.info(`Waiting for Redis to start heartbeat [PID: ${pid}]`);
      eventBus.on(RUNTIME_EVENTS.INFRA_CONNECTED, (payload) => {
        if (payload.name === 'redis') {
          setupHeartbeat();
        }
      });
    }

    // Register cleanup
    runtimeState.registerCleanup('worker-manager', () => this.stop());

    this.started = true;
    this.updateWorkerStatus();
  }

  private updateWorkerStatus() {
    const stats = this.workerDefinitions.map(def => {
      const missing = def.dependencies.filter(dep => !runtimeState.getCapability(dep)?.ready);
      return {
        queue: def.queue,
        status: missing.length > 0 ? 'PAUSED' : 'ACTIVE',
        missingDependencies: missing
      };
    });

    const isHealthy = stats.every(s => s.status === 'ACTIVE');

    runtimeState.setCapability({
      name: 'workers',
      mode: container.has('redis-main') ? 'REAL' : 'MOCKED',
      status: isHealthy ? 'healthy' : (stats.some(s => s.status === 'ACTIVE') ? 'degraded' : 'unhealthy'),
      ready: true,
      details: JSON.stringify(stats),
    });
  }

  async stop() {
    const pid = process.pid;
    log.info(`Stopping all workers... [PID: ${pid}]`);
    this.started = false;
    // Lifecycle handles task cancellation
  }
}

export const workerManager = new WorkerManager();
export default workerManager;
