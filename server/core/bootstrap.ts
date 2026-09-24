/**
 * bootstrap.ts - infrastructure startup orchestration
 */

import crypto from 'crypto';
import { z } from 'zod';
import mongoose from 'mongoose';
import { childLogger } from './logger.js';

const log = childLogger({ subsystem: 'bootstrap' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
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
    console.log(`[Bootstrap] MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'UNSET'}`);
    console.log(`[Bootstrap] E2E_MODE: ${process.env.E2E_MODE}`);
    
    if (process.env.E2E_MODE === 'true' || process.env.NODE_ENV === 'test') {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_32_characters_long_min!';
      process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_at_least_32_chars!';
      process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'mock-openrouter-key-for-testing';
    }

    if (!process.env.JWT_REFRESH_SECRET && process.env.JWT_SECRET) {
      process.env.JWT_REFRESH_SECRET = crypto
        .createHmac('sha256', process.env.JWT_SECRET)
        .update('tutorboard-jwt-refresh-secret-derivation')
        .digest('hex');
      log.warn('JWT_REFRESH_SECRET was not configured in environment; derived deterministic fallback from JWT_SECRET.');
    }

    process.env.MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || (process.env.E2E_MODE === 'true' ? 'mongodb://127.0.0.1:27017/test' : undefined);
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      log.error('Config validation failed:');
      result.error.issues.forEach(issue => log.error(`   - ${issue.path.join('.')}: ${issue.message}`));
      throw new Error('Bootstrap aborted: Invalid environment configuration');
    }
    config = result.data;

    // 2. Connect to MongoDB directly
    const uri = process.env.MONGODB_URI;
    console.log(`[BOOTSTRAP] Connecting to MongoDB URI: ${uri}`);
    if (!uri) throw new Error('MONGODB_URI missing');

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to resolve Windows ENOTFOUND errors with mongodb+srv
    };

    await mongoose.connect(uri, options);
    log.info('MongoDB connected successfully');
    
    const { runtimeState } = await import('./runtimeState.js');
    runtimeState.setCapability({
      name: 'mongodb',
      mode: 'REAL',
      status: 'healthy',
      ready: true,
      details: 'Connected to MongoDB Atlas / Local',
    });

    log.info(`Boot [PID: ${pid}] successful. System is online.`);
    
    return config;
  } catch (err: any) {
    log.error(`Boot [PID: ${pid}] FAILED: ${err.message}`);
    throw err;
  }
}
