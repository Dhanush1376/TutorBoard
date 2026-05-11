/**
 * capabilities.ts - runtime capability reporter
 *
 * Reports actual subsystem state without treating expected development
 * fallbacks as startup problems.
 */

import mongoose from 'mongoose';
import pgManager, { isPostgresReady, isVectorSearchReady } from '../utils/core/postgres.js';
import { runtimeState } from './runtimeState.js';
import { startupManager } from './startupManager.js';

export type ServiceStatus = 'online' | 'mocked' | 'offline' | 'disabled';

export interface SystemCapabilities {
  database: ServiceStatus;
  redis: ServiceStatus;
  queues: ServiceStatus;
  workers: ServiceStatus;
  rag: ServiceStatus;
  oauth: {
    google: boolean;
    github: boolean;
  };
  storage: ServiceStatus;
  search: ServiceStatus;
}

let cachedCapabilities: SystemCapabilities | null = null;

export const getCapabilities = (forceRefresh = false): SystemCapabilities => {
  if (cachedCapabilities && !forceRefresh) return cachedCapabilities;

  const mongoCap = runtimeState.getCapability('mongodb');
  const redisCap = runtimeState.getCapability('redis');
  const pgCap = runtimeState.getCapability('postgres');
  const queueCap = runtimeState.getCapability('queues');
  const workerCap = runtimeState.getCapability('workers');

  const mapStatus = (cap: any): ServiceStatus => {
    if (!cap) return 'offline';
    if (cap.mode === 'DISABLED') return 'disabled';
    if (cap.mode === 'MOCKED') return 'mocked';
    return cap.ready ? 'online' : 'offline';
  };

  cachedCapabilities = {
    database: mapStatus(mongoCap),
    redis: mapStatus(redisCap),
    queues: mapStatus(queueCap),
    workers: mapStatus(workerCap),
    rag: mapStatus(pgCap),
    oauth: {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    storage: !!process.env.S3_BUCKET ? 'online' : 'mocked',
    search: !!process.env.TAVILY_API_KEY ? 'online' : (process.env.NODE_ENV === 'production' ? 'disabled' : 'mocked'),
  };

  return cachedCapabilities;
};

export const getRuntimeReport = () => {
  return {
    capabilities: getCapabilities(true),
    services: runtimeState.listCapabilities(),
    stability: runtimeState.getStabilityReport(),
    bootstrap: {
      timeline: startupManager.snapshot(),
      totalDurationMs: startupManager.snapshot().reduce((acc: number, p: any) => acc + (p.durationMs || 0), 0)
    },
    ready: runtimeState.isReady(['mongodb', 'redis', 'queues']),
  };
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  online: 'ONLINE',
  mocked: 'MOCKED',
  offline: 'OFFLINE',
  disabled: 'DISABLED',
};

const STATUS_DETAIL: Record<string, Record<ServiceStatus, string>> = {
  database: { online: '(Atlas/Real)', mocked: '(DEV MOCK)', offline: '', disabled: '' },
  redis: { online: '(ioredis)', mocked: '(In-Memory Map)', offline: '', disabled: '' },
  queues: { online: '(BullMQ)', mocked: '(Local Queues)', offline: '', disabled: '' },
  workers: { online: '(BullMQ Worker)', mocked: '(Local Polling)', offline: '', disabled: '' },
  rag: { online: '(pgvector)', mocked: '(Disabled)', offline: '(Postgres unavailable)', disabled: '(pgvector unavailable)' },
  storage: { online: '(S3)', mocked: '(MongoDB GridFS)', offline: '', disabled: '' },
  search: { online: '(Tavily)', mocked: '(Offline Stub)', offline: '', disabled: '' },
};

export const logCapabilityReport = () => {
  const caps = getCapabilities(true);
  
  console.log('\n=====================================');
  console.log('TUTORBOARD CAPABILITY REPORT');
  console.log('=====================================');
  console.log(`Core DB:    ${STATUS_LABEL[caps.database]} ${STATUS_DETAIL.database[caps.database]}`);
  console.log(`Redis:      ${STATUS_LABEL[caps.redis]} ${STATUS_DETAIL.redis[caps.redis]}`);
  console.log(`Queues:     ${STATUS_LABEL[caps.queues]} ${STATUS_DETAIL.queues[caps.queues]}`);
  console.log(`Workers:    ${STATUS_LABEL[caps.workers]} ${STATUS_DETAIL.workers[caps.workers]}`);
  console.log(`RAG/Memory: ${STATUS_LABEL[caps.rag]} ${STATUS_DETAIL.rag[caps.rag]}`);
  console.log(`OAuth:      G:${caps.oauth.google ? 'ON' : 'OFF'} GH:${caps.oauth.github ? 'ON' : 'OFF'}`);
  console.log(`Storage:    ${caps.storage === 'mocked' ? 'ONLINE' : STATUS_LABEL[caps.storage]} ${STATUS_DETAIL.storage[caps.storage]}`);
  console.log(`Search:     ${STATUS_LABEL[caps.search]} ${STATUS_DETAIL.search[caps.search]}`);
  console.log('=====================================');

  // Async log startup performance to avoid blocking
  import('./startupManager.js').then(m => {
    const phases = m.startupManager.snapshot();
    console.log('STARTUP PERFORMANCE');
    phases.forEach(p => {
      const dur = p.durationMs ? `${p.durationMs}ms`.padStart(6) : '  --- ';
      const status = p.status.toUpperCase().padEnd(10);
      console.log(`- ${p.name.padEnd(15)} | ${status} | ${dur}`);
    });
    console.log('=====================================\n');
  }).catch(() => {});
};
