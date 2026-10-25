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
  streamRegenerate,
  stopGeneration
} from '../controllers/chat.controller.js';
import { protect, optionalProtect, ensureSessionIdentity } from '../middleware/auth.middleware.js';
import { csrfCheck } from '../middleware/csrf.middleware.js';
import { strictGuestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Main chat endpoint — supports both authenticated users and guests (ensures verified guest identity)
router.post('/', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, sendMessage);

// SSE streaming endpoint — real-time token-by-token response with guaranteed session identity
router.post('/stream', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, streamMessage);

// Explicit Stop for an answer being generated (owner-checked)
router.post('/stop', csrfCheck, optionalProtect, stopGeneration);

// These support both authenticated users and guests (Fix S-03: Add rate limits)
router.post('/edit', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, editMessage);
router.post('/edit/stream', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, streamEditMessage);
router.post('/regenerate', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, regenerate);
router.post('/regenerate/stream', csrfCheck, optionalProtect, ensureSessionIdentity, strictGuestLimiter, streamRegenerate);
router.delete('/message', csrfCheck, optionalProtect, deleteMessage);
router.post('/feedback', csrfCheck, optionalProtect, updateMessageFeedback);
router.post('/switch-version', csrfCheck, optionalProtect, switchMessageVersion);

export default router;
