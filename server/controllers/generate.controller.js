import { getAIClient, getModel } from '../engine/ai/llmClient.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { TEACHING_TIMELINE_PROMPT } from '../engine/prompts/index.js';

const SYSTEM_PROMPT = TEACHING_TIMELINE_PROMPT;

function safeParse(content) {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/<[\/]?think>/gi, '').trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export const generateExplanation = async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt;
    if (!rawPrompt) return res.status(400).json({ error: 'Prompt is required' });
    const prompt = sanitizeInput(rawPrompt, 5000);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Generate] Attempt ${attempt + 1}/3`);
        
        const ai = getAIClient();
        const completion = await ai.chat.completions.create({
          model: getModel(),
          temperature: attempt === 0 ? 0.3 : 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          max_tokens: 4000,
        });

        const raw = completion.choices[0].message.content;
        const parsed = safeParse(raw);
        
        if (parsed && parsed.objects && parsed.steps) {
          console.log(`[Generate] ✅ Success`);
          if (!parsed.visualizationType) parsed.visualizationType = 'scene';
          if (!parsed.domain) parsed.domain = 'general';
          return res.json(parsed);
        }
      } catch (err) {
        console.error(`[Generate] Error:`, err.message);
      }
    }

    return res.json({ error: 'Failed to generate' });
  } catch (error) {
    console.error('[Generate] Critical:', error);
    res.json({ error: 'Server error' });
  }
};
