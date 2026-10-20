// Starts the Engine v2 dev backend on an isolated port: the Scene Lab's
// dev-only /api/scene routes, and app lessons through Engine v2 (ENGINE_V2=1).
// server/main.ts frees its port on startup, so this never uses 5000.
//   node scripts/scene-lab-backend.mjs        (SCENE_LAB_PORT, SCENE_LAB_ORIGIN to override)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.SCENE_LAB_PORT || '5055';
// the app on :5199 (client/scripts/dev-v2.mjs), or :5198 when another dev server holds 5199
const ORIGINS = (process.env.SCENE_LAB_ORIGIN || 'http://localhost:5199,http://localhost:5198').split(',');
const ORIGIN = ORIGINS[0];

const child = spawn(process.execPath, [path.join(serverDir, 'node_modules/tsx/dist/cli.mjs'), 'main.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT,
    NODE_ENV: 'development',
    ENABLE_SCENE_LAB: '1',
    // lessons in the app use Engine v2 (set ENGINE_V2=0 to compare with v1)
    ENGINE_V2: process.env.ENGINE_V2 ?? '1',
    FRONTEND_URL: ORIGIN,
    BACKEND_URL: `http://localhost:${PORT}`,
    ALLOWED_ORIGINS: ORIGINS.flatMap((o) => [o, o.replace('localhost', '127.0.0.1')]).join(','),
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
