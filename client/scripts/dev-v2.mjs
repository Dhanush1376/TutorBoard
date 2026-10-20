// Runs the app's dev server against the Engine v2 dev backend
// (server/scripts/scene-lab-backend.mjs on 127.0.0.1:5055) instead of the
// default backend on :5000. The Scene Lab works here too.
//   node client/scripts/dev-v2.mjs [port]   → http://localhost:5199 (or the port given)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [path.join(clientDir, 'node_modules/vite/bin/vite.js'), '--port', process.argv[2] || process.env.PORT || '5199', '--strictPort'], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, TB_BACKEND: process.env.TB_BACKEND || '127.0.0.1:5055' },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
