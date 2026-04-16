import express from 'express';
import { getSessions, getSession, saveSession, deleteSession } from '../controllers/session.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All session routes require authentication
router.use(protect);

router.get('/', getSessions);
router.get('/:id', getSession);
router.post('/', saveSession);
router.delete('/:id', deleteSession);

export default router;
