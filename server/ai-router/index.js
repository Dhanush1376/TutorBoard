import express from 'express';
import { routeRequest } from './router/aiRouter.js';
import { logger } from './utils/logger.js';

const router = express.Router();

/**
 * POST /api/ask
 * Standardized AI inquiry endpoint
 */
router.post('/ask', async (req, res) => {
  const { query, options } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const result = await routeRequest(query, options);
    res.json(result);
  } catch (err) {
    logger.error("All providers failed in /api/ask", err);
    res.status(503).json({ 
      error: "AI Services Temporarily Unavailable",
      message: "All attempts to generate a response failed. Please try again later."
    });
  }
});

export default router;
export { routeRequest };
