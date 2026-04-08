import { generateTimeline } from '../engine/core/pedagogyEngine.js';
import { sanitizeInput } from '../utils/sanitize.js';
import sessionStore from '../engine/core/sessionStore.js';

// Redundant safeParse removed. Handled by pedagogyEngine.

export const generateExplanation = async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt;
    if (!rawPrompt) return res.status(400).json({ error: 'Prompt is required' });
    const prompt = sanitizeInput(rawPrompt, 5000);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const sessionId = `api-${Date.now()}`;
    sessionStore.create(sessionId, 'api-request');

    console.log(`[Generate] Orchestrating timeline for: "${prompt}"`);
    const timeline = await generateTimeline(sessionId, prompt);

    if (timeline && timeline.steps) {
      console.log(`[Generate] ✅ Orchestration Success`);
      return res.json(timeline);
    }

    // Safety fallback: prevents the request from hanging if orchestration fails/offline
    return res.status(500).json({ 
      error: 'Timeline generation failed. Please check server logs and try again.' 
    });

  } catch (error) {
    console.error('[Generate] Critical:', error);
    res.json({ error: 'Server error' });
  }
};
