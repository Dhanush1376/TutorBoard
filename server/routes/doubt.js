import express from 'express';
import { answerDoubt, getDoubtHistory } from '../controllers/doubt.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateBody, DoubtSchema } from '../middleware/validation.middleware.js';

const router = express.Router();

router.post('/doubt', validateBody(DoubtSchema), (req, res, next) => {
  // Optional protection: if header exists, use protect, else continue
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  next();
}, answerDoubt);

router.get('/api/doubts/history', protect, getDoubtHistory);

export default router;
