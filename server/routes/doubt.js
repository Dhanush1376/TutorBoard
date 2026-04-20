import express from 'express';
import { answerDoubt, getDoubtHistory } from '../controllers/doubt.controller.js';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';
import { validateBody, DoubtSchema } from '../middleware/validation.middleware.js';

const router = express.Router();

// SEC-10: Harden doubt route with optional auth identification + strict guest rate limiting
router.post('/doubt', optionalProtect, strictGuestLimiter, validateBody(DoubtSchema), answerDoubt);

router.get('/api/doubts/history', protect, getDoubtHistory);

export default router;
