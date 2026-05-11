import { InfrastructureDriver, SubsystemStatus } from '../kernel.js';
import redisClient from '../../utils/core/redis.js';
import { container } from '../container.js';

export class RedisDriver implements InfrastructureDriver {
  public name = 'redis';
  public description = 'Distributed cache and Pub/Sub message broker (ioredis)';
  public priority = 10;
  public critical = true;
  public dependencies = [];

  async init(): Promise<void> {
    await redisClient.init();
    
    // Subsystems MUST resolve these rather than instantiating their own.
    container.register('redis-main', redisClient.client);
    container.register('redis-pub', redisClient.pubClient);
    container.register('redis-sub', redisClient.subClient);
    container.register('redis-service', redisClient);
    
    // Legacy support for general "redis" resolve
    container.register('redis', redisClient.client);
  }

  async shutdown(): Promise<void> {
    await redisClient.cleanup();
  }

  async checkHealth(): Promise<{ status: SubsystemStatus; details?: string }> {
    if (redisClient.isMock) {
      return { status: 'DEGRADED', details: 'Running in MOCKED mode (In-Memory)' };
    }
    
    if (redisClient.isConnected) {
      return { status: 'READY', details: 'Connected to Redis cluster' };
    }

    return { status: 'FAILED', details: 'Connection lost' };
  }
}
