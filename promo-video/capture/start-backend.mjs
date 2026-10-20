// Starts the real TutorBoard backend on an isolated port for promo capture.
// Port 5000 may be held by another local project, and server/main.ts kills
// whatever owns its port on startup — so we never run it on 5000 here.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '../../server');
const PORT = process.env.TB_CAPTURE_API_PORT || '5055';
const CLIENT = process.env.TB_CAPTURE_CLIENT_ORIGIN || 'http://localhost:5174';

const child = spawn(process.execPath, [path.join(serverDir, 'node_modules/tsx/dist/cli.mjs'), 'main.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT,
    NODE_ENV: 'development',
    FRONTEND_URL: CLIENT,
    BACKEND_URL: `http://localhost:${PORT}`,
    ALLOWED_ORIGINS: `${CLIENT},http://127.0.0.1:5174`,
    // gemini-3.8-flash measured ~70-85s per call during capture (doubts hit the
    // 90s server timeout); flash-lite answered the same prompts in ~2s.
    AI_MODEL: process.env.TB_CAPTURE_MODEL || 'gemini-3.5-flash-lite',
    AI_TEXT_MODEL: process.env.TB_CAPTURE_MODEL || 'gemini-3.5-flash-lite',
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
