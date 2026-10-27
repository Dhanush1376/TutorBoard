/**
 * Scene Lab — plays Scene Language v1 scenes on Engine v2, outside the app.
 * Open /scene-lab.html with `npm run dev` (dev only; not part of the build).
 */
import 'katex/dist/katex.min.css';
import { overlapping, SceneEngine } from '../scene';
import type { Scene } from '../scene';

const fixtures = import.meta.glob('../../../server/engine/scene/fixtures/*.json', { eager: true, import: 'default' }) as Record<string, Scene>;
const scenes: { name: string; scene: Scene; ai?: boolean }[] = Object.entries(fixtures)
  .map(([path, scene]) => ({ name: path.split('/').pop()!.replace('.json', ''), scene }))
  .sort((a, b) => a.name.localeCompare(b.name));
/** Backend with ENABLE_SCENE_LAB=1 (server/scripts/scene-lab-backend.mjs); override with ?api= */
const API = new URLSearchParams(location.search).get('api') ?? 'http://localhost:5055';

const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
let speed = 1;

const engine = new SceneEngine(stage, {
  insets: { top: 40, right: 40, bottom: 40, left: 40 },
  onBeat: (i, beat) => {
    $('beatTitle').textContent = `${i + 1}. ${beat.title}`;
    $('narration').textContent = beat.narration;
    renderPills();
  },
  onBeatEnd: (i) => {
    renderPills();
    if (!following) return;
    if (i + 1 < engine.beatCount) setTimeout(() => { if (following && !engine.playing) engine.playBeat(i + 1); }, 350);
    else waitingFor = i + 1; // the model is still writing it
  },
});

function renderPills() {
  const pills = $('pills');
  pills.innerHTML = '';
  engine.beats.forEach((_, i) => {
    const p = document.createElement('div');
    p.className = `pill${i === engine.beatIndex ? ' on' : i < engine.beatIndex ? ' done' : ''}`;
    p.textContent = i < engine.beatIndex ? '✓' : String(i + 1);
    p.onclick = () => engine.seekBeat(i);
    pills.appendChild(p);
  });
}

/** Sliders for a scene's parameters (the lesson UI has its own panel, ParamPanel.jsx). */
function renderParams() {
  let box = document.getElementById('params');
  if (!box) {
    box = document.createElement('div');
    box.id = 'params';
    box.className = 'card';
    $('audit').before(box);
  }
  const st = engine.paramState;
  const sliders = st.params.filter((p) => p.max > p.min);
  box.style.display = sliders.length ? '' : 'none';
  const readout = () => st.derived.length ? `<div class="meta" style="margin-top:6px">${engine.paramState.derived.map((d) => `${d.label ?? d.id} = ${Number(d.value.toPrecision(3))} ${d.unit ?? ''}`).join(' · ')}</div>` : '';
  box.innerHTML = sliders.map((p) => `<label style="display:block;margin:4px 0">${p.label ?? p.id}: <b data-v="${p.id}">${st.values[p.id]}</b> ${p.unit ?? ''}
    <input type="range" data-p="${p.id}" min="${p.min}" max="${p.max}" step="${p.step ?? (p.max - p.min) / 100}" value="${st.values[p.id]}" style="width:100%"></label>`).join('') + `<div id="readout">${readout()}</div>`;
  box.querySelectorAll<HTMLInputElement>('input[data-p]').forEach((inp) => {
    inp.oninput = async () => {
      box!.querySelector(`[data-v="${inp.dataset.p}"]`)!.textContent = inp.value;
      await engine.setParams({ [inp.dataset.p!]: Number(inp.value) });
      $('readout').innerHTML = readout();
    };
  });
}

async function open(name: string) {
  try {
    await show(name);
  } catch (err) {
    $('audit').innerHTML = `<span class="bad">${String((err as Error)?.stack ?? err)}</span>`;
    console.error(err);
  }
}

let extraAudit = '';
async function show(name: string) {
  const entry = scenes.find((s) => s.name === name)!;
  document.querySelectorAll('.fx').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.name === name));
  const loaded = await engine.load(entry.scene);
  if (!loaded) return; // another scene was opened meanwhile
  const { beats, layout } = loaded;
  engine.setSpeed(speed);
  $('title').textContent = entry.scene.title;
  $('meta').textContent = `${entry.scene.domain} · ${entry.scene.entities.length} entities · ${beats.length} steps · ${engine.duration.toFixed(1)} s`;
  const overlaps = overlapping(layout.boxes, -2).filter(([a, b]) => !(entry.scene.layout ?? []).some((r) => r.rel === 'inside' && ((r.id === a && r.of === b) || (r.id === b && r.of === a))));
  $('audit').innerHTML = [
    `<span class="${overlaps.length ? 'bad' : 'ok'}">${overlaps.length ? `✗ ${overlaps.length} overlapping` : '✓ no overlaps'}</span>`,
    ...[...layout.boxes].map(([id, b]) => `${id.padEnd(8)} ${Math.round(b.w)}×${Math.round(b.h)} @ ${Math.round(b.x)},${Math.round(b.y)}`),
    ...overlaps.map(([a, b]) => `<span class="bad">${a} ∩ ${b}</span>`),
  ].join('\n');
  if (extraAudit) $('audit').innerHTML = `${extraAudit}
${$('audit').innerHTML}`;
  $('beatTitle').textContent = '';
  $('narration').textContent = 'Press ▶ Play step.';
  renderPills();
  renderParams();
  location.hash = name;
  (window as unknown as { __lab: unknown }).__lab = { engine, overlaps, beats, open, name, addGenerated };
}

for (const s of scenes) addButton($('list'), s);

function addButton(parent: HTMLElement, s: { name: string; scene: Scene }) {
  const b = document.createElement('button');
  b.className = 'fx';
  b.dataset.name = s.name;
  b.innerHTML = `${s.scene.title}<small>${s.scene.domain} · ${s.scene.beats.length} steps</small>`;
  b.onclick = () => { extraAudit = ''; following = false; open(s.name); };
  parent.appendChild(b);
}

/** Add a scene to the "AI-generated" list (also used by scripts/scene-shots.mjs). */
function addGenerated(scene: Scene): string {
  const name = `ai-${scenes.filter((s) => s.ai).length + 1}`;
  const entry = { name, scene, ai: true };
  scenes.push(entry);
  addButton($('generated'), entry);
  return name;
}

/** While a scene streams in: play each beat as soon as it exists. */
let following = false;
let waitingFor = -1;

type Issue = { path: string; message: string };

/** Minimal SSE reader for a POST response. */
async function* events(res: Response): AsyncGenerator<{ event: string; data: any }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = /^event: (.+)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) };
    }
  }
}

async function generate() {
  const question = ($('q') as HTMLTextAreaElement).value.trim();
  if (!question) return;
  const go = $('go') as HTMLButtonElement;
  go.disabled = true;
  const t0 = performance.now();
  const secs = () => ((performance.now() - t0) / 1000).toFixed(1);
  let stage = 'writing the scene';
  let firstStep = '';
  const tick = setInterval(() => { $('status').textContent = `${stage}… ${secs()} s${firstStep}`; }, 200);
  let name: string | null = null;
  following = true;
  waitingFor = -1;
  try {
    // the API uses double-submit CSRF, like the app's own client
    const { csrfToken } = await (await fetch(`${API}/api/csrf-token`, { credentials: 'include' })).json();
    const res = await fetch(`${API}/api/scene/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ question, quality: ($('quality') as HTMLSelectElement).value }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    for await (const { event, data } of events(res)) {
      if (event === 'stage') stage = data.stage === 'repairing' ? `repairing (attempt ${data.attempt})` : data.stage === 'validating' ? 'checking' : 'writing the scene';
      if (event === 'partial') {
        const scene = data.scene as Scene;
        if (!name) {
          name = addGenerated(scene);
          firstStep = ` · first step at ${secs()} s`;
          extraAudit = '';
          await open(name);
          engine.playBeat(0);
        } else {
          scenes.find((x) => x.name === name)!.scene = scene;
          await engine.extend(scene);
          renderPills();
          if (waitingFor >= 0 && waitingFor < engine.beatCount) { engine.playBeat(waitingFor); waitingFor = -1; }
        }
        stage = `writing step ${scene.beats.length + 1}`;
      }
      if (event === 'error') throw new Error(data.error);
      if (event === 'done') {
        clearInterval(tick);
        const repairs = (data.repairs ?? []).map((r: Issue[], i: number) => `repair ${i + 1}: ${r.length} issue(s)`).join('\n');
        $('status').textContent = `${data.ok ? '✓' : '✗'} ${(data.ms / 1000).toFixed(1)} s total${data.firstBeatMs ? ` · first step at ${(data.firstBeatMs / 1000).toFixed(1)} s` : ''} · ${data.attempts} attempt(s) · ${data.model ?? ''}${repairs ? `\n${repairs}` : ''}`;
        if (!data.ok) {
          if (!name) $('audit').innerHTML = `<span class="bad">${(data.errors ?? []).map((e: Issue) => `${e.path}: ${e.message}`).join('\n')}</span>`;
          break;
        }
        const final = data.scene as Scene;
        extraAudit = `<span class="ok">AI scene · ${(data.ms / 1000).toFixed(1)} s · ${data.attempts} attempt(s)</span>${(data.warnings ?? []).map((w: Issue) => `\n⚠ ${w.path}: ${w.message}`).join('')}`;
        if (!name) {
          name = addGenerated(final);
          await open(name);
          engine.playBeat(0);
        } else {
          scenes.find((x) => x.name === name)!.scene = final;
          await engine.extend(final);
          renderPills();
          if (waitingFor >= 0 && waitingFor < engine.beatCount) { engine.playBeat(waitingFor); waitingFor = -1; }
        }
      }
    }
  } catch (err) {
    $('status').textContent = `✗ ${(err as Error).message} — is the Scene Lab backend running on ${API}?`;
  } finally {
    clearInterval(tick);
    go.disabled = false;
  }
}
$('go').onclick = generate;
($('q') as HTMLTextAreaElement).addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); });

$('playBeat').onclick = () => engine.playBeat(Math.max(0, engine.beatIndex < 0 ? 0 : engine.beatIndex));
$('playAll').onclick = () => engine.play();
$('pause').onclick = () => engine.pause();
$('next').onclick = () => engine.next();
$('prev').onclick = () => engine.prev();
$('speed').onclick = () => {
  speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
  engine.setSpeed(speed);
  $('speed').textContent = `${speed}×`;
};
setInterval(() => { $('time').textContent = `${engine.time.toFixed(1)} / ${engine.duration.toFixed(1)} s`; }, 100);

open(location.hash.slice(1) && scenes.some((s) => s.name === location.hash.slice(1)) ? location.hash.slice(1) : scenes[0].name);
