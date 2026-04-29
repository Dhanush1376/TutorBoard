import express from 'express';
import { getDashboardData } from '../controllers/learner.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/dashboard', protect, getDashboardData);

export default router;
