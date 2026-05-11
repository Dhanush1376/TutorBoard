import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { container } from '../../core/container.js';
import { runtimeState } from '../../core/runtimeState.js';
import { childLogger } from '../../core/logger.js';
import { lifecycle } from '../../core/lifecycle.js';

const log = childLogger({ subsystem: 'queue' });

// Queue Names
export const QUEUES = {
  AGENT_TASKS: 'agent-tasks',
  EMBEDDINGS: 'embedding-generation',
  NOTIFICATIONS: 'notifications',
  DOCUMENTS: 'document-processing'
};

export interface AgentJobData {
  type: 'planning' | 'narration' | 'visualization' | 'critique';
  sessionId: string;
  requestId: string;
  payload: any;
  tokenBudget?: number;
}

export interface EmbeddingJobData {
  type: 'session' | 'artifact' | 'source';
  id: string;
  content: string;
  metadata: any;
}

export interface NotificationJobData {
  type: 'email' | 'push';
  userId: string;
  template: string;
  data: any;
}

import { container } from '../../core/container.js';

/**
 * Production-ready Queue Service
 * Handles multiple job types and provides a centralized interface for task enqueuing.
 */
class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  constructor() {
    // KERNEL-01: Removed auto-init to prevent registration races.
    // Initialization is now managed explicitly by the QueueDriver.
  }

  public async activate() {
    // VIRTUALIZATION: Resolve the kernel-managed connection
    const connection = container.resolve<any>('redis-main');
    
    if (!connection) {
      log.warn('Redis connection not available in container. Queue service will operate in DEGRADED mode.');
      runtimeState.setCapability({
        name: 'queues',
        mode: 'MOCKED',
        status: 'degraded',
        ready: true,
        details: 'No Redis connection — tasks will be ignored or processed immediately (if configured)',
      });
      return;
    }

    const queueOpts: QueueOptions = {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      }
    };

    // Initialize core queues using virtualized connection
    Object.values(QUEUES).forEach(name => {
      this.queues.set(name, new Queue(name, queueOpts));
    });

    runtimeState.setCapability({
      name: 'queues',
      mode: 'REAL',
      status: 'healthy',
      ready: true,
      dependencies: ['redis'],
      details: `${this.queues.size} BullMQ queues initialized`,
    });

    // Register health monitor task
    const monitorId = `queue-health-monitor`;
    const monitorSignal = lifecycle.registerAsyncTask({
      id: monitorId,
      subsystem: 'queues',
      description: 'Queue job count and health monitor',
      metadata: { lastCheck: null }
    });

    const monitor = async () => {
      while (!monitorSignal.aborted) {
        try {
          const health = await this.checkHealth();
          lifecycle.updateTaskMetadata(monitorId, { 
            lastCheck: new Date().toISOString(),
            status: health.status,
            counts: health.queues
          });
        } catch (err) {
          log.warn('Queue health monitor check failed');
        }
        
        await new Promise(resolve => {
          const t = setTimeout(resolve, 60000);
          monitorSignal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve(true);
          }, { once: true });
        });
      }
    };
    monitor();

    runtimeState.registerCleanup('queues', () => this.cleanup());
  }

  /**
   * Enqueue a task to a specific queue
   */
  async add(queueName: string, name: string, data: any, opts: any = {}): Promise<any> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      if (!container.has('redis-main')) {
        log.warn(`[Mock] Queue ${queueName} not available. Skipping task: ${name}`);
        return { id: 'mock-id' };
      }
      throw new Error(`Queue ${queueName} not initialized`);
    }

    try {
      return await queue.add(name, data, opts);
    } catch (err: any) {
      log.error(`Failed to enqueue task ${name} to ${queueName}:`, err);
      throw err;
    }
  }

  // --- Specialized Helpers ---

  async enqueueAgentTask(data: AgentJobData) {
    return this.add(QUEUES.AGENT_TASKS, `${data.type}:${data.requestId}`, data, {
      jobId: `${data.type}:${data.requestId}`,
      priority: data.type === 'planning' ? 1 : 5
    });
  }

  async enqueueEmbedding(data: EmbeddingJobData) {
    return this.add(QUEUES.EMBEDDINGS, `embed:${data.type}:${data.id}`, data, {
      jobId: `embed:${data.type}:${data.id}`,
      removeOnComplete: true
    });
  }

  async enqueueNotification(data: NotificationJobData) {
    return this.add(QUEUES.NOTIFICATIONS, `notif:${data.type}:${data.userId}`, data);
  }

  /**
   * Start a worker for a specific queue
   */
  startWorker(queueName: string, processor: (job: Job) => Promise<any>, options: Partial<WorkerOptions> = {}): Worker {
    // VIRTUALIZATION: Use the same kernel-managed connection
    const connection = container.resolve<any>('redis-main');
    
    if (!connection) {
      log.warn(`Cannot start real worker for ${queueName} without virtualized Redis connection.`);
      return null as any;
    }

    const worker = new Worker(queueName, processor, {
      ...options,
      connection,
      concurrency: options.concurrency && options.concurrency > 0 ? options.concurrency : 5,
    });

    worker.on('completed', (job) => log.debug(`Job ${job.id} in ${queueName} completed`));
    worker.on('failed', (job, err) => {
      log.error(`Job ${job?.id || 'unknown'} in ${queueName} failed: ${err.message}`, { 
        error: err.message, 
        stack: err.stack,
        jobId: job?.id 
      });
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  async pauseWorker(queueName: string) {
    const worker = this.workers.get(queueName);
    if (worker && !worker.isPaused()) {
      log.info(`Pausing worker for queue: ${queueName}`);
      await worker.pause();
    }
  }

  async resumeWorker(queueName: string) {
    const worker = this.workers.get(queueName);
    if (worker && worker.isPaused()) {
      log.info(`Resuming worker for queue: ${queueName}`);
      await worker.resume();
    }
  }

  async checkHealth() {
    const health: any = { status: 'online', queues: {} };
    for (const [name, queue] of this.queues.entries()) {
      try {
        health.queues[name] = await queue.getJobCounts();
      } catch (err: any) {
        health.queues[name] = { error: err.message };
        health.status = 'degraded';
      }
    }
    return health;
  }

  private async cleanup() {
    log.info('Cleaning up Queue connections...');
    await Promise.allSettled([
      ...Array.from(this.queues.values()).map(q => q.close()),
      ...Array.from(this.workers.values()).map(w => w.close())
    ]);
  }
}

export const queueService = new QueueService();
