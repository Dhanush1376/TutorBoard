import { handleDoubt } from '../engine/core/pedagogyEngine.js';
import sessionStore from '../engine/core/sessionStore.js';



// Redundant prompt and retry logic removed. Handled by pedagogyEngine.

export const answerDoubt = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const sessionId = `api-doubt-${Date.now()}`;
    sessionStore.create(sessionId, 'api-request');

    console.log(`[Doubt] Processing orchestrated query: "${question}"`);
    const data = await handleDoubt(sessionId, question);

    res.json(data);
  } catch (error) {
    console.error('[TutorBoard] Critical error in answerDoubt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/doubts/history
 */
export const getDoubtHistory = async (req, res) => {
  try {
    // MongoDB removed — returning empty history for now
    res.json({ history: [] });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
