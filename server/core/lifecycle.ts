import { childLogger } from './logger.js';
import { runtimeState } from './runtimeState.js';

export enum LifecycleState {
  INITIALIZING = 'INITIALIZING',
  STARTING = 'STARTING',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
  RECOVERING = 'RECOVERING',
  SHUTTING_DOWN = 'SHUTTING_DOWN',
  TERMINATED = 'TERMINATED',
}

export interface AsyncTask {
  id: string;
  subsystem: string;
  description: string;
  startTime: Date;
  status: 'RUNNING' | 'CANCELLED' | 'ERROR' | 'COMPLETED';
  abortController: AbortController;
  retryCount: number;
  parentTaskId?: string;
  metadata?: Record<string, any>;
}

export interface SubsystemInfo {
  name: string;
  description: string;
  tasks: string[]; // Task IDs
  dependencies: string[];
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'OFFLINE';
}

const log = childLogger({ subsystem: 'lifecycle' });

/**
 * LifecycleManager — The central authority for process state and runtime orchestration.
 * Inspired by Erlang/OTP supervision and Kubernetes-style lifecycle ownership.
 */
class LifecycleManager {
  private state: LifecycleState = LifecycleState.INITIALIZING;
  private abortController = new AbortController();
  private pid = process.pid;
  private tasks = new Map<string, AsyncTask>();
  private subsystems = new Map<string, SubsystemInfo>();
  private startupTime = new Date();

  constructor() {
    log.info(`Runtime Orchestrator v3.0 initialized [PID: ${this.pid}]`);
    
    // Register global cleanup for the registry itself
    runtimeState.registerCleanup('lifecycle-registry', async () => {
      this.cancelAllTasks('Global shutdown');
    });

    // Handle process signals
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  public getState() {
    return this.state;
  }

  public get signal() {
    return this.abortController.signal;
  }

  public isShuttingDown() {
    return this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.TERMINATED;
  }

  /**
   * Registers a subsystem with the manager for supervision.
   */
  public registerSubsystem(name: string, info: Omit<SubsystemInfo, 'name' | 'tasks' | 'status'>) {
    this.subsystems.set(name, {
      name,
      tasks: [],
      status: 'OFFLINE',
      ...info
    });
    log.debug(`Subsystem registered: ${name}`);
  }

  public transition(newState: LifecycleState) {
    if (this.isShuttingDown() && newState !== LifecycleState.TERMINATED) return;
    
    const oldState = this.state;
    this.state = newState;
    
    log.info(`Runtime transition: ${oldState} -> ${newState} [PID: ${this.pid}]`, {
      pid: this.pid,
      oldState,
      newState
    });

    if (newState === LifecycleState.READY) {
      this.logTaskReport();
    }
  }

  /**
   * Registers a long-running background task with the lifecycle manager.
   * Enables parent-child cancellation propagation and runtime observability.
   */
  public registerAsyncTask(params: {
    id: string;
    subsystem: string;
    description: string;
    parentTaskId?: string;
    metadata?: Record<string, any>;
    onCancel?: () => void;
  }): AbortSignal {
    const taskController = new AbortController();
    
    // Parent-child cancellation propagation
    if (params.parentTaskId) {
      const parent = this.tasks.get(params.parentTaskId);
      if (parent) {
        parent.abortController.signal.addEventListener('abort', () => {
          if (taskController.signal.aborted) return;
          log.debug(`Task ${params.id} cancelled by parent ${params.parentTaskId}`);
          taskController.abort();
        });
      }
    }

    // Global cancellation propagation
    this.signal.addEventListener('abort', () => {
      if (!taskController.signal.aborted) taskController.abort();
    });

    const task: AsyncTask = {
      id: params.id,
      subsystem: params.subsystem,
      description: params.description,
      startTime: new Date(),
      status: 'RUNNING',
      abortController: taskController,
      retryCount: 0,
      parentTaskId: params.parentTaskId,
      metadata: params.metadata
    };

    if (params.onCancel) {
      taskController.signal.addEventListener('abort', params.onCancel);
    }

    this.tasks.set(params.id, task);
    
    // Link to subsystem
    const sub = this.subsystems.get(params.subsystem);
    if (sub) {
      sub.tasks.push(params.id);
    }
    
    log.debug(`Task registered: ${params.id} (${params.subsystem})`, { 
      taskId: params.id, 
      parent: params.parentTaskId 
    });
    
    return taskController.signal;
  }

  public completeTask(id: string, status: 'COMPLETED' | 'ERROR' = 'COMPLETED') {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      // Remove from map
      this.tasks.delete(id);
      
      // Remove from subsystem
      const sub = this.subsystems.get(task.subsystem);
      if (sub) {
        sub.tasks = sub.tasks.filter(tid => tid !== id);
      }
    }
  }

  public updateTaskMetadata(id: string, metadata: Record<string, any>) {
    const task = this.tasks.get(id);
    if (task) {
      task.metadata = { ...task.metadata, ...metadata };
    }
  }

  public cancelAllTasks(reason: string) {
    log.info(`Cancelling all background tasks: ${reason} (Count: ${this.tasks.size})`);
    for (const [id, task] of Array.from(this.tasks.entries())) {
      if (task.status === 'RUNNING') {
        task.status = 'CANCELLED';
        task.abortController.abort();
      }
    }
  }

  public getTaskReport() {
    return Array.from(this.tasks.values()).map(t => ({
      id: t.id,
      subsystem: t.subsystem,
      description: t.description,
      age: Date.now() - t.startTime.getTime(),
      status: t.status,
      parent: t.parentTaskId,
      metadata: t.metadata
    }));
  }

  public logTaskReport() {
    const report = this.getTaskReport();
    if (report.length === 0) {
      log.info('Task Registry: No active background tasks.');
      return;
    }

    log.info(`Task Registry: ${report.length} active tasks`);
    
    // Group by subsystem
    const grouped = new Map<string, typeof report>();
    report.forEach(t => {
      const list = grouped.get(t.subsystem) || [];
      list.push(t);
      grouped.set(t.subsystem, list);
    });

    grouped.forEach((tasks, subsystem) => {
      log.info(`  [${subsystem}]`);
      tasks.forEach(t => {
        const parentInfo = t.parent ? ` (parent: ${t.parent})` : '';
        const meta = t.metadata ? ` [${JSON.stringify(t.metadata)}]` : '';
        log.info(`    - ${t.id}: ${t.description}${parentInfo}${meta} (age: ${Math.round(t.age/1000)}s)`);
      });
    });
  }

  /**
   * Initiates graceful shutdown sequence.
   */
  public async shutdown(signalName: string) {
    if (this.isShuttingDown()) return;

    this.transition(LifecycleState.SHUTTING_DOWN);
    log.info(`Graceful shutdown initiated by ${signalName}`);
    
    // 1. Abort all cancellable operations
    this.abortController.abort();
    this.cancelAllTasks(`Shutdown (${signalName})`);

    // 2. Execute registered cleanup hooks
    try {
      await runtimeState.cleanup();
      log.info('Centralized cleanup hooks completed');
    } catch (err: any) {
      log.error(`Cleanup failure: ${err.message}`);
    }

    this.transition(LifecycleState.TERMINATED);
    log.info(`Runtime TERMINATED [PID: ${this.pid}]`);
    
    // Force exit after a safety timeout if not already finished
    setTimeout(() => {
      log.warn('Shutdown hung, forcing exit.');
      process.exit(1);
    }, 10000).unref();
    
    if (signalName !== 'API') {
      process.exit(0);
    }
  }
}

export const lifecycle = new LifecycleManager();
export default lifecycle;
