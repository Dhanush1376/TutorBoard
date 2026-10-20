// The app's dev server on :5197, proxying /api to the isolated e2e backend on :5066.
//   node e2e/support/isolated-app.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const child = spawn(process.execPath, [path.join(root, 'client/scripts/dev-v2.mjs'), process.env.E2E_APP_PORT || '5197'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TB_BACKEND: `127.0.0.1:${process.env.E2E_BACKEND_PORT || '5066'}` },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
