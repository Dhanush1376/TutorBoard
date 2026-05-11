/**
 * worker-node.ts — Standalone Agent Worker Process v8.0
 * 
 * Orchestrated startup for background processing node.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { bootstrap } from '../core/bootstrap.js';
import { queueService, QUEUES } from '../services/queue/queue.service.js';
import { processAgentJob } from './pipelineWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load env for bootstrap
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function start() {
  try {
    // 1. Infrastructure Gate
    await bootstrap(true);

    // 2. Start BullMQ Worker
    console.log('[Worker] Starting Agent Pipeline Worker...');
    queueService.startWorker(QUEUES.AGENT_TASKS, processAgentJob);
    console.log('✅ [Worker] Agent Loop Worker is ONLINE');

  } catch (err: any) {
    console.error(`[Worker] ❌ FATAL STARTUP ERROR: ${err.message}`);
    process.exit(1);
  }
}

start();
