/**
 * main.ts - Application Entry Point
 *
 * Owns process handlers, startup lifecycle, graceful shutdown, and port
 * management for the backend.
 */

import dotenv from 'dotenv';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { lifecycle, LifecycleState } from './core/lifecycle.js';
import { runtimeState } from './core/runtimeState.js';
import { childLogger } from './core/logger.js';

const log = childLogger({ subsystem: 'main' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

let isStarting = false;
let httpServer: import('http').Server | null = null;

// --- Signal Handling ---

const handleSignal = (signal: string) => {
  lifecycle.shutdown(signal).then(() => {
    // If lifecycle.shutdown completes, we can exit.
    // The LifecycleManager ensures it only runs once.
  });
};

process.on('uncaughtException', (err: Error) => {
  console.error(`[CRITICAL][PID: ${process.pid}] Uncaught Exception:\n${err.stack}\n`);
  // Prevent dev server disconnect loops by keeping process alive in non-production environments
  if (process.env.NODE_ENV === 'production') handleSignal('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error(`[CRITICAL][PID: ${process.pid}] Unhandled Rejection:\nReason: ${reason}\n`);
  if (process.env.NODE_ENV === 'production') handleSignal('unhandledRejection');
});

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

// --- Startup Logic ---

async function start() {
  const pid = process.pid;
  if (isStarting) {
    log.warn(`Duplicate start() detected for PID ${pid}. Ignoring.`);
    return;
  }
  isStarting = true;

  try {
    const port = parseInt(process.env.PORT || '5000', 10);
    log.info(`TutorBoard Backend Starting... [PID: ${pid}]`);
    lifecycle.transition(LifecycleState.STARTING);
    runtimeState.setLifecycleState(LifecycleState.STARTING);
    log.info(`Port: ${port} | Env: ${process.env.NODE_ENV || 'development'}`);

    // 1. Phase 1: Resource Lock (Port checking)
    // If port is in use, we attempt to kill the orphan, but also wait for potential cleanup.
    log.info(`Phase 1: Verifying resource availability [PID: ${pid}]`);
    await ensurePortFree(port);

    // 2. Phase 2: Bootstrap Infrastructure
    log.info(`Phase 2: Bootstrapping infrastructure [PID: ${pid}]`);
    const { bootstrap } = await import('./core/bootstrap.js');
    await bootstrap(false, lifecycle.signal);

    // 3. Phase 3: Application Launch
    log.info(`Phase 3: Starting application server [PID: ${pid}]`);
    const { createApp, startHttpServer } = await import('./index.js');
    const app = createApp();
    httpServer = await startHttpServer(app, port);

    lifecycle.transition(LifecycleState.READY);
    runtimeState.setLifecycleState(LifecycleState.READY);
    log.info(`TutorBoard Backend READY [PID: ${pid}] on port ${port}`);
    
  } catch (err: any) {
    if (err.message === 'Postgres init aborted') {
      log.warn(`Startup aborted during Postgres phase for PID ${pid}.`);
      return;
    }
    log.error(`FATAL STARTUP ERROR [PID: ${pid}]: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}
function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

async function ensurePortFree(port: number): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await checkPortAvailable(port)) return;

    log.warn(`Port ${port} in use (attempt ${attempt + 1}/5)... [PID: ${process.pid}]`);

    if (attempt === 0 && process.platform === 'win32') {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout: result } = await execAsync(
          `netstat -ano | findstr :${port} | findstr LISTENING`,
          { timeout: 3000 }
        );
        const pids = new Set<string>();

        if (result) {
          for (const line of result.trim().split('\n')) {
            const pid = line.trim().split(/\s+/).pop();
            if (pid && pid !== process.pid.toString() && /^\d+$/.test(pid)) {
              pids.add(pid);
            }
          }
        }

        for (const pid of pids) {
          log.info(`Killing orphan process PID ${pid} on port ${port}`);
          try {
            await execAsync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
          } catch (err: any) {
            log.warn(`Process PID ${pid} could not be killed: ${err.message}`);
          }
        }
      } catch (_) {
        // No listening process found or error in exec; retry loop will handle it.
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error(`Port ${port} still in use after 5 retries. Kill the orphan process manually.`);
}

start();
