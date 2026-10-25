// The app for the code-visualizer e2e suite: Vite on :5196, proxying /api to the
// isolated backend on :5067 (viz-backend.mjs), with hot reload and file watching
// off (vite.e2e.config.mjs) so other work editing client files can't reload the
// page mid-test. Restart it to pick up client changes.
//   node e2e/support/viz-app.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientDir = path.join(root, 'client');
const port = process.env.E2E_APP_PORT || '5196';
const child = spawn(
  process.execPath,
  [path.join(clientDir, 'node_modules/vite/bin/vite.js'), '--config', path.join(root, 'e2e/support/vite.e2e.config.mjs'), '--port', port, '--strictPort'],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, TB_BACKEND: `127.0.0.1:${process.env.E2E_BACKEND_PORT || '5067'}` } },
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
