import express from 'express';
import { generateExplanation } from '../controllers/generate.controller.js';
import { validateBody, GenerateSchema } from '../middleware/validation.middleware.js';

const router = express.Router();

router.post('/api/generate', validateBody(GenerateSchema), generateExplanation);

export default router;
