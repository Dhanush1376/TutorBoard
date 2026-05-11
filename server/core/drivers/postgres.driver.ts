import { InfrastructureDriver, SubsystemStatus } from '../kernel.js';
import pgManager from '../../utils/core/postgres.js';

export class PostgresDriver implements InfrastructureDriver {
  public name = 'postgres';
  public description = 'Relational database for AI memory and RAG (pgvector)';
  public priority = 30;
  public critical = false; // RAG failure shouldn't kill the whole app
  public dependencies = [];

  async init(): Promise<void> {
    // Note: We use nonBlocking: true to allow the rest of the app to boot while PG connects (cold starts)
    await pgManager.init({ nonBlocking: true });
  }

  async shutdown(): Promise<void> {
    await pgManager.cleanupPostgres();
  }

  async checkHealth(): Promise<{ status: SubsystemStatus; details?: string }> {
    const status = pgManager.getStatus();
    
    // observability: explicit mock vs real distinction
    const isMock = (status as any).totalCount === 0 && process.env.NODE_ENV !== 'production';
    const mode = isMock ? 'MOCKED' : 'REAL';

    if (status.state === 'CONNECTED') {
      return { 
        status: 'READY', 
        details: `Connected [Mode: ${mode}] | Latency: ${status.metrics.lastLatency}ms | Vector: ${status.vector ? 'ON' : 'OFF'}` 
      };
    }

    if (status.state === 'CONNECTING' || status.state === 'RECONNECTING') {
      return { status: 'INITIALIZING', details: `Attempting connection... (Mode: ${mode})` };
    }

    if (status.state === 'DEGRADED') {
      return { status: 'DEGRADED', details: 'Connected but pgvector is unavailable' };
    }

    return { status: 'FAILED', details: `State: ${status.state} (Mode: ${mode})` };
  }
}
