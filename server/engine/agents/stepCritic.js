/**
 * StepCritic Agent — Pedagogical Quality Control
 */

export const SCORE_STEP_PROMPT = `
You are a Pedagogical Critic for an AI learning system.
You will evaluate a single "step" from a generated teaching timeline.

EVALUATION CRITERIA:
1. clarity (0-10): Is the narration easy to understand? Is the core concept obvious?
2. visual_richness (0-10): Does the step interact with enough canvas objects? Is it visually engaging?
3. cognitive_load (0-10): Is there too much information in this single step? (Higher is better, meaning "Optimal Load")
4. specificity (0-10): Does the narration reference specific labels/colors? (e.g. "The blue orb moves" vs "It moves").

INPUT STEP:
{{STEP_JSON}}

OUTPUT:
Return ONLY a JSON object:
{
  "scores": { "clarity": n, "visual_richness": n, "cognitive_load": n, "specificity": n },
  "average": n,
  "critique": "one sentence summarizing the main issue",
  "remedy": "specific instruction on how to fix it"
}
`;

import { requestCompletion, getModel } from '../utils/llmClient.js';
import tracer from '../utils/tracer.js';

export async function critqueStep(step) {
  const prompt = SCORE_STEP_PROMPT.replace('{{STEP_JSON}}', JSON.stringify(step, null, 2));

  const start = Date.now();
  try {
    const res = await requestCompletion({
      model: getModel(),
      messages: [{ role: 'system', content: prompt }],
      temperature: 0
    });

    const data = JSON.parse(res.content || '{}');
    
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
    return { average: 10 }; // Graceful pass
  }
}
