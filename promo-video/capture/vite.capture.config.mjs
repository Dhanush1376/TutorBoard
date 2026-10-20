// Capture-only Vite config: reuses the real client config untouched and only
// re-points the dev proxy at the isolated backend port. Loaded with
// `--configLoader native` so the client config resolves its own node_modules.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '../../client');
const API = `127.0.0.1:${process.env.TB_CAPTURE_API_PORT || '5055'}`;

const { default: base } = await import(pathToFileURL(path.join(clientDir, 'vite.config.js')).href);

const proxy = Object.fromEntries(
  Object.entries(base.server.proxy).map(([k, v]) => [
    k,
    { ...v, target: v.target.replace('127.0.0.1:5000', API) },
  ]),
);

export default {
  ...base,
  root: clientDir,
  envDir: clientDir,
  cacheDir: path.join(clientDir, 'node_modules/.vite-promo'),
  server: { ...base.server, port: 5174, strictPort: true, proxy },
};
