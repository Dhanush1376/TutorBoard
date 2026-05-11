import { EventEmitter } from 'events';
import { childLogger } from './logger.js';
import { runtimeState } from './runtimeState.js';

export type StartupPhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StartupPhase {
  name: string;
  critical?: boolean;
  dependencies?: string[]; // Names of other phases or runtime capabilities required
  run: () => Promise<void> | void;
}

export interface StartupPhaseSnapshot {
  name: string;
  status: StartupPhaseStatus;
  critical: boolean;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  dependencies?: string[];
}

class StartupManager {
  private phases: StartupPhaseSnapshot[] = [];
  private running = false;
  private completed = false;
  private log = childLogger({ subsystem: 'startup' });

  private completionEmitter = new EventEmitter();

  async run(phases: StartupPhase[]) {
    if (this.running) throw new Error('Startup already in progress');
    if (this.completed) {
      this.log.warn('Startup already completed; duplicate run ignored');
      return this.snapshot();
    }

    this.running = true;
    this.phases = phases.map((phase) => ({
      name: phase.name,
      critical: phase.critical !== false,
      status: 'pending',
      dependencies: phase.dependencies || [],
    }));

    this.log.info(`Starting concurrent boot sequence for ${phases.length} phases...`);

    try {
      // Execute all phases in parallel. Each phase will wait for its own dependencies.
      await Promise.all(phases.map(async (phase, i) => {
        const snapshot = this.phases[i];

        // 1. Dependency Gate
        if (phase.dependencies && phase.dependencies.length > 0) {
          const success = await this.waitForDependencies(phase.name, phase.dependencies, phase.critical !== false);
          if (!success) {
            if (phase.critical !== false) {
              throw new Error(`Critical phase ${phase.name} failed because its dependencies were not met.`);
            } else {
              snapshot.status = 'skipped';
              return;
            }
          }
        }

        const started = Date.now();
        snapshot.status = 'running';
        snapshot.startedAt = new Date(started).toISOString();
        this.log.info(`Executing phase: ${phase.name}`);

        try {
          await phase.run();
          snapshot.status = 'completed';
          snapshot.completedAt = new Date().toISOString();
          snapshot.durationMs = Date.now() - started;
          this.log.info(`Phase ${phase.name} completed in ${snapshot.durationMs}ms`);
          
          // Notify other pending phases that this dependency is now met
          this.completionEmitter.emit('completed', phase.name);
        } catch (err: any) {
          snapshot.status = 'failed';
          snapshot.error = err.message;
          snapshot.completedAt = new Date().toISOString();
          snapshot.durationMs = Date.now() - started;
          
          this.log[phase.critical === false ? 'warn' : 'error'](`Phase ${phase.name} failed: ${err.message}`);
          
          // Notify failure if needed, though usually we only care about success
          this.completionEmitter.emit('failed', phase.name);
          
          if (phase.critical !== false) throw err;
        }
      }));

      this.completed = true;
      return this.snapshot();
    } finally {
      this.running = false;
    }
  }

  private async waitForDependencies(name: string, deps: string[], critical: boolean): Promise<boolean> {
    const checkDeps = () => {
      return deps.every(dep => {
        // Check snapshots
        const snapshot = this.phases.find(p => p.name === dep);
        if (snapshot && snapshot.status === 'completed') return true;
        
        // Check runtimeState (for external or already-ready dependencies)
        if (runtimeState.getCapability(dep)?.ready) return true;
        
        return false;
      });
    };

    const hasFailedDeps = () => {
      return deps.some(dep => {
        const snapshot = this.phases.find(p => p.name === dep);
        return snapshot && (snapshot.status === 'failed' || snapshot.status === 'skipped');
      });
    };

    // Fast path: already ready
    if (checkDeps()) return true;

    return new Promise((resolve) => {
      const onUpdate = () => {
        if (checkDeps()) {
          this.completionEmitter.removeListener('completed', onUpdate);
          this.completionEmitter.removeListener('failed', onUpdate);
          resolve(true);
        } else if (hasFailedDeps()) {
          this.completionEmitter.removeListener('completed', onUpdate);
          this.completionEmitter.removeListener('failed', onUpdate);
          resolve(false);
        }
      };

      this.completionEmitter.on('completed', onUpdate);
      this.completionEmitter.on('failed', onUpdate);
      
      // Timeout to prevent hanging if a dependency never completes
      setTimeout(() => {
        this.completionEmitter.removeListener('completed', onUpdate);
        this.completionEmitter.removeListener('failed', onUpdate);
        if (!checkDeps()) {
          this.log.error(`Phase ${name} timed out waiting for dependencies: ${deps.join(', ')}`);
          resolve(false);
        }
      }, 60000); // 60s timeout for dependencies
    });
  }

  snapshot() {
    return this.phases.map((phase) => ({ ...phase }));
  }
}

export const startupManager = new StartupManager();
