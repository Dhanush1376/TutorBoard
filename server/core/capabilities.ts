/**
 * capabilities.ts - runtime capability reporter
 *
 * Reports actual subsystem state without treating expected development
 * fallbacks as startup problems.
 */

import mongoose from 'mongoose';
import { runtimeState } from './runtimeState.js';
import { startupManager } from './startupManager.js';

export type ServiceStatus = 'online' | 'mocked' | 'offline' | 'disabled';

export interface SystemCapabilities {
  database: ServiceStatus;
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

  const mapStatus = (cap: any): ServiceStatus => {
    if (!cap) return 'offline';
    if (cap.mode === 'DISABLED') return 'disabled';
    if (cap.mode === 'MOCKED') return 'mocked';
    return cap.ready ? 'online' : 'offline';
  };

  cachedCapabilities = {
    database: mapStatus(mongoCap),
    rag: 'disabled',
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
    ready: runtimeState.isReady(['mongodb']),
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
