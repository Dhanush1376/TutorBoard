import express from 'express';
import { executeCodeProxy } from '../controllers/compiler.controller.js';

const router = express.Router();

// Publicly accessible code execution proxy (rate-limited by global middleware)
router.post('/api/compiler/execute', executeCodeProxy);

export default router;
