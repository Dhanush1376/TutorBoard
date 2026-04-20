import express from 'express';
import { generateExplanation } from '../controllers/generate.controller.js';
import { validateBody, GenerateSchema } from '../middleware/validation.middleware.js';
import { optionalProtect } from '../middleware/auth.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// SEC-10: Harden generate route with optional auth identification + strict guest rate limiting
router.post('/api/generate', optionalProtect, strictGuestLimiter, validateBody(GenerateSchema), generateExplanation);

export default router;
