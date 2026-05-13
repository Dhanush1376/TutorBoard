/**
 * dev-orchestrator.js
 * 
 * A production-grade development orchestrator for TutorBoard.
 * Ensures backend is healthy before starting frontend to prevent proxy ECONNREFUSED.
 */

import { spawn } from 'child_process';
import axios from 'axios';
import chalk from 'chalk';

const BACKEND_URL = 'http://127.0.0.1:5000';
const HEALTH_CHECK_URL = `${BACKEND_URL}/ready`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 2000;

const log = (msg, color = chalk.blue) => console.log(color(`[Orchestrator] ${msg}`));

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isBackendReady() {
  try {
    const res = await axios.get(HEALTH_CHECK_URL, { timeout: 1000 });
    return res.status === 200 && res.data.status === 'ready';
  } catch (err) {
    return false;
  }
}

function startProcess(command, args, name, color) {
  const proc = spawn(command, args, { 
    shell: true, 
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  proc.on('error', (err) => {
    console.error(chalk.red(`[${name}] Failed to start: ${err.message}`));
  });

  return proc;
}

async function run() {
  log('🚀 Starting TutorBoard Development Environment...', chalk.bold.magenta);

  // 1. Start Backend
  log('Starting Backend Service...', chalk.yellow);
  const backend = startProcess('npm', ['run', 'dev', '--prefix', 'server'], 'Backend', chalk.yellow);

  // 2. Wait for Readiness
  log('Waiting for Backend to reach READY state...', chalk.cyan);
  let ready = false;
  for (let i = 0; i < MAX_RETRIES; i++) {
    if (await isBackendReady()) {
      ready = true;
      break;
    }
    process.stdout.write(chalk.gray('.'));
    await wait(RETRY_INTERVAL);
  }
  process.stdout.write('\n');

  if (!ready) {
    log('❌ Backend failed to reach ready state. Starting Frontend anyway, but proxy errors may occur.', chalk.red);
  } else {
    log('✅ Backend is READY. Firing up the Frontend...', chalk.green);
  }

  // 3. Start Frontend
  const frontend = startProcess('npm', ['run', 'dev', '--prefix', 'client'], 'Frontend', chalk.green);

  // 4. Handle Shutdown
  const shutdown = () => {
    log('Shutting down services...', chalk.magenta);
    backend.kill();
    frontend.kill();
    process.exit();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch(err => {
  console.error(chalk.red('Orchestrator failed:'), err);
  process.exit(1);
});
