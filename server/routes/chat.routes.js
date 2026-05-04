import express from 'express';
import { sendMessage, editMessage, regenerate, deleteMessage, streamMessage, updateMessageFeedback, switchMessageVersion } from '../controllers/chat.controller.js';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Main chat endpoint — supports both authenticated users and guests
router.post('/', optionalProtect, strictGuestLimiter, sendMessage);

// SSE streaming endpoint — real-time token-by-token response
router.post('/stream', optionalProtect, strictGuestLimiter, streamMessage);

// These support both authenticated users and guests
router.post('/edit', optionalProtect, editMessage);
router.post('/regenerate', optionalProtect, regenerate);
router.delete('/message', optionalProtect, deleteMessage);
router.post('/feedback', optionalProtect, updateMessageFeedback);
router.post('/switch-version', optionalProtect, switchMessageVersion);

export default router;
