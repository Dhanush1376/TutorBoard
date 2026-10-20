// QC: bundle once, render many stills of a composition.
// usage: node scripts/stills.mjs <compositionId> <outDir> <scale> <frame> [frame...]
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [id, outDir, scale, ...frames] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id, inputProps: {} });
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `${String(f).padStart(4, '0')}.jpg`);
  await renderStill({ serveUrl, composition, frame: f, output, imageFormat: 'jpeg', jpegQuality: 88, scale: Number(scale), chromiumOptions: { gl: 'angle' } });
  process.stdout.write(`${f} `);
}
console.log('\ndone');
