/**
 * bootstrap.ts - infrastructure startup orchestration
 */

import { z } from 'zod';
import { kernel } from './kernel.js';
import { capabilityEngine } from './capabilityEngine.js'; // KERNEL-03: Activate reactive propagation
import { MongoDriver } from './drivers/mongo.driver.js';
import { logCapabilityReport } from './capabilities.js';
import { childLogger } from './logger.js';

const log = childLogger({ subsystem: 'bootstrap' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  FRONTEND_URL: z.string().url(),
  OPENROUTER_API_KEY: z.string().min(1),
  JUDGE0_HOST: z.string().optional().default('ce.judge0.com'),
});

export type Config = z.infer<typeof envSchema>;
export let config: Config;

/**
 * Bootstrap — The main entry point for orchestrating infrastructure.
 * Migrated to Runtime Kernel Architecture for modularity and dependency safety.
 */
export async function bootstrap(isWorker: boolean = false, signal?: AbortSignal) {
  const pid = process.pid;
  log.info(`Kernel Bootstrap [PID: ${pid}] Initiated (${isWorker ? 'Worker' : 'App'} Mode)`);

  try {
    // 1. Validate Environment (Phase 0)
    process.env.MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      log.error('Config validation failed:');
      result.error.issues.forEach(issue => log.error(`   - ${issue.path.join('.')}: ${issue.message}`));
      throw new Error('Bootstrap aborted: Invalid environment configuration');
    }
    config = result.data;

    // 2. Register Infrastructure Drivers
    kernel.registerDriver(new MongoDriver());

    // 3. Execute Kernel Boot
    await kernel.boot();

    logCapabilityReport();
    log.info(`Kernel Boot [PID: ${pid}] successful. System is online.`);
    
    return config;
  } catch (err: any) {
    log.error(`Kernel Boot [PID: ${pid}] FAILED: ${err.message}`);
    throw err;
  }
}
