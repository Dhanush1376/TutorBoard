import { runtimeState, RuntimeCapability } from './runtimeState.js';
import { childLogger } from './logger.js';
import mongoose from 'mongoose';
import { container } from './container.js';
import { checkPostgresHealth } from '../utils/core/postgres.js';

const log = childLogger({ subsystem: 'health-manager' });

/**
 * HealthManager — Centralized authority for system health, 
 * dependency validation, and degraded-mode orchestration.
 */
class HealthManager {
  /**
   * Comprehensive health check including all critical infrastructure.
   */
  async getFullStatus() {
    const caps = runtimeState.listCapabilities();
    
    // Perform live checks for core dependencies
    const live = await Promise.allSettled([
      this.checkMongo(),
      this.checkRedis(),
      checkPostgresHealth(),
    ]);

    const report = {
      status: runtimeState.isReady(['mongodb', 'redis']) ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      capabilities: caps,
      liveChecks: {
        mongodb: live[0].status === 'fulfilled' ? live[0].value : { status: 'error', error: 'check failed' },
        redis: live[1].status === 'fulfilled' ? live[1].value : { status: 'error', error: 'check failed' },
        postgres: live[2].status === 'fulfilled' ? live[2].value : { status: 'error', error: 'check failed' },
      }
    };

    if (report.liveChecks.mongodb.status !== 'connected' || report.liveChecks.redis.status !== 'healthy') {
      report.status = 'unhealthy';
    } else if (report.liveChecks.postgres.status !== 'connected') {
      report.status = 'degraded';
    }

    return report;
  }

  private async checkMongo() {
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return {
      status: state === 1 ? 'connected' : 'error',
      state: states[state] || 'unknown',
    };
  }

  private async checkRedis() {
    if (!container.has('redis-main')) return { status: 'error', details: 'unregistered' };
    try {
      const client = container.resolve<any>('redis-main');
      // If the client is ioredis, it has a status property
      return { status: client.status === 'ready' ? 'healthy' : 'degraded', details: client.status };
    } catch (err) {
      return { status: 'error', error: 'resolution failed' };
    }
  }

  /**
   * Returns a simplified health object for orchestration probes (Liveness/Readiness).
   */
  getReadiness() {
    const isMongoReady = mongoose.connection.readyState === 1;
    let isRedisReady = false;
    if (container.has('redis-main')) {
      try {
        const client = container.resolve<any>('redis-main');
        isRedisReady = client.status === 'ready';
      } catch (err) {}
    }
    
    return {
      ready: isMongoReady && isRedisReady,
      details: {
        mongodb: isMongoReady,
        redis: isRedisReady,
      }
    };
  }
}

export const healthManager = new HealthManager();
export default healthManager;
