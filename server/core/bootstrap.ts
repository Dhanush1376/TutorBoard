/**
 * bootstrap.ts - infrastructure startup orchestration
 */

import { z } from 'zod';
import mongoose from 'mongoose';
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
 */
export async function bootstrap(isWorker: boolean = false, signal?: AbortSignal) {
  const pid = process.pid;
  log.info(`Bootstrap [PID: ${pid}] Initiated (${isWorker ? 'Worker' : 'App'} Mode)`);

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

    // 2. Connect to MongoDB directly
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to resolve Windows ENOTFOUND errors with mongodb+srv
    };

    await mongoose.connect(uri, options);
    log.info('MongoDB connected successfully');

    log.info(`Boot [PID: ${pid}] successful. System is online.`);
    
    return config;
  } catch (err: any) {
    log.error(`Boot [PID: ${pid}] FAILED: ${err.message}`);
    throw err;
  }
}
