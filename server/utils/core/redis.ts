import { Redis, RedisOptions } from 'ioredis';
import { runtimeState } from '../../core/runtimeState.js';
import { childLogger } from '../../core/logger.js';
import { lifecycle } from '../../core/lifecycle.js';

const log = childLogger({ subsystem: 'redis' });
const REDIS_URL = process.env.REDIS_URL || null;

const BASE_CONFIG: RedisOptions = {
  maxRetriesPerRequest: null as any, // Critical for BullMQ
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  retryStrategy: (times: number) => {
    // ASYNC-04: Termination safety during reloads/shutdowns
    if (lifecycle.isShuttingDown()) {
      log.info('Redis retry aborted: Lifecycle shutting down.');
      return null;
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(times * 50, 2000) + Math.random() * 100;
    if (times > 20) {
      log.error(`Redis connection failed after ${times} attempts. Check REDIS_URL and infrastructure status.`);
      return null;
    }
    return delay;
  },
};

type RedisHandler = (message: string, channel: string) => void;

/**
 * Professional Redis Service Layer
 * Supports:
 * - Singleton clients for command, pub, and sub
 * - Automatic reconnection with exponential backoff
 * - Transparent fallback to in-memory mode in development (if REDIS_URL missing)
 * - Safe error handling to prevent service crashes
 */
class RedisClient {
  public client: any = null;
  public pubClient: any = null;
  public subClient: any = null;
  public isConnected = false;
  public isMock = false;
  private isConnecting = false;
  private subHandlers: Map<string, Set<RedisHandler>> = new Map();

  constructor() {
    // REDIS-01: Removed this.init() to prevent unhandled rejections on startup.
    // Initialization must now be called explicitly via redisClient.init() in bootstrap.ts.
  }

  public async init(signal?: AbortSignal) {
    const ALLOW_REDIS_MOCK = process.env.REDIS_MOCK === 'true' || process.env.NODE_ENV !== 'production';

    if (REDIS_URL) {
      await this.connect(signal);
    } else if (ALLOW_REDIS_MOCK) {
      console.warn('\n' + '!'.repeat(60));
      console.warn('!!! WARNING: REDIS_URL IS MISSING !!!');
      console.warn('Enabling in-memory mock adapter for development/test mode.');
      console.warn('Persistence, queues, and multi-instance sync will NOT work.');
      console.warn('!'.repeat(60) + '\n');
      
      this.isMock = true;
      this.isConnected = true;
      const mock = this.createMockAdapter();
      this.client = mock;
      this.pubClient = mock;
      this.subClient = mock;

      runtimeState.setCapability({
        name: 'redis',
        mode: 'MOCKED',
        status: 'healthy',
        ready: true,
        details: 'Using in-memory mock adapter',
      });
    } else {
      console.error('\n' + '!'.repeat(60));
      console.error('!!! CRITICAL: REDIS_URL IS MISSING !!!');
      console.error('Redis is strictly required for production caching, queues, and sockets.');
      console.error('ACTION REQUIRED: Provide a valid REDIS_URL in .env');
      console.error('!'.repeat(60) + '\n');
      throw new Error('REDIS_URL is missing. In-memory mocks are strictly forbidden in production.');
    }
  }


  private async connect(signal?: AbortSignal): Promise<void> {
    if (this.isConnecting || !REDIS_URL) return;
    this.isConnecting = true;

    
    const supervisorId = `redis-supervisor-${Date.now()}`;
    const supervisorSignal = lifecycle.registerAsyncTask({
      id: supervisorId,
      subsystem: 'redis',
      description: 'Main Redis Connection Supervisor',
    });

    try {
      log.info(`Connecting to Redis cluster [PID: ${process.pid}]`);

      const connectClient = async (name: string) => {
        const taskId = `redis-client-${name.toLowerCase()}`;
        const startTime = Date.now();
        
        lifecycle.registerAsyncTask({
          id: taskId,
          subsystem: 'redis',
          description: `${name} Redis connection`,
          parentTaskId: supervisorId,
          metadata: { state: 'connecting' }
        });

        try {
          const options = { ...BASE_CONFIG, maxRetriesPerRequest: null };
          const client = new Redis(REDIS_URL, options);
          
          const metrics: Record<string, number> = {};
          
          // Basic timing breakdown
          client.on('connect', () => metrics.tcp = Date.now() - startTime);
          client.on('ready', () => metrics.ready = Date.now() - startTime);
          
          this.setupEventListeners(name, client);

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), 10000);
            
            client.once('ready', () => {
              clearTimeout(timeout);
              resolve(true);
            });
            
            client.once('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });

            if (signal?.aborted || supervisorSignal.aborted) {
              clearTimeout(timeout);
              reject(new Error('ABORTED'));
            }
          });

          lifecycle.updateTaskMetadata(taskId, { 
            state: 'ready', 
            latencyMs: Date.now() - startTime,
            metrics 
          });
          
          return client;
        } catch (err: any) {
          lifecycle.completeTask(taskId, 'ERROR');
          throw err;
        }
      };

      // PERF-01: Initialize all clients in parallel to minimize latency
      const [main, pub, sub] = await Promise.all([
        connectClient('Main'),
        connectClient('Pub'),
        connectClient('Sub')
      ]);

      this.client = main;
      this.pubClient = pub;
      this.subClient = sub;

      this.subClient.on('message', (channel: string, message: string) => {
        const handlers = this.subHandlers.get(channel);
        if (!handlers) return;
        handlers.forEach(h => {
          try { h(message, channel); } catch (err: any) { 
            log.error(`Subscriber error on ${channel}: ${err?.message}`); 
          }
        });
      });

      this.isConnected = true;
      this.isConnecting = false;
      lifecycle.completeTask(supervisorId);

    } catch (err: any) {
      this.isConnecting = false;
      lifecycle.completeTask(supervisorId, 'ERROR');
      this.handleError('Init', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private setupEventListeners(name: string, client: any) {
    const pid = process.pid;
    
    client.on('connect', () => {
      log.info(`${name} Redis client connecting... [PID: ${pid}]`);
    });

    client.on('ready', async () => {
      if (name === 'Main') {
        this.isConnected = true;
        this.isConnecting = false;
        runtimeState.setCapability({
          name: 'redis',
          mode: 'REAL',
          status: 'healthy',
          ready: true,
          details: `Connected [PID: ${pid}]`,
        });
      }
      
      // REDIS-03: Restore subscriptions after reconnect
      if (name === 'Sub' && this.subHandlers.size > 0) {
        const channels = Array.from(this.subHandlers.keys());
        try {
          await client.subscribe(...channels);
          log.info(`Restored ${channels.length} subscriptions after reconnect.`);
        } catch (err: any) {
          log.error(`Failed to restore subscriptions: ${err.message}`);
        }
      }

      log.info(`${name} Redis client ready. [PID: ${pid}]`);
    });

    client.on('error', (err: any) => this.handleError(name, err));
    client.on('close', () => {
      if (name === 'Main') this.isConnected = false;
      log.warn(`${name} Redis connection closed. [PID: ${pid}]`);
    });
    client.on('reconnecting', () => {
      if (name === 'Main') this.isConnected = false;
      log.info(`${name} Redis reconnecting... [PID: ${pid}]`);
    });
  }

  private handleError(name: string, err: any) {
    if (name === 'Main') {
      this.isConnected = false;
      this.isConnecting = false;
    }
    const message = err?.message || String(err);
    log.error(`${name} Redis client error: ${message}`);
    
    runtimeState.setCapability({
      name: 'redis',
      mode: 'DEGRADED',
      status: 'degraded',
      ready: false,
      details: message,
    });
  }

  // --- PUB/SUB ---

  async publish(channel: string, message: any): Promise<number> {
    if (!this.isConnected || !this.pubClient) return 0;
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.pubClient.publish(channel, payload);
    } catch (err: any) {
      log.error(`Failed to publish to ${channel}: ${err?.message || String(err)}`);
      return 0;
    }
  }

  async subscribe(channel: string, handler: RedisHandler): Promise<void> {
    if (!this.subClient) return;
    try {
      if (!this.subHandlers.has(channel)) {
        this.subHandlers.set(channel, new Set());
        await this.subClient.subscribe(channel);
      }
      this.subHandlers.get(channel)?.add(handler);
    } catch (err: any) {
      log.error(`Failed to subscribe to ${channel}: ${err?.message || String(err)}`);
    }
  }

  async unsubscribe(channel: string, handler: RedisHandler): Promise<void> {
    if (!this.subClient) return;
    try {
      const handlers = this.subHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subHandlers.delete(channel);
          await this.subClient.unsubscribe(channel);
        }
      }
    } catch (err: any) {
      log.error(`Failed to unsubscribe from ${channel}: ${err?.message || String(err)}`);
    }
  }

  // --- KEY/VALUE OPS ---

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    try { return await this.client.get(key); } catch { return null; }
  }

  async set(key: string, value: string, ttlSeconds: number | null = null): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
      return true;
    } catch { return false; }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try { await this.client.del(key); return true; } catch { return false; }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try { return (await this.client.exists(key)) === 1; } catch { return false; }
  }

  async incr(key: string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try { return await this.client.incr(key); } catch { return 0; }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try { return (await this.client.expire(key, seconds)) === 1; } catch { return false; }
  }

  // --- SORTED SET OPS ---

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try { return await this.client.zadd(key, score, member); } catch { return 0; }
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try { return await this.client.zremrangebyscore(key, min, max); } catch { return 0; }
  }

  async zcard(key: string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try { return await this.client.zcard(key); } catch { return 0; }
  }

  async call(command: string, ...args: any[]): Promise<any> {
    if (!this.isConnected || !this.client) return null;
    try { return await this.client.call(command, ...args); } catch { return null; }
  }

  // --- CACHING HELPER ---

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = 3600): Promise<T> {
    const cached = await this.get(key);
    if (cached) {
      try { return JSON.parse(cached); } catch { return cached as any; }
    }
    
    const fresh = await fetcher();
    if (fresh) {
      await this.set(key, JSON.stringify(fresh), ttl);
    }
    return fresh;
  }

  // --- RATE LIMITING HELPER ---

  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ success: boolean; remaining: number }> {
    if (!this.isConnected || !this.client) return { success: true, remaining: limit }; // Fail open in dev
    
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    
    return {
      success: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }

  // --- UTILS ---

  getClient(): Redis | null {
    return this.isMock ? null : this.client;
  }

  /**
   * Professional Readiness Check for ioredis
   */
  async waitForConnection(timeoutMs = 5000, signal?: AbortSignal): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.isMock) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) return false;
      if (this.client?.status === 'ready') {
        this.isConnected = true;
        return true;
      }
      try {
        await this.client?.ping();
        this.isConnected = true;
        return true;
      } catch (_) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return false;
  }

  /**
   * Health check for diagnostic purposes
   */
  async health(): Promise<{ status: string; mode: string; latency?: number; error?: string }> {
    if (this.isMock) {
      return { status: 'healthy', mode: 'MOCKED' };
    }

    if (!this.isConnected || !this.client) {
      return { status: 'unhealthy', mode: 'REAL', error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', mode: 'REAL', latency };
    } catch (err: any) {
      return { status: 'unhealthy', mode: 'REAL', error: err.message };
    }
  }

  async cleanup(): Promise<void> {
    log.info('Cleaning up Redis connections...');
    const clients = [this.subClient, this.pubClient, this.client].filter(c => c && !this.isMock);
    await Promise.allSettled(clients.map(c => c.quit()));
    this.isConnected = false;
  }

  private createMockAdapter() {
    // Production-parity mock implementation using an in-memory Map with TTL
    const store = new Map<string, { value: string; expiresAt: number | null }>();
    
    const cleanExpired = () => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (entry.expiresAt && entry.expiresAt < now) store.delete(key);
      }
    };

    return {
      status: 'ready',
      get: async (key: string) => {
        cleanExpired();
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && entry.expiresAt < Date.now()) { store.delete(key); return null; }
        return entry.value;
      },
      set: async (key: string, value: string, ...args: any[]) => {
        let ttlSeconds: number | null = null;
        // Handle Redis SET variants: SET key value EX seconds | SET key value seconds
        if (args.length === 2 && args[0] === 'EX') ttlSeconds = args[1];
        else if (args.length === 1 && typeof args[0] === 'number') ttlSeconds = args[0];
        store.set(key, { 
          value, 
          expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null 
        });
        return 'OK';
      },
      del: async (key: string) => { store.delete(key); return 1; },
      incr: async (key: string) => {
        const entry = store.get(key);
        const current = entry ? parseInt(entry.value, 10) || 0 : 0;
        store.set(key, { value: String(current + 1), expiresAt: entry?.expiresAt || null });
        return current + 1;
      },
      expire: async (key: string, seconds: number) => {
        const entry = store.get(key);
        if (entry) entry.expiresAt = Date.now() + seconds * 1000;
        return 1;
      },
      exists: async (key: string) => {
        cleanExpired();
        return store.has(key) ? 1 : 0;
      },
      zadd: async () => 1,
      zremrangebyscore: async () => 1,
      zcard: async () => 0,
      publish: async () => 1,
      subscribe: async () => 1,
      unsubscribe: async () => 1,
      health: async () => ({ status: 'healthy', mode: 'MOCKED' }),
      call: async () => 'OK',
      ping: async () => 'PONG',
      on: () => {},
      once: () => {},
      quit: async () => 'OK',
      disconnect: () => {},
      duplicate: () => this.createMockAdapter(),
    };
  }
}

const redisClient = new RedisClient();
runtimeState.registerCleanup('redis', () => redisClient.cleanup());

export default redisClient;
