import express from 'express';
import { sendMessage, editMessage, regenerate, deleteMessage } from '../controllers/chat.controller.js';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Main chat endpoint — supports both authenticated users and guests
router.post('/', optionalProtect, strictGuestLimiter, sendMessage);

// These require authentication (no guest editing/regenerating)
router.post('/edit', protect, editMessage);
router.post('/regenerate', protect, regenerate);
router.delete('/message', protect, deleteMessage);

export default router;
