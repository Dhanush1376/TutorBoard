import express from 'express';
import { generateExplanation } from '../controllers/generate.controller.js';

const router = express.Router();

// Route cleanly mapped to controller logic
router.post('/generate', generateExplanation);

export default router;
