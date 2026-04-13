/**
 * StepCritic Agent — Pedagogical Quality Control
 */

export const SCORE_STEP_PROMPT = `
You are a Pedagogical Critic for an AI learning system.
You will evaluate a single "step" from a generated teaching timeline.

EVALUATION CRITERIA:
1. clarity (0-10): Is the logic simple and easy for a beginner?
2. cognitive_minimalism (0-10): Is the step free of distractions, glow, or unnecessary visuals?
3. exam_relevance (0-10): Is the key point clear and "drawable"?
4. labeling (0-10): Are all logical units labeled? (Crucial for clarity).

INPUT STEP:
{{STEP_JSON}}

OUTPUT:
Return ONLY a JSON object:
{
  "scores": { "clarity": n, "cognitive_minimalism": n, "exam_relevance": n, "labeling": n },
  "average": n,
  "critique": "one sentence summarizing the main issue",
  "remedy": "specific instruction on how to fix it"
}
`;

import { requestCompletion, getModel } from '../utils/llmClient.js';
import tracer from '../utils/tracer.js';

export async function critiqueStep(step) {
  const prompt = SCORE_STEP_PROMPT.replace('{{STEP_JSON}}', JSON.stringify(step, null, 2));

  const start = Date.now();
  try {
    const res = await requestCompletion({
      model: getModel(),
      messages: [{ role: 'system', content: prompt }],
      temperature: 0,
      responseMimeType: 'application/json'
    });

    const raw = (res.content || '{}').replace(/```json|```/g, '').trim();
    const data = JSON.parse(raw);
    
    tracer.logCall({
      agent: 'StepCritic',
      model: getModel(),
      messages: [{ role: 'system', content: prompt }],
      response: res,
      latency: Date.now() - start
    });

    return data;
  } catch (err) {
    console.error('[StepCritic] Error:', err.message);
    // FIXED: Technical failure now returns a failing score (0) to trigger a retry or fallback
    // instead of silently passing unvalidated content.
    return { 
      average: 0, 
      scores: { clarity: 0, cognitive_minimalism: 0, exam_relevance: 0, labeling: 0 },
      critique: `Critic Technical Failure: ${err.message}`,
      remedy: "Retry or fallback to maestro."
    };
  }
}
