// The production build of the app on :5195, served with vercel.json's headers
// (vite.prod.config.mjs) and proxying /api to the isolated backend on :5067.
// Builds into the OS temp folder first, so nothing lands in the repo.
//   node e2e/support/viz-prod-app.mjs
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientDir = path.join(root, 'client');
const vite = path.join(clientDir, 'node_modules/vite/bin/vite.js');
const config = path.join(root, 'e2e/support/vite.prod.config.mjs');
const outDir = path.join(os.tmpdir(), 'tutorboard-viz-prod');
// As on Vercel: the app calls /api on its own origin (vercel.json rewrites it to the
// backend; here the preview server proxies it). client/.env's local address must not win,
// and the production build requires the variable to be set.
const port = process.env.E2E_APP_PORT || '5195';
const env = { ...process.env, TB_BACKEND: `127.0.0.1:${process.env.E2E_BACKEND_PORT || '5067'}`, VITE_API_BASE_URL: `http://127.0.0.1:${port}` };

const build = spawnSync(process.execPath, [vite, 'build', '--config', config, '--outDir', outDir, '--emptyOutDir'], { cwd: clientDir, stdio: 'inherit', env });
if (build.status !== 0) process.exit(build.status ?? 1);
const child = spawn(process.execPath, [vite, 'preview', '--config', config, '--outDir', outDir, '--port', port, '--strictPort'], { cwd: clientDir, stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
