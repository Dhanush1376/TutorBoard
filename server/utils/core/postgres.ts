import * as pg from 'pg';
import { runtimeState } from '../../core/runtimeState.js';
import { lifecycle } from '../../core/lifecycle.js';
import { childLogger } from '../../core/logger.js';
import { trackMetric, captureException } from './monitoring.js';

const { Pool } = pg;
const log = childLogger({ subsystem: 'postgres' });

const POSTGRES_URL = process.env.POSTGRES_URL;

export type PostgresState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'RECONNECTING' | 'FAILED' | 'SHUTTING_DOWN';

interface PostgresMetrics {
  totalConnections: number;
  activeQueries: number;
  failedQueries: number;
  retryCount: number;
  lastLatency: number;
  poolUsage: number;
}

/**
 * PRODUCTION-GRADE POSTGRESQL INFRASTRUCTURE MANAGER
 * Features:
 * - State machine for lifecycle tracking
 * - Non-blocking startup orchestration
 * - Intelligent exponential backoff with jitter
 * - Lifecycle-aware (AbortSignal support)
 * - Observability metrics and health monitoring
 * - Automated table/extension provisioning
 */
class PostgresManager {
  private pool: pg.Pool | null = null;
  private state: PostgresState = 'IDLE';
  private vectorAvailable = false;
  private metrics: PostgresMetrics = {
    totalConnections: 0,
    activeQueries: 0,
    failedQueries: 0,
    retryCount: 0,
    lastLatency: 0,
    poolUsage: 0,
  };
  private initPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    this.updateCapability('IDLE', 'Postgres initialized but not started');
  }

  private updateCapability(state: PostgresState, details?: string) {
    this.state = state;

    let mode: any = 'REAL';
    let status: any = 'healthy';
    let ready = false;

    switch (state) {
      case 'CONNECTED':
        mode = this.pool && (this.pool as any).totalCount === 0 && process.env.NODE_ENV !== 'production' ? 'MOCKED' : (this.vectorAvailable ? 'REAL' : 'DEGRADED');
        status = this.vectorAvailable ? 'healthy' : 'degraded';
        ready = true;
        break;
      case 'DEGRADED':
        mode = 'DEGRADED';
        status = 'degraded';
        ready = true;
        break;
      case 'CONNECTING':
      case 'RECONNECTING':
        status = 'healthy'; // Still attempting
        ready = false;
        break;
      case 'FAILED':
      case 'DISCONNECTED':
        status = 'unhealthy';
        ready = false;
        break;
      case 'IDLE':
      case 'SHUTTING_DOWN':
        mode = 'OFFLINE';
        status = 'disabled';
        ready = false;
        break;
    }

    runtimeState.setCapability({
      name: 'postgres',
      mode,
      status,
      ready,
      details: details || `State: ${state} | Vector: ${this.vectorAvailable ? 'ON' : 'OFF'}`,
    });
  }

  /**
   * Initializes the Postgres pool with provider-optimized settings
   */
  private createPool() {
    if (!POSTGRES_URL) return null;
    
    const isMockEnabled = process.env.POSTGRES_MOCK === 'true' || (process.env.NODE_ENV !== 'production' && this.metrics.retryCount > 3);
    if (isMockEnabled) {
      log.warn('Enabling in-memory mock adapter for Postgres.');
      return this.createMockPool();
    }

    const isNeon = POSTGRES_URL.includes('neon.tech');
    const isProd = process.env.NODE_ENV === 'production';

    // SEC-09: Hardened SSL handling for cloud providers
    const sslConfig = (isProd || isNeon || POSTGRES_URL.includes('sslmode='))
      ? {
        rejectUnauthorized: isProd && !isNeon, // Only relax for Neon if not explicitly in prod mode with CA
        // If Neon requires SSL but doesn't provide a CA we can verify, we use rejectUnauthorized: false
        // However, the audit recommends strict verification where possible.
      }
      : false;

    // Override: If PGSSLMODE is set to 'no-verify', we respect it for debugging
    if (process.env.PGSSLMODE === 'no-verify' || process.env.POSTGRES_INSECURE_SSL === 'true') {
      if (sslConfig && typeof sslConfig === 'object') {
        (sslConfig as any).rejectUnauthorized = false;
      }
    }

    return new Pool({
      connectionString: POSTGRES_URL,
      ssl: sslConfig,
      max: isProd ? 30 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000, // Increased for Neon cold starts
    });
  }

  /**
   * Orchestrates the connection sequence with retries and timeout isolation
   */
  public async init(options: {
    retries?: number;
    initialDelay?: number;
    signal?: AbortSignal;
    nonBlocking?: boolean;
  } = {}) {
    if (this.state === 'CONNECTED') return;
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') {
      return this.initPromise || Promise.resolve();
    }

    // Set state immediately to prevent race conditions from rapid concurrent calls
    const isReconnect = this.state === 'DISCONNECTED' || this.state === 'FAILED';
    this.state = isReconnect ? 'RECONNECTING' : 'CONNECTING';

    const { retries = 5, initialDelay = 1000, signal, nonBlocking = false } = options;

    this.abortController = new AbortController();
    const internalSignal = this.abortController.signal;
    
    // ASYNC-05: Bridge global and local signals to local operation
    const abortLocal = () => this.abortController?.abort();
    if (lifecycle.signal.aborted) abortLocal();
    lifecycle.signal.addEventListener('abort', abortLocal, { once: true });
    
    if (signal) {
      if (signal.aborted) abortLocal();
      signal.addEventListener('abort', abortLocal, { once: true });
    }

    const startInit = async () => {
      this.updateCapability(this.state, isReconnect ? 'Attempting background recovery' : 'Initiating connection sequence');
      
      try {
        if (!this.pool) {
          this.pool = this.createPool();
          if (!this.pool) {
            this.updateCapability('IDLE', 'No POSTGRES_URL configured');
            return;
          }

          this.pool.on('error', (err) => {
            log.error(`[Postgres] Pool error [PID: ${process.pid}]: ${err.message}`);
            if (this.state === 'CONNECTED') this.handleDisconnect();
          });
        }

        let lastError: any = null;
        for (let i = 0; i < retries; i++) {
          if (internalSignal.aborted) throw new Error('INIT_ABORTED');

          let client: any = null;
          try {
            const startTime = Date.now();
            const attempt = i + 1;
            log.info(`[Postgres] Connection attempt ${attempt}/${retries}...`);

            // Add a timeout to the connection attempt itself (increased for serverless cold starts)
            const clientPromise = this.pool.connect();
            const timeoutPromise = new Promise((_, reject) => {
              const t = setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), 30000);
              internalSignal.addEventListener('abort', () => {
                clearTimeout(t);
                reject(new Error('INIT_ABORTED'));
              });
            });

            client = await Promise.race([clientPromise, timeoutPromise]) as pg.PoolClient;
            
            this.metrics.lastLatency = Date.now() - startTime;
            this.metrics.totalConnections++;

            await this.provisionSchema(client);
            this.updateCapability('CONNECTED', 'Successfully connected and provisioned');
            const mode = this.pool && (this.pool as any).totalCount === 0 ? 'MOCKED' : 'REAL';
            log.info(`[Postgres] ✅ Connected [Mode: ${mode}] in ${this.metrics.lastLatency}ms [PID: ${process.pid}]`);
            
            // Success: clear state
            this.initPromise = null;
            return;
          } catch (err: any) {
            if (client) client.release();
            lastError = err;
            this.metrics.retryCount++;
            trackMetric('postgres.connect.failure', 1, { attempt: i + 1, error: err.message });
            
            if (err.message === 'INIT_ABORTED' || internalSignal.aborted) throw err;

            const delay = Math.min(initialDelay * Math.pow(2, i), 30000) + Math.random() * 1000;
            log.warn(`[Postgres] Attempt ${i + 1} failed: ${err.message}. Retrying in ${Math.round(delay)}ms...`);
            
            if (i < retries - 1) {
              await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, delay);
                internalSignal.addEventListener('abort', () => {
                  clearTimeout(timer);
                  reject(new Error('INIT_ABORTED'));
                });
              });
            }
          } finally {
            if (client) client.release();
          }
        }

        this.updateCapability('FAILED', `Exhausted ${retries} attempts. Last error: ${lastError?.message}`);
        throw lastError || new Error('Connection failed');
      } catch (err: any) {
        if (err.message === 'INIT_ABORTED') {
          log.info('[Postgres] Initialization aborted by lifecycle/signal.');
        } else {
          log.error(`[Postgres] Fatal initialization failure: ${err.message}`);
          captureException(err);
        }
        throw err;
      } finally {
        // CLEANUP: Remove listeners to prevent memory leaks
        lifecycle.signal.removeEventListener('abort', abortLocal);
        if (signal) signal.removeEventListener('abort', abortLocal);
      }
    };

    if (nonBlocking) {
      const taskId = `postgres-init-bg-${Date.now()}`;
      lifecycle.registerAsyncTask({
        id: taskId,
        subsystem: 'postgres',
        description: 'Background database initialization',
        metadata: { attempt: 0 }
      });
      
      this.initPromise = startInit().then(() => {
        lifecycle.completeTask(taskId);
      }).catch(err => {
        lifecycle.completeTask(taskId, 'ERROR');
        throw err;
      });
      return;
    } else {
      const taskId = `postgres-init-blocking-${Date.now()}`;
      lifecycle.registerAsyncTask({
        id: taskId,
        subsystem: 'postgres',
        description: 'Blocking database initialization',
      });
      
      try {
        this.initPromise = startInit();
        await this.initPromise;
        lifecycle.completeTask(taskId);
      } catch (err) {
        lifecycle.completeTask(taskId, 'ERROR');
        throw err;
      }
      return;
    }
  }

  /**
   * Provision extensions and tables required for AI memory
   */
  private async provisionSchema(client: pg.PoolClient) {
    try {
      // 1. Enable pgvector
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        this.vectorAvailable = true;
      } catch (err: any) {
        log.warn(`[Postgres] pgvector extension not available: ${err.message}`);
        this.vectorAvailable = false;
      }

      // 2. Create AI Memory Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_memory (
          id SERIAL PRIMARY KEY,
          owner_id TEXT NOT NULL,
          namespace TEXT NOT NULL DEFAULT 'global',
          reference_id TEXT,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          content_hash TEXT UNIQUE NOT NULL,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Create Indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_ai_memory_owner ON ai_memory(owner_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_ai_memory_namespace ON ai_memory(namespace)');

      if (this.vectorAvailable) {
        try {
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_ai_memory_embedding_hnsw ON ai_memory 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
          `);
        } catch (vecErr: any) {
          log.warn(`[Postgres] ⚠️ Vector index creation failed: ${vecErr.message}`);
        }
      }
    } catch (err: any) {
      log.error(`[Postgres] Schema provisioning failed: ${err.message}`);
      throw err;
    }
  }

  private async handleDisconnect() {
    if (lifecycle.isShuttingDown() || this.state === 'RECONNECTING') return;
    
    log.warn(`[Postgres] Connection lost [PID: ${process.pid}]. Initiating lifecycle-bound recovery...`);
    this.updateCapability('DISCONNECTED', 'Connection lost');
    
    const taskId = `postgres-reconnect-loop`;
    const recoverySignal = lifecycle.registerAsyncTask({
      id: taskId,
      subsystem: 'postgres',
      description: 'Background database reconnection loop',
      metadata: { attempts: 0 }
    });

    let attempts = 0;
    const maxBackoff = 30000;
    
    const reconnect = async () => {
      if (this.state === 'CONNECTED' || recoverySignal.aborted) {
        lifecycle.completeTask(taskId);
        return;
      }
      
      attempts++;
      lifecycle.updateTaskMetadata(taskId, { attempts });
      
      const delay = Math.min(5000 * Math.pow(1.5, attempts - 1), maxBackoff) + Math.random() * 2000;
      
      log.info(`[Postgres] Background reconnection attempt ${attempts} in ${Math.round(delay)}ms...`);
      
      // Use a cancellable delay
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          recoverySignal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('RECOVERY_ABORTED'));
          });
        });

        await this.init({ retries: 1, nonBlocking: false, signal: recoverySignal });
        
        if ((this.state as string) === 'CONNECTED') {
          log.info('[Postgres] ♻️ Background recovery successful.');
          lifecycle.completeTask(taskId);
          attempts = 0;
        } else {
          reconnect();
        }
      } catch (err: any) {
        if (err.message === 'RECOVERY_ABORTED') {
          log.info('[Postgres] Background recovery task cancelled by lifecycle.');
          return;
        }
        reconnect();
      }
    };

    reconnect();
  }

  public async query(text: string, params: any[] = []) {
    if (this.state !== 'CONNECTED' || !this.pool) {
      this.metrics.failedQueries++;
      return { rows: [], rowCount: 0, error: 'Database not available' };
    }

    const start = Date.now();
    this.metrics.activeQueries++;

    try {
      const result = await this.pool.query(text, params);
      this.metrics.lastLatency = Date.now() - start;
      return result;
    } catch (err: any) {
      this.metrics.failedQueries++;
      log.error(`[Postgres] Query error: ${err.message}`);

      if (err.message.includes('terminated') || err.message.includes('closed') || err.code === '57P01') {
        this.handleDisconnect();
      }

      return { rows: [], rowCount: 0, error: err.message };
    } finally {
      this.metrics.activeQueries--;
    }
  }

  public getStatus() {
    return {
      state: this.state,
      ready: this.state === 'CONNECTED' || this.state === 'DEGRADED',
      vector: this.vectorAvailable,
      metrics: { ...this.metrics },
      poolUsage: this.pool ? (this.pool as any).totalCount : 0,
      idleCount: this.pool ? (this.pool as any).idleCount : 0,
      waitingCount: this.pool ? (this.pool as any).waitingCount : 0,
    };
  }

  private createMockPool(): any {
    this.vectorAvailable = true; // Allow vector logic to run in mock mode
    return {
      connect: async () => ({
        query: async () => ({ rows: [], rowCount: 0 }),
        release: () => {},
      }),
      query: async () => ({ rows: [], rowCount: 0 }),
      on: () => {},
      end: async () => {},
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
  }

  public async cleanup() {
    this.updateCapability('SHUTTING_DOWN');
    this.abortController?.abort();
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.state = 'IDLE';
  }
}

const manager = new PostgresManager();

// Legacy API compatibility exports
export const initPostgres = (retries = 5, delay = 1000, signal?: AbortSignal) =>
  manager.init({ retries, initialDelay: delay, signal });

export const isPostgresReady = () => manager.getStatus().ready;
export const isVectorSearchReady = () => manager.getStatus().ready && manager.getStatus().vector;
export const query = (text: string, params: any[] = []) => manager.query(text, params);
export const checkPostgresHealth = async () => {
  const status = manager.getStatus();
  return {
    status: status.ready ? 'connected' : (status.state === 'CONNECTING' ? 'connecting' : 'error'),
    state: status.state,
    vectorSearch: status.vector ? 'enabled' : 'disabled',
    latency: `${status.metrics.lastLatency}ms`,
    pool: {
      total: status.poolUsage,
      idle: status.idleCount,
      waiting: status.waitingCount
    }
  };
};
export const cleanupPostgres = () => manager.cleanup();

runtimeState.registerCleanup('postgres', cleanupPostgres);

export default {
  query,
  isPostgresReady,
  isVectorSearchReady,
  initPostgres,
  checkPostgresHealth,
  cleanupPostgres,
  getStatus: () => manager.getStatus(),
  init: (opts: any) => manager.init(opts)
};
