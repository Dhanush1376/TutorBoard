// Measures the streaming planner live: time to first beat vs. total.
//   node scripts/scene-stream-check.mjs "How does a min-heap insert 3?" [model]
// Needs the Scene Lab backend (scripts/scene-lab-backend.mjs) on SCENE_LAB_API (default :5055).
const API = process.env.SCENE_LAB_API ?? 'http://localhost:5055';
const [question = 'How does binary search find 23 in [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]?', model] = process.argv.slice(2);

const r = await fetch(`${API}/api/csrf-token`);
const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const { csrfToken } = await r.json();
const t0 = Date.now();
const res = await fetch(`${API}/api/scene/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Cookie: cookie },
  body: JSON.stringify({ question, ...(model ? { model } : {}) }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
const at = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s`;
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const chunk = buf.slice(0, i);
    buf = buf.slice(i + 2);
    const event = /^event: (.+)$/m.exec(chunk)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] ?? '{}');
    if (event === 'partial') console.log(`${at()}  partial: ${data.beats} beat(s) ready — "${data.scene.beats.at(-1).title}"`);
    else if (event === 'stage') console.log(`${at()}  stage: ${data.stage} (attempt ${data.attempt})`);
    else if (event === 'done') console.log(`${at()}  done: ${data.ok ? 'ok' : 'FAILED'} · ${data.attempts} attempt(s) · first beat ${data.firstBeatMs ?? '–'} ms · ${data.ok ? data.scene.beats.length : 0} beats · ${data.model}`);
    else if (event === 'error') console.log(`${at()}  error: ${data.error}`);
  }
}
