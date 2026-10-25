import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index.js';
import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import CodeVisualization, { MAX_PER_USER } from '../models/CodeVisualization.js';
import { canonicalJSON, signTrace, verifyTrace } from '../visualizer/traceProof.js';
import { RUN_LIMITS } from '../controllers/compiler.controller.js';

// Judge0 is replaced here; visualizer.live.test.ts runs the real sandbox.
const judge = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../controllers/compiler.controller.js', async (orig) => ({ ...(await orig<any>()), runOnJudge0: judge.run }));

const rec = (o: object) => `\u001e${JSON.stringify(o)}\u001f`;
const frame = (name: string, line: number, vars: [string, any][] = []) => ({ i: 2, n: name, l: line, v: vars });
const num = (v: number) => ({ t: 'num', v });
const accepted = (stdout: string) => ({ stdout, stderr: '', compileOutput: '', statusId: 3, status: 'Accepted', exitCode: 0 });

const PY = {
  version: 1, language: 'python', mode: 'traced', source: 'x = 1\nprint(x)\n',
  steps: [
    { line: 1, event: 'line', frames: [{ id: 1, name: 'global', line: 1, locals: [] }], out: 0 },
    { line: 2, event: 'line', frames: [{ id: 1, name: 'global', line: 2, locals: [{ name: 'x', value: { t: 'num', v: 1 } }] }], out: 0 },
  ],
  stdout: '1\n', error: null, truncated: false, maxSteps: 1000, notes: [],
};

/* ── Signatures ─────────────────────────────────────────────────────────── */

describe('trace proofs', () => {
  it('canonical JSON ignores key order and the proof itself', () => {
    expect(canonicalJSON({ b: 1, a: [{ d: 2, c: undefined }], proof: 'x' })).toBe(canonicalJSON({ a: [{ d: 2 }], b: 1 }));
  });

  it('a proof survives a JSON round trip and breaks on any change', () => {
    const proof = signTrace(PY)!;
    expect(proof).toMatch(/^v1\.[0-9a-f]{64}$/);
    const back = JSON.parse(JSON.stringify({ ...PY, proof }));
    expect(verifyTrace(back, back.proof)).toBe(true);
    back.steps[1].frames[0].locals[0].value.v = 2; // "x was 2"
    expect(verifyTrace(back, proof)).toBe(false);
    expect(verifyTrace(PY, 'v1.' + '0'.repeat(64))).toBe(false);
    expect(verifyTrace(PY, undefined)).toBe(false);
  });

  it('the sandbox gets explicit limits with every run, network off', () => {
    expect(RUN_LIMITS).toMatchObject({ enable_network: false, cpu_time_limit: 5, wall_time_limit: 10, memory_limit: 128000, max_file_size: 1024 });
  });
});

/* ── Saving: only real runs count as real ───────────────────────────────── */

describe('saving a walkthrough', () => {
  let tokenA: string;
  let tokenB: string;
  let userA: any;

  beforeEach(async () => {
    judge.run.mockReset();
    userA = await User.create({ email: `trust-a-${Date.now()}@example.com`, password: 'password123', name: 'Ana' });
    const b = await User.create({ email: `trust-b-${Date.now()}@example.com`, password: 'password123', name: 'Ben' });
    const secret = process.env.JWT_SECRET || 'test-secret';
    tokenA = jwt.sign({ id: userA._id.toString(), jti: 'trust-a' }, secret);
    tokenB = jwt.sign({ id: b._id.toString(), jti: 'trust-b' }, secret);
  });

  async function as(token?: string) {
    const res = await request(app).get('/api/csrf-token');
    const cookies = [...(res.headers['set-cookie'] as unknown as string[]), ...(token ? [`tb-token=${token}`] : [])];
    return { csrf: res.body.csrfToken, cookies };
  }
  const save = async (who: { csrf: string; cookies: string[] }, trace: object, extra: object = {}) =>
    request(app).post('/api/visualizer/save').set('Cookie', who.cookies).set('x-csrf-token', who.csrf)
      .send({ sessionId: 'sess-t', messageId: 'msg-t', sourceHash: 'feedfacecafebeef', trace, ...extra });

  async function cTrace() {
    judge.run.mockResolvedValueOnce(accepted(rec({ e: 'call', l: 1, f: [frame('main', 1)] }) + rec({ e: 'line', l: 2, f: [frame('main', 2, [['x', num(5)]])] }) + rec({ e: 'return', l: 3, f: [frame('main', 3)], r: num(0) })));
    const guest = await as();
    const res = await request(app).post('/api/visualizer/trace').set('Cookie', guest.cookies).set('x-csrf-token', guest.csrf)
      .send({ language: 'c', source: 'int main() {\n  int x = 5;\n  return 0;\n}\n' });
    expect(res.status).toBe(200);
    return res.body.trace;
  }

  it('a C trace from the sandbox saves as a sandbox run, exactly as it came back', async () => {
    const trace = await cTrace();
    expect(trace.proof).toMatch(/^v1\./);
    const r = await save(await as(tokenA), trace);
    expect(r.status).toBe(201);
    const doc: any = await CodeVisualization.findById(r.body.id).lean();
    expect(doc).toMatchObject({ provenance: 'sandbox', status: 'completed', stepCount: 3, mode: 'instrumented' });
  });

  it('refuses a C trace whose steps were edited, or that never came from the sandbox', async () => {
    const trace = await cTrace();
    trace.steps[1].frames[0].locals[0].value.v = 99;
    const edited = await save(await as(tokenA), trace);
    expect(edited.status).toBe(400);
    expect(edited.body.code).toBe('TRACE_UNVERIFIED');
    const { proof, ...unsigned } = await cTrace();
    expect(proof).toBeTruthy();
    expect((await save(await as(tokenA), unsigned)).body.code).toBe('TRACE_UNVERIFIED');
    expect(await CodeVisualization.countDocuments({})).toBe(0);
  });

  it('saves Python and JavaScript as browser-recorded, and only in the mode they really run in', async () => {
    const a = await as(tokenA);
    const py = await save(a, PY);
    expect(py.status).toBe(201);
    expect((await CodeVisualization.findById(py.body.id).lean() as any).provenance).toBe('browser');
    const wrongMode = await save(a, { ...PY, mode: 'instrumented' }, { sourceHash: '0011223344556677' });
    expect(wrongMode.status).toBe(400);
    expect(wrongMode.body.code).toBe('TRACE_MODE');
  });

  it('keeps the JavaScript event loop with each step', async () => {
    const loop = { phase: 'macro', task: 'setTimeout → tick', now: 1000, timers: [], micro: [], waiting: [], awaiting: [{ name: 'load', line: 2 }] };
    const js = {
      ...PY, language: 'javascript', mode: 'instrumented', source: 'setTimeout(function tick() {\n  let a = 1;\n}, 1000);\n',
      steps: [
        { line: 1, event: 'line', frames: [{ id: 1, name: 'global', line: 1, locals: [] }], out: 0 },
        { line: 2, event: 'resume', frames: [{ id: 1, name: 'global', line: 1, locals: [] }, { id: 2, name: 'tick', line: 2, locals: [] }], out: 0, loop },
      ],
      stdout: '',
    };
    const r = await save(await as(tokenA), js);
    expect(r.status).toBe(201);
    const doc: any = await CodeVisualization.findById(r.body.id).lean();
    expect(doc.trace.steps[1].loop).toEqual(loop);
  });

  it('refuses steps that point outside the program or its output', async () => {
    const a = await as(tokenA);
    expect((await save(a, { ...PY, steps: [{ ...PY.steps[0], line: 9 }] })).status).toBe(400);
    expect((await save(a, { ...PY, steps: [{ ...PY.steps[0], out: 50 }] })).status).toBe(400);
  });

  it('remembers the step the learner is on, for its owner only', async () => {
    const a = await as(tokenA);
    const saved = await save(a, PY);
    const patch = (who: { csrf: string; cookies: string[] }, lastStep: number) =>
      request(app).patch(`/api/visualizer/${saved.body.id}/state`).set('Cookie', who.cookies).set('x-csrf-token', who.csrf).send({ lastStep });
    expect((await patch(a, 1)).body).toEqual({ ok: true, lastStep: 1 });
    expect((await patch(a, 40)).body.lastStep).toBe(1); // clamped to the last step
    expect((await patch(await as(tokenB), 0)).status).toBe(404);
    const found = await request(app).get('/api/visualizer/lookup').query({ sessionId: 'sess-t', messageId: 'msg-t', hash: 'feedfacecafebeef' }).set('Cookie', a.cookies);
    expect(found.body.visualization.lastStep).toBe(1);
  });

  it(`keeps each user's most recent ${MAX_PER_USER} walkthroughs`, async () => {
    const old = new Date(Date.now() - 86_400_000);
    await CodeVisualization.insertMany(Array.from({ length: MAX_PER_USER }, (_, i) => ({
      userId: userA._id, sessionId: 'old', messageId: null, language: 'python', sourceHash: `old${String(i).padStart(10, '0')}`,
      source: 'x = 1', mode: 'traced', trace: PY, createdAt: old, updatedAt: new Date(old.getTime() + i),
    })), { timestamps: false } as any);
    const r = await save(await as(tokenA), PY);
    expect(r.status).toBe(201);
    expect(await CodeVisualization.countDocuments({ userId: userA._id })).toBe(MAX_PER_USER);
    expect(await CodeVisualization.exists({ sourceHash: 'old0000000000' })).toBeNull(); // the oldest went
    expect(await CodeVisualization.exists({ _id: r.body.id })).not.toBeNull();
  });

  it('goes when its chat session is deleted', async () => {
    const chat = await ChatSession.create({ userId: userA._id, title: 'Sorting', topic: 'Sorting' });
    const a = await as(tokenA);
    const saved = await save(a, PY, { sessionId: chat._id.toString() });
    expect(saved.status).toBe(201);
    const del = await request(app).delete(`/api/sessions/${chat._id}`).set('Cookie', a.cookies).set('x-csrf-token', a.csrf).set('Authorization', `Bearer ${tokenA}`);
    expect(del.status).toBe(200);
    expect(await CodeVisualization.exists({ _id: saved.body.id })).toBeNull();
  });
});
