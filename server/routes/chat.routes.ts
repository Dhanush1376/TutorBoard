import express from 'express';
import { 
  sendMessage, 
  editMessage, 
  streamEditMessage,
  regenerate, 
  deleteMessage, 
  streamMessage, 
  updateMessageFeedback, 
  switchMessageVersion, 
  streamRegenerate 
} from '../controllers/chat.controller.js';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Main chat endpoint — supports both authenticated users and guests
router.post('/', csrfCheck, optionalProtect, strictGuestLimiter, sendMessage);

// SSE streaming endpoint — real-time token-by-token response
router.post('/stream', csrfCheck, optionalProtect, strictGuestLimiter, streamMessage);

// These support both authenticated users and guests (Fix S-03: Add rate limits)
router.post('/edit', csrfCheck, optionalProtect, strictGuestLimiter, editMessage);
router.post('/edit/stream', csrfCheck, optionalProtect, strictGuestLimiter, streamEditMessage);
router.post('/regenerate', csrfCheck, optionalProtect, strictGuestLimiter, regenerate);
router.post('/regenerate/stream', csrfCheck, optionalProtect, strictGuestLimiter, streamRegenerate);
router.delete('/message', csrfCheck, optionalProtect, deleteMessage);
router.post('/feedback', csrfCheck, optionalProtect, updateMessageFeedback);
router.post('/switch-version', csrfCheck, optionalProtect, switchMessageVersion);

export default router;
