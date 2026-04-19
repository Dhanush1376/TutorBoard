/**
 * DoubtClassifier Agent — Strategic Inquiry Analysis
 */

export const DOUBT_CLASSIFICATION_PROMPT = `
You are a Doubt Classification Agent in a high-fidelity AI tutoring system.
Your goal is to categorize a student's inquiry into one of the following strategic paths.

PATHWAYS:
1. off_topic: The question is unrelated to the current lesson or general education.
2. wants_example: Student is asking for a concrete worked example or code.
3. wants_deeper: Student is asking "Why" or "How does this work internally" (theoretical depth).
4. misconception: Student has stated something factually incorrect or shows confusion about a previous step.
5. procedural: Student is asking about UI, navigation, or "What do I do next?".
6. conceptual: Standard clarifying question about the core topic.

INPUT:
Topic: "{{TOPIC}}"
Question: "{{QUESTION}}"

OUTPUT:
Return ONLY a JSON object:
{
  "pathway": "pathway_name",
  "reasoning": "one sentence explaining why",
  "confidence": 0.0 - 1.0,
  "bridge_suggestion": "if off_topic, how to connect it back"
}
`;

import { requestCompletion, getModel } from '../../utils/ai/llmClient.js';
import { safeParse } from '../../utils/core/parser.js';

export async function classifyDoubt(topic, question) {
  const prompt = DOUBT_CLASSIFICATION_PROMPT
    .replaceAll('{{TOPIC}}', topic || 'General Education')
    .replaceAll('{{QUESTION}}', question || '');

  if (prompt.includes('{{TOPIC}}') || prompt.includes('{{QUESTION}}')) {
    console.error('[DoubtClassifier] CRITICAL: Placeholders not fully replaced!');
    throw new Error('Placeholder replacement failed in doubtClassifier');
  }

  try {
    const res = await requestCompletion({
      model: getModel(),
      messages: [{ role: 'system', content: prompt }],
      temperature: 0
    });

    const parsed = safeParse(res.content);
    if (!parsed || !parsed.pathway) {
      console.warn('[DoubtClassifier] safeParse returned null or missing pathway, using fallback.');
      return { pathway: 'conceptual', confidence: 0.5 };
    }
    return parsed;
  } catch (err) {
    console.error('[DoubtClassifier] Error:', err.message);
    return { pathway: 'conceptual', confidence: 0.5 };
  }
}
