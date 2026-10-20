/**
 * Dev-only endpoints for the client's Scene Lab: question → validated scene.
 * Mounted only when ENABLE_SCENE_LAB=1 outside production (they call the LLM
 * without auth, so they must never be exposed in a deployment).
 *
 *   POST /api/scene/generate  → JSON PlanResult when the whole scene is ready
 *   POST /api/scene/stream    → SSE: `stage`, `partial` (header + finished beats), `done`
 *   POST /api/scene/doubt     → a question about a lesson on the board → a branch of that lesson
 */
import { Router, type Request, type Response } from 'express';
import { planScene } from '../engine/scene/planner.js';
import { sceneModel } from '../engine/scene/lesson.js';
import { planDoubt } from '../engine/scene/doubt.js';

const router = Router();

/** The levels Gemini's OpenAI-compatible API accepts (it rejects none/minimal with a 400). */
const EFFORTS = ['low', 'medium', 'high'] as const;
type Effort = (typeof EFFORTS)[number];
/**
 * Request override, else SCENE_REASONING, else the model's own default — which
 * we keep: on the 7-question benchmark "low" made physics wrong (reversed
 * friction, misdirected components) and its speed-up was lost in provider
 * latency noise (docs/eval/runs/flash36-low, flash36-low-v2).
 */
const effortOf = (req: Request): Effort | undefined => {
  const v = req.body?.reasoning ?? process.env.SCENE_REASONING;
  return (EFFORTS as readonly string[]).includes(v) ? (v as Effort) : undefined;
};

const questionOf = (req: Request) => (typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 500) : '');

router.post('/api/scene/generate', async (req: Request, res: Response) => {
  const question = questionOf(req);
  if (!question) return res.status(400).json({ error: 'question is required' });
  const model = sceneModel(req.body?.quality, req.body?.model);
  const controller = new AbortController();
  req.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const result = await planScene(question, { model, signal: controller.signal, reasoningEffort: effortOf(req), keepDrafts: req.body?.debug === true });
    console.log(`[SceneLab] "${question}" → ${result.ok ? 'ok' : 'FAILED'} in ${result.ms} ms, ${result.attempts} attempt(s), model ${result.model}`);
    res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/api/scene/stream', async (req: Request, res: Response) => {
  const question = questionOf(req);
  if (!question) return res.status(400).json({ error: 'question is required' });
  const model = sceneModel(req.body?.quality, req.body?.model);
  const controller = new AbortController();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as Response & { flush?: () => void }).flush?.();
  };
  const heartbeat = setInterval(() => send('heartbeat', {}), 15000);
  res.on('close', () => { clearInterval(heartbeat); if (!res.writableEnded) controller.abort(); });
  try {
    const result = await planScene(question, {
      model,
      signal: controller.signal,
      reasoningEffort: effortOf(req),
      onStage: (stage, attempt) => send('stage', { stage, attempt }),
      onPartial: (scene, info) => send('partial', { scene, ...info }),
    });
    console.log(`[SceneLab] stream "${question}" → ${result.ok ? 'ok' : 'FAILED'} in ${result.ms} ms (first beat ${result.ok ? result.firstBeatMs ?? '–' : '–'} ms), ${result.attempts} attempt(s)`);
    send('done', result);
  } catch (err) {
    send('error', { error: (err as Error).message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/** A question about a lesson on the board → a branch of that lesson (doubts, Phase 4). */
router.post('/api/scene/doubt', async (req: Request, res: Response) => {
  const question = questionOf(req);
  const scene = req.body?.scene;
  const beatIndex = Number(req.body?.beatIndex) || 0;
  if (!question || !scene || typeof scene !== 'object') return res.status(400).json({ error: 'question and scene are required' });
  const controller = new AbortController();
  req.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const result = await planDoubt(question, scene, beatIndex, {
      model: sceneModel(req.body?.quality, req.body?.model),
      signal: controller.signal,
      reasoningEffort: effortOf(req),
    });
    console.log(`[SceneLab] doubt "${question}" → ${result.ok ? result.kind : 'FAILED'} in ${result.ms} ms, ${result.attempts} attempt(s)`);
    res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
