import { runtimeState, RuntimeCapability } from './runtimeState.js';
import { childLogger } from './logger.js';
import mongoose from 'mongoose';
import { container } from './container.js';
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
    ]);

    const report = {
      status: runtimeState.isReady(['mongodb']) ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      capabilities: caps,
      liveChecks: {
        mongodb: live[0].status === 'fulfilled' ? live[0].value : { status: 'error', error: 'check failed' },
      }
    };

    if (report.liveChecks.mongodb.status !== 'connected') {
      report.status = 'unhealthy';
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



  /**
   * Returns a simplified health object for orchestration probes (Liveness/Readiness).
   */
  getReadiness() {
    const isMongoReady = mongoose.connection.readyState === 1;
    
    return {
      ready: isMongoReady,
      details: {
        mongodb: isMongoReady,
      }
    };
  }
}

export const healthManager = new HealthManager();
export default healthManager;
