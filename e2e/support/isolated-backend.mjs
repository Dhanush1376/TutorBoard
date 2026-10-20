// Backend for the chat e2e suite: an in-memory MongoDB (never the .env database)
// and E2E_MODE so requests carrying `x-e2e-mock-ai` use the mock model (no
// provider calls, no cost). Port 5066 — never 5000 (server/main.ts kills
// whatever holds its port, and 5000 belongs to another local project).
//   node e2e/support/isolated-backend.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverDir = path.join(root, 'server');
const { MongoMemoryServer } = await import(pathToFileURL(path.join(serverDir, 'node_modules/mongodb-memory-server/index.js')).href);

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('tutorboard_e2e');
const PORT = process.env.E2E_BACKEND_PORT || '5066';
const ORIGIN = process.env.E2E_APP_ORIGIN || 'http://127.0.0.1:5197';

const child = spawn(process.execPath, [path.join(serverDir, 'node_modules/tsx/dist/cli.mjs'), 'main.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT,
    NODE_ENV: 'development',
    E2E_MODE: 'true',
    MONGODB_URI: uri,
    MONGO_URI: uri,
    REDIS_URL: '',
    FRONTEND_URL: ORIGIN,
    BACKEND_URL: `http://127.0.0.1:${PORT}`,
    ALLOWED_ORIGINS: [ORIGIN, ORIGIN.replace('127.0.0.1', 'localhost')].join(','),
  },
});

const stop = async (code = 0) => { child.kill(); await mongod.stop().catch(() => {}); process.exit(code); };
child.on('exit', async (code) => { await mongod.stop().catch(() => {}); process.exit(code ?? 0); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop(0));
