import { generateTimeline } from '../engine/core/pedagogyEngine.js';
import { sanitizeInput } from '../utils/validation/sanitize.js';
import sessionStore from '../engine/core/sessionStore.js';
import { resolveUserConfig, resolveModelId } from '../sockets/utils.js';

// Redundant safeParse removed. Handled by pedagogyEngine.

export const generateExplanation = async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt;
    if (!rawPrompt) return res.status(400).json({ error: 'Prompt is required' });
    const prompt = sanitizeInput(rawPrompt, 5000);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const sessionId = `api-${Date.now()}`;
    sessionStore.create(sessionId, 'api-request');

    const agentId = req.body?.agentId || req.body?.model;
    const userConfig = await resolveUserConfig(req, req.user, prompt, agentId);
    const modelId = resolveModelId(agentId);

    console.log(`[Generate] Orchestrating timeline for: "${prompt}" (Agent: ${agentId})`);
    const timeline = await generateTimeline(sessionId, prompt, undefined, modelId, userConfig);

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
    res.status(500).json({ error: 'Server error' });
  }
};
