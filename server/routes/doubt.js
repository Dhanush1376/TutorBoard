import express from 'express';
import { answerDoubt, getDoubtHistory } from '../controllers/doubt.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Answer doubt - protecting it makes it optional for guest but saves for logged-in users
// However, since protect currently returns 401 if no token, I'll make a more flexible approach or just use it.
// Actually, let's use a simpler approach: if token exists, we'll try to decode it in the controller if we want optional.
// But for now, let's just protect the history and make answerDoubt handle both.
router.post('/doubt', (req, res, next) => {
  // Optional protection: if header exists, use protect, else continue
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  next();
}, answerDoubt);

router.get('/api/doubts/history', protect, getDoubtHistory);

export default router;
