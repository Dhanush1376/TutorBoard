import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import CodeVisualization from '../models/CodeVisualization.js';
import { traceCompiled, TraceInputError, COMPILED_LANGUAGES, CompiledLanguage } from '../visualizer/traceService.js';
import { Judge0Unavailable } from './compiler.controller.js';
import { requestCompletion, getTextModel, resolveModelId } from '../utils/ai/llmClient.js';
import { resolveUserConfig } from '../sockets/utils.js';

const LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c'] as const;
const MAX_TRACE_BYTES = 2_500_000;

/* ── POST /api/visualizer/trace ─────────────────────────────────────────── */

const traceSchema = z.object({
  language: z.enum(LANGUAGES),
  source: z.string().min(1).max(20000),
  stdin: z.string().max(10000).optional().default(''),
});

/** Step through a C, C++ or Java program (Python and JavaScript are traced in the browser). */
export const traceProgram = async (req: Request, res: Response) => {
  const parsed = traceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send a language, the code, and optional input.' });
  const { language, source, stdin } = parsed.data;
  if (!COMPILED_LANGUAGES.includes(language as CompiledLanguage)) {
    return res.status(400).json({ error: `${language} is stepped through in the browser, not on the server.` });
  }
  try {
    const trace = await traceCompiled(language as CompiledLanguage, source, stdin);
    return res.json({ trace });
  } catch (err: any) {
    if (err instanceof TraceInputError) return res.status(400).json({ error: err.message });
    if (err instanceof Judge0Unavailable) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error('[Visualizer] trace failed:', err?.message);
    return res.status(500).json({ error: 'The step-through could not run this program.' });
  }
};

/* ── Saving ─────────────────────────────────────────────────────────────── */

// The shape the player relies on; anything else is refused rather than stored.
const savedTraceSchema = z.object({
  version: z.literal(1),
  language: z.enum(LANGUAGES),
  mode: z.enum(['traced', 'instrumented', 'simulated']),
  source: z.string().max(20000),
  steps: z.array(z.object({
    line: z.number().int().min(1),
    event: z.enum(['line', 'call', 'return', 'exception']),
    frames: z.array(z.object({ id: z.number(), name: z.string().max(200), line: z.number(), locals: z.array(z.object({ name: z.string().max(200), value: z.any() })) })).min(1),
    out: z.number().int().min(0),
    ret: z.any().optional(),
    exc: z.string().max(2000).optional(),
  })).max(1000),
  stdout: z.string().max(200000),
  error: z.object({ kind: z.string().max(20), message: z.string().max(5000), line: z.number().nullable().optional() }).nullable(),
  truncated: z.boolean(),
  maxSteps: z.number().int().positive(),
  notes: z.array(z.string().max(500)).max(20),
});

const saveSchema = z.object({
  sessionId: z.string().min(1).max(100),
  messageId: z.string().max(100).nullable().optional(),
  sourceHash: z.string().regex(/^[0-9a-f]{8,64}$/),
  title: z.string().max(200).optional(),
  stdin: z.string().max(10000).optional().default(''),
  trace: savedTraceSchema,
});

const userIdOf = (req: Request) => (req as any).user?._id;

/** POST /api/visualizer/save — store a trace once per session + message + program. */
export const saveVisualization = async (req: Request, res: Response) => {
  if (JSON.stringify(req.body || {}).length > MAX_TRACE_BYTES) return res.status(413).json({ error: 'This walkthrough is too large to save.' });
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'That walkthrough is not in a format that can be saved.' });
  const { sessionId, messageId = null, sourceHash, title, stdin, trace } = parsed.data;
  const userId = userIdOf(req);
  const key = { userId, sessionId, messageId: messageId || null, sourceHash };
  try {
    const doc = await CodeVisualization.findOneAndUpdate(
      key,
      {
        $set: {
          language: trace.language,
          title: title || `${trace.language} walkthrough`,
          source: trace.source,
          stdin,
          mode: trace.mode,
          stepCount: trace.steps.length,
          trace,
        },
        $setOnInsert: key,
      },
      { upsert: true, new: true, includeResultMetadata: true, setDefaultsOnInsert: true },
    );
    const value: any = (doc as any).value;
    const created = !(doc as any).lastErrorObject?.updatedExisting;
    return res.status(created ? 201 : 200).json({ id: value._id, created });
  } catch (err: any) {
    // Two saves of the same walkthrough at once: the unique index lets one in; the other finds it.
    if (err?.code === 11000) {
      const existing: any = await CodeVisualization.findOne(key).select('_id').lean();
      if (existing) return res.json({ id: existing._id, created: false });
    }
    console.error('[Visualizer] save failed:', err?.message);
    return res.status(500).json({ error: 'Could not save the walkthrough.' });
  }
};

/** GET /api/visualizer/lookup?sessionId&messageId&hash — the saved walkthrough for this code, if any. */
export const lookupVisualization = async (req: Request, res: Response) => {
  const sessionId = String(req.query.sessionId || '');
  const hash = String(req.query.hash || '');
  const messageId = req.query.messageId ? String(req.query.messageId) : null;
  if (!sessionId || !/^[0-9a-f]{8,64}$/.test(hash)) return res.status(400).json({ error: 'sessionId and hash are required.' });
  const doc = await CodeVisualization.findOne({ userId: userIdOf(req), sessionId, messageId, sourceHash: hash }).lean();
  return res.json({ visualization: doc || null });
};

/** GET /api/visualizer/session/:sessionId — what's been visualized in a session (no traces). */
export const listSessionVisualizations = async (req: Request, res: Response) => {
  const docs = await CodeVisualization.find({ userId: userIdOf(req), sessionId: req.params.sessionId })
    .select('_id title language messageId stepCount mode updatedAt sourceHash')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  return res.json({ visualizations: docs });
};

export const getVisualization = async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  const doc = await CodeVisualization.findOne({ _id: req.params.id, userId: userIdOf(req) }).lean();
  if (!doc) return res.status(404).json({ error: 'Not found.' });
  return res.json({ visualization: doc });
};

export const deleteVisualization = async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  const r = await CodeVisualization.deleteOne({ _id: req.params.id, userId: userIdOf(req) });
  if (!r.deletedCount) return res.status(404).json({ error: 'Not found.' });
  return res.json({ ok: true });
};

/* ── POST /api/visualizer/explain ───────────────────────────────────────── */

const explainSchema = z.object({
  language: z.enum(LANGUAGES),
  source: z.string().min(1).max(20000),
  step: z.object({
    index: z.number().int().min(0),
    total: z.number().int().min(1),
    line: z.number().int().min(1),
    event: z.string().max(20),
    stack: z.array(z.string().max(200)).max(70),
    variables: z.array(z.string().max(400)).max(60),
    changes: z.array(z.string().max(400)).max(10),
    output: z.string().max(2000),
    error: z.string().max(2000).optional(),
    simulated: z.boolean().optional(),
  }),
  question: z.string().max(1000).optional(),
  history: z.array(z.object({ q: z.string().max(1000), a: z.string().max(4000) })).max(6).optional(),
  visualizationId: z.string().max(40).optional(),
});

export const explainStep = async (req: Request, res: Response) => {
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send the code, the step, and an optional question.' });
  const { language, source, step, question, history = [], visualizationId } = parsed.data;

  const lines = source.split('\n');
  const from = Math.max(0, step.line - 12);
  const excerpt = lines.slice(from, step.line + 8).map((l, i) => `${from + i + 1}${from + i + 1 === step.line ? ' →' : '  '} ${l}`).join('\n');
  const facts = [
    `Language: ${language}`,
    `Step ${step.index + 1} of ${step.total}. Event: ${step.event}. About to run line ${step.line}: ${(lines[step.line - 1] || '').trim()}`,
    `Call stack (outermost first): ${step.stack.join(' → ') || 'none'}`,
    `Variables in the running function: ${step.variables.join('; ') || 'none yet'}`,
    `What changed since the previous step: ${step.changes.join('; ') || 'nothing'}`,
    `Output so far (end): ${step.output ? JSON.stringify(step.output.slice(-400)) : 'nothing printed yet'}`,
    step.error ? `The run ended with: ${step.error}` : '',
    step.simulated ? 'NOTE: this trace is a simulation, not a real run.' : 'This trace was recorded from a real run of the program.',
  ].filter(Boolean).join('\n');

  const system = `You are TutorBoard's patient programming tutor. A learner is stepping through a program one step at a time.
Explain using only the facts given about the run. Never invent variable values, output, or steps that are not in the facts.
If the facts don't answer the question, say what the learner could look at next instead of guessing.
Use plain, friendly words a beginner understands. Keep it under 120 words. Use \`code\` for names and values. No headings.`;

  const messages: any[] = [{ role: 'system', content: system }];
  for (const h of history) {
    messages.push({ role: 'user', content: h.q }, { role: 'assistant', content: h.a });
  }
  messages.push({
    role: 'user',
    content: `Code around the current line:\n\`\`\`${language}\n${excerpt}\n\`\`\`\n\nFacts about this step:\n${facts}\n\nQuestion: ${question?.trim() || 'What is happening at this step, and why?'}`,
  });

  try {
    const base = await resolveUserConfig(req, (req as any).user, question || '');
    const userConfig: any = base ? { ...base } : { useCustomApi: false };
    if (req.headers['x-e2e-mock-ai'] && (process.env.NODE_ENV === 'test' || String(process.env.E2E_MODE) === 'true')) userConfig.isE2EMock = true;
    const result = await requestCompletion({
      model: resolveModelId(getTextModel()),
      messages,
      temperature: 0.3,
      maxTokens: 400,
      userConfig,
      taskType: 'explanation',
    } as any);
    if (result.error || !result.content) {
      return res.status(502).json({ error: 'The explanation could not be written right now. Try again in a moment.' });
    }
    const answer = String(result.content).trim().slice(0, 6000);
    const userId = userIdOf(req);
    if (visualizationId && userId && mongoose.isValidObjectId(visualizationId)) {
      await CodeVisualization.updateOne(
        { _id: visualizationId, userId },
        { $push: { followUps: { $each: [{ step: step.index, question: question || '', answer }], $slice: -100 } } },
      );
    }
    return res.json({ answer });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('SYSTEM_NOT_CONFIGURED')) return res.status(503).json({ error: 'Explanations need an AI key. Add your own in Settings → API keys.' });
    console.error('[Visualizer] explain failed:', msg);
    return res.status(502).json({ error: 'The explanation could not be written right now. Try again in a moment.' });
  }
};
