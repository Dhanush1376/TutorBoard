import express, { Request, Response, NextFunction } from 'express';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { codeRunLimiter, aiRateLimiter, strictGuestLimiter } from '../middleware/rateLimiter.js';
import {
  traceProgram,
  saveVisualization,
  lookupVisualization,
  listSessionVisualizations,
  getVisualization,
  deleteVisualization,
  updateVisualizationState,
  explainStep,
} from '../controllers/visualizer.controller.js';

const router = express.Router();

// Same rule as the code runner: guests may step through code (rate limited);
// a signed-in request must carry a valid token.
const protectIfSignedIn = (req: Request, res: Response, next: NextFunction) => {
  const hasToken = req.cookies?.['tb-access-token'] || req.cookies?.['tb-token'] || (req.headers.authorization || '').startsWith('Bearer');
  return hasToken ? protect(req, res, next) : next();
};

router.post('/trace', codeRunLimiter, protectIfSignedIn, traceProgram);
router.post('/explain', optionalProtect, strictGuestLimiter, aiRateLimiter, explainStep);

// Saved walkthroughs belong to an account.
router.post('/save', protect, express.json({ limit: '3mb' }), saveVisualization);
router.get('/lookup', protect, lookupVisualization);
router.get('/session/:sessionId', protect, listSessionVisualizations);
router.get('/:id', protect, getVisualization);
router.patch('/:id/state', protect, updateVisualizationState);
router.delete('/:id', protect, deleteVisualization);

export default router;
