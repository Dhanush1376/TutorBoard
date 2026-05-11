import express from 'express';
import { executeCodeProxy } from '../controllers/compiler.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// SEC-33: Authenticated Code Execution Proxy (Prevents botnet/resource abuse)
router.post('/execute', protect, executeCodeProxy);

export default router;
