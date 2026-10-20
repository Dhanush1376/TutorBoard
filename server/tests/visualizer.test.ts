import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index.js';
import User from '../models/User.js';
import CodeVisualization from '../models/CodeVisualization.js';
import { parseTraceOutput } from '../visualizer/parseTrace.js';
import { instrumentJava } from '../visualizer/instrumentJava.js';
import { instrumentCFamily } from '../visualizer/instrumentCFamily.js';

// Judge0 is replaced here; visualizer.live.test.ts runs the real sandbox.
const judge = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../controllers/compiler.controller.js', async (orig) => ({ ...(await orig<any>()), runOnJudge0: judge.run }));

const LIMITS = { maxSteps: 500, maxBytes: 700_000 };
const rec = (o: object) => `\u001e${JSON.stringify(o)}\u001f`;
const frame = (name: string, line: number, vars: [string, any][] = [], id = 2) => ({ i: id, n: name, l: line, v: vars });
const num = (v: number) => ({ t: 'num', v });
const accepted = (stdout: string) => ({ stdout, stderr: '', compileOutput: '', statusId: 3, status: 'Accepted', exitCode: 0 });

/* ── Output parsing ─────────────────────────────────────────────────────── */

describe('parseTraceOutput', () => {
  it('separates the program output from step records and keeps output positions', () => {
    const raw = rec({ e: 'call', l: 1, f: [frame('main', 1)] }) + 'hello ' + rec({ e: 'line', l: 2, f: [frame('main', 2, [['x', num(3)]])] }) + 'world\n';
    const p = parseTraceOutput(raw, 5);
    expect(p.stdout).toBe('hello world\n');
    expect(p.steps.map((s) => [s.event, s.line, s.out])).toEqual([['call', 1, 0], ['line', 2, 6]]);
    expect(p.steps[1].frames[0].locals).toEqual([{ name: 'x', value: num(3) }]);
  });

  it('marks a run cut off mid-record and keeps the complete steps', () => {
    const raw = rec({ e: 'line', l: 1, f: [frame('main', 1)] }) + '\u001e{"e":"line","l":2,"f":[';
    const p = parseTraceOutput(raw, 3);
    expect(p.steps).toHaveLength(1);
    expect(p.cutOff).toBe(true);
  });

  it('reports the step limit and clamps out-of-range lines', () => {
    const raw = rec({ e: 'line', l: 99, f: [frame('main', 99)] }) + rec({ e: 'limit', why: 'steps' });
    const p = parseTraceOutput(raw, 4);
    expect(p.truncated).toBe(true);
    expect(p.limitReason).toBe('steps');
    expect(p.steps[0].line).toBe(4);
  });

  it('keeps return values and exception messages', () => {
    const raw = rec({ e: 'return', l: 3, f: [frame('f', 3)], r: num(6) }) + rec({ e: 'exception', l: 4, f: [frame('f', 4)], m: 'java.lang.ArithmeticException: / by zero' });
    const p = parseTraceOutput(raw, 5);
    expect(p.steps[0].ret).toEqual(num(6));
    expect(p.steps[1].exc).toMatch(/by zero/);
  });
});

/* ── Instrumentation (text only) ────────────────────────────────────────── */

describe('instrumentation', () => {
  it('keeps every learner line where it was (no inserted line breaks)', async () => {
    const java = 'public class Main {\n  public static void main(String[] a) {\n    int x = 1;\n    for (int i = 0; i < 3; i++) x += i;\n    System.out.println(x);\n  }\n}\n';
    const { code } = await instrumentJava(java, LIMITS);
    const userPart = code.slice(0, code.indexOf('/* ---- TutorBoard step recorder'));
    expect(userPart.trimEnd().split('\n').length).toBe(java.trimEnd().split('\n').length);
    const c = 'int main() {\n  int s = 0;\n  for (int i = 0; i < 3; i++) s += i;\n  return s;\n}\n';
    const out = await instrumentCFamily(c, 'c', LIMITS);
    const after = out.code.slice(out.code.indexOf('#line 1 "main.c"\n') + '#line 1 "main.c"\n'.length);
    expect(after.slice(0, after.indexOf('/* ---- TutorBoard step recorder: struct')).trimEnd().split('\n').length).toBe(c.trimEnd().split('\n').length);
  });

  it('leaves Java constant loops alone so the compiler still sees they never fall through', async () => {
    const java = 'public class Main {\n  static int f() {\n    while (true) {\n      return 1;\n    }\n  }\n  public static void main(String[] a) { f(); for (;;) { break; } }\n}\n';
    const { code } = await instrumentJava(java, LIMITS);
    expect(code).toContain('while (true)');
    expect(code).toContain('for (;;)');
  });

  it('shows a Java variable only once it is definitely assigned', async () => {
    const java = 'public class Main {\n  public static void main(String[] a) {\n    int k;\n    System.out.println(1);\n    k = 2;\n    System.out.println(k);\n  }\n}\n';
    const { code } = await instrumentJava(java, LIMITS);
    const line4 = code.split('\n')[3];
    const line6 = code.split('\n')[5];
    expect(line4).not.toMatch(/"k"/);
    expect(line6).toMatch(/new String\[\]\{"a","k"\}/);
  });

  it('keeps a constructor\'s this(...) / super(...) call first', async () => {
    const java = 'public class Main {\n  int v;\n  Main() { this(1); }\n  Main(int x) { super(); v = x; }\n  public static void main(String[] a) { new Main(); }\n}\n';
    const { code } = await instrumentJava(java, LIMITS);
    expect(code).toMatch(/Main\(\) \{ this\(1\);__TB\.Fr __f/);
    expect(code).toMatch(/Main\(int x\) \{ super\(\);__TB\.Fr __f/);
  });

  it('wraps C++ returns so the returned value is recorded', async () => {
    const { code } = await instrumentCFamily('int sq(int x) {\n  return x * x;\n}\nint main() { return sq(3); }\n', 'cpp', LIMITS);
    expect(code).toContain('auto&& __tb_r=(x * x)');
    expect(code).toContain('::__tb::tbRet(__tb_r)');
  });
});

/* ── Tracing through the (mocked) sandbox ───────────────────────────────── */

describe('POST /api/visualizer/trace', () => {
  async function csrf() {
    const res = await request(app).get('/api/csrf-token');
    return { token: res.body.csrfToken, cookies: res.headers['set-cookie'] as unknown as string[] };
  }

  beforeEach(() => judge.run.mockReset());

  it('lets a guest step through C and returns a valid trace', async () => {
    judge.run.mockResolvedValueOnce(accepted(rec({ e: 'call', l: 1, f: [frame('main', 1)] }) + 'hi\n' + rec({ e: 'return', l: 3, f: [frame('main', 3)], r: num(0) })));
    const { token, cookies } = await csrf();
    const res = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token)
      .send({ language: 'c', source: 'int main() {\n  return 0;\n}\n' });
    expect(res.status).toBe(200);
    expect(res.body.trace).toMatchObject({ version: 1, language: 'c', mode: 'instrumented', stdout: 'hi\n', error: null });
    expect(res.body.trace.steps).toHaveLength(2);
    // What went to the sandbox was the instrumented program, not this process.
    expect(judge.run.mock.calls[0][1]).toContain('TutorBoard step recorder');
  });

  it('reports the learner\'s own compile error from a plain build', async () => {
    judge.run
      .mockResolvedValueOnce({ stdout: '', stderr: '', compileOutput: 'x', statusId: 6, status: 'Compilation Error', exitCode: null })
      .mockResolvedValueOnce({ stdout: '', stderr: '', compileOutput: "main.c:2:3: error: expected ';' before '}' token", statusId: 6, status: 'Compilation Error', exitCode: null });
    const { token, cookies } = await csrf();
    const res = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token)
      .send({ language: 'c', source: 'int main() {\n  return 0\n}\n' });
    expect(res.status).toBe(200);
    expect(res.body.trace.error).toMatchObject({ kind: 'compile', line: 2 });
    expect(judge.run.mock.calls[1][1]).toBe('int main() {\n  return 0\n}\n');
  });

  it('says so honestly when only the step markers fail to build', async () => {
    judge.run
      .mockResolvedValueOnce({ stdout: '', stderr: '', compileOutput: 'error in __tb', statusId: 6, status: 'Compilation Error', exitCode: null })
      .mockResolvedValueOnce(accepted('42\n'));
    const { token, cookies } = await csrf();
    const res = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token)
      .send({ language: 'cpp', source: 'int main() { return 0; }' });
    expect(res.body.trace.steps).toHaveLength(0);
    expect(res.body.trace.stdout).toBe('42\n');
    expect(res.body.trace.error.kind).toBe('setup');
  });

  it('maps a crash to a plain message at the last line that ran', async () => {
    judge.run.mockResolvedValueOnce({ stdout: rec({ e: 'line', l: 2, f: [frame('main', 2)] }), stderr: '', compileOutput: '', statusId: 7, status: 'Runtime Error (SIGSEGV)', exitCode: 139 });
    const { token, cookies } = await csrf();
    const res = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token)
      .send({ language: 'c', source: 'int main() {\n  int *p = 0; *p = 1;\n}\n' });
    expect(res.body.trace.error).toMatchObject({ kind: 'runtime', line: 2 });
    expect(res.body.trace.error.message).toMatch(/segmentation fault/);
  });

  it('refuses Python and JavaScript (traced in the browser) and bad input', async () => {
    const { token, cookies } = await csrf();
    const py = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token).send({ language: 'python', source: 'print(1)' });
    expect(py.status).toBe(400);
    const big = await request(app).post('/api/visualizer/trace').set('Cookie', cookies).set('x-csrf-token', token).send({ language: 'c', source: 'x'.repeat(20001) });
    expect(big.status).toBe(400);
    expect(judge.run).not.toHaveBeenCalled();
  });
});

/* ── Saving without duplicates ──────────────────────────────────────────── */

const TRACE = {
  version: 1, language: 'python', mode: 'traced', source: 'x = 1\nprint(x)\n',
  steps: [
    { line: 1, event: 'line', frames: [{ id: 1, name: 'global', line: 1, locals: [] }], out: 0 },
    { line: 2, event: 'line', frames: [{ id: 1, name: 'global', line: 2, locals: [{ name: 'x', value: { t: 'num', v: 1 } }] }], out: 0 },
  ],
  stdout: '1\n', error: null, truncated: false, maxSteps: 1000, notes: [],
};

describe('saved walkthroughs', () => {
  let tokenA: string;
  let tokenB: string;
  const secret = process.env.JWT_SECRET || 'test-secret';

  beforeEach(async () => {
    const a = await User.create({ email: `viz-a-${Date.now()}@example.com`, password: 'password123', name: 'Ana' });
    const b = await User.create({ email: `viz-b-${Date.now()}@example.com`, password: 'password123', name: 'Ben' });
    tokenA = jwt.sign({ id: a._id.toString(), jti: 'viz-a' }, secret);
    tokenB = jwt.sign({ id: b._id.toString(), jti: 'viz-b' }, secret);
  });

  async function as(token: string) {
    const res = await request(app).get('/api/csrf-token');
    return { csrf: res.body.csrfToken, cookies: [...(res.headers['set-cookie'] as unknown as string[]), `tb-token=${token}`] };
  }
  const body = { sessionId: 'sess-1', messageId: 'msg-7', sourceHash: 'abcdef0123456789', trace: TRACE };

  it('requires an account', async () => {
    const res = await request(app).get('/api/csrf-token');
    const r = await request(app).post('/api/visualizer/save').set('Cookie', res.headers['set-cookie']).set('x-csrf-token', res.body.csrfToken).send(body);
    expect(r.status).toBe(401);
  });

  it('saves once per session + message + program, however often it is saved', async () => {
    const { csrf, cookies } = await as(tokenA);
    const first = await request(app).post('/api/visualizer/save').set('Cookie', cookies).set('x-csrf-token', csrf).send(body);
    expect(first.status).toBe(201);
    const again = await request(app).post('/api/visualizer/save').set('Cookie', cookies).set('x-csrf-token', csrf).send(body);
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id: first.body.id, created: false });
    const both = await Promise.all([1, 2, 3].map(() => request(app).post('/api/visualizer/save').set('Cookie', cookies).set('x-csrf-token', csrf).send(body)));
    expect(both.every((r) => r.body.id === first.body.id)).toBe(true);
    expect(await CodeVisualization.countDocuments({})).toBe(1);

    const found = await request(app).get('/api/visualizer/lookup').query({ sessionId: 'sess-1', messageId: 'msg-7', hash: 'abcdef0123456789' }).set('Cookie', cookies);
    expect(found.body.visualization.trace.steps).toHaveLength(2);
    const list = await request(app).get('/api/visualizer/session/sess-1').set('Cookie', cookies);
    expect(list.body.visualizations).toHaveLength(1);
    expect(list.body.visualizations[0].trace).toBeUndefined();
  });

  it('keeps each person\'s walkthroughs private', async () => {
    const a = await as(tokenA);
    const saved = await request(app).post('/api/visualizer/save').set('Cookie', a.cookies).set('x-csrf-token', a.csrf).send(body);
    const b = await as(tokenB);
    expect((await request(app).get(`/api/visualizer/${saved.body.id}`).set('Cookie', b.cookies)).status).toBe(404);
    expect((await request(app).delete(`/api/visualizer/${saved.body.id}`).set('Cookie', b.cookies).set('x-csrf-token', b.csrf)).status).toBe(404);
    const lookup = await request(app).get('/api/visualizer/lookup').query({ sessionId: 'sess-1', messageId: 'msg-7', hash: 'abcdef0123456789' }).set('Cookie', b.cookies);
    expect(lookup.body.visualization).toBeNull();
    expect((await request(app).get(`/api/visualizer/${saved.body.id}`).set('Cookie', a.cookies)).status).toBe(200);
  });

  it('refuses a trace that isn\'t in the trace format', async () => {
    const { csrf, cookies } = await as(tokenA);
    const bad = { ...body, trace: { ...TRACE, steps: [{ line: 0, event: 'jump', frames: [], out: -1 }] } };
    const r = await request(app).post('/api/visualizer/save').set('Cookie', cookies).set('x-csrf-token', csrf).send(bad);
    expect(r.status).toBe(400);
  });

  it('explains a step and keeps the follow-up with the saved walkthrough', async () => {
    const { csrf, cookies } = await as(tokenA);
    const saved = await request(app).post('/api/visualizer/save').set('Cookie', cookies).set('x-csrf-token', csrf).send(body);
    // optionalProtect reads the access-token cookie or a Bearer header.
    const r = await request(app).post('/api/visualizer/explain').set('Cookie', cookies).set('Authorization', `Bearer ${tokenA}`).set('x-csrf-token', csrf).set('x-e2e-mock-ai', '1')
      .send({
        language: 'python', source: TRACE.source, visualizationId: saved.body.id, question: 'Why is x 1?',
        step: { index: 1, total: 2, line: 2, event: 'line', stack: ['Global'], variables: ['x = 1'], changes: ['New: x = 1'], output: '' },
      });
    expect(r.status).toBe(200);
    expect(typeof r.body.answer).toBe('string');
    const doc: any = await CodeVisualization.findById(saved.body.id).lean();
    expect(doc.followUps).toHaveLength(1);
    expect(doc.followUps[0]).toMatchObject({ step: 1, question: 'Why is x 1?' });
  });
});
