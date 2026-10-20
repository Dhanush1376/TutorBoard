// The Deep Visual Dive path end to end, as a guest: session:start over the socket →
// streamed beats (scene:partial) → teaching:timeline. Prints what arrives and saves the lesson.
//   node scripts/socket-lesson-check.mjs "<question>" [out.json]
// Needs the dev backend (BACKEND, default http://localhost:5055).
import fs from 'node:fs';
import { io } from 'socket.io-client';

const BACKEND = process.env.BACKEND ?? 'http://localhost:5055';
const [question, out] = process.argv.slice(2);
if (!question) { console.error('usage: node scripts/socket-lesson-check.mjs "<question>" [out.json]'); process.exit(1); }

const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;
const socket = io(`${BACKEND}/teaching`, { transports: ['websocket'], auth: { token: null } });
const done = (code) => { socket.close(); process.exit(code); };
setTimeout(() => { console.log(at(), 'no lesson after 200 s'); done(1); }, 200000);

socket.on('connect_error', (e) => { console.log(at(), 'connect error:', e.message); done(1); });
// the server registers its handlers after creating the session (guests get guest:status first)
let asked = false;
const ask = () => {
  if (asked) return;
  asked = true;
  console.log(at(), 'asking:', question);
  socket.emit('session:start', { topic: question, selectedAgent: 'universal', activeMode: 'deep' });
};
socket.on('connect', () => setTimeout(ask, 2000));
socket.on('guest:status', () => setTimeout(ask, 200));
socket.on('teaching:progress', (d) => console.log(at(), 'progress:', d?.message ?? d?.stage ?? ''));
socket.on('scene:partial', (d) => console.log(at(), `partial: ${d?.timeline?.length ?? d?.steps?.length ?? '?'} beat(s) ready`));
socket.on('teaching:error', (d) => { console.log(at(), `ERROR (${d?.errorType ?? 'generic'}):`, d?.message); done(2); });
socket.on('teaching:greeting', (d) => { console.log(at(), 'text answer only:', String(d?.message).slice(0, 120)); done(0); });
socket.on('teaching:timeline', (d) => {
  const scene = d?.sceneV2;
  console.log(at(), `lesson: renderer=${d?.renderer} "${d?.title ?? scene?.title}" — ${d?.timeline?.length ?? 0} steps`);
  for (const s of d?.timeline ?? []) console.log('       ·', s.title, s.check ? '  [check]' : '');
  if (out && scene) { fs.writeFileSync(out, JSON.stringify(scene, null, 1)); console.log('       saved', out); }
  done(scene ? 0 : 3);
});
