import { InfrastructureDriver, SubsystemStatus } from '../kernel.js';
import mongoose from 'mongoose';
import { childLogger } from '../logger.js';

const log = childLogger({ subsystem: 'mongo-driver' });

export class MongoDriver implements InfrastructureDriver {
  public name = 'mongodb';
  public description = 'Primary persistence layer (MongoDB Atlas)';
  public priority = 20;
  public critical = true;
  public dependencies = [];

  async init(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(uri, options);
    log.info('MongoDB connected successfully');
  }

  async shutdown(): Promise<void> {
    await mongoose.disconnect();
    log.info('MongoDB disconnected');
  }

  async checkHealth(): Promise<{ status: SubsystemStatus; details?: string }> {
    const state = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    
    switch (state) {
      case 1: return { status: 'READY', details: 'Connected' };
      case 2: return { status: 'INITIALIZING', details: 'Connecting' };
      default: return { status: 'FAILED', details: `State: ${state}` };
    }
  }
}
